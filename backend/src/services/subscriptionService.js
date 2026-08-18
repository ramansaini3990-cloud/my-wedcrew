import Subscription from '../models/Subscription.js';
import Plan from '../models/Plan.js';

/**
 * Central authority for subscription + feature access.
 *
 * Every protected feature (chat, etc.) MUST go through this service.
 * The frontend is never the authority - it only renders what this service reports.
 */

/** Predictable error codes returned to the client. */
export const SUBSCRIPTION_ERRORS = {
  SUBSCRIPTION_REQUIRED: {
    code: 'SUBSCRIPTION_REQUIRED',
    message: 'An active subscription is required to access this feature.'
  },
  CHAT_SUBSCRIPTION_REQUIRED: {
    code: 'SUBSCRIPTION_REQUIRED',
    message: 'An active subscription with chat enabled is required for both users to access chat.'
  },
  FEATURE_NOT_IN_PLAN: {
    code: 'FEATURE_NOT_IN_PLAN',
    message: 'Your current plan does not include this feature.'
  },
  LIMIT_REACHED: {
    code: 'LIMIT_REACHED',
    message: 'You have reached the limit for this feature on your current plan.'
  }
};

/** Statuses that can never grant access again without an admin action. */
const TERMINAL_STATUSES = ['expired', 'cancelled'];

/**
 * Legacy plan names that implicitly granted chat before the Plan model existed.
 * Kept so historical subscriptions keep working.
 */
const LEGACY_CHAT_PLAN_NAMES = ['Professional', 'PREMIUM', 'PRO'];

const now = () => new Date();

/**
 * Lazily flags a subscription as expired when its end date has passed.
 * This keeps what the Admin sees identical to what access control enforces,
 * without requiring a cron job to have run first.
 */
const expireIfPastDue = async (subscription) => {
  if (!subscription) return subscription;
  if (subscription.status === 'active' && subscription.end_date && subscription.end_date < now()) {
    subscription.status = 'expired';
    await Subscription.updateOne({ _id: subscription._id }, { $set: { status: 'expired' } });
  }
  return subscription;
};

/**
 * Resolves the single effective subscription for a user.
 *
 * A user may historically hold more than one subscription row. The effective one is:
 *   1. an active, not-yet-expired subscription (latest end_date wins), otherwise
 *   2. the most recently created subscription, so the UI can still show
 *      "EXPIRED" / "CANCELLED" / "PAUSED" instead of showing nothing.
 *
 * Returns a mongoose document (or null) with `planId` populated.
 */
export const getEffectiveSubscription = async (userId) => {
  if (!userId) return null;

  const subscriptions = await Subscription.find({ user_id: userId })
    .populate('planId')
    .sort({ end_date: -1, created_at: -1 });

  if (!subscriptions.length) return null;

  // Lazily expire anything past due so status is always truthful.
  for (const sub of subscriptions) {
    await expireIfPastDue(sub);
  }

  const usable = subscriptions.find(
    (s) => s.status === 'active' && s.end_date && s.end_date >= now()
  );

  return usable || subscriptions[0];
};

/**
 * True when the user currently holds a usable subscription.
 * Does NOT consider which features the plan grants - use hasFeature for that.
 */
export const hasActiveSubscription = async (userId) => {
  const subscription = await getEffectiveSubscription(userId);
  return Boolean(
    subscription && subscription.status === 'active' && subscription.end_date >= now()
  );
};

/** Reads the feature list off a subscription's plan, with legacy fallbacks. */
const planFeatures = (subscription) => {
  if (!subscription) return [];
  if (subscription.planId && Array.isArray(subscription.planId.features)) {
    return subscription.planId.features;
  }
  return [];
};

/**
 * Central feature check. Backend MUST call this before allowing a protected action.
 *
 * @param {string} userId
 * @param {string} featureName e.g. 'chat'
 * @returns {Promise<boolean>}
 */
export const hasFeature = async (userId, featureName) => {
  const subscription = await getEffectiveSubscription(userId);

  if (!subscription) return false;
  if (subscription.status !== 'active') return false;
  if (!subscription.end_date || subscription.end_date < now()) return false;

  if (planFeatures(subscription).includes(featureName)) return true;

  // Backward compatibility for subscriptions created before Plan.features existed.
  if (featureName === 'chat' && LEGACY_CHAT_PLAN_NAMES.includes(subscription.plan_name)) {
    // Only trust the legacy name when no plan document is attached; if a plan
    // exists it is the authority and has already been checked above.
    if (!subscription.planId) return true;
  }

  return false;
};

/**
 * Reads a numeric limit from the user's plan (e.g. 'applications').
 * Returns `null` when the plan does not define the limit (treat as unlimited).
 */
export const getLimit = async (userId, limitName) => {
  const subscription = await getEffectiveSubscription(userId);
  if (!subscription || subscription.status !== 'active') return 0;

  const limits = subscription.planId && subscription.planId.limits;
  if (!limits) return null;

  const value = limits instanceof Map ? limits.get(limitName) : limits[limitName];
  return value === undefined ? null : value;
};

/**
 * Chat requires BOTH participants to hold an active subscription whose plan
 * includes the `chat` feature. Single source of truth for REST + Socket.IO.
 *
 * @returns {Promise<{allowed: boolean, companyHasChat: boolean, freelancerHasChat: boolean, reason: string|null}>}
 */
export const canChat = async (companyId, freelancerId) => {
  const [companyHasChat, freelancerHasChat] = await Promise.all([
    hasFeature(companyId, 'chat'),
    hasFeature(freelancerId, 'chat')
  ]);

  let reason = null;
  if (!companyHasChat && !freelancerHasChat) {
    reason = 'Neither participant has an active subscription with chat enabled.';
  } else if (!companyHasChat) {
    reason = 'The company does not have an active subscription with chat enabled.';
  } else if (!freelancerHasChat) {
    reason = 'The freelancer does not have an active subscription with chat enabled.';
  }

  return {
    allowed: companyHasChat && freelancerHasChat,
    companyHasChat,
    freelancerHasChat,
    reason
  };
};

/**
 * Serialisable snapshot of a user's subscription, used by dashboards and the
 * Admin subscription table. Always safe to expose to the owning user / admin.
 */
export const getSubscriptionSummary = async (userId) => {
  const subscription = await getEffectiveSubscription(userId);

  if (!subscription) {
    return {
      has_subscription: false,
      subscription_id: null,
      plan_id: null,
      plan_name: null,
      status: 'none',
      is_active: false,
      start_date: null,
      end_date: null,
      days_remaining: null,
      features: [],
      chat_enabled: false,
      source: null,
      amount: null
    };
  }

  const isActive = subscription.status === 'active' && subscription.end_date >= now();
  const features = planFeatures(subscription);
  const chatEnabled =
    isActive &&
    (features.includes('chat') ||
      (!subscription.planId && LEGACY_CHAT_PLAN_NAMES.includes(subscription.plan_name)));

  const daysRemaining = subscription.end_date
    ? Math.max(0, Math.ceil((subscription.end_date - now()) / (1000 * 60 * 60 * 24)))
    : null;

  return {
    has_subscription: true,
    subscription_id: subscription._id.toString(),
    plan_id: subscription.planId ? subscription.planId._id.toString() : null,
    plan_name: subscription.plan_name,
    status: subscription.status,
    is_active: isActive,
    start_date: subscription.start_date,
    end_date: subscription.end_date,
    days_remaining: isActive ? daysRemaining : 0,
    features,
    chat_enabled: chatEnabled,
    source: subscription.source,
    amount: subscription.amount
  };
};

/**
 * Bulk sweep that flips past-due active subscriptions to `expired`.
 * Safe to call on boot and from a scheduled job.
 */
export const evaluateSubscriptionStatus = async () => {
  const result = await Subscription.updateMany(
    { status: 'active', end_date: { $lt: now() } },
    { $set: { status: 'expired' } }
  );
  return result.modifiedCount || 0;
};

/**
 * Marks every other non-terminal subscription of a user as cancelled, so a user
 * only ever has one effective subscription. Called whenever the admin assigns a
 * new plan or activates a subscription.
 */
export const supersedeOtherSubscriptions = async (userId, keepSubscriptionId) => {
  const result = await Subscription.updateMany(
    {
      user_id: userId,
      _id: { $ne: keepSubscriptionId },
      status: { $nin: TERMINAL_STATUSES }
    },
    { $set: { status: 'cancelled', cancelled_at: now() } }
  );
  return result.modifiedCount || 0;
};

/** Applies a terminal status to every non-terminal subscription of a user. */
export const terminateAllSubscriptions = async (userId, status) => {
  const update = { status };
  if (status === 'cancelled') update.cancelled_at = now();

  const result = await Subscription.updateMany(
    { user_id: userId, status: { $nin: TERMINAL_STATUSES } },
    { $set: update }
  );
  return result.modifiedCount || 0;
};

export { TERMINAL_STATUSES };

export default {
  hasFeature,
  hasActiveSubscription,
  getEffectiveSubscription,
  getSubscriptionSummary,
  getLimit,
  canChat,
  evaluateSubscriptionStatus,
  supersedeOtherSubscriptions,
  terminateAllSubscriptions,
  SUBSCRIPTION_ERRORS
};
