import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth } from '../middlewares/auth.middleware';
import { uploadMultiple } from '../middlewares/upload.middleware';
import { StorageFactory } from '../utils/storage/storage.factory';
import { AppError } from '../middlewares/error.middleware';

const router = Router();

// All upload routes require authentication
router.use(requireAuth);

// Upload multiple images
router.post('/images', uploadMultiple('images', 10), async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
      throw new AppError('No files uploaded', 400, 'NO_FILES');
    }

    const storage = StorageFactory.getStorage();
    const urls = await storage.uploadMany(req.files as Express.Multer.File[], 'uploads');

    res.json({
      ok: true,
      data: urls
    });
  } catch (error) {
    next(error);
  }
});

export default router;
