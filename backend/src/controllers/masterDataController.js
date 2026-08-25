import Profession from '../models/Profession.js';
import State from '../models/State.js';
import City from '../models/City.js';
import { logFromRequest } from '../services/activityService.js';
import {
  slugify,
  getProfessionUsage,
  getStateUsage,
  getCityUsage,
  escapeRegex,
  MASTER_ERRORS
} from '../services/masterDataService.js';

/**
 * Master data: professions, states, cities.
 *
 * Read endpoints are mounted publicly (needed by registration, profile forms
 * and search). Write endpoints are mounted behind protect + admin.
 */

const serverError = (res, label, error) => {
  console.error(`${label} error:`, error);
  return res.status(500).json({ code: 'SERVER_ERROR', message: 'Something went wrong. Please try again.' });
};

/* ================================================================== */
/* PUBLIC READS                                                        */
/* ================================================================== */

/** GET /api/master/professions?include_inactive=&search= */
export const listProfessions = async (req, res) => {
  try {
    const query = {};
    if (req.query.include_inactive !== 'true') query.is_active = true;
    if (req.query.search) query.name = new RegExp(escapeRegex(req.query.search.trim()), 'i');

    const professions = await Profession.find(query).sort({ sort_order: 1, name: 1 });
    res.json({ success: true, data: professions });
  } catch (error) {
    return serverError(res, 'listProfessions', error);
  }
};

/** GET /api/master/states?include_inactive=&search= */
export const listStates = async (req, res) => {
  try {
    const query = {};
    if (req.query.include_inactive !== 'true') query.is_active = true;
    if (req.query.search) query.name = new RegExp(escapeRegex(req.query.search.trim()), 'i');

    const states = await State.find(query).sort({ sort_order: 1, name: 1 });
    res.json({ success: true, data: states });
  } catch (error) {
    return serverError(res, 'listStates', error);
  }
};

/**
 * GET /api/master/cities?state_id=&include_inactive=&search=
 * `state_id` is how the frontend cascade fetches cities for the chosen state.
 */
export const listCities = async (req, res) => {
  try {
    const query = {};
    if (req.query.include_inactive !== 'true') query.is_active = true;
    if (req.query.state_id) {
      const state = await State.findById(req.query.state_id).catch(() => null);
      if (!state) return res.status(404).json(MASTER_ERRORS.STATE_NOT_FOUND);
      query.state_id = state._id;
    }
    if (req.query.search) query.name = new RegExp(escapeRegex(req.query.search.trim()), 'i');

    const cities = await City.find(query)
      .populate('state_id', 'name code')
      .sort({ sort_order: 1, name: 1 });
    res.json({ success: true, data: cities });
  } catch (error) {
    return serverError(res, 'listCities', error);
  }
};

/* ================================================================== */
/* ADMIN: PROFESSIONS                                                  */
/* ================================================================== */

/** GET /api/admin/master/professions - includes usage counts. */
export const adminListProfessions = async (req, res) => {
  try {
    const query = {};
    if (req.query.search) query.name = new RegExp(escapeRegex(req.query.search.trim()), 'i');
    if (req.query.status === 'active') query.is_active = true;
    if (req.query.status === 'inactive') query.is_active = false;

    const professions = await Profession.find(query).sort({ sort_order: 1, name: 1 }).lean();
    const withUsage = [];
    for (const p of professions) {
      const usage = await getProfessionUsage(p._id, p.name);
      withUsage.push({ ...p, id: String(p._id), usage });
    }
    res.json({ success: true, data: withUsage, total: withUsage.length });
  } catch (error) {
    return serverError(res, 'adminListProfessions', error);
  }
};

export const createProfession = async (req, res) => {
  try {
    const name = (req.body.name || '').trim();
    if (!name) return res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Profession name is required.' });

    const slug = slugify(name);
    const existing = await Profession.findOne({ slug });
    if (existing) {
      return res.status(409).json({
        code: 'DUPLICATE',
        message: `"${existing.name}" already exists.`,
        data: existing
      });
    }

    const profession = await Profession.create({
      name,
      slug,
      description: (req.body.description || '').trim(),
      is_active: req.body.is_active !== false,
      sort_order: Number(req.body.sort_order) || 0
    });

    await logFromRequest(req, {
      eventType: 'admin.profession.created',
      category: 'admin',
      title: 'Profession created',
      description: `Admin added "${profession.name}"`,
      target: { type: 'profession', id: profession._id, label: profession.name },
      metadata: { record_type: 'profession', record_name: profession.name }
    });

    res.status(201).json({ success: true, data: profession });
  } catch (error) {
    return serverError(res, 'createProfession', error);
  }
};

export const updateProfession = async (req, res) => {
  try {
    const profession = await Profession.findById(req.params.id);
    if (!profession) return res.status(404).json(MASTER_ERRORS.PROFESSION_NOT_FOUND);

    if (req.body.name !== undefined) {
      const name = String(req.body.name).trim();
      if (!name) return res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Profession name is required.' });
      const slug = slugify(name);
      const clash = await Profession.findOne({ slug, _id: { $ne: profession._id } });
      if (clash) return res.status(409).json({ code: 'DUPLICATE', message: `"${clash.name}" already exists.` });
      profession.name = name;
      profession.slug = slug;
    }
    if (req.body.description !== undefined) profession.description = String(req.body.description).trim();
    if (req.body.sort_order !== undefined) profession.sort_order = Number(req.body.sort_order) || 0;
    if (req.body.is_active !== undefined) profession.is_active = Boolean(req.body.is_active);

    await profession.save();
    res.json({ success: true, data: profession });
  } catch (error) {
    return serverError(res, 'updateProfession', error);
  }
};

/** PATCH /api/admin/master/professions/:id/status  body: { is_active } */
export const setProfessionStatus = async (req, res) => {
  try {
    const profession = await Profession.findById(req.params.id);
    if (!profession) return res.status(404).json(MASTER_ERRORS.PROFESSION_NOT_FOUND);

    profession.is_active = Boolean(req.body.is_active);
    await profession.save();

    const usage = await getProfessionUsage(profession._id, profession.name);
    res.json({
      success: true,
      data: profession,
      usage,
      // Deactivating never touches profiles already using the record.
      message: profession.is_active
        ? 'Profession activated.'
        : `Profession deactivated. ${usage.total} existing record(s) keep their current value.`
    });
  } catch (error) {
    return serverError(res, 'setProfessionStatus', error);
  }
};

/** DELETE - refuses while the record is referenced anywhere. */
export const deleteProfession = async (req, res) => {
  try {
    const profession = await Profession.findById(req.params.id);
    if (!profession) return res.status(404).json(MASTER_ERRORS.PROFESSION_NOT_FOUND);

    const usage = await getProfessionUsage(profession._id, profession.name);
    if (usage.total > 0) {
      return res.status(409).json({
        ...MASTER_ERRORS.IN_USE,
        message: `"${profession.name}" is used by ${usage.users} profile(s) and ${usage.requirements} requirement(s). Deactivate it instead.`,
        usage
      });
    }

    await profession.deleteOne();
    res.json({ success: true, message: `"${profession.name}" deleted.` });
  } catch (error) {
    return serverError(res, 'deleteProfession', error);
  }
};

/* ================================================================== */
/* ADMIN: STATES                                                       */
/* ================================================================== */

export const adminListStates = async (req, res) => {
  try {
    const query = {};
    if (req.query.search) query.name = new RegExp(escapeRegex(req.query.search.trim()), 'i');
    if (req.query.status === 'active') query.is_active = true;
    if (req.query.status === 'inactive') query.is_active = false;

    const states = await State.find(query).sort({ sort_order: 1, name: 1 }).lean();
    const withUsage = [];
    for (const s of states) {
      const usage = await getStateUsage(s._id, s.name);
      withUsage.push({ ...s, id: String(s._id), usage });
    }
    res.json({ success: true, data: withUsage, total: withUsage.length });
  } catch (error) {
    return serverError(res, 'adminListStates', error);
  }
};

export const createState = async (req, res) => {
  try {
    const name = (req.body.name || '').trim();
    if (!name) return res.status(400).json({ code: 'VALIDATION_ERROR', message: 'State name is required.' });

    const slug = slugify(name);
    const existing = await State.findOne({ slug });
    if (existing) {
      return res.status(409).json({ code: 'DUPLICATE', message: `"${existing.name}" already exists.`, data: existing });
    }

    const state = await State.create({
      name,
      slug,
      code: (req.body.code || '').trim().toUpperCase(),
      is_active: req.body.is_active !== false,
      sort_order: Number(req.body.sort_order) || 0
    });

    await logFromRequest(req, {
      eventType: 'admin.state.created',
      category: 'admin',
      title: 'State created',
      description: `Admin added "${state.name}"`,
      target: { type: 'state', id: state._id, label: state.name },
      metadata: { record_type: 'state', record_name: state.name }
    });

    res.status(201).json({ success: true, data: state });
  } catch (error) {
    return serverError(res, 'createState', error);
  }
};

export const updateState = async (req, res) => {
  try {
    const state = await State.findById(req.params.id);
    if (!state) return res.status(404).json(MASTER_ERRORS.STATE_NOT_FOUND);

    if (req.body.name !== undefined) {
      const name = String(req.body.name).trim();
      if (!name) return res.status(400).json({ code: 'VALIDATION_ERROR', message: 'State name is required.' });
      const slug = slugify(name);
      const clash = await State.findOne({ slug, _id: { $ne: state._id } });
      if (clash) return res.status(409).json({ code: 'DUPLICATE', message: `"${clash.name}" already exists.` });
      state.name = name;
      state.slug = slug;
    }
    if (req.body.code !== undefined) state.code = String(req.body.code).trim().toUpperCase();
    if (req.body.sort_order !== undefined) state.sort_order = Number(req.body.sort_order) || 0;
    if (req.body.is_active !== undefined) state.is_active = Boolean(req.body.is_active);

    await state.save();
    res.json({ success: true, data: state });
  } catch (error) {
    return serverError(res, 'updateState', error);
  }
};

export const setStateStatus = async (req, res) => {
  try {
    const state = await State.findById(req.params.id);
    if (!state) return res.status(404).json(MASTER_ERRORS.STATE_NOT_FOUND);

    state.is_active = Boolean(req.body.is_active);
    await state.save();

    // Deactivating a state hides its cities from new selections too.
    if (!state.is_active) {
      await City.updateMany({ state_id: state._id }, { $set: { is_active: false } });
    }

    const usage = await getStateUsage(state._id, state.name);
    res.json({
      success: true,
      data: state,
      usage,
      message: state.is_active
        ? 'State activated. Re-activate its cities individually if required.'
        : `State deactivated along with its ${usage.cities} city/cities. ${usage.users} profile(s) keep their current value.`
    });
  } catch (error) {
    return serverError(res, 'setStateStatus', error);
  }
};

export const deleteState = async (req, res) => {
  try {
    const state = await State.findById(req.params.id);
    if (!state) return res.status(404).json(MASTER_ERRORS.STATE_NOT_FOUND);

    const usage = await getStateUsage(state._id, state.name);
    if (usage.total > 0 || usage.cities > 0) {
      return res.status(409).json({
        ...MASTER_ERRORS.IN_USE,
        message: `"${state.name}" has ${usage.cities} city/cities and is used by ${usage.users} profile(s). Deactivate it instead.`,
        usage
      });
    }

    await state.deleteOne();
    res.json({ success: true, message: `"${state.name}" deleted.` });
  } catch (error) {
    return serverError(res, 'deleteState', error);
  }
};

/* ================================================================== */
/* ADMIN: CITIES                                                       */
/* ================================================================== */

export const adminListCities = async (req, res) => {
  try {
    const query = {};
    if (req.query.search) query.name = new RegExp(escapeRegex(req.query.search.trim()), 'i');
    if (req.query.state_id) query.state_id = req.query.state_id;
    if (req.query.status === 'active') query.is_active = true;
    if (req.query.status === 'inactive') query.is_active = false;

    const cities = await City.find(query)
      .populate('state_id', 'name code')
      .sort({ sort_order: 1, name: 1 })
      .lean();

    const withUsage = [];
    for (const c of cities) {
      const usage = await getCityUsage(c._id, c.name);
      withUsage.push({ ...c, id: String(c._id), usage });
    }
    res.json({ success: true, data: withUsage, total: withUsage.length });
  } catch (error) {
    return serverError(res, 'adminListCities', error);
  }
};

export const createCity = async (req, res) => {
  try {
    const name = (req.body.name || '').trim();
    const stateId = req.body.state_id;
    if (!name) return res.status(400).json({ code: 'VALIDATION_ERROR', message: 'City name is required.' });
    if (!stateId) return res.status(400).json({ code: 'VALIDATION_ERROR', message: 'A city must belong to a state.' });

    const state = await State.findById(stateId).catch(() => null);
    if (!state) return res.status(404).json(MASTER_ERRORS.STATE_NOT_FOUND);

    const slug = slugify(name);
    const existing = await City.findOne({ state_id: state._id, slug });
    if (existing) {
      return res.status(409).json({
        code: 'DUPLICATE',
        message: `"${existing.name}" already exists in ${state.name}.`,
        data: existing
      });
    }

    const city = await City.create({
      name,
      slug,
      state_id: state._id,
      is_active: req.body.is_active !== false,
      sort_order: Number(req.body.sort_order) || 0
    });

    await logFromRequest(req, {
      eventType: 'admin.city.created',
      category: 'admin',
      title: 'City created',
      description: `Admin added "${city.name}" to ${state.name}`,
      target: { type: 'city', id: city._id, label: city.name },
      metadata: { record_type: 'city', record_name: city.name, state: state.name }
    });

    res.status(201).json({ success: true, data: city });
  } catch (error) {
    return serverError(res, 'createCity', error);
  }
};

export const updateCity = async (req, res) => {
  try {
    const city = await City.findById(req.params.id);
    if (!city) return res.status(404).json(MASTER_ERRORS.CITY_NOT_FOUND);

    if (req.body.state_id !== undefined && String(req.body.state_id) !== String(city.state_id)) {
      const state = await State.findById(req.body.state_id).catch(() => null);
      if (!state) return res.status(404).json(MASTER_ERRORS.STATE_NOT_FOUND);
      city.state_id = state._id;
    }

    if (req.body.name !== undefined) {
      const name = String(req.body.name).trim();
      if (!name) return res.status(400).json({ code: 'VALIDATION_ERROR', message: 'City name is required.' });
      city.name = name;
      city.slug = slugify(name);
    }
    if (req.body.sort_order !== undefined) city.sort_order = Number(req.body.sort_order) || 0;
    if (req.body.is_active !== undefined) city.is_active = Boolean(req.body.is_active);

    const clash = await City.findOne({ state_id: city.state_id, slug: city.slug, _id: { $ne: city._id } });
    if (clash) return res.status(409).json({ code: 'DUPLICATE', message: `"${clash.name}" already exists in that state.` });

    await city.save();
    res.json({ success: true, data: city });
  } catch (error) {
    return serverError(res, 'updateCity', error);
  }
};

export const setCityStatus = async (req, res) => {
  try {
    const city = await City.findById(req.params.id);
    if (!city) return res.status(404).json(MASTER_ERRORS.CITY_NOT_FOUND);

    city.is_active = Boolean(req.body.is_active);
    await city.save();

    const usage = await getCityUsage(city._id, city.name);
    res.json({
      success: true,
      data: city,
      usage,
      message: city.is_active
        ? 'City activated.'
        : `City deactivated. ${usage.users} profile(s) keep their current value.`
    });
  } catch (error) {
    return serverError(res, 'setCityStatus', error);
  }
};

export const deleteCity = async (req, res) => {
  try {
    const city = await City.findById(req.params.id);
    if (!city) return res.status(404).json(MASTER_ERRORS.CITY_NOT_FOUND);

    const usage = await getCityUsage(city._id, city.name);
    if (usage.total > 0) {
      return res.status(409).json({
        ...MASTER_ERRORS.IN_USE,
        message: `"${city.name}" is used by ${usage.users} profile(s) and ${usage.requirements} requirement(s). Deactivate it instead.`,
        usage
      });
    }

    await city.deleteOne();
    res.json({ success: true, message: `"${city.name}" deleted.` });
  } catch (error) {
    return serverError(res, 'deleteCity', error);
  }
};
