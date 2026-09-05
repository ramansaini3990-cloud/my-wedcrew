/**
 * Verifies the company saved-professionals (bookmark) endpoints.
 *
 *   E2E_ADMIN_EMAIL=... E2E_ADMIN_PASSWORD=... npm run test:saved
 *
 * Covers authorisation, idempotent saving, the database-level unique index
 * under concurrency, the ids endpoint, unsaving, and — most importantly — that
 * a saved row is subject to exactly the same subscription lock as a search
 * result. Bookmarking must not become a cheap way to accumulate identities the
 * caller's plan does not entitle them to.
 *
 * Every throwaway account is removed at the end.
 */
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import connectDB from '../config/database.js';

dotenv.config();

const API = process.env.API_URL || 'http://localhost:5000';
const STAMP = Date.now();
const TAG = '@e2e.local';
const PASS = 'Saved@2026';

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
  const email = `saved.${label}.${STAMP}${TAG}`;
  const phone = `9${String(STAMP).slice(-8)}${phoneSeq}`.slice(0, 10);
  const r = await request('POST', '/api/auth/register', {
    body: { role, name: `SAVED ${label}`, phone, email, password: PASS, ...extra }
  });
  if (r.status !== 201) throw new Error(`register ${label}: ${r.status} ${r.raw}`);
  const l = await request('POST', '/api/auth/login', { body: { email, password: PASS } });
  return { email, phone, token: l.data.token, id: l.data.user.id, role, name: `SAVED ${label}` };
};

let crashed = false;

const run = async () => {
  await connectDB();

  try {
    if (!process.env.E2E_ADMIN_EMAIL || !process.env.E2E_ADMIN_PASSWORD) {
      console.log('Set E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD');
      process.exit(1);
    }
    const adminLogin = await request('POST', '/api/auth/login', {
      body: { email: process.env.E2E_ADMIN_EMAIL, password: process.env.E2E_ADMIN_PASSWORD }
    });
    if (adminLogin.status !== 200) throw new Error(`Admin login failed: ${adminLogin.status} ${adminLogin.raw}`);
    const admin = { token: adminLogin.data.token };

    section('Setup: one locked company, one subscribed company, two professionals');
    const locked = await register('company', 'locked');       // deliberately no plan
    const unlocked = await register('company', 'unlocked');
    const proA = await register('freelancer', 'proA', { profession: 'Cinematographer' });
    const proB = await register('freelancer', 'proB', { profession: 'Drone Pilot' });

    const plansRes = await request('GET', '/api/admin/plans', { token: admin.token });
    const plans = Array.isArray(plansRes.data) ? plansRes.data : (plansRes.data?.data || []);
    const premium = plans.find((p) => p.name === 'PREMIUM');
    check('PREMIUM plan available', Boolean(premium));

    const sub = await request('POST', '/api/admin/subscriptions', {
      token: admin.token,
      body: {
        user_id: unlocked.id,
        planId: premium.id,
        start_date: new Date().toISOString(),
        end_date: new Date(Date.now() + 30 * 864e5).toISOString()
      }
    });
    check('Second company subscribed', sub.status === 201, `${sub.status}`);

    section('Authorisation');
    const anon = await request('GET', '/api/saved-professionals');
    check('Unauthenticated request rejected', anon.status === 401, `${anon.status}`);

    const asFreelancer = await request('GET', '/api/saved-professionals', { token: proA.token });
    check('Freelancer forbidden (companies only)', asFreelancer.status === 403 && asFreelancer.data?.code === 'FORBIDDEN',
      `${asFreelancer.status} ${asFreelancer.data?.code}`);

    const postAsFreelancer = await request('POST', '/api/saved-professionals', {
      token: proA.token, body: { freelancer_id: proB.id }
    });
    check('Freelancer cannot save', postAsFreelancer.status === 403, `${postAsFreelancer.status}`);

    section('Saving');
    const empty = await request('GET', '/api/saved-professionals', { token: locked.token });
    check('New company has an empty list', empty.status === 200 && empty.data.data.length === 0,
      `total=${empty.data?.pagination?.total}`);

    const save1 = await request('POST', '/api/saved-professionals', {
      token: locked.token, body: { freelancer_id: proA.id }
    });
    check('Save succeeds with 201', save1.status === 201 && save1.data?.created === true,
      `${save1.status} created=${save1.data?.created}`);

    const save2 = await request('POST', '/api/saved-professionals', {
      token: locked.token, body: { freelancer_id: proA.id }
    });
    check('Saving twice is idempotent, not an error', save2.status === 200 && save2.data?.created === false,
      `${save2.status} created=${save2.data?.created}`);

    const noId = await request('POST', '/api/saved-professionals', { token: locked.token, body: {} });
    check('Missing freelancer_id rejected', noId.status === 400 && noId.data?.code === 'VALIDATION_ERROR',
      `${noId.status} ${noId.data?.code}`);

    const savingACompany = await request('POST', '/api/saved-professionals', {
      token: locked.token, body: { freelancer_id: unlocked.id }
    });
    check('Cannot save a company', savingACompany.status === 404 && savingACompany.data?.code === 'PROFESSIONAL_NOT_FOUND',
      `${savingACompany.status} ${savingACompany.data?.code}`);

    const ghost = await request('POST', '/api/saved-professionals', {
      token: locked.token, body: { freelancer_id: '000000000000000000000099' }
    });
    check('Cannot save an id that does not exist', ghost.status === 404, `${ghost.status}`);

    section('The unique index holds under concurrency');
    const races = await Promise.all([1, 2, 3, 4, 5].map(() =>
      request('POST', '/api/saved-professionals', { token: unlocked.token, body: { freelancer_id: proB.id } })));
    const created = races.filter((r) => r.data?.created === true).length;
    check('Exactly one of five concurrent saves created a row', created === 1, `created=${created}`);
    check('No 500s from the duplicate key', races.every((r) => r.status < 500),
      races.map((r) => r.status).join(','));

    const SavedProfessional = (await import('../models/SavedProfessional.js')).default;
    const rowCount = await SavedProfessional.countDocuments({ company_id: unlocked.id, freelancer_id: proB.id });
    check('Exactly one row exists in the database', rowCount === 1, `rows=${rowCount}`);

    const indexes = await mongoose.connection.collection('savedprofessionals').indexes();
    const unique = indexes.find((i) => i.name === 'company_id_1_freelancer_id_1');
    check('Compound index is declared unique', unique?.unique === true, JSON.stringify(unique?.key));

    section('Ids endpoint');
    await request('POST', '/api/saved-professionals', { token: locked.token, body: { freelancer_id: proB.id } });
    const ids = await request('GET', '/api/saved-professionals/ids', { token: locked.token });
    check('Ids endpoint returns both saved ids', ids.status === 200 && ids.data.data.length === 2,
      `n=${ids.data?.data?.length}`);
    check('Ids endpoint leaks nothing but ids', !/name|profession|bio|@/i.test(JSON.stringify(ids.data)));
    const idsAsFreelancer = await request('GET', '/api/saved-professionals/ids', { token: proA.token });
    check('Ids endpoint is companies-only', idsAsFreelancer.status === 403, `${idsAsFreelancer.status}`);

    section('The saved list obeys the SAME subscription lock as search');
    const lockedList = await request('GET', '/api/saved-professionals', { token: locked.token });
    check('Locked company gets its saved rows', lockedList.status === 200 && lockedList.data.data.length === 2,
      `n=${lockedList.data?.data?.length}`);

    const lockedRow = lockedList.data.data[0];
    check('Saved row is marked locked', lockedRow?.locked === true, String(lockedRow?.locked));
    check('Saved row withholds the name', !lockedRow?.name, JSON.stringify(lockedRow?.name));
    check('Saved row withholds the photo', !lockedRow?.profile_picture);
    check('Saved row withholds the bio', !lockedRow?.bio);
    check('Saved row withholds equipment', !lockedRow?.equipment || lockedRow.equipment.length === 0);
    check('Saved row withholds social links',
      !lockedRow?.social_links || Object.keys(lockedRow.social_links).length === 0);
    check('Saved row carries no gallery', lockedRow?.gallery === undefined);
    check('Saved row contains no email address', !JSON.stringify(lockedRow).includes('@'));
    check('Saved row states the lock reason', lockedRow?.lock_reason === 'SUBSCRIPTION_REQUIRED', lockedRow?.lock_reason);
    check('Non-identifying discovery data survives', Boolean(lockedRow?.profession), lockedRow?.profession);
    check('Saved flag is set', lockedRow?.saved === true);

    const openList = await request('GET', '/api/saved-professionals', { token: unlocked.token });
    const openRow = openList.data.data[0];
    check('Subscribed company sees locked:false', openRow?.locked === false, String(openRow?.locked));
    check('Subscribed company sees the real name', Boolean(openRow?.name), JSON.stringify(openRow?.name));

    section('Pagination');
    const paged = await request('GET', '/api/saved-professionals?page=1&limit=1', { token: locked.token });
    check('limit is honoured', paged.data?.data?.length === 1, `n=${paged.data?.data?.length}`);
    check('pagination reports the true total', paged.data?.pagination?.total === 2, `total=${paged.data?.pagination?.total}`);
    check('pagination reports the page count', paged.data?.pagination?.pages === 2, `pages=${paged.data?.pagination?.pages}`);

    section('Unsaving');
    const del1 = await request('DELETE', `/api/saved-professionals/${proA.id}`, { token: locked.token });
    check('Unsave removes the row', del1.status === 200 && del1.data?.removed === true,
      `${del1.status} removed=${del1.data?.removed}`);

    const del2 = await request('DELETE', `/api/saved-professionals/${proA.id}`, { token: locked.token });
    check('Unsaving twice is not an error', del2.status === 200 && del2.data?.removed === false,
      `${del2.status} removed=${del2.data?.removed}`);

    const after = await request('GET', '/api/saved-professionals/ids', { token: locked.token });
    check('One bookmark remains', after.data.data.length === 1, `n=${after.data?.data?.length}`);

    const delAsFreelancer = await request('DELETE', `/api/saved-professionals/${proB.id}`, { token: proA.token });
    check('Freelancer cannot unsave', delAsFreelancer.status === 403, `${delAsFreelancer.status}`);

    section('One company cannot see or change another company\'s list');
    const otherList = await request('GET', '/api/saved-professionals', { token: unlocked.token });
    const otherIds = (otherList.data.data || []).map((r) => String(r.id));
    check('Lists are scoped to the caller', !otherIds.includes(String(proA.id)) || otherIds.length === 1,
      `unlocked sees ${otherIds.length} row(s)`);
    await request('DELETE', `/api/saved-professionals/${proB.id}`, { token: unlocked.token });
    const lockedStill = await request('GET', '/api/saved-professionals/ids', { token: locked.token });
    check('One company unsaving does not touch another\'s bookmark',
      lockedStill.data.data.includes(String(proB.id)), JSON.stringify(lockedStill.data.data));
  } catch (error) {
    crashed = true;
    console.error(`\n!! Suite aborted: ${error.message}`);
  } finally {
    section('Cleanup');
    const User = (await import('../models/User.js')).default;
    const SavedProfessional = (await import('../models/SavedProfessional.js')).default;
    const Subscription = (await import('../models/Subscription.js')).default;
    const ActivityLog = (await import('../models/ActivityLog.js')).default;
    const Notification = (await import('../models/Notification.js')).default;

    const testUsers = await User.find({
      email: new RegExp(`^saved\\..*${TAG.replace('.', '\\.')}$`),
      role: { $ne: 'admin' }
    }).select('_id');
    const ids = testUsers.map((u) => u._id);
    if (ids.length) {
      await SavedProfessional.deleteMany({ $or: [{ company_id: { $in: ids } }, { freelancer_id: { $in: ids } }] });
      await Subscription.deleteMany({ user_id: { $in: ids } });
      await Notification.deleteMany({ recipient_id: { $in: ids } });
      await ActivityLog.deleteMany({ 'actor.user_id': { $in: ids } });
      await User.deleteMany({ _id: { $in: ids } });
    }
    await ActivityLog.deleteMany({ 'target.label': /^SAVED / });
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
