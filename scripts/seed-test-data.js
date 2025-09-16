/**
 * Test Data Seeding Script
 *
 * Seeds the test database with realistic data for comprehensive testing.
 * Ensures consistent test data across CI/CD environments.
 */

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function seedTestData() {
  console.log('🌱 Starting test data seeding...');

  try {
    // Clean existing data
    await prisma.invoice.deleteMany();
    await prisma.user.deleteMany();
    console.log('🧹 Cleaned existing test data');

    // Create test users
    const hashedPassword = await bcrypt.hash('testpass123', 10);

    const testUsers = [
      {
        id: 'test-user-1',
        email: 'test1@marinegroup.com',
        username: 'testuser1',
        password: hashedPassword,
        role: 'USER',
        isActive: true,
      },
      {
        id: 'test-user-2',
        email: 'test2@marinegroup.com',
        username: 'testuser2',
        password: hashedPassword,
        role: 'ADMIN',
        isActive: true,
      },
      {
        id: 'test-user-3',
        email: 'test3@marinegroup.com',
        username: 'testuser3',
        password: hashedPassword,
        role: 'USER',
        isActive: false,
      }
    ];

    for (const user of testUsers) {
      await prisma.user.create({ data: user });
    }
    console.log(`✅ Created ${testUsers.length} test users`);

    // Create test invoices with various statuses
    const testInvoices = [
      {
        id: 'invoice-001',
        vesselName: 'Test Vessel Alpha',
        customerName: 'Test Customer Corp',
        userEmail: 'test1@marinegroup.com',
        status: 'DRAFT',
        total: 1500.00,
        date: new Date('2024-01-15'),
        requestType: 'MATERIAL_REQUEST',
        priority: 'NORMAL',
        description: 'Test material request for vessel maintenance',
        items: JSON.stringify([
          { name: 'Marine Paint', quantity: 5, price: 200.00 },
          { name: 'Safety Equipment', quantity: 2, price: 250.00 }
        ]),
        comments: JSON.stringify([
          { text: 'Initial request', timestamp: new Date().toISOString(), author: 'test1@marinegroup.com' }
        ])
      },
      {
        id: 'invoice-002',
        vesselName: 'Test Vessel Beta',
        customerName: 'Beta Marine Solutions',
        userEmail: 'test2@marinegroup.com',
        status: 'PENDING',
        total: 3200.50,
        date: new Date('2024-01-20'),
        requestType: 'SERVICE_REQUEST',
        priority: 'HIGH',
        description: 'Urgent engine maintenance',
        items: JSON.stringify([
          { name: 'Engine Oil', quantity: 10, price: 150.00 },
          { name: 'Filter Replacement', quantity: 3, price: 400.00 },
          { name: 'Labor Hours', quantity: 8, price: 250.00 }
        ]),
        comments: JSON.stringify([
          { text: 'Urgent request - engine issues', timestamp: new Date().toISOString(), author: 'test2@marinegroup.com' },
          { text: 'Parts ordered', timestamp: new Date().toISOString(), author: 'test1@marinegroup.com' }
        ])
      },
      {
        id: 'invoice-003',
        vesselName: 'Test Vessel Gamma',
        customerName: 'Gamma Shipping Ltd',
        userEmail: 'test1@marinegroup.com',
        status: 'APPROVED',
        total: 875.25,
        date: new Date('2024-01-10'),
        requestType: 'REPAIR_REQUEST',
        priority: 'NORMAL',
        description: 'Hull repair and maintenance',
        items: JSON.stringify([
          { name: 'Hull Patch Kit', quantity: 2, price: 300.00 },
          { name: 'Welding Materials', quantity: 1, price: 175.25 },
          { name: 'Inspection Fee', quantity: 1, price: 400.00 }
        ]),
        comments: JSON.stringify([
          { text: 'Standard hull maintenance', timestamp: new Date().toISOString(), author: 'test1@marinegroup.com' },
          { text: 'Approved for processing', timestamp: new Date().toISOString(), author: 'test2@marinegroup.com' }
        ])
      },
      {
        id: 'invoice-004',
        vesselName: 'Test Vessel Delta',
        customerName: 'Delta Maritime Corp',
        userEmail: 'test2@marinegroup.com',
        status: 'COMPLETED',
        total: 2450.00,
        date: new Date('2024-01-05'),
        requestType: 'MATERIAL_REQUEST',
        priority: 'NORMAL',
        description: 'Navigation equipment upgrade',
        items: JSON.stringify([
          { name: 'GPS System', quantity: 1, price: 1500.00 },
          { name: 'Radio Equipment', quantity: 1, price: 800.00 },
          { name: 'Installation', quantity: 1, price: 150.00 }
        ]),
        comments: JSON.stringify([
          { text: 'Equipment upgrade request', timestamp: new Date().toISOString(), author: 'test2@marinegroup.com' },
          { text: 'Installation completed', timestamp: new Date().toISOString(), author: 'test1@marinegroup.com' }
        ])
      },
      {
        id: 'invoice-005',
        vesselName: 'Test Vessel Echo',
        customerName: 'Echo Marine Services',
        userEmail: 'test1@marinegroup.com',
        status: 'REJECTED',
        total: 5000.00,
        date: new Date('2024-01-25'),
        requestType: 'SERVICE_REQUEST',
        priority: 'LOW',
        description: 'Complete vessel overhaul',
        items: JSON.stringify([
          { name: 'Engine Overhaul', quantity: 1, price: 3000.00 },
          { name: 'Hull Restoration', quantity: 1, price: 1500.00 },
          { name: 'System Upgrade', quantity: 1, price: 500.00 }
        ]),
        comments: JSON.stringify([
          { text: 'Complete overhaul request', timestamp: new Date().toISOString(), author: 'test1@marinegroup.com' },
          { text: 'Rejected - exceeds budget limits', timestamp: new Date().toISOString(), author: 'test2@marinegroup.com' }
        ])
      }
    ];

    for (const invoice of testInvoices) {
      await prisma.invoice.create({ data: invoice });
    }
    console.log(`✅ Created ${testInvoices.length} test invoices`);

    // Create test invoices for edit workflow testing
    const editTestInvoices = [];
    for (let i = 1; i <= 10; i++) {
      editTestInvoices.push({
        id: `edit-test-${i.toString().padStart(3, '0')}`,
        vesselName: `Edit Test Vessel ${i}`,
        customerName: `Edit Test Customer ${i}`,
        userEmail: 'test1@marinegroup.com',
        status: 'DRAFT',
        total: (Math.random() * 5000 + 100).toFixed(2),
        date: new Date(),
        requestType: ['MATERIAL_REQUEST', 'SERVICE_REQUEST', 'REPAIR_REQUEST'][i % 3],
        priority: ['LOW', 'NORMAL', 'HIGH'][i % 3],
        description: `Edit test invoice ${i} for workflow testing`,
        items: JSON.stringify([
          { name: `Test Item ${i}`, quantity: Math.floor(Math.random() * 10) + 1, price: Math.random() * 500 + 50 }
        ]),
        comments: JSON.stringify([])
      });
    }

    for (const invoice of editTestInvoices) {
      await prisma.invoice.create({ data: invoice });
    }
    console.log(`✅ Created ${editTestInvoices.length} edit test invoices`);

    // Verify data creation
    const userCount = await prisma.user.count();
    const invoiceCount = await prisma.invoice.count();

    console.log(`📊 Test data summary:`);
    console.log(`   Users: ${userCount}`);
    console.log(`   Invoices: ${invoiceCount}`);
    console.log(`✅ Test data seeding completed successfully`);

  } catch (error) {
    console.error('❌ Test data seeding failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// CLI execution
if (require.main === module) {
  seedTestData()
    .then(() => {
      console.log('🎉 Test data seeding process completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Test data seeding process failed:', error);
      process.exit(1);
    });
}

module.exports = { seedTestData };