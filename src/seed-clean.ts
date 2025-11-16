import mongoose from 'mongoose';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Import models
import { User } from './modules/users/user.model';
import { Settings } from './modules/settings/settings.model';
import { Category } from './modules/categories/category.model';
import { Subcategory } from './modules/subcategories/subcategory.model';
import { Branch } from './modules/branches/branch.model';
import { GlobalBanner } from './modules/banners/banner.model';

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  throw new Error('MONGODB_URI environment variable is not defined');
}

async function seedDatabase() {
  try {
    // Connect to MongoDB
    await mongoose.connect(MONGODB_URI!);
    console.log('✅ Connected to MongoDB');

    // Clear existing data (except admin credentials if you want to preserve them)
    console.log('🧹 Clearing existing data...');
    await Promise.all([
      // Remove all dummy/sample data
      Branch.deleteMany({ username: 'mainbranch' }), // Remove sample branch
      User.deleteMany({ username: 'mainbranch' }), // Remove sample branch user
      Category.deleteMany({}), // Remove all categories to start fresh
      Subcategory.deleteMany({}), // Remove all subcategories to start fresh
      GlobalBanner.deleteMany({}) // Remove any sample banners
    ]);

    // Only create admin user if it doesn't exist
    const adminUsername = process.env.ADMIN_USERNAME || 'admin';
    const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@123';
    
    const existingAdmin = await User.findOne({ username: adminUsername });
    if (!existingAdmin) {
      console.log('👤 Creating admin user...');
      await User.create({
        username: adminUsername,
        passwordHash: adminPassword, // Will be hashed by pre-save hook
        role: 'admin',
        isActive: true
      });
      console.log(`✅ Admin user created: ${adminUsername}`);
    } else {
      console.log(`ℹ️ Admin user already exists: ${adminUsername}`);
    }

    // Create default settings if they don't exist
    console.log('⚙️ Ensuring default settings exist...');
    await Settings.getInstance();
    console.log('✅ Default settings ready');

    // Create global banner if it doesn't exist
    console.log('🎯 Ensuring default global banner exists...');
    await GlobalBanner.getInstance();
    console.log('✅ Default global banner ready');

    console.log('\n📦 Database cleanup completed successfully!');
    console.log('\n📋 Summary:');
    console.log(`- Admin user: ${adminUsername}`);
    console.log('- All sample/dummy data removed');
    console.log('- Ready for real data entry');

    // Disconnect from MongoDB
    await mongoose.disconnect();
    console.log('\n✅ Database cleanup completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error cleaning database:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

// Run the seed function
seedDatabase();
