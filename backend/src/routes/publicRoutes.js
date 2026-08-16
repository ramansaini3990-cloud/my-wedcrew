import express from 'express';
import User from '../models/User.js';
import Availability from '../models/Availability.js';

const router = express.Router();

router.get('/freelancers', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    // Fetch public freelancer info
    const users = await User.find({ role: 'freelancer' })
      .select('id name city state profession created_at')
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(limit)
      .lean({ virtuals: true });

    // Fetch availability
    const freelancerIds = users.map(u => u._id);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const availabilityData = await Availability.find({
      freelancer_id: { $in: freelancerIds },
      status: 'available',
      date: { $gte: today }
    }).lean();

    const availabilityMap = {};
    for (const a of availabilityData) {
      const fId = a.freelancer_id.toString();
      if (!availabilityMap[fId]) {
        availabilityMap[fId] = [];
      }
      const d = new Date(a.date);
      availabilityMap[fId].push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
    }

    const formattedUsers = users.map(u => {
      const fId = u.id || u._id.toString();
      const available_dates = availabilityMap[fId] ? availabilityMap[fId].join(',') : null;
      return { ...u, available_dates };
    });

    const total = await User.countDocuments({ role: 'freelancer' });

    res.json({
      data: formattedUsers,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get Public Freelancers Error:', error);
    res.status(500).json({ message: 'Server error retrieving freelancers' });
  }
});

export default router;
