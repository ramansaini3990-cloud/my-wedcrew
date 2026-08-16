import BookingRequest from '../models/BookingRequest.js';

// @desc    Create a new booking request
// @route   POST /api/booking-requests
// @access  Private (Company)
export const createBookingRequest = async (req, res) => {
  try {
    if (req.user.role !== 'company') {
      return res.status(403).json({ message: 'Only companies can send booking requests' });
    }

    const { freelancer_id, requirement_id, message } = req.body;

    if (!freelancer_id) {
      return res.status(400).json({ message: 'Freelancer ID is required' });
    }

    const bookingRequest = await BookingRequest.create({
      company_id: req.user.id,
      freelancer_id,
      requirement_id: requirement_id || null,
      message: message || null,
      status: 'pending'
    });

    res.status(201).json({
      message: 'Booking request sent successfully',
      requestId: bookingRequest.id
    });
  } catch (error) {
    console.error('Create booking request error:', error);
    res.status(500).json({ message: 'Server error creating booking request' });
  }
};

// @desc    Get booking requests for a freelancer
// @route   GET /api/booking-requests/freelancer
// @access  Private (Freelancer)
export const getFreelancerBookingRequests = async (req, res) => {
  try {
    if (req.user.role !== 'freelancer') {
      return res.status(403).json({ message: 'Only freelancers can view these requests' });
    }

    const requests = await BookingRequest.find({ freelancer_id: req.user.id })
      .populate('company_id', 'name')
      .populate('requirement_id', 'category city event_date')
      .sort({ created_at: -1 })
      .lean({ virtuals: true });

    // Format output to match old SQL mapping
    const formattedRequests = requests.map(reqData => ({
      ...reqData,
      company_name: reqData.company_id?.name,
      requirement_category: reqData.requirement_id?.category,
      requirement_city: reqData.requirement_id?.city,
      requirement_date: reqData.requirement_id?.event_date,
      // Overwrite the nested populated objects with just the ID to stay closer to old shape if needed, 
      // but keeping them doesn't hurt as long as the flat fields are present.
      company_id: reqData.company_id?.id || reqData.company_id?._id,
      requirement_id: reqData.requirement_id?.id || reqData.requirement_id?._id
    }));

    res.json({ data: formattedRequests });
  } catch (error) {
    console.error('Get booking requests error:', error);
    res.status(500).json({ message: 'Server error fetching booking requests' });
  }
};

// @desc    Update booking request status
// @route   PUT /api/booking-requests/:id/status
// @access  Private (Freelancer)
export const updateBookingRequestStatus = async (req, res) => {
  try {
    if (req.user.role !== 'freelancer') {
      return res.status(403).json({ message: 'Only freelancers can update request status' });
    }

    const { status } = req.body; // 'accepted' or 'declined'
    if (!['accepted', 'declined'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const bookingRequest = await BookingRequest.findById(req.params.id);

    if (!bookingRequest) {
      return res.status(404).json({ message: 'Booking request not found' });
    }

    if (bookingRequest.freelancer_id.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to update this request' });
    }

    bookingRequest.status = status;
    await bookingRequest.save();

    res.json({ message: 'Booking request ' + status + ' successfully' });
  } catch (error) {
    console.error('Update booking request status error:', error);
    res.status(500).json({ message: 'Server error updating booking request' });
  }
};
