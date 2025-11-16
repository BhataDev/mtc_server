import { Router } from 'express';
import { OfferController } from '../modules/offers/offer.controller';
import { requireAuth } from '../middlewares/auth.middleware';
import { validateBody } from '../middlewares/validation.middleware';
import { 
  createOfferSchema, 
  updateOfferSchema, 
  extendOfferSchema, 
  toggleStatusSchema 
} from '../modules/offers/offer.validation';

const router = Router();

// Public routes (no authentication required)
router.get('/public/active', OfferController.getPublicActiveOffers);
router.get('/public/location-based', OfferController.getLocationBasedOffers);
router.get('/public/resolve', OfferController.resolveRelevantOffers); // Comprehensive offer resolution
router.get('/public/:id', OfferController.getPublicOffer);

// Protected routes require authentication
router.use(requireAuth);

// Offer management
router.get('/', OfferController.getAllOffers);
router.get('/:id', OfferController.getOffer);
router.post('/', validateBody(createOfferSchema), OfferController.createOffer);
router.put('/:id', validateBody(updateOfferSchema), OfferController.updateOffer);
router.patch('/:id/extend', validateBody(extendOfferSchema), OfferController.extendOffer);
router.patch('/:id/status', validateBody(toggleStatusSchema), OfferController.toggleOfferStatus);
router.delete('/:id', OfferController.deleteOffer);

export default router;
