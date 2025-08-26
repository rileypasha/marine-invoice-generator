/**
 * Integration Test - Screenshots Scenario
 * Reproduces the exact issue shown in curr1.png and curr2.png
 * 
 * Issue: Standard user saves invoice but it doesn't appear on Master Dashboard
 */

const request = require('supertest');
const { PrismaClient } = require('@prisma/client');

describe('Screenshots Scenario - Invoice Save and Master Dashboard', () => {
  let app;
  let prisma;
  let standardUserSession;
  let masterSession;
  
  beforeAll(async () => {
    // Setup test database
    prisma = new PrismaClient();
    
    // Setup Express app
    const express = require('express');
    const session = require('express-session');
    const SQLiteStore = require('connect-sqlite3')(session);
    
    app = express();
    app.use(express.json());
    app.use(session({
      store: new SQLiteStore({
        db: 'test-sessions.db',
        dir: './data'
      }),
      secret: 'test-secret',
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: false,
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000
      }
    }));
    
    // Load middleware
    const { loadUser } = require('../../server/middleware/auth');
    app.use(loadUser);
    
    // Load routes
    const authRouter = require('../../server/routes/auth');
    const apiRouter = require('../../server/routes/api');
    const masterRouter = require('../../server/routes/master');
    
    app.use('/api/auth', authRouter);
    app.use('/api/v1', apiRouter);
    app.use('/api/master', masterRouter);
    
    // Set master emails
    process.env.MASTER_EMAILS = 'rpasha@marinegroupbw.com';
  });
  
  afterAll(async () => {
    // Cleanup test invoices
    await prisma.invoice.deleteMany({
      where: {
        OR: [
          { vesselName: 'test' },
          { vesselName: { contains: 'TEST_' } }
        ]
      }
    });
    
    await prisma.$disconnect();
  });
  
  describe('Reproduce curr1.png → curr2.png scenario', () => {
    let savedInvoiceId;
    
    test('Step 1: Standard user (password34220) logs in successfully', async () => {
      standardUserSession = request.agent(app);
      
      const response = await standardUserSession
        .post('/api/auth/login')
        .send({
          email: 'test@marinegroupbw.com',
          name: 'password34220'
        });
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.user.email).toBe('test@marinegroupbw.com');
      expect(response.body.user.name).toBe('password34220');
      
      console.log('✅ Standard user logged in:', response.body.user.email);
    });
    
    test('Step 2: Standard user saves invoice with nested data structure', async () => {
      // This matches the actual frontend data structure
      const invoiceData = {
        vessel: {
          name: 'test',
          weight: '0',
          beam: '0'
        },
        customer: {
          customerName: '',
          customerEmail: '',
          customerPhone: ''
        },
        estimator: {
          name: 'Marine Test User',
          email: ''
        },
        lineItems: []
      };
      
      const response = await standardUserSession
        .post('/api/v1/invoice/save')
        .send({
          title: 'test - Unknown',
          data: invoiceData
        });
      
      console.log('Save response status:', response.status);
      if (response.status !== 200) {
        console.log('Save error:', response.body);
      }
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.invoice).toBeDefined();
      expect(response.body.invoice.vesselName).toBe('test');
      expect(response.body.invoice.status).toBe('saved');
      expect(response.body.invoice.userId).toBeDefined();
      
      savedInvoiceId = response.body.invoice.id;
      
      console.log('✅ Invoice saved with ID:', savedInvoiceId);
      console.log('   - Vessel:', response.body.invoice.vesselName);
      console.log('   - Status:', response.body.invoice.status);
      console.log('   - UserId:', response.body.invoice.userId);
    });
    
    test('Step 3: Save a second invoice to match screenshot (2 saved items)', async () => {
      const secondInvoiceData = {
        vessel: {
          name: 'test',
          weight: '0',
          beam: '0'
        },
        customer: {
          customerName: '',
          customerEmail: '',
          customerPhone: ''
        },
        estimator: {
          name: 'Marine Test User',
          email: ''
        }
      };
      
      const response = await standardUserSession
        .post('/api/v1/invoice/save')
        .send({
          title: 'test - Unknown',
          data: secondInvoiceData
        });
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      
      console.log('✅ Second invoice saved');
    });
    
    test('Step 4: Master user logs in (rpasha@marinegroupbw.com)', async () => {
      masterSession = request.agent(app);
      
      const response = await masterSession
        .post('/api/auth/login')
        .send({
          email: 'rpasha@marinegroupbw.com',
          name: 'Master User'
        });
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.user.email).toBe('rpasha@marinegroupbw.com');
      expect(response.body.user.role).toBe('master');
      
      console.log('✅ Master user logged in:', response.body.user.email);
    });
    
    test('Step 5: Master Dashboard shows the saved invoices (FIX VERIFICATION)', async () => {
      const response = await masterSession
        .get('/api/master/invoices');
      
      console.log('Master Dashboard Response:');
      console.log('  - Status:', response.status);
      console.log('  - Total invoices:', response.body.invoices?.length);
      console.log('  - Pagination:', response.body.pagination);
      
      expect(response.status).toBe(200);
      expect(response.body.invoices).toBeDefined();
      expect(response.body.invoices.length).toBeGreaterThanOrEqual(2);
      
      // Find our test invoices
      const testInvoices = response.body.invoices.filter(inv => 
        inv.vesselName === 'test'
      );
      
      expect(testInvoices.length).toBeGreaterThanOrEqual(2);
      
      console.log('✅ Test invoices found on Master Dashboard:', testInvoices.length);
      
      // Verify invoice details
      const savedInvoice = testInvoices.find(inv => inv.id === savedInvoiceId);
      expect(savedInvoice).toBeDefined();
      expect(savedInvoice.status).toBe('saved');
      expect(savedInvoice.userId).toBeDefined();
      
      console.log('✅ ISSUE FIXED: Invoices now appear on Master Dashboard!');
    });
    
    test('Step 6: Debug endpoint shows all invoices', async () => {
      const response = await masterSession
        .get('/api/master/debug');
      
      console.log('\n=== DEBUG INFO ===');
      console.log('Total invoices in database:', response.body.total);
      console.log('Status counts:', response.body.statusCounts);
      console.log('Test invoices:', response.body.invoices.filter(inv => 
        inv.vesselName === 'test'
      ));
      
      expect(response.status).toBe(200);
      expect(response.body.total).toBeGreaterThanOrEqual(2);
    });
    
    test('Step 7: Master can search for test invoices', async () => {
      const response = await masterSession
        .get('/api/master/invoices?search=test');
      
      expect(response.status).toBe(200);
      expect(response.body.invoices).toBeDefined();
      expect(response.body.invoices.length).toBeGreaterThanOrEqual(2);
      
      console.log('✅ Search works: Found', response.body.invoices.length, 'test invoices');
    });
    
    test('Step 8: Stats endpoint shows correct counts', async () => {
      const response = await masterSession
        .get('/api/master/stats');
      
      expect(response.status).toBe(200);
      expect(response.body.totalSaved).toBeGreaterThanOrEqual(2);
      
      console.log('✅ Stats correct: Total saved =', response.body.totalSaved);
    });
  });
  
  describe('Security Verification', () => {
    test('Non-master user cannot access Master Dashboard', async () => {
      const response = await standardUserSession
        .get('/api/master/invoices');
      
      expect(response.status).toBe(403);
      
      console.log('✅ Security: Non-master blocked with 403');
    });
    
    test('Non-master cannot access debug endpoint', async () => {
      const response = await standardUserSession
        .get('/api/master/debug');
      
      expect(response.status).toBe(403);
      
      console.log('✅ Security: Debug endpoint protected');
    });
  });
  
  describe('Edge Cases', () => {
    test('Invoice with minimal data still appears on dashboard', async () => {
      // Save invoice with absolute minimum data
      const response = await standardUserSession
        .post('/api/v1/invoice/save')
        .send({
          title: 'Minimal Test',
          data: {
            vessel: { name: 'TEST_MINIMAL' }
          }
        });
      
      expect(response.status).toBe(200);
      
      // Verify it appears on dashboard
      const dashboardResponse = await masterSession
        .get('/api/master/invoices?search=TEST_MINIMAL');
      
      expect(dashboardResponse.status).toBe(200);
      expect(dashboardResponse.body.invoices.length).toBeGreaterThan(0);
      
      console.log('✅ Minimal invoice appears on dashboard');
    });
    
    test('Invoice with complete data shows all fields', async () => {
      const completeData = {
        vessel: {
          name: 'TEST_COMPLETE',
          weight: '500',
          beam: '25'
        },
        customer: {
          customerName: 'Test Customer',
          customerEmail: 'customer@test.com',
          customerPhone: '(555) 123-4567'
        },
        estimator: {
          name: 'Test Estimator',
          email: 'estimator@test.com'
        },
        subtotal: 1000,
        taxAmount: 100,
        total: 1100,
        grossProfit: 200,
        profitPercent: 20
      };
      
      const saveResponse = await standardUserSession
        .post('/api/v1/invoice/save')
        .send({
          title: 'Complete Test',
          data: completeData
        });
      
      expect(saveResponse.status).toBe(200);
      
      const dashboardResponse = await masterSession
        .get('/api/master/invoices?search=TEST_COMPLETE');
      
      expect(dashboardResponse.status).toBe(200);
      
      const invoice = dashboardResponse.body.invoices[0];
      expect(invoice.vesselName).toBe('TEST_COMPLETE');
      expect(invoice.vesselWeight).toBe(500);
      expect(invoice.vesselBeam).toBe(25);
      expect(invoice.customerName).toBe('Test Customer');
      expect(invoice.customerEmail).toBe('customer@test.com');
      expect(invoice.customerPhone).toBe('(555) 123-4567');
      expect(invoice.total).toBe(1100);
      
      console.log('✅ Complete invoice shows all fields on dashboard');
    });
  });
});