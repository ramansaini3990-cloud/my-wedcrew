import User from '../../models/User.js';
import Requirement from '../../models/Requirement.js';

// @desc    Get dashboard statistics
// @route   GET /api/admin/dashboard/stats
// @access  Private/Admin
export const getDashboardStats = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalFreelancers = await User.countDocuments({ role: 'freelancer' });
    const totalCompanies = await User.countDocuments({ role: 'company' });
    
    // Growth data (mocked for now, would typically be an aggregation by date)
    const userGrowth = [
      { name: 'Jan', users: 40 },
      { name: 'Feb', users: 30 },
      { name: 'Mar', users: 20 },
      { name: 'Apr', users: 27 },
      { name: 'May', users: 18 },
      { name: 'Jun', users: 23 },
      { name: 'Jul', users: 34 },
    ];

    const revenueGrowth = [
      { name: 'Jan', revenue: 4000 },
      { name: 'Feb', revenue: 3000 },
      { name: 'Mar', revenue: 2000 },
      { name: 'Apr', revenue: 2780 },
      { name: 'May', revenue: 1890 },
      { name: 'Jun', revenue: 2390 },
      { name: 'Jul', revenue: 3490 },
    ];

    res.json({
      summary: {
        totalUsers,
        totalFreelancers,
        totalCompanies,
        activeSubscriptions: 145, // Placeholder
        todayRegistrations: 12, // Placeholder
        monthlyRevenue: 34500, // Placeholder
      },
      charts: {
        userGrowth,
        revenueGrowth
      },
      recentActivity: [
        { id: 1, action: 'New registration', user: 'Rahul', time: '10 mins ago' },
        { id: 2, action: 'Payment received', user: 'Studio X', time: '1 hour ago' },
      ]
    });
  } catch (error) {
    console.error('Dashboard Stats Error:', error);
    res.status(500).json({ message: 'Server error retrieving dashboard stats' });
  }
};
