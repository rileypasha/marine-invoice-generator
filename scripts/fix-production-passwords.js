#!/usr/bin/env node

/**
 * Security Fix: Clean up usernames that contain passwords in PRODUCTION
 * This script fixes existing data where passwords were accidentally stored as usernames
 * 
 * USAGE: DATABASE_URL=<production-url> node scripts/fix-production-passwords.js
 */

const { PrismaClient } = require('@prisma/client');

async function fixPasswordUsernames() {
  console.log('🔐 Starting PRODUCTION security fix for password-exposed usernames...\n');
  
  // Ensure we have a DATABASE_URL
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL environment variable is required');
    console.error('Usage: DATABASE_URL=<production-url> node scripts/fix-production-passwords.js');
    process.exit(1);
  }

  // Safety check - warn if connecting to production
  if (process.env.DATABASE_URL.includes('render.com')) {
    console.log('⚠️  WARNING: Connecting to PRODUCTION database on Render');
    console.log('   URL:', process.env.DATABASE_URL.replace(/:[^:@]+@/, ':****@'));
    console.log('');
  }

  const prisma = new PrismaClient();
  
  try {
    // Step 1: Find and fix users with suspicious names
    console.log('📋 Step 1: Finding users with suspicious names...');
    
    const allUsers = await prisma.user.findMany();
    const fixes = [];
    
    for (const user of allUsers) {
      if (!user.name) continue;
      
      const name = String(user.name);
      let newName = null;
      
      // Check if name contains "password"
      if (name.toLowerCase().includes('password')) {
        newName = user.email === 'test@marinegroupbw.com' ? 'Test User' : user.email.split('@')[0];
        console.log(`  ⚠️  User ${user.email}: name contains "password"`);
      }
      // Check if name looks like a password (numbers + special chars or long)
      else if (/\d/.test(name) && (name.length > 20 || /[!@#$%^&*()_+=\[\]{};':"\\|,.<>\/?]/.test(name))) {
        newName = user.email.split('@')[0];
        // Special case for known users
        if (user.email === 'rpasha@marinegroupbw.com') {
          newName = 'Riley Pasha';
        }
        console.log(`  ⚠️  User ${user.email}: name looks like password (${name.substring(0, 10)}...)`);
      }
      
      if (newName) {
        fixes.push({ user, newName });
      }
    }
    
    if (fixes.length === 0) {
      console.log('  ✅ No users with suspicious names found!');
      return;
    }
    
    console.log(`\n📝 Step 2: Fixing ${fixes.length} users...\n`);
    
    for (const { user, newName } of fixes) {
      console.log(`  Fixing user: ${user.email}`);
      console.log(`    Old name: ${user.name.substring(0, 20)}... (truncated for security)`);
      console.log(`    New name: ${newName}`);
      
      // Update user
      await prisma.user.update({
        where: { id: user.id },
        data: { name: newName }
      });
      
      // Update all invoices with this user's info
      const invoiceUpdateCount = await prisma.invoice.updateMany({
        where: { 
          OR: [
            { userId: user.id },
            { userEmail: user.email }
          ]
        },
        data: { userName: newName }
      });
      
      console.log(`    ✅ Fixed! Updated ${invoiceUpdateCount.count} invoices\n`);
    }
    
    // Step 3: Verify the fix
    console.log('📊 Step 3: Verifying the fix...\n');
    
    const verifyUsers = await prisma.user.findMany({
      select: { id: true, email: true, name: true }
    });
    
    console.log('Users after fix:');
    for (const user of verifyUsers) {
      const status = user.name && user.name.toLowerCase().includes('password') ? '❌' : '✅';
      console.log(`  ${status} ${user.email}: ${user.name}`);
    }
    
    // Check invoices
    const suspiciousInvoices = await prisma.invoice.count({
      where: {
        OR: [
          { userName: { contains: 'password' } },
          { userName: { contains: 'Password' } }
        ]
      }
    });
    
    console.log(`\nInvoices with 'password' in userName: ${suspiciousInvoices}`);
    
    if (suspiciousInvoices > 0) {
      console.log('⚠️  Some invoices still have suspicious usernames!');
      const examples = await prisma.invoice.findMany({
        where: {
          OR: [
            { userName: { contains: 'password' } },
            { userName: { contains: 'Password' } }
          ]
        },
        take: 5,
        select: { id: true, userName: true, userEmail: true }
      });
      
      for (const inv of examples) {
        console.log(`  Invoice ${inv.id}: userName="${inv.userName}" userEmail="${inv.userEmail}"`);
      }
    } else {
      console.log('✅ All invoices have been fixed!');
    }
    
    console.log('\n✅ Security fix complete!');
    
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
    console.log('🎉 Security fix completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  });