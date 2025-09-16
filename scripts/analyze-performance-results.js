/**
 * Performance Results Analyzer
 *
 * Analyzes load test results, Lighthouse audits, and application metrics
 * to provide actionable performance insights and recommendations.
 */

const fs = require('fs');
const path = require('path');

class PerformanceAnalyzer {
  constructor() {
    this.results = {
      loadTest: null,
      apiLoadTest: null,
      lighthouse: null,
      analysis: {},
      recommendations: [],
      score: 0
    };

    this.thresholds = {
      responseTime: {
        excellent: 200,
        good: 500,
        acceptable: 1000,
        poor: 2000
      },
      throughput: {
        excellent: 1000,
        good: 500,
        acceptable: 200,
        poor: 100
      },
      errorRate: {
        excellent: 0.001,
        good: 0.01,
        acceptable: 0.05,
        poor: 0.1
      },
      lighthouse: {
        performance: 90,
        accessibility: 90,
        bestPractices: 90,
        seo: 80
      }
    };
  }

  /**
   * Analyze all performance test results
   */
  async analyzePerformanceResults() {
    console.log('📊 Starting performance analysis...');

    try {
      // Load test results
      await this.loadTestResults();

      // Analyze each component
      this.analyzeLoadTestResults();
      this.analyzeAPILoadTestResults();
      this.analyzeLighthouseResults();

      // Generate overall assessment
      this.generateOverallAssessment();

      // Create recommendations
      this.generateRecommendations();

      // Calculate performance score
      this.calculatePerformanceScore();

      // Generate report
      this.generatePerformanceReport();

      console.log(`✅ Performance analysis completed - Score: ${this.results.score}/100`);

    } catch (error) {
      console.error('❌ Performance analysis failed:', error);
      throw error;
    }
  }

  /**
   * Load all test result files
   */
  async loadTestResults() {
    console.log('📁 Loading test result files...');

    try {
      // Load test results
      if (fs.existsSync('load-test-results.json')) {
        this.results.loadTest = JSON.parse(fs.readFileSync('load-test-results.json', 'utf8'));
        console.log('✅ Load test results loaded');
      } else {
        console.warn('⚠️ Load test results not found');
      }

      // API load test results
      if (fs.existsSync('api-load-test.json')) {
        this.results.apiLoadTest = JSON.parse(fs.readFileSync('api-load-test.json', 'utf8'));
        console.log('✅ API load test results loaded');
      } else {
        console.warn('⚠️ API load test results not found');
      }

      // Lighthouse results
      if (fs.existsSync('lighthouse-report.json')) {
        this.results.lighthouse = JSON.parse(fs.readFileSync('lighthouse-report.json', 'utf8'));
        console.log('✅ Lighthouse results loaded');
      } else {
        console.warn('⚠️ Lighthouse results not found');
      }

    } catch (error) {
      console.error('❌ Failed to load test results:', error);
      throw error;
    }
  }

  /**
   * Analyze load test results
   */
  analyzeLoadTestResults() {
    if (!this.results.loadTest) return;

    console.log('🔍 Analyzing load test results...');

    const loadTest = this.results.loadTest;

    this.results.analysis.loadTest = {
      summary: {
        totalRequests: loadTest.requests?.total || 0,
        duration: loadTest.duration || 0,
        throughput: loadTest.throughput?.mean || 0,
        latency: {
          mean: loadTest.latency?.mean || 0,
          p50: loadTest.latency?.p50 || 0,
          p95: loadTest.latency?.p95 || 0,
          p99: loadTest.latency?.p99 || 0,
          max: loadTest.latency?.max || 0
        },
        errors: loadTest.errors || 0,
        timeouts: loadTest.timeouts || 0
      }
    };

    // Analyze response times
    const meanLatency = this.results.analysis.loadTest.summary.latency.mean;
    if (meanLatency <= this.thresholds.responseTime.excellent) {
      this.results.analysis.loadTest.responseTimeRating = 'excellent';
    } else if (meanLatency <= this.thresholds.responseTime.good) {
      this.results.analysis.loadTest.responseTimeRating = 'good';
    } else if (meanLatency <= this.thresholds.responseTime.acceptable) {
      this.results.analysis.loadTest.responseTimeRating = 'acceptable';
    } else {
      this.results.analysis.loadTest.responseTimeRating = 'poor';
    }

    // Analyze throughput
    const throughput = this.results.analysis.loadTest.summary.throughput;
    if (throughput >= this.thresholds.throughput.excellent) {
      this.results.analysis.loadTest.throughputRating = 'excellent';
    } else if (throughput >= this.thresholds.throughput.good) {
      this.results.analysis.loadTest.throughputRating = 'good';
    } else if (throughput >= this.thresholds.throughput.acceptable) {
      this.results.analysis.loadTest.throughputRating = 'acceptable';
    } else {
      this.results.analysis.loadTest.throughputRating = 'poor';
    }

    // Analyze error rate
    const totalRequests = this.results.analysis.loadTest.summary.totalRequests;
    const errorRate = totalRequests > 0 ? this.results.analysis.loadTest.summary.errors / totalRequests : 0;
    this.results.analysis.loadTest.errorRate = errorRate;

    if (errorRate <= this.thresholds.errorRate.excellent) {
      this.results.analysis.loadTest.errorRating = 'excellent';
    } else if (errorRate <= this.thresholds.errorRate.good) {
      this.results.analysis.loadTest.errorRating = 'good';
    } else if (errorRate <= this.thresholds.errorRate.acceptable) {
      this.results.analysis.loadTest.errorRating = 'acceptable';
    } else {
      this.results.analysis.loadTest.errorRating = 'poor';
    }

    console.log(`   📈 Response Time: ${this.results.analysis.loadTest.responseTimeRating} (${meanLatency}ms)`);
    console.log(`   🚀 Throughput: ${this.results.analysis.loadTest.throughputRating} (${throughput} req/s)`);
    console.log(`   ❌ Error Rate: ${this.results.analysis.loadTest.errorRating} (${(errorRate * 100).toFixed(2)}%)`);
  }

  /**
   * Analyze API load test results
   */
  analyzeAPILoadTestResults() {
    if (!this.results.apiLoadTest) return;

    console.log('🔍 Analyzing API load test results...');

    const apiTest = this.results.apiLoadTest;

    this.results.analysis.apiLoadTest = {
      summary: {
        totalRequests: apiTest.requests?.total || 0,
        duration: apiTest.duration || 0,
        throughput: apiTest.throughput?.mean || 0,
        latency: {
          mean: apiTest.latency?.mean || 0,
          p95: apiTest.latency?.p95 || 0,
          p99: apiTest.latency?.p99 || 0
        },
        errors: apiTest.errors || 0
      }
    };

    const apiMeanLatency = this.results.analysis.apiLoadTest.summary.latency.mean;
    const apiThroughput = this.results.analysis.apiLoadTest.summary.throughput;

    console.log(`   🔌 API Response Time: ${apiMeanLatency}ms`);
    console.log(`   🔌 API Throughput: ${apiThroughput} req/s`);
  }

  /**
   * Analyze Lighthouse results
   */
  analyzeLighthouseResults() {
    if (!this.results.lighthouse) return;

    console.log('🔍 Analyzing Lighthouse results...');

    const lighthouse = this.results.lighthouse;

    this.results.analysis.lighthouse = {
      scores: {
        performance: lighthouse.categories?.performance?.score * 100 || 0,
        accessibility: lighthouse.categories?.accessibility?.score * 100 || 0,
        bestPractices: lighthouse.categories?.['best-practices']?.score * 100 || 0,
        seo: lighthouse.categories?.seo?.score * 100 || 0
      },
      metrics: {
        firstContentfulPaint: lighthouse.audits?.['first-contentful-paint']?.numericValue || 0,
        largestContentfulPaint: lighthouse.audits?.['largest-contentful-paint']?.numericValue || 0,
        cumulativeLayoutShift: lighthouse.audits?.['cumulative-layout-shift']?.numericValue || 0,
        speedIndex: lighthouse.audits?.['speed-index']?.numericValue || 0,
        timeToInteractive: lighthouse.audits?.['interactive']?.numericValue || 0
      }
    };

    const scores = this.results.analysis.lighthouse.scores;

    console.log(`   💡 Performance: ${scores.performance}/100`);
    console.log(`   ♿ Accessibility: ${scores.accessibility}/100`);
    console.log(`   ✅ Best Practices: ${scores.bestPractices}/100`);
    console.log(`   🔍 SEO: ${scores.seo}/100`);
  }

  /**
   * Generate overall assessment
   */
  generateOverallAssessment() {
    console.log('📋 Generating overall assessment...');

    this.results.analysis.overall = {
      strengths: [],
      weaknesses: [],
      criticalIssues: [],
      summary: ''
    };

    // Assess load test performance
    if (this.results.analysis.loadTest) {
      const loadTest = this.results.analysis.loadTest;

      if (loadTest.responseTimeRating === 'excellent' || loadTest.responseTimeRating === 'good') {
        this.results.analysis.overall.strengths.push('Fast response times under load');
      } else if (loadTest.responseTimeRating === 'poor') {
        this.results.analysis.overall.criticalIssues.push('Slow response times under load');
      }

      if (loadTest.throughputRating === 'excellent' || loadTest.throughputRating === 'good') {
        this.results.analysis.overall.strengths.push('High throughput capacity');
      } else if (loadTest.throughputRating === 'poor') {
        this.results.analysis.overall.weaknesses.push('Low throughput capacity');
      }

      if (loadTest.errorRating === 'poor') {
        this.results.analysis.overall.criticalIssues.push('High error rate under load');
      } else if (loadTest.errorRating === 'excellent') {
        this.results.analysis.overall.strengths.push('Excellent error handling');
      }
    }

    // Assess Lighthouse performance
    if (this.results.analysis.lighthouse) {
      const scores = this.results.analysis.lighthouse.scores;

      if (scores.performance >= this.thresholds.lighthouse.performance) {
        this.results.analysis.overall.strengths.push('Excellent frontend performance');
      } else if (scores.performance < 70) {
        this.results.analysis.overall.criticalIssues.push('Poor frontend performance');
      }

      if (scores.accessibility >= this.thresholds.lighthouse.accessibility) {
        this.results.analysis.overall.strengths.push('Good accessibility compliance');
      } else {
        this.results.analysis.overall.weaknesses.push('Accessibility improvements needed');
      }
    }

    // Generate summary
    const strengthCount = this.results.analysis.overall.strengths.length;
    const weaknessCount = this.results.analysis.overall.weaknesses.length;
    const criticalCount = this.results.analysis.overall.criticalIssues.length;

    if (criticalCount > 0) {
      this.results.analysis.overall.summary = `Critical performance issues detected (${criticalCount}). Immediate attention required.`;
    } else if (weaknessCount > strengthCount) {
      this.results.analysis.overall.summary = 'Performance has room for improvement. Several optimization opportunities identified.';
    } else {
      this.results.analysis.overall.summary = 'Good overall performance with solid foundation for scaling.';
    }
  }

  /**
   * Generate performance recommendations
   */
  generateRecommendations() {
    console.log('💡 Generating performance recommendations...');

    // Load test recommendations
    if (this.results.analysis.loadTest) {
      const loadTest = this.results.analysis.loadTest;

      if (loadTest.responseTimeRating === 'poor') {
        this.results.recommendations.push({
          priority: 'high',
          category: 'backend',
          title: 'Optimize Response Times',
          description: 'Response times are too high under load',
          actions: [
            'Implement database query optimization',
            'Add response caching where appropriate',
            'Consider connection pooling optimization',
            'Profile slow API endpoints'
          ]
        });
      }

      if (loadTest.throughputRating === 'poor') {
        this.results.recommendations.push({
          priority: 'high',
          category: 'infrastructure',
          title: 'Improve Throughput Capacity',
          description: 'System cannot handle required load',
          actions: [
            'Scale horizontally with load balancing',
            'Optimize database connections',
            'Implement request queuing',
            'Consider CDN for static assets'
          ]
        });
      }

      if (loadTest.errorRating === 'poor') {
        this.results.recommendations.push({
          priority: 'critical',
          category: 'reliability',
          title: 'Fix Error Handling',
          description: 'High error rate indicates stability issues',
          actions: [
            'Implement proper error handling',
            'Add circuit breaker patterns',
            'Improve input validation',
            'Implement retry mechanisms'
          ]
        });
      }
    }

    // Lighthouse recommendations
    if (this.results.analysis.lighthouse) {
      const lighthouse = this.results.analysis.lighthouse;

      if (lighthouse.scores.performance < 70) {
        this.results.recommendations.push({
          priority: 'high',
          category: 'frontend',
          title: 'Optimize Frontend Performance',
          description: 'Lighthouse performance score is below acceptable threshold',
          actions: [
            'Optimize images and assets',
            'Implement code splitting',
            'Minimize JavaScript bundles',
            'Optimize CSS delivery'
          ]
        });
      }

      if (lighthouse.metrics.largestContentfulPaint > 4000) {
        this.results.recommendations.push({
          priority: 'medium',
          category: 'frontend',
          title: 'Improve Largest Contentful Paint',
          description: 'LCP is slower than recommended',
          actions: [
            'Optimize critical path resources',
            'Implement resource preloading',
            'Optimize server response times',
            'Consider image optimization'
          ]
        });
      }
    }

    // General recommendations
    this.results.recommendations.push({
      priority: 'medium',
      category: 'monitoring',
      title: 'Implement Performance Monitoring',
      description: 'Continuous monitoring for performance regressions',
      actions: [
        'Set up APM monitoring',
        'Implement performance budgets',
        'Add synthetic monitoring',
        'Create performance dashboards'
      ]
    });

    console.log(`   💡 Generated ${this.results.recommendations.length} recommendations`);
  }

  /**
   * Calculate overall performance score
   */
  calculatePerformanceScore() {
    console.log('🧮 Calculating performance score...');

    let score = 100;
    const weights = {
      loadTest: 0.4,
      lighthouse: 0.4,
      criticalIssues: 0.2
    };

    // Load test scoring
    if (this.results.analysis.loadTest) {
      const loadTest = this.results.analysis.loadTest;
      let loadTestScore = 100;

      // Response time impact
      switch (loadTest.responseTimeRating) {
        case 'excellent': loadTestScore *= 1.0; break;
        case 'good': loadTestScore *= 0.9; break;
        case 'acceptable': loadTestScore *= 0.7; break;
        case 'poor': loadTestScore *= 0.4; break;
      }

      // Throughput impact
      switch (loadTest.throughputRating) {
        case 'excellent': loadTestScore *= 1.0; break;
        case 'good': loadTestScore *= 0.9; break;
        case 'acceptable': loadTestScore *= 0.8; break;
        case 'poor': loadTestScore *= 0.5; break;
      }

      // Error rate impact
      switch (loadTest.errorRating) {
        case 'excellent': loadTestScore *= 1.0; break;
        case 'good': loadTestScore *= 0.9; break;
        case 'acceptable': loadTestScore *= 0.7; break;
        case 'poor': loadTestScore *= 0.3; break;
      }

      score = score * (1 - weights.loadTest) + (loadTestScore * weights.loadTest);
    }

    // Lighthouse scoring
    if (this.results.analysis.lighthouse) {
      const lighthouseAvg = Object.values(this.results.analysis.lighthouse.scores)
        .reduce((sum, score) => sum + score, 0) / 4;

      score = score * (1 - weights.lighthouse) + (lighthouseAvg * weights.lighthouse);
    }

    // Critical issues penalty
    const criticalCount = this.results.analysis.overall?.criticalIssues?.length || 0;
    const criticalPenalty = Math.min(criticalCount * 20, 60); // Max 60 point penalty

    score = Math.max(0, score - criticalPenalty);

    this.results.score = Math.round(score);

    console.log(`   📊 Performance Score: ${this.results.score}/100`);
  }

  /**
   * Generate comprehensive performance report
   */
  generatePerformanceReport() {
    console.log('📄 Generating performance report...');

    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        overallScore: this.results.score,
        status: this.results.score >= 80 ? 'good' : this.results.score >= 60 ? 'acceptable' : 'poor',
        criticalIssues: this.results.analysis.overall?.criticalIssues?.length || 0,
        recommendations: this.results.recommendations.length
      },
      analysis: this.results.analysis,
      recommendations: this.results.recommendations,
      rawResults: {
        loadTest: this.results.loadTest ? 'available' : 'missing',
        apiLoadTest: this.results.apiLoadTest ? 'available' : 'missing',
        lighthouse: this.results.lighthouse ? 'available' : 'missing'
      }
    };

    // Ensure reports directory exists
    if (!fs.existsSync('reports')) {
      fs.mkdirSync('reports', { recursive: true });
    }

    // Write comprehensive report
    fs.writeFileSync(
      'performance-analysis.json',
      JSON.stringify(report, null, 2)
    );

    // Write summary report
    const summaryReport = {
      timestamp: report.timestamp,
      score: report.summary.overallScore,
      status: report.summary.status,
      criticalIssues: report.summary.criticalIssues,
      topRecommendations: this.results.recommendations
        .filter(r => r.priority === 'critical' || r.priority === 'high')
        .slice(0, 3)
    };

    fs.writeFileSync(
      'reports/performance-summary.json',
      JSON.stringify(summaryReport, null, 2)
    );

    console.log('✅ Performance reports generated:');
    console.log('   📄 performance-analysis.json');
    console.log('   📋 reports/performance-summary.json');
  }
}

// CLI execution
if (require.main === module) {
  const analyzer = new PerformanceAnalyzer();
  analyzer.analyzePerformanceResults()
    .then(() => {
      console.log('🎉 Performance analysis completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Performance analysis failed:', error);
      process.exit(1);
    });
}

module.exports = PerformanceAnalyzer;