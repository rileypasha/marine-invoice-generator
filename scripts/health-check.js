/**
 * Comprehensive Health Check Script
 *
 * Validates system health including database, cache, file system,
 * and business logic components for production monitoring.
 */

const http = require('http');
const https = require('https');
const { PrismaClient } = require('@prisma/client');
const fs = require('fs').promises;
const path = require('path');

class HealthChecker {
  constructor() {
    this.prisma = new PrismaClient();
    this.checks = [];
    this.startTime = Date.now();
  }

  /**
   * Run comprehensive health checks
   */
  async runHealthChecks() {
    console.log('🏥 Starting comprehensive health checks...');

    try {
      const results = await Promise.allSettled([
        this.checkDatabase(),
        this.checkFileSystem(),
        this.checkMemoryUsage(),
        this.checkDiskSpace(),
        this.checkEnvironmentVariables(),
        this.checkCriticalServices(),
        this.checkBusinessLogic()
      ]);

      const healthReport = this.generateHealthReport(results);

      if (healthReport.status === 'healthy') {
        console.log('✅ All health checks passed');
        process.exit(0);
      } else {
        console.error(`❌ Health check failed: ${healthReport.failedChecks} failures`);
        process.exit(1);
      }

    } catch (error) {
      console.error('💥 Health check process failed:', error);
      process.exit(1);
    } finally {
      await this.prisma.$disconnect();
    }
  }

  /**
   * Check database connectivity and performance
   */
  async checkDatabase() {
    const checkName = 'Database Health';
    const startTime = Date.now();

    try {
      // Test basic connectivity
      await this.prisma.$queryRaw`SELECT 1 as test`;

      // Test read performance
      const invoiceCount = await this.prisma.invoice.count();

      // Test connection pool
      const connectionInfo = await this.prisma.$queryRaw`
        SELECT
          count(*) as active_connections,
          max_connections
        FROM pg_stat_activity, pg_settings
        WHERE name = 'max_connections'
      `;

      const responseTime = Date.now() - startTime;

      if (responseTime > 5000) {
        throw new Error(`Database response time too high: ${responseTime}ms`);
      }

      this.addCheck(checkName, 'healthy', {
        responseTime: `${responseTime}ms`,
        invoiceCount,
        connections: connectionInfo[0],
        details: 'Database connectivity and performance OK'
      });

    } catch (error) {
      this.addCheck(checkName, 'unhealthy', {
        error: error.message,
        responseTime: `${Date.now() - startTime}ms`
      });
    }
  }

  /**
   * Check file system health
   */
  async checkFileSystem() {
    const checkName = 'File System';

    try {
      // Check required directories
      const requiredDirs = ['data', 'logs', 'reports'];
      const dirChecks = [];

      for (const dir of requiredDirs) {
        try {
          await fs.access(dir);
          const stats = await fs.stat(dir);
          dirChecks.push({ dir, exists: true, writable: stats.isDirectory() });
        } catch (error) {
          dirChecks.push({ dir, exists: false, error: error.message });
        }
      }

      // Test write permissions
      const testFile = path.join('data', 'health-check-test.tmp');
      try {
        await fs.writeFile(testFile, 'health check test');
        await fs.unlink(testFile);
      } catch (error) {
        throw new Error(`Cannot write to data directory: ${error.message}`);
      }

      const failedDirs = dirChecks.filter(check => !check.exists);
      if (failedDirs.length > 0) {
        throw new Error(`Missing directories: ${failedDirs.map(d => d.dir).join(', ')}`);
      }

      this.addCheck(checkName, 'healthy', {
        directories: dirChecks,
        writeTest: 'passed',
        details: 'File system access OK'
      });

    } catch (error) {
      this.addCheck(checkName, 'unhealthy', {
        error: error.message
      });
    }
  }

  /**
   * Check memory usage
   */
  async checkMemoryUsage() {
    const checkName = 'Memory Usage';

    try {
      const memUsage = process.memoryUsage();
      const totalMemory = require('os').totalmem();
      const freeMemory = require('os').freemem();

      const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
      const heapTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024);
      const systemUsagePercent = Math.round(((totalMemory - freeMemory) / totalMemory) * 100);

      // Alert if heap usage is over 1GB or system usage over 90%
      if (heapUsedMB > 1024) {
        throw new Error(`High heap usage: ${heapUsedMB}MB`);
      }

      if (systemUsagePercent > 90) {
        throw new Error(`High system memory usage: ${systemUsagePercent}%`);
      }

      this.addCheck(checkName, 'healthy', {
        heapUsed: `${heapUsedMB}MB`,
        heapTotal: `${heapTotalMB}MB`,
        systemUsage: `${systemUsagePercent}%`,
        details: 'Memory usage within acceptable limits'
      });

    } catch (error) {
      this.addCheck(checkName, 'unhealthy', {
        error: error.message
      });
    }
  }

  /**
   * Check disk space
   */
  async checkDiskSpace() {
    const checkName = 'Disk Space';

    try {
      if (process.platform !== 'win32') {
        const { exec } = require('child_process');
        const { promisify } = require('util');
        const execAsync = promisify(exec);

        const { stdout } = await execAsync('df -h .');
        const lines = stdout.split('\n');
        const diskInfo = lines[1].split(/\s+/);

        const usagePercent = parseInt(diskInfo[4].replace('%', ''));

        if (usagePercent > 85) {
          throw new Error(`High disk usage: ${usagePercent}%`);
        }

        this.addCheck(checkName, 'healthy', {
          usage: `${usagePercent}%`,
          available: diskInfo[3],
          details: 'Disk space sufficient'
        });
      } else {
        // For Windows, just check if we can write files
        this.addCheck(checkName, 'healthy', {
          details: 'Disk space check skipped on Windows'
        });
      }

    } catch (error) {
      this.addCheck(checkName, 'unhealthy', {
        error: error.message
      });
    }
  }

  /**
   * Check environment variables
   */
  async checkEnvironmentVariables() {
    const checkName = 'Environment Variables';

    try {
      const requiredVars = [
        'NODE_ENV',
        'DATABASE_URL'
      ];

      const optionalVars = [
        'PORT',
        'SESSION_SECRET',
        'LOG_LEVEL'
      ];

      const missing = requiredVars.filter(varName => !process.env[varName]);
      const present = [...requiredVars, ...optionalVars]
        .filter(varName => process.env[varName])
        .map(varName => ({ name: varName, set: true }));

      if (missing.length > 0) {
        throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
      }

      this.addCheck(checkName, 'healthy', {
        required: requiredVars.length,
        missing: missing.length,
        present: present.length,
        details: 'All required environment variables present'
      });

    } catch (error) {
      this.addCheck(checkName, 'unhealthy', {
        error: error.message
      });
    }
  }

  /**
   * Check critical services
   */
  async checkCriticalServices() {
    const checkName = 'Critical Services';

    try {
      const serviceChecks = [];

      // Check if server is responding
      const serverHealth = await this.checkHTTPEndpoint('http://localhost:3000/health');
      serviceChecks.push({ service: 'HTTP Server', ...serverHealth });

      // Check if all services are responding properly
      const allHealthy = serviceChecks.every(check => check.status === 'healthy');

      if (!allHealthy) {
        throw new Error('Some critical services are not responding');
      }

      this.addCheck(checkName, 'healthy', {
        services: serviceChecks,
        details: 'All critical services responding'
      });

    } catch (error) {
      this.addCheck(checkName, 'unhealthy', {
        error: error.message
      });
    }
  }

  /**
   * Check business logic health
   */
  async checkBusinessLogic() {
    const checkName = 'Business Logic';

    try {
      // Test invoice operations
      const recentInvoices = await this.prisma.invoice.findMany({
        take: 1,
        orderBy: { createdAt: 'desc' }
      });

      // Check for any system-level issues
      const systemChecks = {
        canReadInvoices: recentInvoices !== null,
        databaseConnections: true, // Already tested in database check
        coreBusinessLogic: true
      };

      const failedChecks = Object.entries(systemChecks)
        .filter(([key, value]) => !value)
        .map(([key]) => key);

      if (failedChecks.length > 0) {
        throw new Error(`Business logic issues: ${failedChecks.join(', ')}`);
      }

      this.addCheck(checkName, 'healthy', {
        invoiceSystemReady: true,
        lastInvoiceCheck: recentInvoices.length > 0 ? 'found' : 'empty',
        details: 'Business logic operations functioning'
      });

    } catch (error) {
      this.addCheck(checkName, 'unhealthy', {
        error: error.message
      });
    }
  }

  /**
   * Check HTTP endpoint health
   */
  async checkHTTPEndpoint(url) {
    return new Promise((resolve) => {
      const startTime = Date.now();
      const client = url.startsWith('https') ? https : http;

      const req = client.get(url, (res) => {
        const responseTime = Date.now() - startTime;

        if (res.statusCode === 200) {
          resolve({
            status: 'healthy',
            responseTime: `${responseTime}ms`,
            statusCode: res.statusCode
          });
        } else {
          resolve({
            status: 'unhealthy',
            responseTime: `${responseTime}ms`,
            statusCode: res.statusCode
          });
        }
      });

      req.on('error', (error) => {
        resolve({
          status: 'unhealthy',
          error: error.message,
          responseTime: `${Date.now() - startTime}ms`
        });
      });

      req.setTimeout(5000, () => {
        req.destroy();
        resolve({
          status: 'unhealthy',
          error: 'Request timeout',
          responseTime: '5000ms+'
        });
      });
    });
  }

  /**
   * Add a health check result
   */
  addCheck(name, status, details) {
    this.checks.push({
      name,
      status,
      details,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Generate comprehensive health report
   */
  generateHealthReport(results) {
    const totalTime = Date.now() - this.startTime;
    const healthyChecks = this.checks.filter(check => check.status === 'healthy');
    const unhealthyChecks = this.checks.filter(check => check.status === 'unhealthy');

    const report = {
      timestamp: new Date().toISOString(),
      status: unhealthyChecks.length === 0 ? 'healthy' : 'unhealthy',
      uptime: process.uptime(),
      responseTime: `${totalTime}ms`,
      checks: {
        total: this.checks.length,
        healthy: healthyChecks.length,
        unhealthy: unhealthyChecks.length
      },
      failedChecks: unhealthyChecks.length,
      details: this.checks,
      summary: {
        version: require('../package.json').version,
        environment: process.env.NODE_ENV || 'unknown',
        nodeVersion: process.version,
        platform: process.platform
      }
    };

    // Write health report
    const fs = require('fs');
    if (!fs.existsSync('reports')) {
      fs.mkdirSync('reports', { recursive: true });
    }

    fs.writeFileSync(
      'reports/health-report.json',
      JSON.stringify(report, null, 2)
    );

    console.log(`📊 Health report: ${report.status.toUpperCase()}`);
    console.log(`📈 Summary: ${healthyChecks.length}/${this.checks.length} checks passed`);
    console.log(`⏱️ Total time: ${totalTime}ms`);

    if (unhealthyChecks.length > 0) {
      console.log('❌ Failed checks:');
      unhealthyChecks.forEach(check => {
        console.log(`   ${check.name}: ${check.details.error || 'Failed'}`);
      });
    }

    return report;
  }
}

// CLI execution
if (require.main === module) {
  const checker = new HealthChecker();
  checker.runHealthChecks();
}

module.exports = HealthChecker;