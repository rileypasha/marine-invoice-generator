import bcrypt from 'bcrypt';
import { query } from '../server/config/database';

async function resetSinglePassword() {
  const email = process.argv[2];
  const newPassword = process.argv[3];

  if (!email || !newPassword) {
    console.error('❌ Usage: ts-node scripts/reset-single-password.ts <email> <new-password>');
    console.error('\nExample: ts-node scripts/reset-single-password.ts rpasha@marinegroupbw.com "MySecurePassword123!"');
    process.exit(1);
  }

  console.log(`🔧 Resetting password for: ${email}`);
  console.log(`🔑 New password: ${newPassword}`);

  try {
    // Hash the password
    const passwordHash = await bcrypt.hash(newPassword, 10);

    // Update the user
    const result = await query(
      `UPDATE "User"
       SET password = $1, "updatedAt" = NOW()
       WHERE email = $2
       RETURNING id, email, name, role`,
      [passwordHash, email]
    );

    if (result.rows.length > 0) {
      console.log(`✅ Successfully updated password for: ${result.rows[0].email}`);
      console.log(`\n📝 Login credentials:`);
      console.log(`   Email: ${email}`);
      console.log(`   Password: ${newPassword}`);
    } else {
      console.log(`❌ User not found: ${email}`);
    }
  } catch (error) {
    console.error('❌ Password reset failed:', error);
    throw error;
  }
}

resetSinglePassword()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
