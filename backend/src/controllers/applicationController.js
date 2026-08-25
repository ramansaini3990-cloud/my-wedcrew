import Application from '../models/Application.js';
import Requirement from '../models/Requirement.js';
import Notification from '../models/Notification.js';
import { emitNotification } from '../socket.js';
import { logFromRequest } from '../services/activityService.js';

export const createApplication = async (req, res) => {
  try {
    const { requirement_id, proposed_rate, availability, message } = req.body;
    const freelancer_id = req.user.id || req.user._id;

    const requirement = await Requirement.findById(requirement_id);
    if (!requirement) return res.status(404).json({ message: 'Requirement not found' });
    if (requirement.status !== 'published') return res.status(400).json({ message: 'Requirement is not active' });

    const existing = await Application.findOne({ requirement_id, freelancer_id });
    if (existing) return res.status(400).json({ message: 'Already applied to this requirement.' });

    const application = new Application({
      requirement_id,
      freelancer_id,
      company_id: requirement.company_id,
      proposed_rate,
      availability,
      message
    });
    await application.save();

    await Requirement.findByIdAndUpdate(requirement_id, { $inc: { applications_count: 1 } });

    // Create Notification for Company
    const notification = new Notification({
      recipient_id: requirement.company_id,
      recipient_role: 'company',
      type: 'new_application',
      title: 'New Application Received',
      message: `${req.user.name} applied for ${requirement.category}.`,
      application_id: application._id,
      requirement_id: requirement._id,
      sender_id: freelancer_id
    });
    await notification.save();
    emitNotification(requirement.company_id, notification);

    await logFromRequest(req, {
      eventType: 'application.created',
      category: 'applications',
      title: 'New application submitted',
      description: `${req.user.name} applied for ${requirement.category}`,
      target: { type: 'application', id: application._id, label: requirement.category },
      metadata: { category: requirement.category, city: requirement.city, requirement_id: String(requirement._id), status: 'pending' }
    });

    res.status(201).json({ success: true, data: application });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getRequirementApplications = async (req, res) => {
  try {
    const { requirementId } = req.params;
    const company_id = req.user.id || req.user._id;

    const requirement = await Requirement.findById(requirementId);
    if (!requirement) return res.status(404).json({ message: 'Requirement not found' });
    if (requirement.company_id.toString() !== company_id.toString()) return res.status(403).json({ message: 'Unauthorized' });

    const applications = await Application.find({ requirement_id: requirementId }).populate('freelancer_id', 'name email profession profile_picture city state').sort({ created_at: -1 });
    res.json({ success: true, data: applications });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getMyApplicationForRequirement = async (req, res) => {
  try {
    const { requirementId } = req.params;
    const freelancer_id = req.user.id || req.user._id;
    const application = await Application.findOne({ requirement_id: requirementId, freelancer_id });
    await logFromRequest(req, {
      eventType: `application.${status}`,
      category: 'applications',
      severity: status === 'accepted' ? 'success' : status === 'rejected' ? 'warning' : 'info',
      title: `Application ${status}`,
      description: `${application.requirement_id.category} application ${status}`,
      target: { type: 'application', id: application._id, label: application.requirement_id.category },
      metadata: { status, category: application.requirement_id.category }
    });

    res.json({ success: true, data: application });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getMyApplications = async (req, res) => {
  try {
    const freelancer_id = req.user.id || req.user._id;
    const applications = await Application.find({ freelancer_id }).populate('requirement_id').populate('company_id', 'name email company_name profile_picture').sort({ created_at: -1 });
    res.json({ success: true, data: applications });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const updateApplicationStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const company_id = req.user.id || req.user._id;

    if (!['shortlisted', 'accepted', 'rejected'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const application = await Application.findById(id).populate('requirement_id');
    if (!application) return res.status(404).json({ message: 'Application not found' });
    if (application.company_id.toString() !== company_id.toString()) return res.status(403).json({ message: 'Unauthorized' });

    application.status = status;
    await application.save();

    let title = '';
    let msg = '';
    
    if (status === 'shortlisted') {
       title = 'Application Shortlisted';
       msg = `Your application for ${application.requirement_id.category} has been shortlisted.`;
    } else if (status === 'rejected') {
       title = 'Application Rejected';
       msg = `Your application for ${application.requirement_id.category} was rejected.`;
    } else if (status === 'accepted') {
       title = 'Application Accepted';
       msg = `Your application for ${application.requirement_id.category} was accepted. You can now chat with the company.`;
    }

    if (title) {
      const notification = new Notification({
        recipient_id: application.freelancer_id,
        recipient_role: 'freelancer',
        type: `application_${status}`,
        title,
        message: msg,
        application_id: application._id,
        requirement_id: application.requirement_id._id,
        sender_id: company_id
      });
      await notification.save();
      emitNotification(application.freelancer_id, notification);
    }

    await logFromRequest(req, {
      eventType: `application.${status}`,
      category: 'applications',
      severity: status === 'accepted' ? 'success' : status === 'rejected' ? 'warning' : 'info',
      title: `Application ${status}`,
      description: `${application.requirement_id.category} application ${status}`,
      target: { type: 'application', id: application._id, label: application.requirement_id.category },
      metadata: { status, category: application.requirement_id.category }
    });

    res.json({ success: true, data: application });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};