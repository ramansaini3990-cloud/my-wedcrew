/**
 * End-to-end flow verification against a RUNNING backend.
 *
 *   npm run test:flow                 (uses http://localhost:5000)
 *   API_URL=http://host:5000 npm run test:flow
 *
 * Creates throwaway accounts (emails end in @e2e.local), drives the real HTTP +
 * Socket.IO API through every documented flow, then deletes everything it made.
 * It never touches pre-existing data.
 *
 * Requires an admin account:
 *   E2E_ADMIN_EMAIL=... E2E_ADMIN_PASSWORD=... npm run test:flow
 */
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { io as ioClient } from 'socket.io-client';
import connectDB from '../config/database.js';

dotenv.config();

const API = process.env.API_URL || 'http://localhost:5000';
const STAMP = Date.now();
const TAG = '@e2e.local';

let pass = 0;
let fail = 0;
const failures = [];

const check = (name, ok, detail = '') => {
  if (ok) {
    pass++;
    console.log(`  PASS  ${name}`);
  } else {
    fail++;
    failures.push(`${name}${detail ? ' :: ' + detail : ''}`);
    console.log(`  FAIL  ${name}${detail ? '  -> ' + detail : ''}`);
  }
};

const section = (title) => console.log(`\n=== ${title} ===`);

const request = async (method, path, { token, body } = {}) => {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  let data = null;
  try { data = await res.json(); } catch { data = null; }
  return { status: res.status, data };
};

let phoneSeq = 0;
const register = async (role, label, extra = {}) => {
  phoneSeq += 1;
  const email = `e2e.${label}.${STAMP}${TAG}`;
  const password = 'E2ePassw0rd!';
  const res = await request('POST', '/api/auth/register', {
    body: {
      role,
      name: `E2E ${label}`,
      phone: `9${String(STAMP).slice(-8)}${phoneSeq}`.slice(0, 10),
      email,
      password,
      city: 'Mumbai',
      state: 'MH',
      ...extra
    }
  });
  if (res.status !== 201) throw new Error(`register ${label} failed: ${JSON.stringify(res.data)}`);
  const login = await request('POST', '/api/auth/login', { body: { email, password } });
  if (login.status !== 200) throw new Error(`login ${label} failed: ${JSON.stringify(login.data)}`);
  return { email, password, token: login.data.token, id: login.data.user.id, role };
};

const iso = (daysFromNow) => {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString().slice(0, 10);
};

/** Sends a message over Socket.IO and resolves with the server's ack. */
const socketSend = (token, conversationId, text) =>
  new Promise((resolve) => {
    const socket = ioClient(API, { auth: { token }, transports: ['websocket'], timeout: 8000 });
    const done = (result) => { socket.close(); resolve(result); };
    const timer = setTimeout(() => done({ timeout: true }), 10000);

    socket.on('connect', () => {
      socket.emit('join_conversation', conversationId);
      socket.emit('send_message', { conversationId, text, message: text }, (ack) => {
        clearTimeout(timer);
        done(ack || {});
      });
    });
    socket.on('connect_error', (err) => {
      clearTimeout(timer);
      done({ connectError: err.message });
    });
  });

const run = async () => {
  const adminEmail = process.env.E2E_ADMIN_EMAIL;
  const adminPassword = process.env.E2E_ADMIN_PASSWORD;
  if (!adminEmail || !adminPassword) {
    console.error('Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD to run this suite.');
    process.exit(1);
  }

  const health = await request('GET', '/api/health');
  if (health.status !== 200) {
    console.error(`Backend not reachable at ${API}. Start it with: npm run dev`);
    process.exit(1);
  }
  console.log(`Backend reachable at ${API}`);

  const adminLogin = await request('POST', '/api/auth/login', {
    body: { email: adminEmail, password: adminPassword }
  });
  if (adminLogin.status !== 200) {
    console.error(`Admin login failed: ${JSON.stringify(adminLogin.data)}`);
    process.exit(1);
  }
  if (adminLogin.data.user.role !== 'admin') {
    console.error('Provided account is not an admin.');
    process.exit(1);
  }
  const admin = { token: adminLogin.data.token, id: adminLogin.data.user.id };
  console.log(`Admin authenticated: ${adminEmail}`);

  await connectDB();

  const created = { userIds: [], requirementIds: [] };
  let crashed = null;

  try {
    /* ---------------------------------------------------------------- */
    section('Setup: accounts + plans');

    const company = await register('company', 'company');
    const freelancer = await register('freelancer', 'freelancer', { profession: 'Cinematographer' });
    created.userIds.push(company.id, freelancer.id);
    check('Company + Freelancer registered and logged in', true);

    const seeded = await request('POST', '/api/admin/plans/seed-defaults', { token: admin.token });
    check('Default plans seeded/present', seeded.status === 201, JSON.stringify(seeded.data).slice(0, 120));

    const plansRes = await request('GET', '/api/admin/plans', { token: admin.token });
    const plans = plansRes.data || [];
    const FREE = plans.find((p) => p.name === 'FREE');
    const PRO = plans.find((p) => p.name === 'PRO');
    const PREMIUM = plans.find((p) => p.name === 'PREMIUM');
    check('FREE / PRO / PREMIUM plans exist', Boolean(FREE && PRO && PREMIUM));
    check('FREE plan has chat disabled', FREE && !FREE.features.includes('chat'));
    check('PRO plan has chat enabled', PRO && PRO.features.includes('chat'));

    /* ---------------------------------------------------------------- */
    section('Access control: non-admin cannot manage subscriptions');

    const forbidden = await request('GET', '/api/admin/subscriptions/overview', { token: company.token });
    check('Company blocked from admin subscription API', forbidden.status === 403);

    /* ---------------------------------------------------------------- */
    section('Admin subscription overview');

    const overview = await request('GET', `/api/admin/subscriptions/overview?search=${STAMP}`, { token: admin.token });
    check('Overview endpoint responds', overview.status === 200);
    const rows = overview.data?.data || [];
    check('Users with NO subscription appear in overview', rows.length === 2, `got ${rows.length}`);
    check('Unsubscribed user reports status "none"', rows.every((r) => r.subscription.status === 'none'));
    check('Unsubscribed user reports chat disabled', rows.every((r) => r.subscription.chat_enabled === false));

    /* ---------------------------------------------------------------- */
    section('Requirement -> Application -> Notification (TEST: application flow)');

    const reqRes = await request('POST', '/api/requirements', {
      token: company.token,
      body: {
        category: 'Cinematographer',
        city: 'Mumbai',
        state: 'MH',
        quantity: 1,
        event_type: 'Wedding',
        number_of_days: 2,
        event_date: iso(30),
        end_date: iso(32),
        description: 'E2E test requirement',
        payment_per_freelancer: 25000,
        status: 'published'
      }
    });
    const requirementId =
      reqRes.data?.requirementId || reqRes.data?.data?.id || reqRes.data?.id;
    if (requirementId) created.requirementIds.push(requirementId);
    check('Company created a requirement', Boolean(requirementId), JSON.stringify(reqRes.data).slice(0, 160));

    const applyRes = await request('POST', '/api/applications', {
      token: freelancer.token,
      body: { requirement_id: requirementId, proposed_rate: '25000', availability: 'Available', message: 'E2E application' }
    });
    check('Freelancer applied to requirement', applyRes.status === 201, JSON.stringify(applyRes.data).slice(0, 160));
    const applicationId = applyRes.data?.data?.id || applyRes.data?.data?._id;

    const dupApply = await request('POST', '/api/applications', {
      token: freelancer.token,
      body: { requirement_id: requirementId, proposed_rate: '1', availability: 'x', message: 'dup' }
    });
    check('Duplicate application blocked', dupApply.status === 400);

    const companyNotifs = await request('GET', '/api/notifications', { token: company.token });
    const hasNewApp = (companyNotifs.data?.data || []).some((n) => n.type === 'new_application');
    check('Company received "new_application" notification', hasNewApp);

    const unread = await request('GET', '/api/notifications/unread-count', { token: company.token });
    check('Unread count > 0 for company', (unread.data?.count || 0) > 0);

    /* ---------------------------------------------------------------- */
    section('Application review -> shortlist -> accept');

    const shortlist = await request('PATCH', `/api/applications/${applicationId}/status`, {
      token: company.token,
      body: { status: 'shortlisted' }
    });
    check('Company shortlisted the application', shortlist.status === 200);

    const accept = await request('PATCH', `/api/applications/${applicationId}/status`, {
      token: company.token,
      body: { status: 'accepted' }
    });
    check('Company accepted the application', accept.status === 200);

    const freelancerNotifs = await request('GET', '/api/notifications', { token: freelancer.token });
    const types = (freelancerNotifs.data?.data || []).map((n) => n.type);
    check('Freelancer got "application_shortlisted"', types.includes('application_shortlisted'));
    check('Freelancer got "application_accepted"', types.includes('application_accepted'));

    /* ---------------------------------------------------------------- */
    section('Conversation opens WITHOUT a subscription (messages stay locked)');

    const convRes = await request('POST', '/api/chat/conversations', {
      token: freelancer.token,
      body: { company_id: company.id, freelancer_id: freelancer.id, requirement_id: requirementId }
    });
    check('Conversation created with no subscription on either side', [200, 201].includes(convRes.status),
      `status ${convRes.status} ${JSON.stringify(convRes.data).slice(0, 140)}`);
    const conversationId = convRes.data?.id || convRes.data?._id;
    check('Conversation reports is_locked = true', convRes.data?.is_locked === true);

    const convDup = await request('POST', '/api/chat/conversations', {
      token: company.token,
      body: { company_id: company.id, freelancer_id: freelancer.id }
    });
    const dupId = convDup.data?.id || convDup.data?._id;
    check('Duplicate conversation NOT created (same id returned)', String(dupId) === String(conversationId));

    const lockedMsgs = await request('GET', `/api/chat/conversations/${conversationId}/messages`, { token: freelancer.token });
    check('Messages locked -> 403 SUBSCRIPTION_REQUIRED', lockedMsgs.status === 403 && lockedMsgs.data?.code === 'SUBSCRIPTION_REQUIRED');

    const lockedSend = await socketSend(freelancer.token, conversationId, 'should be blocked');
    check('Socket send blocked while unsubscribed', lockedSend.success === false && lockedSend.code === 'SUBSCRIPTION_REQUIRED',
      JSON.stringify(lockedSend).slice(0, 140));

    /* ---------------------------------------------------------------- */
    section('TEST 3: Company EXPIRED / Freelancer ACTIVE -> chat locked');

    const freelancerSub = await request('POST', '/api/admin/subscriptions', {
      token: admin.token,
      body: { user_id: freelancer.id, planId: PREMIUM.id, start_date: iso(0), end_date: iso(30) }
    });
    check('Admin assigned PREMIUM to freelancer', freelancerSub.status === 201, JSON.stringify(freelancerSub.data).slice(0, 140));
    check('Freelancer subscription is ACTIVE with chat', freelancerSub.data?.subscription?.status === 'active' && freelancerSub.data?.subscription?.chat_enabled === true);

    const oneSided = await request('GET', `/api/chat/conversations/${conversationId}/messages`, { token: freelancer.token });
    check('Chat still locked (company has no subscription)', oneSided.status === 403 && oneSided.data?.code === 'SUBSCRIPTION_REQUIRED');
    check('Lock detail names the company as the blocker', oneSided.data?.details?.company_has_chat === false && oneSided.data?.details?.freelancer_has_chat === true);

    const oneSidedSend = await socketSend(freelancer.token, conversationId, 'still blocked');
    check('Socket send still blocked with one side unsubscribed', oneSidedSend.success === false);

    const lockedNotif = await request('GET', '/api/notifications', { token: company.token });
    check('Company received "locked_message" notification', (lockedNotif.data?.data || []).some((n) => n.type === 'locked_message'));

    /* ---------------------------------------------------------------- */
    section('TEST 1 / 4 / 5: both ACTIVE -> chat works');

    const companySub = await request('POST', '/api/admin/subscriptions', {
      token: admin.token,
      body: { user_id: company.id, planId: PRO.id, start_date: iso(0), end_date: iso(30) }
    });
    check('Admin assigned PRO to company', companySub.status === 201);
    const companySubId = companySub.data?.data?.id || companySub.data?.data?._id;

    const bothActive = await request('GET', `/api/chat/conversations/${conversationId}/messages`, { token: freelancer.token });
    check('Messages readable once both are ACTIVE', bothActive.status === 200, `status ${bothActive.status}`);

    const send1 = await socketSend(company.token, conversationId, 'Hello from company (E2E)');
    check('Company can send a message', send1.success === true, JSON.stringify(send1).slice(0, 140));

    const send2 = await socketSend(freelancer.token, conversationId, 'Hello from freelancer (E2E)');
    check('Freelancer can send a message', send2.success === true);

    const msgs = await request('GET', `/api/chat/conversations/${conversationId}/messages`, { token: company.token });
    check('Both messages persisted', (msgs.data || []).length === 2, `got ${(msgs.data || []).length}`);

    const msgNotif = await request('GET', '/api/notifications', { token: company.token });
    // Chat messages intentionally do NOT create a system notification; unread
    // state lives on the conversation instead (see npm run test:chat-unread).
    check('Chat message did NOT create a system notification',
      !(msgNotif.data?.data || []).some((n) => n.type === 'new_message'));
    const unreadConvs = await request('GET', '/api/chat/conversations', { token: company.token });
    const thisConv = (unreadConvs.data || []).find((c) => String(c._id) === String(conversationId));
    check('Conversation exposes an unread_count field instead',
      typeof thisConv?.unread_count === 'number', `got ${typeof thisConv?.unread_count}`);

    const convList = await request('GET', '/api/chat/conversations', { token: company.token });
    const conv = (convList.data || []).find((c) => String(c._id) === String(conversationId));
    check('Conversation reports is_locked = false when both active', conv?.is_locked === false);

    /* ---------------------------------------------------------------- */
    section('TEST 7: change plan -> feature access follows the new plan');

    const toFree = await request('PUT', `/api/admin/subscriptions/${companySubId}/plan`, {
      token: admin.token,
      body: { planId: FREE.id }
    });
    check('Admin changed company plan to FREE', toFree.status === 200);
    check('Summary now reports chat disabled', toFree.data?.subscription?.chat_enabled === false);

    const afterPlanChange = await request('GET', `/api/chat/conversations/${conversationId}/messages`, { token: company.token });
    check('Chat locked after downgrade to FREE', afterPlanChange.status === 403);

    const backToPro = await request('PUT', `/api/admin/subscriptions/${companySubId}/plan`, {
      token: admin.token,
      body: { planId: PRO.id }
    });
    check('Admin changed company plan back to PRO', backToPro.status === 200 && backToPro.data?.subscription?.chat_enabled === true);

    const afterUpgrade = await request('GET', `/api/chat/conversations/${conversationId}/messages`, { token: company.token });
    check('Chat unlocked again after upgrade', afterUpgrade.status === 200);

    /* ---------------------------------------------------------------- */
    section('TEST 6 / 11: expire subscription -> locked, messages NOT deleted');

    const expire = await request('PUT', `/api/admin/subscriptions/${companySubId}/status`, {
      token: admin.token,
      body: { status: 'expired' }
    });
    check('Admin expired the company subscription', expire.status === 200 && expire.data?.subscription?.status === 'expired');

    const afterExpire = await request('GET', `/api/chat/conversations/${conversationId}/messages`, { token: company.token });
    check('Chat locked after expiry', afterExpire.status === 403);

    const Message = (await import('../models/Message.js')).default;
    const survived = await Message.countDocuments({ conversation_id: conversationId });
    check('Existing messages were NOT deleted', survived === 2, `found ${survived}`);

    /* ---------------------------------------------------------------- */
    section('TEST 9 / 12: extend -> reactivates, history accessible again');

    const extend = await request('PUT', `/api/admin/subscriptions/${companySubId}/extend`, {
      token: admin.token,
      body: { days: 30 }
    });
    check('Admin extended the expired subscription', extend.status === 200);
    check('Subscription reactivated to ACTIVE', extend.data?.subscription?.status === 'active');
    check('Chat access restored in summary', extend.data?.subscription?.chat_enabled === true);

    const afterExtend = await request('GET', `/api/chat/conversations/${conversationId}/messages`, { token: company.token });
    check('Previous messages accessible again after renewal', afterExtend.status === 200 && (afterExtend.data || []).length === 2);

    /* ---------------------------------------------------------------- */
    section('TEST 8: cancel subscription -> protected features unavailable');

    const cancel = await request('PUT', `/api/admin/subscriptions/${companySubId}/status`, {
      token: admin.token,
      body: { status: 'cancelled' }
    });
    check('Admin cancelled the company subscription', cancel.status === 200 && cancel.data?.subscription?.status === 'cancelled');

    const afterCancel = await request('GET', `/api/chat/conversations/${conversationId}/messages`, { token: company.token });
    check('Chat locked after cancellation', afterCancel.status === 403);

    const reactivateBlocked = await request('PUT', `/api/admin/subscriptions/${companySubId}/status`, {
      token: admin.token,
      body: { status: 'active' }
    });
    check('Reactivating a still-dated subscription works', reactivateBlocked.status === 200,
      JSON.stringify(reactivateBlocked.data).slice(0, 140));

    /* ---------------------------------------------------------------- */
    section('Pause + self-service subscription endpoint');

    const pause = await request('PUT', `/api/admin/subscriptions/${companySubId}/status`, {
      token: admin.token,
      body: { status: 'paused' }
    });
    check('Admin paused the subscription', pause.status === 200 && pause.data?.subscription?.status === 'paused');

    const pausedChat = await request('GET', `/api/chat/conversations/${conversationId}/messages`, { token: company.token });
    check('Chat locked while PAUSED', pausedChat.status === 403);

    await request('PUT', `/api/admin/subscriptions/${companySubId}/status`, { token: admin.token, body: { status: 'active' } });

    const mySub = await request('GET', '/api/subscriptions/me', { token: company.token });
    check('Company can read its own subscription', mySub.status === 200 && mySub.data?.data?.plan_name === 'PRO');
    check('Own subscription reports chat_enabled', mySub.data?.data?.chat_enabled === true);
    check('Own subscription exposes expiry date', Boolean(mySub.data?.data?.end_date));

    const chatAccess = await request('GET', `/api/subscriptions/chat-access/${freelancer.id}`, { token: company.token });
    check('chat-access endpoint reports allowed', chatAccess.status === 200 && chatAccess.data?.data?.allowed === true);

    /* ---------------------------------------------------------------- */
    section('Booking request flow + notifications');

    const booking = await request('POST', '/api/booking-requests', {
      token: company.token,
      body: { freelancer_id: freelancer.id }
    });
    check('Company sent a booking request', booking.status === 201, JSON.stringify(booking.data).slice(0, 140));
    const bookingId = booking.data?.requestId;

    const dupBooking = await request('POST', '/api/booking-requests', {
      token: company.token,
      body: { freelancer_id: freelancer.id }
    });
    check('Duplicate pending booking request blocked', dupBooking.status === 400 && dupBooking.data?.code === 'DUPLICATE_BOOKING_REQUEST');

    const bookingNotifs = await request('GET', '/api/notifications', { token: freelancer.token });
    check('Freelancer received "new_booking_request" notification',
      (bookingNotifs.data?.data || []).some((n) => n.type === 'new_booking_request'));

    const freelancerBookings = await request('GET', '/api/booking-requests/freelancer', { token: freelancer.token });
    const found = (freelancerBookings.data?.data || []).find((b) => String(b.id) === String(bookingId));
    check('Booking request visible to freelancer', Boolean(found));
    check('Fixed booking message preserved', found?.message?.startsWith('Hi, we’re interested in connecting'));

    const acceptBooking = await request('PUT', `/api/booking-requests/${bookingId}/status`, {
      token: freelancer.token,
      body: { status: 'accepted' }
    });
    check('Freelancer accepted the booking request', acceptBooking.status === 200);

    const acceptNotifs = await request('GET', '/api/notifications', { token: company.token });
    check('Company received "booking_request_accepted" notification',
      (acceptNotifs.data?.data || []).some((n) => n.type === 'booking_request_accepted'));

    const Conversation = (await import('../models/Conversation.js')).default;
    const convCount = await Conversation.countDocuments({ company_id: company.id, freelancer_id: freelancer.id });
    check('Booking acceptance did NOT duplicate the conversation', convCount === 1, `found ${convCount}`);

    // Decline path on a second booking request
    const booking2 = await request('POST', '/api/booking-requests', {
      token: company.token,
      body: { freelancer_id: freelancer.id }
    });
    const booking2Id = booking2.data?.requestId;
    const declineBooking = await request('PUT', `/api/booking-requests/${booking2Id}/status`, {
      token: freelancer.token,
      body: { status: 'declined' }
    });
    check('Freelancer declined a booking request', declineBooking.status === 200);
    const declineNotifs = await request('GET', '/api/notifications', { token: company.token });
    check('Company received "booking_request_rejected" notification',
      (declineNotifs.data?.data || []).some((n) => n.type === 'booking_request_rejected'));

    /* ---------------------------------------------------------------- */
    section('Notification read state');

    const list = await request('GET', '/api/notifications', { token: company.token });
    const first = list.data?.data?.[0];
    const markRead = await request('PATCH', `/api/notifications/${first.id}/read`, { token: company.token });
    check('Notification can be marked read', markRead.status === 200 && markRead.data?.data?.is_read === true);

    const readAll = await request('PATCH', '/api/notifications/read-all', { token: company.token });
    check('Mark-all-as-read works', readAll.status === 200);
    const zero = await request('GET', '/api/notifications/unread-count', { token: company.token });
    check('Unread count is 0 after read-all', zero.data?.count === 0);

    /* ---------------------------------------------------------------- */
    section('Authorization guards');

    const outsider = await register('freelancer', 'outsider');
    created.userIds.push(outsider.id);

    const peek = await request('GET', `/api/chat/conversations/${conversationId}/messages`, { token: outsider.token });
    check('Non-participant cannot read the conversation', peek.status === 403 && peek.data?.code === 'FORBIDDEN');

    const peekSend = await socketSend(outsider.token, conversationId, 'intruder');
    check('Non-participant cannot send via socket', peekSend.success === false && peekSend.code === 'FORBIDDEN');

    const noAuth = await request('GET', '/api/subscriptions/me');
    check('Unauthenticated request rejected', noAuth.status === 401);

    const badConv = await request('POST', '/api/chat/conversations', {
      token: outsider.token,
      body: { company_id: company.id, freelancer_id: outsider.id }
    });
    check('Conversation without accepted app/booking rejected', badConv.status === 403 && badConv.data?.code === 'CHAT_NOT_UNLOCKED');
  } catch (err) {
    crashed = err;
    console.log(`
  !! SUITE ABORTED: ${err.message}`);
  } finally {
    /* ---------------------------------------------------------------- */
    section('Cleanup');
    const User = (await import('../models/User.js')).default;
    const Subscription = (await import('../models/Subscription.js')).default;
    const Notification = (await import('../models/Notification.js')).default;
    const Conversation = (await import('../models/Conversation.js')).default;
    const Message = (await import('../models/Message.js')).default;
    const Application = (await import('../models/Application.js')).default;
    const BookingRequest = (await import('../models/BookingRequest.js')).default;
    const Requirement = (await import('../models/Requirement.js')).default;

    // Admins are preserved so the same throwaway admin can be reused across runs.
    const testUsers = await User.find({
      email: new RegExp(`${TAG.replace('.', '\\.')}$`),
      role: { $ne: 'admin' }
    }).select('_id');
    const ids = testUsers.map((u) => u._id);

    if (ids.length) {
      const convs = await Conversation.find({ $or: [{ company_id: { $in: ids } }, { freelancer_id: { $in: ids } }] }).select('_id');
      await Message.deleteMany({ conversation_id: { $in: convs.map((c) => c._id) } });
      await Conversation.deleteMany({ _id: { $in: convs.map((c) => c._id) } });
      await Notification.deleteMany({ $or: [{ recipient_id: { $in: ids } }, { sender_id: { $in: ids } }] });
      await Application.deleteMany({ $or: [{ freelancer_id: { $in: ids } }, { company_id: { $in: ids } }] });
      await BookingRequest.deleteMany({ $or: [{ freelancer_id: { $in: ids } }, { company_id: { $in: ids } }] });
      await Requirement.deleteMany({ company_id: { $in: ids } });
      await Subscription.deleteMany({ user_id: { $in: ids } });
      await User.deleteMany({ _id: { $in: ids } });
      console.log(`  Removed ${ids.length} throwaway account(s) and all their data.`);
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log(`RESULT: ${pass} passed, ${fail} failed${crashed ? ' (ABORTED EARLY)' : ''}`);
    if (failures.length) {
      console.log('\nFailures:');
      failures.forEach((f) => console.log(`  - ${f}`));
    }
    console.log('='.repeat(60));

    await mongoose.connection.close();
    process.exit(fail === 0 && !crashed ? 0 : 1);
  }
};

run().catch(async (err) => {
  console.error('\nSuite crashed:', err.message);
  console.error(err.stack);
  try { await mongoose.connection.close(); } catch { /* ignore */ }
  process.exit(1);
});
