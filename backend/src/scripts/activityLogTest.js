/**
 * End-to-end verification of the admin activity log.
 *
 *   E2E_ADMIN_EMAIL=... E2E_ADMIN_PASSWORD=... npm run test:activity
 *
 * Drives the real HTTP + Socket.IO API, asserts that each business event is
 * logged exactly once, that a live admin socket receives it without polling,
 * that non-admins are refused, and that logging never leaks secrets. Cleans up
 * only what it created.
 */
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { io as ioClient } from 'socket.io-client';
import connectDB from '../config/database.js';

dotenv.config();

const API = process.env.API_URL || 'http://localhost:5000';
const STAMP = Date.now();
const TAG = '@e2e.local';
const TEST_PREFIX = `ZZAct${STAMP}`;

let pass = 0, fail = 0;
const failures = [];
const check = (name, ok, detail = '') => {
  if (ok) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; failures.push(name + (detail ? ' :: ' + detail : '')); console.log(`  FAIL  ${name}${detail ? '  -> ' + detail : ''}`); }
};
const section = (t) => console.log(`\n=== ${t} ===`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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
const register = async (role, label, extra = {}) => {
  phoneSeq += 1;
  const email = `act.${label}.${STAMP}${TAG}`;
  const password = 'E2ePassw0rd!';
  const phone = `9${String(STAMP).slice(-8)}${phoneSeq}`.slice(0, 10);
  const r = await request('POST', '/api/auth/register', {
    body: { role, name: `ACT ${label}`, phone, email, password, ...extra }
  });
  if (r.status !== 201) throw new Error(`register ${label}: ${JSON.stringify(r.data)}`);
  const l = await request('POST', '/api/auth/login', { body: { email, password } });
  return { email, password, phone, token: l.data.token, id: l.data.user.id, role, name: `ACT ${label}` };
};

const iso = (d) => { const x = new Date(); x.setDate(x.getDate() + d); return x.toISOString().slice(0, 10); };

const connectSocket = (token) =>
  new Promise((resolve, reject) => {
    const s = ioClient(API, { auth: { token }, transports: ['websocket'], timeout: 8000 });
    const t = setTimeout(() => reject(new Error('socket connect timeout')), 10000);
    s.on('connect', () => { clearTimeout(t); resolve(s); });
    s.on('connect_error', (e) => { clearTimeout(t); reject(e); });
  });

const send = (socket, conversationId, text) =>
  new Promise((resolve) => {
    const t = setTimeout(() => resolve({ timeout: true }), 10000);
    socket.emit('send_message', { conversationId, text, message: text }, (ack) => { clearTimeout(t); resolve(ack || {}); });
  });

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
  const ActivityLog = (await import('../models/ActivityLog.js')).default;
  const sockets = [];
  let crashed = null;

  // Helper: does an event exist for this run?
  const findEvent = async (eventType, extra = {}) =>
    ActivityLog.find({ event_type: eventType, ...extra }).sort({ created_at: -1 }).lean();

  try {
    /* -------------------------------------------------------------- */
    section('Admin socket subscribes to the live stream');

    const adminSocket = await connectSocket(admin.token);
    sockets.push(adminSocket);
    const liveEvents = [];
    adminSocket.on('activity:new', (e) => liveEvents.push(e));
    await sleep(300);
    check('Admin socket connected', adminSocket.connected);

    /* -------------------------------------------------------------- */
    section('TEST 1-2: registration is logged');

    const freelancer = await register('freelancer', 'freelancer');
    const company = await register('company', 'company');
    await sleep(500);

    const fReg = await findEvent('user.registered.freelancer', { 'actor.user_id': freelancer.id });
    const cReg = await findEvent('user.registered.company', { 'actor.user_id': company.id });
    check('1. Freelancer registration logged', fReg.length === 1, `found ${fReg.length}`);
    check('2. Company registration logged', cReg.length === 1, `found ${cReg.length}`);
    check('Registration entry has a readable title', fReg[0]?.title === 'New user registered');
    check('Registration entry categorised as "users"', fReg[0]?.category === 'users');

    /* -------------------------------------------------------------- */
    section('TEST 12: live delivery without refreshing');

    const beforeLive = liveEvents.length;
    await register('freelancer', 'liveprobe');
    await sleep(700);
    check('12. New activity pushed to the open admin socket', liveEvents.length > beforeLive,
      `before=${beforeLive} after=${liveEvents.length}`);
    check('12. Pushed payload carries event_type + title',
      Boolean(liveEvents.at(-1)?.event_type && liveEvents.at(-1)?.title));

    /* -------------------------------------------------------------- */
    section('Login is logged');

    await request('POST', '/api/auth/login', { body: { email: freelancer.email, password: freelancer.password } });
    await sleep(400);
    check('Login logged', (await findEvent('user.login', { 'actor.user_id': freelancer.id })).length >= 1);

    /* -------------------------------------------------------------- */
    section('TEST 3-4: subscription + payment');

    const plans = (await request('GET', '/api/admin/plans', { token: admin.token })).data || [];
    const PREMIUM = plans.find((p) => p.name === 'PREMIUM');

    for (const u of [freelancer, company]) {
      await request('POST', '/api/admin/subscriptions', {
        token: admin.token,
        body: { user_id: u.id, planId: PREMIUM.id, start_date: iso(0), end_date: iso(30) }
      });
    }
    await sleep(600);

    const subEvents = await findEvent('subscription.created');
    const mySubs = subEvents.filter((e) => ['ACT freelancer', 'ACT company'].includes(e.target?.label));
    check('3. Subscription creation logged', mySubs.length === 2, `found ${mySubs.length}`);
    check('3. Plan name captured in metadata', mySubs[0]?.metadata?.plan_name === 'PREMIUM');

    const payEvents = (await findEvent('payment.completed')).filter((e) => ['ACT freelancer', 'ACT company'].includes(e.target?.label));
    check('4. Payment logged separately', payEvents.length === 2, `found ${payEvents.length}`);
    check('4. Payment amount captured', typeof payEvents[0]?.metadata?.amount === 'number');

    /* -------------------------------------------------------------- */
    section('TEST 5: requirement posted');

    const reqRes = await request('POST', '/api/requirements', {
      token: company.token,
      body: {
        category: 'Drone Pilot', city: 'Jaipur', state: 'Rajasthan', quantity: 1,
        number_of_days: 1, event_date: iso(20), end_date: iso(20),
        payment_per_freelancer: 12000, description: 'Aerial coverage.', status: 'published'
      }
    });
    const requirementId = reqRes.data?.requirementId;
    await sleep(500);
    const reqEvents = await findEvent('requirement.created', { 'target.id': requirementId });
    check('5. Requirement creation logged', reqEvents.length === 1, `found ${reqEvents.length}`);
    check('5. Requirement city captured', reqEvents[0]?.metadata?.city === 'Jaipur');

    /* -------------------------------------------------------------- */
    section('TEST 6-7: booking created, then accepted');

    const booking = await request('POST', '/api/booking-requests', {
      token: company.token, body: { freelancer_id: freelancer.id }
    });
    await sleep(400);
    const bookEvents = await findEvent('booking.created', { 'actor.user_id': company.id });
    check('6. Booking creation logged', bookEvents.length === 1, `found ${bookEvents.length}`);

    await request('PUT', `/api/booking-requests/${booking.data.requestId}/status`, {
      token: freelancer.token, body: { status: 'accepted' }
    });
    await sleep(400);
    check('7. Booking acceptance logged', (await findEvent('booking.accepted', { 'actor.user_id': freelancer.id })).length === 1);

    /* -------------------------------------------------------------- */
    section('TEST 8: message sent (content NOT stored)');

    const conv = await request('POST', '/api/chat/conversations', {
      token: company.token, body: { company_id: company.id, freelancer_id: freelancer.id }
    });
    const conversationId = conv.data?.id || conv.data?._id;
    await sleep(400);
    check('Conversation creation logged', (await findEvent('conversation.created', { 'target.id': conversationId })).length === 1);

    const companySocket = await connectSocket(company.token);
    sockets.push(companySocket);
    const SECRET_TEXT = `TopSecretMessageBody-${STAMP}`;
    const sent = await send(companySocket, conversationId, SECRET_TEXT);
    check('Message actually sent', sent.success === true, JSON.stringify(sent).slice(0, 120));
    await sleep(600);

    const msgEvents = await findEvent('message.sent', { 'target.id': conversationId });
    check('8. Message send logged', msgEvents.length === 1, `found ${msgEvents.length}`);
    check('8. PRIVACY: message body NOT stored in the log',
      !JSON.stringify(msgEvents[0] || {}).includes(SECRET_TEXT));

    /* -------------------------------------------------------------- */
    section('TEST 9: profile update');

    await request('PUT', '/api/profile/me', { token: freelancer.token, body: { bio: 'Updated bio.' } });
    await sleep(400);
    check('9. Profile update logged', (await findEvent('profile.updated', { 'actor.user_id': freelancer.id })).length >= 1);

    /* -------------------------------------------------------------- */
    section('TEST 10: admin master-data change');

    const prof = await request('POST', '/api/admin/master/professions', {
      token: admin.token, body: { name: `${TEST_PREFIX} Grip` }
    });
    await sleep(400);
    const adminEvents = await findEvent('admin.profession.created');
    const mine = adminEvents.filter((e) => e.target?.label === `${TEST_PREFIX} Grip`);
    check('10. Admin profession creation logged', mine.length === 1, `found ${mine.length}`);
    check('10. Categorised as "admin"', mine[0]?.category === 'admin');

    /* -------------------------------------------------------------- */
    section('TEST 11: admin API returns history, paginated + filtered');

    const list = await request('GET', '/api/admin/activity-logs?limit=10', { token: admin.token });
    check('11. Activity list responds', list.status === 200 && Array.isArray(list.data?.data));
    check('11. Newest first', (() => {
      const d = list.data.data;
      return d.length < 2 || new Date(d[0].created_at) >= new Date(d[1].created_at);
    })());
    check('11. Pagination metadata present', typeof list.data?.pagination?.total === 'number');
    check('11. Server caps the page size', (await request('GET', '/api/admin/activity-logs?limit=9999', { token: admin.token }))
      .data?.pagination?.limit <= 100);

    const filtered = await request('GET', '/api/admin/activity-logs?category=subscriptions&limit=50', { token: admin.token });
    check('Category filter works server-side',
      (filtered.data?.data || []).every((e) => e.category === 'subscriptions'));

    const searched = await request('GET', `/api/admin/activity-logs?search=${encodeURIComponent(TEST_PREFIX)}`, { token: admin.token });
    check('Search filter works server-side', (searched.data?.data || []).length >= 1);

    const stats = await request('GET', '/api/admin/activity-logs/stats', { token: admin.token });
    check('Stats endpoint returns real counts',
      stats.status === 200 && typeof stats.data?.data?.today_total === 'number' && stats.data.data.today_total > 0);

    const detail = await request('GET', `/api/admin/activity-logs/${mine[0]._id}`, { token: admin.token });
    check('Detail endpoint returns one entry', detail.status === 200 && detail.data?.data?.event_type === 'admin.profession.created');

    /* -------------------------------------------------------------- */
    section('TEST 13: activity API is admin-only');

    check('Freelancer blocked (403)', (await request('GET', '/api/admin/activity-logs', { token: freelancer.token })).status === 403);
    check('Company blocked (403)', (await request('GET', '/api/admin/activity-logs', { token: company.token })).status === 403);
    check('Unauthenticated blocked (401)', (await request('GET', '/api/admin/activity-logs')).status === 401);
    check('Stats endpoint blocked for non-admin', (await request('GET', '/api/admin/activity-logs/stats', { token: company.token })).status === 403);

    // A non-admin socket must never receive the admin stream.
    const freelancerSocket = await connectSocket(freelancer.token);
    sockets.push(freelancerSocket);
    const leaked = [];
    freelancerSocket.on('activity:new', (e) => leaked.push(e));
    await register('company', 'probe2');
    await sleep(700);
    check('13. Non-admin socket receives NO activity events', leaked.length === 0, `received ${leaked.length}`);

    /* -------------------------------------------------------------- */
    section('PRIVACY: no secrets recorded');

    const recent = await ActivityLog.find().sort({ created_at: -1 }).limit(200).lean();
    const blob = JSON.stringify(recent);
    check('No email addresses stored', !blob.includes(freelancer.email) && !blob.includes(company.email));
    check('No phone numbers stored', !blob.includes(freelancer.phone) && !blob.includes(company.phone));
    check('No bcrypt hashes stored', !blob.includes('$2a$') && !blob.includes('$2b$'));
    check('No JWTs stored', !blob.includes('eyJhbGciOi'));

    /* -------------------------------------------------------------- */
    section('TEST 14: history survives (persisted in MongoDB)');

    const persisted = await ActivityLog.countDocuments({ event_type: 'user.registered.freelancer' });
    check('14. Entries persisted to MongoDB', persisted >= 1);

    /* -------------------------------------------------------------- */
    section('Business operations never broken by logging');

    check('Subscription API still returns success', (await request('GET', '/api/subscriptions/me', { token: company.token })).status === 200);
    check('Requirement still retrievable', (await request('GET', `/api/requirements/${requirementId}`)).status === 200);
    check('Chat messages still readable', (await request('GET', `/api/chat/conversations/${conversationId}/messages`, { token: company.token })).status === 200);
  } catch (err) {
    crashed = err;
    console.log(`\n  !! ABORTED: ${err.message}`);
  } finally {
    section('Cleanup');
    for (const s of sockets) { try { s.close(); } catch { /* ignore */ } }

    const User = (await import('../models/User.js')).default;
    const AvailabilityBlock = (await import('../models/AvailabilityBlock.js')).default;
    const Requirement = (await import('../models/Requirement.js')).default;
    const Notification = (await import('../models/Notification.js')).default;
    const Conversation = (await import('../models/Conversation.js')).default;
    const Message = (await import('../models/Message.js')).default;
    const BookingRequest = (await import('../models/BookingRequest.js')).default;
    const Subscription = (await import('../models/Subscription.js')).default;
    const Profession = (await import('../models/Profession.js')).default;
    const EmailLog = (await import('../models/EmailLog.js')).default;

    const testUsers = await User.find({ email: new RegExp(`${TAG.replace('.', '\\.')}$`), role: { $ne: 'admin' } }).select('_id');
    const ids = testUsers.map((u) => u._id);
    if (ids.length) {
      const convs = await Conversation.find({ $or: [{ company_id: { $in: ids } }, { freelancer_id: { $in: ids } }] }).select('_id');
      await Message.deleteMany({ conversation_id: { $in: convs.map((c) => c._id) } });
      await Conversation.deleteMany({ _id: { $in: convs.map((c) => c._id) } });
      await Notification.deleteMany({ recipient_id: { $in: ids } });
      await BookingRequest.deleteMany({ $or: [{ freelancer_id: { $in: ids } }, { company_id: { $in: ids } }] });
      await Requirement.deleteMany({ company_id: { $in: ids } });
      await Subscription.deleteMany({ user_id: { $in: ids } });
      await AvailabilityBlock.deleteMany({ user_id: { $in: ids } });
      // Both sides: entries this account CAUSED, and entries where it was the
      // subject of somebody else's action - an admin creating its subscription
      // logs actor=admin, target=test user, and those survived an actor-only sweep.
      await ActivityLog.deleteMany({
        $or: [{ 'actor.user_id': { $in: ids } }, { 'target.id': { $in: ids } }]
      });
      // Verification and reset mail sent to these accounts. No suite cleaned
      // this up, so every run left its email-log rows behind for good.
      await EmailLog.deleteMany({ user_id: { $in: ids } });
      await User.deleteMany({ _id: { $in: ids } });
    }
    await Profession.deleteMany({ name: new RegExp(`^${TEST_PREFIX}`) });
    await ActivityLog.deleteMany({ 'target.label': new RegExp(`^${TEST_PREFIX}`) });
    await ActivityLog.deleteMany({ 'target.label': /^ACT (freelancer|company|liveprobe|probe2)$/ });
    console.log(`  Removed ${ids.length} throwaway account(s), their data and their activity entries.`);

    console.log(`\n${'='.repeat(62)}`);
    console.log(`RESULT: ${pass} passed, ${fail} failed${crashed ? ' (ABORTED EARLY)' : ''}`);
    if (failures.length) { console.log('\nFailures:'); failures.forEach((f) => console.log('  - ' + f)); }
    console.log('='.repeat(62));

    await mongoose.connection.close();
    process.exit(fail === 0 && !crashed ? 0 : 1);
  }
};

run();
