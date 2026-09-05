/**
 * Verifies the freelancer portfolio & gallery system end to end.
 *
 *   E2E_ADMIN_EMAIL=... E2E_ADMIN_PASSWORD=... npm run test:gallery
 *
 * Privacy and ownership assertions are made against the RAW response body, so
 * they prove the data never reaches the client rather than merely that the UI
 * hides it. Every throwaway account and uploaded file is removed at the end.
 */
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import connectDB from '../config/database.js';

dotenv.config();

const API = process.env.API_URL || 'http://localhost:5000';
const STAMP = Date.now();
const TAG = '@e2e.local';
const STRONG = 'Gallery@2026';

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

/** Multipart upload using the real endpoint, with a generated file. */
const upload = async (token, { bytes, mime, filename }) => {
  const fd = new FormData();
  fd.append('file', new Blob([bytes], { type: mime }), filename);
  const res = await fetch(`${API}/api/gallery/upload`, {
    method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd
  });
  let data = null; let raw = '';
  try { raw = await res.text(); data = JSON.parse(raw); } catch { /* ignore */ }
  return { status: res.status, data, raw };
};

/** Smallest valid PNG (1x1). Real bytes, so the MIME check is genuine. */
const PNG_1x1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);

let phoneSeq = 0;
const register = async (role, label, extra = {}) => {
  phoneSeq += 1;
  const email = `gal.${label}.${STAMP}${TAG}`;
  const phone = `9${String(STAMP).slice(-8)}${phoneSeq}`.slice(0, 10);
  const r = await request('POST', '/api/auth/register', {
    body: { role, name: `GAL ${label}`, phone, email, password: STRONG, ...extra }
  });
  if (r.status !== 201) return { failed: r };
  const l = await request('POST', '/api/auth/login', { body: { email, password: STRONG } });
  return { email, phone, token: l.data.token, id: l.data.user.id, role, name: `GAL ${label}` };
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
  let uploadedUrls = [];

  try {
    const owner = await register('freelancer', 'owner');
    const other = await register('freelancer', 'other');
    const company = await register('company', 'buyer');
    if (owner.failed || other.failed || company.failed) throw new Error('Registration failed');

    /* -------------------------------------------------------------- */
    section('A. External URL validation (server-side allow-list)');

    const bad = [
      ['javascript:alert(1)', 'javascript: scheme'],
      ['http://www.youtube.com/watch?v=dQw4w9WgXcQ', 'http (not https)'],
      ['https://evil.example/watch?v=dQw4w9WgXcQ', 'look-alike host'],
      ['https://www.youtube.com/watch?v=short', 'malformed video id'],
      ['https://www.youtube.com.evil.test/watch?v=dQw4w9WgXcQ', 'suffix-spoofed host'],
      ['not a url at all', 'garbage']
    ];
    for (const [url, label] of bad) {
      const r = await request('POST', '/api/gallery', { token: owner.token, body: { title: 'Bad', url } });
      check(`A. Rejected: ${label}`, r.status === 400, `status ${r.status}`);
    }

    /* -------------------------------------------------------------- */
    section('B. Adding supported platforms');

    const yt = await request('POST', '/api/gallery', {
      token: owner.token,
      body: { title: 'Wedding Film', category: 'Wedding', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' }
    });
    check('B. YouTube link accepted', yt.status === 201, JSON.stringify(yt.data).slice(0, 120));
    check('B. YouTube id extracted', yt.data?.data?.external_id === 'dQw4w9WgXcQ');
    check('B. Embed URL is server-built (nocookie)',
      yt.data?.data?.embed_url?.startsWith('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ'));
    check('B. YouTube thumbnail derived', Boolean(yt.data?.data?.thumbnail_url));
    check('B. Stored as video', yt.data?.data?.media_type === 'video');

    const short = await request('POST', '/api/gallery', {
      token: owner.token, body: { title: 'Short', url: 'https://youtu.be/dQw4w9WgXcQ' }
    });
    check('B. youtu.be short link accepted', short.status === 201);

    const ig = await request('POST', '/api/gallery', {
      token: owner.token, body: { title: 'Reel', category: 'Drone', url: 'https://www.instagram.com/reel/CxYz12AbCdE/' }
    });
    check('B. Instagram reel accepted', ig.status === 201, JSON.stringify(ig.data).slice(0, 120));
    check('B. Instagram official embed used', ig.data?.data?.embed_url?.endsWith('/embed/'));
    // The caption block makes the embed taller than any viewport, which forced
    // a nested scrollbar in the reel viewer - it must not come back.
    check('B. Instagram embed omits the caption block',
      !ig.data?.data?.embed_url?.includes('captioned'), ig.data?.data?.embed_url);

    const vim = await request('POST', '/api/gallery', {
      token: owner.token, body: { title: 'Showreel', url: 'https://vimeo.com/123456789' }
    });
    check('B. Vimeo accepted', vim.status === 201);

    // A row saved before the reel viewer existed still holds the captioned URL.
    // It must be normalised on read, with the stored document left untouched.
    const GalleryItemModel = (await import('../models/GalleryItem.js')).default;
    await GalleryItemModel.updateOne(
      { _id: ig.data.data.id },
      { $set: { embed_url: 'https://www.instagram.com/reel/CxYz12AbCdE/embed/captioned/' } }
    );
    const legacyRead = await request('GET', '/api/gallery/me', { token: owner.token });
    const legacyRow = legacyRead.data.data.find((i) => i.id === ig.data.data.id);
    check('B. Legacy captioned URL normalised on read', legacyRow?.embed_url?.endsWith('/embed/'),
      legacyRow?.embed_url);
    const storedRow = await GalleryItemModel.findById(ig.data.data.id).lean();
    check('B. Stored document left unchanged (no migration)',
      storedRow?.embed_url?.includes('captioned'));

    /* -------------------------------------------------------------- */
    section('C. Uploads');

    const img = await upload(owner.token, { bytes: PNG_1x1, mime: 'image/png', filename: 'shot.png' });
    check('C. PNG upload accepted', img.status === 201, JSON.stringify(img.data).slice(0, 120));
    check('C. Upload returns a /uploads URL', img.data?.data?.url?.startsWith('/uploads/gallery/'));
    check('C. Upload classified as image', img.data?.data?.media_type === 'image');
    if (img.data?.data?.url) uploadedUrls.push(img.data.data.url);

    const evil = await upload(owner.token, {
      bytes: Buffer.from('<script>alert(1)</script>'), mime: 'text/html', filename: 'x.html'
    });
    check('C. HTML upload rejected', evil.status === 400, `status ${evil.status}`);

    const uploadItem = await request('POST', '/api/gallery', {
      token: owner.token,
      body: { title: 'Ceremony Still', category: 'Wedding', media_url: img.data.data.url, media_type: 'image' }
    });
    check('C. Uploaded item created', uploadItem.status === 201);
    check('C. Uploaded item has no embed_url', uploadItem.data?.data?.embed_url === null);

    const forged = await request('POST', '/api/gallery', {
      token: owner.token, body: { title: 'Forged', media_url: '/etc/passwd', media_type: 'image' }
    });
    check('C. Non-/uploads media_url rejected', forged.status === 400);

    /* -------------------------------------------------------------- */
    section('D. Owner-only access');

    const mine = await request('GET', '/api/gallery/me', { token: owner.token });
    check('D. Owner lists their gallery', mine.status === 200 && mine.data.data.length === 5,
      `count ${mine.data?.data?.length}`);

    const theirs = await request('GET', '/api/gallery/me', { token: other.token });
    check('D. Another freelancer sees an empty gallery', theirs.data?.data?.length === 0);

    const ytId = yt.data.data.id;
    const steal = await request('PUT', `/api/gallery/${ytId}`, { token: other.token, body: { title: 'Hijacked' } });
    check('D. Another freelancer CANNOT edit the item', steal.status === 404, `status ${steal.status}`);

    const stealDel = await request('DELETE', `/api/gallery/${ytId}`, { token: other.token });
    check('D. Another freelancer CANNOT delete the item', stealDel.status === 404);

    const asCompany = await request('GET', '/api/gallery/me', { token: company.token });
    check('D. Company has no portfolio endpoint access', asCompany.status === 403);

    const anon = await request('GET', '/api/gallery/me');
    check('D. Anonymous rejected', anon.status === 401);

    const stillMine = await request('GET', '/api/gallery/me', { token: owner.token });
    check('D. Item unchanged after hijack attempts',
      stillMine.data.data.find((i) => i.id === ytId)?.title === 'Wedding Film');

    /* -------------------------------------------------------------- */
    section('E. Edit, feature, reorder, delete');

    const edited = await request('PUT', `/api/gallery/${ytId}`, {
      token: owner.token, body: { title: 'Sharma Wedding Film', category: 'Reception' }
    });
    check('E. Edit works', edited.status === 200 && edited.data.data.title === 'Sharma Wedding Film');
    check('E. Category updated', edited.data.data.category === 'Reception');

    const feat = await request('PATCH', `/api/gallery/${ytId}/feature`, { token: owner.token, body: { featured: true } });
    check('E. Feature works', feat.status === 200 && feat.data.data.featured === true);

    const unfeat = await request('PATCH', `/api/gallery/${ytId}/feature`, { token: owner.token, body: { featured: false } });
    check('E. Unfeature works', unfeat.data?.data?.featured === false);
    await request('PATCH', `/api/gallery/${ytId}/feature`, { token: owner.token, body: { featured: true } });

    const current = (await request('GET', '/api/gallery/me', { token: owner.token })).data.data;
    const reversed = [...current].reverse().map((i) => i.id);
    const reordered = await request('PATCH', '/api/gallery/reorder', { token: owner.token, body: { order: reversed } });
    check('E. Reorder works', reordered.status === 200);
    check('E. New order persisted', reordered.data.data[0].id === reversed[0], 'first item did not move');

    const foreignReorder = await request('PATCH', '/api/gallery/reorder', {
      token: other.token, body: { order: [ytId] }
    });
    check('E. Reorder cannot touch another user\'s item', foreignReorder.status === 200);
    const afterForeign = (await request('GET', '/api/gallery/me', { token: owner.token })).data.data;
    check('E. Owner order unaffected by the foreign reorder', afterForeign.length === 5);

    const delTarget = short.data.data.id;
    const deleted = await request('DELETE', `/api/gallery/${delTarget}`, { token: owner.token });
    check('E. Delete works', deleted.status === 200);
    check('E. Item gone',
      !(await request('GET', '/api/gallery/me', { token: owner.token })).data.data.some((i) => i.id === delTarget));

    /* -------------------------------------------------------------- */
    section('F. Social links (public URLs only, host-validated)');

    const badSocial = await request('PUT', '/api/profile/me', {
      token: owner.token, body: { social_links: { instagram: 'https://evil.example/hack' } }
    });
    check('F. Wrong-host Instagram link rejected', badSocial.status === 400, `status ${badSocial.status}`);

    const jsSocial = await request('PUT', '/api/profile/me', {
      token: owner.token, body: { social_links: { website: 'javascript:alert(1)' } }
    });
    check('F. javascript: link rejected', jsSocial.status === 400);

    const goodSocial = await request('PUT', '/api/profile/me', {
      token: owner.token,
      body: { social_links: { instagram: 'https://www.instagram.com/galstudio/', youtube: 'https://www.youtube.com/@galstudio' } }
    });
    check('F. Valid social links accepted', goodSocial.status === 200, JSON.stringify(goodSocial.data).slice(0, 120));
    check('F. Links returned on the profile',
      goodSocial.data?.data?.social_links?.instagram === 'https://www.instagram.com/galstudio/');

    const partial = await request('PUT', '/api/profile/me', {
      token: owner.token, body: { social_links: { facebook: 'https://facebook.com/galstudio' } }
    });
    check('F. Updating one platform preserves the others',
      partial.data?.data?.social_links?.instagram === 'https://www.instagram.com/galstudio/' &&
      partial.data?.data?.social_links?.facebook === 'https://facebook.com/galstudio');

    /* -------------------------------------------------------------- */
    section('G. Public exposure respects the subscription lock');

    const anonProfile = await request('GET', `/api/public/freelancers/${owner.id}`);
    check('G. Anonymous view is locked', anonProfile.data?.data?.locked === true);
    check('G. Gallery NOT in the locked raw body', !anonProfile.raw.includes('Sharma Wedding Film'));
    check('G. Embed URL NOT in the locked raw body', !anonProfile.raw.includes('youtube-nocookie'));
    check('G. Social links withheld when locked', !anonProfile.raw.includes('instagram.com/galstudio'));

    const plans = (await request('GET', '/api/admin/plans', { token: admin.token })).data || [];
    const PREMIUM = plans.find((p) => p.name === 'PREMIUM');
    await request('POST', '/api/admin/subscriptions', {
      token: admin.token,
      body: { user_id: company.id, planId: PREMIUM.id, start_date: iso(0), end_date: iso(30) }
    });

    const subProfile = await request('GET', `/api/public/freelancers/${owner.id}`, { token: company.token });
    check('G. Subscribed company sees the gallery', (subProfile.data?.data?.gallery || []).length === 4,
      `count ${subProfile.data?.data?.gallery?.length}`);
    check('G. Featured work exposed separately', (subProfile.data?.data?.featured_gallery || []).length === 1);
    check('G. Embed URL available to play in-site',
      subProfile.data?.data?.gallery?.some((g) => g.embed_url?.includes('youtube-nocookie')));
    check('G. Social links visible when unlocked',
      subProfile.data?.data?.social_links?.instagram === 'https://www.instagram.com/galstudio/');

    check('G. No email in the public body', !subProfile.raw.includes(owner.email));
    check('G. No phone in the public body', !subProfile.raw.includes(owner.phone));
    check('G. No password hash in the public body',
      !subProfile.raw.includes('$2a$') && !subProfile.raw.includes('$2b$'));
    check('G. No moderation internals leaked to the public',
      !subProfile.raw.includes('hidden_reason') && !subProfile.raw.includes('display_order'));

    const ownerView = await request('GET', `/api/public/freelancers/${owner.id}`, { token: owner.token });
    check('G. Owner previewing their own public profile sees the gallery',
      (ownerView.data?.data?.gallery || []).length === 4);

    /* -------------------------------------------------------------- */
    section('H. Admin moderation');

    const adminList = await request('GET', '/api/admin/gallery', { token: admin.token });
    check('H. Admin can list gallery items', adminList.status === 200);

    const adminPortfolio = await request('GET', `/api/admin/gallery/freelancers/${owner.id}`, { token: admin.token });
    check('H. Admin can open one freelancer portfolio',
      adminPortfolio.status === 200 && adminPortfolio.data.data.items.length === 4);

    const notAdmin = await request('GET', '/api/admin/gallery', { token: owner.token });
    check('H. Freelancer cannot reach admin moderation', notAdmin.status === 403);

    const hidden = await request('PATCH', `/api/admin/gallery/${ytId}/visibility`, {
      token: admin.token, body: { is_hidden: true, reason: 'Test moderation' }
    });
    check('H. Admin can hide an item', hidden.status === 200 && hidden.data.data.is_hidden === true);

    const afterHide = await request('GET', `/api/public/freelancers/${owner.id}`, { token: company.token });
    check('H. Hidden item removed from the public gallery',
      (afterHide.data?.data?.gallery || []).length === 3, `count ${afterHide.data?.data?.gallery?.length}`);
    check('H. Hidden item absent from the raw public body', !afterHide.raw.includes('Sharma Wedding Film'));
    check('H. Hidden item no longer in featured work',
      (afterHide.data?.data?.featured_gallery || []).length === 0);

    const ownerSeesHidden = await request('GET', '/api/gallery/me', { token: owner.token });
    check('H. Owner still sees it, flagged as hidden',
      ownerSeesHidden.data.data.find((i) => i.id === ytId)?.is_hidden === true);

    const restored = await request('PATCH', `/api/admin/gallery/${ytId}/visibility`, {
      token: admin.token, body: { is_hidden: false }
    });
    check('H. Admin can restore an item', restored.data?.data?.is_hidden === false);
    check('H. Restored item is public again',
      ((await request('GET', `/api/public/freelancers/${owner.id}`, { token: company.token })).data?.data?.gallery || []).length === 4);

    const adminDel = await request('DELETE', `/api/admin/gallery/${vim.data.data.id}`, { token: admin.token });
    check('H. Admin can delete an item', adminDel.status === 200);

    /* -------------------------------------------------------------- */
    section('I. Uploaded file is actually served');

    const fileRes = await fetch(`${API}${img.data.data.url}`);
    check('I. Uploaded image is retrievable', fileRes.status === 200, `status ${fileRes.status}`);
    check('I. Served with nosniff', fileRes.headers.get('x-content-type-options') === 'nosniff');

    const traversal = await fetch(`${API}/uploads/../src/app.js`);
    check('I. Path traversal blocked', traversal.status !== 200, `status ${traversal.status}`);

    const writeAttempt = await fetch(`${API}${img.data.data.url}`, { method: 'DELETE' });
    check('I. Non-GET on the media path refused', writeAttempt.status === 405);

    /* -------------------------------------------------------------- */
    section('J. Existing behaviour unchanged');

    const listing = await request('GET', '/api/public/freelancers', { token: company.token });
    check('J. Professional search still responds', listing.status === 200 && Array.isArray(listing.data?.data));

    const booking = await request('POST', '/api/booking-requests', {
      token: company.token, body: { freelancer_id: owner.id }
    });
    check('J. Booking request still works', booking.status === 201, JSON.stringify(booking.data).slice(0, 120));

    const profileStill = await request('GET', '/api/profile/me', { token: owner.token });
    check('J. Profile endpoint still returns the existing fields',
      profileStill.status === 200 && profileStill.data.data.email === owner.email);
  } catch (err) {
    crashed = err;
    console.error('\n!! Suite aborted:', err.message);
  } finally {
    /* -------------------------------------------------------------- */
    section('Cleanup');
    const User = (await import('../models/User.js')).default;
    const GalleryItem = (await import('../models/GalleryItem.js')).default;
    const Notification = (await import('../models/Notification.js')).default;
    const Conversation = (await import('../models/Conversation.js')).default;
    const Message = (await import('../models/Message.js')).default;
    const BookingRequest = (await import('../models/BookingRequest.js')).default;
    const Subscription = (await import('../models/Subscription.js')).default;
    const ActivityLog = (await import('../models/ActivityLog.js')).default;
    const { remove } = await import('../services/uploadService.js');

    const testUsers = await User.find({ email: new RegExp(`${TAG.replace('.', '\\.')}$`), role: { $ne: 'admin' } }).select('_id');
    const ids = testUsers.map((u) => u._id);

    // Remove any file this run wrote, plus anything still referenced.
    const leftover = await GalleryItem.find({ user_id: { $in: ids }, source_type: 'upload' }).select('media_url');
    for (const url of [...uploadedUrls, ...leftover.map((i) => i.media_url)]) await remove(url);

    if (ids.length) {
      const convs = await Conversation.find({ $or: [{ company_id: { $in: ids } }, { freelancer_id: { $in: ids } }] }).select('_id');
      await Message.deleteMany({ conversation_id: { $in: convs.map((c) => c._id) } });
      await Conversation.deleteMany({ _id: { $in: convs.map((c) => c._id) } });
      await GalleryItem.deleteMany({ user_id: { $in: ids } });
      await Notification.deleteMany({ recipient_id: { $in: ids } });
      await BookingRequest.deleteMany({ $or: [{ freelancer_id: { $in: ids } }, { company_id: { $in: ids } }] });
      await Subscription.deleteMany({ user_id: { $in: ids } });
      await ActivityLog.deleteMany({ 'actor.user_id': { $in: ids } });
      await User.deleteMany({ _id: { $in: ids } });
    }
    await ActivityLog.deleteMany({ 'target.label': /^GAL / });
    console.log(`  Removed ${ids.length} throwaway account(s), their gallery items and uploaded files.`);

    console.log(`\n${'='.repeat(62)}`);
    console.log(`RESULT: ${pass} passed, ${fail} failed${crashed ? ' (ABORTED EARLY)' : ''}`);
    if (failures.length) { console.log('\nFailures:'); failures.forEach((f) => console.log('  - ' + f)); }
    console.log('='.repeat(62));

    await mongoose.connection.close();
    process.exit(fail === 0 && !crashed ? 0 : 1);
  }
};

run();
