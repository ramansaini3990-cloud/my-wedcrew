import User from '../models/User.js';
import Availability from '../models/Availability.js';
import { getFreelancerBalance } from '../services/ledgerService.js';
import { formatPaise } from '../services/money.js';
import BookingRequest from '../models/BookingRequest.js';
import Requirement from '../models/Requirement.js';

export const updateProfileAndAvailability = async (req, res) => {
  try {
    const { name, profession, phone, city, state, availableDates } = req.body;
    const userId = req.user.id;
    
    // Update profile
    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (profession !== undefined) updateData.profession = profession;
    if (phone !== undefined) updateData.phone = phone;
    if (city !== undefined) updateData.city = city;
    if (state !== undefined) updateData.state = state;
    
    if (Object.keys(updateData).length > 0) {
      await User.findByIdAndUpdate(userId, updateData);
    }
    
    // Update availability
    if (availableDates && Array.isArray(availableDates)) {
      // Delete old availability that is today or in the future
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      await Availability.deleteMany({ freelancer_id: userId, date: { $gte: today } });
      
      if (availableDates.length > 0) {
        const insertData = availableDates.map(date => ({
          freelancer_id: userId,
          date: new Date(date),
          status: 'available'
        }));
        await Availability.insertMany(insertData);
      }
    }
    
    res.json({ message: 'Profile and availability updated successfully' });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ message: 'Server error updating profile' });
  }
};

export const getMyProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const user = await User.findById(userId).select('name email phone city state profession');
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const availability = await Availability.find({ freelancer_id: userId, date: { $gte: today } }).select('date');
    
    res.json({
      name: user?.name || '',
      email: user?.email || '',
      phone: user?.phone || '',
      city: user?.city || '',
      profession: user?.profession || '',
      state: user?.state || '',
      availableDates: availability.map(a => {
        const d = new Date(a.date);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      })
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ message: 'Server error retrieving profile' });
  }
};

export const getDashboardStats = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const bookingRequestsCount = await BookingRequest.countDocuments({ freelancer_id: userId });

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // To get upcoming shoots, we need to join BookingRequest and Requirement
    // Find accepted booking requests
    const acceptedRequests = await BookingRequest.find({ 
      freelancer_id: userId, 
      status: 'accepted' 
    });
    
    const requirementIds = acceptedRequests.map(br => br.requirement_id);
    
    const upcomingShootsCount = await Requirement.countDocuments({
      _id: { $in: requirementIds },
      event_date: { $gte: today }
    });

    // Real money, from the append-only ledger - the same figure the Earnings
    // tab shows. It used to be the literal string '₹0', which read as a
    // measured balance of zero rather than "not wired up".
    const balance = await getFreelancerBalance(userId);

    res.json({
      stats: {
        // `profileViews` was removed rather than left at 0: nothing in the
        // system records a profile view, so any number here - including zero -
        // claims a measurement that is not taken.
        bookingRequests: bookingRequestsCount,
        upcomingShoots: upcomingShootsCount,
        earnings: formatPaise(balance.total_earned)
      }
      // `recentRequests: []` was dropped too: it was always empty and no part
      // of the UI ever read it.
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ message: 'Server error retrieving stats' });
  }
};
