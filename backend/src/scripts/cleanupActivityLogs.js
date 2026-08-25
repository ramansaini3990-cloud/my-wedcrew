/**
 * Retention for the admin activity log.
 *
 *   npm run cleanup:activity                      (dry run, default 180 days)
 *   npm run cleanup:activity -- --days=90 --apply (writes)
 *
 * OPT-IN ONLY: nothing runs automatically and nothing is scheduled. It touches
 * the `activitylogs` collection exclusively - no business record (user,
 * subscription, booking, requirement, message, notification) is ever affected.
 */
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import connectDB from '../config/database.js';
import ActivityLog from '../models/ActivityLog.js';

dotenv.config();

const APPLY = process.argv.includes('--apply');
const daysArg = process.argv.find((a) => a.startsWith('--days='));
const DAYS = Math.max(parseInt(daysArg ? daysArg.split('=')[1] : '180', 10) || 180, 1);

const run = async () => {
  await connectDB();
  const cutoff = new Date(Date.now() - DAYS * 86400000);

  console.log(APPLY ? '\nMODE: APPLY' : '\nMODE: DRY RUN (pass --apply to delete)');
  console.log(`Retention: ${DAYS} days  |  cutoff: ${cutoff.toISOString().slice(0, 10)}\n`);

  const total = await ActivityLog.estimatedDocumentCount();
  const expired = await ActivityLog.countDocuments({ created_at: { $lt: cutoff } });

  console.log(`  activity entries total   : ${total}`);
  console.log(`  older than the cutoff    : ${expired}`);
  console.log(`  would remain             : ${total - expired}`);

  if (APPLY && expired > 0) {
    const res = await ActivityLog.deleteMany({ created_at: { $lt: cutoff } });
    console.log(`\n  deleted ${res.deletedCount} activity entries (business data untouched).`);
  } else if (!APPLY) {
    console.log('\n  Dry run - nothing deleted.');
  } else {
    console.log('\n  Nothing to delete.');
  }

  await mongoose.connection.close();
  process.exit(0);
};

run().catch((err) => {
  console.error('cleanup:activity failed:', err.message);
  process.exit(1);
});
