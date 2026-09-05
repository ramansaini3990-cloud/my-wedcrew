/**
 * Verifies the payment system end to end.
 *
 *   E2E_ADMIN_EMAIL=... E2E_ADMIN_PASSWORD=... npm run test:payment
 *
 * Runs against the sandbox provider adapter, so the online flow - including a
 * signed webhook - is exercised for real without touching live money. Money
 * assertions check exact integer paise; authorisation assertions check that
 * one company/freelancer can never see another's financial data.
 *
 * Every throwaway account and its financial records are removed at the end.
 */
import crypto from 'crypto';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import connectDB from '../config/database.js';

dotenv.config();

const API = process.env.API_URL || 'http://localhost:5000';
const STAMP = Date.now();
const TAG = '@e2e.local';
const PASS = 'Payment@2026';
const SANDBOX_SECRET = process.env.SANDBOX_PAYMENT_SECRET || 'sandbox-secret';

let pass = 0, fail = 0;
const failures = [];
const check = (name, ok, detail = '') => {
  if (ok) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; failures.push(name + (detail ? ' :: ' + detail : '')); console.log(`  FAIL  ${name}${detail ? '  -> ' + detail : ''}`); }
};
const section = (t) => console.log(`\n=== ${t} ===`);

const request = async (method, path, { token, body, headers = {} } = {}) => {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  let data = null; let raw = '';
  try { raw = await res.text(); data = JSON.parse(raw); } catch { /* non-JSON */ }
  return { status: res.status, data, raw };
};

/** Posts a webhook exactly as the provider would, with a real HMAC signature. */
const sendWebhook = async (payload, { badSignature = false } = {}) => {
  const raw = JSON.stringify(payload);
  const signature = crypto.createHmac('sha256', SANDBOX_SECRET).update(raw).digest('hex');
  const res = await fetch(`${API}/api/payments/webhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-webhook-signature': badSignature ? 'deadbeef' : signature },
    body: raw
  });
  return { status: res.status, data: await res.json().catch(() => null) };
};

let phoneSeq = 0;
const register = async (role, label, extra = {}) => {
  phoneSeq += 1;
  const email = `pay.${label}.${STAMP}${TAG}`;
  const phone = `9${String(STAMP).slice(-8)}${phoneSeq}`.slice(0, 10);
  const r = await request('POST', '/api/auth/register', {
    body: { role, name: `PAY ${label}`, phone, email, password: PASS, ...extra }
  });
  if (r.status !== 201) return { failed: r };
  const l = await request('POST', '/api/auth/login', { body: { email, password: PASS } });
  return { email, phone, token: l.data.token, id: l.data.user.id, role, name: `PAY ${label}` };
};

const iso = (d) => { const x = new Date(); x.setDate(x.getDate() + d); return x.toISOString().slice(0, 10); };

/** Connects a company and freelancer through the existing booking flow. */
const connect = async (company, freelancer) => {
  const b = await request('POST', '/api/booking-requests', { token: company.token, body: { freelancer_id: freelancer.id } });
  await request('PUT', `/api/booking-requests/${b.data.requestId}/status`, { token: freelancer.token, body: { status: 'accepted' } });
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

  try {
    const company = await register('company', 'company');
    const freelancer = await register('freelancer', 'freelancer', { profession: 'Cinematographer', city: 'Jaipur' });
    const otherCompany = await register('company', 'other');
    const otherFreelancer = await register('freelancer', 'otherfl', { profession: 'Drone Pilot' });
    if (company.failed || freelancer.failed || otherCompany.failed || otherFreelancer.failed) throw new Error('Registration failed');

    await connect(company, freelancer);
    await connect(otherCompany, otherFreelancer);

    /* -------------------------------------------------------------- */
    section('1-3. Access control');

    check('1. Company can open Payments', (await request('GET', '/api/payments', { token: company.token })).status === 200);
    check('2. Freelancer can open Earnings', (await request('GET', '/api/earnings', { token: freelancer.token })).status === 200);
    check('3. Admin can open Finance', (await request('GET', '/api/admin/finance/overview', { token: admin.token })).status === 200);
    check('3. Non-admin blocked from Finance',
      (await request('GET', '/api/admin/finance/overview', { token: company.token })).status === 403);
    check('3. Anonymous blocked everywhere', (await request('GET', '/api/payments')).status === 401);
    check('3. Company has no Earnings', (await request('GET', '/api/earnings', { token: company.token })).status === 403);

    /* -------------------------------------------------------------- */
    section('17. Platform fee is configured, not hardcoded');

    await request('PUT', '/api/admin/finance/settings', { token: admin.token, body: { fee_bps: 1000 } });
    const cfg = await request('GET', '/api/payments/config', { token: company.token });
    check('17. Config exposes the fee', cfg.data?.data?.fee_bps === 1000, String(cfg.data?.data?.fee_bps));
    check('17. Config never leaks a secret',
      !cfg.raw.includes('SECRET') && !cfg.raw.includes('key_secret') && !cfg.raw.includes('webhook'),
      cfg.raw.slice(0, 120));

    /* -------------------------------------------------------------- */
    section('5-6. Creating payments, and duplicate prevention');

    const cash = await request('POST', '/api/payments', {
      token: company.token,
      body: { freelancer_id: freelancer.id, amount: '20000', method: 'cash' }
    });
    check('5. Cash payment created', cash.status === 201, JSON.stringify(cash.data).slice(0, 120));
    check('11. Cash starts at CASH_PENDING', cash.data?.data?.status === 'CASH_PENDING');
    check('17. Fee is 10% of ₹20,000 = ₹2,000', cash.data?.data?.fee_paise === 200000, String(cash.data?.data?.fee_paise));
    check('17. Net is ₹18,000', cash.data?.data?.net_paise === 1800000, String(cash.data?.data?.net_paise));
    check('8. fee + net === gross exactly',
      cash.data.data.fee_paise + cash.data.data.net_paise === cash.data.data.amount_paise);

    const key = `idem-${STAMP}`;
    const first = await request('POST', '/api/payments', {
      token: company.token, headers: { 'Idempotency-Key': key },
      body: { freelancer_id: freelancer.id, amount: '5000', method: 'cash' }
    });
    const second = await request('POST', '/api/payments', {
      token: company.token, headers: { 'Idempotency-Key': key },
      body: { freelancer_id: freelancer.id, amount: '5000', method: 'cash' }
    });
    check('6. Duplicate request is idempotent', second.data?.idempotent_replay === true, `status ${second.status}`);
    check('6. Same payment returned, not a second one', second.data?.data?.id === first.data?.data?.id);

    const Payment = (await import('../models/Payment.js')).default;
    check('6. Only ONE payment row for that key',
      (await Payment.countDocuments({ company_id: company.id, idempotency_key: key })) === 1);

    const notConnected = await request('POST', '/api/payments', {
      token: company.token, body: { freelancer_id: otherFreelancer.id, amount: '1000', method: 'cash' }
    });
    check('Payment to an UNconnected professional is refused', notConnected.status === 403, `status ${notConnected.status}`);

    const badAmount = await request('POST', '/api/payments', {
      token: company.token, body: { freelancer_id: freelancer.id, amount: '-500', method: 'cash' }
    });
    check('Negative amount rejected', badAmount.status === 400);

    /* -------------------------------------------------------------- */
    section('12-15. Cash confirm, dispute, admin resolution');

    const confirm = await request('POST', `/api/payments/${cash.data.data.id}/cash-confirm`, { token: freelancer.token });
    check('12. Freelancer can confirm cash', confirm.status === 200 && confirm.data?.data?.status === 'CASH_CONFIRMED');

    const reconfirm = await request('POST', `/api/payments/${cash.data.data.id}/cash-confirm`, { token: freelancer.token });
    check('12. Confirming twice is refused', reconfirm.status === 409, `status ${reconfirm.status}`);

    const wrongUser = await request('POST', `/api/payments/${first.data.data.id}/cash-confirm`, { token: otherFreelancer.token });
    check('4. Another freelancer cannot confirm it', wrongUser.status === 404, `status ${wrongUser.status}`);

    const earnings1 = await request('GET', '/api/earnings', { token: freelancer.token });
    check('16. Earnings credited the NET amount', earnings1.data?.data?.balance?.total_earned === 1800000,
      String(earnings1.data?.data?.balance?.total_earned));
    check('16. Available equals net earned', earnings1.data?.data?.balance?.available === 1800000);
    check('16. Platform fee recorded', earnings1.data?.data?.balance?.platform_fees === 200000);

    const dispute = await request('POST', `/api/payments/${first.data.data.id}/cash-dispute`, {
      token: freelancer.token, body: { reason: 'Cash was never handed over' }
    });
    check('13. Freelancer can dispute cash', dispute.status === 200 && dispute.data?.data?.status === 'CASH_DISPUTED');

    const disputes = await request('GET', '/api/admin/finance/disputes', { token: admin.token });
    check('14. Admin sees the dispute',
      (disputes.data?.data || []).some((d) => d.id === first.data.data.id));

    const balBefore = (await request('GET', '/api/earnings', { token: freelancer.token })).data.data.balance.total_earned;
    const resolved = await request('POST', `/api/admin/finance/disputes/${first.data.data.id}/resolve`, {
      token: admin.token, body: { resolution: 'CONFIRMED', note: 'Receipt verified' }
    });
    check('15. Admin can resolve the dispute', resolved.status === 200 && resolved.data?.data?.status === 'CASH_CONFIRMED');
    const balAfter = (await request('GET', '/api/earnings', { token: freelancer.token })).data.data.balance.total_earned;
    check('15. Resolution credited the freelancer', balAfter === balBefore + 450000, `${balBefore} -> ${balAfter}`);

    const notAdmin = await request('POST', `/api/payments/${cash.data.data.id}/cash-dispute`, {
      token: company.token, body: { reason: 'x' }
    });
    check('Company cannot dispute on the freelancer\'s behalf', notAdmin.status === 403);

    /* -------------------------------------------------------------- */
    section('7-10. Online payment + webhooks');

    const online = await request('POST', '/api/payments', {
      token: company.token, body: { freelancer_id: freelancer.id, amount: '10000', method: 'online' }
    });
    check('7. Online payment created', online.status === 201, JSON.stringify(online.data).slice(0, 140));
    check('7. Provider order opened', Boolean(online.data?.data?.provider_order_id));
    check('7. Starts PENDING, not paid', online.data?.data?.status === 'PENDING');
    check('7. Checkout config carries no secret',
      !JSON.stringify(online.data?.checkout || {}).toLowerCase().includes('secret'));

    const forged = await request('POST', `/api/payments/${online.data.data.id}/verify`, {
      token: company.token, body: { provider_payment_id: 'pay_forged', signature: 'not-a-real-signature' }
    });
    check('7. A forged client signature is refused', forged.status === 400, `status ${forged.status}`);
    const afterForge = await request('GET', `/api/payments/${online.data.data.id}`, { token: company.token });
    check('7. Forged attempt marked it FAILED, never SUCCESS', afterForge.data?.data?.status === 'FAILED');

    check('3. FAILED cannot jump to SUCCESS',
      (await request('POST', `/api/payments/${online.data.data.id}/refund`, { token: company.token })).status === 409);

    const online2 = await request('POST', '/api/payments', {
      token: company.token, body: { freelancer_id: freelancer.id, amount: '10000', method: 'online' }
    });
    const orderId = online2.data.data.provider_order_id;

    const unsigned = await sendWebhook({ event: 'payment.captured', id: `evt_${STAMP}_a`,
      payload: { payment: { entity: { id: `pay_${STAMP}`, order_id: orderId } } } }, { badSignature: true });
    check('9. Unsigned webhook rejected', unsigned.status === 400, `status ${unsigned.status}`);

    const captured = { event: 'payment.captured', id: `evt_${STAMP}_b`,
      payload: { payment: { entity: { id: `pay_${STAMP}`, order_id: orderId } } } };
    const hook1 = await sendWebhook(captured);
    check('9. Signed webhook accepted', hook1.status === 200, `status ${hook1.status}`);

    const afterHook = await request('GET', `/api/payments/${online2.data.data.id}`, { token: company.token });
    check('7. Webhook settled the payment', afterHook.data?.data?.status === 'SUCCESS', afterHook.data?.data?.status);

    const balAfterOnline = (await request('GET', '/api/earnings', { token: freelancer.token })).data.data.balance.total_earned;

    const hook2 = await sendWebhook(captured);
    check('10. Duplicate webhook acknowledged as duplicate', hook2.data?.duplicate === true, JSON.stringify(hook2.data));
    const balAfterDup = (await request('GET', '/api/earnings', { token: freelancer.token })).data.data.balance.total_earned;
    check('10. Duplicate webhook did NOT double-credit', balAfterDup === balAfterOnline, `${balAfterOnline} -> ${balAfterDup}`);

    const LedgerEntry = (await import('../models/LedgerEntry.js')).default;
    check('10. Exactly one earning entry per payment',
      (await LedgerEntry.countDocuments({ payment_id: online2.data.data.id, type: 'FREELANCER_EARNING' })) === 1);

    const failHook = await sendWebhook({ event: 'payment.failed', id: `evt_${STAMP}_c`,
      payload: { payment: { entity: { id: `pay_${STAMP}`, order_id: orderId, error_description: 'Card declined' } } } });
    check('8. Failure webhook accepted', failHook.status === 200);
    const stillSuccess = await request('GET', `/api/payments/${online2.data.data.id}`, { token: company.token });
    check('8. A failure event cannot un-settle a SUCCESS', stillSuccess.data?.data?.status === 'SUCCESS');

    /* -------------------------------------------------------------- */
    section('18-20. Withdrawals');

    const noAccount = await request('POST', '/api/withdrawals', { token: freelancer.token, body: { amount: '1000' } });
    check('19. Withdrawal without a payout account is refused', noAccount.status === 400 && noAccount.data?.code === 'NO_PAYOUT_ACCOUNT');

    const badUpi = await request('POST', '/api/payout-account', { token: freelancer.token, body: { method: 'upi', upi_id: 'nonsense' } });
    check('Invalid UPI rejected', badUpi.status === 400);

    const account = await request('POST', '/api/payout-account', {
      token: freelancer.token, body: { method: 'upi', upi_id: 'paycrew@okhdfc', account_holder_name: 'PAY freelancer' }
    });
    check('6. Payout account saved', account.status === 201, JSON.stringify(account.data).slice(0, 120));
    check('22. Only a MASKED destination is returned', account.data?.data?.masked?.includes('*'), account.data?.data?.masked);
    check('22. Raw UPI id never returned', !account.raw.includes('paycrew@okhdfc'), account.raw.slice(0, 140));

    const balance = (await request('GET', '/api/earnings', { token: freelancer.token })).data.data.balance.available;
    const tooMuch = await request('POST', '/api/withdrawals', {
      token: freelancer.token, body: { amount: String((balance / 100) + 10000) }
    });
    check('18. Cannot withdraw more than the available balance',
      tooMuch.status === 400 && tooMuch.data?.code === 'INSUFFICIENT_BALANCE', JSON.stringify(tooMuch.data).slice(0, 120));

    const withdrawal = await request('POST', '/api/withdrawals', { token: freelancer.token, body: { amount: '1000' } });
    check('19. Withdrawal request created', withdrawal.status === 201, JSON.stringify(withdrawal.data).slice(0, 120));
    check('19. Starts REQUESTED', withdrawal.data?.data?.status === 'REQUESTED');

    const afterWd = (await request('GET', '/api/earnings', { token: freelancer.token })).data.data.balance.available;
    check('30. Balance debited immediately on request', afterWd === balance - 100000, `${balance} -> ${afterWd}`);

    const secondWd = await request('POST', '/api/withdrawals', { token: freelancer.token, body: { amount: '1000' } });
    check('19. A second concurrent withdrawal is refused', secondWd.status === 400 && secondWd.data?.code === 'WITHDRAWAL_IN_PROGRESS');

    const failed = await request('PATCH', `/api/admin/finance/withdrawals/${withdrawal.data.data.id}`, {
      token: admin.token, body: { status: 'FAILED', note: 'Bank rejected' }
    });
    check('20. Admin can mark a withdrawal failed', failed.status === 200 && failed.data?.data?.status === 'FAILED');
    const afterFail = (await request('GET', '/api/earnings', { token: freelancer.token })).data.data.balance.available;
    check('20. A failed payout returns the money', afterFail === balance, `${afterWd} -> ${afterFail}`);

    /* -------------------------------------------------------------- */
    section('4 / 22. Financial isolation between users');

    const otherView = await request('GET', '/api/payments', { token: otherCompany.token });
    check('4. Another company sees none of these payments',
      (otherView.data?.data || []).every((p) => p.company?.id !== company.id));
    check('4. Another company cannot open this payment',
      (await request('GET', `/api/payments/${cash.data.data.id}`, { token: otherCompany.token })).status === 404);

    const otherEarnings = await request('GET', '/api/earnings', { token: otherFreelancer.token });
    check('4. Another freelancer has a zero balance', otherEarnings.data?.data?.balance?.total_earned === 0);
    check('4. Another freelancer cannot see this payout account',
      otherEarnings.data?.data?.payout_account === null);

    const adminAdjust = await request('POST', '/api/admin/finance/adjustments', {
      token: company.token, body: { user_id: freelancer.id, amount_paise: 100000, reason: 'hack' }
    });
    check('13. A company cannot post a ledger adjustment', adminAdjust.status === 403);

    /* -------------------------------------------------------------- */
    section('14. Audit log + notifications, using the EXISTING systems');

    const logs = await request('GET', '/api/admin/activity-logs?category=payments&limit=50', { token: admin.token });
    const logRows = logs.data?.data || [];
    check('14. Payment events reach the existing activity log', logRows.length > 0, `status ${logs.status}`);
    check('14. No bank/UPI identifier in the audit log', !logs.raw.includes('paycrew@okhdfc'));
    check('14. No password hash in the audit log', !logs.raw.includes('$2a$') && !logs.raw.includes('$2b$'));

    const flNotifs = await request('GET', '/api/notifications', { token: freelancer.token });
    check('15. Freelancer notified through the existing system',
      (flNotifs.data?.data || []).some((n) => String(n.type).startsWith('payment_') || String(n.type).startsWith('withdrawal_')));

    /* -------------------------------------------------------------- */
    section('23-29. Existing functionality still works');

    check('23. Login still works',
      (await request('POST', '/api/auth/login', { body: { email: company.email, password: PASS } })).status === 200);
    check('25. Subscription endpoint still works',
      (await request('GET', '/api/subscriptions/me', { token: company.token })).status === 200);
    check('26. Booking flow still works',
      (await request('GET', '/api/booking-requests/freelancer', { token: freelancer.token })).status === 200);
    check('28. Notifications still work',
      (await request('GET', '/api/notifications/unread-count', { token: company.token })).status === 200);
    check('27. Chat conversations still work',
      (await request('GET', '/api/chat/conversations', { token: company.token })).status === 200);
    check('29. Admin dashboard still works',
      (await request('GET', '/api/admin/dashboard/stats', { token: admin.token })).status === 200);
    check('Professional search still works',
      (await request('GET', '/api/public/freelancers')).status === 200);
  } catch (err) {
    crashed = err;
    console.error('\n!! Suite aborted:', err.message);
  } finally {
    section('Cleanup');
    const User = (await import('../models/User.js')).default;
    const models = {
      Payment: (await import('../models/Payment.js')).default,
      LedgerEntry: (await import('../models/LedgerEntry.js')).default,
      Withdrawal: (await import('../models/Withdrawal.js')).default,
      PayoutAccount: (await import('../models/PayoutAccount.js')).default,
      Notification: (await import('../models/Notification.js')).default,
      Conversation: (await import('../models/Conversation.js')).default,
      Message: (await import('../models/Message.js')).default,
      BookingRequest: (await import('../models/BookingRequest.js')).default,
      Subscription: (await import('../models/Subscription.js')).default,
      ActivityLog: (await import('../models/ActivityLog.js')).default
    };

    const testUsers = await User.find({ email: new RegExp(`${TAG.replace('.', '\\.')}$`), role: { $ne: 'admin' } }).select('_id');
    const ids = testUsers.map((u) => u._id);
    if (ids.length) {
      const convs = await models.Conversation.find({ $or: [{ company_id: { $in: ids } }, { freelancer_id: { $in: ids } }] }).select('_id');
      await models.Message.deleteMany({ conversation_id: { $in: convs.map((c) => c._id) } });
      await models.Conversation.deleteMany({ _id: { $in: convs.map((c) => c._id) } });
      // Ledger entries are immutable through the model, so the collection is
      // cleared directly - test data only, never production rows.
      await mongoose.connection.collection('ledgerentries').deleteMany({
        $or: [{ user_id: { $in: ids } }, { company_id: { $in: ids } }, { freelancer_id: { $in: ids } }]
      });
      await models.Payment.deleteMany({ $or: [{ company_id: { $in: ids } }, { freelancer_id: { $in: ids } }] });
      await models.Withdrawal.deleteMany({ user_id: { $in: ids } });
      await models.PayoutAccount.deleteMany({ user_id: { $in: ids } });
      await models.Notification.deleteMany({ recipient_id: { $in: ids } });
      await models.BookingRequest.deleteMany({ $or: [{ freelancer_id: { $in: ids } }, { company_id: { $in: ids } }] });
      await models.Subscription.deleteMany({ user_id: { $in: ids } });
      await models.ActivityLog.deleteMany({ 'actor.user_id': { $in: ids } });
      await User.deleteMany({ _id: { $in: ids } });
    }
    await models.ActivityLog.deleteMany({ 'target.label': /^PAY / });
    await mongoose.connection.collection('webhookevents').deleteMany({ event_id: new RegExp(String(STAMP)) });
    console.log(`  Removed ${ids.length} throwaway account(s) and their financial records.`);

    console.log(`\n${'='.repeat(62)}`);
    console.log(`RESULT: ${pass} passed, ${fail} failed${crashed ? ' (ABORTED EARLY)' : ''}`);
    if (failures.length) { console.log('\nFailures:'); failures.forEach((f) => console.log('  - ' + f)); }
    console.log('='.repeat(62));

    await mongoose.connection.close();
    process.exit(fail === 0 && !crashed ? 0 : 1);
  }
};

run();
