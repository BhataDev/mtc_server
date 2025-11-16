import dotenv from 'dotenv';
import { v2 as cloudinary } from 'cloudinary';

// Load environment variables
dotenv.config();

// Test Cloudinary configuration
export const testCloudinaryConfig = () => {
  console.log('=== Cloudinary Configuration Test ===');
  
  const config = {
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
  };
  
  console.log('Environment Variables:');
  console.log('CLOUDINARY_CLOUD_NAME:', config.cloud_name ? 'Set' : 'NOT SET');
  console.log('CLOUDINARY_API_KEY:', config.api_key ? 'Set' : 'NOT SET');
  console.log('CLOUDINARY_API_SECRET:', config.api_secret ? 'Set' : 'NOT SET');
  
  if (!config.cloud_name || !config.api_key || !config.api_secret) {
    console.error('❌ Cloudinary configuration is incomplete!');
    console.log('\nPlease add these to your .env file:');
    console.log('CLOUDINARY_CLOUD_NAME=your_cloud_name_here');
    console.log('CLOUDINARY_API_KEY=your_api_key_here');
    console.log('CLOUDINARY_API_SECRET=your_api_secret_here');
    return false;
  }
  
  // Configure cloudinary
  cloudinary.config(config);
  
  console.log('✅ Cloudinary configuration appears complete');
  return true;
};

// Test function to verify connection
export const testCloudinaryConnection = async () => {
  try {
    const result = await cloudinary.api.ping();
    console.log('✅ Cloudinary connection successful:', result);
    return true;
  } catch (error) {
    console.error('❌ Cloudinary connection failed:', error);
    return false;
  }
};

// Run test if this file is executed directly
if (require.main === module) {
  (async () => {
    const configOk = testCloudinaryConfig();
    if (configOk) {
      await testCloudinaryConnection();
    }
  })();
}
