import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  throw new Error('MONGODB_URI environment variable is not defined');
}

export const connectDB = async (): Promise<void> => {
  try {
    console.log('🔌 Attempting MongoDB connection...');
    console.log('🔍 MongoDB URI exists:', !!MONGODB_URI);
    
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 10000, // 10 second timeout
      socketTimeoutMS: 45000,
    });
    console.log('✅ MongoDB connected successfully');
    
    mongoose.connection.on('error', (error) => {
      console.error('MongoDB connection error:', error);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('MongoDB disconnected');
    });

    process.on('SIGINT', async () => {
      await mongoose.connection.close();
      console.log('MongoDB connection closed through app termination');
      process.exit(0);
    });
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error);
    console.error('⚠️ Server will continue running without database functionality');
    // DON'T exit - let server continue running for port detection
    throw error; // Re-throw so caller can handle
  }
};
