#!/usr/bin/env node

/**
 * Test script for vessel API endpoints
 * Validates CRUD operations and search functionality
 */

const https = require('https');

// Test configuration
const config = {
  baseUrl: 'http://localhost:3000',
  testVessel: {
    name: 'Test Vessel API',
    registration_number: 'TEST123',
    length_ft: 45.5,
    beam_ft: 12.0,
    weight_tons: 150,
    home_port: 'Test Harbor',
    owner_name: 'Test Owner',
    owner_email: 'test@example.com'
  }
};

let testVesselId = null;

// Helper function to make HTTP requests
function makeRequest(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, config.baseUrl);
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Cookie': 'test_js=value' // Use test auth
      }
    };

    const req = require(url.protocol === 'https:' ? 'https' : 'http').request(url, options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const parsedBody = body ? JSON.parse(body) : {};
          resolve({ status: res.statusCode, data: parsedBody, headers: res.headers });
        } catch (error) {
          resolve({ status: res.statusCode, data: body, headers: res.headers });
        }
      });
    });

    req.on('error', reject);

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

// Test functions
async function testCreateVessel() {
  console.log('🧪 Testing vessel creation...');

  try {
    const response = await makeRequest('POST', '/api/vessels', config.testVessel);

    if (response.status === 201) {
      testVesselId = response.data.id;
      console.log('✅ Vessel created successfully:', response.data.name);
      console.log(`   ID: ${testVesselId}`);
      return true;
    } else {
      console.error('❌ Vessel creation failed:', response.status, response.data);
      return false;
    }
  } catch (error) {
    console.error('❌ Vessel creation error:', error.message);
    return false;
  }
}

async function testGetVessel() {
  if (!testVesselId) {
    console.log('⏭️ Skipping vessel retrieval test (no vessel ID)');
    return false;
  }

  console.log('🧪 Testing vessel retrieval...');

  try {
    const response = await makeRequest('GET', `/api/vessels/${testVesselId}`);

    if (response.status === 200) {
      console.log('✅ Vessel retrieved successfully:', response.data.name);
      console.log(`   Registration: ${response.data.registration_number}`);
      return true;
    } else {
      console.error('❌ Vessel retrieval failed:', response.status, response.data);
      return false;
    }
  } catch (error) {
    console.error('❌ Vessel retrieval error:', error.message);
    return false;
  }
}

async function testVesselSearch() {
  console.log('🧪 Testing vessel search...');

  try {
    const response = await makeRequest('GET', '/api/vessels/search?query=Test&limit=5');

    if (response.status === 200) {
      const vessels = response.data.vessels || [];
      console.log(`✅ Search returned ${vessels.length} vessels`);

      if (vessels.length > 0) {
        console.log(`   First result: ${vessels[0].name}`);
      }
      return true;
    } else {
      console.error('❌ Vessel search failed:', response.status, response.data);
      return false;
    }
  } catch (error) {
    console.error('❌ Vessel search error:', error.message);
    return false;
  }
}

async function testVesselsList() {
  console.log('🧪 Testing vessels list...');

  try {
    const response = await makeRequest('GET', '/api/vessels?page=1&limit=10');

    if (response.status === 200) {
      const vessels = response.data.vessels || [];
      const pagination = response.data.pagination || {};
      console.log(`✅ List returned ${vessels.length} vessels`);
      console.log(`   Total: ${pagination.total}, Pages: ${pagination.pages}`);
      return true;
    } else {
      console.error('❌ Vessels list failed:', response.status, response.data);
      return false;
    }
  } catch (error) {
    console.error('❌ Vessels list error:', error.message);
    return false;
  }
}

async function testUpdateVessel() {
  if (!testVesselId) {
    console.log('⏭️ Skipping vessel update test (no vessel ID)');
    return false;
  }

  console.log('🧪 Testing vessel update...');

  try {
    const updateData = {
      name: 'Updated Test Vessel',
      length_ft: 50.0
    };

    const response = await makeRequest('PATCH', `/api/vessels/${testVesselId}`, updateData);

    if (response.status === 200) {
      console.log('✅ Vessel updated successfully:', response.data.name);
      console.log(`   New length: ${response.data.length_ft} ft`);
      return true;
    } else {
      console.error('❌ Vessel update failed:', response.status, response.data);
      return false;
    }
  } catch (error) {
    console.error('❌ Vessel update error:', error.message);
    return false;
  }
}

async function testDeleteVessel() {
  if (!testVesselId) {
    console.log('⏭️ Skipping vessel deletion test (no vessel ID)');
    return false;
  }

  console.log('🧪 Testing vessel deletion (deactivation)...');

  try {
    const response = await makeRequest('DELETE', `/api/vessels/${testVesselId}`);

    if (response.status === 200) {
      console.log('✅ Vessel deactivated successfully');
      return true;
    } else {
      console.error('❌ Vessel deletion failed:', response.status, response.data);
      return false;
    }
  } catch (error) {
    console.error('❌ Vessel deletion error:', error.message);
    return false;
  }
}

// Run all tests
async function runTests() {
  console.log('🚢 Starting Vessel API Tests\n');

  const tests = [
    testCreateVessel,
    testGetVessel,
    testVesselSearch,
    testVesselsList,
    testUpdateVessel,
    testDeleteVessel
  ];

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    try {
      const result = await test();
      if (result) {
        passed++;
      } else {
        failed++;
      }
    } catch (error) {
      console.error(`❌ Test error: ${error.message}`);
      failed++;
    }
    console.log(''); // Blank line between tests
  }

  console.log('📊 Test Results:');
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📈 Success Rate: ${Math.round((passed / (passed + failed)) * 100)}%`);

  if (failed === 0) {
    console.log('\n🎉 All vessel API tests passed!');
    process.exit(0);
  } else {
    console.log('\n💥 Some tests failed. Check the logs above.');
    process.exit(1);
  }
}

// Handle unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Run the tests
runTests().catch(error => {
  console.error('❌ Test runner error:', error);
  process.exit(1);
});