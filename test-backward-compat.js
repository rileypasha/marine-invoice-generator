/**
 * Test backward compatibility with missing hasChanges column
 */

const request = require('supertest');
const express = require('express');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const { PrismaClient } = require('@prisma/client');

// Setup app
const app = express();
const prisma = new PrismaClient();

app.set('trust proxy', 1);

// Session configuration
const sessionConfig = {
  store: new SQLiteStore({
    db: 'test-compat-sessions.db',
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
const { loadUser } = require('./server/middleware/auth');
app.use(loadUser);

// Load routes
const authRouter = require('./server/routes/auth');
const apiRouter = require('./server/routes/api');
const masterRouter = require('./server/routes/master');

app.use('/api/auth', authRouter);
app.use('/api/v1', apiRouter);
app.use('/api/master', masterRouter);

process.env.MASTER_EMAILS = 'rpasha@marinegroupbw.com';

async function testBackwardCompatibility() {
  console.log('\n🧪 Testing Backward Compatibility\n');
  console.log('================================================\n');
  
  // Login as user
  console.log('📌 Step 1: Login');
  const userAgent = request.agent(app);
  
  try {
    const loginRes = await userAgent
      .post('/api/auth/login')
      .send({
        email: 'compat@test.com',
        name: 'Compatibility Test'
      });
    
    console.log(`   Login status: ${loginRes.status}`);
    
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
  
  // Test 1: Save invoice (should work with fallback)
  console.log('📌 Test 2: Save invoice (with hasChanges fallback)');
  
  const invoiceData = {
    vessel: {
      name: 'Compatibility Test Vessel',
      weight: 100,
      beam: 20
    },
    customer: {
      customerName: 'Test Customer',
      customerEmail: 'customer@test.com'
    },
    total: 5000
  };
  
  try {
    const saveRes = await userAgent
      .post('/api/v1/invoice/save')
      .send({
        title: 'Compatibility Test Invoice',
        data: invoiceData
      });
    
    console.log(`   Save status: ${saveRes.status}`);
    
    if (saveRes.status === 500) {
      console.log('   ❌ FAILED: Still getting 500 error');
      console.log('   Error:', saveRes.body.error);
      console.log('   Details:', saveRes.body.details?.substring(0, 200));
    } else if (saveRes.status === 200) {
      console.log('   ✅ SUCCESS: Invoice saved with backward compatibility!');
      console.log(`   Invoice ID: ${saveRes.body.invoice?.id}`);
      console.log(`   Used fallback: ${saveRes.body.invoice?.hasChanges === undefined ? 'YES' : 'NO'}`);
    } else {
      console.log(`   ⚠️ Unexpected status: ${saveRes.status}`);
    }
  } catch (error) {
    console.log('   ❌ Error:', error.message);
  }
  
  console.log();
  
  // Test 3: Update invoice
  console.log('📌 Test 3: Update invoice (with hasChanges fallback)');
  
  try {
    // First get an invoice to update
    const invoices = await prisma.invoice.findMany({
      take: 1,
      orderBy: { createdAt: 'desc' }
    });
    
    if (invoices.length > 0) {
      const invoiceId = invoices[0].id;
      
      const updateRes = await userAgent
        .put(`/api/v1/invoice/${invoiceId}`)
        .send({
          title: 'Updated Compatibility Test',
          data: {
            ...invoiceData,
            total: 6000
          }
        });
      
      console.log(`   Update status: ${updateRes.status}`);
      
      if (updateRes.status === 200) {
        console.log('   ✅ SUCCESS: Invoice updated with backward compatibility!');
      } else {
        console.log(`   Status: ${updateRes.status}`);
        console.log('   Response:', updateRes.body);
      }
    } else {
      console.log('   ⚠️ No invoices to update');
    }
  } catch (error) {
    console.log('   ❌ Error:', error.message);
  }
  
  console.log();
  
  // Test 4: Master dashboard query
  console.log('📌 Test 4: Master dashboard query');
  
  // Login as master
  const masterAgent = request.agent(app);
  await masterAgent
    .post('/api/auth/login')
    .send({
      email: 'rpasha@marinegroupbw.com',
      name: 'Master User'
    });
  
  try {
    const dashboardRes = await masterAgent
      .get('/api/master/invoices?status=saved&limit=5');
    
    console.log(`   Dashboard status: ${dashboardRes.status}`);
    
    if (dashboardRes.status === 200) {
      console.log('   ✅ SUCCESS: Dashboard loads without hasChanges!');
      console.log(`   Invoices returned: ${dashboardRes.body.invoices?.length}`);
      
      // Check if hasChanges is in the response
      if (dashboardRes.body.invoices?.length > 0) {
        const hasChangesField = 'hasChanges' in dashboardRes.body.invoices[0];
        console.log(`   hasChanges field present: ${hasChangesField ? 'YES' : 'NO (using fallback)'}`);
      }
    } else {
      console.log(`   Status: ${dashboardRes.status}`);
      console.log('   Error:', dashboardRes.body);
    }
  } catch (error) {
    console.log('   ❌ Error:', error.message);
  }
  
  console.log('\n================================================');
  console.log('🏁 Backward Compatibility Test Complete!\n');
  
  await prisma.$disconnect();
  process.exit(0);
}

testBackwardCompatibility().catch(console.error);