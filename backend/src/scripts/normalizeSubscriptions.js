/**
 * One-off data hygiene for subscriptions created before the "one effective
 * subscription per user" rule existed.
 *
 *   npm run migrate:subscriptions -- --dry     (report only, default)
 *   npm run migrate:subscriptions -- --apply   (write changes)
 *
 * What it does:
 *   1. Flips past-due `active` subscriptions to `expired`.
 *   2. Where a user holds several non-terminal subscriptions, keeps the best
 *      one (active + latest expiry) and marks the rest `cancelled`.
 *
 * Nothing is deleted; only `status` / `cancelled_at` are updated.
 */
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import connectDB from '../config/database.js';
import Subscription from '../models/Subscription.js';

dotenv.config();

const APPLY = process.argv.includes('--apply');
const TERMINAL = ['expired', 'cancelled'];

const run = async () => {
  await connectDB();
  const now = new Date();

  console.log(APPLY ? '\nMODE: APPLY (changes will be written)\n' : '\nMODE: DRY RUN (no changes written) - pass --apply to write\n');

  // 1. Past-due actives
  const pastDue = await Subscription.find({ status: 'active', end_date: { $lt: now } });
  console.log(`Past-due active subscriptions: ${pastDue.length}`);
  for (const s of pastDue) {
    console.log(`  expire  ${s._id}  user=${s.user_id}  ${s.plan_name}  ended ${s.end_date.toISOString().slice(0, 10)}`);
  }
  if (APPLY && pastDue.length) {
    await Subscription.updateMany(
      { status: 'active', end_date: { $lt: now } },
      { $set: { status: 'expired' } }
    );
  }

  // 2. Duplicates per user
  const grouped = await Subscription.aggregate([
    { $match: { status: { $nin: TERMINAL } } },
    { $group: { _id: '$user_id', count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } }
  ]);

  console.log(`\nUsers with multiple live subscriptions: ${grouped.length}`);

  for (const group of grouped) {
    const subs = await Subscription.find({
      user_id: group._id,
      status: { $nin: TERMINAL }
    }).sort({ end_date: -1, created_at: -1 });

    const keep = subs.find((s) => s.status === 'active' && s.end_date >= now) || subs[0];
    const drop = subs.filter((s) => !s._id.equals(keep._id));

    console.log(`  user=${group._id}`);
    console.log(`    keep    ${keep._id}  ${keep.plan_name}  ${keep.status}  ends ${keep.end_date.toISOString().slice(0, 10)}`);
    for (const s of drop) {
      console.log(`    cancel  ${s._id}  ${s.plan_name}  ${s.status}  ends ${s.end_date.toISOString().slice(0, 10)}`);
    }

    if (APPLY && drop.length) {
      await Subscription.updateMany(
        { _id: { $in: drop.map((s) => s._id) } },
        { $set: { status: 'cancelled', cancelled_at: now } }
      );
    }
  }

  // 3. Backfill source for admin-created rows missing it
  const missingSource = await Subscription.countDocuments({ source: { $in: [null, 'SYSTEM'] } });
  console.log(`\nSubscriptions with source SYSTEM/null: ${missingSource}`);
  if (APPLY && missingSource) {
    await Subscription.updateMany({ source: { $in: [null, 'SYSTEM'] } }, { $set: { source: 'ADMIN' } });
    console.log('  -> set to ADMIN');
  }

  console.log(APPLY ? '\nDone. Changes written.\n' : '\nDone. No changes written (dry run).\n');
  await mongoose.connection.close();
  process.exit(0);
};

run().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
