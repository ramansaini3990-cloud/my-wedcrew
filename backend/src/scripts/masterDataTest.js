/**
 * End-to-end verification of the profile / master-data / travel-availability
 * system against a RUNNING backend.
 *
 *   E2E_ADMIN_EMAIL=... E2E_ADMIN_PASSWORD=... npm run test:master
 *
 * Creates throwaway accounts and master records (all tagged), exercises the
 * real HTTP API, then removes only what it created. Pre-existing data is never
 * touched.
 */
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import connectDB from '../config/database.js';

dotenv.config();

const API = process.env.API_URL || 'http://localhost:5000';
const STAMP = Date.now();
const TAG = '@e2e.local';
const TEST_PREFIX = `ZZTest${STAMP}`;

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
  const email = `md.${label}.${STAMP}${TAG}`;
  const password = 'E2ePassw0rd!';
  const r = await request('POST', '/api/auth/register', {
    body: { role, name: `MD ${label}`, phone: `9${String(STAMP).slice(-8)}${phoneSeq}`.slice(0, 10), email, password, ...extra }
  });
  if (r.status !== 201) throw new Error(`register ${label}: ${JSON.stringify(r.data)}`);
  const l = await request('POST', '/api/auth/login', { body: { email, password } });
  return { email, password, token: l.data.token, id: l.data.user.id, role };
};

const iso = (d) => { const x = new Date(); x.setDate(x.getDate() + d); return x.toISOString().slice(0, 10); };

const run = async () => {
  const adminEmail = process.env.E2E_ADMIN_EMAIL;
  const adminPassword = process.env.E2E_ADMIN_PASSWORD;
  if (!adminEmail || !adminPassword) { console.error('Set E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD'); process.exit(1); }

  if ((await request('GET', '/api/health')).status !== 200) {
    console.error(`Backend not reachable at ${API}`); process.exit(1);
  }
  const al = await request('POST', '/api/auth/login', { body: { email: adminEmail, password: adminPassword } });
  if (al.status !== 200 || al.data.user.role !== 'admin') { console.error('Admin login failed'); process.exit(1); }
  const admin = { token: al.data.token };
  console.log(`Backend ${API} | admin ${adminEmail}`);

  await connectDB();
  const createdIds = { professions: [], states: [], cities: [] };
  let crashed = null;

  try {
    /* -------------------------------------------------------------- */
    section('TEST A-C: Admin profession CRUD + deactivate');

    const createProf = await request('POST', '/api/admin/master/professions', {
      token: admin.token,
      body: { name: `${TEST_PREFIX} Gaffer`, description: 'Lighting lead' }
    });
    check('A. Admin creates a profession', createProf.status === 201, JSON.stringify(createProf.data).slice(0, 120));
    const profId = createProf.data?.data?.id || createProf.data?.data?._id;
    if (profId) createdIds.professions.push(profId);

    const dupProf = await request('POST', '/api/admin/master/professions', {
      token: admin.token, body: { name: `${TEST_PREFIX} gaffer` }
    });
    check('Duplicate profession rejected (case-insensitive)', dupProf.status === 409 && dupProf.data?.code === 'DUPLICATE');

    const editProf = await request('PUT', `/api/admin/master/professions/${profId}`, {
      token: admin.token, body: { description: 'Updated description' }
    });
    check('B. Admin edits a profession', editProf.status === 200 && editProf.data.data.description === 'Updated description');

    /* -------------------------------------------------------------- */
    section('TEST D-E: Admin state + city CRUD, city belongs to state');

    const createState = await request('POST', '/api/admin/master/states', {
      token: admin.token, body: { name: `${TEST_PREFIX} Testland`, code: 'ZZ' }
    });
    check('D. Admin creates a state', createState.status === 201);
    const stateId = createState.data?.data?.id || createState.data?.data?._id;
    if (stateId) createdIds.states.push(stateId);

    const createCity = await request('POST', '/api/admin/master/cities', {
      token: admin.token, body: { name: `${TEST_PREFIX} Testville`, state_id: stateId }
    });
    check('E. Admin creates a city under that state', createCity.status === 201);
    const cityId = createCity.data?.data?.id || createCity.data?.data?._id;
    if (cityId) createdIds.cities.push(cityId);

    const cityNoState = await request('POST', '/api/admin/master/cities', {
      token: admin.token, body: { name: `${TEST_PREFIX} Orphan` }
    });
    check('City without a state rejected', cityNoState.status === 400);

    /* -------------------------------------------------------------- */
    section('TEST F: cascade - cities filtered by state');

    const states = (await request('GET', '/api/master/states')).data.data;
    const rajasthan = states.find((s) => s.name === 'Rajasthan');
    const maharashtra = states.find((s) => s.name === 'Maharashtra');
    check('Seeded states present', Boolean(rajasthan && maharashtra));

    const rjCities = (await request('GET', `/api/master/cities?state_id=${rajasthan.id}`)).data.data;
    const mhCities = (await request('GET', `/api/master/cities?state_id=${maharashtra.id}`)).data.data;
    check('F. Rajasthan cities include Jaipur/Udaipur', rjCities.some((c) => c.name === 'Jaipur') && rjCities.some((c) => c.name === 'Udaipur'));
    check('F. Maharashtra cities exclude Jaipur', !mhCities.some((c) => c.name === 'Jaipur'));

    const jaipur = rjCities.find((c) => c.name === 'Jaipur');
    const udaipur = rjCities.find((c) => c.name === 'Udaipur');
    const mumbai = mhCities.find((c) => c.name === 'Mumbai');

    /* -------------------------------------------------------------- */
    section('TEST G + 19: role separation and server-side validation');

    const freelancer = await register('freelancer', 'freelancer');
    const company = await register('company', 'company');

    const nonAdminWrite = await request('POST', '/api/admin/master/professions', {
      token: freelancer.token, body: { name: `${TEST_PREFIX} Hacker` }
    });
    check('Non-admin cannot create master data', nonAdminWrite.status === 403);

    const nonAdminList = await request('GET', '/api/admin/master/states', { token: company.token });
    check('Non-admin cannot read admin master API', nonAdminList.status === 403);

    const noAuth = await request('GET', '/api/profile/me');
    check('Unauthenticated profile read rejected', noAuth.status === 401);

    const professions = (await request('GET', '/api/master/professions')).data.data;
    const cinematographer = professions.find((p) => p.name === 'Cinematographer');

    // G: a free-text profession is not accepted - only valid IDs.
    const bogus = await request('PUT', '/api/profile/me', {
      token: freelancer.token, body: { profession_id: '507f1f77bcf86cd799439011' }
    });
    check('G. Unknown profession_id rejected', bogus.status === 400 && bogus.data?.code === 'PROFESSION_NOT_FOUND');

    const mismatch = await request('PUT', '/api/profile/me', {
      token: freelancer.token, body: { state_id: rajasthan.id, city_id: mumbai.id }
    });
    check('City/state mismatch rejected server-side', mismatch.status === 400 && mismatch.data?.code === 'CITY_STATE_MISMATCH');

    const cityNoStateSel = await request('PUT', '/api/profile/me', {
      token: company.token, body: { city_id: jaipur.id }
    });
    check('City without a state rejected server-side', cityNoStateSel.status === 400 && cityNoStateSel.data?.code === 'STATE_REQUIRED_FOR_CITY');

    /* -------------------------------------------------------------- */
    section('TEST G/H/I: freelancer + company profiles use the same master data');

    const fProfile = await request('PUT', '/api/profile/me', {
      token: freelancer.token,
      body: {
        profession_id: cinematographer.id,
        state_id: rajasthan.id,
        city_id: udaipur.id,
        bio: 'Wedding cinematographer.',
        experience_years: 7,
        equipment: ['Sony FX3', 'Ronin gimbal'],
        manual_location: { address: '25 km outside Udaipur, near Nathdwara', landmark: 'Temple road' }
      }
    });
    check('G. Freelancer profile saved with master data', fProfile.status === 200, JSON.stringify(fProfile.data).slice(0, 140));
    check('Legacy strings kept in sync', fProfile.data?.data?.profession === 'Cinematographer' && fProfile.data?.data?.city === 'Udaipur');
    check('I. Manual location stored', fProfile.data?.data?.manual_location?.address?.includes('Nathdwara'));
    check('Experience + equipment stored', fProfile.data?.data?.experience_years === 7 && fProfile.data?.data?.equipment?.length === 2);

    const cProfile = await request('PUT', '/api/profile/me', {
      token: company.token,
      body: { profession_id: cinematographer.id, state_id: maharashtra.id, city_id: mumbai.id, bio: 'Production house.' }
    });
    check('H. Company profile uses the same master-data system', cProfile.status === 200 && cProfile.data.data.city === 'Mumbai');

    /* -------------------------------------------------------------- */
    section('TEST J: shared coordinates stored, kept private on public API');

    const geo = await request('PUT', '/api/profile/me', {
      token: freelancer.token,
      body: { manual_location: { address: 'Near Nathdwara', latitude: 24.9299, longitude: 73.8207, shared_from_device: true } }
    });
    check('J. Coordinates saved', geo.status === 200 && geo.data.data.manual_location.latitude === 24.9299);
    check('shared_from_device flag stored', geo.data.data.manual_location.shared_from_device === true);

    const badGeo = await request('PUT', '/api/profile/me', {
      token: freelancer.token, body: { manual_location: { latitude: 999 } }
    });
    check('Invalid latitude rejected', badGeo.status === 400);

    const publicList = await request('GET', `/api/public/freelancers?city_id=${udaipur.id}`);
    const publicMe = (publicList.data?.data || []).find((u) => String(u._id || u.id) === String(freelancer.id));
    check('Freelancer discoverable by base city', Boolean(publicMe));
    check('PRIVACY: coordinates never exposed publicly', publicMe && publicMe.manual_location === undefined);
    check('PRIVACY: approximate city/state exposed instead', publicMe?.city === 'Udaipur' && publicMe?.state === 'Rajasthan');

    /* -------------------------------------------------------------- */
    section('TEST K/L/N: travel availability blocks + overlap validation');

    const blockUdaipur = await request('POST', '/api/availability/blocks', {
      token: freelancer.token,
      body: { start_date: iso(5), end_date: iso(9), status: 'available', state_id: rajasthan.id, city_id: udaipur.id, notes: 'Home base' }
    });
    check('K. Availability block created (Udaipur, available)', blockUdaipur.status === 201, JSON.stringify(blockUdaipur.data).slice(0, 140));

    const blockJaipurBooked = await request('POST', '/api/availability/blocks', {
      token: freelancer.token,
      body: { start_date: iso(10), end_date: iso(13), status: 'booked', state_id: rajasthan.id, city_id: jaipur.id }
    });
    check('L. Future travel block created (Jaipur, booked)', blockJaipurBooked.status === 201);

    const blockJaipurFree = await request('POST', '/api/availability/blocks', {
      token: freelancer.token,
      body: { start_date: iso(14), end_date: iso(18), status: 'available', state_id: rajasthan.id, city_id: jaipur.id }
    });
    check('L. Future travel block created (Jaipur, available)', blockJaipurFree.status === 201);
    const freeBlockId = blockJaipurFree.data?.data?.id || blockJaipurFree.data?.data?._id;

    const overlap = await request('POST', '/api/availability/blocks', {
      token: freelancer.token,
      body: { start_date: iso(12), end_date: iso(15), status: 'available', state_id: rajasthan.id, city_id: jaipur.id }
    });
    check('N. Overlapping block rejected', overlap.status === 409 && overlap.data?.code === 'AVAILABILITY_OVERLAP',
      JSON.stringify(overlap.data).slice(0, 140));
    check('N. Conflict details returned', Array.isArray(overlap.data?.conflicts) && overlap.data.conflicts.length > 0);

    const backwards = await request('POST', '/api/availability/blocks', {
      token: freelancer.token, body: { start_date: iso(40), end_date: iso(35), status: 'available' }
    });
    check('End-before-start rejected', backwards.status === 400 && backwards.data?.code === 'END_BEFORE_START');

    const blockMismatch = await request('POST', '/api/availability/blocks', {
      token: freelancer.token,
      body: { start_date: iso(50), end_date: iso(52), state_id: rajasthan.id, city_id: mumbai.id }
    });
    check('Block with city/state mismatch rejected', blockMismatch.status === 400 && blockMismatch.data?.code === 'CITY_STATE_MISMATCH');

    const otherUserEdit = await request('PUT', `/api/availability/blocks/${freeBlockId}`, {
      token: company.token, body: { status: 'busy' }
    });
    check('Cannot edit another user availability block', otherUserEdit.status === 403);

    /* -------------------------------------------------------------- */
    section('TEST M: location + date aware search');

    const searchFreeDay = await request('GET', `/api/public/freelancers?city_id=${jaipur.id}&date=${iso(15)}`);
    const foundFree = (searchFreeDay.data?.data || []).find((u) => String(u._id || u.id) === String(freelancer.id));
    check('M. Found in Jaipur on a travelling-available date', Boolean(foundFree),
      `returned ${(searchFreeDay.data?.data || []).length}`);
    check('M. Result flagged as a travel match', foundFree?.match_type === 'travel', `got ${foundFree?.match_type}`);

    const searchBookedDay = await request('GET', `/api/public/freelancers?city_id=${jaipur.id}&date=${iso(11)}`);
    const foundBooked = (searchBookedDay.data?.data || []).find((u) => String(u._id || u.id) === String(freelancer.id));
    check('9. NOT shown as available in Jaipur while BOOKED there', !foundBooked);

    const searchBase = await request('GET', `/api/public/freelancers?city_id=${udaipur.id}&date=${iso(6)}`);
    const foundBase = (searchBase.data?.data || []).find((u) => String(u._id || u.id) === String(freelancer.id));
    check('Found at base city on an available date', Boolean(foundBase));
    check('Result flagged as a base match', foundBase?.match_type === 'base');

    const wrongCity = await request('GET', `/api/public/freelancers?city_id=${mumbai.id}&date=${iso(15)}`);
    const foundWrong = (wrongCity.data?.data || []).find((u) => String(u._id || u.id) === String(freelancer.id));
    check('Not returned for an unrelated city', !foundWrong);

    const byProfession = await request('GET', `/api/public/freelancers?profession_id=${cinematographer.id}`);
    check('Filter by profession_id works',
      (byProfession.data?.data || []).some((u) => String(u._id || u.id) === String(freelancer.id)));

    check('Upcoming availability exposed for profile display',
      Array.isArray(foundBase?.upcoming_availability) && foundBase.upcoming_availability.length > 0);

    /* -------------------------------------------------------------- */
    section('TEST O/P: deactivating master data preserves existing profiles');

    const deactivateProf = await request('PATCH', `/api/admin/master/professions/${cinematographer.id}/status`, {
      token: admin.token, body: { is_active: false }
    });
    check('O. Admin deactivates a profession in use', deactivateProf.status === 200);
    check('O. Usage count reported', deactivateProf.data?.usage?.total > 0, JSON.stringify(deactivateProf.data?.usage));

    const profileAfter = await request('GET', '/api/profile/me', { token: freelancer.token });
    check('O. Existing profile data intact after deactivation',
      profileAfter.data?.data?.profession === 'Cinematographer' && profileAfter.data?.data?.profession_id === cinematographer.id);

    const activeList = (await request('GET', '/api/master/professions')).data.data;
    check('O. Deactivated profession hidden from new selections',
      !activeList.some((p) => p.id === cinematographer.id));

    const reSave = await request('PUT', '/api/profile/me', {
      token: freelancer.token, body: { profession_id: cinematographer.id, bio: 'Still here.' }
    });
    check('O. User can re-save while keeping their existing (now inactive) selection', reSave.status === 200);

    const deleteInUse = await request('DELETE', `/api/admin/master/professions/${cinematographer.id}`, { token: admin.token });
    check('O. Hard delete of an in-use profession refused', deleteInUse.status === 409 && deleteInUse.data?.code === 'MASTER_RECORD_IN_USE');

    await request('PATCH', `/api/admin/master/professions/${cinematographer.id}/status`, {
      token: admin.token, body: { is_active: true }
    });

    const deactivateCity = await request('PATCH', `/api/admin/master/cities/${udaipur.id}/status`, {
      token: admin.token, body: { is_active: false }
    });
    check('P. Admin deactivates a city in use', deactivateCity.status === 200 && deactivateCity.data?.usage?.users > 0);

    const profileAfterCity = await request('GET', '/api/profile/me', { token: freelancer.token });
    check('P. Profile city preserved after deactivation',
      profileAfterCity.data?.data?.city === 'Udaipur' && profileAfterCity.data?.data?.city_id === udaipur.id);

    const deleteCityInUse = await request('DELETE', `/api/admin/master/cities/${udaipur.id}`, { token: admin.token });
    check('P. Hard delete of an in-use city refused', deleteCityInUse.status === 409);

    await request('PATCH', `/api/admin/master/cities/${udaipur.id}/status`, { token: admin.token, body: { is_active: true } });

    const deleteUnusedProf = await request('DELETE', `/api/admin/master/professions/${profId}`, { token: admin.token });
    check('C. Unused profession CAN be deleted', deleteUnusedProf.status === 200);
    if (deleteUnusedProf.status === 200) createdIds.professions = createdIds.professions.filter((i) => i !== profId);

    /* -------------------------------------------------------------- */
    section('Legacy compatibility');

    const legacySearch = await request('GET', '/api/public/freelancers?city=Udaipur');
    check('Legacy ?city= string filter still works',
      (legacySearch.data?.data || []).some((u) => String(u._id || u.id) === String(freelancer.id)));
    check('Legacy response shape preserved',
      Array.isArray(legacySearch.data?.data) && typeof legacySearch.data?.pagination?.total === 'number');

    const legacyProfile = await request('GET', '/api/freelancer/profile', { token: freelancer.token });
    check('Existing /api/freelancer/profile endpoint still works', legacyProfile.status === 200 && legacyProfile.data?.city === 'Udaipur');
  } catch (err) {
    crashed = err;
    console.log(`\n  !! ABORTED: ${err.message}`);
  } finally {
    section('Cleanup');
    const User = (await import('../models/User.js')).default;
    const AvailabilityBlock = (await import('../models/AvailabilityBlock.js')).default;
    const Profession = (await import('../models/Profession.js')).default;
    const State = (await import('../models/State.js')).default;
    const City = (await import('../models/City.js')).default;
    const Notification = (await import('../models/Notification.js')).default;
    const EmailLog = (await import('../models/EmailLog.js')).default;
    const ActivityLog = (await import('../models/ActivityLog.js')).default;
    const Subscription = (await import('../models/Subscription.js')).default;

    const testUsers = await User.find({ email: new RegExp(`${TAG.replace('.', '\\.')}$`), role: { $ne: 'admin' } }).select('_id');
    const ids = testUsers.map((u) => u._id);
    if (ids.length) {
      await AvailabilityBlock.deleteMany({ user_id: { $in: ids } });
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
    // Only records this run created (prefixed) are removed.
    const rx = new RegExp(`^${TEST_PREFIX}`);
    await City.deleteMany({ name: rx });
    await State.deleteMany({ name: rx });
    await Profession.deleteMany({ name: rx });
    console.log(`  Removed ${ids.length} throwaway account(s) and all ${TEST_PREFIX}* master records.`);

    console.log(`\n${'='.repeat(62)}`);
    console.log(`RESULT: ${pass} passed, ${fail} failed${crashed ? ' (ABORTED EARLY)' : ''}`);
    if (failures.length) { console.log('\nFailures:'); failures.forEach((f) => console.log('  - ' + f)); }
    console.log('='.repeat(62));

    await mongoose.connection.close();
    process.exit(fail === 0 && !crashed ? 0 : 1);
  }
};

run();
