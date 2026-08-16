import User from '../../models/User.js';
import Availability from '../../models/Availability.js';

// @desc    Get all freelancers (paginated, sorted, filtered)
// @route   GET /api/admin/freelancers
// @access  Private/Admin
export const getFreelancers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    // Find freelancers
    const freelancers = await User.find({ role: 'freelancer' })
      .select('id name email phone city state profession created_at')
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(limit)
      .lean({ virtuals: true });

    // Fetch availability for these freelancers
    const freelancerIds = freelancers.map(f => f._id);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const availabilityData = await Availability.find({
      freelancer_id: { $in: freelancerIds },
      status: 'available',
      date: { $gte: today }
    }).lean();

    // Group availability dates by freelancer
    const availabilityMap = {};
    for (const a of availabilityData) {
      const fId = a.freelancer_id.toString();
      if (!availabilityMap[fId]) {
        availabilityMap[fId] = [];
      }
      const d = new Date(a.date);
      availabilityMap[fId].push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
    }

    // Attach available dates to response
    const formattedFreelancers = freelancers.map(f => {
      const fId = f.id || f._id.toString();
      const available_dates = availabilityMap[fId] ? availabilityMap[fId].join(',') : null;
      return { ...f, available_dates };
    });

    const total = await User.countDocuments({ role: 'freelancer' });

    res.json({
      data: formattedFreelancers,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get Freelancers Error:', error);
    res.status(500).json({ message: 'Server error retrieving freelancers' });
  }
};

// @desc    Get all companies
// @route   GET /api/admin/companies
// @access  Private/Admin
export const getCompanies = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    const companies = await User.find({ role: 'company' })
      .select('id name email phone city state created_at')
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(limit)
      .lean({ virtuals: true });

    const total = await User.countDocuments({ role: 'company' });

    res.json({
      data: companies,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get Companies Error:', error);
    res.status(500).json({ message: 'Server error retrieving companies' });
  }
};
