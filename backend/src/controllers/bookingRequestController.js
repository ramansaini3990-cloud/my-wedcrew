import BookingRequest from '../models/BookingRequest.js';
import User from '../models/User.js';
import Notification from '../models/Notification.js';
import Conversation from '../models/Conversation.js';
import { canSendBookingRequest, ensureConversation } from '../services/connectionService.js';
import { emitNotification } from '../socket.js';
import { logFromRequest } from '../services/activityService.js';

/** The fixed opening message every booking request carries. */
const FIXED_BOOKING_MESSAGE =
  'Hi, we’re interested in connecting with you for a booking. Please review our request and respond if you’re available.';

// @desc    Create a new booking request
// @route   POST /api/booking-requests
// @access  Private (Company)
export const createBookingRequest = async (req, res) => {
  try {
    if (req.user.role !== 'company') {
      return res.status(403).json({ code: 'FORBIDDEN', message: 'Only companies can send booking requests' });
    }

    const { freelancer_id, requirement_id } = req.body;

    if (!freelancer_id) {
      return res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Freelancer ID is required' });
    }

    const freelancer = await User.findById(freelancer_id);
    if (!freelancer || freelancer.role !== 'freelancer') {
      return res.status(404).json({ code: 'USER_NOT_FOUND', message: 'Freelancer not found' });
    }

    // Duplicate protection, server-side. Covers both an in-flight pending
    // request and an already-established connection - see connectionService
    // for why a NEW requirement is still allowed.
    const permission = await canSendBookingRequest(req.user.id, freelancer_id, requirement_id);
    if (!permission.allowed) {
      return res.status(400).json({
        code: permission.code,
        message: permission.message,
        conversation_id: permission.conversation_id || undefined
      });
    }

    const bookingData = {
      company_id: req.user.id,
      freelancer_id,
      message: FIXED_BOOKING_MESSAGE,
      status: 'pending'
    };

    if (requirement_id) {
      bookingData.requirement_id = requirement_id;
    }

    const bookingRequest = await BookingRequest.create(bookingData);

    // Notify the freelancer that a new booking request arrived.
    const company = await User.findById(req.user.id);
    const notification = new Notification({
      recipient_id: freelancer_id,
      recipient_role: 'freelancer',
      type: 'new_booking_request',
      title: 'New Booking Request',
      message: `${company ? company.name : 'A company'} sent you a booking request.`,
      sender_id: req.user.id,
      requirement_id: requirement_id || undefined
    });
    await notification.save();
    emitNotification(freelancer_id, notification);

    await logFromRequest(req, {
      eventType: 'booking.created',
      category: 'bookings',
      title: 'Booking request created',
      description: `${company ? company.name : 'A company'} → ${freelancer.name}`,
      target: { type: 'booking_request', id: bookingRequest._id, label: freelancer.name },
      metadata: { status: 'pending', city: freelancer.city || undefined, requirement_id: requirement_id || undefined }
    });

    res.status(201).json({
      message: 'Booking request sent successfully',
      requestId: bookingRequest.id
    });
  } catch (error) {
    console.error('Create booking request error:', error);
    res.status(500).json({ code: 'SERVER_ERROR', message: 'Server error creating booking request' });
  }
};

// @desc    Get booking requests for a freelancer
// @route   GET /api/booking-requests/freelancer
// @access  Private (Freelancer)
export const getFreelancerBookingRequests = async (req, res) => {
  try {
    if (req.user.role !== 'freelancer') {
      return res.status(403).json({ code: 'FORBIDDEN', message: 'Only freelancers can view these requests' });
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
    res.status(500).json({ code: 'SERVER_ERROR', message: 'Server error fetching booking requests' });
  }
};

// @desc    Update booking request status
// @route   PUT /api/booking-requests/:id/status
// @access  Private (Freelancer)
export const updateBookingRequestStatus = async (req, res) => {
  try {
    if (req.user.role !== 'freelancer') {
      return res.status(403).json({ code: 'FORBIDDEN', message: 'Only freelancers can update request status' });
    }

    const { status } = req.body; // 'accepted' or 'declined'
    if (!['accepted', 'declined'].includes(status)) {
      return res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Invalid status' });
    }

    const bookingRequest = await BookingRequest.findById(req.params.id);

    if (!bookingRequest) {
      return res.status(404).json({ code: 'BOOKING_NOT_FOUND', message: 'Booking request not found' });
    }

    if (bookingRequest.freelancer_id.toString() !== req.user.id) {
      return res.status(403).json({ code: 'FORBIDDEN', message: 'Not authorized to update this request' });
    }

    if (bookingRequest.status === status) {
      return res.json({ message: 'Booking request already ' + status });
    }

    bookingRequest.status = status;
    await bookingRequest.save();

    const freelancer = await User.findById(req.user.id);
    const freelancerName = freelancer ? freelancer.name : 'A freelancer';

    if (status === 'accepted') {
      // One shared helper opens conversations for every lifecycle event, so
      // an accepted booking and an accepted application cannot create two.
      const { conversation, created } = await ensureConversation(
        bookingRequest.company_id,
        bookingRequest.freelancer_id,
        { requirement_id: bookingRequest.requirement_id, booking_id: bookingRequest._id }
      );

      if (created) {

        // Accepting a booking is the other place a conversation is born.
        // Logged only on actual creation, so the event is never duplicated
        // with the one raised by POST /api/chat/conversations.
        await logFromRequest(req, {
          eventType: 'conversation.created',
          category: 'messages',
          title: 'New conversation created',
          description: 'Opened by an accepted booking request',
          target: { type: 'conversation', id: conversation._id },
          metadata: { conversation_id: String(conversation._id), booking_id: String(bookingRequest._id) }
        });
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
    } else {
      // Notify the company that the request was declined.
      const notification = new Notification({
        recipient_id: bookingRequest.company_id,
        recipient_role: 'company',
        type: 'booking_request_rejected',
        title: 'Booking Request Declined',
        message: `${freelancerName} declined your booking request.`,
        sender_id: req.user.id
      });
      await notification.save();
      emitNotification(bookingRequest.company_id, notification);
    }

    await logFromRequest(req, {
      eventType: status === 'accepted' ? 'booking.accepted' : 'booking.rejected',
      category: 'bookings',
      severity: status === 'accepted' ? 'success' : 'warning',
      title: status === 'accepted' ? 'Booking accepted' : 'Booking rejected',
      description: `${freelancerName} ${status} a booking request`,
      target: { type: 'booking_request', id: bookingRequest._id, label: freelancerName },
      metadata: { status }
    });

    res.json({ message: 'Booking request ' + status + ' successfully' });
  } catch (error) {
    console.error('Update booking request status error:', error);
    res.status(500).json({ code: 'SERVER_ERROR', message: 'Server error updating booking request' });
  }
};
