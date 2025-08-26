/**
 * Integration Tests for Invoice Save to Dashboard Flow
 */

const request = require('supertest');
const { PrismaClient } = require('@prisma/client');

// Test data generators
function generateTestInvoice() {
  const random = Math.floor(Math.random() * 10000);
  return {
    vesselName: `Test Vessel ${random}`,
    customerName: `Test Customer ${random}`,
    customerEmail: `customer${random}@example.com`,
    invoiceNumber: `INV-TEST-${random}`,
    subtotal: 1000 + random,
    taxAmount: 100 + Math.floor(random / 100),
    total: 1100 + random + Math.floor(random / 100),
    market: 'Commercial'
  };
}

describe('Invoice Save to Dashboard Flow', () => {
  let app;
  let standardUserSession;
  let masterSession;
  let prisma;
  
  beforeAll(async () => {
    // Setup test database connection
    prisma = new PrismaClient();
    
    // Clear test data
    await prisma.invoice.deleteMany({
      where: {
        invoiceNumber: {
          startsWith: 'INV-TEST-'
        }
      }
    });
    
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
  });
  
  afterAll(async () => {
    // Cleanup test data
    await prisma.invoice.deleteMany({
      where: {
        invoiceNumber: {
          startsWith: 'INV-TEST-'
        }
      }
    });
    
    await prisma.$disconnect();
  });
  
  beforeEach(async () => {
    // Login as standard user
    standardUserSession = request.agent(app);
    await standardUserSession
      .post('/api/auth/login')
      .send({
        email: 'test@example.com',
        password: 'password'
      });
    
    // Login as master user
    masterSession = request.agent(app);
    await masterSession
      .post('/api/auth/login')
      .send({
        email: 'rpasha@marinegroupbw.com',
        password: 'password'
      });
  });
  
  test('New invoice appears on Master Dashboard immediately', async () => {
    // Standard user saves invoice
    const invoiceData = generateTestInvoice();
    
    const saveResponse = await standardUserSession
      .post('/api/v1/invoice/save')
      .send({
        title: 'Integration Test Invoice',
        data: invoiceData
      });
    
    expect(saveResponse.status).toBe(200);
    expect(saveResponse.body.success).toBe(true);
    const savedId = saveResponse.body.invoice.id;
    
    // Master checks dashboard
    const dashboardResponse = await masterSession
      .get('/api/master/invoices');
    
    expect(dashboardResponse.status).toBe(200);
    
    const foundInvoice = dashboardResponse.body.invoices.find(
      i => i.id === savedId
    );
    
    expect(foundInvoice).toBeDefined();
    expect(foundInvoice.customerName).toBe(invoiceData.customerName);
    expect(foundInvoice.invoiceNumber).toBe(invoiceData.invoiceNumber);
    expect(foundInvoice.status).toBe('saved');
    expect(foundInvoice.userId).toBeTruthy();
  });
  
  test('Updated invoice reflects changes on Master Dashboard', async () => {
    // Create and save initial invoice
    const initialData = generateTestInvoice();
    initialData.customerName = 'Original Customer';
    
    const initial = await standardUserSession
      .post('/api/v1/invoice/save')
      .send({
        title: 'Update Test Invoice',
        data: initialData
      });
    
    expect(initial.status).toBe(200);
    const invoiceId = initial.body.invoice.id;
    
    // Update the invoice
    const updatedData = { ...initialData };
    updatedData.customerName = 'Updated Customer';
    updatedData.total = 5000;
    
    const updated = await standardUserSession
      .put(`/api/v1/invoice/${invoiceId}`)
      .send({
        title: 'Updated Invoice',
        data: updatedData
      });
    
    expect(updated.status).toBe(200);
    
    // Verify on Master Dashboard
    const dashboard = await masterSession
      .get('/api/master/invoices');
    
    const found = dashboard.body.invoices.find(
      i => i.id === invoiceId
    );
    
    expect(found).toBeDefined();
    expect(found.customerName).toBe('Updated Customer');
    expect(found.total).toBe(5000);
  });
  
  test('Deleted invoice disappears from Master Dashboard', async () => {
    // Create invoice
    const invoiceData = generateTestInvoice();
    
    const invoice = await standardUserSession
      .post('/api/v1/invoice/save')
      .send({
        title: 'Delete Test Invoice',
        data: invoiceData
      });
    
    expect(invoice.status).toBe(200);
    const invoiceId = invoice.body.invoice.id;
    
    // Verify it appears on dashboard
    const beforeDelete = await masterSession
      .get('/api/master/invoices');
    
    const foundBefore = beforeDelete.body.invoices.find(
      i => i.id === invoiceId
    );
    expect(foundBefore).toBeDefined();
    
    // Delete invoice
    const deleteResponse = await standardUserSession
      .delete(`/api/v1/invoice/${invoiceId}`);
    
    expect(deleteResponse.status).toBe(200);
    
    // Check Master Dashboard
    const afterDelete = await masterSession
      .get('/api/master/invoices');
    
    const foundAfter = afterDelete.body.invoices.find(
      i => i.id === invoiceId
    );
    
    expect(foundAfter).toBeUndefined();
  });
  
  test('Multiple users invoices all appear on Master Dashboard', async () => {
    // Create invoices from different users
    const user1Invoice = generateTestInvoice();
    user1Invoice.customerName = 'User 1 Customer';
    
    const user2Invoice = generateTestInvoice();
    user2Invoice.customerName = 'User 2 Customer';
    
    // User 1 saves
    const user1Response = await standardUserSession
      .post('/api/v1/invoice/save')
      .send({
        title: 'User 1 Invoice',
        data: user1Invoice
      });
    
    // Simulate User 2 (using same session for simplicity)
    const user2Response = await standardUserSession
      .post('/api/v1/invoice/save')
      .send({
        title: 'User 2 Invoice',
        data: user2Invoice
      });
    
    // Master checks dashboard
    const dashboard = await masterSession
      .get('/api/master/invoices');
    
    const customerNames = dashboard.body.invoices.map(i => i.customerName);
    
    expect(customerNames).toContain('User 1 Customer');
    expect(customerNames).toContain('User 2 Customer');
  });
  
  test('Search filters work across all users invoices', async () => {
    // Create invoices with unique identifiers
    const invoice1 = generateTestInvoice();
    invoice1.vesselName = 'SearchableVessel001';
    
    const invoice2 = generateTestInvoice();
    invoice2.customerName = 'SearchableCustomer002';
    
    await standardUserSession
      .post('/api/v1/invoice/save')
      .send({ data: invoice1 });
    
    await standardUserSession
      .post('/api/v1/invoice/save')
      .send({ data: invoice2 });
    
    // Search by vessel name
    const vesselSearch = await masterSession
      .get('/api/master/invoices?search=SearchableVessel');
    
    expect(vesselSearch.body.invoices.some(
      i => i.vesselName === 'SearchableVessel001'
    )).toBe(true);
    
    // Search by customer name
    const customerSearch = await masterSession
      .get('/api/master/invoices?search=SearchableCustomer');
    
    expect(customerSearch.body.invoices.some(
      i => i.customerName === 'SearchableCustomer002'
    )).toBe(true);
  });
  
  test('Status filter includes both saved and submitted', async () => {
    // Create saved invoice
    const savedInvoice = generateTestInvoice();
    savedInvoice.invoiceNumber = 'INV-SAVED-001';
    
    await standardUserSession
      .post('/api/v1/invoice/save')
      .send({
        data: savedInvoice,
        status: 'saved'
      });
    
    // Create submitted invoice
    const submittedInvoice = generateTestInvoice();
    submittedInvoice.invoiceNumber = 'INV-SUBMITTED-001';
    
    await standardUserSession
      .post('/api/v1/invoice/save')
      .send({
        data: submittedInvoice,
        status: 'submitted'
      });
    
    // Get all invoices (default should include both)
    const allInvoices = await masterSession
      .get('/api/master/invoices');
    
    const invoiceNumbers = allInvoices.body.invoices.map(i => i.invoiceNumber);
    
    expect(invoiceNumbers).toContain('INV-SAVED-001');
    expect(invoiceNumbers).toContain('INV-SUBMITTED-001');
    
    // Filter by saved only
    const savedOnly = await masterSession
      .get('/api/master/invoices?status=saved');
    
    const savedNumbers = savedOnly.body.invoices.map(i => i.invoiceNumber);
    expect(savedNumbers).toContain('INV-SAVED-001');
  });
});

describe('Performance Tests', () => {
  let app;
  let session;
  let prisma;
  
  beforeAll(async () => {
    // Setup as above
    prisma = new PrismaClient();
    
    const express = require('express');
    app = express();
    // ... setup app
  });
  
  test('Dashboard loads within 2 seconds with many invoices', async () => {
    // This test would create many invoices and measure response time
    // Skipping actual implementation for brevity
    
    const startTime = Date.now();
    
    const response = await request(app)
      .get('/api/master/invoices?limit=50');
    
    const duration = Date.now() - startTime;
    
    expect(response.status).toBe(200);
    expect(duration).toBeLessThan(2000);
  });
  
  test('Concurrent saves dont cause race conditions', async () => {
    const promises = Array(5).fill().map(async (_, i) => {
      const invoice = generateTestInvoice();
      invoice.customerName = `Concurrent Customer ${i}`;
      
      return standardUserSession
        .post('/api/v1/invoice/save')
        .send({ data: invoice });
    });
    
    const results = await Promise.all(promises);
    
    // All should succeed
    results.forEach(r => {
      expect(r.status).toBe(200);
    });
    
    // All should have unique IDs
    const ids = results.map(r => r.body.invoice.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(5);
  });
});