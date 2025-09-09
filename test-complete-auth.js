const https = require('https');

function makeRequest(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          data: data
        });
      });
    });
    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function runTests() {
  console.log('🔍 Running Complete Authentication Tests\n');
  
  // Test 1: Check initial auth state
  console.log('Test 1: Check initial auth state');
  const authCheck1 = await makeRequest({
    hostname: 'mginvoices.com',
    path: '/api/auth/me',
    method: 'GET'
  });
  console.log(`  Status: ${authCheck1.status}`);
  console.log(`  Response: ${authCheck1.data}\n`);
  
  // Test 2: Login
  console.log('Test 2: Attempt login');
  const loginData = JSON.stringify({
    email: 'test@marinegroupbw.com',
    password: 'any-password'
  });
  
  const loginResponse = await makeRequest({
    hostname: 'mginvoices.com',
    path: '/api/auth/login',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': loginData.length
    }
  }, loginData);
  
  console.log(`  Status: ${loginResponse.status}`);
  console.log(`  Response: ${loginResponse.data}`);
  const sessionCookie = loginResponse.headers['set-cookie'];
  console.log(`  Session Cookie: ${sessionCookie ? 'Created' : 'NOT CREATED'}\n`);
  
  // Test 3: Check auth with cookie
  if (sessionCookie) {
    console.log('Test 3: Check auth with session cookie');
    const authCheck2 = await makeRequest({
      hostname: 'mginvoices.com',
      path: '/api/auth/me',
      method: 'GET',
      headers: {
        'Cookie': sessionCookie[0]
      }
    });
    console.log(`  Status: ${authCheck2.status}`);
    console.log(`  Response: ${authCheck2.data}\n`);
  }
  
  // Test 4: Check main page response
  console.log('Test 4: Check main page');
  const mainPage = await makeRequest({
    hostname: 'mginvoices.com',
    path: '/',
    method: 'GET'
  });
  console.log(`  Status: ${mainPage.status}`);
  console.log(`  Content Length: ${mainPage.data.length} bytes\n`);
  
  // Test 5: Check app page response
  console.log('Test 5: Check app page');
  const appPage = await makeRequest({
    hostname: 'mginvoices.com',
    path: '/app',
    method: 'GET'
  });
  console.log(`  Status: ${appPage.status}`);
  console.log(`  Content Length: ${appPage.data.length} bytes\n`);
  
  console.log('✅ Tests complete');
}

runTests().catch(console.error);