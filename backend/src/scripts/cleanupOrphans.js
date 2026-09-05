/**
 * Removes rows whose owning user no longer exists.
 *
 *   npm run cleanup:orphans                 -> report only, writes nothing
 *   npm run cleanup:orphans -- --apply      -> deletes
 *
 * WHY THIS EXISTS
 * The E2E suites delete their throwaway accounts but, until now, left the rows
 * those accounts caused behind. The result was an admin activity view showing
 * over a thousand entries attributed to people who no longer exist. The suites
 * now clean up after themselves, so this is for the backlog already there -
 * and as a safety net if a user is ever removed by hand.
 *
 * `cleanup:activity` does NOT cover this. That script is age-based (180 days by
 * default) and only touches activity logs; this residue is hours old and spans
 * several collections, so retention would never reach it.
 *
 * THE SAFETY RULE
 * A row is deleted only when EVERY user it references is gone. A row that still
 * has one live owner is reported as a "partial" and left alone - deleting it
 * would take data away from an account that still exists. A row that references
 * no user at all cannot be shown to be orphaned, so it is skipped too.
 *
 * FINANCIAL RECORDS ARE NEVER TOUCHED
 * ledgerentries, payments and withdrawals are excluded by design. The ledger is
 * append-only and money has to remain auditable even when the person it related
 * to is gone. If orphans are found there they are reported, never deleted.
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const APPLY = process.argv.includes('--apply');

/**
 * Collections swept, and the fields on each that point at a User.
 *
 * `userTypedOnly` marks a field that references several kinds of entity; it is
 * only treated as a user reference when the row says so.
 */
const SWEEP = [
  { name: 'activitylogs', fields: ['actor.user_id'], userTypedOnly: { field: 'target.id', when: (r) => r.target?.type === 'user' } },
  { name: 'emaillogs', fields: ['user_id'] },
  { name: 'subscriptions', fields: ['user_id'] },
  { name: 'notifications', fields: ['recipient_id', 'sender_id'] },
  { name: 'savedprofessionals', fields: ['company_id', 'freelancer_id'] },
  { name: 'galleryitems', fields: ['user_id'] },
  { name: 'conversations', fields: ['company_id', 'freelancer_id'] },
  { name: 'messages', fields: ['sender_id', 'receiver_id'] },
  { name: 'bookingrequests', fields: ['company_id', 'freelancer_id'] },
  { name: 'applications', fields: ['company_id', 'freelancer_id'] },
  { name: 'requirements', fields: ['company_id'] },
  { name: 'availabilityblocks', fields: ['user_id'] },
  { name: 'availabilities', fields: ['freelancer_id'] },
  { name: 'payoutaccounts', fields: ['user_id'] }
];

/** Reported on, never modified. Money must outlive the account it related to. */
const PROTECTED = [
  { name: 'ledgerentries', fields: ['user_id', 'company_id', 'freelancer_id'] },
  { name: 'payments', fields: ['company_id', 'freelancer_id'] },
  { name: 'withdrawals', fields: ['user_id'] }
];

/** Reads a possibly-dotted path off a document. */
const at = (doc, path) => path.split('.').reduce((o, k) => (o == null ? o : o[k]), doc);

/**
 * Classifies one row against the set of live user ids.
 * @returns {'orphan'|'partial'|'live'|'unattributed'}
 */
const classify = (row, spec, liveIds) => {
  const refs = [];
  for (const f of spec.fields) {
    const v = at(row, f);
    if (v) refs.push(String(v));
  }
  if (spec.userTypedOnly && spec.userTypedOnly.when(row)) {
    const v = at(row, spec.userTypedOnly.field);
    if (v) refs.push(String(v));
  }

  if (refs.length === 0) return 'unattributed';
  const missing = refs.filter((id) => !liveIds.has(id));
  if (missing.length === 0) return 'live';
  return missing.length === refs.length ? 'orphan' : 'partial';
};

const run = async () => {
  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI is not set. Nothing to do.');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection;

  console.log(`\norphan sweep — ${APPLY ? 'APPLY' : 'DRY RUN (nothing will be written)'}\n`);

  const users = await db.collection('users').find({}).project({ _id: 1 }).toArray();
  const liveIds = new Set(users.map((u) => String(u._id)));
  console.log(`  live user accounts: ${liveIds.size}\n`);

  const pad = (s, n) => String(s).padEnd(n);
  const num = (s, n) => String(s).padStart(n);

  console.log(`  ${pad('collection', 20)} ${num('total', 7)} ${num('orphan', 7)} ${num('partial', 8)} ${num('unattrib', 9)}`);
  console.log(`  ${'-'.repeat(20)} ${'-'.repeat(7)} ${'-'.repeat(7)} ${'-'.repeat(8)} ${'-'.repeat(9)}`);

  let totalOrphans = 0;
  const plan = [];

  for (const spec of SWEEP) {
    let rows;
    try {
      rows = await db.collection(spec.name).find({}).toArray();
    } catch {
      console.log(`  ${pad(spec.name, 20)} ${num('-', 7)}  (collection not present)`);
      continue;
    }

    const orphans = [];
    let partial = 0, unattributed = 0;
    for (const row of rows) {
      const verdict = classify(row, spec, liveIds);
      if (verdict === 'orphan') orphans.push(row._id);
      else if (verdict === 'partial') partial++;
      else if (verdict === 'unattributed') unattributed++;
    }

    console.log(`  ${pad(spec.name, 20)} ${num(rows.length, 7)} ${num(orphans.length, 7)} ${num(partial, 8)} ${num(unattributed, 9)}`);
    totalOrphans += orphans.length;
    if (orphans.length) plan.push({ name: spec.name, ids: orphans });
  }

  console.log(`\n  total deletable orphans: ${totalOrphans}`);
  console.log('  "partial"    = at least one owner still exists — LEFT ALONE');
  console.log('  "unattrib"   = references no user at all — cannot be shown orphaned, LEFT ALONE');

  /* ---- protected collections: reported, never touched ---- */
  console.log('\n  PROTECTED (financial records — reported only, never deleted):');
  for (const spec of PROTECTED) {
    let rows;
    try {
      rows = await db.collection(spec.name).find({}).toArray();
    } catch {
      console.log(`    ${pad(spec.name, 18)} (collection not present)`);
      continue;
    }
    const orphans = rows.filter((r) => classify(r, spec, liveIds) === 'orphan').length;
    console.log(`    ${pad(spec.name, 18)} total=${num(rows.length, 6)}  orphaned=${num(orphans, 6)}  -> kept`);
  }

  if (!APPLY) {
    console.log('\n  Dry run — nothing was deleted.');
    console.log('  Re-run with --apply to remove the orphans listed above:\n');
    console.log('      npm run cleanup:orphans -- --apply\n');
    await mongoose.disconnect();
    return;
  }

  if (totalOrphans === 0) {
    console.log('\n  Nothing to delete.\n');
    await mongoose.disconnect();
    return;
  }

  console.log('\n  Deleting…');
  let deleted = 0;
  for (const { name, ids } of plan) {
    const res = await db.collection(name).deleteMany({ _id: { $in: ids } });
    deleted += res.deletedCount;
    console.log(`    ${pad(name, 20)} removed ${res.deletedCount}`);
  }
  console.log(`\n  Done — ${deleted} orphaned row(s) removed. No financial record was touched.\n`);

  await mongoose.disconnect();
};

run().catch(async (error) => {
  console.error('\ncleanup:orphans failed:', error.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
