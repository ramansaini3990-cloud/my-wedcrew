/**
 * Verifies the professional subscription lock and the strong-password policy.
 *
 *   E2E_ADMIN_EMAIL=... E2E_ADMIN_PASSWORD=... npm run test:privacy
 *
 * The lock assertions are made against the RAW response body, so they prove the
 * data never reaches the client - not merely that the UI hides it.
 */
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import connectDB from '../config/database.js';

dotenv.config();

const API = process.env.API_URL || 'http://localhost:5000';
const STAMP = Date.now();
const TAG = '@e2e.local';
const STRONG = 'WedCrew@2026';

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
  try { raw = await res.text(); data = JSON.parse(raw); } catch { /* ignore */ }
  return { status: res.status, data, raw };
};

let phoneSeq = 0;
const register = async (role, label, password = STRONG, extra = {}) => {
  phoneSeq += 1;
  const email = `pv.${label}.${STAMP}${TAG}`;
  const phone = `9${String(STAMP).slice(-8)}${phoneSeq}`.slice(0, 10);
  const r = await request('POST', '/api/auth/register', {
    body: { role, name: `PV ${label}`, phone, email, password, ...extra }
  });
  if (r.status !== 201) return { failed: r };
  const l = await request('POST', '/api/auth/login', { body: { email, password } });
  return { email, password, phone, token: l.data.token, id: l.data.user.id, role, name: `PV ${label}` };
};

const iso = (d) => { const x = new Date(); x.setDate(x.getDate() + d); return x.toISOString().slice(0, 10); };

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
    /* -------------------------------------------------------------- */
    section('TEST K/L: password policy enforced by the BACKEND');

    const weakCases = [
      ['12345678', 'digits only'],
      ['password', 'lowercase only'],
      ['Password123', 'no special character'],
      ['Sh0rt!', 'too short'],
      ['WEDCREW@2026', 'no lowercase'],
      ['wedcrew@2026', 'no uppercase']
    ];
    for (const [pw, why] of weakCases) {
      const r = await register('freelancer', `weak${weakCases.indexOf(weakCases.find(w => w[0] === pw))}`, pw);
      check(`K. Weak password rejected (${why})`,
        r.failed?.status === 400 && r.failed?.data?.code === 'WEAK_PASSWORD',
        `status ${r.failed?.status} ${r.failed?.data?.code}`);
    }

    const strongUser = await register('freelancer', 'strong', STRONG);
    check('L. Strong password accepted', Boolean(strongUser.token), JSON.stringify(strongUser.failed?.data || {}).slice(0, 120));

    const User = (await import('../models/User.js')).default;
    const stored = await User.findById(strongUser.id).select('password').lean();
    check('L. Password stored as a bcrypt hash', /^\$2[aby]\$/.test(stored?.password || ''));
    check('L. Plaintext password never stored', stored?.password !== STRONG);

    check('Policy response does not echo the password',
      !JSON.stringify((await register('company', 'echo', 'weakpw')).failed?.data || {}).includes('weakpw'));

    /* -------------------------------------------------------------- */
    section('TEST H/I/M: login unaffected');

    const good = await request('POST', '/api/auth/login', { body: { email: strongUser.email, password: STRONG } });
    check('H. Login with the correct password works', good.status === 200 && Boolean(good.data?.token));

    const bad = await request('POST', '/api/auth/login', { body: { email: strongUser.email, password: 'WrongPass@1' } });
    check('I. Wrong password still returns the existing error',
      bad.status === 401 && bad.data?.message === 'Invalid credentials');

    // M: an account whose password predates the policy must still sign in.
    const bcrypt = (await import('bcryptjs')).default;
    const legacyHash = await bcrypt.hash('oldweak', 10);
    const legacy = await User.create({
      role: 'freelancer', name: 'PV legacy',
      phone: `9${String(STAMP).slice(-8)}0`.slice(0, 10), // suffix 0 - phoneSeq never reaches it
      email: `pv.legacy.${STAMP}${TAG}`, password: legacyHash
    });
    const legacyLogin = await request('POST', '/api/auth/login', { body: { email: legacy.email, password: 'oldweak' } });
    check('M. Existing user with an old weak password can STILL log in',
      legacyLogin.status === 200 && Boolean(legacyLogin.data?.token));

    check('O. Admin login still works', (await request('POST', '/api/auth/login',
      { body: { email: adminEmail, password: adminPassword } })).status === 200);

    /* -------------------------------------------------------------- */
    section('Setup: a professional with a real identity');

    const company = await register('company', 'company', STRONG);
    const states = (await request('GET', '/api/master/states')).data.data;
    const rajasthan = states.find((s) => s.name === 'Rajasthan');
    const cities = (await request('GET', `/api/master/cities?state_id=${rajasthan.id}`)).data.data;
    const udaipur = cities.find((c) => c.name === 'Udaipur');
    const professions = (await request('GET', '/api/master/professions')).data.data;
    const droneP = professions.find((p) => p.name === 'Drone Pilot');

    await request('PUT', '/api/profile/me', {
      token: strongUser.token,
      body: {
        profession_id: droneP.id, state_id: rajasthan.id, city_id: udaipur.id,
        bio: 'Certified aerial operator.', experience_years: 6, equipment: ['Mavic 3']
      }
    });
    await request('POST', '/api/availability/blocks', {
      token: strongUser.token,
      body: { start_date: iso(0), end_date: iso(4), status: 'available', state_id: rajasthan.id, city_id: udaipur.id }
    });

    const REAL_NAME = strongUser.name;

    /* -------------------------------------------------------------- */
    section('TEST A/B: NO subscription -> identity withheld by the API');

    const anonList = await request('GET', '/api/public/freelancers');
    check('A. Anonymous list responds', anonList.status === 200);
    const anonRow = (anonList.data?.data || []).find((u) => String(u._id || u.id) === String(strongUser.id));
    check('A. Professional still listed (discovery preserved)', Boolean(anonRow));
    check('A. Row flagged locked', anonRow?.locked === true);
    check('B. Real name NOT in the raw list body', !anonList.raw.includes(REAL_NAME));
    check('B. Bio NOT in the raw list body', !anonList.raw.includes('Certified aerial operator'));
    check('B. Email NOT in the raw list body', !anonList.raw.includes(strongUser.email));
    check('B. Phone NOT in the raw list body', !anonList.raw.includes(strongUser.phone));
    check('A. Craft/area still visible', anonRow?.profession === 'Drone Pilot' && anonRow?.city === 'Udaipur');

    const unsubList = await request('GET', '/api/public/freelancers', { token: company.token });
    check('A. Company WITHOUT a subscription is also locked',
      (unsubList.data?.data || []).find((u) => String(u._id || u.id) === String(strongUser.id))?.locked === true);
    check('B. Real name withheld from the unsubscribed company', !unsubList.raw.includes(REAL_NAME));

    const anonDetail = await request('GET', `/api/public/freelancers/${strongUser.id}`);
    check('B. Detail endpoint locked for anonymous', anonDetail.data?.data?.locked === true);
    check('B. Detail: real name withheld', !anonDetail.raw.includes(REAL_NAME));
    check('B. Detail: bio withheld', !anonDetail.raw.includes('Certified aerial operator'));
    check('B. Detail: equipment withheld', !anonDetail.raw.includes('Mavic 3'));
    check('B. Detail: email/phone withheld',
      !anonDetail.raw.includes(strongUser.email) && !anonDetail.raw.includes(strongUser.phone));

    const unsubDetail = await request('GET', `/api/public/freelancers/${strongUser.id}`, { token: company.token });
    check('B. Detail locked for the unsubscribed company', unsubDetail.data?.data?.locked === true);
    check('B. Real name withheld from the unsubscribed company', !unsubDetail.raw.includes(REAL_NAME));

    /* -------------------------------------------------------------- */
    section('TEST C/D: WITH subscription -> full professional view');

    const plans = (await request('GET', '/api/admin/plans', { token: admin.token })).data || [];
    const PREMIUM = plans.find((p) => p.name === 'PREMIUM');
    await request('POST', '/api/admin/subscriptions', {
      token: admin.token,
      body: { user_id: company.id, planId: PREMIUM.id, start_date: iso(0), end_date: iso(30) }
    });

    const subList = await request('GET', '/api/public/freelancers', { token: company.token });
    const subRow = (subList.data?.data || []).find((u) => String(u._id || u.id) === String(strongUser.id));
    check('C. Subscribed company sees the real name', subRow?.name === REAL_NAME, `got ${subRow?.name}`);
    check('C. Row not flagged locked', subRow?.locked === false);

    const subDetail = await request('GET', `/api/public/freelancers/${strongUser.id}`, { token: company.token });
    check('D. Subscribed company can open the full profile',
      subDetail.data?.data?.name === REAL_NAME && subDetail.data?.data?.locked !== true);
    check('D. Bio and equipment visible when subscribed',
      subDetail.data?.data?.bio === 'Certified aerial operator.' && subDetail.data?.data?.equipment?.[0] === 'Mavic 3');
    check('D. Availability still derived from real blocks',
      subDetail.data?.data?.current_availability?.city === 'Udaipur');

    /* -------------------------------------------------------------- */
    section('TEST E: private fields never exposed, even when unlocked');

    check('E. Email absent even for a subscribed viewer', !subDetail.raw.includes(strongUser.email));
    check('E. Phone absent even for a subscribed viewer', !subDetail.raw.includes(strongUser.phone));
    check('E. No password hash in the response', !subDetail.raw.includes('$2a$') && !subDetail.raw.includes('$2b$'));

    /* -------------------------------------------------------------- */
    section('Owner and admin are never locked out of their own view');

    const ownView = await request('GET', `/api/public/freelancers/${strongUser.id}`, { token: strongUser.token });
    check('Professional viewing their OWN profile is unlocked', ownView.data?.data?.name === REAL_NAME);

    const adminView = await request('GET', `/api/public/freelancers/${strongUser.id}`, { token: admin.token });
    check('Admin sees the unlocked profile', adminView.data?.data?.name === REAL_NAME);

    /* -------------------------------------------------------------- */
    section('TEST F/G: booking + chat rules unchanged');

    const booking = await request('POST', '/api/booking-requests', {
      token: company.token, body: { freelancer_id: strongUser.id }
    });
    check('F. Booking request still works', booking.status === 201, JSON.stringify(booking.data).slice(0, 120));

    const accepted = await request('PUT', `/api/booking-requests/${booking.data.requestId}/status`, {
      token: strongUser.token, body: { status: 'accepted' }
    });
    check('F. Booking accept still works', accepted.status === 200);

    const conv = await request('POST', '/api/chat/conversations', {
      token: company.token, body: { company_id: company.id, freelancer_id: strongUser.id }
    });
    const conversationId = conv.data?.id || conv.data?._id;
    check('Conversation still opens', [200, 201].includes(conv.status));

    // The freelancer has no subscription, so chat must remain locked.
    const chat = await request('GET', `/api/chat/conversations/${conversationId}/messages`, { token: company.token });
    check('G. Chat subscription rule unchanged (still locked)',
      chat.status === 403 && chat.data?.code === 'SUBSCRIPTION_REQUIRED');
  } catch (err) {
    crashed = err;
    console.log(`\n  !! ABORTED: ${err.message}`);
  } finally {
    section('Cleanup');
    const User = (await import('../models/User.js')).default;
    const AvailabilityBlock = (await import('../models/AvailabilityBlock.js')).default;
    const Notification = (await import('../models/Notification.js')).default;
    const Conversation = (await import('../models/Conversation.js')).default;
    const Message = (await import('../models/Message.js')).default;
    const BookingRequest = (await import('../models/BookingRequest.js')).default;
    const Subscription = (await import('../models/Subscription.js')).default;
    const ActivityLog = (await import('../models/ActivityLog.js')).default;

    const testUsers = await User.find({ email: new RegExp(`${TAG.replace('.', '\\.')}$`), role: { $ne: 'admin' } }).select('_id');
    const ids = testUsers.map((u) => u._id);
    if (ids.length) {
      const convs = await Conversation.find({ $or: [{ company_id: { $in: ids } }, { freelancer_id: { $in: ids } }] }).select('_id');
      await Message.deleteMany({ conversation_id: { $in: convs.map((c) => c._id) } });
      await Conversation.deleteMany({ _id: { $in: convs.map((c) => c._id) } });
      await Notification.deleteMany({ recipient_id: { $in: ids } });
      await BookingRequest.deleteMany({ $or: [{ freelancer_id: { $in: ids } }, { company_id: { $in: ids } }] });
      await Subscription.deleteMany({ user_id: { $in: ids } });
      await AvailabilityBlock.deleteMany({ user_id: { $in: ids } });
      await ActivityLog.deleteMany({ 'actor.user_id': { $in: ids } });
      await User.deleteMany({ _id: { $in: ids } });
    }
    await ActivityLog.deleteMany({ 'target.label': /^PV / });
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
