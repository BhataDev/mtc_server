import { Router } from 'express';
import { NewArrivalController } from '../modules/newArrivals/newArrival.controller';
import { requireAuth } from '../middlewares/auth.middleware';
import { uploadSingleImageToCloudinary } from '../middlewares/upload.middleware';

const router = Router();

// All routes require authentication
router.use(requireAuth);

// New arrivals management
router.post(
  '/',
  ...uploadSingleImageToCloudinary('image', 'new-arrivals'),
  NewArrivalController.createNewArrival
);
router.get('/', NewArrivalController.getAllNewArrivals);
router.get('/:id', NewArrivalController.getNewArrival);
router.put(
  '/:id',
  ...uploadSingleImageToCloudinary('image', 'new-arrivals'),
  NewArrivalController.updateNewArrival
);
router.delete('/:id', NewArrivalController.deleteNewArrival);

export default router;
