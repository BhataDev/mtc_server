const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '.env');

// Read the .env file
let envContent = fs.readFileSync(envPath, 'utf8');

// Replace PORT=3001 with PORT=4000
envContent = envContent.replace(/^PORT=.*/m, 'PORT=4000');

// Write back to the file
fs.writeFileSync(envPath, envContent);

console.log('✅ Successfully updated PORT from 3001 to 4000 in .env file');
