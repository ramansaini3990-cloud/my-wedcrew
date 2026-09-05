import Withdrawal, { WITHDRAWAL_TERMINAL } from '../models/Withdrawal.js';
import FinanceSetting from '../models/FinanceSetting.js';
import { getFreelancerBalance, post as postLedger, newReference } from './ledgerService.js';

/**
 * Withdrawal lifecycle.
 *
 * A withdrawal debits the ledger the moment it is REQUESTED, not when it
 * completes. That is deliberate: the money is committed as soon as the
 * freelancer asks for it, so two concurrent requests cannot both pass the
 * balance check and overdraw the account. If the payout later fails or is
 * cancelled, a REVERSAL entry puts the amount back.
 */

export const TRANSITIONS = {
  REQUESTED: ['PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED'],
  PROCESSING: ['COMPLETED', 'FAILED'],
  FAILED: ['REVERSED'],
  COMPLETED: [],
  CANCELLED: [],
  REVERSED: []
};

export const canTransition = (from, to) => Boolean(TRANSITIONS[from]?.includes(to));

/**
 * Creates a withdrawal request after re-deriving the balance server-side.
 *
 * The frontend never supplies a balance - it is recomputed from the ledger on
 * every request, so a tampered client cannot withdraw more than it earned.
 */
export const requestWithdrawal = async ({ user, amountPaise, payoutAccount }) => {
  const config = await FinanceSetting.current();

  if (amountPaise < (config.min_withdrawal_paise || 0)) {
    return {
      ok: false,
      code: 'BELOW_MINIMUM',
      message: `The minimum withdrawal is ₹${((config.min_withdrawal_paise || 0) / 100).toLocaleString('en-IN')}.`
    };
  }

  const balance = await getFreelancerBalance(user.id || user._id);
  if (amountPaise > balance.available) {
    return {
      ok: false,
      code: 'INSUFFICIENT_BALANCE',
      message: 'That is more than your available balance.',
      available_paise: balance.available
    };
  }

  // One in-flight withdrawal at a time keeps the ledger and the payout queue
  // easy to reason about, and removes a whole class of race conditions.
  const inFlight = await Withdrawal.findOne({
    user_id: user.id || user._id,
    status: { $in: ['REQUESTED', 'PROCESSING'] }
  }).lean();
  if (inFlight) {
    return {
      ok: false,
      code: 'WITHDRAWAL_IN_PROGRESS',
      message: 'You already have a withdrawal in progress.'
    };
  }

  const withdrawal = await Withdrawal.create({
    reference: newReference('WDL'),
    user_id: user.id || user._id,
    payout_account_id: payoutAccount._id,
    amount_paise: amountPaise,
    status: 'REQUESTED',
    method: payoutAccount.method,
    masked_destination: payoutAccount.masked,
    currency: config.currency || 'INR'
  });

  // Debit immediately - see the note at the top of this file.
  await postLedger({
    transaction_id: `${withdrawal._id}:withdrawal`,
    type: 'WITHDRAWAL',
    user_id: withdrawal.user_id,
    user_role: 'freelancer',
    freelancer_id: withdrawal.user_id,
    withdrawal_id: withdrawal._id,
    amount_paise: -amountPaise,
    available: true,
    method: payoutAccount.method,
    description: `Withdrawal ${withdrawal.reference}`
  });

  return { ok: true, withdrawal };
};

/** Moves a withdrawal, refusing illegal transitions and racing updates. */
export const transition = async (withdrawal, nextStatus, patch = {}) => {
  const from = withdrawal.status;
  if (WITHDRAWAL_TERMINAL.includes(from)) {
    return { ok: false, code: 'TERMINAL_STATE', message: `This withdrawal is already ${from}.` };
  }
  if (!canTransition(from, nextStatus)) {
    return { ok: false, code: 'INVALID_TRANSITION', message: `A withdrawal cannot go from ${from} to ${nextStatus}.` };
  }

  const updated = await Withdrawal.findOneAndUpdate(
    { _id: withdrawal._id, status: from },
    { $set: { status: nextStatus, ...patch } },
    { new: true }
  );
  if (!updated) {
    return { ok: false, code: 'CONCURRENT_UPDATE', message: 'This withdrawal was just updated. Reload and try again.' };
  }

  // A failed or cancelled payout returns the money to the available balance.
  if (['FAILED', 'CANCELLED', 'REVERSED'].includes(nextStatus)) {
    await postLedger({
      transaction_id: `${updated._id}:withdrawal:reversal`,
      type: 'REVERSAL',
      user_id: updated.user_id,
      user_role: 'freelancer',
      freelancer_id: updated.user_id,
      withdrawal_id: updated._id,
      amount_paise: updated.amount_paise,
      available: true,
      reverses_transaction_id: `${updated._id}:withdrawal`,
      description: `Withdrawal ${updated.reference} ${nextStatus.toLowerCase()}`
    });
  }

  return { ok: true, withdrawal: updated };
};

/** API shape - the destination is already masked on the record. */
export const toWithdrawalDTO = (w) => ({
  id: String(w._id),
  reference: w.reference,
  amount_paise: w.amount_paise,
  currency: w.currency,
  status: w.status,
  method: w.method,
  masked_destination: w.masked_destination,
  provider_payout_id: w.provider_payout_id || null,
  failure_reason: w.failure_reason || null,
  admin_note: w.admin_note || null,
  completed_at: w.completed_at || null,
  created_at: w.created_at,
  updated_at: w.updated_at
});

export default { requestWithdrawal, transition, canTransition, toWithdrawalDTO, TRANSITIONS };
