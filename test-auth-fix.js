/**
 * Test authentication and session persistence fix
 */

const request = require('supertest');
const express = require('express');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const { PrismaClient } = require('@prisma/client');
const path = require('path');

// Setup app exactly as in server.js
const app = express();
const prisma = new PrismaClient();

app.set('trust proxy', 1);

// Session configuration matching server.js
const sessionConfig = {
  store: new SQLiteStore({
    db: 'test-auth-sessions.db',
    dir: './data'
  }),
  secret: 'test-secret',
  name: 'connect.sid',
  resave: false,
  saveUninitialized: true,
  rolling: true,
  cookie: {
    secure: false,
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000,
    path: '/'
  }
};

app.use(session(sessionConfig));
app.use(express.json());

// Load middleware
const { loadUser, requireAuth, requireMaster } = require('./server/middleware/auth');
app.use(loadUser);

// Load routes
const authRouter = require('./server/routes/auth');
const apiRouter = require('./server/routes/api');
const masterRouter = require('./server/routes/master');

app.use('/api/auth', authRouter);
app.use('/api/v1', apiRouter);
app.use('/api/master', masterRouter);

// Set master emails
process.env.MASTER_EMAILS = 'rpasha@marinegroupbw.com';

async function testAuthenticationFlow() {
  console.log('\n🧪 Testing Authentication and Session Persistence\n');
  console.log('================================================\n');
  
  // Test 1: Login as standard user
  console.log('📌 Test 1: Login as standard user');
  const standardAgent = request.agent(app); // Use agent to maintain cookies
  
  try {
    const loginRes = await standardAgent
      .post('/api/auth/login')
      .send({
        email: 'standard@test.com',
        name: 'Standard User'
      });
    
    console.log(`   Status: ${loginRes.status}`);
    console.log(`   Success: ${loginRes.body.success}`);
    console.log(`   User: ${loginRes.body.user?.email} (${loginRes.body.user?.role})`);
    console.log(`   Session ID: ${loginRes.body.sessionId}`);
    
    if (loginRes.status !== 200) {
      console.log('   ❌ Login failed!');
      return;
    }
    
    console.log('   ✅ Login successful!');
  } catch (error) {
    console.log('   ❌ Error:', error.message);
    return;
  }
  
  console.log();
  
  // Test 2: Save invoice as standard user (should work with session)
  console.log('📌 Test 2: Save invoice with authenticated session');
  
  try {
    const saveRes = await standardAgent
      .post('/api/v1/invoice/save')
      .send({
        title: 'Test Invoice',
        data: {
          vesselName: 'AUTH_TEST_VESSEL',
          total: 5000
        }
      });
    
    console.log(`   Status: ${saveRes.status}`);
    
    if (saveRes.status === 401) {
      console.log('   ❌ FAILED: Got 401 - Session not persisted!');
      console.log('   Error:', saveRes.body);
    } else if (saveRes.status === 200) {
      console.log('   ✅ SUCCESS: Invoice saved with session!');
      console.log(`   Invoice ID: ${saveRes.body.invoice?.id}`);
    } else {
      console.log(`   ⚠️ Unexpected status: ${saveRes.status}`);
      console.log('   Response:', saveRes.body);
    }
  } catch (error) {
    console.log('   ❌ Error:', error.message);
  }
  
  console.log();
  
  // Test 3: Login as master user
  console.log('📌 Test 3: Login as master user');
  const masterAgent = request.agent(app);
  
  try {
    const loginRes = await masterAgent
      .post('/api/auth/login')
      .send({
        email: 'rpasha@marinegroupbw.com',
        name: 'Master User'
      });
    
    console.log(`   Status: ${loginRes.status}`);
    console.log(`   User: ${loginRes.body.user?.email} (${loginRes.body.user?.role})`);
    
    if (loginRes.status !== 200) {
      console.log('   ❌ Master login failed!');
      return;
    }
    
    console.log('   ✅ Master login successful!');
  } catch (error) {
    console.log('   ❌ Error:', error.message);
    return;
  }
  
  console.log();
  
  // Test 4: Access master dashboard (should work with session)
  console.log('📌 Test 4: Access master dashboard with session');
  
  try {
    const dashboardRes = await masterAgent
      .get('/api/master/invoices?status=saved&limit=10');
    
    console.log(`   Status: ${dashboardRes.status}`);
    
    if (dashboardRes.status === 401) {
      console.log('   ❌ FAILED: Got 401 - Master session not persisted!');
      console.log('   Error:', dashboardRes.body);
    } else if (dashboardRes.status === 500) {
      console.log('   ❌ FAILED: Got 500 error');
      console.log('   Error:', dashboardRes.body);
    } else if (dashboardRes.status === 200) {
      console.log('   ✅ SUCCESS: Master dashboard accessible!');
      console.log(`   Invoices returned: ${dashboardRes.body.invoices?.length || 0}`);
    } else {
      console.log(`   ⚠️ Unexpected status: ${dashboardRes.status}`);
    }
  } catch (error) {
    console.log('   ❌ Error:', error.message);
  }
  
  console.log();
  
  // Test 5: Check session persistence with /api/auth/me
  console.log('📌 Test 5: Check session persistence');
  
  try {
    const meRes = await masterAgent.get('/api/auth/me');
    
    console.log(`   Status: ${meRes.status}`);
    
    if (meRes.status === 401) {
      console.log('   ❌ Session not found!');
    } else if (meRes.status === 200) {
      console.log('   ✅ Session persisted!');
      console.log(`   User: ${meRes.body.user?.email}`);
    }
  } catch (error) {
    console.log('   ❌ Error:', error.message);
  }
  
  console.log();
  
  // Test 6: Standard user cannot access master dashboard
  console.log('📌 Test 6: Standard user blocked from master dashboard');
  
  try {
    const dashboardRes = await standardAgent
      .get('/api/master/invoices');
    
    console.log(`   Status: ${dashboardRes.status}`);
    
    if (dashboardRes.status === 403) {
      console.log('   ✅ Correctly blocked with 403!');
    } else if (dashboardRes.status === 200) {
      console.log('   ❌ SECURITY ISSUE: Standard user accessed master dashboard!');
    } else {
      console.log(`   Status: ${dashboardRes.status}`);
    }
  } catch (error) {
    console.log('   Error:', error.message);
  }
  
  console.log('\n================================================');
  console.log('🏁 Authentication Test Complete!\n');
  
  await prisma.$disconnect();
  process.exit(0);
}

testAuthenticationFlow().catch(console.error);