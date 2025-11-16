import mongoose from 'mongoose';
import { Branch } from '../modules/branches/branch.model';
import dotenv from 'dotenv';

dotenv.config();

async function checkBranches() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/mtc-ecommerce';
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    // Get all branches
    const allBranches = await Branch.find({});
    console.log(`\n📊 Total branches in database: ${allBranches.length}`);

    // Get active branches
    const activeBranches = await Branch.find({ isActive: true });
    console.log(`✅ Active branches: ${activeBranches.length}`);

    // Display branch details
    if (activeBranches.length > 0) {
      console.log('\n📍 Active Branches:');
      activeBranches.forEach((branch, index) => {
        console.log(`\n${index + 1}. ${branch.name}`);
        console.log(`   ID: ${branch._id}`);
        console.log(`   Phone: ${branch.phone}`);
        console.log(`   Address: ${branch.addressText}`);
        console.log(`   Location: [${branch.location.coordinates[0]}, ${branch.location.coordinates[1]}]`);
        console.log(`   Active: ${branch.isActive}`);
      });
    } else {
      console.log('\n❌ No active branches found!');
      console.log('\n📍 All Branches (including inactive):');
      allBranches.forEach((branch, index) => {
        console.log(`\n${index + 1}. ${branch.name}`);
        console.log(`   ID: ${branch._id}`);
        console.log(`   Active: ${branch.isActive}`);
        console.log(`   Location: [${branch.location.coordinates[0]}, ${branch.location.coordinates[1]}]`);
      });
    }

    // Test geospatial query
    if (activeBranches.length > 0) {
      console.log('\n\n🧪 Testing Geospatial Query:');
      const testLng = 55.3033014;
      const testLat = 25.2766454;
      console.log(`Testing with coordinates: [${testLng}, ${testLat}]`);

      const nearestBranch = await Branch.findOne({
        isActive: true,
        location: {
          $near: {
            $geometry: {
              type: 'Point',
              coordinates: [testLng, testLat]
            },
            $maxDistance: 500000 // 500km in meters
          }
        }
      });

      if (nearestBranch) {
        console.log(`✅ Found nearest branch: ${nearestBranch.name}`);
      } else {
        console.log('❌ Geospatial query returned no results');
      }
    }

    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkBranches();
