import {
  findSaveableProfessional,
  saveProfessional,
  unsaveProfessional,
  listSavedIds,
  listSavedProfessionals
} from '../services/savedProfessionalService.js';
import { logFromRequest } from '../services/activityService.js';

/**
 * Saved professionals (company bookmarks).
 *
 * Thin by design: every rule lives in savedProfessionalService, including the
 * subscription-aware serialisation. These handlers only shape HTTP.
 */

/** Companies only. Freelancers and admins have no bookmark list of their own. */
const companyOnly = (req, res) => {
  if (req.user?.role !== 'company') {
    res.status(403).json({ code: 'FORBIDDEN', message: 'Only companies can save professionals.' });
    return false;
  }
  return true;
};

// @desc    List the caller's saved professionals
// @route   GET /api/saved-professionals
// @access  Private (company)
export const getSavedProfessionals = async (req, res) => {
  try {
    if (!companyOnly(req, res)) return;
    const result = await listSavedProfessionals(req.user, {
      page: req.query.page,
      limit: req.query.limit
    });
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('getSavedProfessionals error:', error);
    res.status(500).json({ code: 'SERVER_ERROR', message: 'Could not load your saved professionals.' });
  }
};

// @desc    Ids only, so a search grid can show saved state cheaply
// @route   GET /api/saved-professionals/ids
// @access  Private (company)
export const getSavedProfessionalIds = async (req, res) => {
  try {
    if (!companyOnly(req, res)) return;
    const ids = await listSavedIds(req.user.id);
    res.json({ success: true, data: ids });
  } catch (error) {
    console.error('getSavedProfessionalIds error:', error);
    res.status(500).json({ code: 'SERVER_ERROR', message: 'Could not load your saved list.' });
  }
};

// @desc    Save a professional
// @route   POST /api/saved-professionals
// @access  Private (company)
export const createSavedProfessional = async (req, res) => {
  try {
    if (!companyOnly(req, res)) return;

    const freelancerId = req.body?.freelancer_id;
    const check = await findSaveableProfessional(freelancerId);
    if (!check.ok) {
      const status = check.code === 'PROFESSIONAL_NOT_FOUND' ? 404 : 400;
      return res.status(status).json({ code: check.code, message: check.message });
    }

    const { created } = await saveProfessional(req.user.id, freelancerId);

    // Only a real state change is worth an audit entry; a repeat tap is not.
    if (created) {
      await logFromRequest(req, {
        eventType: 'company.professional_saved',
        category: 'users',
        title: 'Professional saved',
        description: `${req.user.name || 'A company'} saved a professional`,
        target: { type: 'user', id: freelancerId, label: check.professional.name },
        // Allow-listed keys only. The professional's id travels in `target`,
        // not in metadata, so nothing here needs a key the allow-list lacks.
        metadata: {
          record_type: 'saved_professional',
          profession: check.professional.profession_id?.name || check.professional.profession || undefined,
          city: check.professional.city_id?.name || check.professional.city || undefined
        }
      });
    }

    res.status(created ? 201 : 200).json({
      success: true,
      created,
      saved: true,
      message: created ? 'Professional saved.' : 'Already saved.'
    });
  } catch (error) {
    console.error('createSavedProfessional error:', error);
    res.status(500).json({ code: 'SERVER_ERROR', message: 'Could not save this professional.' });
  }
};

// @desc    Unsave a professional
// @route   DELETE /api/saved-professionals/:freelancerId
// @access  Private (company)
export const deleteSavedProfessional = async (req, res) => {
  try {
    if (!companyOnly(req, res)) return;

    const freelancerId = req.params.freelancerId;
    const { removed } = await unsaveProfessional(req.user.id, freelancerId);

    if (removed) {
      await logFromRequest(req, {
        eventType: 'company.professional_unsaved',
        category: 'users',
        title: 'Professional unsaved',
        description: `${req.user.name || 'A company'} removed a saved professional`,
        target: { type: 'user', id: freelancerId },
        metadata: { record_type: 'saved_professional' }
      });
    }

    // Removing something that was not saved leaves the caller in the state they
    // asked for, so it answers 200 rather than 404.
    res.json({
      success: true,
      removed,
      saved: false,
      message: removed ? 'Removed from your saved list.' : 'That professional was not saved.'
    });
  } catch (error) {
    console.error('deleteSavedProfessional error:', error);
    res.status(500).json({ code: 'SERVER_ERROR', message: 'Could not update your saved list.' });
  }
};
