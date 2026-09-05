import Requirement from '../../models/Requirement.js';
import { stringFilter, enumFilter } from '../../services/queryFilters.js';

// @desc    Get all requirements for admin
// @route   GET /api/admin/requirements
// @access  Private/Admin
export const getAdminRequirements = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const query = {};

    // Filters.
    //
    // Coerced rather than assigned: Express's extended query parser turns
    // `?status[$ne]=draft` into a live Mongo operator object. This list is
    // unscoped - it deliberately returns drafts too - so an injected operator
    // here is a query-rewriting primitive on the whole collection.
    //
    // `status` is validated against the enum declared on the Requirement
    // schema, read at call time so there is no second copy to drift.
    if (req.query.status) query.status = enumFilter(req.query.status, Requirement, 'status');
    if (req.query.city) query.city = stringFilter(req.query.city);
    if (req.query.category) query.category = stringFilter(req.query.category);

    const requirements = await Requirement.find(query)
      .populate('company_id', 'name')
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(limit)
      .lean({ virtuals: true });

    // Format for SQL compatibility
    const formattedRequirements = requirements.map(reqData => {
      const company_name = reqData.company_id?.name;
      const company_id = reqData.company_id?.id || reqData.company_id?._id;
      return { ...reqData, company_name, company_id };
    });

    const total = await Requirement.countDocuments(query);

    // Get stats
    const published = await Requirement.countDocuments({ status: 'published' });
    const closed = await Requirement.countDocuments({ status: 'closed' });
    const statsTotal = await Requirement.countDocuments();

    const stats = {
      total: statsTotal,
      published,
      closed
    };

    res.json({
      data: formattedRequirements,
      stats,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Admin get requirements error:', error);
    res.status(500).json({ message: 'Server error fetching requirements' });
  }
};

// @desc    Update requirement status
// @route   PUT /api/admin/requirements/:id/status
// @access  Private/Admin
export const updateRequirementStatus = async (req, res) => {
  try {
    const { status } = req.body;
    
    if (!['draft', 'published', 'closed'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    await Requirement.findByIdAndUpdate(req.params.id, { status });

    res.json({ message: 'Requirement status updated' });
  } catch (error) {
    console.error('Admin update status error:', error);
    res.status(500).json({ message: 'Server error updating status' });
  }
};

// @desc    Delete requirement
// @route   DELETE /api/admin/requirements/:id
// @access  Private/Admin
export const deleteAdminRequirement = async (req, res) => {
  try {
    await Requirement.findByIdAndDelete(req.params.id);
    res.json({ message: 'Requirement deleted successfully' });
  } catch (error) {
    console.error('Admin delete requirement error:', error);
    res.status(500).json({ message: 'Server error deleting requirement' });
  }
};
