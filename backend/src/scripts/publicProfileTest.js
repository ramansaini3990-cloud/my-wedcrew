/**
 * Verifies the PUBLIC surface of the professionals and requirements APIs.
 *
 *   E2E_ADMIN_EMAIL=... E2E_ADMIN_PASSWORD=... npm run test:public
 *
 * The focus is privacy: a caller with no token (and a caller with a *different*
 * user's token) must never receive email, phone, password, manual address or
 * GPS coordinates - regardless of what the database holds.
 */
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import connectDB from '../config/database.js';

dotenv.config();

const API = process.env.API_URL || 'http://localhost:5000';
const STAMP = Date.now();
const TAG = '@e2e.local';

let pass = 0, fail = 0;
const failures = [];
const check = (name, ok, detail = '') => {
  if (ok) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; failures.push(name + (detail ? ' :: ' + detail : '')); console.log(`  FAIL  ${name}${detail ? '  -> ' + detail : ''}`); }
};
const section = (t) => console.log(`\n=== ${t} ===`);

const request = async (method, path, { token, body } = {}) => {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  let data = null; let raw = '';
  try { raw = await res.text(); data = JSON.parse(raw); } catch { /* non-JSON */ }
  return { status: res.status, data, raw };
};

let phoneSeq = 0;
const register = async (role, label, extra = {}) => {
  phoneSeq += 1;
  const email = `pp.${label}.${STAMP}${TAG}`;
  const password = 'E2ePassw0rd!';
  const phone = `9${String(STAMP).slice(-8)}${phoneSeq}`.slice(0, 10);
  const r = await request('POST', '/api/auth/register', {
    body: { role, name: `PP ${label}`, phone, email, password, ...extra }
  });
  if (r.status !== 201) throw new Error(`register ${label}: ${JSON.stringify(r.data)}`);
  const l = await request('POST', '/api/auth/login', { body: { email, password } });
  return { email, password, phone, token: l.data.token, id: l.data.user.id, role };
};

const iso = (d) => { const x = new Date(); x.setDate(x.getDate() + d); return x.toISOString().slice(0, 10); };

const PRIVATE_KEYS = ['email', 'phone', 'password', 'manual_location', 'needs_master_review', 'role', '__v'];

const run = async () => {
  const adminEmail = process.env.E2E_ADMIN_EMAIL;
  const adminPassword = process.env.E2E_ADMIN_PASSWORD;
  if (!adminEmail || !adminPassword) { console.error('Set E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD'); process.exit(1); }
  if ((await request('GET', '/api/health')).status !== 200) { console.error(`Backend not reachable at ${API}`); process.exit(1); }

  const al = await request('POST', '/api/auth/login', { body: { email: adminEmail, password: adminPassword } });
  if (al.status !== 200 || al.data.user.role !== 'admin') { console.error('Admin login failed'); process.exit(1); }
  const admin = { token: al.data.token };
  console.log(`Backend ${API} | admin ${adminEmail}`);

  await connectDB();
  let crashed = null;

  try {
    section('Setup: a professional with FULL private data populated');

    const freelancer = await register('freelancer', 'freelancer');
    const company = await register('company', 'company');
    const outsider = await register('freelancer', 'outsider');

    const states = (await request('GET', '/api/master/states')).data.data;
    const rajasthan = states.find((s) => s.name === 'Rajasthan');
    const rjCities = (await request('GET', `/api/master/cities?state_id=${rajasthan.id}`)).data.data;
    const jaipur = rjCities.find((c) => c.name === 'Jaipur');
    const udaipur = rjCities.find((c) => c.name === 'Udaipur');
    const professions = (await request('GET', '/api/master/professions')).data.data;
    const droneP = professions.find((p) => p.name === 'Drone Pilot');

    // Deliberately store the most sensitive values we can.
    const SECRET_ADDRESS = 'Flat 4B Secret Lane, Nathdwara';
    const saved = await request('PUT', '/api/profile/me', {
      token: freelancer.token,
      body: {
        profession_id: droneP.id,
        state_id: rajasthan.id,
        city_id: udaipur.id,
        bio: 'Certified aerial operator.',
        experience_years: 6,
        equipment: ['Mavic 3'],
        manual_location: {
          address: SECRET_ADDRESS,
          landmark: 'Behind the temple',
          latitude: 24.9299,
          longitude: 73.8207,
          shared_from_device: true
        }
      }
    });
    check('Profile saved with private address + coordinates', saved.status === 200);
    check('Owner CAN see their own private address', saved.data?.data?.manual_location?.address === SECRET_ADDRESS);
    check('Owner CAN see their own coordinates', saved.data?.data?.manual_location?.latitude === 24.9299);

    await request('POST', '/api/availability/blocks', {
      token: freelancer.token,
      body: { start_date: iso(0), end_date: iso(3), status: 'available', state_id: rajasthan.id, city_id: udaipur.id }
    });
    await request('POST', '/api/availability/blocks', {
      token: freelancer.token,
      body: { start_date: iso(10), end_date: iso(14), status: 'available', state_id: rajasthan.id, city_id: jaipur.id }
    });

    /* -------------------------------------------------------------- */
    section('PRIVACY: public professional LIST (no token)');

    const list = await request('GET', `/api/public/freelancers?city_id=${udaipur.id}`);
    check('List responds without auth', list.status === 200);
    const row = (list.data?.data || []).find((u) => String(u._id || u.id) === String(freelancer.id));
    check('Professional appears in the list', Boolean(row));

    const listLeaks = PRIVATE_KEYS.filter((k) => row && k in row);
    check('No private KEYS in list payload', listLeaks.length === 0, listLeaks.join(', '));
    check('Private address string absent from raw list JSON', !list.raw.includes(SECRET_ADDRESS));
    check('Coordinates absent from raw list JSON', !list.raw.includes('24.9299') && !list.raw.includes('73.8207'));
    check('Registered email absent from raw list JSON', !list.raw.includes(freelancer.email));
    check('Phone number absent from raw list JSON', !list.raw.includes(freelancer.phone));
    check('Approximate city/state IS exposed', row?.city === 'Udaipur' && row?.state === 'Rajasthan');

    /* -------------------------------------------------------------- */
    section('PRIVACY: public professional DETAIL (no token)');

    const detail = await request('GET', `/api/public/freelancers/${freelancer.id}`);
    check('Detail endpoint responds without auth', detail.status === 200);
    const p = detail.data?.data || {};

    const detailLeaks = PRIVATE_KEYS.filter((k) => k in p);
    check('No private KEYS in detail payload', detailLeaks.length === 0, detailLeaks.join(', '));
    check('Private address absent from raw detail JSON', !detail.raw.includes(SECRET_ADDRESS));
    check('Landmark absent from raw detail JSON', !detail.raw.includes('Behind the temple'));
    check('Coordinates absent from raw detail JSON', !detail.raw.includes('24.9299') && !detail.raw.includes('73.8207'));
    check('Email absent from raw detail JSON', !detail.raw.includes(freelancer.email));
    check('Phone absent from raw detail JSON', !detail.raw.includes(freelancer.phone));
    check('Password hash absent', !detail.raw.includes('$2a$') && !detail.raw.includes('$2b$'));

    // Identity is now gated behind an active subscription, so an anonymous
    // caller sees the locked shape: discovery data yes, identity no.
    check('Anonymous caller receives the LOCKED shape', p.locked === true);
    check('Locked: name withheld', p.name === null);
    check('Locked: bio withheld', !p.bio);
    check('Locked: equipment withheld', !(p.equipment || []).length);
    check('Locked: discovery fields still present',
      p.profession === 'Drone Pilot' && p.city === 'Udaipur');
    check('Public experience exposed', p.experience_years === 6);

    // A subscribed company gets the full professional view.
    {
      const plansRes = (await request('GET', '/api/admin/plans', { token: admin.token })).data || [];
      const premium = plansRes.find((pl) => pl.name === 'PREMIUM');
      await request('POST', '/api/admin/subscriptions', {
        token: admin.token,
        body: { user_id: company.id, planId: premium.id, start_date: iso(0), end_date: iso(30) }
      });
      const unlockedRes = await request('GET', `/api/public/freelancers/${freelancer.id}`, { token: company.token });
      const u = unlockedRes.data?.data || {};
      check('Subscribed caller sees the real name', Boolean(u.name) && u.locked !== true);
      check('Subscribed caller sees the bio', u.bio === 'Certified aerial operator.');
      check('Subscribed caller sees the equipment', (u.equipment || [])[0] === 'Mavic 3');
      check('Subscribed response STILL hides email/phone',
        !unlockedRes.raw.includes(freelancer.email) && !unlockedRes.raw.includes(freelancer.phone));
    }

    /* -------------------------------------------------------------- */
    section('Real availability, not base city');

    check('current_availability derived from a published block',
      p.current_availability?.status === 'available' && p.current_availability?.city === 'Udaipur',
      JSON.stringify(p.current_availability));
    check('Upcoming travel exposed with approximate location',
      (p.upcoming_availability || []).some((b) => b.city === 'Jaipur'));
    check('Upcoming entries carry no coordinates',
      (p.upcoming_availability || []).every((b) => !('manual_location' in b) && !('latitude' in b)));

    // A professional with NO blocks must not be reported as available.
    const bare = await request('GET', `/api/public/freelancers/${outsider.id}`);
    check('Professional with no availability reports status "unknown"',
      bare.data?.data?.current_availability?.status === 'unknown',
      JSON.stringify(bare.data?.data?.current_availability));

    /* -------------------------------------------------------------- */
    section('PRIVACY: another signed-in user cannot widen the payload');

    const asCompany = await request('GET', `/api/public/freelancers/${freelancer.id}`, { token: company.token });
    check('Authenticated caller gets the same public DTO',
      !asCompany.raw.includes(freelancer.email) && !asCompany.raw.includes(SECRET_ADDRESS));

    const otherProfile = await request('GET', '/api/profile/me', { token: outsider.token });
    check('Private profile endpoint returns only the CALLER profile',
      otherProfile.data?.data?.id === outsider.id);

    check('404 for an unknown professional', (await request('GET', '/api/public/freelancers/507f1f77bcf86cd799439011')).status === 404);
    const companyAsPro = await request('GET', `/api/public/freelancers/${company.id}`);
    check('Company account is not exposed via the professionals endpoint', companyAsPro.status === 404);

    /* -------------------------------------------------------------- */
    section('PRIVACY: public requirements');

    const reqRes = await request('POST', '/api/requirements', {
      token: company.token,
      body: {
        category: 'Drone Pilot', city: 'Jaipur', state: 'Rajasthan', quantity: 1,
        number_of_days: 1, event_date: iso(20), end_date: iso(20),
        payment_per_freelancer: 15000, venue: 'Private Villa Road 7',
        description: 'Aerial coverage required for a private ceremony.', status: 'published'
      }
    });
    const reqId = reqRes.data?.requirementId;
    check('Company created a requirement', Boolean(reqId));

    const pubReq = await request('GET', `/api/requirements/${reqId}`);
    check('Requirement detail responds without auth', pubReq.status === 200);
    check('Company email absent from requirement JSON', !pubReq.raw.includes(company.email));
    check('Company phone absent from requirement JSON', !pubReq.raw.includes(company.phone));
    check('Public company name IS shown', Boolean(pubReq.data?.company_name));

    /* -------------------------------------------------------------- */
    section('Search still honours date + location');

    const onTrip = await request('GET', `/api/public/freelancers?city_id=${jaipur.id}&date=${iso(12)}`);
    check('Found in Jaipur during the travel window',
      (onTrip.data?.data || []).some((u) => String(u._id || u.id) === String(freelancer.id)));

    const byProfession = await request('GET', `/api/public/freelancers?profession_id=${droneP.id}`);
    check('profession_id filter still works',
      (byProfession.data?.data || []).some((u) => String(u._id || u.id) === String(freelancer.id)));
  } catch (err) {
    crashed = err;
    console.log(`\n  !! ABORTED: ${err.message}`);
  } finally {
    section('Cleanup');
    const User = (await import('../models/User.js')).default;
    const AvailabilityBlock = (await import('../models/AvailabilityBlock.js')).default;
    const Requirement = (await import('../models/Requirement.js')).default;
    const Notification = (await import('../models/Notification.js')).default;
    const EmailLog = (await import('../models/EmailLog.js')).default;
    const ActivityLog = (await import('../models/ActivityLog.js')).default;
    const Subscription = (await import('../models/Subscription.js')).default;

    const testUsers = await User.find({ email: new RegExp(`${TAG.replace('.', '\\.')}$`), role: { $ne: 'admin' } }).select('_id');
    const ids = testUsers.map((u) => u._id);
    if (ids.length) {
      await AvailabilityBlock.deleteMany({ user_id: { $in: ids } });
      await Requirement.deleteMany({ company_id: { $in: ids } });
      await Notification.deleteMany({ recipient_id: { $in: ids } });
      // Verification and reset mail sent to these accounts. No suite cleaned
      // this up, so every run left its email-log rows behind for good.
      await EmailLog.deleteMany({ user_id: { $in: ids } });
      await Subscription.deleteMany({ user_id: { $in: ids } });
      // Both sides: entries this account CAUSED, and entries where it was the
      // subject of somebody else's action (an admin verifying it, say).
      await ActivityLog.deleteMany({
        $or: [{ 'actor.user_id': { $in: ids } }, { 'target.id': { $in: ids } }]
      });
      await User.deleteMany({ _id: { $in: ids } });
    }
    console.log(`  Removed ${ids.length} throwaway account(s) and their data.`);

    console.log(`\n${'='.repeat(62)}`);
    console.log(`RESULT: ${pass} passed, ${fail} failed${crashed ? ' (ABORTED EARLY)' : ''}`);
    if (failures.length) { console.log('\nFailures:'); failures.forEach((f) => console.log('  - ' + f)); }
    console.log('='.repeat(62));

    await mongoose.connection.close();
    process.exit(fail === 0 && !crashed ? 0 : 1);
  }
};

run();
