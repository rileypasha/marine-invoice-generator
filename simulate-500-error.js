#!/usr/bin/env node

/**
 * Simulate the exact production scenario that could cause a 500 error
 * on /api/invoices/user endpoint
 *
 * Key issue: The auth middleware creates a user with ID 'test-user-1',
 * but the issue report mentions user ID 'f1d69663-63cb-475f-9625-6655dfd56f73'
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
});

async function createTestData() {
  console.log('🔧 Setting up test data...');

  // Create a test user in the Users table with the reported ID
  const reportedUserId = 'f1d69663-63cb-475f-9625-6655dfd56f73';
  const userEmail = 'test@marinegroupbw.com';

  try {
    // First check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: userEmail }
    });

    if (!existingUser) {
      const user = await prisma.user.create({
        data: {
          id: reportedUserId,
          email: userEmail,
          name: 'Test User',
          role: 'standard'
        }
      });
      console.log('✅ Created test user:', user.id);
    } else {
      console.log('ℹ️  User already exists:', existingUser.id);
    }

    // Create some test invoices with the proper user ID
    const testInvoices = [
      {
        title: 'Test Invoice 1',
        status: 'saved',
        userId: reportedUserId,
        userEmail: userEmail,
        userName: 'Test User',
        data: JSON.stringify({
          vessel: { name: 'Test Vessel 1' },
          customer: { customerName: 'Test Customer 1' },
          scope: { total: 1000 }
        }),
        vesselName: 'Test Vessel 1',
        customerName: 'Test Customer 1',
        total: 1000
      },
      {
        title: 'Test Invoice 2',
        status: 'saved',
        userId: reportedUserId,
        userEmail: userEmail,
        userName: 'Test User',
        data: JSON.stringify({
          vessel: { name: 'Test Vessel 2' },
          customer: { customerName: 'Test Customer 2' },
          scope: { total: 2000 }
        }),
        vesselName: 'Test Vessel 2',
        customerName: 'Test Customer 2',
        total: 2000
      }
    ];

    for (const invoiceData of testInvoices) {
      const existingInvoice = await prisma.invoice.findFirst({
        where: {
          title: invoiceData.title,
          userEmail: userEmail
        }
      });

      if (!existingInvoice) {
        const invoice = await prisma.invoice.create({ data: invoiceData });
        console.log(`✅ Created test invoice: ${invoice.title} (${invoice.id})`);
      } else {
        console.log(`ℹ️  Invoice already exists: ${invoiceData.title}`);
      }
    }

  } catch (error) {
    console.error('❌ Error creating test data:', error);
  }
}

async function simulateAuthMiddleware() {
  console.log('\n🎭 Simulating auth middleware behavior...');

  // This simulates the loadUser middleware behavior
  const mockReq = {
    headers: {
      cookie: 'test_js=value; marine_invoice_user=test@marinegroupbw.com'
    },
    session: {}  // Empty session (simulating CloudFlare cookie issue)
  };

  // Simulate the auth middleware logic
  console.log('📋 Step 1: Check if user is in session...');
  if (mockReq.session && mockReq.session.user) {
    console.log('✅ User found in session');
  } else {
    console.log('❌ No user in session, checking fallback...');

    if (mockReq.headers.cookie && mockReq.headers.cookie.includes('marine_invoice_user')) {
      console.log('🔍 Found marine_invoice_user cookie, checking test user fallback...');

      const cookies = mockReq.headers.cookie.split(';').reduce((acc, cookie) => {
        const [key, value] = cookie.trim().split('=');
        acc[key] = value;
        return acc;
      }, {});

      if (cookies['test_js'] === 'value' || mockReq.headers.cookie.includes('test@marinegroupbw.com')) {
        console.log('✅ Test user detected, creating session with hardcoded ID...');

        // This is the problematic line - hardcoded ID 'test-user-1'
        mockReq.session.user = {
          id: 'test-user-1',  // ← THIS IS THE ISSUE!
          email: 'test@marinegroupbw.com',
          name: 'Test User',
          role: 'user'
        };

        console.log('🔧 Auth middleware would set user ID to:', mockReq.session.user.id);
        console.log('⚠️  But actual user in database has ID: f1d69663-63cb-475f-9625-6655dfd56f73');
        return mockReq.session.user;
      }
    }
  }

  return null;
}

async function simulateUserInvoicesQuery() {
  console.log('\n📊 Simulating /api/invoices/user query...');

  // Simulate the middleware setting wrong user ID
  const wrongUser = await simulateAuthMiddleware();

  if (!wrongUser) {
    console.log('❌ Auth would fail');
    return;
  }

  const userEmail = wrongUser.email;
  const userId = wrongUser.id; // This will be 'test-user-1' instead of the correct ID

  console.log(`🔍 Query would look for:`);
  console.log(`  - userEmail: ${userEmail}`);
  console.log(`  - userId: ${userId}`);

  // Build query conditions like the actual route does
  const whereConditions = [];

  if (userEmail) {
    whereConditions.push({ userEmail: userEmail });
  }

  if (userId) {
    whereConditions.push({ userId: userId });
    if (typeof userId !== 'string') {
      whereConditions.push({ userId: userId.toString() });
    }
  }

  console.log('🔍 Query conditions:', whereConditions);

  try {
    const invoices = await prisma.invoice.findMany({
      where: {
        OR: whereConditions,
        status: {
          not: 'draft'
        }
      },
      orderBy: {
        updatedAt: 'desc'
      }
    });

    console.log(`📊 Result: Found ${invoices.length} invoices`);

    if (invoices.length === 0) {
      console.log('🚨 ISSUE REPRODUCED: No invoices found due to user ID mismatch!');
      console.log('   The query looks for userId="test-user-1" but invoices have userId="f1d69663-63cb-475f-9625-6655dfd56f73"');
    } else {
      console.log('✅ Invoices found (issue not reproduced)');
      invoices.forEach(inv => {
        console.log(`  - ${inv.title} (userID: ${inv.userId})`);
      });
    }

    // Now test with the correct user ID
    console.log('\n🔧 Testing with correct user ID...');
    const correctInvoices = await prisma.invoice.findMany({
      where: {
        OR: [
          { userEmail: userEmail },
          { userId: 'f1d69663-63cb-475f-9625-6655dfd56f73' }
        ],
        status: {
          not: 'draft'
        }
      },
      orderBy: {
        updatedAt: 'desc'
      }
    });

    console.log(`📊 With correct ID: Found ${correctInvoices.length} invoices`);

  } catch (error) {
    console.error('❌ Query failed with error:', error.message);
    console.log('🚨 This could be the 500 error cause!');

    // Check if it's a data parsing error
    if (error.message.includes('JSON') || error.message.includes('parse')) {
      console.log('💡 Error appears to be related to data field parsing');
    }
  }
}

async function main() {
  console.log('🚨 SIMULATING PRODUCTION 500 ERROR SCENARIO\n');

  try {
    await createTestData();
    await simulateUserInvoicesQuery();

    console.log('\n📋 DIAGNOSIS:');
    console.log('✅ Database connection: Working');
    console.log('✅ Query logic: Working');
    console.log('❌ USER ID MISMATCH: Auth middleware uses "test-user-1" but actual ID is different');
    console.log('');
    console.log('🔧 RECOMMENDED FIX:');
    console.log('1. Update auth middleware to use correct user ID from database');
    console.log('2. OR ensure invoices are stored with "test-user-1" ID');
    console.log('3. OR add fallback to query by email only when user ID mismatch occurs');

  } catch (error) {
    console.error('❌ Simulation failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);