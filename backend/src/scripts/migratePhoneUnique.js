/**
 * Adds the UNIQUE index on User.phone.
 *
 *   npm run migrate:phone-unique              -> report only, writes nothing
 *   npm run migrate:phone-unique -- --apply   -> builds the index
 *
 * WHY THIS SCRIPT EXISTS
 * ----------------------
 * `phone` was required but never uniquely indexed. Duplicates were only ever
 * prevented at the application layer, by the $or lookup in registerUser - so
 * any other write path (a seeder, a manual insert, a future admin tool, two
 * simultaneous signups racing the same number) could create them.
 *
 * Building a unique index over data that already contains duplicates fails
 * PART WAY THROUGH: MongoDB aborts on the first collision and leaves nothing
 * behind, but the error is a raw E11000 that says little about which records
 * are at fault. So this script always reports first, and refuses to attempt
 * the build unless the data is genuinely clean.
 *
 * SAFETY
 *   - Dry run is the default. --apply is required to write.
 *   - Idempotent: an existing equivalent index is detected and left alone.
 *   - Touches indexes only. No user document is read into memory beyond the
 *     phone values needed for the duplicate report, and none is modified.
 *   - Refuses to build while duplicates exist, and prints every offending
 *     group so they can be fixed by hand first.
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';

// The User model is deliberately NOT imported. Importing it would register the
// schema and set Mongoose building its declared indexes - including the very
// unique index this script exists to build deliberately - which would print a
// confusing failure above the report. Everything here works on the raw
// collection instead.

dotenv.config();

const APPLY = process.argv.includes('--apply');
const INDEX_NAME = 'phone_1';

/** Groups of accounts sharing a phone number, worst first. */
const findDuplicates = async () => {
  const collection = mongoose.connection.collection('users');
  return collection
    .aggregate([
      { $match: { phone: { $type: 'string', $ne: '' } } },
      { $group: { _id: '$phone', count: { $sum: 1 }, ids: { $push: '$_id' }, roles: { $push: '$role' } } },
      { $match: { count: { $gt: 1 } } },
      { $sort: { count: -1 } }
    ])
    .toArray();
};

/** Masks a number for console output - enough to identify, not to dial. */
const maskPhone = (value) => {
  const s = String(value);
  return s.length <= 4 ? s : `${s.slice(0, 2)}${'*'.repeat(Math.max(0, s.length - 4))}${s.slice(-2)}`;
};

const run = async () => {
  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI is not set. Nothing to do.');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);
  const collection = mongoose.connection.collection('users');

  console.log(`\nphone unique index — ${APPLY ? 'APPLY' : 'DRY RUN (nothing will be written)'}\n`);

  const total = await collection.countDocuments();
  const missing = await collection.countDocuments({
    $or: [{ phone: { $exists: false } }, { phone: null }, { phone: '' }]
  });

  console.log(`  accounts total          : ${total}`);
  console.log(`  accounts with no phone  : ${missing}`);

  // Is the index already there?
  const indexes = await collection.indexes();
  const existing = indexes.find((i) => i.name === INDEX_NAME || (i.key && i.key.phone === 1));
  if (existing) {
    console.log(`  existing index          : ${existing.name} (unique: ${existing.unique === true})`);
  } else {
    console.log('  existing index          : none');
  }

  const duplicates = await findDuplicates();
  console.log(`  duplicate phone values  : ${duplicates.length}`);

  if (duplicates.length > 0) {
    const affected = duplicates.reduce((sum, d) => sum + d.count, 0);
    console.log(`  accounts affected       : ${affected}\n`);
    console.log('  These must be resolved before a unique index can be built:\n');
    for (const d of duplicates) {
      console.log(`    ${maskPhone(d._id)}  used by ${d.count} accounts  [${d.roles.join(', ')}]`);
      for (const id of d.ids) console.log(`        _id: ${id}`);
    }
    console.log(
      '\n  Fix by giving each account its own number, then run this again.\n' +
        '  Nothing has been changed.\n'
    );
    await mongoose.disconnect();
    // Non-zero so a CI step or a deploy hook stops here rather than continuing.
    process.exit(duplicates.length > 0 && APPLY ? 1 : 0);
  }

  if (existing?.unique === true) {
    console.log('\n  Already unique — nothing to do.\n');
    await mongoose.disconnect();
    return;
  }

  if (!APPLY) {
    console.log(
      '\n  No duplicates. The index can be built safely.\n' +
        '  Re-run with --apply to build it:\n\n' +
        '      npm run migrate:phone-unique -- --apply\n'
    );
    await mongoose.disconnect();
    return;
  }

  // A non-unique phone index would block the unique one from being created
  // under the same name, so it is replaced rather than fought with.
  if (existing && existing.unique !== true) {
    console.log(`\n  Dropping the existing non-unique index "${existing.name}"…`);
    await collection.dropIndex(existing.name);
  }

  console.log('  Building the unique index on phone…');
  await collection.createIndex({ phone: 1 }, { unique: true, name: INDEX_NAME });

  const after = (await collection.indexes()).find((i) => i.name === INDEX_NAME);
  console.log(`  Done — ${after?.name} unique: ${after?.unique === true}\n`);

  await mongoose.disconnect();
};

run().catch(async (error) => {
  console.error('\nMigration failed:', error.message);
  if (error.code === 11000) {
    console.error('A duplicate slipped in between the check and the build. Re-run to see it.');
  }
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});

