const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

const users = [
  { email: 'rpasha@marinegroupbw.com', name: 'Riley Pasha', role: 'master' },
  { email: 'lmachado@marinegroupbw.com', name: 'Luis Machado', role: 'standard' },
  { email: 'kramos@marinegroupbw.com', name: 'K Ramos', role: 'standard' },
  { email: 'leah@marinegroupbw.com', name: 'Leah', role: 'standard' },
  { email: 'dawn@fifthavenuelanding.com', name: 'Dawn', role: 'standard' },
  { email: 'albert@marinegroupbw.com', name: 'Albert', role: 'standard' },
  { email: 'cgarcia@marinegroupbw.com', name: 'C Garcia', role: 'standard' },
  { email: 'dylan@fifthavenuelanding.com', name: 'Dylan', role: 'standard' },
  { email: 'aaron@marinegroupbw.com', name: 'Aaron', role: 'standard' },
];

const password = 'TestPassword123!';

async function createUsers() {
  console.log('Creating users...\n');

  const hashedPassword = await bcrypt.hash(password, 10);

  for (const user of users) {
    try {
      // Generate a unique ID
      const id = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      const created = await prisma.user.upsert({
        where: { email: user.email },
        update: {
          password: hashedPassword,
          name: user.name,
          role: user.role,
        },
        create: {
          id,
          email: user.email,
          name: user.name,
          role: user.role,
          password: hashedPassword,
        },
      });

      console.log(`✓ ${user.email} (${user.role})`);
    } catch (error) {
      console.error(`✗ Failed to create ${user.email}:`, error.message);
    }
  }

  console.log('\nAll users created/updated successfully!');
  console.log(`Password for all users: ${password}`);
}

createUsers()
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
