import Notification from '../models/Notification.js';

/**
 * Notification types that belong to the Messages/Chat system rather than the
 * system Notifications sidebar. Chat messages track unread state on the
 * conversation itself (Message.read_at), so they must never reach the global
 * notification list or unread badge.
 *
 * `locked_message` is deliberately NOT excluded: it is a subscription prompt
 * for a user who cannot open chat at all, so the sidebar is the only place they
 * can see it.
 *
 * Historic `new_message` rows created before this change are filtered out here
 * rather than deleted, so no existing data is destroyed.
 */
const CHAT_ONLY_TYPES = ['new_message'];

/** Base filter restricting results to the caller's non-chat notifications. */
const systemNotificationFilter = (userId) => ({
  recipient_id: userId,
  type: { $nin: CHAT_ONLY_TYPES }
});

export const getMyNotifications = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const notifications = await Notification.find(systemNotificationFilter(userId)).sort({ created_at: -1 });
    res.json({ success: true, data: notifications });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getUnreadCount = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const count = await Notification.countDocuments({
      ...systemNotificationFilter(userId),
      is_read: false
    });
    res.json({ success: true, count });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const markAsRead = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, recipient_id: userId },
      { is_read: true },
      { new: true }
    );
    res.json({ success: true, data: notification });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const markAllAsRead = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    await Notification.updateMany(
      { ...systemNotificationFilter(userId), is_read: false },
      { is_read: true }
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};