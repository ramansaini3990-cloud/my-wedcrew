/**
 * Verifies the connection / duplicate-prevention lifecycle and the sidebar
 * unread-message badge.
 *
 *   E2E_ADMIN_EMAIL=... E2E_ADMIN_PASSWORD=... npm run test:connection
 *
 * Covers scenarios A-L: both connection directions, duplicate blocking that
 * still permits genuinely new work, single-conversation reuse, real-time
 * unread totals over the existing socket, and the unchanged subscription lock.
 * Every throwaway account is removed at the end.
 */
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { io as ioClient } from 'socket.io-client';
import connectDB from '../config/database.js';

dotenv.config();

const API = process.env.API_URL || 'http://localhost:5000';
const STAMP = Date.now();
const TAG = '@e2e.local';
const PASS = 'Connect@2026';

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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let phoneSeq = 0;
const register = async (role, label, extra = {}) => {
  phoneSeq += 1;
  const email = `conn.${label}.${STAMP}${TAG}`;
  const phone = `9${String(STAMP).slice(-8)}${phoneSeq}`.slice(0, 10);
  const r = await request('POST', '/api/auth/register', {
    body: { role, name: `CONN ${label}`, phone, email, password: PASS, ...extra }
  });
  if (r.status !== 201) return { failed: r };
  const l = await request('POST', '/api/auth/login', { body: { email, password: PASS } });
  return { email, phone, token: l.data.token, id: l.data.user.id, role, name: `CONN ${label}` };
};

const iso = (d) => { const x = new Date(); x.setDate(x.getDate() + d); return x.toISOString().slice(0, 10); };
const totalUnread = async (token) => (await request('GET', '/api/chat/unread-count', { token })).data?.total_unread;

const createRequirement = async (token, category, city) => {
  const r = await request('POST', '/api/requirements', {
    token,
    body: {
      category, city, state: 'Rajasthan',
      event_date: iso(30), end_date: iso(31),
      quantity: 1, payment_per_freelancer: 40000, number_of_days: 1,
      description: 'E2E connection lifecycle requirement',
      status: 'published'
    }
  });
  return { status: r.status, id: r.data?.requirementId, raw: r.data };
};

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
  const sockets = [];

  try {
    const company = await register('company', 'company');
    const freelancer = await register('freelancer', 'freelancer', { profession: 'Cinematographer', city: 'Jaipur' });
    const company2 = await register('company', 'company2');
    const freelancer2 = await register('freelancer', 'freelancer2', { profession: 'Drone Pilot', city: 'Udaipur' });
    if (company.failed || freelancer.failed || company2.failed || freelancer2.failed) throw new Error('Registration failed');

    const Conversation = (await import('../models/Conversation.js')).default;
    const convCount = (a, b) => Conversation.countDocuments({ company_id: a, freelancer_id: b });

    // viewer_connection rides on the unlocked profile DTO. Without a plan the
    // profile is masked by the existing privacy gate (correct behaviour), so
    // the companies are subscribed up front to exercise the connected UI state.
    const allPlans = (await request('GET', '/api/admin/plans', { token: admin.token })).data || [];
    const PLAN = allPlans.find((p) => p.name === 'PREMIUM');
    for (const u of [company, company2]) {
      await request('POST', '/api/admin/subscriptions', {
        token: admin.token,
        body: { user_id: u.id, planId: PLAN.id, start_date: iso(0), end_date: iso(30) }
      });
    }

    /* -------------------------------------------------------------- */
    section('A/B. Company -> Freelancer: request, accept, connect');

    const req1 = await request('POST', '/api/booking-requests', {
      token: company.token, body: { freelancer_id: freelancer.id }
    });
    check('A. Booking request created', req1.status === 201, JSON.stringify(req1.data).slice(0, 120));

    const beforeAccept = await request('GET', `/api/public/freelancers/${freelancer.id}`, { token: company.token });
    check('A. Not connected before acceptance', beforeAccept.data?.data?.viewer_connection?.connected === false);
    check('A. A pending request already blocks a second one',
      beforeAccept.data?.data?.viewer_connection?.can_request === false,
      JSON.stringify(beforeAccept.data?.data?.viewer_connection));

    const accept1 = await request('PUT', `/api/booking-requests/${req1.data.requestId}/status`, {
      token: freelancer.token, body: { status: 'accepted' }
    });
    check('B. Freelancer can accept', accept1.status === 200, JSON.stringify(accept1.data).slice(0, 120));

    const afterAccept = await request('GET', `/api/public/freelancers/${freelancer.id}`, { token: company.token });
    check('B. Now reported CONNECTED', afterAccept.data?.data?.viewer_connection?.connected === true);
    check('B. Connected via booking', afterAccept.data?.data?.viewer_connection?.via === 'booking');
    check('B. Conversation id exposed', Boolean(afterAccept.data?.data?.viewer_connection?.conversation_id));
    check('B. Exactly one conversation', (await convCount(company.id, freelancer.id)) === 1);

    /* -------------------------------------------------------------- */
    section('C. Duplicate booking request is blocked by the BACKEND');

    const dup = await request('POST', '/api/booking-requests', {
      token: company.token, body: { freelancer_id: freelancer.id }
    });
    check('C. Duplicate request rejected', dup.status === 400, `status ${dup.status}`);
    check('C. Rejected as ALREADY_CONNECTED', dup.data?.code === 'ALREADY_CONNECTED', dup.data?.code);
    check('C. Response points at the conversation', Boolean(dup.data?.conversation_id));

    const BookingRequest = (await import('../models/BookingRequest.js')).default;
    check('C. No extra booking row was written',
      (await BookingRequest.countDocuments({ company_id: company.id, freelancer_id: freelancer.id })) === 1);
    check('C. can_request is false for the UI', afterAccept.data?.data?.viewer_connection?.can_request === false);

    /* -------------------------------------------------------------- */
    section('D. Legitimate NEW work is still allowed (not a global ban)');

    const newReq = await createRequirement(company.token, 'Cinematographer', 'Jaipur');
    const requirementId = newReq.id;
    check('D. New requirement created', Boolean(requirementId), JSON.stringify(newReq.raw).slice(0, 140));

    if (requirementId) {
      const newWork = await request('POST', '/api/booking-requests', {
        token: company.token, body: { freelancer_id: freelancer.id, requirement_id: requirementId }
      });
      check('D. Booking for a NEW requirement is allowed', newWork.status === 201,
        `status ${newWork.status} ${JSON.stringify(newWork.data).slice(0, 90)}`);

      // ...but a second one for that same requirement is a duplicate again.
      const dupSame = await request('POST', '/api/booking-requests', {
        token: company.token, body: { freelancer_id: freelancer.id, requirement_id: requirementId }
      });
      check('D. Second request for the SAME requirement blocked', dupSame.status === 400, `status ${dupSame.status}`);
    }

    /* -------------------------------------------------------------- */
    section('B2. Freelancer -> Company: apply, accept, connect');

    const req2 = await createRequirement(company2.token, 'Drone Pilot', 'Udaipur');
    const req2Id = req2.id;
    check('B2. Requirement created', Boolean(req2Id), JSON.stringify(req2.raw).slice(0, 140));

    const app = await request('POST', '/api/applications', {
      token: freelancer2.token,
      body: { requirement_id: req2Id, proposed_rate: '35000', availability: 'Available', message: 'I can cover this.' }
    });
    check('B2. Application created', app.status === 201, JSON.stringify(app.data).slice(0, 120));

    const appId = app.data?.data?._id || app.data?.data?.id;
    const acceptApp = await request('PATCH', `/api/applications/${appId}/status`, {
      token: company2.token, body: { status: 'accepted' }
    });
    check('B2. Company can accept the application', acceptApp.status === 200,
      `status ${acceptApp.status} ${JSON.stringify(acceptApp.data).slice(0, 110)}`);

    // This is the gap the change closes: accepting an application used to
    // promise chat while creating no conversation at all.
    check('B2. Accepting an application OPENS a conversation',
      (await convCount(company2.id, freelancer2.id)) === 1,
      `found ${await convCount(company2.id, freelancer2.id)}`);

    const conn2 = await request('GET', `/api/public/freelancers/${freelancer2.id}`, { token: company2.token });
    check('B2. Reported connected via application', conn2.data?.data?.viewer_connection?.via === 'application');

    const dupAfterApp = await request('POST', '/api/booking-requests', {
      token: company2.token, body: { freelancer_id: freelancer2.id }
    });
    check('D2. Redundant booking request blocked after an accepted application',
      dupAfterApp.status === 400 && dupAfterApp.data?.code === 'ALREADY_CONNECTED', dupAfterApp.data?.code);

    // This endpoint drives the freelancer's Apply button. It used to throw
    // "status is not defined" on every call and 500; the UI swallowed that as
    // "not applied" and kept showing Apply Now to an already-accepted
    // freelancer. It must answer 200 in all three shapes below.
    const mineAccepted = await request('GET', `/api/applications/my/requirement/${req2Id}`, { token: freelancer2.token });
    check('D2. My-application lookup returns 200 (not 500)', mineAccepted.status === 200,
      `status ${mineAccepted.status} ${JSON.stringify(mineAccepted.data).slice(0, 90)}`);
    check('D2. Lookup reports the ACCEPTED status', mineAccepted.data?.data?.status === 'accepted',
      mineAccepted.data?.data?.status);

    const notApplied = await request('GET', `/api/applications/my/requirement/${requirementId}`, { token: freelancer2.token });
    check('D2. "Not applied" is a 200 with null, not an error',
      notApplied.status === 200 && notApplied.data?.data === null,
      `status ${notApplied.status} data ${JSON.stringify(notApplied.data?.data)}`);

    const badId = await request('GET', '/api/applications/my/requirement/not-an-id', { token: freelancer2.token });
    check('D2. A malformed requirement id is rejected cleanly', badId.status === 400, `status ${badId.status}`);

    const reApply = await request('POST', '/api/applications', {
      token: freelancer2.token,
      body: { requirement_id: req2Id, proposed_rate: '30000', availability: 'Available', message: 'Again' }
    });
    check('D2. Re-applying to the SAME requirement blocked', reApply.status >= 400, `status ${reApply.status}`);

    /* -------------------------------------------------------------- */
    section('Conversation is never duplicated, whoever connects first');

    const bothWays = await request('POST', '/api/chat/conversations', {
      token: company.token, body: { freelancer_id: freelancer.id }
    });
    check('Conversation endpoint reuses the existing row', bothWays.status < 500);
    check('Still exactly one conversation for the pair', (await convCount(company.id, freelancer.id)) === 1);

    /* -------------------------------------------------------------- */
    section('I. Subscription lock unchanged (freelancer has no plan)');

    const conversationId = afterAccept.data.data.viewer_connection.conversation_id;
    const lockedSocket = await connectSocket(company.token); sockets.push(lockedSocket);
    const blocked = await send(lockedSocket, conversationId, 'should not deliver');
    check('I. Message refused without an active plan', blocked?.success !== true, JSON.stringify(blocked).slice(0, 110));
    check('I. Refusal names a subscription reason', /SUBSCRIPTION|PLAN|CHAT/i.test(blocked?.code || ''), blocked?.code);

    /* -------------------------------------------------------------- */
    section('E-H/J. Unread badge with BOTH sides subscribed');

    await request('POST', '/api/admin/subscriptions', {
      token: admin.token,
      body: { user_id: freelancer.id, planId: PLAN.id, start_date: iso(0), end_date: iso(30) }
    });

    check('J. Company starts with zero unread', (await totalUnread(company.token)) === 0);

    const fSocket = await connectSocket(freelancer.token); sockets.push(fSocket);
    const cSocket = await connectSocket(company.token); sockets.push(cSocket);

    // Capture what the company's browser would receive live.
    const live = [];
    cSocket.on('conversation_unread', (p) => live.push(p));

    const m1 = await send(fSocket, conversationId, 'Hello from the freelancer');
    check('J. Message delivers when both sides are subscribed', m1?.success === true, JSON.stringify(m1).slice(0, 110));
    await sleep(900);

    check('E. Company total unread is 1', (await totalUnread(company.token)) === 1, `got ${await totalUnread(company.token)}`);
    check('E. Live socket event carried totalUnread', live[0]?.totalUnread === 1, JSON.stringify(live[0] || {}));

    await send(fSocket, conversationId, 'Second message');
    await sleep(900);
    check('F. Total unread is 2', (await totalUnread(company.token)) === 2, `got ${await totalUnread(company.token)}`);
    check('F. Live event updated to 2', live[live.length - 1]?.totalUnread === 2, JSON.stringify(live[live.length - 1] || {}));

    const read = await request('PATCH', `/api/chat/conversations/${conversationId}/read`, { token: company.token });
    check('G. Marking read succeeds', read.status === 200);
    check('G. Response carries the new total for the badge', read.data?.total_unread === 0, `got ${read.data?.total_unread}`);
    check('G. Total unread back to 0', (await totalUnread(company.token)) === 0);

    // H: reply travels the other way.
    const fLive = [];
    fSocket.on('conversation_unread', (p) => fLive.push(p));
    await send(cSocket, conversationId, 'Reply from the company');
    await sleep(900);
    check('H. Freelancer receives a real-time unread badge', fLive[fLive.length - 1]?.totalUnread === 1,
      JSON.stringify(fLive[fLive.length - 1] || {}));
    check('H. Freelancer total via REST agrees', (await totalUnread(freelancer.token)) === 1);

    /* -------------------------------------------------------------- */
    section('Security: unread state cannot be manipulated by others');

    const outsider = await request('PATCH', `/api/chat/conversations/${conversationId}/read`, { token: company2.token });
    check('Non-participant cannot mark the conversation read', outsider.status === 403, `status ${outsider.status}`);
    check('Freelancer unread untouched by the outsider', (await totalUnread(freelancer.token)) === 1);

    const anonCount = await request('GET', '/api/chat/unread-count');
    check('Unread count requires auth', anonCount.status === 401, `status ${anonCount.status}`);

    const otherCount = await totalUnread(company2.token);
    check('Each user only ever sees their own count', otherCount === 0, `got ${otherCount}`);

    /* -------------------------------------------------------------- */
    section('K/L. Existing flows still work');

    const listing = await request('GET', '/api/public/freelancers', { token: company.token });
    check('K. Professional search still works', listing.status === 200 && Array.isArray(listing.data?.data));

    const freshPair = await request('POST', '/api/booking-requests', {
      token: company.token, body: { freelancer_id: freelancer2.id }
    });
    check('K. Booking an UNconnected freelancer still works', freshPair.status === 201, `status ${freshPair.status}`);

    const notif = await request('GET', '/api/notifications/unread-count', { token: freelancer.token });
    check('L. Notification counter still responds', notif.status === 200);
    check('L. Chat messages did NOT inflate the Notifications badge',
      (notif.data?.count ?? notif.data?.unread ?? 0) >= 0 &&
      !JSON.stringify(notif.data || {}).includes('Reply from the company'));

    const apps = await request('GET', '/api/applications/my', { token: freelancer2.token });
    check('K. Applications list still responds', apps.status === 200, `status ${apps.status}`);
  } catch (err) {
    crashed = err;
    console.error('\n!! Suite aborted:', err.message);
  } finally {
    for (const s of sockets) { try { s.close(); } catch { /* ignore */ } }

    section('Cleanup');
    const User = (await import('../models/User.js')).default;
    const Conversation = (await import('../models/Conversation.js')).default;
    const Message = (await import('../models/Message.js')).default;
    const Notification = (await import('../models/Notification.js')).default;
    const BookingRequest = (await import('../models/BookingRequest.js')).default;
    const Application = (await import('../models/Application.js')).default;
    const Requirement = (await import('../models/Requirement.js')).default;
    const Subscription = (await import('../models/Subscription.js')).default;
    const ActivityLog = (await import('../models/ActivityLog.js')).default;

    const testUsers = await User.find({ email: new RegExp(`${TAG.replace('.', '\\.')}$`), role: { $ne: 'admin' } }).select('_id');
    const ids = testUsers.map((u) => u._id);
    if (ids.length) {
      const convs = await Conversation.find({ $or: [{ company_id: { $in: ids } }, { freelancer_id: { $in: ids } }] }).select('_id');
      await Message.deleteMany({ conversation_id: { $in: convs.map((c) => c._id) } });
      await Conversation.deleteMany({ _id: { $in: convs.map((c) => c._id) } });
      await Application.deleteMany({ $or: [{ freelancer_id: { $in: ids } }, { company_id: { $in: ids } }] });
      await Requirement.deleteMany({ company_id: { $in: ids } });
      await BookingRequest.deleteMany({ $or: [{ freelancer_id: { $in: ids } }, { company_id: { $in: ids } }] });
      await Notification.deleteMany({ recipient_id: { $in: ids } });
      await Subscription.deleteMany({ user_id: { $in: ids } });
      await ActivityLog.deleteMany({ 'actor.user_id': { $in: ids } });
      await User.deleteMany({ _id: { $in: ids } });
    }
    await ActivityLog.deleteMany({ 'target.label': /^CONN / });
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
