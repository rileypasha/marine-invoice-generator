/**
 * Performance Test Data Generator
 *
 * Creates realistic high-volume test data for performance testing,
 * load testing, and scalability validation.
 */

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

class PerformanceTestDataGenerator {
  constructor() {
    this.batchSize = 100;
    this.totalUsers = 1000;
    this.totalInvoices = 10000;
  }

  /**
   * Generate comprehensive performance test data
   */
  async generatePerformanceData() {
    console.log('🚀 Starting performance test data generation...');
    console.log(`📊 Target: ${this.totalUsers} users, ${this.totalInvoices} invoices`);

    try {
      // Clean existing data
      await this.cleanExistingData();

      // Generate test data in batches
      await this.generateUsers();
      await this.generateInvoices();
      await this.generateComplexQueries();

      // Validate data generation
      await this.validateGeneratedData();

      console.log('✅ Performance test data generation completed');

    } catch (error) {
      console.error('❌ Performance data generation failed:', error);
      throw error;
    } finally {
      await prisma.$disconnect();
    }
  }

  /**
   * Clean existing test data
   */
  async cleanExistingData() {
    console.log('🧹 Cleaning existing test data...');

    const deleteCounts = await Promise.all([
      prisma.invoice.deleteMany({}),
      prisma.user.deleteMany({})
    ]);

    console.log(`✅ Cleaned ${deleteCounts[0].count} invoices, ${deleteCounts[1].count} users`);
  }

  /**
   * Generate test users in batches
   */
  async generateUsers() {
    console.log(`👥 Generating ${this.totalUsers} test users...`);

    const hashedPassword = await bcrypt.hash('perftest123', 10);
    const roles = ['USER', 'ADMIN', 'MANAGER'];
    const companies = [
      'Marine Solutions Inc',
      'Ocean Logistics Corp',
      'Seafarer Services Ltd',
      'Maritime Operations Co',
      'Coastal Management Group',
      'Deep Sea Industries',
      'Harbor Works LLC',
      'Nautical Systems Inc'
    ];

    let usersCreated = 0;

    for (let batch = 0; batch < Math.ceil(this.totalUsers / this.batchSize); batch++) {
      const batchUsers = [];
      const batchStart = batch * this.batchSize;
      const batchEnd = Math.min(batchStart + this.batchSize, this.totalUsers);

      for (let i = batchStart; i < batchEnd; i++) {
        const userNumber = i + 1;
        batchUsers.push({
          id: `perf-user-${userNumber.toString().padStart(6, '0')}`,
          email: `perftest${userNumber}@marinegroup.com`,
          username: `perfuser${userNumber}`,
          password: hashedPassword,
          role: roles[i % roles.length],
          isActive: Math.random() > 0.1, // 90% active users
          company: companies[i % companies.length],
          createdAt: this.randomDate(new Date('2023-01-01'), new Date()),
        });
      }

      await prisma.user.createMany({ data: batchUsers });
      usersCreated += batchUsers.length;

      if (batch % 10 === 0) {
        console.log(`   📈 Created ${usersCreated}/${this.totalUsers} users`);
      }
    }

    console.log(`✅ Generated ${usersCreated} test users`);
  }

  /**
   * Generate test invoices in batches
   */
  async generateInvoices() {
    console.log(`📋 Generating ${this.totalInvoices} test invoices...`);

    const users = await prisma.user.findMany({ select: { email: true } });
    const statuses = ['DRAFT', 'PENDING', 'APPROVED', 'COMPLETED', 'REJECTED'];
    const requestTypes = ['MATERIAL_REQUEST', 'SERVICE_REQUEST', 'REPAIR_REQUEST'];
    const priorities = ['LOW', 'NORMAL', 'HIGH', 'URGENT'];

    const vesselNames = [
      'MV Ocean Explorer', 'SS Maritime Pride', 'HMS Sea Guardian',
      'MV Cargo Master', 'SS Deep Horizon', 'HMS Wave Runner',
      'MV Steel Navigator', 'SS Blue Waters', 'HMS Storm Chaser',
      'MV Pacific Trader', 'SS Atlantic Star', 'HMS Northern Wind'
    ];

    const customerNames = [
      'Global Shipping Corp', 'International Maritime Ltd', 'Ocean Transport Inc',
      'Seafaring Solutions', 'Maritime Logistics Group', 'Coastal Shipping Co',
      'Deep Water Operations', 'Harbor Management Ltd', 'Nautical Services Inc',
      'Marine Transport Group', 'Offshore Solutions Corp', 'Tidal Operations Ltd'
    ];

    let invoicesCreated = 0;

    for (let batch = 0; batch < Math.ceil(this.totalInvoices / this.batchSize); batch++) {
      const batchInvoices = [];
      const batchStart = batch * this.batchSize;
      const batchEnd = Math.min(batchStart + this.batchSize, this.totalInvoices);

      for (let i = batchStart; i < batchEnd; i++) {
        const invoiceNumber = i + 1;
        const user = users[i % users.length];
        const itemCount = Math.floor(Math.random() * 10) + 1;
        const items = this.generateInvoiceItems(itemCount);
        const total = items.reduce((sum, item) => sum + (item.quantity * item.price), 0);

        batchInvoices.push({
          id: `perf-invoice-${invoiceNumber.toString().padStart(8, '0')}`,
          vesselName: vesselNames[i % vesselNames.length],
          customerName: customerNames[i % customerNames.length],
          userEmail: user.email,
          status: statuses[i % statuses.length],
          total: parseFloat(total.toFixed(2)),
          date: this.randomDate(new Date('2023-01-01'), new Date()),
          requestType: requestTypes[i % requestTypes.length],
          priority: priorities[i % priorities.length],
          description: `Performance test invoice ${invoiceNumber} - ${requestTypes[i % requestTypes.length].toLowerCase().replace('_', ' ')}`,
          items: JSON.stringify(items),
          comments: JSON.stringify(this.generateComments(user.email)),
          createdAt: this.randomDate(new Date('2023-01-01'), new Date()),
          updatedAt: this.randomDate(new Date('2023-06-01'), new Date()),
        });
      }

      await prisma.invoice.createMany({ data: batchInvoices });
      invoicesCreated += batchInvoices.length;

      if (batch % 10 === 0) {
        console.log(`   📈 Created ${invoicesCreated}/${this.totalInvoices} invoices`);
      }
    }

    console.log(`✅ Generated ${invoicesCreated} test invoices`);
  }

  /**
   * Generate complex query test scenarios
   */
  async generateComplexQueries() {
    console.log('🔍 Creating complex query test scenarios...');

    // Create invoices with duplicate patterns for testing edit workflows
    const duplicateTestInvoices = [];
    for (let i = 0; i < 100; i++) {
      const baseVessel = `Duplicate Test Vessel ${Math.floor(i / 10) + 1}`;
      const baseCustomer = `Duplicate Test Customer ${Math.floor(i / 10) + 1}`;

      duplicateTestInvoices.push({
        id: `duplicate-test-${i.toString().padStart(3, '0')}`,
        vesselName: baseVessel,
        customerName: baseCustomer,
        userEmail: 'perftest1@marinegroup.com',
        status: 'DRAFT',
        total: Math.random() * 1000 + 100,
        date: new Date(),
        requestType: 'MATERIAL_REQUEST',
        priority: 'NORMAL',
        description: `Duplicate pattern test ${i}`,
        items: JSON.stringify([{ name: 'Test Item', quantity: 1, price: 100 }]),
        comments: JSON.stringify([])
      });
    }

    await prisma.invoice.createMany({ data: duplicateTestInvoices });
    console.log(`✅ Created ${duplicateTestInvoices.length} duplicate pattern test invoices`);

    // Create time-series data for performance testing
    const timeSeriesInvoices = [];
    const startDate = new Date('2023-01-01');
    const endDate = new Date();
    const daySpan = Math.floor((endDate - startDate) / (1000 * 60 * 60 * 24));

    for (let day = 0; day < daySpan; day += 7) { // Weekly intervals
      const testDate = new Date(startDate.getTime() + (day * 24 * 60 * 60 * 1000));
      const weeklyInvoices = Math.floor(Math.random() * 20) + 5; // 5-25 invoices per week

      for (let j = 0; j < weeklyInvoices; j++) {
        timeSeriesInvoices.push({
          id: `timeseries-${day}-${j}`,
          vesselName: 'Time Series Test Vessel',
          customerName: 'Time Series Customer',
          userEmail: 'perftest2@marinegroup.com',
          status: 'COMPLETED',
          total: Math.random() * 2000 + 200,
          date: testDate,
          requestType: 'SERVICE_REQUEST',
          priority: 'NORMAL',
          description: `Time series test data point`,
          items: JSON.stringify([{ name: 'Time Series Item', quantity: 1, price: 200 }]),
          comments: JSON.stringify([]),
          createdAt: testDate,
          updatedAt: testDate
        });
      }
    }

    await prisma.invoice.createMany({ data: timeSeriesInvoices });
    console.log(`✅ Created ${timeSeriesInvoices.length} time-series test invoices`);
  }

  /**
   * Validate generated data integrity
   */
  async validateGeneratedData() {
    console.log('✅ Validating generated data...');

    const userCount = await prisma.user.count();
    const invoiceCount = await prisma.invoice.count();

    const statusDistribution = await prisma.invoice.groupBy({
      by: ['status'],
      _count: { status: true }
    });

    const priorityDistribution = await prisma.invoice.groupBy({
      by: ['priority'],
      _count: { priority: true }
    });

    console.log(`📊 Data validation summary:`);
    console.log(`   👥 Users: ${userCount}`);
    console.log(`   📋 Invoices: ${invoiceCount}`);
    console.log(`   📈 Status distribution:`, statusDistribution);
    console.log(`   🎯 Priority distribution:`, priorityDistribution);

    // Validate data integrity
    const orphanedInvoices = await prisma.invoice.count({
      where: {
        userEmail: {
          notIn: (await prisma.user.findMany({ select: { email: true } })).map(u => u.email)
        }
      }
    });

    if (orphanedInvoices > 0) {
      throw new Error(`Data integrity issue: ${orphanedInvoices} orphaned invoices found`);
    }

    console.log('✅ Data validation passed - no integrity issues found');
  }

  /**
   * Generate realistic invoice items
   */
  generateInvoiceItems(count) {
    const itemTypes = [
      { name: 'Marine Paint', priceRange: [50, 300] },
      { name: 'Safety Equipment', priceRange: [100, 500] },
      { name: 'Engine Oil', priceRange: [75, 200] },
      { name: 'Navigation Equipment', priceRange: [500, 2000] },
      { name: 'Hull Maintenance', priceRange: [200, 1000] },
      { name: 'Electrical Components', priceRange: [150, 800] },
      { name: 'Fuel System Parts', priceRange: [300, 1200] },
      { name: 'Communication Gear', priceRange: [400, 1500] },
      { name: 'Welding Materials', priceRange: [100, 400] },
      { name: 'Labor Hours', priceRange: [200, 800] }
    ];

    const items = [];
    for (let i = 0; i < count; i++) {
      const itemType = itemTypes[Math.floor(Math.random() * itemTypes.length)];
      const quantity = Math.floor(Math.random() * 10) + 1;
      const price = Math.random() * (itemType.priceRange[1] - itemType.priceRange[0]) + itemType.priceRange[0];

      items.push({
        name: itemType.name,
        quantity,
        price: parseFloat(price.toFixed(2))
      });
    }

    return items;
  }

  /**
   * Generate realistic comments
   */
  generateComments(userEmail) {
    const commentTemplates = [
      'Initial request submitted for review',
      'Approved by management team',
      'Pending parts availability',
      'Work scheduled for next maintenance window',
      'Completed ahead of schedule',
      'Quality inspection passed',
      'Customer notification sent',
      'Documentation updated'
    ];

    const commentCount = Math.floor(Math.random() * 4) + 1;
    const comments = [];

    for (let i = 0; i < commentCount; i++) {
      comments.push({
        text: commentTemplates[Math.floor(Math.random() * commentTemplates.length)],
        timestamp: new Date().toISOString(),
        author: userEmail
      });
    }

    return comments;
  }

  /**
   * Generate random date between two dates
   */
  randomDate(start, end) {
    return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
  }
}

// CLI execution
if (require.main === module) {
  const generator = new PerformanceTestDataGenerator();
  generator.generatePerformanceData()
    .then(() => {
      console.log('🎉 Performance test data generation completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Performance test data generation failed:', error);
      process.exit(1);
    });
}

module.exports = PerformanceTestDataGenerator;