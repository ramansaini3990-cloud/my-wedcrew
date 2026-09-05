/**
 * End-to-end verification of chat-unread vs system-notification separation.
 *
 *   E2E_ADMIN_EMAIL=... E2E_ADMIN_PASSWORD=... npm run test:chat-unread
 *
 * Drives the real HTTP + Socket.IO API of a RUNNING backend through every case
 * in the change request, then deletes only the throwaway accounts it created
 * (emails ending in @e2e.local). Pre-existing data is never touched.
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
  let data = null;
  try { data = await res.json(); } catch { data = null; }
  return { status: res.status, data };
};

let phoneSeq = 0;
const register = async (role, label, extra = {}) => {
  phoneSeq += 1;
  const email = `cu.${label}.${STAMP}${TAG}`;
  const password = 'E2ePassw0rd!';
  const r = await request('POST', '/api/auth/register', {
    body: { role, name: `CU ${label}`, phone: `9${String(STAMP).slice(-8)}${phoneSeq}`.slice(0, 10), email, password, city: 'Mumbai', state: 'MH', ...extra }
  });
  if (r.status !== 201) throw new Error(`register ${label}: ${JSON.stringify(r.data)}`);
  const l = await request('POST', '/api/auth/login', { body: { email, password } });
  if (l.status !== 200) throw new Error(`login ${label}: ${JSON.stringify(l.data)}`);
  return { email, password, token: l.data.token, id: l.data.user.id, role };
};

const iso = (d) => { const x = new Date(); x.setDate(x.getDate() + d); return x.toISOString().slice(0, 10); };

/** Connects a socket and resolves once authenticated. */
const connectSocket = (token) =>
  new Promise((resolve, reject) => {
    const s = ioClient(API, { auth: { token }, transports: ['websocket'], timeout: 8000 });
    const t = setTimeout(() => reject(new Error('socket connect timeout')), 10000);
    s.on('connect', () => { clearTimeout(t); resolve(s); });
    s.on('connect_error', (e) => { clearTimeout(t); reject(e); });
  });

/** Sends via an already-connected socket and resolves with the ack. */
const send = (socket, conversationId, text) =>
  new Promise((resolve) => {
    const t = setTimeout(() => resolve({ timeout: true }), 10000);
    socket.emit('send_message', { conversationId, text, message: text }, (ack) => {
      clearTimeout(t); resolve(ack || {});
    });
  });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const unreadFor = async (token, conversationId) => {
  const r = await request('GET', '/api/chat/conversations', { token });
  const c = (r.data || []).find((x) => String(x._id || x.id) === String(conversationId));
  return c ? (c.unread_count ?? null) : null;
};

const notifUnread = async (token) => {
  const r = await request('GET', '/api/notifications/unread-count', { token });
  return r.data?.count ?? null;
};

const run = async () => {
  const adminEmail = process.env.E2E_ADMIN_EMAIL;
  const adminPassword = process.env.E2E_ADMIN_PASSWORD;
  if (!adminEmail || !adminPassword) { console.error('Set E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD'); process.exit(1); }

  const health = await request('GET', '/api/health');
  if (health.status !== 200) { console.error(`Backend not reachable at ${API}`); process.exit(1); }

  const al = await request('POST', '/api/auth/login', { body: { email: adminEmail, password: adminPassword } });
  if (al.status !== 200 || al.data.user.role !== 'admin') { console.error('Admin login failed'); process.exit(1); }
  const admin = { token: al.data.token };
  console.log(`Backend ${API} | admin ${adminEmail}`);

  await connectDB();
  const sockets = [];
  let crashed = null;

  try {
    section('Setup: 1 company + 2 freelancers, both subscribed, conversations unlocked');

    const company = await register('company', 'company');
    const freelancerA = await register('freelancer', 'freelancerA', { profession: 'Cinematographer' });
    const freelancerB = await register('freelancer', 'freelancerB', { profession: 'Photographer' });

    const plans = (await request('GET', '/api/admin/plans', { token: admin.token })).data || [];
    const PREMIUM = plans.find((p) => p.name === 'PREMIUM');
    check('PREMIUM plan available', Boolean(PREMIUM));

    for (const u of [company, freelancerA, freelancerB]) {
      const r = await request('POST', '/api/admin/subscriptions', {
        token: admin.token,
        body: { user_id: u.id, planId: PREMIUM.id, start_date: iso(0), end_date: iso(30) }
      });
      if (r.status !== 201) throw new Error(`subscribe ${u.role}: ${JSON.stringify(r.data)}`);
    }
    check('All three users subscribed with chat', true);

    // Booking accept unlocks each conversation (existing flow, unchanged).
    const convIds = {};
    for (const [key, f] of [['A', freelancerA], ['B', freelancerB]]) {
      const b = await request('POST', '/api/booking-requests', { token: company.token, body: { freelancer_id: f.id } });
      const bookingId = b.data?.requestId;
      const acc = await request('PUT', `/api/booking-requests/${bookingId}/status`, { token: f.token, body: { status: 'accepted' } });
      if (acc.status !== 200) throw new Error(`accept booking ${key}`);
      const conv = await request('POST', '/api/chat/conversations', {
        token: company.token, body: { company_id: company.id, freelancer_id: f.id }
      });
      convIds[key] = conv.data?.id || conv.data?._id;
    }
    check('Two separate conversations created', Boolean(convIds.A && convIds.B) && convIds.A !== convIds.B);

    // Baselines AFTER booking notifications already exist.
    const companySocket = await connectSocket(company.token);
    const freelancerASocket = await connectSocket(freelancerA.token);
    sockets.push(companySocket, freelancerASocket);

    const unreadEvents = [];
    freelancerASocket.on('conversation_unread', (p) => unreadEvents.push(p));
    const globalNotifEvents = [];
    freelancerASocket.on('new_notification', (n) => globalNotifEvents.push(n));

    const fNotifBase = await notifUnread(freelancerA.token);
    const cNotifBase = await notifUnread(company.token);
    check('Baseline notification counts captured', fNotifBase !== null && cNotifBase !== null,
      `freelancer=${fNotifBase} company=${cNotifBase}`);

    /* ------------------------------------------------------------ */
    section('TEST 1: Company -> Freelancer : no Notifications badge, conversation unread = 1');

    const s1 = await send(companySocket, convIds.A, 'Message one');
    check('Message sent successfully', s1.success === true, JSON.stringify(s1).slice(0, 120));
    await sleep(400);

    check('Freelancer conversation unread = 1', (await unreadFor(freelancerA.token, convIds.A)) === 1,
      `got ${await unreadFor(freelancerA.token, convIds.A)}`);
    const fNotifAfter1 = await notifUnread(freelancerA.token);
    check('Freelancer global notification count UNCHANGED', fNotifAfter1 === fNotifBase,
      `base=${fNotifBase} after=${fNotifAfter1}`);

    const notifList = await request('GET', '/api/notifications', { token: freelancerA.token });
    check('No "new_message" item in Notifications list',
      !(notifList.data?.data || []).some((n) => n.type === 'new_message'));
    check('conversation_unread socket event received', unreadEvents.length >= 1,
      JSON.stringify(unreadEvents).slice(0, 120));
    check('Socket event carries the correct conversation + count',
      unreadEvents.some((e) => String(e.conversationId) === String(convIds.A) && e.unreadCount === 1));
    check('No global new_notification emitted for the chat message', globalNotifEvents.length === 0,
      `got ${globalNotifEvents.length}`);

    /* ------------------------------------------------------------ */
    section('TEST 2: Freelancer -> Company : same behaviour in reverse');

    const s2 = await send(freelancerASocket, convIds.A, 'Reply from freelancer');
    check('Reply sent', s2.success === true);
    await sleep(400);
    check('Company conversation unread = 1', (await unreadFor(company.token, convIds.A)) === 1,
      `got ${await unreadFor(company.token, convIds.A)}`);
    const cNotifAfter = await notifUnread(company.token);
    check('Company global notification count UNCHANGED', cNotifAfter === cNotifBase,
      `base=${cNotifBase} after=${cNotifAfter}`);

    /* ------------------------------------------------------------ */
    section('TEST 3: three more messages -> unread increments to 3');

    await send(companySocket, convIds.A, 'Message two');
    await send(companySocket, convIds.A, 'Message three');
    await sleep(500);
    check('Freelancer unread = 3', (await unreadFor(freelancerA.token, convIds.A)) === 3,
      `got ${await unreadFor(freelancerA.token, convIds.A)}`);
    const fNotif3 = await notifUnread(freelancerA.token);
    check('Global notification count STILL unchanged after 3 messages', fNotif3 === fNotifBase,
      `base=${fNotifBase} after=${fNotif3}`);

    /* ------------------------------------------------------------ */
    section('TEST 6: message to conversation B only affects B');

    await send(companySocket, convIds.B, 'Hello freelancer B');
    await sleep(400);
    check('Conversation A unread still 3 for freelancer A', (await unreadFor(freelancerA.token, convIds.A)) === 3);
    check('Freelancer A sees nothing for conversation B (not a participant)',
      (await unreadFor(freelancerA.token, convIds.B)) === null);
    check('Freelancer B unread = 1', (await unreadFor(freelancerB.token, convIds.B)) === 1,
      `got ${await unreadFor(freelancerB.token, convIds.B)}`);

    /* ------------------------------------------------------------ */
    section('TEST 4: opening the conversation resets only that conversation');

    const open = await request('GET', `/api/chat/conversations/${convIds.A}/messages`, { token: freelancerA.token });
    check('Messages load on open', open.status === 200 && Array.isArray(open.data));
    check('Conversation A unread reset to 0', (await unreadFor(freelancerA.token, convIds.A)) === 0,
      `got ${await unreadFor(freelancerA.token, convIds.A)}`);
    check('Opening A did NOT clear B (different user, still 1)',
      (await unreadFor(freelancerB.token, convIds.B)) === 1);

    /* ------------------------------------------------------------ */
    section('TEST 5: message arriving while the conversation is open stays at 0');

    await send(companySocket, convIds.A, 'While you are watching');
    await sleep(400);
    check('Server-side unread became 1 before the client acknowledges',
      (await unreadFor(freelancerA.token, convIds.A)) === 1);
    const readRes = await request('PATCH', `/api/chat/conversations/${convIds.A}/read`, { token: freelancerA.token });
    check('mark-read endpoint responds', readRes.status === 200 && readRes.data?.unread_count === 0,
      JSON.stringify(readRes.data).slice(0, 120));
    check('Unread back to 0 (what the open UI does automatically)',
      (await unreadFor(freelancerA.token, convIds.A)) === 0);

    /* ------------------------------------------------------------ */
    section('TEST 7 / 8: persistence across refresh and fresh login');

    await send(companySocket, convIds.A, 'Persisted one');
    await send(companySocket, convIds.A, 'Persisted two');
    await sleep(500);
    check('Unread = 2 before refresh', (await unreadFor(freelancerA.token, convIds.A)) === 2,
      `got ${await unreadFor(freelancerA.token, convIds.A)}`);

    // "Refresh" = a brand-new request with the same token.
    check('Unread survives page refresh', (await unreadFor(freelancerA.token, convIds.A)) === 2);

    // "Logout / login" = discard the token and authenticate again.
    const relogin = await request('POST', '/api/auth/login', {
      body: { email: freelancerA.email, password: freelancerA.password }
    });
    check('Re-login succeeds', relogin.status === 200);
    check('Unread survives logout/login', (await unreadFor(relogin.data.token, convIds.A)) === 2,
      `got ${await unreadFor(relogin.data.token, convIds.A)}`);

    /* ------------------------------------------------------------ */
    section('TEST 12: socket reconnect + duplicate events do not double-count');

    freelancerASocket.disconnect();
    await sleep(300);
    const reconnected = await connectSocket(freelancerA.token);
    sockets.push(reconnected);
    await sleep(300);
    check('Unread unchanged after socket reconnect', (await unreadFor(freelancerA.token, convIds.A)) === 2,
      `got ${await unreadFor(freelancerA.token, convIds.A)}`);

    // Marking read twice must be idempotent.
    const first = await request('PATCH', `/api/chat/conversations/${convIds.A}/read`, { token: freelancerA.token });
    const second = await request('PATCH', `/api/chat/conversations/${convIds.A}/read`, { token: freelancerA.token });
    check('Repeated mark-read is idempotent', first.data?.unread_count === 0 && second.data?.unread_count === 0 && second.data?.marked === 0,
      `first=${first.data?.marked} second=${second.data?.marked}`);

    /* ------------------------------------------------------------ */
    section('Sender never accrues unread for their own message');

    // The company may already hold unread messages from the freelancer, so the
    // correct assertion is that SENDING does not change the sender's own count.
    const senderBefore = await unreadFor(company.token, convIds.A);
    const recipientBefore = await unreadFor(freelancerA.token, convIds.A);
    await send(companySocket, convIds.A, 'From company again');
    await sleep(400);
    const senderAfter = await unreadFor(company.token, convIds.A);
    const recipientAfter = await unreadFor(freelancerA.token, convIds.A);
    check('Sending does NOT increase the sender own unread', senderAfter === senderBefore,
      `before=${senderBefore} after=${senderAfter}`);
    check('Recipient unread increased by exactly 1', recipientAfter === recipientBefore + 1,
      `before=${recipientBefore} after=${recipientAfter}`);

    /* ------------------------------------------------------------ */
    section('TEST 9 / 10: booking notifications still reach the Notifications sidebar');

    const freelancerC = await register('freelancer', 'freelancerC', { profession: 'Video Editor' });
    const b2 = await request('POST', '/api/booking-requests', { token: company.token, body: { freelancer_id: freelancerC.id } });
    const dec = await request('PUT', `/api/booking-requests/${b2.data.requestId}/status`, { token: freelancerC.token, body: { status: 'declined' } });
    check('Booking declined', dec.status === 200);

    const cNotifs = await request('GET', '/api/notifications', { token: company.token });
    const cTypes = (cNotifs.data?.data || []).map((n) => n.type);
    check('"booking_request_accepted" still in Notifications', cTypes.includes('booking_request_accepted'));
    check('"booking_request_rejected" still in Notifications', cTypes.includes('booking_request_rejected'));
    const fbNotifs = await request('GET', '/api/notifications', { token: freelancerC.token });
    check('"new_booking_request" still in Notifications',
      (fbNotifs.data?.data || []).map((n) => n.type).includes('new_booking_request'));
    check('Company notification unread count > 0 (system events still counted)',
      (await notifUnread(company.token)) > 0);

    /* ------------------------------------------------------------ */
    section('TEST 11: subscription chat-lock unchanged');

    const subs = await request('GET', `/api/admin/subscriptions/user/${freelancerA.id}`, { token: admin.token });
    const subId = subs.data?.current?.subscription_id;
    await request('PUT', `/api/admin/subscriptions/${subId}/status`, { token: admin.token, body: { status: 'cancelled' } });

    const locked = await request('GET', `/api/chat/conversations/${convIds.A}/messages`, { token: freelancerA.token });
    check('Chat locks when a subscription is cancelled',
      locked.status === 403 && locked.data?.code === 'SUBSCRIPTION_REQUIRED');

    const blocked = await send(companySocket, convIds.A, 'should be blocked');
    check('Sending blocked while locked', blocked.success === false && blocked.code === 'SUBSCRIPTION_REQUIRED');

    const lockedNotifs = await request('GET', '/api/notifications', { token: freelancerA.token });
    check('"locked_message" subscription prompt still delivered',
      (lockedNotifs.data?.data || []).some((n) => n.type === 'locked_message'));

    const convList = await request('GET', '/api/chat/conversations', { token: freelancerA.token });
    const lockedConv = (convList.data || []).find((c) => String(c._id) === String(convIds.A));
    check('Locked conversation still visible with is_locked = true', lockedConv?.is_locked === true);

    const Message = (await import('../models/Message.js')).default;
    check('Messages NOT deleted while locked',
      (await Message.countDocuments({ conversation_id: convIds.A })) > 0);
  } catch (err) {
    crashed = err;
    console.log(`\n  !! ABORTED: ${err.message}`);
  } finally {
    section('Cleanup');
    for (const s of sockets) { try { s.close(); } catch { /* ignore */ } }

    const User = (await import('../models/User.js')).default;
    const Subscription = (await import('../models/Subscription.js')).default;
    const Notification = (await import('../models/Notification.js')).default;
    const Conversation = (await import('../models/Conversation.js')).default;
    const Message = (await import('../models/Message.js')).default;
    const BookingRequest = (await import('../models/BookingRequest.js')).default;
    const EmailLog = (await import('../models/EmailLog.js')).default;
    const ActivityLog = (await import('../models/ActivityLog.js')).default;

    const testUsers = await User.find({ email: new RegExp(`${TAG.replace('.', '\\.')}$`), role: { $ne: 'admin' } }).select('_id');
    const ids = testUsers.map((u) => u._id);
    if (ids.length) {
      const convs = await Conversation.find({ $or: [{ company_id: { $in: ids } }, { freelancer_id: { $in: ids } }] }).select('_id');
      await Message.deleteMany({ conversation_id: { $in: convs.map((c) => c._id) } });
      await Conversation.deleteMany({ _id: { $in: convs.map((c) => c._id) } });
      await Notification.deleteMany({ $or: [{ recipient_id: { $in: ids } }, { sender_id: { $in: ids } }] });
      await BookingRequest.deleteMany({ $or: [{ freelancer_id: { $in: ids } }, { company_id: { $in: ids } }] });
      await Subscription.deleteMany({ user_id: { $in: ids } });
      // Verification and reset mail sent to these accounts. No suite cleaned
      // this up, so every run left its email-log rows behind for good.
      await EmailLog.deleteMany({ user_id: { $in: ids } });
      // Both sides: entries this account CAUSED, and entries where it was the
      // subject of somebody else's action (an admin verifying it, say).
      await ActivityLog.deleteMany({
        $or: [{ 'actor.user_id': { $in: ids } }, { 'target.id': { $in: ids } }]
      });
      await User.deleteMany({ _id: { $in: ids } });
      console.log(`  Removed ${ids.length} throwaway account(s) and their data.`);
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log(`RESULT: ${pass} passed, ${fail} failed${crashed ? ' (ABORTED EARLY)' : ''}`);
    if (failures.length) { console.log('\nFailures:'); failures.forEach((f) => console.log('  - ' + f)); }
    console.log('='.repeat(60));

    await mongoose.connection.close();
    process.exit(fail === 0 && !crashed ? 0 : 1);
  }
};

run();
