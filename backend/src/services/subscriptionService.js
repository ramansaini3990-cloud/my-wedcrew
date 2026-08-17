import Subscription from '../models/Subscription.js';
import Plan from '../models/Plan.js';

export const hasFeature = async (userId, featureName) => {
  const activeSubscription = await Subscription.findOne({
    user_id: userId,
    status: 'active',
    end_date: { $gte: new Date() }
  }).populate('planId');

  if (!activeSubscription) {
    return false;
  }

  if (activeSubscription.planId && activeSubscription.planId.features.includes(featureName)) {
    return true;
  }

  // Backward compatibility for old plans
  if (activeSubscription.plan_name === 'Professional' && featureName === 'chat') {
    return true;
  }

  return false;
};

export const evaluateSubscriptionStatus = async () => {
  // Can be called by a cron job to update expired subscriptions
  const now = new Date();
  await Subscription.updateMany(
    { status: 'active', end_date: { $lt: now } },
    { $set: { status: 'expired' } }
  );
};
