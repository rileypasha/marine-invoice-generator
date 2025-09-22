const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkUserInvoices() {
  try {
    // Find the test user
    const testUser = await prisma.user.findUnique({
      where: { email: 'test@marinegroupbw.com' }
    });

    if (testUser) {
      console.log('Test user found:');
      console.log('  ID:', testUser.id);
      console.log('  Email:', testUser.email);
      console.log('  Name:', testUser.name);

      // Check invoices with this user ID
      const invoicesForTestUser = await prisma.invoice.count({
        where: { userId: testUser.id }
      });
      console.log('\nInvoices for this user ID:', invoicesForTestUser);
    } else {
      console.log('Test user not found in database');
    }

    // Check what userId the existing invoices have
    const invoicesWithUserIds = await prisma.invoice.findMany({
      select: {
        id: true,
        userId: true,
        userEmail: true,
        title: true
      },
      take: 5
    });

    console.log('\nSample of existing invoices:');
    invoicesWithUserIds.forEach(inv => {
      console.log(`  Invoice ${inv.id.substring(0, 8)}... - userId: ${inv.userId}, userEmail: ${inv.userEmail}`);
    });

    // Check unique userIds in invoices
    const uniqueUserIds = await prisma.invoice.groupBy({
      by: ['userId'],
      _count: { userId: true }
    });

    console.log('\nUnique userIds in invoices table:');
    uniqueUserIds.forEach(u => {
      console.log(`  userId: ${u.userId} - Count: ${u._count.userId}`);
    });

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkUserInvoices();