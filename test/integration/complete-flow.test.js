/**
 * Complete Flow Integration Test
 * Tests the exact scenario from the screenshots
 */

const request = require('supertest');
const { PrismaClient } = require('@prisma/client');

describe('Complete Invoice Flow - Screenshot Scenario', () => {
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
    // Cleanup
    await prisma.invoice.deleteMany({
      where: {
        vesselName: 'test'
      }
    });
    
    await prisma.$disconnect();
  });
  
  test('Reproduce exact screenshot scenario - test invoice visibility', async () => {
    // Step 1: Login as standard user (password34220)
    standardUserSession = request.agent(app);
    
    const loginResponse = await standardUserSession
      .post('/api/auth/login')
      .send({
        email: 'rsw@gmail.com',
        name: 'password34220'
      });
    
    expect(loginResponse.status).toBe(200);
    expect(loginResponse.body.success).toBe(true);
    expect(loginResponse.body.user.email).toBe('rsw@gmail.com');
    
    // Step 2: Save the exact invoice from test1.png
    const invoiceData = {
      vessel: {
        name: 'test',
        weight: '123',
        beam: '123'
      },
      customer: {
        customerName: 'test',
        customerEmail: 'rsw@gmail.com',
        customerPhone: '(432) 493-2423'
      },
      estimator: {
        name: 'password34220',
        email: 'rsw@gmail.com'
      }
    };
    
    const saveResponse = await standardUserSession
      .post('/api/v1/invoice/save')
      .send({
        title: 'test - test',
        data: {
          vesselName: 'test',
          vesselWeight: 123,
          vesselBeam: 123,
          customerName: 'test',
          customerEmail: 'rsw@gmail.com',
          customerPhone: '(432) 493-2423',
          estimatorName: 'password34220',
          estimatorEmail: 'rsw@gmail.com'
        }
      });
    
    console.log('Save Response:', {
      status: saveResponse.status,
      body: saveResponse.body
    });
    
    expect(saveResponse.status).toBe(200);
    expect(saveResponse.body.success).toBe(true);
    expect(saveResponse.body.invoice).toBeDefined();
    expect(saveResponse.body.invoice.vesselName).toBe('test');
    
    const savedInvoiceId = saveResponse.body.invoice.id;
    
    // Step 3: Login as master (rpasha@marinegroupbw.com)
    masterSession = request.agent(app);
    
    const masterLoginResponse = await masterSession
      .post('/api/auth/login')
      .send({
        email: 'rpasha@marinegroupbw.com',
        name: 'Master User'
      });
    
    expect(masterLoginResponse.status).toBe(200);
    expect(masterLoginResponse.body.user.email).toBe('rpasha@marinegroupbw.com');
    
    // Step 4: Check Master Dashboard - should now show the invoice
    const dashboardResponse = await masterSession
      .get('/api/master/invoices');
    
    console.log('Master Dashboard Response:', {
      status: dashboardResponse.status,
      totalInvoices: dashboardResponse.body.invoices?.length,
      pagination: dashboardResponse.body.pagination
    });
    
    expect(dashboardResponse.status).toBe(200);
    expect(dashboardResponse.body.invoices).toBeDefined();
    expect(dashboardResponse.body.invoices.length).toBeGreaterThan(0);
    
    // Find the test invoice
    const testInvoice = dashboardResponse.body.invoices.find(
      inv => inv.id === savedInvoiceId
    );
    
    expect(testInvoice).toBeDefined();
    expect(testInvoice.vesselName).toBe('test');
    expect(testInvoice.vesselWeight).toBe(123);
    expect(testInvoice.vesselBeam).toBe(123);
    expect(testInvoice.customerName).toBe('test');
    expect(testInvoice.status).toBe('saved');
    expect(testInvoice.userId).toBeDefined(); // Must have user association
    
    // Step 5: Verify stats are updated
    const statsResponse = await masterSession
      .get('/api/master/stats');
    
    expect(statsResponse.status).toBe(200);
    expect(statsResponse.body.totalSaved).toBeGreaterThan(0);
    
    // Should NOT show "No invoices found matching your criteria"
    expect(dashboardResponse.body.invoices.length).not.toBe(0);
    
    console.log('✅ Test invoice successfully appears on Master Dashboard!');
  });
  
  test('Verify invoice persists in database', async () => {
    // Direct database check
    const invoices = await prisma.invoice.findMany({
      where: {
        vesselName: 'test'
      }
    });
    
    expect(invoices.length).toBeGreaterThan(0);
    
    const testInvoice = invoices[0];
    expect(testInvoice.vesselWeight).toBe(123);
    expect(testInvoice.vesselBeam).toBe(123);
    expect(testInvoice.customerName).toBe('test');
    expect(testInvoice.userId).toBeDefined();
    expect(testInvoice.userEmail).toBe('rsw@gmail.com');
    expect(testInvoice.status).toBe('saved');
    
    console.log('✅ Invoice properly stored in database with all fields!');
  });
  
  test('Master can search for the test invoice', async () => {
    const searchResponse = await masterSession
      .get('/api/master/invoices?search=test');
    
    expect(searchResponse.status).toBe(200);
    expect(searchResponse.body.invoices.length).toBeGreaterThan(0);
    
    const found = searchResponse.body.invoices.some(
      inv => inv.vesselName === 'test'
    );
    
    expect(found).toBe(true);
    
    console.log('✅ Master can search and find the test invoice!');
  });
  
  test('Non-master cannot access Master Dashboard', async () => {
    const response = await standardUserSession
      .get('/api/master/invoices');
    
    expect(response.status).toBe(403);
    
    console.log('✅ Security: Non-master users blocked from Master Dashboard!');
  });
});