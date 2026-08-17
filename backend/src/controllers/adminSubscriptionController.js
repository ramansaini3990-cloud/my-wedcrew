import Subscription from '../models/Subscription.js';
import Plan from '../models/Plan.js';

export const getAllSubscriptions = async (req, res) => {
  try {
    const subscriptions = await Subscription.find().populate('user_id', 'name email role').populate('planId');
    res.json(subscriptions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getPlans = async (req, res) => {
  try {
    const plans = await Plan.find();
    res.json(plans);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const createPlan = async (req, res) => {
  try {
    const existingPlan = await Plan.findOne({ name: req.body.name });
    if (existingPlan) {
      return res.status(200).json(existingPlan);
    }
    const plan = new Plan(req.body);
    await plan.save();
    res.status(201).json(plan);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const assignSubscription = async (req, res) => {
  try {
    const { user_id, planId, start_date, end_date, amount } = req.body;
    const plan = await Plan.findById(planId);
    
    if (!plan) return res.status(404).json({ message: 'Plan not found' });

    const subscription = new Subscription({
      user_id,
      planId,
      plan_name: plan.name,
      amount: amount || plan.price,
      start_date,
      end_date,
      payment_status: 'paid',
      status: 'active',
      source: 'ADMIN'
    });

    await subscription.save();
    res.status(201).json(subscription);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const updateSubscriptionStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    const subscription = await Subscription.findByIdAndUpdate(id, { status }, { new: true });
    if (!subscription) return res.status(404).json({ message: 'Subscription not found' });
    
    res.json(subscription);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
