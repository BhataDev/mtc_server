const axios = require('axios');

const API_URL = 'http://localhost:4000/api/v1';

// Test credentials for two different customers
const customer1 = {
  email: 'customer1@test.com',
  password: 'password123',
  name: 'Customer One'
};

const customer2 = {
  email: 'customer2@test.com',
  password: 'password123',
  name: 'Customer Two'
};

async function testWishlist() {
  try {
    console.log('Testing Wishlist Isolation for Multiple Customers\n');
    console.log('='.repeat(50));
    
    // Step 1: Create/Login Customer 1
    console.log('\n1. Creating/Logging in Customer 1...');
    let token1;
    try {
      // Try to signup first
      const signupRes1 = await axios.post(`${API_URL}/customer-auth/signup`, customer1);
      token1 = signupRes1.data.data.token;
      console.log('   ✓ Customer 1 created successfully');
    } catch (err) {
      // If signup fails (user exists), try login
      if (err.response?.status === 409) {
        const loginRes1 = await axios.post(`${API_URL}/customer-auth/login`, {
          email: customer1.email,
          password: customer1.password
        });
        token1 = loginRes1.data.data.token;
        console.log('   ✓ Customer 1 logged in successfully');
      } else {
        throw err;
      }
    }
    
    // Step 2: Create/Login Customer 2
    console.log('\n2. Creating/Logging in Customer 2...');
    let token2;
    try {
      const signupRes2 = await axios.post(`${API_URL}/customer-auth/signup`, customer2);
      token2 = signupRes2.data.data.token;
      console.log('   ✓ Customer 2 created successfully');
    } catch (err) {
      if (err.response?.status === 409) {
        const loginRes2 = await axios.post(`${API_URL}/customer-auth/login`, {
          email: customer2.email,
          password: customer2.password
        });
        token2 = loginRes2.data.data.token;
        console.log('   ✓ Customer 2 logged in successfully');
      } else {
        throw err;
      }
    }
    
    // Step 3: Get a sample product ID (you may need to adjust this)
    console.log('\n3. Getting sample products...');
    const productsRes = await axios.get(`${API_URL}/products?limit=3`);
    const products = productsRes.data.data.products;
    
    if (products.length < 2) {
      console.log('   ⚠ Not enough products in database for testing');
      return;
    }
    
    const product1Id = products[0]._id;
    const product2Id = products[1]._id;
    console.log(`   ✓ Found products: ${product1Id}, ${product2Id}`);
    
    // Step 4: Clear wishlists for both customers
    console.log('\n4. Clearing existing wishlists...');
    try {
      await axios.delete(`${API_URL}/wishlist/clear`, {
        headers: { Authorization: `Bearer ${token1}` }
      });
      console.log('   ✓ Customer 1 wishlist cleared');
    } catch (err) {
      console.log('   ℹ Customer 1 wishlist was already empty');
    }
    
    try {
      await axios.delete(`${API_URL}/wishlist/clear`, {
        headers: { Authorization: `Bearer ${token2}` }
      });
      console.log('   ✓ Customer 2 wishlist cleared');
    } catch (err) {
      console.log('   ℹ Customer 2 wishlist was already empty');
    }
    
    // Step 5: Add product to Customer 1's wishlist
    console.log('\n5. Adding product to Customer 1 wishlist...');
    await axios.post(`${API_URL}/wishlist/add`, 
      { productId: product1Id },
      { headers: { Authorization: `Bearer ${token1}` } }
    );
    console.log(`   ✓ Added product ${product1Id} to Customer 1's wishlist`);
    
    // Step 6: Add different product to Customer 2's wishlist
    console.log('\n6. Adding different product to Customer 2 wishlist...');
    await axios.post(`${API_URL}/wishlist/add`, 
      { productId: product2Id },
      { headers: { Authorization: `Bearer ${token2}` } }
    );
    console.log(`   ✓ Added product ${product2Id} to Customer 2's wishlist`);
    
    // Step 7: Verify Customer 1's wishlist
    console.log('\n7. Verifying Customer 1 wishlist...');
    const wishlist1 = await axios.get(`${API_URL}/wishlist`, {
      headers: { Authorization: `Bearer ${token1}` }
    });
    const items1 = wishlist1.data.data.items;
    console.log(`   ✓ Customer 1 has ${items1.length} item(s) in wishlist`);
    if (items1.length > 0) {
      console.log(`   ✓ Product IDs: ${items1.map(i => i.product._id || i.product).join(', ')}`);
    }
    
    // Step 8: Verify Customer 2's wishlist
    console.log('\n8. Verifying Customer 2 wishlist...');
    const wishlist2 = await axios.get(`${API_URL}/wishlist`, {
      headers: { Authorization: `Bearer ${token2}` }
    });
    const items2 = wishlist2.data.data.items;
    console.log(`   ✓ Customer 2 has ${items2.length} item(s) in wishlist`);
    if (items2.length > 0) {
      console.log(`   ✓ Product IDs: ${items2.map(i => i.product._id || i.product).join(', ')}`);
    }
    
    // Step 9: Verify isolation
    console.log('\n9. Verifying wishlist isolation...');
    const customer1Products = items1.map(i => i.product._id || i.product).map(String);
    const customer2Products = items2.map(i => i.product._id || i.product).map(String);
    
    if (!customer1Products.includes(product2Id) && !customer2Products.includes(product1Id)) {
      console.log('   ✅ SUCCESS: Wishlists are properly isolated!');
      console.log('   ✓ Customer 1 only sees their own products');
      console.log('   ✓ Customer 2 only sees their own products');
    } else {
      console.log('   ❌ FAILURE: Wishlists are NOT properly isolated!');
      console.log('   ✗ Customers can see each other\'s wishlist items');
    }
    
    console.log('\n' + '='.repeat(50));
    console.log('Test completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Test failed with error:');
    console.error(error.response?.data || error.message);
  }
}

// Run the test
testWishlist();
