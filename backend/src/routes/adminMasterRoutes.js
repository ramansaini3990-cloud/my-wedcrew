import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import { admin } from '../middleware/adminMiddleware.js';
import {
  adminListProfessions, createProfession, updateProfession, setProfessionStatus, deleteProfession,
  adminListStates, createState, updateState, setStateStatus, deleteState,
  adminListCities, createCity, updateCity, setCityStatus, deleteCity
} from '../controllers/masterDataController.js';

/** Admin-only master data management. Mounted at /api/admin/master. */
const router = express.Router();

router.use(protect);
router.use(admin);

router.get('/professions', adminListProfessions);
router.post('/professions', createProfession);
router.put('/professions/:id', updateProfession);
router.patch('/professions/:id/status', setProfessionStatus);
router.delete('/professions/:id', deleteProfession);

router.get('/states', adminListStates);
router.post('/states', createState);
router.put('/states/:id', updateState);
router.patch('/states/:id/status', setStateStatus);
router.delete('/states/:id', deleteState);

router.get('/cities', adminListCities);
router.post('/cities', createCity);
router.put('/cities/:id', updateCity);
router.patch('/cities/:id/status', setCityStatus);
router.delete('/cities/:id', deleteCity);

export default router;
