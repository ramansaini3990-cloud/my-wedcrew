/**
 * Backfills `email_verified` on accounts created before email verification
 * existed.
 *
 *   npm run migrate:email-verified            report only (default)
 *   npm run migrate:email-verified -- --apply write the change
 *
 * WHY true AND NOT false:
 * Every one of these accounts could already sign in. Defaulting them to false
 * would lock out the entire existing user base behind a verification email
 * they never asked for — including the admin. Verification applies to accounts
 * created from now on.
 *
 * SAFETY:
 *   - Dry run by default; --apply is required to write anything.
 *   - Idempotent: the filter only matches rows that still need the change, so
 *     re-running writes nothing.
 *   - Touches ONLY `email_verified`. No other field is read, written or
 *     removed, and no document is ever deleted.
 */
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import connectDB from '../config/database.js';
import User from '../models/User.js';

dotenv.config();

const APPLY = process.argv.includes('--apply');

// Missing, null, or explicitly false-but-never-set. `$exists: false` covers
// documents written before the field existed; `null` covers any that were
// written with an explicit null.
const NEEDS_BACKFILL = { $or: [{ email_verified: { $exists: false } }, { email_verified: null }] };

const run = async () => {
  await connectDB();

  console.log(
    APPLY
      ? '\nMODE: APPLY (changes will be written)\n'
      : '\nMODE: DRY RUN (no changes written) - pass --apply to write\n'
  );

  const total = await User.countDocuments({});
  const pending = await User.countDocuments(NEEDS_BACKFILL);
  const alreadyTrue = await User.countDocuments({ email_verified: true });
  const explicitlyFalse = await User.countDocuments({ email_verified: false });

  console.log(`Total users                      : ${total}`);
  console.log(`Already verified (true)          : ${alreadyTrue}`);
  console.log(`Explicitly unverified (false)    : ${explicitlyFalse}  <- left untouched`);
  console.log(`Missing/null -> will become true : ${pending}`);

  if (pending > 0) {
    const sample = await User.find(NEEDS_BACKFILL).select('email role created_at').limit(10).lean();
    console.log('\nSample of affected accounts:');
    for (const u of sample) {
      // Roles and dates only - no address is printed in full.
      const masked = String(u.email || '').replace(/^(.).*(@.*)$/, '$1***$2');
      console.log(`  ${String(u.role).padEnd(11)} ${masked}`);
    }
    if (pending > sample.length) console.log(`  ... and ${pending - sample.length} more`);
  }

  if (APPLY && pending > 0) {
    const result = await User.updateMany(NEEDS_BACKFILL, { $set: { email_verified: true } });
    console.log(`\nApplied: ${result.modifiedCount} account(s) marked verified.`);
  } else if (!APPLY && pending > 0) {
    console.log('\nNothing was written. Re-run with --apply to perform the backfill.');
  } else {
    console.log('\nNothing to do - every account already has an email_verified value.');
  }

  await mongoose.connection.close();
  process.exit(0);
};

run().catch(async (error) => {
  console.error('Migration failed:', error.message);
  try { await mongoose.connection.close(); } catch { /* already closed */ }
  process.exit(1);
});
