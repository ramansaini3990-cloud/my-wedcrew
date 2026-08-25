/**
 * Seeds professions, states and cities.
 *
 *   npm run seed:master
 *
 * Fully idempotent and non-destructive: existing records are matched
 * case-insensitively and left completely untouched (an admin may have renamed,
 * reordered or deactivated them). Only genuinely missing records are inserted.
 */
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import connectDB from '../config/database.js';
import Profession from '../models/Profession.js';
import State from '../models/State.js';
import City from '../models/City.js';
import { DEFAULT_PROFESSIONS, DEFAULT_STATES } from '../config/masterData.js';
import { slugify } from '../services/masterDataService.js';

dotenv.config();

const run = async () => {
  await connectDB();

  const created = { professions: 0, states: 0, cities: 0 };
  const skipped = { professions: 0, states: 0, cities: 0 };

  // ---- Professions ------------------------------------------------------
  for (const definition of DEFAULT_PROFESSIONS) {
    const slug = slugify(definition.name);
    const existing = await Profession.findOne({ slug });
    if (existing) { skipped.professions++; continue; }
    await Profession.create({ ...definition, slug });
    created.professions++;
  }

  // ---- States + their cities -------------------------------------------
  let order = 0;
  for (const definition of DEFAULT_STATES) {
    order += 1;
    const stateSlug = slugify(definition.name);

    let state = await State.findOne({ slug: stateSlug });
    if (state) {
      skipped.states++;
    } else {
      state = await State.create({
        name: definition.name,
        code: definition.code,
        slug: stateSlug,
        sort_order: order
      });
      created.states++;
    }

    let cityOrder = 0;
    for (const cityName of definition.cities || []) {
      cityOrder += 1;
      const citySlug = slugify(cityName);
      const existingCity = await City.findOne({ state_id: state._id, slug: citySlug });
      if (existingCity) { skipped.cities++; continue; }
      await City.create({
        name: cityName,
        slug: citySlug,
        state_id: state._id,
        sort_order: cityOrder
      });
      created.cities++;
    }
  }

  const totals = {
    professions: await Profession.countDocuments(),
    states: await State.countDocuments(),
    cities: await City.countDocuments()
  };

  console.log('\nSeed complete (nothing existing was modified).');
  console.log(`  professions  created ${created.professions}  already present ${skipped.professions}  total ${totals.professions}`);
  console.log(`  states       created ${created.states}  already present ${skipped.states}  total ${totals.states}`);
  console.log(`  cities       created ${created.cities}  already present ${skipped.cities}  total ${totals.cities}\n`);

  await mongoose.connection.close();
  process.exit(0);
};

run().catch((err) => {
  console.error('seed:master failed:', err.message);
  process.exit(1);
});
