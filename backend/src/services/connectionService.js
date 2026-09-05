import BookingRequest from '../models/BookingRequest.js';
import Application from '../models/Application.js';
import Conversation from '../models/Conversation.js';

/**
 * Single authority for "are this company and this freelancer connected?".
 *
 * A connection is derived from the EXISTING lifecycle records - no new
 * collection, no denormalised flag that could drift out of sync:
 *
 *   accepted BookingRequest   (company -> freelancer, freelancer accepted)
 *   accepted Application      (freelancer -> company, company accepted)
 *
 * Either direction produces the same connected state, so callers never have to
 * care who started it.
 *
 * Deliberately NOT connected: pending, declined, rejected, shortlisted. Those
 * are in-flight or closed outcomes, not an established relationship.
 */

/** Statuses that mean "this relationship was actually established". */
export const CONNECTED_BOOKING_STATUSES = ['accepted'];
export const CONNECTED_APPLICATION_STATUSES = ['accepted'];

/**
 * @returns {Promise<{connected: boolean, via: 'booking'|'application'|null,
 *                    requirement_ids: string[]}>}
 */
export const getConnection = async (companyId, freelancerId) => {
  if (!companyId || !freelancerId) return { connected: false, via: null, requirement_ids: [] };

  const [booking, application] = await Promise.all([
    BookingRequest.findOne({
      company_id: companyId,
      freelancer_id: freelancerId,
      status: { $in: CONNECTED_BOOKING_STATUSES }
    }).select('requirement_id').lean(),
    Application.findOne({
      company_id: companyId,
      freelancer_id: freelancerId,
      status: { $in: CONNECTED_APPLICATION_STATUSES }
    }).select('requirement_id').lean()
  ]);

  const requirementIds = [booking?.requirement_id, application?.requirement_id]
    .filter(Boolean)
    .map(String);

  return {
    connected: Boolean(booking || application),
    via: booking ? 'booking' : application ? 'application' : null,
    requirement_ids: [...new Set(requirementIds)]
  };
};

/** Convenience boolean wrapper. */
export const areConnected = async (companyId, freelancerId) =>
  (await getConnection(companyId, freelancerId)).connected;

/**
 * Decides whether a company may send a booking request right now.
 *
 * This is deliberately NOT "once connected, never again". A connected pair is
 * blocked only from re-sending the SAME request:
 *
 *   - a pending request already exists            -> blocked (unchanged rule)
 *   - connected, and no requirement given         -> blocked, it is redundant;
 *                                                    they should just message
 *   - connected, but a NEW requirement_id         -> ALLOWED, this is new work
 *   - connected, and that same requirement is
 *     already accepted                            -> blocked as a duplicate
 *
 * @returns {Promise<{allowed: boolean, code?: string, message?: string,
 *                    conversation_id?: string}>}
 */
export const canSendBookingRequest = async (companyId, freelancerId, requirementId = null) => {
  const pending = await BookingRequest.findOne({
    company_id: companyId,
    freelancer_id: freelancerId,
    status: 'pending'
  }).select('_id').lean();

  if (pending) {
    return {
      allowed: false,
      code: 'DUPLICATE_BOOKING_REQUEST',
      message: 'A pending booking request already exists for this freelancer.'
    };
  }

  const connection = await getConnection(companyId, freelancerId);
  if (!connection.connected) return { allowed: true };

  // Connected. A brand-new requirement is legitimate future work.
  if (requirementId && !connection.requirement_ids.includes(String(requirementId))) {
    return { allowed: true };
  }

  const conversation = await findConversation(companyId, freelancerId);
  return {
    allowed: false,
    code: 'ALREADY_CONNECTED',
    message: requirementId
      ? 'You are already connected for this requirement. Message them instead.'
      : 'You are already connected with this professional. Message them instead.',
    conversation_id: conversation ? String(conversation._id) : null
  };
};

/** The one conversation for a pair, if it exists. */
export const findConversation = (companyId, freelancerId) =>
  Conversation.findOne({ company_id: companyId, freelancer_id: freelancerId });

/**
 * Returns the pair's conversation, creating it only if none exists.
 *
 * This is the single place a lifecycle event may open a conversation, so an
 * accepted booking and an accepted application can never produce two
 * conversations for the same pair.
 *
 * @returns {Promise<{conversation: object, created: boolean}>}
 */
export const ensureConversation = async (companyId, freelancerId, seed = {}) => {
  const existing = await findConversation(companyId, freelancerId);
  if (existing) return { conversation: existing, created: false };

  const conversation = await Conversation.create({
    company_id: companyId,
    freelancer_id: freelancerId,
    ...(seed.requirement_id ? { requirement_id: seed.requirement_id } : {}),
    ...(seed.booking_id ? { booking_id: seed.booking_id } : {})
  });

  return { conversation, created: true };
};

/**
 * Viewer-facing connection state for a professional's public profile.
 * Only ever describes the relationship between the caller and that
 * professional - it exposes no third-party data.
 */
export const getViewerConnectionState = async (viewer, freelancerId) => {
  if (!viewer || viewer.role !== 'company') return null;

  const companyId = viewer.id || viewer._id;
  const connection = await getConnection(companyId, freelancerId);
  const permission = await canSendBookingRequest(companyId, freelancerId, null);
  const conversation = connection.connected ? await findConversation(companyId, freelancerId) : null;

  return {
    connected: connection.connected,
    via: connection.via,
    can_request: permission.allowed,
    block_reason: permission.allowed ? null : permission.code,
    conversation_id: conversation ? String(conversation._id) : null
  };
};

export default {
  getConnection,
  areConnected,
  canSendBookingRequest,
  findConversation,
  ensureConversation,
  getViewerConnectionState
};
