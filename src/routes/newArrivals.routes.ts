import { Router } from 'express';
import { NewArrivalController } from '../modules/newArrivals/newArrival.controller';
import { requireAuth } from '../middlewares/auth.middleware';
import { uploadSingle } from '../middlewares/upload.middleware';

const router = Router();

// All routes require authentication
router.use(requireAuth);

// New arrivals management
router.get('/', NewArrivalController.getAllNewArrivals);
router.get('/:id', NewArrivalController.getNewArrival);
router.post('/', uploadSingle('image'), NewArrivalController.createNewArrival);
router.put('/:id', uploadSingle('image'), NewArrivalController.updateNewArrival);
router.delete('/:id', NewArrivalController.deleteNewArrival);

export default router;
