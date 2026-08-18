import { getSubscriptionSummary, canChat } from '../services/subscriptionService.js';
import Plan from '../models/Plan.js';

/**
 * GET /api/subscriptions/me
 * The signed-in user's own subscription snapshot, used by the Company and
 * Freelancer dashboards to display Plan / Status / Expiry / Chat access.
 */
export const getMySubscription = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const summary = await getSubscriptionSummary(userId);
    res.json({ success: true, data: summary });
  } catch (error) {
    console.error('getMySubscription error:', error);
    res.status(500).json({ code: 'SERVER_ERROR', message: 'Failed to load subscription' });
  }
};

/**
 * GET /api/subscriptions/plans
 * Public-facing catalogue of active plans (no admin data exposed).
 */
export const getActivePlans = async (req, res) => {
  try {
    const plans = await Plan.find({ isActive: true })
      .select('name description price currency billing_period features limits sort_order')
      .sort({ sort_order: 1, price: 1 });
    res.json({ success: true, data: plans });
  } catch (error) {
    console.error('getActivePlans error:', error);
    res.status(500).json({ code: 'SERVER_ERROR', message: 'Failed to load plans' });
  }
};

/**
 * GET /api/subscriptions/chat-access/:otherUserId
 * Reports whether chat between the signed-in user and another user is unlocked.
 * The backend remains the authority; this only lets the UI explain the reason.
 */
export const getChatAccess = async (req, res) => {
  try {
    const userId = (req.user.id || req.user._id).toString();
    const { otherUserId } = req.params;

    const isCompany = req.user.role === 'company';
    const companyId = isCompany ? userId : otherUserId;
    const freelancerId = isCompany ? otherUserId : userId;

    const access = await canChat(companyId, freelancerId);
    res.json({
      success: true,
      data: {
        allowed: access.allowed,
        company_has_chat: access.companyHasChat,
        freelancer_has_chat: access.freelancerHasChat,
        reason: access.reason
      }
    });
  } catch (error) {
    console.error('getChatAccess error:', error);
    res.status(500).json({ code: 'SERVER_ERROR', message: 'Failed to check chat access' });
  }
};
