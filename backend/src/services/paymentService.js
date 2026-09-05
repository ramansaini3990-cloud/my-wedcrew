import Payment, { EARNED_STATUSES } from '../models/Payment.js';
import FinanceSetting from '../models/FinanceSetting.js';
import { splitFee } from './money.js';
import { post as postLedger, newReference } from './ledgerService.js';

/**
 * Payment lifecycle rules.
 *
 * The state machine is declared once, here, and every status change in the
 * codebase goes through `transition()`. That makes an illegal move such as
 * FAILED -> SUCCESS impossible to perform by accident from a controller, a
 * webhook or an admin action.
 */

/** from -> allowed next states. Anything absent is terminal. */
export const TRANSITIONS = {
  // ---- online ----
  INITIATED: ['PENDING', 'PROCESSING', 'SUCCESS', 'FAILED', 'CANCELLED'],
  PENDING: ['PROCESSING', 'SUCCESS', 'FAILED', 'CANCELLED'],
  PROCESSING: ['SUCCESS', 'FAILED'],
  SUCCESS: ['REFUND_REQUESTED'],
  FAILED: [],            // a new attempt is a NEW payment, never a revival
  CANCELLED: [],
  REFUND_REQUESTED: ['REFUND_PROCESSING', 'REFUND_FAILED'],
  REFUND_PROCESSING: ['REFUNDED', 'REFUND_FAILED'],
  REFUNDED: [],
  REFUND_FAILED: ['REFUND_REQUESTED'],

  // ---- cash ----
  CASH_PENDING: ['CASH_CONFIRMED', 'CASH_DISPUTED', 'CASH_CANCELLED'],
  CASH_CONFIRMED: ['CASH_REFUND_REQUESTED'],
  // A dispute is resolved by an admin either way.
  CASH_DISPUTED: ['CASH_CONFIRMED', 'CASH_CANCELLED'],
  CASH_CANCELLED: [],
  CASH_REFUND_REQUESTED: ['CASH_REFUND_CONFIRMED', 'CASH_CONFIRMED'],
  CASH_REFUND_CONFIRMED: []
};

export const canTransition = (from, to) => Boolean(TRANSITIONS[from]?.includes(to));

/**
 * Moves a payment to a new status, refusing illegal transitions.
 *
 * The update is conditional on the CURRENT status, so two concurrent requests
 * cannot both apply the same transition - the second matches nothing.
 *
 * @returns {Promise<{ok: true, payment: object} | {ok: false, code: string, message: string}>}
 */
export const transition = async (payment, nextStatus, patch = {}) => {
  const from = payment.status;
  if (from === nextStatus) {
    return { ok: false, code: 'ALREADY_IN_STATE', message: `This payment is already ${nextStatus}.` };
  }
  if (!canTransition(from, nextStatus)) {
    return {
      ok: false,
      code: 'INVALID_TRANSITION',
      message: `A payment cannot go from ${from} to ${nextStatus}.`
    };
  }

  const updated = await Payment.findOneAndUpdate(
    { _id: payment._id, status: from },   // optimistic guard
    { $set: { status: nextStatus, ...patch } },
    { new: true }
  );

  if (!updated) {
    return { ok: false, code: 'CONCURRENT_UPDATE', message: 'This payment was just updated. Reload and try again.' };
  }
  return { ok: true, payment: updated };
};

/** Current platform fee configuration. */
export const feeConfig = () => FinanceSetting.current();

/** Computes gross/fee/net for an amount using the live configuration. */
export const quote = async (amountPaise) => {
  const config = await feeConfig();
  const split = splitFee(amountPaise, config);
  return { ...split, fee_bps: config.fee_bps, currency: config.currency || 'INR' };
};

/**
 * Posts the ledger entries for a payment that has actually been settled
 * (online SUCCESS, or cash CASH_CONFIRMED).
 *
 * Three entries describe one settlement:
 *   company    -amount   money left the company
 *   freelancer +net      money the freelancer earned
 *   platform   +fee      the commission
 *
 * Every transaction_id is derived from the payment id, so replaying this -
 * from a duplicate webhook, a retried request - inserts nothing new.
 *
 * @param {object} payment
 * @param {boolean} available whether the earning is immediately withdrawable
 */
export const postSettlementEntries = async (payment, { available = true } = {}) => {
  const base = String(payment._id);
  const isCash = payment.method === 'cash';

  const common = {
    company_id: payment.company_id,
    freelancer_id: payment.freelancer_id,
    payment_id: payment._id,
    booking_request_id: payment.booking_request_id || undefined,
    method: payment.method,
    provider: payment.provider || undefined,
    provider_reference: payment.provider_payment_id || undefined,
    currency: payment.currency || 'INR'
  };

  const results = await Promise.all([
    postLedger({
      ...common,
      transaction_id: `${base}:company`,
      type: isCash ? 'CASH_PAYMENT' : 'BOOKING_PAYMENT',
      user_id: payment.company_id,
      user_role: 'company',
      amount_paise: -payment.amount_paise,
      available: true,
      description: `Payment ${payment.reference}`
    }),
    postLedger({
      ...common,
      transaction_id: `${base}:freelancer`,
      type: 'FREELANCER_EARNING',
      user_id: payment.freelancer_id,
      user_role: 'freelancer',
      amount_paise: payment.net_paise,
      available,
      description: `Earning from ${payment.reference}`
    }),
    postLedger({
      ...common,
      transaction_id: `${base}:fee`,
      type: 'PLATFORM_FEE',
      user_id: payment.freelancer_id,
      user_role: 'platform',
      amount_paise: -payment.fee_paise,
      // The fee is not part of the freelancer's spendable balance.
      available: false,
      description: `Platform fee on ${payment.reference}`
    })
  ]);

  return { posted: results.filter((r) => !r.duplicate).length, duplicate: results.every((r) => r.duplicate) };
};

/**
 * Reverses a settlement (refund, or a dispute resolved against the freelancer).
 * Never edits the original entries - posts mirror-image ones.
 */
export const postReversalEntries = async (payment, { reason = 'Reversal' } = {}) => {
  const base = String(payment._id);
  const common = {
    company_id: payment.company_id,
    freelancer_id: payment.freelancer_id,
    payment_id: payment._id,
    method: payment.method,
    currency: payment.currency || 'INR'
  };

  await Promise.all([
    postLedger({
      ...common,
      transaction_id: `${base}:refund:company`,
      type: 'REFUND',
      user_id: payment.company_id,
      user_role: 'company',
      amount_paise: payment.amount_paise,
      available: true,
      reverses_transaction_id: `${base}:company`,
      description: `${reason} - ${payment.reference}`
    }),
    postLedger({
      ...common,
      transaction_id: `${base}:refund:freelancer`,
      type: 'REVERSAL',
      user_id: payment.freelancer_id,
      user_role: 'freelancer',
      amount_paise: -payment.net_paise,
      available: true,
      reverses_transaction_id: `${base}:freelancer`,
      description: `${reason} - ${payment.reference}`
    }),
    postLedger({
      ...common,
      transaction_id: `${base}:refund:fee`,
      type: 'REVERSAL',
      user_id: payment.freelancer_id,
      user_role: 'platform',
      amount_paise: payment.fee_paise,
      available: false,
      reverses_transaction_id: `${base}:fee`,
      description: `${reason} fee reversal - ${payment.reference}`
    })
  ]);
};

/** Whether this payment has settled money. */
export const isSettled = (payment) => EARNED_STATUSES.includes(payment.status);

/** API shape. Provider secrets are never part of a payment DTO. */
export const toPaymentDTO = (payment, { includeParties = null } = {}) => ({
  id: String(payment._id),
  reference: payment.reference,
  method: payment.method,
  status: payment.status,
  amount_paise: payment.amount_paise,
  fee_paise: payment.fee_paise,
  net_paise: payment.net_paise,
  fee_bps_applied: payment.fee_bps_applied,
  currency: payment.currency,
  provider: payment.provider || null,
  provider_order_id: payment.provider_order_id || null,
  provider_payment_id: payment.provider_payment_id || null,
  booking_request_id: payment.booking_request_id ? String(payment.booking_request_id) : null,
  requirement_id: payment.requirement_id ? String(payment.requirement_id) : null,
  cash_confirmed_at: payment.cash_confirmed_at || null,
  dispute_reason: payment.dispute_reason || null,
  dispute_resolution: payment.dispute_resolution || null,
  dispute_resolved_at: payment.dispute_resolved_at || null,
  failure_reason: payment.failure_reason || null,
  refund_reason: payment.refund_reason || null,
  note: payment.note || null,
  created_at: payment.created_at,
  updated_at: payment.updated_at,
  ...(includeParties || {})
});

export const newPaymentReference = () => newReference('PAY');

export default {
  TRANSITIONS,
  canTransition,
  transition,
  quote,
  feeConfig,
  postSettlementEntries,
  postReversalEntries,
  isSettled,
  toPaymentDTO,
  newPaymentReference
};
