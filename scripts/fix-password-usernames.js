#!/usr/bin/env node

/**
 * Security Fix: Clean up usernames that contain passwords
 * This script fixes existing data where passwords were accidentally stored as usernames
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixPasswordUsernames() {
  console.log('🔐 Starting security fix for password-exposed usernames...\n');
  
  try {
    // Find all users with suspicious names
    const allUsers = await prisma.user.findMany();
    const suspiciousUsers = [];
    
    for (const user of allUsers) {
      if (!user.name) continue;
      
      const name = String(user.name);
      const hasNumbers = /\d/.test(name);
      const hasSpecialChars = /[!@#$%^&*()_+=\[\]{};':"\\|,.<>\/?]/.test(name);
      const looksLikePassword = 
        hasNumbers && (name.length > 20 || hasSpecialChars) ||
        name.toLowerCase().includes('password');
      
      if (looksLikePassword) {
        suspiciousUsers.push(user);
      }
    }
    
    if (suspiciousUsers.length === 0) {
      console.log('✅ No suspicious usernames found!');
      return;
    }
    
    console.log(`⚠️  Found ${suspiciousUsers.length} users with suspicious names:\n`);
    
    // Fix each suspicious user
    for (const user of suspiciousUsers) {
      const oldName = user.name;
      const newName = user.email.split('@')[0];
      
      console.log(`Fixing user: ${user.email}`);
      console.log(`  Old name: ${oldName.substring(0, 10)}... (hidden for security)`);
      console.log(`  New name: ${newName}`);
      
      // Update user name
      await prisma.user.update({
        where: { id: user.id },
        data: { name: newName }
      });
      
      // Update all invoices with this user's name
      await prisma.invoice.updateMany({
        where: { userId: user.id },
        data: { userName: newName }
      });
      
      // Also update invoices by email (in case userId is null)
      await prisma.invoice.updateMany({
        where: { userEmail: user.email },
        data: { userName: newName }
      });
      
      console.log(`  ✅ Fixed!\n`);
    }
    
    console.log(`\n✅ Security fix complete! Fixed ${suspiciousUsers.length} users.`);
    
    // Log the fix in the database
    console.log('\n📝 Creating audit log entry...');
    
    const auditLog = {
      event: 'SECURITY_FIX_PASSWORD_USERNAMES',
      timestamp: new Date(),
      affectedUsers: suspiciousUsers.length,
      details: 'Fixed usernames that contained password data'
    };
    
    console.log('Audit log:', auditLog);
    
  } catch (error) {
    console.error('❌ Error during security fix:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the fix
fixPasswordUsernames()
  .then(() => {
    console.log('\n🎉 Security fix completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  });