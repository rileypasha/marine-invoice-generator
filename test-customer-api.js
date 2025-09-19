const axios = require('axios');

const BASE_URL = 'http://localhost:3001';

async function testCustomerAPI() {
  try {
    console.log('🧪 Testing Customer API...');

    // Create axios instance with session support
    const client = axios.create({
      baseURL: BASE_URL,
      withCredentials: true,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    // Test 1: Login first
    console.log('\n1. Testing login...');
    const loginResponse = await client.post('/api/simple-auth/login', {
      email: 'rpasha@marinegroupbw.com',
      password: 'TempPassword123!'
    });
    console.log('✅ Login successful:', loginResponse.data.user.email);

    // Test 2: Get all customers
    console.log('\n2. Testing customer list...');
    const customersResponse = await client.get('/api/customers');
    console.log('✅ Customers retrieved:', customersResponse.data.customers.length, 'customers');
    console.log('   Sample customer:', customersResponse.data.customers[0]?.display_name);

    // Test 3: Search customers
    console.log('\n3. Testing customer search...');
    const searchResponse = await client.get('/api/customers/search?query=marine');
    console.log('✅ Search results:', searchResponse.data.customers.length, 'customers found');
    console.log('   Search results:', searchResponse.data.customers.map(c => c.display_name));

    // Test 4: Create a new customer
    console.log('\n4. Testing customer creation...');
    const newCustomer = {
      display_name: 'Test Customer',
      email: 'test@example.com',
      phone: '(555) 000-1234',
      address_line1: '123 Test St',
      city: 'Test City',
      state: 'FL',
      postal_code: '12345'
    };

    const createResponse = await client.post('/api/customers', newCustomer);
    console.log('✅ Customer created:', createResponse.data.display_name);
    const customerId = createResponse.data.id;

    // Test 5: Get single customer
    console.log('\n5. Testing single customer fetch...');
    const singleCustomerResponse = await client.get(`/api/customers/${customerId}`);
    console.log('✅ Single customer retrieved:', singleCustomerResponse.data.display_name);

    // Test 6: Update customer
    console.log('\n6. Testing customer update...');
    const updateResponse = await client.patch(`/api/customers/${customerId}`, {
      phone: '(555) 999-9999',
      notes: 'Updated test customer'
    });
    console.log('✅ Customer updated:', updateResponse.data.phone);

    // Test 7: Delete customer
    console.log('\n7. Testing customer deletion...');
    const deleteResponse = await client.delete(`/api/customers/${customerId}`);
    console.log('✅ Customer deleted:', deleteResponse.data.message);

    console.log('\n🎯 All customer API tests passed!');

  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
    console.error('   Status:', error.response?.status);
    console.error('   Headers:', error.response?.headers);
  }
}

// Run the test
testCustomerAPI();