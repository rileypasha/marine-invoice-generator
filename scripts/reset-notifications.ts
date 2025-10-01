import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function resetNotifications() {
  try {
    const result = await prisma.user.updateMany({
      data: {
        notifyOnNewInvoice: 'none',
        notifyOnChangeRequest: 'none',
        notifyOnApproval: 'none',
      },
    });

    console.log(`Updated ${result.count} users to have all notification preferences set to 'none'`);
  } catch (error) {
    console.error('Error resetting notifications:', error);
  } finally {
    await prisma.$disconnect();
  }
}

resetNotifications();
