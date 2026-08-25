import express from 'express';
import { listProfessions, listStates, listCities } from '../controllers/masterDataController.js';

/**
 * Public read-only master data.
 * Needed by registration, profile forms and search before/without auth.
 * All write operations live on the admin router.
 */
const router = express.Router();

router.get('/professions', listProfessions);
router.get('/states', listStates);
router.get('/cities', listCities);

export default router;
