import mongoose from 'mongoose';
import Payment from '../../models/Payment.js';
import Withdrawal from '../../models/Withdrawal.js';
import LedgerEntry from '../../models/LedgerEntry.js';
import FinanceSetting from '../../models/FinanceSetting.js';
import Notification from '../../models/Notification.js';
import { emitNotification } from '../../socket.js';
import { logFromRequest } from '../../services/activityService.js';
import { formatPaise } from '../../services/money.js';
import { transition as transitionPayment, postSettlementEntries, toPaymentDTO } from '../../services/paymentService.js';
import { transition as transitionWithdrawal, toWithdrawalDTO } from '../../services/withdrawalService.js';
import { post as postLedger } from '../../services/ledgerService.js';

/**
 * Admin finance panel.
 *
 * Admins can review and resolve, but cannot set a balance directly - every
 * correction goes through the ledger as an ADJUSTMENT entry, so the audit
 * trail always explains how a number came to be. All routes here are mounted
 * behind `protect, admin`.
 */

const notify = async (recipientId, role, type, title, message) => {
  try {
    const n = await Notification.create({ recipient_id: recipientId, recipient_role: role, type, title, message });
    emitNotification(recipientId, n);
  } catch (error) {
    console.error('admin finance notification failed:', error.message);
  }
};

/** GET /api/admin/finance/overview */
export const getOverview = async (req, res) => {
  try {
    const [byStatus, feeRow, withdrawals, disputes, settings] = await Promise.all([
      Payment.aggregate([{ $group: { _id: '$status', count: { $sum: 1 }, total: { $sum: '$amount_paise' } } }]),
      LedgerEntry.aggregate([
        { $match: { type: 'PLATFORM_FEE' } },
        { $group: { _id: null, total: { $sum: '$amount_paise' } } }
      ]),
      Withdrawal.aggregate([{ $group: { _id: '$status', count: { $sum: 1 }, total: { $sum: '$amount_paise' } } }]),
      Payment.countDocuments({ status: 'CASH_DISPUTED' }),
      FinanceSetting.current()
    ]);

    const settled = byStatus.filter((r) => ['SUCCESS', 'CASH_CONFIRMED'].includes(r._id));
    res.json({
      success: true,
      data: {
        payments_by_status: byStatus.map((r) => ({ status: r._id, count: r.count, total_paise: r.total })),
        withdrawals_by_status: withdrawals.map((r) => ({ status: r._id, count: r.count, total_paise: r.total })),
        settled_total_paise: settled.reduce((a, r) => a + r.total, 0),
        settled_count: settled.reduce((a, r) => a + r.count, 0),
        platform_fees_paise: Math.abs(feeRow[0]?.total || 0),
        open_disputes: disputes,
        settings: {
          fee_bps: settings.fee_bps,
          min_fee_paise: settings.min_fee_paise,
          max_fee_paise: settings.max_fee_paise,
          min_withdrawal_paise: settings.min_withdrawal_paise,
          currency: settings.currency
        }
      }
    });
  } catch (error) {
    console.error('finance getOverview error:', error);
    res.status(500).json({ code: 'SERVER_ERROR', message: 'Could not load finance overview.' });
  }
};

/** GET /api/admin/finance/payments */
export const listPayments = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit, 10) || 25, 100);

    const query = {};
    if (['online', 'cash'].includes(req.query.method)) query.method = req.query.method;
    if (req.query.status) query.status = { $in: String(req.query.status).split(',').map((s) => s.trim()) };

    const [rows, total] = await Promise.all([
      Payment.find(query)
        .populate('company_id', 'name')
        .populate('freelancer_id', 'name profession')
        .sort({ created_at: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Payment.countDocuments(query)
    ]);

    res.json({
      success: true,
      data: rows.map((p) => toPaymentDTO(p, {
        includeParties: {
          company: p.company_id ? { id: String(p.company_id._id), name: p.company_id.name } : null,
          freelancer: p.freelancer_id ? { id: String(p.freelancer_id._id), name: p.freelancer_id.name } : null
        }
      })),
      pagination: { total, page, pages: Math.ceil(total / limit) }
    });
  } catch (error) {
    console.error('finance listPayments error:', error);
    res.status(500).json({ code: 'SERVER_ERROR', message: 'Could not load payments.' });
  }
};

/** GET /api/admin/finance/withdrawals */
export const listWithdrawals = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit, 10) || 25, 100);
    const query = {};
    if (req.query.status) query.status = req.query.status;

    const [rows, total] = await Promise.all([
      Withdrawal.find(query).populate('user_id', 'name profession').sort({ created_at: -1 })
        .skip((page - 1) * limit).limit(limit).lean(),
      Withdrawal.countDocuments(query)
    ]);

    res.json({
      success: true,
      data: rows.map((w) => ({
        ...toWithdrawalDTO(w),
        freelancer: w.user_id ? { id: String(w.user_id._id), name: w.user_id.name } : null
      })),
      pagination: { total, page, pages: Math.ceil(total / limit) }
    });
  } catch (error) {
    console.error('finance listWithdrawals error:', error);
    res.status(500).json({ code: 'SERVER_ERROR', message: 'Could not load withdrawals.' });
  }
};

/** PATCH /api/admin/finance/withdrawals/:id - approve / complete / fail. */
export const updateWithdrawal = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ code: 'NOT_FOUND', message: 'Withdrawal not found.' });
    }
    const status = String(req.body.status || '').toUpperCase();
    if (!['PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED'].includes(status)) {
      return res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Invalid withdrawal status.' });
    }

    const withdrawal = await Withdrawal.findById(req.params.id);
    if (!withdrawal) return res.status(404).json({ code: 'NOT_FOUND', message: 'Withdrawal not found.' });

    const patch = {
      processed_by: req.user.id || req.user._id,
      admin_note: String(req.body.note || '').slice(0, 500) || undefined,
      ...(status === 'COMPLETED' ? { completed_at: new Date() } : {}),
      ...(status === 'FAILED' ? { failure_reason: String(req.body.note || 'Payout failed').slice(0, 300) } : {})
    };

    // transitionWithdrawal posts the REVERSAL entry itself when a payout
    // fails or is cancelled, so the balance is restored automatically.
    const moved = await transitionWithdrawal(withdrawal, status, patch);
    if (!moved.ok) return res.status(409).json(moved);

    await notify(
      moved.withdrawal.user_id, 'freelancer', `withdrawal_${status.toLowerCase()}`,
      `Withdrawal ${status.toLowerCase()}`,
      `Your withdrawal of ${formatPaise(moved.withdrawal.amount_paise)} is now ${status.toLowerCase()}.`
    );

    await logFromRequest(req, {
      eventType: `withdrawal.${status.toLowerCase()}`,
      category: 'payments',
      severity: status === 'FAILED' ? 'warning' : status === 'COMPLETED' ? 'success' : 'info',
      title: `Withdrawal ${status.toLowerCase()}`,
      description: `${formatPaise(moved.withdrawal.amount_paise)} - ${moved.withdrawal.reference}`,
      target: { type: 'user', id: moved.withdrawal.user_id, label: moved.withdrawal.reference },
      metadata: { reference: moved.withdrawal.reference, amount_paise: moved.withdrawal.amount_paise, status }
    });

    res.json({ success: true, data: toWithdrawalDTO(moved.withdrawal) });
  } catch (error) {
    console.error('updateWithdrawal error:', error);
    res.status(500).json({ code: 'SERVER_ERROR', message: 'Could not update this withdrawal.' });
  }
};

/** GET /api/admin/finance/disputes */
export const listDisputes = async (req, res) => {
  try {
    const rows = await Payment.find({ status: 'CASH_DISPUTED' })
      .populate('company_id', 'name')
      .populate('freelancer_id', 'name profession')
      .sort({ created_at: -1 })
      .limit(100)
      .lean();

    res.json({
      success: true,
      data: rows.map((p) => toPaymentDTO(p, {
        includeParties: {
          company: p.company_id ? { id: String(p.company_id._id), name: p.company_id.name } : null,
          freelancer: p.freelancer_id ? { id: String(p.freelancer_id._id), name: p.freelancer_id.name } : null
        }
      }))
    });
  } catch (error) {
    console.error('listDisputes error:', error);
    res.status(500).json({ code: 'SERVER_ERROR', message: 'Could not load disputes.' });
  }
};

/**
 * POST /api/admin/finance/disputes/:id/resolve
 *
 * CONFIRMED  - the cash did change hands; settle it and credit the freelancer
 * REJECTED   - it did not; the payment is cancelled and nothing settles
 * CANCELLED  - withdrawn by agreement
 */
export const resolveDispute = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ code: 'NOT_FOUND', message: 'Payment not found.' });
    }
    const resolution = String(req.body.resolution || '').toUpperCase();
    if (!['CONFIRMED', 'REJECTED', 'CANCELLED'].includes(resolution)) {
      return res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Choose a valid resolution.' });
    }

    const payment = await Payment.findById(req.params.id);
    if (!payment) return res.status(404).json({ code: 'NOT_FOUND', message: 'Payment not found.' });
    if (payment.status !== 'CASH_DISPUTED') {
      return res.status(409).json({ code: 'NOT_DISPUTED', message: 'This payment is not under dispute.' });
    }

    const note = String(req.body.note || '').slice(0, 500);
    const nextStatus = resolution === 'CONFIRMED' ? 'CASH_CONFIRMED' : 'CASH_CANCELLED';

    const moved = await transitionPayment(payment, nextStatus, {
      dispute_resolution: `${resolution}${note ? `: ${note}` : ''}`,
      dispute_resolved_by: req.user.id || req.user._id,
      dispute_resolved_at: new Date(),
      ...(resolution === 'CONFIRMED' ? { cash_confirmed_at: new Date() } : {})
    });
    if (!moved.ok) return res.status(409).json(moved);

    if (resolution === 'CONFIRMED') await postSettlementEntries(moved.payment, { available: true });

    for (const [uid, role] of [[moved.payment.company_id, 'company'], [moved.payment.freelancer_id, 'freelancer']]) {
      await notify(
        uid, role, 'payment_dispute_resolved', 'Cash dispute resolved',
        `The ${formatPaise(moved.payment.amount_paise)} cash dispute was resolved: ${resolution.toLowerCase()}.`
      );
    }

    await logFromRequest(req, {
      eventType: 'payment.dispute_resolved',
      category: 'payments',
      severity: 'success',
      title: 'Cash dispute resolved',
      description: `${moved.payment.reference} resolved as ${resolution}`,
      target: { type: 'payment', id: moved.payment._id, label: moved.payment.reference },
      metadata: { reference: moved.payment.reference, status: resolution, reason: note || undefined }
    });

    res.json({ success: true, data: toPaymentDTO(moved.payment) });
  } catch (error) {
    console.error('resolveDispute error:', error);
    res.status(500).json({ code: 'SERVER_ERROR', message: 'Could not resolve this dispute.' });
  }
};

/** PUT /api/admin/finance/settings - platform fee configuration. */
export const updateSettings = async (req, res) => {
  try {
    const patch = {};
    if (req.body.fee_bps !== undefined) {
      const bps = Number(req.body.fee_bps);
      if (!Number.isInteger(bps) || bps < 0 || bps > 10000) {
        return res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Fee must be between 0 and 10000 basis points.' });
      }
      patch.fee_bps = bps;
    }
    for (const key of ['min_fee_paise', 'max_fee_paise', 'min_withdrawal_paise']) {
      if (req.body[key] === undefined) continue;
      if (req.body[key] === null) { patch[key] = null; continue; }
      const value = Number(req.body[key]);
      if (!Number.isInteger(value) || value < 0) {
        return res.status(400).json({ code: 'VALIDATION_ERROR', message: `${key} must be a non-negative whole number of paise.` });
      }
      patch[key] = value;
    }
    if (!Object.keys(patch).length) {
      return res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Nothing to update.' });
    }
    patch.updated_by = req.user.id || req.user._id;

    await FinanceSetting.current();
    const updated = await FinanceSetting.findOneAndUpdate({ key: 'default' }, { $set: patch }, { new: true });

    await logFromRequest(req, {
      eventType: 'finance.settings_updated',
      category: 'payments',
      title: 'Finance settings updated',
      description: `Platform fee is now ${(updated.fee_bps / 100).toFixed(2)}%`,
      target: { type: 'system', id: updated._id },
      metadata: { status: 'updated' }
    });

    res.json({ success: true, data: updated });
  } catch (error) {
    console.error('updateSettings error:', error);
    res.status(500).json({ code: 'SERVER_ERROR', message: 'Could not update finance settings.' });
  }
};

/**
 * POST /api/admin/finance/adjustments
 *
 * The ONLY way an admin may move a balance. It appends an ADJUSTMENT entry
 * rather than editing anything, so the correction and its reason are part of
 * the permanent record.
 */
export const createAdjustment = async (req, res) => {
  try {
    const { user_id, amount_paise, reason } = req.body;
    if (!mongoose.isValidObjectId(user_id)) {
      return res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Select a user.' });
    }
    const amount = Number(amount_paise);
    if (!Number.isInteger(amount) || amount === 0) {
      return res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Enter a non-zero whole number of paise.' });
    }
    const why = String(reason || '').trim().slice(0, 300);
    if (!why) return res.status(400).json({ code: 'VALIDATION_ERROR', message: 'A reason is required.' });

    const { entry } = await postLedger({
      type: 'ADJUSTMENT',
      user_id,
      user_role: 'freelancer',
      freelancer_id: user_id,
      amount_paise: amount,
      available: true,
      description: why,
      created_by: req.user.id || req.user._id
    });

    await logFromRequest(req, {
      eventType: 'finance.adjustment',
      category: 'payments',
      severity: 'warning',
      title: 'Manual ledger adjustment',
      description: `${formatPaise(Math.abs(amount))} ${amount > 0 ? 'credited' : 'debited'} - ${why}`,
      target: { type: 'user', id: user_id, label: entry.transaction_id },
      metadata: { transaction_id: entry.transaction_id, amount_paise: amount, reason: why }
    });

    res.status(201).json({ success: true, data: { transaction_id: entry.transaction_id, amount_paise: amount } });
  } catch (error) {
    console.error('createAdjustment error:', error);
    res.status(500).json({ code: 'SERVER_ERROR', message: 'Could not post this adjustment.' });
  }
};

export default {
  getOverview,
  listPayments,
  listWithdrawals,
  updateWithdrawal,
  listDisputes,
  resolveDispute,
  updateSettings,
  createAdjustment
};
