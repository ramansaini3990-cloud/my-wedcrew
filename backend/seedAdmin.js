/**
 * Idempotent admin seeder.
 *
 *   npm run seed:admin
 *
 * Reads credentials from the environment (backend/.env) - nothing is hardcoded:
 *
 *   ADMIN_EMAIL       (required)
 *   ADMIN_PASSWORD    (required, min 8 characters)
 *   ADMIN_FIRST_NAME  (optional, default "Site")
 *   ADMIN_LAST_NAME   (optional, default "Administrator")
 *   ADMIN_MOBILE      (optional, default "0000000000")
 *
 * Behaviour:
 *   - If an admin with ADMIN_EMAIL already exists, nothing is written and the
 *     script exits 0. Safe to run on every deploy.
 *   - Otherwise the admin is created with the same bcryptjs hashing the
 *     registration/login flow uses, so the account logs in normally.
 *   - The password is never written to stdout.
 *
 * Optional flag:
 *   node seedAdmin.js --reset-password
 *     Re-hashes ADMIN_PASSWORD for an existing admin (recovery only).
 */
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import connectDB from './src/config/database.js';
import User from './src/models/User.js';
import { validatePassword, PASSWORD_POLICY_TEXT } from './src/services/passwordPolicy.js';

dotenv.config();

const RESET_PASSWORD = process.argv.includes('--reset-password');

/** Escapes a string so it can be used inside a RegExp literally. */
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * dotenv treats an unquoted `#` as the start of an inline comment, so
 * `ADMIN_PASSWORD=secret#123` silently loads as `secret`. Hashing that
 * truncated value produces an admin that can never log in with the password
 * written in .env.
 *
 * This detects the exact truncation case and refuses to seed, rather than
 * writing a hash the operator cannot reproduce. The value is never printed.
 *
 * @returns {string|null} an error message, or null when the value is safe
 */
const detectTruncatedPassword = () => {
  const envPath = path.resolve(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) return null; // credentials came from the real environment

  let rawLine;
  try {
    rawLine = fs
      .readFileSync(envPath, 'utf8')
      .split(/\r?\n/)
      .find((line) => /^\s*ADMIN_PASSWORD\s*=/.test(line));
  } catch {
    return null; // unreadable .env is not this check's problem
  }
  if (!rawLine) return null;

  const rawValue = rawLine.slice(rawLine.indexOf('=') + 1).trim();
  if (!rawValue || rawValue.includes('#') === false) return null;

  // Already quoted -> dotenv keeps the '#' verbatim.
  if (/^(["'`]).*\1$/.test(rawValue)) return null;

  // Only flag when the loaded value is exactly the text before the first '#',
  // which is dotenv's truncation signature. An inline/CI-provided override that
  // differs from the file is left alone.
  const truncated = rawValue.slice(0, rawValue.indexOf('#'));
  if (process.env.ADMIN_PASSWORD !== truncated) return null;

  return [
    'ADMIN_PASSWORD in .env contains "#" and is not quoted.',
    '  dotenv reads everything after an unquoted "#" as a comment, so only the',
    '  characters before it were loaded. Seeding now would hash the wrong password.',
    '',
    '  Fix: wrap the value in single quotes in backend/.env, for example',
    "    ADMIN_PASSWORD='your#password'",
    '',
    '  Then re-run:  npm run seed:admin -- --reset-password'
  ].join('\n');
};

const readConfig = () => {
  const email = (process.env.ADMIN_EMAIL || '').trim();
  const password = process.env.ADMIN_PASSWORD || '';

  const errors = [];
  if (!email) errors.push('ADMIN_EMAIL is required.');
  if (!password) errors.push('ADMIN_PASSWORD is required.');
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.push('ADMIN_EMAIL is not a valid email address.');
  }
  if (password) {
    // Same policy the registration API enforces.
    const policy = validatePassword(password);
    if (!policy.ok) errors.push(PASSWORD_POLICY_TEXT);
  }

  // The User model stores a single `name`; first/last are composed into it so
  // the schema does not need to change.
  const firstName = (process.env.ADMIN_FIRST_NAME || '').trim();
  const lastName = (process.env.ADMIN_LAST_NAME || '').trim();
  const composedName = [firstName, lastName].filter(Boolean).join(' ');

  const name = composedName || (process.env.ADMIN_NAME || '').trim() || 'Site Administrator';
  const phone =
    (process.env.ADMIN_MOBILE || '').trim() ||
    (process.env.ADMIN_PHONE || '').trim() ||
    '0000000000';

  return { email, password, name, phone, errors };
};

const run = async () => {
  const truncationError = detectTruncatedPassword();
  if (truncationError) {
    console.error('\nAdmin seeder aborted:');
    console.error(`  - ${truncationError}\n`);
    process.exit(1);
  }

  const { email, password, name, phone, errors } = readConfig();

  if (errors.length) {
    console.error('\nAdmin seeder aborted:');
    errors.forEach((e) => console.error(`  - ${e}`));
    console.error('\nSet the values in backend/.env, for example:');
    console.error('  ADMIN_EMAIL=admin@yourdomain.com');
    console.error('  ADMIN_PASSWORD=<a strong password>');
    console.error('  ADMIN_FIRST_NAME=Site');
    console.error('  ADMIN_LAST_NAME=Administrator');
    console.error('  ADMIN_MOBILE=9876543210\n');
    process.exit(1);
  }

  await connectDB();

  try {
    // Case-insensitive lookup so a differently-cased email cannot slip a second
    // admin past the unique index.
    const existing = await User.findOne({
      email: new RegExp(`^${escapeRegex(email)}$`, 'i')
    });

    if (existing && existing.role === 'admin') {
      if (RESET_PASSWORD) {
        const salt = await bcrypt.genSalt(10);
        existing.password = await bcrypt.hash(password, salt);
        await existing.save();
        console.log(`Admin already exists - password reset for ${existing.email}`);
      } else {
        console.log(`Admin already exists: ${existing.email} (no changes made)`);
      }
      console.log(`  name : ${existing.name}`);
      console.log(`  role : ${existing.role}`);
      await mongoose.connection.close();
      process.exit(0);
    }

    if (existing) {
      // The email is taken by a company/freelancer. Promoting it silently would
      // change an existing person's account, so refuse and let a human decide.
      console.error(`\nAdmin seeder aborted: ${existing.email} already exists with role "${existing.role}".`);
      console.error('Use a different ADMIN_EMAIL, or change that account\'s role deliberately.\n');
      await mongoose.connection.close();
      process.exit(1);
    }

    // `phone` is not uniquely indexed, but registration rejects duplicates, so
    // warn rather than silently creating a number that blocks a future signup.
    const phoneOwner = await User.findOne({ phone });
    if (phoneOwner) {
      console.warn(`Warning: mobile ${phone} is already used by another account.`);
      console.warn('  Set ADMIN_MOBILE to a unique number to avoid registration conflicts.');
    }

    // Same hashing as authController.registerUser.
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const admin = await User.create({
      role: 'admin',
      name,
      phone,
      email,
      password: hashedPassword
    });

    console.log(`Admin created: ${admin.email}`);
    console.log(`  name : ${admin.name}`);
    console.log(`  role : ${admin.role}`);
    console.log('\nSign in at /login with ADMIN_EMAIL and ADMIN_PASSWORD.');

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    // Never echo credentials in error output.
    console.error(`\nAdmin seeder failed: ${error.message}\n`);
    try { await mongoose.connection.close(); } catch { /* ignore */ }
    process.exit(1);
  }
};

run();
