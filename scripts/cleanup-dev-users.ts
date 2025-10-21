import { query } from '../server/config/database';
import { logger } from '../server/utils/logger';

/**
 * DEVELOPMENT DATABASE CLEANUP SCRIPT
 *
 * This script removes all users from the development database except the test user.
 *
 * Safety checks:
 * 1. Only runs if NODE_ENV === 'development'
 * 2. Only runs if DATABASE_URL contains 'development'
 * 3. Keeps the test user: test@marinegroupbw.com
 *
 * Usage: npx ts-node scripts/cleanup-dev-users.ts
 */

const TEST_USER_EMAIL = 'test@marinegroupbw.com';

async function cleanupDevUsers() {
  // Safety check 1: Verify we're in development mode
  if (process.env.NODE_ENV !== 'development') {
    console.error('❌ ERROR: This script can only run in development mode!');
    console.error('   Current NODE_ENV:', process.env.NODE_ENV);
    process.exit(1);
  }

  // Safety check 2: Verify we're connected to development database
  const dbUrl = process.env.DATABASE_URL || '';
  if (!dbUrl.includes('development')) {
    console.error('❌ ERROR: This script can only run against development database!');
    console.error('   Current DATABASE_URL does not contain "development"');
    process.exit(1);
  }

  console.log('🔧 Development Database User Cleanup Script');
  console.log('='.repeat(50));
  console.log('Database:', dbUrl.split('@')[1]?.split('?')[0] || 'unknown');
  console.log('Test user to keep:', TEST_USER_EMAIL);
  console.log('='.repeat(50));
  console.log('');

  try {
    // Step 1: Count all users
    const countResult = await query('SELECT COUNT(*) as total FROM "User"', []);
    const totalUsers = parseInt(countResult.rows[0].total);
    console.log(`📊 Total users in database: ${totalUsers}`);

    // Step 2: Get list of users to delete
    const usersToDelete = await query(
      'SELECT id, email, name FROM "User" WHERE email != $1',
      [TEST_USER_EMAIL]
    );

    if (usersToDelete.rows.length === 0) {
      console.log('✅ No users to delete. Only test user exists.');
      return;
    }

    console.log(`\n⚠️  Found ${usersToDelete.rows.length} user(s) to delete:`);
    usersToDelete.rows.forEach((user, index) => {
      console.log(`   ${index + 1}. ${user.name} (${user.email})`);
    });

    // Step 3: Delete users
    console.log('\n🗑️  Deleting users...');
    const deleteResult = await query(
      'DELETE FROM "User" WHERE email != $1',
      [TEST_USER_EMAIL]
    );

    console.log(`✅ Successfully deleted ${deleteResult.rowCount} user(s)`);

    // Step 4: Verify only test user remains
    const remainingUsers = await query('SELECT id, email, name FROM "User"', []);
    console.log(`\n📋 Remaining users in database: ${remainingUsers.rows.length}`);
    remainingUsers.rows.forEach((user, index) => {
      console.log(`   ${index + 1}. ${user.name} (${user.email})`);
    });

    if (remainingUsers.rows.length === 1 && remainingUsers.rows[0].email === TEST_USER_EMAIL) {
      console.log('\n✅ Success! Only the test user remains in the development database.');
      console.log('   All email notifications will now only go to:', TEST_USER_EMAIL);
    } else {
      console.log('\n⚠️  Warning: Multiple users still exist in database.');
    }

  } catch (error: any) {
    console.error('\n❌ Error during cleanup:', error.message);
    logger.error('Development user cleanup failed', { error: error.message });
    process.exit(1);
  }
}

// Run the cleanup
cleanupDevUsers()
  .then(() => {
    console.log('\n✅ Cleanup complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Fatal error:', error.message);
    process.exit(1);
  });
