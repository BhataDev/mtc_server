const bcrypt = require('bcrypt');
const mongoose = require('mongoose');

// Connect to MongoDB (update connection string as needed)
mongoose.connect('mongodb://localhost:27017/mtc-ecommerce', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// Define Branch schema (simplified)
const BranchSchema = new mongoose.Schema({
  name: String,
  username: String,
  passwordHash: String,
  isActive: Boolean,
});

const Branch = mongoose.model('Branch', BranchSchema);

async function debugBranch() {
  try {
    console.log('🔍 Searching for branches...');
    
    // Find all branches
    const branches = await Branch.find({});
    console.log(`📊 Found ${branches.length} branches:`);
    
    branches.forEach((branch, index) => {
      console.log(`\n${index + 1}. Branch: ${branch.name}`);
      console.log(`   Username: ${branch.username}`);
      console.log(`   Active: ${branch.isActive}`);
      console.log(`   Password Hash: ${branch.passwordHash?.substring(0, 20)}...`);
      console.log(`   Hash Length: ${branch.passwordHash?.length}`);
    });

    // Test password for 'test' user
    const testBranch = await Branch.findOne({ username: 'test' });
    if (testBranch) {
      console.log('\n🧪 Testing common passwords for "test" branch:');
      const testPasswords = ['test', 'password', '12345678', 'test123', 'admin'];
      
      for (const pwd of testPasswords) {
        const isValid = await bcrypt.compare(pwd, testBranch.passwordHash);
        console.log(`   "${pwd}" -> ${isValid ? '✅ VALID' : '❌ Invalid'}`);
      }
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    mongoose.connection.close();
  }
}

debugBranch();
