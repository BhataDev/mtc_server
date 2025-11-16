export interface UploadResult {
  url: string;
  publicId: string;
  width?: number;
  height?: number;
  format?: string;
  bytes?: number;
}

import { uploadToCloudinary, deleteFromCloudinary } from '../config/cloudinary';
import { AppError } from '../middlewares/error.middleware';
export class UploadService {


  /**
   * Upload three images (desktop, tablet, mobile) to Cloudinary
   */
  static async uploadBannerImages(
    files: { imageDesktop?: Express.Multer.File; imageTablet?: Express.Multer.File; imageMobile?: Express.Multer.File },
    folder: string = 'banners'
  ): Promise<{ imageUrlDesktop?: UploadResult; imageUrlTablet?: UploadResult; imageUrlMobile?: UploadResult }> {
    const results: any = {};
    if (files.imageDesktop) {
      results.imageUrlDesktop = await this.uploadImage(files.imageDesktop.buffer, folder, files.imageDesktop.originalname);
    }
    if (files.imageTablet) {
      results.imageUrlTablet = await this.uploadImage(files.imageTablet.buffer, folder, files.imageTablet.originalname);
    }
    if (files.imageMobile) {
      results.imageUrlMobile = await this.uploadImage(files.imageMobile.buffer, folder, files.imageMobile.originalname);
    }
    return results;
  }

// ...existing code...
  /**
   * Upload single image to Cloudinary
   */
  static async uploadImage(
    buffer: Buffer,
    folder: string = 'uploads',
    originalName?: string
  ): Promise<UploadResult> {
    try {
      console.log('Attempting to upload to Cloudinary:', {
        bufferSize: buffer.length,
        folder,
        originalName,
        cloudName: process.env.CLOUDINARY_CLOUD_NAME ? 'Set' : 'Not set',
        apiKey: process.env.CLOUDINARY_API_KEY ? 'Set' : 'Not set',
        apiSecret: process.env.CLOUDINARY_API_SECRET ? 'Set' : 'Not set'
      });

      const result = await uploadToCloudinary(buffer, folder, 'image');
      
      console.log('Cloudinary upload successful:', {
        url: result.secure_url,
        publicId: result.public_id
      });

      return {
        url: result.secure_url,
        publicId: result.public_id,
        width: result.width,
        height: result.height,
        format: result.format,
        bytes: result.bytes
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      
      console.error('Cloudinary upload error details:', {
        error: errorMessage,
        stack: errorStack,
        cloudName: process.env.CLOUDINARY_CLOUD_NAME,
        apiKey: process.env.CLOUDINARY_API_KEY ? 'Set' : 'Not set',
        apiSecret: process.env.CLOUDINARY_API_SECRET ? 'Set' : 'Not set'
      });
      throw new AppError('Failed to upload image', 500, 'UPLOAD_FAILED');
    }
  }

  /**
   * Upload multiple images to Cloudinary
   */
  static async uploadMultipleImages(
    files: Express.Multer.File[],
    folder: string = 'uploads'
  ): Promise<UploadResult[]> {
    try {
      const uploadPromises = files.map(file => 
        this.uploadImage(file.buffer, folder, file.originalname)
      );
      
      return await Promise.all(uploadPromises);
    } catch (error) {
      console.error('Multiple upload error:', error);
      throw new AppError('Failed to upload images', 500, 'MULTIPLE_UPLOAD_FAILED');
    }
  }

  /**
   * Delete image from Cloudinary
   */
  static async deleteImage(publicId: string): Promise<void> {
    try {
      await deleteFromCloudinary(publicId);
    } catch (error) {
      console.error('Cloudinary delete error:', error);
      throw new AppError('Failed to delete image', 500, 'DELETE_FAILED');
    }
  }

  /**
   * Delete multiple images from Cloudinary
   */
  static async deleteMultipleImages(publicIds: string[]): Promise<void> {
    try {
      const deletePromises = publicIds.map(publicId => 
        this.deleteImage(publicId)
      );
      
      await Promise.all(deletePromises);
    } catch (error) {
      console.error('Multiple delete error:', error);
      throw new AppError('Failed to delete images', 500, 'MULTIPLE_DELETE_FAILED');
    }
  }
}
