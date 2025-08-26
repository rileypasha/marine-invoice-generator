/**
 * Quick test to verify status=saved fix is working
 */

const request = require('supertest');
const express = require('express');
const session = require('express-session');
const { PrismaClient } = require('@prisma/client');

const app = express();
const prisma = new PrismaClient();

// Setup app
app.use(express.json());
app.use(session({
  secret: 'test-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, httpOnly: true }
}));

// Load middleware
const { loadUser } = require('./server/middleware/auth');
app.use(loadUser);

// Mock master session
app.use((req, res, next) => {
  req.session = req.session || {};
  req.session.user = { 
    id: 'test-master', 
    email: 'rpasha@marinegroupbw.com', 
    name: 'Test Master',
    role: 'master' 
  };
  req.user = req.session.user;
  next();
});

// Load master routes
const masterRouter = require('./server/routes/master');
app.use('/api/master', masterRouter);

async function testStatusFix() {
  console.log('\n🧪 Testing Master Dashboard Status=Saved Fix\n');
  console.log('================================================\n');
  
  // Test 1: status=saved should work without 500 error
  console.log('📌 Test 1: status=saved parameter');
  try {
    const response = await request(app)
      .get('/api/master/invoices?status=saved&page=1&limit=20&sortBy=savedAt&sortOrder=desc');
    
    if (response.status === 500) {
      console.log('   ❌ FAILED: Got 500 error');
      console.log('   Error:', response.body);
    } else if (response.status === 200) {
      console.log('   ✅ SUCCESS: No 500 error!');
      console.log(`   Returned ${response.body.invoices?.length || 0} invoices`);
    } else {
      console.log(`   ⚠️ Unexpected status: ${response.status}`);
    }
  } catch (error) {
    console.log('   ❌ Request failed:', error.message);
  }
  
  console.log();
  
  // Test 2: sortBy=total should work
  console.log('📌 Test 2: sortBy=total with status=saved');
  try {
    const response = await request(app)
      .get('/api/master/invoices?status=saved&sortBy=total&sortOrder=desc');
    
    if (response.status === 500) {
      console.log('   ❌ FAILED: Got 500 error');
      console.log('   Error:', response.body);
    } else if (response.status === 200) {
      console.log('   ✅ SUCCESS: Sorting by total works!');
      console.log(`   Returned ${response.body.invoices?.length || 0} invoices`);
    } else {
      console.log(`   ⚠️ Unexpected status: ${response.status}`);
    }
  } catch (error) {
    console.log('   ❌ Request failed:', error.message);
  }
  
  console.log();
  
  // Test 3: sortBy=total ASC should also work
  console.log('📌 Test 3: sortBy=total ASC');
  try {
    const response = await request(app)
      .get('/api/master/invoices?status=saved&sortBy=total&sortOrder=asc');
    
    if (response.status === 500) {
      console.log('   ❌ FAILED: Got 500 error');
      console.log('   Error:', response.body);
    } else if (response.status === 200) {
      console.log('   ✅ SUCCESS: Sorting by total ASC works!');
      console.log(`   Returned ${response.body.invoices?.length || 0} invoices`);
    } else {
      console.log(`   ⚠️ Unexpected status: ${response.status}`);
    }
  } catch (error) {
    console.log('   ❌ Request failed:', error.message);
  }
  
  console.log();
  
  // Test 4: Empty status parameter should work (default to saved+submitted)
  console.log('📌 Test 4: Empty status parameter');
  try {
    const response = await request(app)
      .get('/api/master/invoices?status=&sortBy=savedAt&sortOrder=desc');
    
    if (response.status === 500) {
      console.log('   ❌ FAILED: Got 500 error');
    } else if (response.status === 200) {
      console.log('   ✅ SUCCESS: Empty status works!');
      console.log(`   Returned ${response.body.invoices?.length || 0} invoices`);
    }
  } catch (error) {
    console.log('   ❌ Request failed:', error.message);
  }
  
  console.log();
  
  // Test 5: All empty parameters
  console.log('📌 Test 5: All empty parameters');
  try {
    const response = await request(app)
      .get('/api/master/invoices?status=&search=&dateFrom=&dateTo=&sortBy=&sortOrder=');
    
    if (response.status === 500) {
      console.log('   ❌ FAILED: Got 500 error');
    } else if (response.status === 200) {
      console.log('   ✅ SUCCESS: Empty parameters handled!');
      console.log(`   Returned ${response.body.invoices?.length || 0} invoices`);
    }
  } catch (error) {
    console.log('   ❌ Request failed:', error.message);
  }
  
  console.log('\n================================================');
  console.log('🏁 Test Complete!\n');
  
  await prisma.$disconnect();
  process.exit(0);
}

testStatusFix().catch(console.error);