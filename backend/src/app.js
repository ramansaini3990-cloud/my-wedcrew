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

const app = express();

// Middleware
app.use(cors({
  origin: function (origin, callback) {
    // Allow any origin for local network testing
    callback(null, true);
  },
  credentials: true
}));
app.use(express.json());

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

// Base route
app.get('/', (req, res) => {
  res.send('mywedcrew.com API is running');
});

// Health check route
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date() });
});

export default app;
