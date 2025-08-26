/**
 * Final test of invoice save functionality after database migration
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
    db: 'test-save-sessions.db',
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

app.use('/api/auth', authRouter);
app.use('/api/v1', apiRouter);

// Set environment
process.env.MASTER_EMAILS = 'rpasha@marinegroupbw.com';

async function testInvoiceSave() {
  console.log('\n🧪 Testing Invoice Save After Database Migration\n');
  console.log('================================================\n');
  
  // Login as standard user
  console.log('📌 Step 1: Login as standard user');
  const userAgent = request.agent(app);
  
  try {
    const loginRes = await userAgent
      .post('/api/auth/login')
      .send({
        email: 'test@example.com',
        name: 'Test User'
      });
    
    console.log(`   Login status: ${loginRes.status}`);
    console.log(`   User: ${loginRes.body.user?.email}`);
    
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
  
  // Test saving invoice with all fields
  console.log('📌 Step 2: Save invoice with complete data');
  
  const invoiceData = {
    vessel: {
      name: 'Test Yacht 2024',
      weight: 150,
      beam: 25
    },
    customer: {
      customerName: 'John Doe',
      customerEmail: 'john@example.com',
      customerPhone: '(555) 123-4567'
    },
    estimator: {
      name: 'Jane Smith',
      email: 'jane@marinegroupbw.com'
    },
    lineItems: [
      {
        description: 'Hull Repair',
        type: 'Labor',
        cost: 5000
      },
      {
        description: 'Paint Job',
        type: 'Materials',
        cost: 2500
      }
    ],
    subtotal: 7500,
    taxAmount: 600,
    total: 8100,
    grossProfit: 2000,
    profitPercent: 24.69,
    market: 'San Diego'
  };
  
  try {
    const saveRes = await userAgent
      .post('/api/v1/invoice/save')
      .set('X-Request-ID', 'test_save_001')
      .send({
        title: 'Test Invoice After Migration',
        data: invoiceData,
        metadata: {
          source: 'test',
          version: '1.0'
        }
      });
    
    console.log(`   Save status: ${saveRes.status}`);
    
    if (saveRes.status === 500) {
      console.log('   ❌ FAILED: Got 500 error');
      console.log('   Error:', saveRes.body.error);
      console.log('   Details:', saveRes.body.details);
      return;
    } else if (saveRes.status === 200) {
      console.log('   ✅ SUCCESS: Invoice saved!');
      console.log(`   Invoice ID: ${saveRes.body.invoice?.id}`);
      console.log(`   Has all fields:`);
      console.log(`     - hasChanges: ${saveRes.body.invoice?.hasChanges}`);
      console.log(`     - userId: ${saveRes.body.invoice?.userId}`);
      console.log(`     - vesselName: ${saveRes.body.invoice?.vesselName}`);
      console.log(`     - customerName: ${saveRes.body.invoice?.customerName}`);
      console.log(`     - total: ${saveRes.body.invoice?.total}`);
      console.log(`     - status: ${saveRes.body.invoice?.status}`);
    } else {
      console.log(`   ⚠️ Unexpected status: ${saveRes.status}`);
      console.log('   Response:', saveRes.body);
    }
  } catch (error) {
    console.log('   ❌ Error:', error.message);
  }
  
  console.log();
  
  // Test minimal invoice save
  console.log('📌 Step 3: Save minimal invoice');
  
  try {
    const saveRes = await userAgent
      .post('/api/v1/invoice/save')
      .send({
        title: 'Minimal Invoice',
        data: {
          vesselName: 'Simple Boat',
          total: 1000
        }
      });
    
    console.log(`   Save status: ${saveRes.status}`);
    
    if (saveRes.status === 500) {
      console.log('   ❌ FAILED: Got 500 error');
      console.log('   Error:', saveRes.body.error);
    } else if (saveRes.status === 200) {
      console.log('   ✅ SUCCESS: Minimal invoice saved!');
      console.log(`   Invoice ID: ${saveRes.body.invoice?.id}`);
    }
  } catch (error) {
    console.log('   ❌ Error:', error.message);
  }
  
  console.log();
  
  // Verify invoices in database
  console.log('📌 Step 4: Verify invoices in database');
  
  try {
    const invoiceCount = await prisma.invoice.count();
    console.log(`   Total invoices in database: ${invoiceCount}`);
    
    const recentInvoice = await prisma.invoice.findFirst({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        vesselName: true,
        hasChanges: true,
        userId: true,
        status: true
      }
    });
    
    if (recentInvoice) {
      console.log('   ✅ Most recent invoice:');
      console.log(`     - ID: ${recentInvoice.id}`);
      console.log(`     - Title: ${recentInvoice.title}`);
      console.log(`     - Vessel: ${recentInvoice.vesselName}`);
      console.log(`     - hasChanges: ${recentInvoice.hasChanges}`);
      console.log(`     - userId: ${recentInvoice.userId}`);
      console.log(`     - status: ${recentInvoice.status}`);
    }
  } catch (error) {
    console.log('   ❌ Database query error:', error.message);
  }
  
  console.log('\n================================================');
  console.log('🏁 Invoice Save Test Complete!\n');
  
  await prisma.$disconnect();
  process.exit(0);
}

testInvoiceSave().catch(console.error);