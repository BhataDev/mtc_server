import { v2 as cloudinary } from 'cloudinary';

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export default cloudinary;

// Helper function to upload image buffer to cloudinary with retry logic
export const uploadToCloudinary = async (
  buffer: Buffer,
  folder: string = 'uploads',
  resourceType: 'image' | 'video' | 'raw' | 'auto' = 'image',
  retries: number = 3
): Promise<any> => {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`Cloudinary upload attempt ${attempt}/${retries}`);
      
      return await new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            resource_type: resourceType,
            folder: folder,
            timeout: 60000, // 60 second timeout
            transformation: [
              { quality: 'auto' },
              { fetch_format: 'auto' }
            ]
          },
          (error, result) => {
            if (error) {
              console.error(`Cloudinary upload error (attempt ${attempt}):`, {
                message: error.message,
                code: error.error?.code || 'UNKNOWN',
                http_code: error.error?.http_code
              });
              reject(error);
            } else {
              console.log(`Cloudinary upload successful on attempt ${attempt}`);
              resolve(result);
            }
          }
        );
        
        // Handle stream errors
        uploadStream.on('error', (error) => {
          console.error(`Upload stream error (attempt ${attempt}):`, error);
          reject(error);
        });
        
        uploadStream.end(buffer);
      });
    } catch (error: any) {
      console.error(`Upload attempt ${attempt} failed:`, {
        message: error.message,
        code: error.code,
        errno: error.errno
      });
      
      // If this is the last attempt, throw the error
      if (attempt === retries) {
        throw new Error(`Cloudinary upload failed after ${retries} attempts: ${error.message}`);
      }
      
      // Wait before retrying (exponential backoff)
      const delay = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s...
      console.log(`Waiting ${delay}ms before retry...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
};

// Helper function to delete image from cloudinary
export const deleteFromCloudinary = async (publicId: string): Promise<any> => {
  return cloudinary.uploader.destroy(publicId);
};

// Helper function to get optimized image URL
export const getOptimizedImageUrl = (
  publicId: string,
  width?: number,
  height?: number,
  quality: string = 'auto'
): string => {
  return cloudinary.url(publicId, {
    width,
    height,
    crop: 'fill',
    quality,
    fetch_format: 'auto'
  });
};
