#!/usr/bin/env node

/**
 * Script to create a secure test user with proper password hashing
 * This replaces the insecure auto-creation and hardcoded backdoors
 */

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const prisma = new PrismaClient();

async function createSecureTestUser() {
  try {
    console.log('🔒 Creating secure test user...');

    const email = 'test@marinegroupbw.com';
    const password = 'password34220'; // The password you provided
    const name = 'Test User';

    // Hash the password properly
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      console.log('👤 User already exists, updating password...');

      // Update existing user with proper hashed password
      await prisma.user.update({
        where: { email },
        data: {
          password: hashedPassword,
          name: name
        }
      });

      console.log('✅ Test user password updated securely');
    } else {
      console.log('👤 Creating new test user...');

      // Create new user with proper hashed password
      await prisma.user.create({
        data: {
          email,
          password: hashedPassword,
          name,
          role: 'standard'
        }
      });

      console.log('✅ Test user created securely');
    }

    console.log(`
🎯 Test User Credentials:
   Email: ${email}
   Password: ${password}

⚠️  IMPORTANT: This is for testing only. In production:
   1. Use strong, unique passwords
   2. Never store passwords in plain text
   3. Use proper user management flows
`);

  } catch (error) {
    console.error('❌ Error creating test user:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
createSecureTestUser();