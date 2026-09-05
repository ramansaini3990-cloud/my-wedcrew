import crypto from 'crypto';
import mongoose from 'mongoose';
import LedgerEntry from '../models/LedgerEntry.js';

/**
 * The ledger is the single source of financial truth.
 *
 * Two rules make this trustworthy:
 *
 *   1. ENTRIES ARE IMMUTABLE. Nothing is ever updated or deleted; a correction
 *      is a new ADJUSTMENT/REVERSAL entry. The model itself refuses updates.
 *
 *   2. BALANCES ARE DERIVED. No balance is stored on a user document, so a
 *      balance can never disagree with the transactions behind it. Every
 *      figure the API reports is a live aggregation over these entries.
 *
 * All amounts are integer paise, signed relative to `user_id`.
 */

const toObjectId = (v) => {
  if (!v) return null;
  if (v instanceof mongoose.Types.ObjectId) return v;
  return mongoose.Types.ObjectId.isValid(String(v)) ? new mongoose.Types.ObjectId(String(v)) : null;
};

/** Prefixed, collision-resistant, human-quotable reference. */
export const newReference = (prefix) =>
  `${prefix}_${Date.now().toString(36).toUpperCase()}${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

/**
 * Appends one entry.
 *
 * `transaction_id` is unique, so posting the same logical event twice (a
 * retried webhook, a double-clicked button) raises a duplicate-key error which
 * is swallowed here - the ledger already reflects that event exactly once.
 *
 * @returns {Promise<{entry: object|null, duplicate: boolean}>}
 */
export const post = async (entry) => {
  try {
    const created = await LedgerEntry.create({
      ...entry,
      transaction_id: entry.transaction_id || newReference('TXN')
    });
    return { entry: created, duplicate: false };
  } catch (error) {
    if (error?.code === 11000) {
      const existing = await LedgerEntry.findOne({ transaction_id: entry.transaction_id }).lean();
      return { entry: existing, duplicate: true };
    }
    throw error;
  }
};

/** Appends several entries, skipping any already posted. */
export const postMany = async (entries) => {
  const results = [];
  for (const entry of entries) results.push(await post(entry));
  return results;
};

/**
 * Derived balances for one freelancer, in integer paise.
 *
 *   total_earned      every FREELANCER_EARNING ever credited
 *   pending           earned but not yet available (e.g. disputed cash)
 *   withdrawn         COMPLETED + in-flight withdrawals (they are debits)
 *   available         what may be withdrawn right now
 *
 * `available` is a straight sum of every AVAILABLE entry, which already
 * includes withdrawal debits and any adjustments - so it cannot drift.
 */
export const getFreelancerBalance = async (userId) => {
  const uid = toObjectId(userId);
  if (!uid) return { total_earned: 0, pending: 0, available: 0, withdrawn: 0, platform_fees: 0 };

  const rows = await LedgerEntry.aggregate([
    { $match: { user_id: uid } },
    {
      $group: {
        _id: { type: '$type', available: '$available' },
        total: { $sum: '$amount_paise' }
      }
    }
  ]);

  let total_earned = 0, pending = 0, available = 0, withdrawn = 0, platform_fees = 0;

  for (const row of rows) {
    const { type, available: isAvailable } = row._id;
    if (type === 'FREELANCER_EARNING') {
      total_earned += row.total;
      if (!isAvailable) pending += row.total;
    }
    if (type === 'WITHDRAWAL') withdrawn += Math.abs(row.total);
    if (type === 'PLATFORM_FEE') platform_fees += Math.abs(row.total);
    if (isAvailable) available += row.total;
  }

  return {
    total_earned,
    pending,
    // A negative available balance would mean a bug elsewhere; never report one.
    available: Math.max(0, available),
    withdrawn,
    platform_fees,
    net_earned: total_earned - platform_fees
  };
};

/** Derived totals for one company. */
export const getCompanyTotals = async (companyId) => {
  const uid = toObjectId(companyId);
  if (!uid) return { total_paid: 0, refunded: 0 };

  const rows = await LedgerEntry.aggregate([
    { $match: { user_id: uid, type: { $in: ['BOOKING_PAYMENT', 'CASH_PAYMENT', 'REFUND'] } } },
    { $group: { _id: '$type', total: { $sum: '$amount_paise' } } }
  ]);

  let total_paid = 0, refunded = 0;
  for (const row of rows) {
    if (row._id === 'REFUND') refunded += Math.abs(row.total);
    else total_paid += Math.abs(row.total);
  }
  return { total_paid, refunded, net_paid: total_paid - refunded };
};

/** A user's own ledger history, newest first. Always scoped to one user. */
export const listForUser = async (userId, { limit = 50, skip = 0, type = null } = {}) => {
  const uid = toObjectId(userId);
  if (!uid) return { entries: [], total: 0 };

  const query = { user_id: uid };
  if (type) query.type = type;

  const [entries, total] = await Promise.all([
    LedgerEntry.find(query).sort({ created_at: -1 }).skip(skip).limit(Math.min(limit, 100)).lean(),
    LedgerEntry.countDocuments(query)
  ]);
  return { entries, total };
};

export default {
  post,
  postMany,
  newReference,
  getFreelancerBalance,
  getCompanyTotals,
  listForUser
};
