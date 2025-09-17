#!/usr/bin/env node

/**
 * Production database migration script
 * Adds password field to User table and sets up default passwords for existing users
 */

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const prisma = new PrismaClient();

async function migrateProductionDatabase() {
  try {
    console.log('🔄 Starting production database migration...');

    // Check if password column already exists
    const tableInfo = await prisma.$queryRaw`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'User' AND column_name = 'password';
    `;

    if (tableInfo.length > 0) {
      console.log('✅ Password column already exists, skipping creation');
    } else {
      console.log('📝 Adding password column to User table...');

      // Add password column
      await prisma.$executeRaw`
        ALTER TABLE "User"
        ADD COLUMN "password" TEXT;
      `;

      console.log('✅ Password column added successfully');
    }

    // Check existing users and set up passwords
    const users = await prisma.user.findMany();
    console.log(`👥 Found ${users.length} existing users`);

    const saltRounds = 12;
    const defaultPassword = 'TempPassword123!'; // Users should change this immediately

    for (const user of users) {
      if (!user.password) {
        console.log(`🔑 Setting password for user: ${user.email}`);

        const hashedPassword = await bcrypt.hash(defaultPassword, saltRounds);

        await prisma.user.update({
          where: { id: user.id },
          data: { password: hashedPassword }
        });

        console.log(`✅ Password set for ${user.email}`);
      } else {
        console.log(`⏭️ ${user.email} already has password, skipping`);
      }
    }

    console.log(`
🎯 Migration completed successfully!

⚠️  IMPORTANT SECURITY NOTICE:
   All users have been assigned the temporary password: ${defaultPassword}

   📧 Users must change their passwords immediately:
   - test@marinegroupbw.com
   - rpasha@marinegroupbw.com
   - rpasha@maringroupbw.com
   - test@marinegroup.com

🔐 You can now implement the User Management dashboard to:
   1. View all users
   2. Reset passwords
   3. Add/remove users
   4. Manage user roles
`);

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Only run if called directly (not imported)
if (require.main === module) {
  migrateProductionDatabase()
    .then(() => {
      console.log('🏁 Migration script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Migration script failed:', error);
      process.exit(1);
    });
}

module.exports = { migrateProductionDatabase };