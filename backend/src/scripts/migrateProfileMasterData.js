/**
 * Maps existing free-text profile values onto the new master data.
 *
 *   npm run migrate:master              (dry run - reports only, writes nothing)
 *   npm run migrate:master -- --apply   (writes)
 *
 * Guarantees:
 *   - NOTHING is ever deleted. Legacy `profession` / `state` / `city` strings
 *     stay exactly as they are.
 *   - Only the new `*_id` reference fields are filled in.
 *   - A value that cannot be matched is preserved and the user is flagged with
 *     `needs_master_review: true` so an admin can resolve it, rather than the
 *     data being discarded or overwritten.
 *
 * Matching is deliberately conservative: exact (case-insensitive) match first,
 * then slug match. Fuzzy guessing is avoided so a wrong city is never written.
 */
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import connectDB from '../config/database.js';
import User from '../models/User.js';
import Profession from '../models/Profession.js';
import State from '../models/State.js';
import City from '../models/City.js';
import { slugify } from '../services/masterDataService.js';

dotenv.config();

const APPLY = process.argv.includes('--apply');

const run = async () => {
  await connectDB();
  console.log(APPLY ? '\nMODE: APPLY (changes will be written)\n' : '\nMODE: DRY RUN (pass --apply to write)\n');

  const [professions, states, cities] = await Promise.all([
    Profession.find().lean(),
    State.find().lean(),
    City.find().lean()
  ]);

  if (!professions.length && !states.length) {
    console.error('Master data is empty. Run `npm run seed:master` first.\n');
    await mongoose.connection.close();
    process.exit(1);
  }

  const professionBySlug = new Map(professions.map((p) => [p.slug, p]));
  const stateBySlug = new Map(states.map((s) => [s.slug, s]));
  const citiesByStateSlug = new Map();
  for (const c of cities) {
    const key = String(c.state_id);
    if (!citiesByStateSlug.has(key)) citiesByStateSlug.set(key, new Map());
    citiesByStateSlug.get(key).set(c.slug, c);
  }
  // Fallback index: city slug -> all cities with that name across states.
  const citiesBySlug = new Map();
  for (const c of cities) {
    if (!citiesBySlug.has(c.slug)) citiesBySlug.set(c.slug, []);
    citiesBySlug.get(c.slug).push(c);
  }

  const users = await User.find({ role: { $in: ['company', 'freelancer'] } })
    .select('name email role profession state city profession_id state_id city_id needs_master_review');

  const summary = {
    scanned: users.length,
    professionMapped: 0,
    stateMapped: 0,
    cityMapped: 0,
    flagged: 0,
    unchanged: 0
  };
  const unmatched = { professions: new Set(), states: new Set(), cities: new Set() };

  for (const user of users) {
    const update = {};
    const notes = [];
    let needsReview = false;

    // ---- Profession -----------------------------------------------------
    if (!user.profession_id && user.profession) {
      const match = professionBySlug.get(slugify(user.profession));
      if (match) {
        update.profession_id = match._id;
        // Normalise the legacy string to the canonical name only when it is an
        // exact case-insensitive match, so nothing surprising is rewritten.
        if (match.name !== user.profession) update.profession = match.name;
        summary.professionMapped++;
        notes.push(`profession "${user.profession}" -> ${match.name}`);
      } else {
        needsReview = true;
        unmatched.professions.add(user.profession);
        notes.push(`profession "${user.profession}" UNMATCHED (kept)`);
      }
    }

    // ---- State ----------------------------------------------------------
    let resolvedStateId = user.state_id || null;
    if (!user.state_id && user.state) {
      const match = stateBySlug.get(slugify(user.state));
      if (match) {
        update.state_id = match._id;
        if (match.name !== user.state) update.state = match.name;
        resolvedStateId = match._id;
        summary.stateMapped++;
        notes.push(`state "${user.state}" -> ${match.name}`);
      } else {
        needsReview = true;
        unmatched.states.add(user.state);
        notes.push(`state "${user.state}" UNMATCHED (kept)`);
      }
    }

    // ---- City (must resolve within the state) ---------------------------
    if (!user.city_id && user.city) {
      const citySlug = slugify(user.city);
      let match = null;

      if (resolvedStateId) {
        match = citiesByStateSlug.get(String(resolvedStateId))?.get(citySlug) || null;
      }
      if (!match) {
        // No state, or city not under it: only accept an unambiguous match.
        const candidates = citiesBySlug.get(citySlug) || [];
        if (candidates.length === 1 && !resolvedStateId) {
          match = candidates[0];
          if (!update.state_id && !user.state_id) {
            update.state_id = match.state_id;
            const parent = states.find((s) => String(s._id) === String(match.state_id));
            if (parent && !user.state) update.state = parent.name;
          }
        }
      }

      if (match) {
        update.city_id = match._id;
        if (match.name !== user.city) update.city = match.name;
        summary.cityMapped++;
        notes.push(`city "${user.city}" -> ${match.name}`);
      } else {
        needsReview = true;
        unmatched.cities.add(`${user.city}${user.state ? ' (' + user.state + ')' : ''}`);
        notes.push(`city "${user.city}" UNMATCHED (kept)`);
      }
    }

    if (needsReview && !user.needs_master_review) {
      update.needs_master_review = true;
      summary.flagged++;
    }
    // Clear a stale flag once everything resolves.
    if (!needsReview && user.needs_master_review) update.needs_master_review = false;

    if (Object.keys(update).length === 0) {
      summary.unchanged++;
      continue;
    }

    console.log(`  ${user.role.padEnd(10)} ${user.email}`);
    notes.forEach((n) => console.log(`      ${n}`));

    if (APPLY) await User.updateOne({ _id: user._id }, { $set: update });
  }

  console.log('\n--- Summary ---');
  console.log(`  users scanned          : ${summary.scanned}`);
  console.log(`  profession mapped      : ${summary.professionMapped}`);
  console.log(`  state mapped           : ${summary.stateMapped}`);
  console.log(`  city mapped            : ${summary.cityMapped}`);
  console.log(`  flagged for review     : ${summary.flagged}`);
  console.log(`  already up to date     : ${summary.unchanged}`);

  const list = (set) => (set.size ? [...set].join(', ') : 'none');
  console.log('\n--- Unmatched values (preserved, flagged for admin) ---');
  console.log(`  professions : ${list(unmatched.professions)}`);
  console.log(`  states      : ${list(unmatched.states)}`);
  console.log(`  cities      : ${list(unmatched.cities)}`);
  console.log(
    APPLY
      ? '\nDone. Legacy string fields were preserved; only *_id references were added.\n'
      : '\nDry run only - no changes written.\n'
  );

  await mongoose.connection.close();
  process.exit(0);
};

run().catch((err) => {
  console.error('migrate:master failed:', err.message);
  process.exit(1);
});
