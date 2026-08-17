import Requirement from '../models/Requirement.js';
import Subscription from '../models/Subscription.js';

// Helper function to check if user has active subscription
const hasActiveSubscription = async (userId) => {
  try {
    const sub = await Subscription.findOne({
      user_id: userId,
      payment_status: 'paid',
      end_date: { $gte: new Date() }
    }).sort({ end_date: -1 });
    
    return !!sub;
  } catch (error) {
    console.error('Subscription check error:', error);
    return false;
  }
};

// @desc    Create a new requirement
// @route   POST /api/requirements
// @access  Private (Company)
export const createRequirement = async (req, res) => {
  try {
    if (req.user.role !== 'company') {
      return res.status(403).json({ message: 'Only companies can post requirements' });
    }

    const {
      state, city, event_date, end_date, category, quantity, payment_per_freelancer,
      number_of_days, event_type, venue, working_hours, accommodation, travel, food,
      description, status
    } = req.body;

    if (!state || !city || !event_date || !end_date || !category || !quantity || !payment_per_freelancer || !number_of_days) {
      return res.status(400).json({ message: 'Please provide all required fields' });
    }

    const requirement = await Requirement.create({
      company_id: req.user.id,
      state, city, event_date, end_date, category, quantity,
      payment_per_freelancer, number_of_days, 
      event_type: event_type || null, 
      venue: venue || null, 
      working_hours: working_hours || null,
      accommodation: accommodation || false, 
      travel: travel || false, 
      food: food || false, 
      description: description || null,
      status: status || 'draft'
    });

    res.status(201).json({
      message: 'Requirement created successfully',
      requirementId: requirement.id
    });
  } catch (error) {
    console.error('Create requirement error:', error);
    res.status(500).json({ message: 'Server error creating requirement' });
  }
};

// @desc    Get all published requirements
// @route   GET /api/requirements
// @access  Public
export const getRequirements = async (req, res) => {
  try {
    // Pagination & Filters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 100;
    const skip = (page - 1) * limit;

    const query = { status: 'published' };

    // Apply filters
    if (req.query.city) query.city = req.query.city;
    if (req.query.category) query.category = req.query.category;
    if (req.query.date) query.event_date = req.query.date;

    const requirements = await Requirement.find(query)
      .populate('company_id', 'name')
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(limit)
      .lean({ virtuals: true });

    const total = await Requirement.countDocuments(query);

    // Subscription Guard
    let isSubscribed = false;
    if (req.user && req.user.role === 'admin') {
      isSubscribed = true;
    } else if (req.user && req.user.role === 'company') {
      isSubscribed = true;
    } else if (req.user && req.user.role === 'freelancer') {
      isSubscribed = await hasActiveSubscription(req.user.id);
    }

    // Mask data if not subscribed
    const processedRequirements = requirements.map(reqData => {
      // Reformat populated company
      const company_name = reqData.company_id?.name;
      const id = reqData.id || reqData._id?.toString();
      const formattedReq = { ...reqData, company_name, id };
      // Map company_id back to ID only if desired to keep shape similar
      formattedReq.company_id = reqData.company_id?.id || reqData.company_id?._id;

      // If user is the owner, they see everything
      if (req.user && req.user.id === formattedReq.company_id?.toString()) {
        return { ...formattedReq, hasAccess: true };
      }

      if (!isSubscribed) {
        return {
          ...formattedReq,
          company_name: 'Premium Member',
          venue: 'Location Hidden (Subscribe to view)',
          payment_per_freelancer: 'Hidden',
          description: formattedReq.description ? formattedReq.description.substring(0, 50) + '... (Subscribe to read more)' : null,
          hasAccess: false
        };
      }
      return { ...formattedReq, hasAccess: true };
    });

    res.json({
      data: processedRequirements,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get requirements error:', error);
    res.status(500).json({ message: 'Server error fetching requirements' });
  }
};

// @desc    Get single requirement
// @route   GET /api/requirements/:id
// @access  Public
export const getRequirementById = async (req, res) => {
  try {
    const reqData = await Requirement.findById(req.params.id)
      .populate('company_id', 'name')
      .lean({ virtuals: true });

    if (!reqData) {
      return res.status(404).json({ message: 'Requirement not found' });
    }

    const requirement = { ...reqData, company_name: reqData.company_id?.name };
    requirement.company_id = reqData.company_id?.id || reqData.company_id?._id;

    // Subscription Guard
    let isSubscribed = false;
    if (req.user && req.user.role === 'admin') {
      isSubscribed = true;
    } else if (req.user && req.user.id === requirement.company_id?.toString()) {
      isSubscribed = true;
    } else if (req.user && req.user.role === 'freelancer') {
      isSubscribed = await hasActiveSubscription(req.user.id);
    } else if (req.user && req.user.role === 'company') {
      isSubscribed = true;
    }

    if (!isSubscribed) {
      requirement.company_name = 'Premium Member';
      requirement.venue = 'Location Hidden (Subscribe to view)';
      requirement.payment_per_freelancer = 'Hidden';
      if (requirement.description) {
        requirement.description = requirement.description.substring(0, 50) + '... (Subscribe to read more)';
      }
      requirement.hasAccess = false;
    } else {
      requirement.hasAccess = true;
    }

    res.json(requirement);
  } catch (error) {
    console.error('Get requirement error:', error);
    res.status(500).json({ message: 'Server error fetching requirement' });
  }
};

// @desc    Update requirement
// @route   PUT /api/requirements/:id
// @access  Private (Company Owner)
export const updateRequirement = async (req, res) => {
  try {
    const requirement = await Requirement.findById(req.params.id);
    
    if (!requirement) {
      return res.status(404).json({ message: 'Requirement not found' });
    }

    if (requirement.company_id.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to update this requirement' });
    }

    const {
      state, city, event_date, end_date, category, quantity, payment_per_freelancer,
      number_of_days, event_type, venue, working_hours, accommodation, travel, food,
      description, status
    } = req.body;

    await Requirement.findByIdAndUpdate(req.params.id, {
      state, city, event_date, end_date, category, quantity, payment_per_freelancer,
      number_of_days, event_type, venue, working_hours, accommodation, travel, food,
      description, status
    });

    res.json({ message: 'Requirement updated successfully' });
  } catch (error) {
    console.error('Update requirement error:', error);
    res.status(500).json({ message: 'Server error updating requirement' });
  }
};

// @desc    Update requirement status
// @route   PATCH /api/requirements/:id/status
// @access  Private (Company Owner)
export const updateRequirementStatus = async (req, res) => {
  try {
    const requirement = await Requirement.findById(req.params.id);
    
    if (!requirement) {
      return res.status(404).json({ message: 'Requirement not found' });
    }

    if (requirement.company_id.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to update this requirement' });
    }

    const { status } = req.body;
    
    if (!['draft', 'published', 'closed'].includes(status)) {
       return res.status(400).json({ message: 'Invalid status' });
    }

    requirement.status = status;
    await requirement.save();

    res.json({ message: 'Requirement status updated successfully', requirement });
  } catch (error) {
    console.error('Update requirement status error:', error);
    res.status(500).json({ message: 'Server error updating requirement status' });
  }
};

// @desc    Delete requirement
// @route   DELETE /api/requirements/:id
// @access  Private (Company Owner or Admin)
export const deleteRequirement = async (req, res) => {
  try {
    const requirement = await Requirement.findById(req.params.id);
    
    if (!requirement) {
      return res.status(404).json({ message: 'Requirement not found' });
    }

    if (requirement.company_id.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to delete this requirement' });
    }

    await Requirement.findByIdAndDelete(req.params.id);

    res.json({ message: 'Requirement deleted successfully' });
  } catch (error) {
    console.error('Delete requirement error:', error);
    res.status(500).json({ message: 'Server error deleting requirement' });
  }
};

// @desc    Get company's own requirements
// @route   GET /api/requirements/me
// @access  Private (Company)
export const getMyRequirements = async (req, res) => {
  try {
    if (req.user.role !== 'company') {
      return res.status(403).json({ message: 'Only companies can access this endpoint' });
    }

    const requirements = await Requirement.find({ company_id: req.user.id })
      .populate('company_id', 'name')
      .sort({ created_at: -1 })
      .lean({ virtuals: true });
    
    console.log(`[getMyRequirements] found ${requirements.length} for user ${req.user.id}`);

    const formattedRequirements = requirements.map(reqData => {
      const company_name = reqData.company_id?.name;
      const company_id = reqData.company_id?.id || reqData.company_id?._id;
      const id = reqData.id || reqData._id?.toString();
      return { ...reqData, company_name, company_id, id };
    });

    res.json({ data: formattedRequirements });
  } catch (error) {
    console.error('Get my requirements error:', error);
    res.status(500).json({ message: 'Server error fetching your requirements' });
  }
};

