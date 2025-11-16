const bcrypt = require('bcrypt');

// The hash from your database
const storedHash = '$2b$10$BWHgMhsQrs7UEWV.k1Sq3OuQCQYFh7U/MaK0QPF6OtvrgSzRp.Wme';

// Test different password variations
const passwordsToTest = [
  'dubai@123',
  'Dubai@123',
  'dubai',
  'Dubai',
  'DUBAI@123'
];

console.log('Testing passwords against stored hash...\n');

passwordsToTest.forEach(async (password) => {
  try {
    const isMatch = await bcrypt.compare(password, storedHash);
    console.log(`Password: "${password}" -> ${isMatch ? '✅ MATCH' : '❌ NO MATCH'}`);
  } catch (error) {
    console.log(`Password: "${password}" -> ERROR: ${error.message}`);
  }
});

// Also generate a new hash for 'dubai@123' to compare
bcrypt.hash('dubai@123', 10).then(newHash => {
  console.log(`\nNew hash for 'dubai@123': ${newHash}`);
});
