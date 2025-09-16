/**
 * Global Setup for Playwright Tests in CI Environment
 *
 * Handles database setup, test data seeding, and environment preparation
 * for comprehensive E2E testing in CI/CD pipeline.
 */

const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

async function globalSetup() {
  console.log('🔧 Starting global test setup...');

  try {
    // Environment validation
    const requiredEnvVars = ['DATABASE_URL', 'APP_URL'];
    for (const envVar of requiredEnvVars) {
      if (!process.env[envVar]) {
        throw new Error(`Missing required environment variable: ${envVar}`);
      }
    }

    console.log('✅ Environment variables validated');

    // Wait for database to be ready
    console.log('⏳ Waiting for database connection...');
    let dbReady = false;
    let attempts = 0;
    const maxAttempts = 30;

    while (!dbReady && attempts < maxAttempts) {
      try {
        await execAsync('npx prisma db push --force-reset --accept-data-loss');
        dbReady = true;
        console.log('✅ Database connection established');
      } catch (error) {
        attempts++;
        console.log(`⏳ Database not ready, attempt ${attempts}/${maxAttempts}`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    if (!dbReady) {
      throw new Error('❌ Database setup failed after maximum attempts');
    }

    // Generate Prisma client
    console.log('🔧 Generating Prisma client...');
    await execAsync('npx prisma generate');
    console.log('✅ Prisma client generated');

    // Run database migrations
    console.log('📦 Running database migrations...');
    await execAsync('npx prisma migrate deploy');
    console.log('✅ Database migrations completed');

    // Seed test data
    console.log('🌱 Seeding test data...');
    await execAsync('node scripts/seed-test-data.js');
    console.log('✅ Test data seeded');

    // Wait for application server
    console.log('⏳ Waiting for application server...');
    const appUrl = process.env.APP_URL;
    let serverReady = false;
    attempts = 0;

    while (!serverReady && attempts < maxAttempts) {
      try {
        const response = await fetch(`${appUrl}/health`);
        if (response.ok) {
          serverReady = true;
          console.log('✅ Application server is ready');
        } else {
          throw new Error('Health check failed');
        }
      } catch (error) {
        attempts++;
        console.log(`⏳ Server not ready, attempt ${attempts}/${maxAttempts}`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    if (!serverReady) {
      throw new Error('❌ Application server setup failed after maximum attempts');
    }

    // Create test session storage
    console.log('🗄️ Preparing test session storage...');
    await execAsync('mkdir -p test-results/sessions');
    console.log('✅ Test session storage ready');

    console.log('🚀 Global setup completed successfully');

  } catch (error) {
    console.error('❌ Global setup failed:', error.message);
    process.exit(1);
  }
}

module.exports = globalSetup;