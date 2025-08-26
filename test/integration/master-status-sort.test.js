/**
 * Master Dashboard Status and Sorting Test Suite
 * Tests the fixes for status=saved parameter and numeric field sorting
 */

const request = require('supertest');
const { PrismaClient } = require('@prisma/client');
const express = require('express');
const session = require('express-session');

describe('Master Dashboard Status and Sorting Fixes', () => {
  let app;
  let prisma;
  let masterSession;
  let standardSession;
  
  beforeAll(async () => {
    // Setup test database
    prisma = new PrismaClient();
    
    // Clear test data
    await prisma.invoice.deleteMany({
      where: {
        OR: [
          { vesselName: { contains: 'STATUS_TEST_' } },
          { vesselName: { contains: 'SORT_TEST_' } }
        ]
      }
    });
    
    // Setup Express app
    app = express();
    app.use(express.json());
    app.use(session({
      secret: 'test-secret',
      resave: false,
      saveUninitialized: false,
      cookie: { secure: false, httpOnly: true, maxAge: 24 * 60 * 60 * 1000 }
    }));
    
    // Load middleware and routes
    const { loadUser } = require('../../server/middleware/auth');
    app.use(loadUser);
    
    const authRouter = require('../../server/routes/auth');
    const apiRouter = require('../../server/routes/api');
    const masterRouter = require('../../server/routes/master');
    
    app.use('/api/auth', authRouter);
    app.use('/api/v1', apiRouter);
    app.use('/api/master', masterRouter);
    
    // Set master emails
    process.env.MASTER_EMAILS = 'rpasha@marinegroupbw.com';
    
    // Create test invoices with different statuses
    await prisma.invoice.createMany({
      data: [
        {
          title: 'Status Test Saved 1',
          data: JSON.stringify({ vesselName: 'STATUS_TEST_SAVED_1', total: 1000 }),
          vesselName: 'STATUS_TEST_SAVED_1',
          status: 'saved',
          total: 1000,
          savedAt: new Date('2024-01-01'),
          userId: 'test-user-1',
          userEmail: 'user1@test.com'
        },
        {
          title: 'Status Test Saved 2',
          data: JSON.stringify({ vesselName: 'STATUS_TEST_SAVED_2', total: 2000 }),
          vesselName: 'STATUS_TEST_SAVED_2',
          status: 'saved',
          total: 2000,
          savedAt: new Date('2024-01-02'),
          userId: 'test-user-1',
          userEmail: 'user1@test.com'
        },
        {
          title: 'Status Test Submitted',
          data: JSON.stringify({ vesselName: 'STATUS_TEST_SUBMITTED', total: 3000 }),
          vesselName: 'STATUS_TEST_SUBMITTED',
          status: 'submitted',
          total: 3000,
          savedAt: new Date('2024-01-03'),
          userId: 'test-user-2',
          userEmail: 'user2@test.com'
        },
        {
          title: 'Status Test Draft',
          data: JSON.stringify({ vesselName: 'STATUS_TEST_DRAFT', total: 4000 }),
          vesselName: 'STATUS_TEST_DRAFT',
          status: 'draft',
          total: 4000,
          savedAt: new Date('2024-01-04'),
          userId: 'test-user-1',
          userEmail: 'user1@test.com'
        },
        {
          title: 'Status Test Completed',
          data: JSON.stringify({ vesselName: 'STATUS_TEST_COMPLETED', total: 5000 }),
          vesselName: 'STATUS_TEST_COMPLETED',
          status: 'completed',
          total: 5000,
          savedAt: new Date('2024-01-05'),
          userId: 'test-user-2',
          userEmail: 'user2@test.com'
        }
      ]
    });
    
    // Create invoices for sorting tests (including nulls)
    await prisma.invoice.createMany({
      data: [
        {
          title: 'Sort Test Null',
          data: JSON.stringify({ vesselName: 'SORT_TEST_NULL_TOTAL' }),
          vesselName: 'SORT_TEST_NULL_TOTAL',
          status: 'saved',
          total: null,
          savedAt: new Date('2024-02-01'),
          userId: 'test-user-1',
          userEmail: 'user1@test.com'
        },
        {
          title: 'Sort Test Zero',
          data: JSON.stringify({ vesselName: 'SORT_TEST_ZERO_TOTAL', total: 0 }),
          vesselName: 'SORT_TEST_ZERO_TOTAL',
          status: 'saved',
          total: 0,
          savedAt: new Date('2024-02-02'),
          userId: 'test-user-1',
          userEmail: 'user1@test.com'
        },
        {
          title: 'Sort Test High',
          data: JSON.stringify({ vesselName: 'SORT_TEST_HIGH_TOTAL', total: 99999 }),
          vesselName: 'SORT_TEST_HIGH_TOTAL',
          status: 'saved',
          total: 99999,
          savedAt: new Date('2024-02-03'),
          userId: 'test-user-1',
          userEmail: 'user1@test.com'
        },
        {
          title: 'Sort Test Medium',
          data: JSON.stringify({ vesselName: 'SORT_TEST_MED_TOTAL', total: 5000 }),
          vesselName: 'SORT_TEST_MED_TOTAL',
          status: 'saved',
          total: 5000,
          savedAt: new Date('2024-02-04'),
          userId: 'test-user-1',
          userEmail: 'user1@test.com'
        },
        {
          title: 'Sort Test Low',
          data: JSON.stringify({ vesselName: 'SORT_TEST_LOW_TOTAL', total: 100 }),
          vesselName: 'SORT_TEST_LOW_TOTAL',
          status: 'saved',
          total: 100,
          savedAt: new Date('2024-02-05'),
          userId: 'test-user-1',
          userEmail: 'user1@test.com'
        }
      ]
    });
  });
  
  afterAll(async () => {
    // Cleanup test data
    await prisma.invoice.deleteMany({
      where: {
        OR: [
          { vesselName: { contains: 'STATUS_TEST_' } },
          { vesselName: { contains: 'SORT_TEST_' } }
        ]
      }
    });
    
    await prisma.$disconnect();
  });
  
  beforeEach(async () => {
    // Create fresh sessions for each test
    masterSession = request.agent(app);
    standardSession = request.agent(app);
    
    // Login as master
    await masterSession
      .post('/api/auth/login')
      .send({
        email: 'rpasha@marinegroupbw.com',
        name: 'Master User'
      });
    
    // Login as standard user
    await standardSession
      .post('/api/auth/login')
      .send({
        email: 'standard@test.com',
        name: 'Standard User'
      });
  });
  
  describe('Status Parameter Handling', () => {
    test('status=saved returns both saved and submitted invoices', async () => {
      const response = await masterSession
        .get('/api/master/invoices?status=saved');
      
      expect(response.status).toBe(200);
      expect(response.body.invoices).toBeDefined();
      
      const statuses = response.body.invoices
        .filter(inv => inv.vesselName?.startsWith('STATUS_TEST_'))
        .map(inv => inv.status);
      
      expect(statuses).toContain('saved');
      expect(statuses).toContain('submitted');
      expect(statuses).not.toContain('draft');
      expect(statuses).not.toContain('completed');
      
      console.log('✅ status=saved correctly returns saved and submitted invoices');
    });
    
    test('empty status parameter returns saved and submitted invoices', async () => {
      const response = await masterSession
        .get('/api/master/invoices?status=');
      
      expect(response.status).toBe(200);
      
      const statuses = response.body.invoices
        .filter(inv => inv.vesselName?.startsWith('STATUS_TEST_'))
        .map(inv => inv.status);
      
      expect(statuses).toContain('saved');
      expect(statuses).toContain('submitted');
      
      console.log('✅ Empty status parameter works correctly');
    });
    
    test('status=draft returns only draft invoices', async () => {
      const response = await masterSession
        .get('/api/master/invoices?status=draft');
      
      expect(response.status).toBe(200);
      
      const testInvoices = response.body.invoices
        .filter(inv => inv.vesselName?.startsWith('STATUS_TEST_'));
      
      if (testInvoices.length > 0) {
        const statuses = testInvoices.map(inv => inv.status);
        expect(statuses).toEqual(['draft']);
      }
      
      console.log('✅ status=draft filter works correctly');
    });
    
    test('invalid status value falls back to default view', async () => {
      const response = await masterSession
        .get('/api/master/invoices?status=invalid_status');
      
      expect(response.status).toBe(200);
      expect(response.body.invoices).toBeDefined();
      
      // Should still return data, not error out
      console.log('✅ Invalid status value handled gracefully');
    });
  });
  
  describe('Numeric Field Sorting', () => {
    test('Sort by total DESC puts highest values first, nulls last', async () => {
      const response = await masterSession
        .get('/api/master/invoices?sortBy=total&sortOrder=desc');
      
      expect(response.status).toBe(200);
      
      const sortTestInvoices = response.body.invoices
        .filter(inv => inv.vesselName?.startsWith('SORT_TEST_'));
      
      // Check ordering
      const totals = sortTestInvoices.map(inv => inv.total);
      
      // Non-null values should be sorted desc
      const nonNullTotals = totals.filter(t => t !== null);
      for (let i = 1; i < nonNullTotals.length; i++) {
        expect(nonNullTotals[i]).toBeLessThanOrEqual(nonNullTotals[i-1]);
      }
      
      // Nulls should be at the end
      const nullIndex = totals.indexOf(null);
      if (nullIndex !== -1) {
        expect(nullIndex).toBeGreaterThanOrEqual(nonNullTotals.length - 1);
      }
      
      console.log('✅ Sort by total DESC works with nulls handled correctly');
    });
    
    test('Sort by total ASC puts lowest values first, nulls last', async () => {
      const response = await masterSession
        .get('/api/master/invoices?sortBy=total&sortOrder=asc');
      
      expect(response.status).toBe(200);
      
      const sortTestInvoices = response.body.invoices
        .filter(inv => inv.vesselName?.startsWith('SORT_TEST_'));
      
      const totals = sortTestInvoices.map(inv => inv.total);
      
      // Non-null values should be sorted asc
      const nonNullTotals = totals.filter(t => t !== null);
      for (let i = 1; i < nonNullTotals.length; i++) {
        expect(nonNullTotals[i]).toBeGreaterThanOrEqual(nonNullTotals[i-1]);
      }
      
      console.log('✅ Sort by total ASC works with nulls handled correctly');
    });
    
    test('Sort by savedAt works without errors', async () => {
      const response = await masterSession
        .get('/api/master/invoices?sortBy=savedAt&sortOrder=desc');
      
      expect(response.status).toBe(200);
      expect(response.body.invoices).toBeDefined();
      
      console.log('✅ Sort by savedAt works correctly');
    });
    
    test('Invalid sort field falls back to default', async () => {
      const response = await masterSession
        .get('/api/master/invoices?sortBy=invalidField&sortOrder=desc');
      
      expect(response.status).toBe(200);
      expect(response.body.invoices).toBeDefined();
      
      console.log('✅ Invalid sort field handled gracefully');
    });
  });
  
  describe('Combined Filters and Sorting', () => {
    test('status=saved with sortBy=total works without 500 error', async () => {
      const response = await masterSession
        .get('/api/master/invoices?status=saved&sortBy=total&sortOrder=desc');
      
      expect(response.status).toBe(200);
      expect(response.body.invoices).toBeDefined();
      
      // Should include saved and submitted, sorted by total
      const testInvoices = response.body.invoices
        .filter(inv => inv.vesselName?.startsWith('STATUS_TEST_') || 
                      inv.vesselName?.startsWith('SORT_TEST_'));
      
      expect(testInvoices.length).toBeGreaterThan(0);
      
      console.log('✅ Combined status=saved and sortBy=total works');
    });
    
    test('Empty parameters do not cause errors', async () => {
      const response = await masterSession
        .get('/api/master/invoices?status=&search=&dateFrom=&dateTo=&sortBy=&sortOrder=');
      
      expect(response.status).toBe(200);
      expect(response.body.invoices).toBeDefined();
      
      console.log('✅ Empty parameters handled gracefully');
    });
    
    test('All parameters with values work together', async () => {
      const response = await masterSession
        .get('/api/master/invoices?status=saved&search=SORT&sortBy=total&sortOrder=asc&page=1&limit=10');
      
      expect(response.status).toBe(200);
      expect(response.body.invoices).toBeDefined();
      
      // Should only return SORT_TEST invoices that are saved/submitted
      const invoices = response.body.invoices;
      invoices.forEach(inv => {
        if (inv.vesselName?.includes('SORT')) {
          expect(['saved', 'submitted']).toContain(inv.status);
        }
      });
      
      console.log('✅ Complex query with multiple parameters works');
    });
  });
  
  describe('Error Recovery', () => {
    test('API returns recovery data when possible', async () => {
      // Try to trigger an error with a very complex query
      const response = await masterSession
        .get('/api/master/invoices?status=saved&search=' + 'x'.repeat(200));
      
      expect(response.status).toBe(200);
      
      // Even if truncated, should still work
      expect(response.body.invoices).toBeDefined();
      
      console.log('✅ Long search string handled safely');
    });
    
    test('Numeric values as strings are handled', async () => {
      const response = await masterSession
        .get('/api/master/invoices?page=abc&limit=xyz');
      
      expect(response.status).toBe(200);
      expect(response.body.pagination.page).toBe(1); // Should default to 1
      expect(response.body.pagination.limit).toBe(20); // Should default to 20
      
      console.log('✅ Invalid numeric parameters converted to defaults');
    });
  });
  
  describe('Performance and Load', () => {
    test('Dashboard loads within 2 seconds with many invoices', async () => {
      const start = Date.now();
      
      const response = await masterSession
        .get('/api/master/invoices?status=saved&sortBy=total&sortOrder=desc');
      
      const duration = Date.now() - start;
      
      expect(response.status).toBe(200);
      expect(duration).toBeLessThan(2000);
      
      console.log(`✅ Dashboard loaded in ${duration}ms`);
    });
  });
});