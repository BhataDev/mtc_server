import multer from 'multer';
import { Request, Response, NextFunction } from 'express';
import { AppError } from './error.middleware';
import { 
  FILE_UPLOAD_MAX_SIZE, 
  ALLOWED_IMAGE_TYPES, 
  ALLOWED_IMAGE_EXTENSIONS 
} from '../config/constants';
import { UploadService } from '../services/uploadService';

// Configure multer for memory storage (we'll handle saving via storage abstraction)
const storage = multer.memoryStorage();

// File filter function
const imageFileFilter = (
  req: Request,
  file: Express.Multer.File,
  callback: multer.FileFilterCallback
) => {
  // Check MIME type
  if (!ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
    callback(new AppError('Invalid file type. Only images are allowed', 400, 'INVALID_FILE_TYPE'));
    return;
  }

  // Check file extension
  const fileExt = file.originalname.toLowerCase().match(/\.[^.]*$/)?.[0];
  if (!fileExt || !ALLOWED_IMAGE_EXTENSIONS.includes(fileExt)) {
    callback(new AppError('Invalid file extension', 400, 'INVALID_FILE_EXTENSION'));
    return;
  }

  callback(null, true);
};

// Create multer instance
const upload = multer({
  storage,
  limits: {
    fileSize: FILE_UPLOAD_MAX_SIZE,
    files: 10 // Maximum 10 files per upload
  },
  fileFilter: imageFileFilter
});

// Export different upload configurations
export const uploadSingle = (fieldName: string = 'image') => upload.single(fieldName);
export const uploadMultiple = (fieldName: string = 'images', maxCount: number = 10) => 
  upload.array(fieldName, maxCount);
export const uploadFields = upload.fields;
export const uploadAny = upload.any;

// Helper middleware to check if files were uploaded
export const requireFile = (fieldName: string) => {
  return (req: Request, res: any, next: any) => {
    if (!req.file && !req.files) {
      return res.status(400).json({
        ok: false,
        error: {
          code: 'FILE_REQUIRED',
          message: `${fieldName} is required`
        }
      });
    }
    next();
  };
};

// Cloudinary upload middleware for single file
export const uploadSingleToCloudinary = (
  fieldName: string = 'image',
  folder: string = 'uploads'
) => {
  return [
    uploadSingle(fieldName),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        console.log('Upload middleware - File received:', {
          hasFile: !!req.file,
          fileName: req.file?.originalname,
          fileSize: req.file?.size,
          mimeType: req.file?.mimetype
        });

        if (!req.file) {
          console.log('No file received in middleware');
          return next();
        }

        const uploadResult = await UploadService.uploadImage(
          req.file.buffer,
          folder,
          req.file.originalname
        );

        // Add cloudinary result to request object
        (req as any).cloudinaryResult = uploadResult;
        
        console.log('Upload middleware - Success, added result to request');
        next();
      } catch (error) {
        console.error('Upload middleware error:', error);
        next(error);
      }
    }
  ];
};

// Cloudinary upload middleware for multiple files
export const uploadMultipleToCloudinary = (
  fieldName: string = 'images',
  maxCount: number = 10,
  folder: string = 'uploads'
) => {
  return [
    uploadMultiple(fieldName, maxCount),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!req.files || !Array.isArray(req.files)) {
          return next();
        }

        const uploadResults = await UploadService.uploadMultipleImages(
          req.files,
          folder
        );

        // Add cloudinary results to request object
        (req as any).cloudinaryResults = uploadResults;
        
        next();
      } catch (error) {
        next(error);
      }
    }
  ];
};

// Middleware for uploading single image (categories, subcategories, brands)
export const uploadSingleImageToCloudinary = (
  fieldName: string = 'image',
  folder: string = 'uploads'
) => {
  return [
    uploadSingle(fieldName),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!req.file) {
          return next();
        }

        const uploadResult = await UploadService.uploadImage(
          req.file.buffer,
          folder,
          req.file.originalname
        );

        // Add cloudinary result to request object
        (req as any).cloudinaryResult = uploadResult;
        next();
      } catch (error) {
        next(error);
      }
    }
  ];
};

// Middleware for uploading multiple images (products)
export const uploadProductImagesToCloudinary = (folder: string = 'products') => {
  return [
    uploadMultiple('images', 10),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!req.files || !Array.isArray(req.files)) {
          return next();
        }

        const uploadResults = await UploadService.uploadMultipleImages(
          req.files,
          folder
        );

        // Add cloudinary results to request object
        (req as any).cloudinaryResults = uploadResults;
        next();
      } catch (error) {
        next(error);
      }
    }
  ];
};

// Middleware for uploading three separate images: desktop, tablet, mobile
export const uploadBannerImagesToCloudinary = (folder: string = 'banners') => {
  return [
    upload.fields([
      { name: 'imageDesktop', maxCount: 1 },
      { name: 'imageTablet', maxCount: 1 },
      { name: 'imageMobile', maxCount: 1 }
    ]),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const files = req.files as {
          [fieldname: string]: Express.Multer.File[];
        };
        const results: any = {};
        if (files?.imageDesktop?.[0]) {
          results.imageUrlDesktop = await UploadService.uploadImage(files.imageDesktop[0].buffer, folder, files.imageDesktop[0].originalname);
        }
        if (files?.imageTablet?.[0]) {
          results.imageUrlTablet = await UploadService.uploadImage(files.imageTablet[0].buffer, folder, files.imageTablet[0].originalname);
        }
        if (files?.imageMobile?.[0]) {
          results.imageUrlMobile = await UploadService.uploadImage(files.imageMobile[0].buffer, folder, files.imageMobile[0].originalname);
        }
        (req as any).cloudinaryResults = results;
        next();
      } catch (error) {
        next(error);
      }
    }
  ];
};
