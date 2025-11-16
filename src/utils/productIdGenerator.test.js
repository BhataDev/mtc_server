// Test file to demonstrate product ID generation
const { generateSubcategoryAbbreviation } = require('../modules/products/product.model');

// Test cases for different subcategory names
const testCases = [
  'Laptops',           // Expected: LAP
  'Mobile Phones',     // Expected: MOPH  
  'Cleaning Card',     // Expected: CLCA
  'Cleaning Kit',      // Expected: CLKI
  'Desktop Computers', // Expected: DECO
  'Gaming Accessories',// Expected: GAAC
  'Smart Watches',     // Expected: SMWA
  'Wireless Headphones', // Expected: WIHE
  'External Hard Drives', // Expected: EHD (first char of each word)
  'USB Flash Drives',  // Expected: UFD
  'Network Switches',  // Expected: NESW
  'Power Banks',       // Expected: POBA
  'Screen Protectors', // Expected: SCPR
  'Phone Cases',       // Expected: PHCA
  'Tablet Stands',     // Expected: TAST
];

console.log('Product ID Abbreviation Test Results:');
console.log('=====================================');

testCases.forEach(subcategory => {
  const abbreviation = generateSubcategoryAbbreviation(subcategory);
  console.log(`${subcategory.padEnd(25)} → ${abbreviation}`);
});

console.log('\nExample Product IDs:');
console.log('===================');
testCases.slice(0, 5).forEach(subcategory => {
  const abbreviation = generateSubcategoryAbbreviation(subcategory);
  console.log(`${subcategory}:`);
  console.log(`  ${abbreviation}001, ${abbreviation}002, ${abbreviation}003, ...`);
});
