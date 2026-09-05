import User from '../../models/User.js';
import Subscription from '../../models/Subscription.js';
import Payment from '../../models/Payment.js';

/**
 * Admin dashboard summary.
 *
 * EVERY figure here is computed from the database. It previously returned
 * invented numbers - activeSubscriptions: 145, todayRegistrations: 12,
 * monthlyRevenue: 34500, seven months of made-up user and revenue growth, and
 * a "recent activity" list naming people who do not exist. An operations
 * screen that invents its own numbers is worse than an empty one, because an
 * admin will act on it.
 *
 * `recentActivity` is deliberately NOT returned any more: the admin dashboard
 * reads the real feed straight from /api/admin/activity-logs, which is the
 * same endpoint the Live Activity page uses. One implementation, not two.
 */

/** Months are reported in the server's timezone, matching every other date. */
const startOfMonth = (d) => new Date(d.getFullYear(), d.getMonth(), 1);

/** The last `count` months, oldest first, as {name, start, end} windows. */
const monthWindows = (count = 7) => {
  const now = new Date();
  const windows = [];
  for (let i = count - 1; i >= 0; i--) {
    const start = startOfMonth(new Date(now.getFullYear(), now.getMonth() - i, 1));
    const end = startOfMonth(new Date(now.getFullYear(), now.getMonth() - i + 1, 1));
    windows.push({ name: start.toLocaleString('en-US', { month: 'short' }), start, end });
  }
  return windows;
};

/**
 * Statuses that mean money actually arrived. Mirrors the finance panel: an
 * INITIATED or FAILED payment is not revenue.
 */
const SETTLED_STATUSES = ['SUCCESS', 'CASH_CONFIRMED'];

// @desc    Get dashboard statistics
// @route   GET /api/admin/dashboard/stats
// @access  Private/Admin
export const getDashboardStats = async (req, res) => {
  try {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const thisMonthStart = startOfMonth(now);
    const windows = monthWindows(7);

    const [
      totalUsers,
      totalFreelancers,
      totalCompanies,
      activeSubscriptions,
      todayRegistrations,
      monthRevenueRows,
      userGrowthRows,
      revenueGrowthRows
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ role: 'freelancer' }),
      User.countDocuments({ role: 'company' }),

      // Same definition subscriptionService uses for access: status active AND
      // not past its end date. Counted here, never decided here.
      Subscription.countDocuments({ status: 'active', end_date: { $gte: now } }),

      User.countDocuments({ created_at: { $gte: todayStart } }),

      // Revenue is stored as integer paise; it is converted to rupees once,
      // at the edge, so no float arithmetic touches the running total.
      Payment.aggregate([
        { $match: { status: { $in: SETTLED_STATUSES }, created_at: { $gte: thisMonthStart } } },
        { $group: { _id: null, paise: { $sum: '$amount_paise' } } }
      ]),

      User.aggregate([
        { $match: { created_at: { $gte: windows[0].start } } },
        {
          $group: {
            _id: { y: { $year: '$created_at' }, m: { $month: '$created_at' } },
            n: { $sum: 1 }
          }
        }
      ]),

      Payment.aggregate([
        { $match: { status: { $in: SETTLED_STATUSES }, created_at: { $gte: windows[0].start } } },
        {
          $group: {
            _id: { y: { $year: '$created_at' }, m: { $month: '$created_at' } },
            paise: { $sum: '$amount_paise' }
          }
        }
      ])
    ]);

    const bucket = (rows, key) => {
      const map = new Map(rows.map((r) => [`${r._id.y}-${r._id.m}`, r[key]]));
      return windows.map((w) => ({
        name: w.name,
        value: map.get(`${w.start.getFullYear()}-${w.start.getMonth() + 1}`) || 0
      }));
    };

    const userGrowth = bucket(userGrowthRows, 'n').map((p) => ({ name: p.name, users: p.value }));
    const revenueGrowth = bucket(revenueGrowthRows, 'paise')
      .map((p) => ({ name: p.name, revenue: Math.round(p.value / 100) }));

    res.json({
      summary: {
        totalUsers,
        totalFreelancers,
        totalCompanies,
        activeSubscriptions,
        todayRegistrations,
        // Rupees, rounded once from the paise total above.
        monthlyRevenue: Math.round((monthRevenueRows[0]?.paise || 0) / 100),
        currency: 'INR'
      },
      charts: {
        userGrowth,
        revenueGrowth
      }
    });
  } catch (error) {
    console.error('Dashboard Stats Error:', error);
    res.status(500).json({ message: 'Server error retrieving dashboard stats' });
  }
};
