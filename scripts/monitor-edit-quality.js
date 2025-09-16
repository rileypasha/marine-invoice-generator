/**
 * Production Monitoring for Invoice Edit Quality
 *
 * Real-time monitoring to detect edit workflow issues in production.
 * Alerts when duplicate creation or other quality issues are detected.
 */

const { PrismaClient } = require('@prisma/client');
const pino = require('pino');

class EditQualityMonitor {
  constructor() {
    this.prisma = new PrismaClient();
    this.logger = pino({
      level: process.env.LOG_LEVEL || 'info',
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true
        }
      }
    });

    this.metrics = {
      duplicatesDetected: 0,
      editOperations: 0,
      createOperations: 0,
      editFailures: 0,
      performanceIssues: 0
    };

    this.thresholds = {
      duplicateRate: 0.01, // 1% threshold for duplicates
      editFailureRate: 0.05, // 5% threshold for edit failures
      maxEditTime: 5000, // 5 seconds max edit time
      checkInterval: 60000 // Check every minute
    };
  }

  /**
   * Detect duplicate invoices created within last hour
   */
  async detectDuplicateInvoices() {
    this.logger.info('🔍 Checking for duplicate invoices...');

    try {
      const duplicates = await this.prisma.$queryRaw`
        SELECT
          vessel_name,
          customer_name,
          user_email,
          COUNT(*) as count,
          array_agg(id) as invoice_ids,
          array_agg(created_at) as created_times
        FROM "Invoice"
        WHERE created_at > NOW() - INTERVAL '1 hour'
          AND vessel_name IS NOT NULL
          AND customer_name IS NOT NULL
        GROUP BY vessel_name, customer_name, user_email
        HAVING COUNT(*) > 1
        ORDER BY count DESC
      `;

      if (duplicates.length > 0) {
        this.metrics.duplicatesDetected += duplicates.length;

        this.logger.warn({
          event: 'DUPLICATES_DETECTED',
          count: duplicates.length,
          duplicates: duplicates.map(d => ({
            vessel: d.vessel_name,
            customer: d.customer_name,
            user: d.user_email,
            count: d.count,
            ids: d.invoice_ids
          }))
        });

        // Alert for each duplicate group
        for (const duplicate of duplicates) {
          await this.sendDuplicateAlert(duplicate);
        }
      }

      return duplicates;

    } catch (error) {
      this.logger.error('Error detecting duplicates:', error);
      throw error;
    }
  }

  /**
   * Monitor edit operation success rates
   */
  async monitorEditOperations() {
    this.logger.info('📊 Monitoring edit operation metrics...');

    try {
      // Get recent save operations from logs or database
      const recentOperations = await this.prisma.$queryRaw`
        SELECT
          COUNT(*) FILTER (WHERE created_at = updated_at) as creates,
          COUNT(*) FILTER (WHERE created_at != updated_at) as edits,
          AVG(EXTRACT(EPOCH FROM (updated_at - created_at))) as avg_edit_duration
        FROM "Invoice"
        WHERE updated_at > NOW() - INTERVAL '1 hour'
      `;

      if (recentOperations.length > 0) {
        const stats = recentOperations[0];
        this.metrics.createOperations += parseInt(stats.creates || 0);
        this.metrics.editOperations += parseInt(stats.edits || 0);

        const totalOps = this.metrics.createOperations + this.metrics.editOperations;
        const editRate = totalOps > 0 ? (this.metrics.editOperations / totalOps) : 0;

        this.logger.info({
          event: 'EDIT_METRICS',
          creates: stats.creates,
          edits: stats.edits,
          editRate: `${(editRate * 100).toFixed(1)}%`,
          avgEditDuration: `${stats.avg_edit_duration}s`
        });

        // Check for performance issues
        if (stats.avg_edit_duration > this.thresholds.maxEditTime / 1000) {
          this.metrics.performanceIssues++;
          await this.sendPerformanceAlert(stats.avg_edit_duration);
        }
      }

      return recentOperations[0];

    } catch (error) {
      this.logger.error('Error monitoring edit operations:', error);
      throw error;
    }
  }

  /**
   * Check for failed edit attempts
   */
  async detectEditFailures() {
    this.logger.info('🚨 Checking for edit failures...');

    try {
      // Look for error patterns in application logs
      // This would typically integrate with your logging system

      // For now, detect invoices that should have been updates but became duplicates
      const suspiciousCreates = await this.prisma.$queryRaw`
        SELECT
          i1.id,
          i1.vessel_name,
          i1.customer_name,
          i1.user_email,
          i1.created_at,
          i2.id as potential_original_id,
          i2.created_at as original_created_at
        FROM "Invoice" i1
        JOIN "Invoice" i2 ON (
          i1.vessel_name = i2.vessel_name
          AND i1.customer_name = i2.customer_name
          AND i1.user_email = i2.user_email
          AND i1.id != i2.id
          AND i1.created_at > i2.created_at
          AND i1.created_at > NOW() - INTERVAL '1 hour'
        )
        ORDER BY i1.created_at DESC
      `;

      if (suspiciousCreates.length > 0) {
        this.metrics.editFailures += suspiciousCreates.length;

        this.logger.error({
          event: 'SUSPECTED_EDIT_FAILURES',
          count: suspiciousCreates.length,
          failures: suspiciousCreates.map(f => ({
            newId: f.id,
            originalId: f.potential_original_id,
            vessel: f.vessel_name,
            user: f.user_email,
            timeDiff: `${Math.round((new Date(f.created_at) - new Date(f.original_created_at)) / 1000)}s`
          }))
        });

        // Alert on suspected edit failures
        for (const failure of suspiciousCreates) {
          await this.sendEditFailureAlert(failure);
        }
      }

      return suspiciousCreates;

    } catch (error) {
      this.logger.error('Error detecting edit failures:', error);
      throw error;
    }
  }

  /**
   * Generate quality health score
   */
  calculateQualityScore() {
    const totalOps = this.metrics.createOperations + this.metrics.editOperations;

    if (totalOps === 0) return 100; // No operations, perfect score

    const duplicateRate = this.metrics.duplicatesDetected / totalOps;
    const failureRate = this.metrics.editFailures / totalOps;

    // Quality score based on error rates
    let score = 100;
    score -= (duplicateRate * 100) * 50; // Heavily penalize duplicates
    score -= (failureRate * 100) * 30;   // Penalize failures
    score -= this.metrics.performanceIssues * 5; // Minor penalty for performance

    return Math.max(0, Math.round(score));
  }

  /**
   * Send alert for duplicate detection
   */
  async sendDuplicateAlert(duplicate) {
    const alert = {
      type: 'DUPLICATE_INVOICES',
      severity: 'HIGH',
      message: `Duplicate invoices detected for ${duplicate.vessel_name} - ${duplicate.customer_name}`,
      details: {
        vesselName: duplicate.vessel_name,
        customerName: duplicate.customer_name,
        userEmail: duplicate.user_email,
        duplicateCount: duplicate.count,
        invoiceIds: duplicate.invoice_ids
      },
      timestamp: new Date().toISOString(),
      actionRequired: 'Investigate edit workflow and merge duplicates'
    };

    // Log the alert
    this.logger.error(alert);

    // Send to alerting system (Slack, email, etc.)
    await this.sendAlert(alert);
  }

  /**
   * Send alert for performance issues
   */
  async sendPerformanceAlert(avgDuration) {
    const alert = {
      type: 'EDIT_PERFORMANCE',
      severity: 'MEDIUM',
      message: `Edit operations are taking too long: ${avgDuration}s average`,
      details: {
        averageDuration: avgDuration,
        threshold: this.thresholds.maxEditTime / 1000,
        impact: 'Poor user experience during invoice editing'
      },
      timestamp: new Date().toISOString(),
      actionRequired: 'Investigate database performance and optimization'
    };

    this.logger.warn(alert);
    await this.sendAlert(alert);
  }

  /**
   * Send alert for edit failures
   */
  async sendEditFailureAlert(failure) {
    const alert = {
      type: 'EDIT_FAILURE',
      severity: 'HIGH',
      message: `Suspected edit failure resulted in duplicate invoice`,
      details: {
        newInvoiceId: failure.id,
        suspectedOriginalId: failure.potential_original_id,
        vesselName: failure.vessel_name,
        userEmail: failure.user_email,
        timeBetween: Math.round((new Date(failure.created_at) - new Date(failure.original_created_at)) / 1000)
      },
      timestamp: new Date().toISOString(),
      actionRequired: 'Review edit workflow implementation and merge invoices'
    };

    this.logger.error(alert);
    await this.sendAlert(alert);
  }

  /**
   * Generic alert sender (implement with your alerting system)
   */
  async sendAlert(alert) {
    // Implement integration with your alerting system
    // Examples: Slack webhook, email, PagerDuty, etc.

    if (process.env.SLACK_WEBHOOK_URL) {
      await this.sendSlackAlert(alert);
    }

    if (process.env.EMAIL_ALERTS_ENABLED) {
      await this.sendEmailAlert(alert);
    }

    // Console output for development
    console.log('🚨 ALERT:', JSON.stringify(alert, null, 2));
  }

  /**
   * Send alert to Slack
   */
  async sendSlackAlert(alert) {
    try {
      const webhook = process.env.SLACK_WEBHOOK_URL;
      if (!webhook) return;

      const payload = {
        text: `🚨 Invoice Edit Quality Alert`,
        attachments: [{
          color: alert.severity === 'HIGH' ? 'danger' : 'warning',
          fields: [
            {
              title: 'Type',
              value: alert.type,
              short: true
            },
            {
              title: 'Severity',
              value: alert.severity,
              short: true
            },
            {
              title: 'Message',
              value: alert.message,
              short: false
            },
            {
              title: 'Action Required',
              value: alert.actionRequired,
              short: false
            }
          ],
          ts: Math.floor(Date.now() / 1000)
        }]
      };

      const response = await fetch(webhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        this.logger.error('Failed to send Slack alert:', response.statusText);
      }

    } catch (error) {
      this.logger.error('Error sending Slack alert:', error);
    }
  }

  /**
   * Generate daily quality report
   */
  async generateDailyReport() {
    try {
      const qualityScore = this.calculateQualityScore();

      const report = {
        date: new Date().toISOString().split('T')[0],
        qualityScore,
        metrics: { ...this.metrics },
        summary: {
          duplicatesDetected: this.metrics.duplicatesDetected,
          editOperations: this.metrics.editOperations,
          createOperations: this.metrics.createOperations,
          failureRate: this.metrics.editOperations > 0 ?
            (this.metrics.editFailures / this.metrics.editOperations) * 100 : 0
        },
        status: qualityScore >= 95 ? 'HEALTHY' :
                qualityScore >= 80 ? 'WARNING' : 'CRITICAL'
      };

      this.logger.info({
        event: 'DAILY_QUALITY_REPORT',
        report
      });

      // Save report
      const fs = require('fs');
      const path = require('path');

      const reportsDir = path.join(__dirname, '..', 'reports', 'quality');
      if (!fs.existsSync(reportsDir)) {
        fs.mkdirSync(reportsDir, { recursive: true });
      }

      const reportFile = path.join(reportsDir, `edit-quality-${report.date}.json`);
      fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));

      return report;

    } catch (error) {
      this.logger.error('Error generating daily report:', error);
      throw error;
    }
  }

  /**
   * Run monitoring cycle
   */
  async runMonitoringCycle() {
    try {
      this.logger.info('🔄 Starting monitoring cycle...');

      // Run all monitoring checks
      await this.detectDuplicateInvoices();
      await this.monitorEditOperations();
      await this.detectEditFailures();

      const qualityScore = this.calculateQualityScore();

      this.logger.info({
        event: 'MONITORING_CYCLE_COMPLETE',
        qualityScore,
        metrics: this.metrics
      });

      // Alert if quality score is too low
      if (qualityScore < 80) {
        await this.sendAlert({
          type: 'LOW_QUALITY_SCORE',
          severity: qualityScore < 50 ? 'HIGH' : 'MEDIUM',
          message: `Invoice edit quality score is low: ${qualityScore}%`,
          details: { qualityScore, metrics: this.metrics },
          timestamp: new Date().toISOString(),
          actionRequired: 'Review edit workflow implementation and fix issues'
        });
      }

    } catch (error) {
      this.logger.error('Error in monitoring cycle:', error);
    }
  }

  /**
   * Start continuous monitoring
   */
  async start() {
    this.logger.info('🚀 Starting edit quality monitor...');

    // Run initial check
    await this.runMonitoringCycle();

    // Set up continuous monitoring
    setInterval(async () => {
      await this.runMonitoringCycle();
    }, this.thresholds.checkInterval);

    // Daily report at midnight
    const scheduleDaily = () => {
      const now = new Date();
      const midnight = new Date();
      midnight.setHours(24, 0, 0, 0);

      const msUntilMidnight = midnight.getTime() - now.getTime();

      setTimeout(async () => {
        await this.generateDailyReport();
        // Schedule next day
        setInterval(async () => {
          await this.generateDailyReport();
        }, 24 * 60 * 60 * 1000);
      }, msUntilMidnight);
    };

    scheduleDaily();

    this.logger.info('✅ Edit quality monitor started');
  }

  /**
   * Cleanup resources
   */
  async stop() {
    await this.prisma.$disconnect();
    this.logger.info('🛑 Edit quality monitor stopped');
  }
}

// CLI execution
if (require.main === module) {
  const monitor = new EditQualityMonitor();

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down monitor...');
    await monitor.stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    await monitor.stop();
    process.exit(0);
  });

  // Start monitoring
  monitor.start().catch(console.error);
}

module.exports = EditQualityMonitor;