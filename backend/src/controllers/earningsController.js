import mongoose from 'mongoose';
import Payment from '../models/Payment.js';
import Withdrawal from '../models/Withdrawal.js';
import { enumFilter } from '../services/queryFilters.js';
import PayoutAccount from '../models/PayoutAccount.js';
import FinanceSetting from '../models/FinanceSetting.js';
import Notification from '../models/Notification.js';
import User from '../models/User.js';
import { emitNotification } from '../socket.js';
import { logFromRequest } from '../services/activityService.js';
import { rupeesToPaise, formatPaise } from '../services/money.js';
import { getFreelancerBalance, listForUser } from '../services/ledgerService.js';
import { requestWithdrawal, toWithdrawalDTO } from '../services/withdrawalService.js';
import { toPaymentDTO } from '../services/paymentService.js';

/**
 * Freelancer earnings, payout account and withdrawals.
 *
 * Every figure here is DERIVED from the ledger on each request. No balance is
 * ever read from a field the client could influence, and no amount supplied by
 * the browser is trusted for anything but the requested withdrawal value,
 * which is re-checked against the derived balance server-side.
 */

const idOf = (req) => req.user.id || req.user._id;

const freelancerOnly = (req, res) => {
  if (req.user.role !== 'freelancer') {
    res.status(403).json({ code: 'FORBIDDEN', message: 'Only professionals have earnings.' });
    return false;
  }
  return true;
};

const notify = async (recipientId, role, type, title, message) => {
  try {
    const n = await Notification.create({ recipient_id: recipientId, recipient_role: role, type, title, message });
    emitNotification(recipientId, n);
  } catch (error) {
    console.error('earnings notification failed:', error.message);
  }
};

/** GET /api/earnings - summary + recent booking-wise earnings. */
export const getEarnings = async (req, res) => {
  try {
    if (!freelancerOnly(req, res)) return;
    const userId = idOf(req);

    const [balance, settings, payments, account, pendingCash] = await Promise.all([
      getFreelancerBalance(userId),
      FinanceSetting.current(),
      Payment.find({ freelancer_id: userId, status: { $in: ['SUCCESS', 'CASH_CONFIRMED'] } })
        .populate('company_id', 'name')
        .sort({ created_at: -1 })
        .limit(20)
        .lean(),
      PayoutAccount.findOne({ user_id: userId, is_active: true }),
      Payment.countDocuments({ freelancer_id: userId, status: 'CASH_PENDING' })
    ]);

    res.json({
      success: true,
      data: {
        balance,
        min_withdrawal_paise: settings.min_withdrawal_paise,
        fee_bps: settings.fee_bps,
        currency: settings.currency || 'INR',
        pending_cash_confirmations: pendingCash,
        payout_account: account ? account.publicView() : null,
        recent: payments.map((p) => toPaymentDTO(p, {
          includeParties: {
            company: p.company_id ? { id: String(p.company_id._id), name: p.company_id.name } : null
          }
        }))
      }
    });
  } catch (error) {
    console.error('getEarnings error:', error);
    res.status(500).json({ code: 'SERVER_ERROR', message: 'Could not load your earnings.' });
  }
};

/** GET /api/earnings/ledger - the freelancer's own transaction history. */
export const getLedger = async (req, res) => {
  try {
    if (!freelancerOnly(req, res)) return;
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit, 10) || 25, 100);

    const { entries, total } = await listForUser(idOf(req), { limit, skip: (page - 1) * limit });
    res.json({
      success: true,
      data: entries.map((e) => ({
        id: String(e._id),
        transaction_id: e.transaction_id,
        type: e.type,
        amount_paise: e.amount_paise,
        available: e.available,
        description: e.description || '',
        created_at: e.created_at
      })),
      pagination: { total, page, pages: Math.ceil(total / limit) }
    });
  } catch (error) {
    console.error('getLedger error:', error);
    res.status(500).json({ code: 'SERVER_ERROR', message: 'Could not load your transactions.' });
  }
};

/* ------------------------------------------------------------------ */
/* Payout account                                                      */
/* ------------------------------------------------------------------ */

/** "XXXXXX1234" for a bank account, "ra****@upi" for a UPI id. */
const maskBank = (accountNumber) => {
  const digits = String(accountNumber).replace(/\s/g, '');
  return `${'X'.repeat(Math.max(4, digits.length - 4))}${digits.slice(-4)}`;
};
const maskUpi = (upi) => {
  const [handle, domain] = String(upi).split('@');
  const head = handle.slice(0, 2);
  return `${head}${'*'.repeat(Math.max(2, handle.length - 2))}@${domain || ''}`;
};

/** GET /api/payout-account */
export const getPayoutAccount = async (req, res) => {
  try {
    if (!freelancerOnly(req, res)) return;
    const account = await PayoutAccount.findOne({ user_id: idOf(req), is_active: true });
    res.json({ success: true, data: account ? account.publicView() : null });
  } catch (error) {
    console.error('getPayoutAccount error:', error);
    res.status(500).json({ code: 'SERVER_ERROR', message: 'Could not load your payout account.' });
  }
};

/**
 * POST /api/payout-account
 *
 * Replaces the freelancer's payout destination. The previous account is
 * deactivated rather than deleted so historical withdrawals still resolve.
 * Only a MASKED form is ever returned to any client.
 */
export const savePayoutAccount = async (req, res) => {
  try {
    if (!freelancerOnly(req, res)) return;
    const userId = idOf(req);
    const method = String(req.body.method || '').trim();

    if (!['bank', 'upi'].includes(method)) {
      return res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Choose Bank or UPI.' });
    }

    const doc = { user_id: userId, method, is_active: true };

    if (method === 'bank') {
      const holder = String(req.body.account_holder_name || '').trim();
      const number = String(req.body.account_number || '').replace(/\s/g, '');
      const ifsc = String(req.body.ifsc || '').trim().toUpperCase();

      if (!holder) return res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Enter the account holder name.' });
      if (!/^\d{6,18}$/.test(number)) {
        return res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Enter a valid account number.' });
      }
      if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc)) {
        return res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Enter a valid IFSC code.' });
      }
      Object.assign(doc, { account_holder_name: holder, account_number: number, ifsc, masked: maskBank(number) });
    } else {
      const upi = String(req.body.upi_id || '').trim();
      if (!/^[\w.\-]{2,64}@[a-zA-Z]{2,64}$/.test(upi)) {
        return res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Enter a valid UPI ID (name@bank).' });
      }
      Object.assign(doc, {
        account_holder_name: String(req.body.account_holder_name || '').trim(),
        upi_id: upi,
        masked: maskUpi(upi)
      });
    }

    await PayoutAccount.updateMany({ user_id: userId, is_active: true }, { $set: { is_active: false } });
    const account = await PayoutAccount.create(doc);

    await logFromRequest(req, {
      eventType: 'payout_account.updated',
      category: 'payments',
      title: 'Payout account updated',
      description: `Payout destination set to ${method === 'bank' ? 'a bank account' : 'UPI'}`,
      target: { type: 'user', id: userId },
      // The masked value only - the raw identifier is never logged.
      metadata: { method, reference: account.masked }
    });

    res.status(201).json({ success: true, data: account.publicView() });
  } catch (error) {
    console.error('savePayoutAccount error:', error);
    res.status(500).json({ code: 'SERVER_ERROR', message: 'Could not save your payout account.' });
  }
};

/* ------------------------------------------------------------------ */
/* Withdrawals                                                         */
/* ------------------------------------------------------------------ */

/** GET /api/withdrawals */
export const listWithdrawals = async (req, res) => {
  try {
    if (!freelancerOnly(req, res)) return;
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
    // user_id is taken from the verified session, never the request, so this
    // list is always scoped to the caller. The status filter is still coerced
    // and enum-checked so `?status[$ne]=X` cannot rewrite the query around it.
    const query = { user_id: idOf(req) };
    if (req.query.status) query.status = enumFilter(req.query.status, Withdrawal, 'status');

    const [rows, total] = await Promise.all([
      Withdrawal.find(query).sort({ created_at: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      Withdrawal.countDocuments(query)
    ]);
    res.json({
      success: true,
      data: rows.map(toWithdrawalDTO),
      pagination: { total, page, pages: Math.ceil(total / limit) }
    });
  } catch (error) {
    console.error('listWithdrawals error:', error);
    res.status(500).json({ code: 'SERVER_ERROR', message: 'Could not load withdrawals.' });
  }
};

/** POST /api/withdrawals */
export const createWithdrawal = async (req, res) => {
  try {
    if (!freelancerOnly(req, res)) return;
    const userId = idOf(req);

    const amount = rupeesToPaise(req.body.amount);
    if (!amount.ok) return res.status(400).json({ code: 'VALIDATION_ERROR', message: amount.message });

    const account = await PayoutAccount.findOne({ user_id: userId, is_active: true });
    if (!account) {
      return res.status(400).json({ code: 'NO_PAYOUT_ACCOUNT', message: 'Add a payout account first.' });
    }

    const result = await requestWithdrawal({ user: req.user, amountPaise: amount.paise, payoutAccount: account });
    if (!result.ok) return res.status(400).json(result);

    await notify(
      userId, 'freelancer', 'withdrawal_requested', 'Withdrawal requested',
      `Your withdrawal of ${formatPaise(result.withdrawal.amount_paise)} has been requested.`
    );
    const admins = await User.find({ role: 'admin' }).select('_id').lean();
    for (const admin of admins) {
      await notify(
        admin._id, 'admin', 'withdrawal_requested', 'Withdrawal needs review',
        `A withdrawal of ${formatPaise(result.withdrawal.amount_paise)} was requested.`
      );
    }

    await logFromRequest(req, {
      eventType: 'withdrawal.requested',
      category: 'payments',
      title: 'Withdrawal requested',
      description: formatPaise(result.withdrawal.amount_paise),
      target: { type: 'user', id: userId, label: result.withdrawal.reference },
      metadata: {
        reference: result.withdrawal.reference,
        amount_paise: result.withdrawal.amount_paise,
        method: result.withdrawal.method
      }
    });

    res.status(201).json({ success: true, data: toWithdrawalDTO(result.withdrawal) });
  } catch (error) {
    console.error('createWithdrawal error:', error);
    res.status(500).json({ code: 'SERVER_ERROR', message: 'Could not request this withdrawal.' });
  }
};

/** GET /api/withdrawals/:id */
export const getWithdrawal = async (req, res) => {
  try {
    if (!freelancerOnly(req, res)) return;
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ code: 'NOT_FOUND', message: 'Withdrawal not found.' });
    }
    const w = await Withdrawal.findOne({ _id: req.params.id, user_id: idOf(req) }).lean();
    if (!w) return res.status(404).json({ code: 'NOT_FOUND', message: 'Withdrawal not found.' });
    res.json({ success: true, data: toWithdrawalDTO(w) });
  } catch (error) {
    console.error('getWithdrawal error:', error);
    res.status(500).json({ code: 'SERVER_ERROR', message: 'Could not load this withdrawal.' });
  }
};

export default {
  getEarnings,
  getLedger,
  getPayoutAccount,
  savePayoutAccount,
  listWithdrawals,
  createWithdrawal,
  getWithdrawal
};
