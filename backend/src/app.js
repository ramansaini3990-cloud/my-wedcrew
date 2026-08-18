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

// Base route
app.get('/', (req, res) => {
  res.send('WedCrew API is running');
});

// Health check route
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date() });
});

export default app;
