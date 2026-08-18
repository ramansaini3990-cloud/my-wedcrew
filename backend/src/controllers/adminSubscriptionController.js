import Subscription from '../models/Subscription.js';
import Plan from '../models/Plan.js';
import User from '../models/User.js';
import {
  getSubscriptionSummary,
  supersedeOtherSubscriptions,
  terminateAllSubscriptions,
  evaluateSubscriptionStatus
} from '../services/subscriptionService.js';
import { DEFAULT_PLANS } from '../config/defaultPlans.js';

const now = () => new Date();

const addDays = (date, days) => {
  const d = new Date(date);
  d.setDate(d.getDate() + Number(days));
  return d;
};

/**
 * GET /api/admin/subscriptions
 * Raw subscription rows (kept for backward compatibility).
 */
export const getAllSubscriptions = async (req, res) => {
  try {
    await evaluateSubscriptionStatus();
    const subscriptions = await Subscription.find()
      .populate('user_id', 'name email role')
      .populate('planId')
      .sort({ created_at: -1 });
    res.json(subscriptions);
  } catch (error) {
    console.error('getAllSubscriptions error:', error);
    res.status(500).json({ code: 'SERVER_ERROR', message: 'Failed to load subscriptions' });
  }
};

/**
 * GET /api/admin/subscriptions/overview?search=&role=&status=
 *
 * One row per company/freelancer (admins excluded) joined with their effective
 * subscription. Users with no subscription are included so the admin can assign
 * one. This is what the Admin -> Subscriptions table renders.
 */
export const getSubscriptionOverview = async (req, res) => {
  try {
    await evaluateSubscriptionStatus();

    const { search = '', role = '', status = '' } = req.query;

    const userQuery = { role: { $in: ['company', 'freelancer'] } };
    if (role === 'company' || role === 'freelancer') {
      userQuery.role = role;
    }
    if (search.trim()) {
      const rx = new RegExp(search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      userQuery.$or = [{ name: rx }, { email: rx }, { phone: rx }];
    }

    const users = await User.find(userQuery)
      .select('name email phone role city created_at')
      .sort({ created_at: -1 })
      .lean();

    const rows = [];
    for (const user of users) {
      const summary = await getSubscriptionSummary(user._id);
      rows.push({
        user_id: user._id.toString(),
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        city: user.city || null,
        subscription: summary
      });
    }

    const filtered = status
      ? rows.filter((r) => (r.subscription.status || 'none') === status)
      : rows;

    res.json({ success: true, data: filtered, total: filtered.length });
  } catch (error) {
    console.error('getSubscriptionOverview error:', error);
    res.status(500).json({ code: 'SERVER_ERROR', message: 'Failed to load subscription overview' });
  }
};

/** GET /api/admin/subscriptions/user/:userId - full history for one user. */
export const getUserSubscriptionHistory = async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId).select('name email role');
    if (!user) return res.status(404).json({ code: 'USER_NOT_FOUND', message: 'User not found' });

    const history = await Subscription.find({ user_id: userId })
      .populate('planId')
      .sort({ created_at: -1 });

    const summary = await getSubscriptionSummary(userId);
    res.json({ success: true, user, current: summary, history });
  } catch (error) {
    console.error('getUserSubscriptionHistory error:', error);
    res.status(500).json({ code: 'SERVER_ERROR', message: 'Failed to load subscription history' });
  }
};

/* ------------------------------------------------------------------ */
/* Plans                                                               */
/* ------------------------------------------------------------------ */

export const getPlans = async (req, res) => {
  try {
    const plans = await Plan.find().sort({ sort_order: 1, price: 1 });
    res.json(plans);
  } catch (error) {
    console.error('getPlans error:', error);
    res.status(500).json({ code: 'SERVER_ERROR', message: 'Failed to load plans' });
  }
};

export const createPlan = async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Plan name is required' });

    const existingPlan = await Plan.findOne({ name });
    if (existingPlan) return res.status(200).json(existingPlan);

    const plan = new Plan(req.body);
    await plan.save();
    res.status(201).json(plan);
  } catch (error) {
    console.error('createPlan error:', error);
    res.status(500).json({ code: 'SERVER_ERROR', message: 'Failed to create plan' });
  }
};

/** PUT /api/admin/plans/:id - make pricing/features configurable from Admin. */
export const updatePlan = async (req, res) => {
  try {
    const allowed = [
      'name', 'description', 'price', 'currency', 'billing_period',
      'features', 'limits', 'isActive', 'sort_order'
    ];
    const update = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) update[key] = req.body[key];
    }
    if (req.body.is_active !== undefined) update.isActive = req.body.is_active;

    const plan = await Plan.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true });
    if (!plan) return res.status(404).json({ code: 'PLAN_NOT_FOUND', message: 'Plan not found' });

    // Keep denormalised plan_name on subscriptions in sync.
    if (update.name) {
      await Subscription.updateMany({ planId: plan._id }, { $set: { plan_name: plan.name } });
    }

    res.json(plan);
  } catch (error) {
    console.error('updatePlan error:', error);
    res.status(500).json({ code: 'SERVER_ERROR', message: 'Failed to update plan' });
  }
};

/**
 * POST /api/admin/plans/seed-defaults
 * Creates the FREE / PRO / PREMIUM plans if they are missing. Idempotent.
 */
export const seedDefaultPlans = async (req, res) => {
  try {
    const created = [];
    const skipped = [];

    for (const definition of DEFAULT_PLANS) {
      const existing = await Plan.findOne({ name: definition.name });
      if (existing) {
        skipped.push(existing.name);
        continue;
      }
      const plan = await Plan.create(definition);
      created.push(plan.name);
    }

    const plans = await Plan.find().sort({ sort_order: 1, price: 1 });
    res.status(201).json({ success: true, created, skipped, plans });
  } catch (error) {
    console.error('seedDefaultPlans error:', error);
    res.status(500).json({ code: 'SERVER_ERROR', message: 'Failed to seed default plans' });
  }
};

/* ------------------------------------------------------------------ */
/* Subscriptions - manual admin control                                */
/* ------------------------------------------------------------------ */

/**
 * POST /api/admin/subscriptions
 * Assigns a plan to a user. Any previous non-terminal subscription for that
 * user is superseded so a user always has exactly one effective subscription.
 */
export const assignSubscription = async (req, res) => {
  try {
    const { user_id, planId, start_date, end_date, amount, notes } = req.body;

    if (!user_id || !planId) {
      return res.status(400).json({ code: 'VALIDATION_ERROR', message: 'user_id and planId are required' });
    }

    const user = await User.findById(user_id);
    if (!user) return res.status(404).json({ code: 'USER_NOT_FOUND', message: 'User not found' });
    if (user.role === 'admin') {
      return res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Admins do not require a subscription' });
    }

    const plan = await Plan.findById(planId);
    if (!plan) return res.status(404).json({ code: 'PLAN_NOT_FOUND', message: 'Plan not found' });

    const startsAt = start_date ? new Date(start_date) : now();
    const endsAt = end_date ? new Date(end_date) : addDays(startsAt, 30);

    if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
      return res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Invalid start or end date' });
    }
    if (endsAt <= startsAt) {
      return res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Expiry date must be after the start date' });
    }

    const subscription = new Subscription({
      user_id,
      planId,
      plan_name: plan.name,
      amount: amount !== undefined && amount !== '' ? Number(amount) : plan.price,
      start_date: startsAt,
      end_date: endsAt,
      // Manually granted: no money changed hands, but access is fully granted.
      payment_status: 'paid',
      status: endsAt >= now() ? 'active' : 'expired',
      source: 'ADMIN',
      notes
    });

    await subscription.save();
    await supersedeOtherSubscriptions(user_id, subscription._id);

    const summary = await getSubscriptionSummary(user_id);
    res.status(201).json({ success: true, data: subscription, subscription: summary });
  } catch (error) {
    console.error('assignSubscription error:', error);
    res.status(500).json({ code: 'SERVER_ERROR', message: 'Failed to assign subscription' });
  }
};

/**
 * PUT /api/admin/subscriptions/:id/status
 * body: { status: 'active' | 'paused' | 'cancelled' | 'expired' }
 *
 * Activating supersedes the user's other subscriptions; terminating applies to
 * every non-terminal subscription of the user, so "Deactivate" genuinely
 * removes access even for legacy duplicate rows.
 */
export const updateSubscriptionStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['active', 'paused', 'cancelled', 'expired'].includes(status)) {
      return res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Invalid subscription status' });
    }

    const subscription = await Subscription.findById(id);
    if (!subscription) {
      return res.status(404).json({ code: 'SUBSCRIPTION_NOT_FOUND', message: 'Subscription not found' });
    }

    if (status === 'active') {
      // Reactivating a lapsed subscription needs a future expiry to be usable.
      if (!subscription.end_date || subscription.end_date < now()) {
        return res.status(400).json({
          code: 'EXPIRY_IN_PAST',
          message: 'Expiry date is in the past. Extend the subscription before activating it.'
        });
      }
      subscription.status = 'active';
      subscription.cancelled_at = undefined;
      await subscription.save();
      await supersedeOtherSubscriptions(subscription.user_id, subscription._id);
    } else if (status === 'paused') {
      subscription.status = 'paused';
      await subscription.save();
    } else {
      // cancelled / expired -> terminate everything so access is truly revoked.
      subscription.status = status;
      if (status === 'cancelled') subscription.cancelled_at = now();
      await subscription.save();
      await terminateAllSubscriptions(subscription.user_id, status);
    }

    const summary = await getSubscriptionSummary(subscription.user_id);
    res.json({ success: true, data: subscription, subscription: summary });
  } catch (error) {
    console.error('updateSubscriptionStatus error:', error);
    res.status(500).json({ code: 'SERVER_ERROR', message: 'Failed to update subscription status' });
  }
};

/**
 * PUT /api/admin/subscriptions/:id/extend
 * body: { days } or { end_date }
 * Reactivates the subscription when the new expiry is in the future.
 */
export const extendSubscription = async (req, res) => {
  try {
    const { id } = req.params;
    const { days, end_date } = req.body;

    const subscription = await Subscription.findById(id);
    if (!subscription) {
      return res.status(404).json({ code: 'SUBSCRIPTION_NOT_FOUND', message: 'Subscription not found' });
    }

    let newEnd;
    if (end_date) {
      newEnd = new Date(end_date);
    } else if (days) {
      // Extend from today when already lapsed, otherwise from the current expiry.
      const base = subscription.end_date > now() ? subscription.end_date : now();
      newEnd = addDays(base, days);
    } else {
      return res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Provide either days or end_date' });
    }

    if (Number.isNaN(newEnd.getTime())) {
      return res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Invalid expiry date' });
    }
    if (newEnd <= subscription.start_date) {
      return res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Expiry date must be after the start date' });
    }

    subscription.end_date = newEnd;

    // Extending past today reactivates an expired subscription (TEST 9).
    if (newEnd >= now() && ['expired', 'paused'].includes(subscription.status)) {
      subscription.status = 'active';
      subscription.cancelled_at = undefined;
    }
    await subscription.save();

    if (subscription.status === 'active') {
      await supersedeOtherSubscriptions(subscription.user_id, subscription._id);
    }

    const summary = await getSubscriptionSummary(subscription.user_id);
    res.json({ success: true, data: subscription, subscription: summary });
  } catch (error) {
    console.error('extendSubscription error:', error);
    res.status(500).json({ code: 'SERVER_ERROR', message: 'Failed to extend subscription' });
  }
};

/**
 * PUT /api/admin/subscriptions/:id/plan
 * body: { planId, amount? } - swaps the plan in place, keeping the dates.
 */
export const changeSubscriptionPlan = async (req, res) => {
  try {
    const { id } = req.params;
    const { planId, amount } = req.body;

    if (!planId) {
      return res.status(400).json({ code: 'VALIDATION_ERROR', message: 'planId is required' });
    }

    const subscription = await Subscription.findById(id);
    if (!subscription) {
      return res.status(404).json({ code: 'SUBSCRIPTION_NOT_FOUND', message: 'Subscription not found' });
    }

    const plan = await Plan.findById(planId);
    if (!plan) return res.status(404).json({ code: 'PLAN_NOT_FOUND', message: 'Plan not found' });

    subscription.planId = plan._id;
    subscription.plan_name = plan.name;
    if (amount !== undefined && amount !== '') subscription.amount = Number(amount);
    await subscription.save();

    const summary = await getSubscriptionSummary(subscription.user_id);
    res.json({ success: true, data: subscription, subscription: summary });
  } catch (error) {
    console.error('changeSubscriptionPlan error:', error);
    res.status(500).json({ code: 'SERVER_ERROR', message: 'Failed to change plan' });
  }
};

/**
 * PUT /api/admin/subscriptions/:id/dates
 * body: { start_date?, end_date? } - manual date correction.
 */
export const updateSubscriptionDates = async (req, res) => {
  try {
    const { id } = req.params;
    const { start_date, end_date } = req.body;

    const subscription = await Subscription.findById(id);
    if (!subscription) {
      return res.status(404).json({ code: 'SUBSCRIPTION_NOT_FOUND', message: 'Subscription not found' });
    }

    if (start_date) subscription.start_date = new Date(start_date);
    if (end_date) subscription.end_date = new Date(end_date);

    if (Number.isNaN(subscription.start_date.getTime()) || Number.isNaN(subscription.end_date.getTime())) {
      return res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Invalid date supplied' });
    }
    if (subscription.end_date <= subscription.start_date) {
      return res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Expiry date must be after the start date' });
    }

    if (subscription.end_date < now() && subscription.status === 'active') {
      subscription.status = 'expired';
    }
    await subscription.save();

    const summary = await getSubscriptionSummary(subscription.user_id);
    res.json({ success: true, data: subscription, subscription: summary });
  } catch (error) {
    console.error('updateSubscriptionDates error:', error);
    res.status(500).json({ code: 'SERVER_ERROR', message: 'Failed to update subscription dates' });
  }
};
