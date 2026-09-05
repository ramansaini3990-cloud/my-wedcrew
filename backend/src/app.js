import express from 'express';
import cors from 'cors';
import authRoutes from './routes/authRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import requirementRoutes from './routes/requirementRoutes.js';
import freelancerRoutes from './routes/freelancerRoutes.js';
import publicRoutes from './routes/publicRoutes.js';
import bookingRequestRoutes from './routes/bookingRequestRoutes.js';
import adminSubscriptionRoutes from './routes/adminSubscriptionRoutes.js';
import chatRoutes from './routes/chatRoutes.js';
import applicationRoutes from './routes/applicationRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import subscriptionRoutes from './routes/subscriptionRoutes.js';
import masterRoutes from './routes/masterRoutes.js';
import adminMasterRoutes from './routes/adminMasterRoutes.js';
import profileRoutes from './routes/profileRoutes.js';
import availabilityRoutes from './routes/availabilityRoutes.js';
import activityLogRoutes from './routes/activityLogRoutes.js';
import galleryRoutes from './routes/galleryRoutes.js';
import paymentRoutes from './routes/paymentRoutes.js';
import earningsRoutes, { payoutAccountRouter, withdrawalRouter } from './routes/earningsRoutes.js';
import adminFinanceRoutes from './routes/adminFinanceRoutes.js';
import { handleWebhook } from './controllers/webhookController.js';
import { UPLOAD_ROOT_DIR, ensureStorage } from './services/uploadService.js';
import { corsOptions, corsErrorHandler } from './config/cors.js';

const app = express();

// Middleware
app.use(cors(corsOptions));
/**
 * Payment provider webhook.
 *
 * Mounted BEFORE express.json() and with a raw body parser: the HMAC
 * signature is computed over the exact bytes the provider sent, and parsing
 * then re-serialising JSON would change them and break verification.
 *
 * Deliberately unauthenticated - the signature IS the authentication.
 */
app.post('/api/payments/webhook', express.raw({ type: '*/*', limit: '1mb' }), handleWebhook);

app.use(express.json());

/**
 * Uploaded portfolio media.
 *
 * Served read-only and with no directory listing. `dotfiles: 'deny'` and the
 * explicit GET/HEAD restriction mean this path can only ever hand back files
 * that uploadService wrote, never execute or accept anything.
 *
 * Swapping to object storage later means dropping this block and pointing
 * MEDIA_PUBLIC_PREFIX at the bucket/CDN origin.
 */
ensureStorage().catch((err) => console.error('Upload storage init failed:', err.message));
app.use(
  '/uploads',
  (req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return res.sendStatus(405);
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    // Never let a stored file be interpreted as HTML/JS by the browser.
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
    next();
  },
  express.static(UPLOAD_ROOT_DIR, {
    index: false,
    dotfiles: 'deny',
    maxAge: '7d',
    fallthrough: false
  })
);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/admin', adminSubscriptionRoutes); // mounts at /api/admin/subscriptions and /api/admin/plans
app.use('/api/requirements', requirementRoutes);
app.use('/api/freelancer', freelancerRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/booking-requests', bookingRequestRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/applications', applicationRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/master', masterRoutes);              // public read-only master data
app.use('/api/admin/master', adminMasterRoutes);   // admin-only master data CRUD
app.use('/api/profile', profileRoutes);            // freelancer + company profile
app.use('/api/availability', availabilityRoutes);  // travel & availability blocks
app.use('/api/admin/activity-logs', activityLogRoutes); // admin-only activity stream
app.use('/api/gallery', galleryRoutes);            // freelancer portfolio gallery
app.use('/api/payments', paymentRoutes);           // company payments + cash settlement
app.use('/api/earnings', earningsRoutes);          // freelancer earnings
app.use('/api/payout-account', payoutAccountRouter);
app.use('/api/withdrawals', withdrawalRouter);
app.use('/api/admin/finance', adminFinanceRoutes); // admin finance panel

// Base route
app.get('/', (req, res) => {
  res.send('mywedcrew.com API is running');
});

// Health check route
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date() });
});

// Maps a rejected CORS origin to a clean 403 instead of a 500 stack trace.
// Mounted after every route so it only ever sees errors, never requests.
app.use(corsErrorHandler);

export default app;
