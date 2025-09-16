/**
 * Global Teardown for Playwright Tests in CI Environment
 *
 * Handles cleanup of test data, temporary files, and resource disposal
 * after comprehensive E2E testing in CI/CD pipeline.
 */

const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs').promises;
const path = require('path');
const execAsync = promisify(exec);

async function globalTeardown() {
  console.log('🧹 Starting global test teardown...');

  try {
    // Generate test execution summary
    console.log('📊 Generating test execution summary...');
    await generateTestSummary();

    // Clean up test database (if not production)
    if (process.env.NODE_ENV !== 'production') {
      console.log('🗄️ Cleaning up test database...');
      try {
        await execAsync('npx prisma db push --force-reset --accept-data-loss');
        console.log('✅ Test database cleaned');
      } catch (error) {
        console.warn('⚠️ Database cleanup failed:', error.message);
      }
    }

    // Clean up temporary test files (but preserve artifacts for CI)
    console.log('🗂️ Cleaning up temporary files...');
    const tempDirs = ['temp', 'cache'];
    for (const dir of tempDirs) {
      try {
        await fs.rmdir(dir, { recursive: true });
        console.log(`✅ Cleaned ${dir}/`);
      } catch (error) {
        // Directory might not exist, which is fine
      }
    }

    // Compress test artifacts for storage efficiency
    if (process.env.CI) {
      console.log('📦 Compressing test artifacts...');
      await compressTestArtifacts();
    }

    // Log resource usage summary
    await logResourceUsage();

    console.log('✅ Global teardown completed successfully');

  } catch (error) {
    console.error('❌ Global teardown failed:', error.message);
    // Don't exit with error in teardown to avoid masking test failures
  }
}

async function generateTestSummary() {
  try {
    const summary = {
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'test',
      appUrl: process.env.APP_URL,
      databaseUrl: process.env.DATABASE_URL ? 'configured' : 'missing',
      ci: !!process.env.CI,
      testResults: {
        // These would be populated by test results if available
        totalTests: 'N/A',
        passed: 'N/A',
        failed: 'N/A',
        skipped: 'N/A'
      }
    };

    await fs.writeFile(
      'test-results/execution-summary.json',
      JSON.stringify(summary, null, 2)
    );

    console.log('✅ Test execution summary generated');
  } catch (error) {
    console.warn('⚠️ Failed to generate test summary:', error.message);
  }
}

async function compressTestArtifacts() {
  try {
    // Compress large artifacts to save CI storage space
    const artifactDirs = ['playwright-report', 'test-results'];

    for (const dir of artifactDirs) {
      try {
        await execAsync(`tar -czf ${dir}.tar.gz ${dir}/`);
        console.log(`📦 Compressed ${dir}/`);
      } catch (error) {
        console.warn(`⚠️ Failed to compress ${dir}:`, error.message);
      }
    }
  } catch (error) {
    console.warn('⚠️ Artifact compression failed:', error.message);
  }
}

async function logResourceUsage() {
  try {
    if (process.platform !== 'win32') {
      const { stdout } = await execAsync('ps -o pid,pcpu,pmem,time,command -p $PPID');
      console.log('📊 Resource usage summary:');
      console.log(stdout);
    }
  } catch (error) {
    // Resource logging is best-effort
  }
}

module.exports = globalTeardown;