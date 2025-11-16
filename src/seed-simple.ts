import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Simple models without audit
import { User } from './modules/users/user.model';
import { Settings } from './modules/settings/settings.model';
import { Category } from './modules/categories/category.model';
import { Subcategory } from './modules/subcategories/subcategory.model';
import { Branch } from './modules/branches/branch.model';
import { GlobalBanner } from './modules/banners/banner.model';

const MONGODB_URI = process.env.MONGODB_URI!;
const SALT_ROUNDS = 10;

async function seedDatabase() {
  try {
    // Connect to MongoDB
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Clear existing data
    console.log('🧹 Clearing existing data...');
    await Promise.all([
      User.deleteMany({}),
      Settings.deleteMany({}),
      Category.deleteMany({}),
      Subcategory.deleteMany({}),
      Branch.deleteMany({}),
      GlobalBanner.deleteMany({})
    ]);

    // Create admin user
    const adminUsername = process.env.ADMIN_USERNAME || 'admin';
    const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@123';
    
    console.log('👤 Creating admin user...');
    const adminUser = await User.create({
      username: adminUsername,
      passwordHash: adminPassword,
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

    // Create sample branch
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
        coordinates: [46.6753, 24.7136]
      },
      isActive: true,
      createdBy: adminUser._id
    });

    // Create branch user
    await User.create({
      username: 'mainbranch',
      passwordHash: 'Branch@123',
      role: 'branch',
      phone: '+966501234567',
      branch: sampleBranch._id,
      isActive: true
    });
    console.log('✅ Sample branch created: mainbranch');

    // Create categories
    console.log('🗂️ Creating categories...');
    const categories = [
      'Printer Consumables',
      'Printer Parts', 
      'Office Equipment',
      'IT Hardware',
      'Stationery',
      'Miscellaneous'
    ];

    for (const categoryName of categories) {
      await Category.create({
        name: categoryName,
        imageUrl: '/placeholder-category.jpg',
        isActive: true,
        createdBy: adminUser._id
      });
      console.log(`✅ Created category: ${categoryName}`);
    }

    console.log('\n📦 Seed completed successfully!');
    console.log('\n📋 Summary:');
    console.log(`- Admin user: ${adminUsername} / ${adminPassword}`);
    console.log('- Branch user: mainbranch / Branch@123');
    console.log(`- Categories: ${categories.length}`);

    await mongoose.disconnect();
    console.log('\n✅ Database seeding completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

seedDatabase();
