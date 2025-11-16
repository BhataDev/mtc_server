// Script to fix modelNumber constraint issues
// Run this script to remove the unique constraint on modelNumber field

const mongoose = require('mongoose');
require('dotenv').config();

async function fixModelNumberConstraint() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const db = mongoose.connection.db;
    const collection = db.collection('products');

    // Get current indexes
    const indexes = await collection.indexes();
    console.log('Current indexes:', indexes.map(idx => ({ name: idx.name, key: idx.key })));

    // Drop the unique index on modelNumber if it exists
    try {
      await collection.dropIndex('modelNumber_1');
      console.log('✅ Dropped unique index on modelNumber');
    } catch (error) {
      if (error.code === 27) {
        console.log('ℹ️ modelNumber_1 index does not exist (already removed)');
      } else {
        console.log('⚠️ Error dropping modelNumber index:', error.message);
      }
    }

    // Create sparse index for modelNumber (allows nulls and duplicates of null)
    try {
      await collection.createIndex({ modelNumber: 1 }, { sparse: true, name: 'modelNumber_sparse' });
      console.log('✅ Created sparse index on modelNumber');
    } catch (error) {
      console.log('⚠️ Error creating sparse index:', error.message);
    }

    // Update any products with empty modelNumber to null
    const updateResult = await collection.updateMany(
      { modelNumber: { $in: ['', null] } },
      { $unset: { modelNumber: 1 } }
    );
    console.log(`✅ Updated ${updateResult.modifiedCount} products with empty modelNumber`);

    console.log('🎉 ModelNumber constraint fix completed successfully!');
    
  } catch (error) {
    console.error('❌ Error fixing modelNumber constraint:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Run the script
fixModelNumberConstraint();
