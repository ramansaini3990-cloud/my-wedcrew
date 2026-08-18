/**
 * Seeds the default FREE / PRO / PREMIUM plans.
 *
 * Idempotent: existing plans are left untouched.
 *   npm run seed:plans
 */
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import connectDB from '../config/database.js';
import Plan from '../models/Plan.js';
import { DEFAULT_PLANS } from '../config/defaultPlans.js';

dotenv.config();

const run = async () => {
  await connectDB();

  for (const definition of DEFAULT_PLANS) {
    const existing = await Plan.findOne({ name: definition.name });
    if (existing) {
      console.log(`  = ${definition.name.padEnd(8)} already exists (skipped)`);
      continue;
    }
    const plan = await Plan.create(definition);
    console.log(`  + ${plan.name.padEnd(8)} created  price=${plan.price}  features=[${plan.features.join(', ')}]`);
  }

  const all = await Plan.find().sort({ sort_order: 1, price: 1 });
  console.log(`\nPlans in database (${all.length}):`);
  for (const p of all) {
    console.log(`  ${p.name.padEnd(10)} ₹${String(p.price).padEnd(6)} chat=${p.features.includes('chat')}  active=${p.isActive}`);
  }

  await mongoose.connection.close();
  process.exit(0);
};

run().catch((err) => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
