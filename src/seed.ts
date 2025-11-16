import mongoose from 'mongoose';
import dotenv from 'dotenv';
import bcrypt from 'bcrypt';
import * as path from 'path';
import * as fs from 'fs';

// Load environment variables
dotenv.config();

// Import models
import { User } from './modules/users/user.model';
import { Settings } from './modules/settings/settings.model';
import { Category } from './modules/categories/category.model';
import { Subcategory } from './modules/subcategories/subcategory.model';
import { Branch } from './modules/branches/branch.model';
import { GlobalBanner } from './modules/banners/banner.model';
import { SALT_ROUNDS } from './config/constants';

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  throw new Error('MONGODB_URI environment variable is not defined');
}

interface CategoryData {
  name: string;
  subcategories: string[];
}

interface SeedData {
  categories: CategoryData[];
}

async function seedDatabase() {
  try {
    // Connect to MongoDB
    await mongoose.connect(MONGODB_URI!);
    console.log('✅ Connected to MongoDB');

    // Clear existing data (optional - comment out if you want to preserve existing data)
    console.log('🧹 Clearing existing data...');
    await Promise.all([
      User.deleteMany({}),
      Settings.deleteMany({}),
      Category.deleteMany({}),
      Subcategory.deleteMany({}),
      Branch.deleteMany({}),
      GlobalBanner.deleteMany({})
    ]);

    // Create admin user from environment variables
    const adminUsername = process.env.ADMIN_USERNAME || 'admin';
    const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@123';
    
    console.log('👤 Creating admin user...');
    const adminUser = await User.create({
      username: adminUsername,
      passwordHash: adminPassword, // Will be hashed by pre-save hook
      role: 'admin',
      isActive: true
    });
    console.log(`✅ Admin user created: ${adminUsername}`);

    // Create default settings
    console.log('⚙️ Creating default settings...');
    await Settings.getInstance();
    console.log('✅ Default settings created');

    // Create global banner
    console.log('🎯 Creating default global banner...');
    await GlobalBanner.getInstance();
    console.log('✅ Default global banner created');

    // Create a sample branch
    console.log('🏢 Creating sample branch...');
    const branchPassword = await bcrypt.hash('Branch@123', SALT_ROUNDS);
    const sampleBranch = await Branch.create({
      name: 'Main Branch',
      username: 'mainbranch',
      passwordHash: branchPassword,
      phone: '+966501234567',
      addressText: 'King Fahd Road, Riyadh, Saudi Arabia',
      location: {
        type: 'Point',
        coordinates: [46.6753, 24.7136] // Riyadh coordinates
      },
      isActive: true,
      createdBy: adminUser._id
    });

    // Create branch user for authentication
    await User.create({
      username: 'mainbranch',
      passwordHash: 'Branch@123', // Will be hashed by pre-save hook
      role: 'branch',
      phone: '+966501234567',
      branch: sampleBranch._id,
      isActive: true
    });
    console.log('✅ Sample branch created: mainbranch');

    // Load categories from JSON file
    console.log('📁 Loading categories from seed file...');
    const seedFilePath = path.join(__dirname, '../seed/categories.json');
    const seedDataRaw = fs.readFileSync(seedFilePath, 'utf-8');
    const seedData: SeedData = JSON.parse(seedDataRaw);

    // Create categories and subcategories
    console.log('🗂️ Creating categories and subcategories...');
    for (const categoryData of seedData.categories) {
      // Create category
      const category = await Category.create({
        name: categoryData.name,
        imageUrl: `/placeholder-category.jpg`,
        isActive: true,
        createdBy: adminUser._id
      });

      // Create subcategories
      for (const subcategoryName of categoryData.subcategories) {
        await Subcategory.create({
          category: category._id,
          name: subcategoryName,
          imageUrl: `/placeholder-subcategory.jpg`,
          isActive: true,
          createdBy: adminUser._id
        });
      }

      console.log(`✅ Created category: ${categoryData.name} with ${categoryData.subcategories.length} subcategories`);
    }

    // Create some sample products (optional)
    console.log('📦 Seed completed successfully!');
    console.log('\n📋 Summary:');
    console.log(`- Admin user: ${adminUsername}`);
    console.log(`- Admin password: ${adminPassword}`);
    console.log('- Branch user: mainbranch');
    console.log('- Branch password: Branch@123');
    console.log(`- Categories: ${seedData.categories.length}`);
    console.log(`- Total subcategories: ${seedData.categories.reduce((sum, cat) => sum + cat.subcategories.length, 0)}`);

    // Disconnect from MongoDB
    await mongoose.disconnect();
    console.log('\n✅ Database seeding completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

// Run the seed function
seedDatabase();
