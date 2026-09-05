import mongoose from 'mongoose';
import Message from '../models/Message.js';

/**
 * Aggregation pipelines bypass Mongoose schema casting, so ids coming from a
 * JWT (plain strings) must be converted explicitly or `$match` silently
 * matches nothing.
 */
const toObjectId = (value) => {
  if (!value) return null;
  if (value instanceof mongoose.Types.ObjectId) return value;
  return mongoose.Types.ObjectId.isValid(value) ? new mongoose.Types.ObjectId(String(value)) : null;
};

/**
 * Single source of truth for chat unread state.
 *
 * Unread tracking reuses the pre-existing `Message.read_at` field - no new
 * model, collection or duplicate messaging system is introduced. A message is
 * unread for a user when they are its `receiver_id` and `read_at` is still null.
 *
 * Counts are always computed from the database, never incremented in memory, so
 * duplicate socket events, reconnects or repeated requests cannot double-count.
 */

/** Unread message count for one user in one conversation. */
export const countUnreadForConversation = async (conversationId, userId) => {
  if (!conversationId || !userId) return 0;
  return Message.countDocuments({
    conversation_id: conversationId,
    receiver_id: userId,
    read_at: null
  });
};

/**
 * Unread counts for a user across many conversations in a single query.
 * @returns {Promise<Record<string, number>>} conversationId -> unread count
 */
export const getUnreadCountsByConversation = async (conversationIds, userId) => {
  const map = {};
  if (!userId || !conversationIds || conversationIds.length === 0) return map;

  const receiverId = toObjectId(userId);
  const convIds = conversationIds.map(toObjectId).filter(Boolean);
  if (!receiverId || convIds.length === 0) return map;

  const rows = await Message.aggregate([
    {
      $match: {
        conversation_id: { $in: convIds },
        receiver_id: receiverId,
        read_at: null
      }
    },
    { $group: { _id: '$conversation_id', count: { $sum: 1 } } }
  ]);

  for (const row of rows) {
    map[String(row._id)] = row.count;
  }
  return map;
};

/**
 * Marks every unread message the user has RECEIVED in this conversation as read.
 * Only the caller's own messages are touched, so opening conversation A can
 * never affect conversation B or the other participant's unread state.
 *
 * Idempotent: re-running it matches nothing and modifies nothing.
 *
 * @returns {Promise<number>} how many messages were newly marked read
 */
export const markConversationRead = async (conversationId, userId) => {
  if (!conversationId || !userId) return 0;
  const result = await Message.updateMany(
    { conversation_id: conversationId, receiver_id: userId, read_at: null },
    { $set: { read_at: new Date() } }
  );
  return result.modifiedCount || 0;
};


/**
 * Total unread messages for a user across every conversation.
 *
 * Powers the sidebar "Messages" badge. Computed from the same `read_at`
 * field as the per-conversation counts, so the badge and the conversation
 * list can never disagree.
 */
export const countTotalUnread = async (userId) => {
  const receiverId = toObjectId(userId);
  if (!receiverId) return 0;
  return Message.countDocuments({ receiver_id: receiverId, read_at: null });
};

export default {
  countUnreadForConversation,
  countTotalUnread,
  getUnreadCountsByConversation,
  markConversationRead
};
