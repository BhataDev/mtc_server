const bcrypt = require('bcrypt');
const mongoose = require('mongoose');

// Connect to MongoDB (update connection string as needed)
mongoose.connect('mongodb://localhost:27017/mtc-ecommerce', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// Define schemas
const BranchSchema = new mongoose.Schema({
  name: String,
  username: String,
  passwordHash: String,
  isActive: Boolean,
}, { timestamps: true });

const UserSchema = new mongoose.Schema({
  username: String,
  passwordHash: String,
  role: String,
  branch: mongoose.Schema.Types.ObjectId,
  isActive: Boolean,
}, { timestamps: true });

const Branch = mongoose.model('Branch', BranchSchema);
const User = mongoose.model('User', UserSchema);

async function fixBranchPassword() {
  try {
    const username = 'test';
    const newPassword = 'test@123';
    
    console.log(`🔧 Fixing password for branch: ${username}`);
    console.log(`🔑 New password: ${newPassword}`);
    
    // Find the branch
    const branch = await Branch.findOne({ username });
    if (!branch) {
      console.log(`❌ Branch '${username}' not found`);
      return;
    }
    
    console.log(`✅ Found branch: ${branch.name}`);
    
    // Hash the new password
    const saltRounds = 10;
    const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);
    console.log(`🔐 New hash: ${newPasswordHash.substring(0, 20)}...`);
    
    // Update branch password
    branch.passwordHash = newPasswordHash;
    await branch.save();
    console.log(`✅ Branch password updated`);
    
    // Also update the associated user password (if exists)
    const user = await User.findOne({ branch: branch._id });
    if (user) {
      user.passwordHash = newPasswordHash;
      await user.save();
      console.log(`✅ Associated user password updated`);
    } else {
      console.log(`⚠️ No associated user found for this branch`);
    }
    
    // Test the new password
    console.log(`\n🧪 Testing new password...`);
    const isValid = await bcrypt.compare(newPassword, newPasswordHash);
    console.log(`🔐 Password test: ${isValid ? '✅ VALID' : '❌ FAILED'}`);
    
    console.log(`\n🎉 Password fix completed!`);
    console.log(`📝 You can now login with:`);
    console.log(`   Username: ${username}`);
    console.log(`   Password: ${newPassword}`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    mongoose.connection.close();
  }
}

fixBranchPassword();
