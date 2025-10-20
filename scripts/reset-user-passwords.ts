import bcrypt from 'bcrypt';
import { query } from '../server/config/database';

interface User {
  email: string;
  name: string;
  password: string;
  role: string;
}

// ⚠️ WARNING: This script resets TEST ACCOUNTS ONLY
// To reset personal accounts, use: ts-node scripts/reset-single-password.ts <email> <password>

const RESET_USERS: User[] = [
  {
    email: 'test@marinegroupbw.com',
    name: 'Test User',
    password: 'TestPassword123!',
    role: 'admin'
  },
  // NOTE: rpasha@marinegroupbw.com is EXCLUDED from automatic resets
  // Use reset-single-password.ts to reset personal accounts
  {
    email: 'admin@mginvoices.com',
    name: 'Admin User',
    password: 'AdminPassword123!',
    role: 'admin'
  },
  {
    email: 'user@mginvoices.com',
    name: 'Standard User',
    password: 'UserPassword123!',
    role: 'standard'
  }
];

async function resetUserPasswords() {
  console.log('⚠️  WARNING: This will reset TEST ACCOUNT passwords only!');
  console.log('⚠️  Personal accounts (rpasha@marinegroupbw.com) are excluded.');
  console.log('⚠️  To reset personal accounts, use: ts-node scripts/reset-single-password.ts <email> <password>\n');
  console.log('🔧 Starting user password reset...');

  try {
    // First, show all existing users
    const existingUsers = await query('SELECT id, email, name, role, "createdAt" FROM "User" ORDER BY "createdAt"');
    console.log(`\n📊 Found ${existingUsers.rows.length} existing users in database:`);
    existingUsers.rows.forEach(user => {
      console.log(`   • ${user.email} (${user.role}) - ${user.name || 'No name'}`);
    });

    const existingEmails = existingUsers.rows.map(row => row.email);

    for (const user of RESET_USERS) {
      console.log(`\n🔑 Processing user: ${user.email}`);

      // Hash the password
      const passwordHash = await bcrypt.hash(user.password, 10);

      if (existingEmails.includes(user.email)) {
        // Update existing user
        console.log(`   🔄 Updating existing user password and details...`);

        const result = await query(
          `UPDATE "User"
           SET password = $1, name = $2, role = $3, "updatedAt" = NOW()
           WHERE email = $4
           RETURNING id, email, name, role`,
          [passwordHash, user.name, user.role, user.email]
        );

        if (result.rows.length > 0) {
          console.log(`   ✅ Updated user: ${result.rows[0].email} (${result.rows[0].role})`);
        } else {
          console.log(`   ❌ Failed to update user: ${user.email}`);
        }
      } else {
        // Create new user
        console.log(`   ➕ Creating new user...`);

        const result = await query(
          `INSERT INTO "User" (id, email, name, password, role, "createdAt", "updatedAt")
           VALUES (gen_random_uuid(), $1, $2, $3, $4, NOW(), NOW())
           RETURNING id, email, name, role`,
          [user.email, user.name, passwordHash, user.role]
        );

        console.log(`   ✅ Created user: ${result.rows[0].email} (${result.rows[0].role})`);
      }
    }

    // Show final user list
    const finalUsers = await query('SELECT id, email, name, role, "createdAt", "updatedAt" FROM "User" ORDER BY "createdAt"');
    console.log('\n📋 Final users in database:');
    finalUsers.rows.forEach(user => {
      const isNew = RESET_USERS.find(u => u.email === user.email);
      const marker = isNew ? '🔑' : '👤';
      console.log(`   ${marker} ${user.email} (${user.role}) - ${user.name || 'No name'}`);
    });

    console.log('\n🎉 Password reset completed successfully!');
    console.log('\n📝 Updated login credentials:');
    RESET_USERS.forEach(user => {
      console.log(`   • ${user.email} / ${user.password}`);
    });

    console.log('\n⚠️  Use these credentials to login at mginvoices.com');

  } catch (error) {
    console.error('❌ Password reset failed:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  resetUserPasswords()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

export { resetUserPasswords };