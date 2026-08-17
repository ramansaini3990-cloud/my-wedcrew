import BookingRequest from '../models/BookingRequest.js';

// @desc    Create a new booking request
// @route   POST /api/booking-requests
// @access  Private (Company)
export const createBookingRequest = async (req, res) => {
  try {
    if (req.user.role !== 'company') {
      return res.status(403).json({ message: 'Only companies can send booking requests' });
    }

    const { freelancer_id, requirement_id } = req.body;

    if (!freelancer_id) {
      return res.status(400).json({ message: 'Freelancer ID is required' });
    }

    const existingRequest = await BookingRequest.findOne({ company_id: req.user.id, freelancer_id, status: 'pending' });
    if (existingRequest) {
      return res.status(400).json({ message: 'A pending booking request already exists for this freelancer.' });
    }

    const fixedMessage = "Hi, we’re interested in connecting with you for a booking. Please review our request and respond if you’re available.";

    const bookingData = {
      company_id: req.user.id,
      freelancer_id,
      message: fixedMessage,
      status: 'pending'
    };

    if (requirement_id) {
      bookingData.requirement_id = requirement_id;
    }

    const bookingRequest = await BookingRequest.create(bookingData);

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
      id: reqData._id || reqData.id,
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

    if (bookingRequest.status === status) {
      return res.json({ message: 'Booking request already ' + status });
    }

    bookingRequest.status = status;
    await bookingRequest.save();

    if (status === 'accepted') {
      const Notification = (await import('../models/Notification.js')).default;
      const User = (await import('../models/User.js')).default;
      const Conversation = (await import('../models/Conversation.js')).default;
      const { emitNotification } = await import('../socket.js');
      
      const freelancer = await User.findById(req.user.id);
      const freelancerName = freelancer ? freelancer.name : 'A freelancer';
      
      let conversation = await Conversation.findOne({
        company_id: bookingRequest.company_id,
        freelancer_id: bookingRequest.freelancer_id
      });

      if (!conversation) {
        conversation = new Conversation({
          company_id: bookingRequest.company_id,
          freelancer_id: bookingRequest.freelancer_id
        });
        await conversation.save();
      }

      const notification = new Notification({
        recipient_id: bookingRequest.company_id,
        recipient_role: 'company',
        type: 'booking_request_accepted',
        title: 'Booking Request Accepted',
        message: `${freelancerName} accepted your booking request.`,
        conversation_id: conversation._id,
        sender_id: req.user.id
      });
      await notification.save();
      emitNotification(bookingRequest.company_id, notification);
    }

    res.json({ message: 'Booking request ' + status + ' successfully' });
  } catch (error) {
    console.error('Update booking request status error:', error);
    res.status(500).json({ message: 'Server error updating booking request' });
  }
};
