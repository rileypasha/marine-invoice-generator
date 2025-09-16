/**
 * Invoice Access Control Security Validation
 *
 * Validates that invoice access controls are properly implemented
 * and prevent unauthorized access to sensitive invoice data.
 */

const fs = require('fs');
const path = require('path');

class InvoiceSecurityChecker {
  constructor() {
    this.findings = [];
    this.criticalIssues = 0;
    this.warningIssues = 0;
  }

  /**
   * Run comprehensive security checks
   */
  async runSecurityChecks() {
    console.log('🔍 Starting invoice access control security validation...');

    try {
      await this.checkServerRoutesSecurity();
      await this.checkAuthenticationImplementation();
      await this.checkSessionManagement();
      await this.checkDataValidation();
      await this.checkSQLInjectionProtection();
      await this.checkFileAccessSecurity();
      await this.checkEnvironmentVariables();

      this.generateSecurityReport();

      if (this.criticalIssues > 0) {
        console.error(`❌ ${this.criticalIssues} critical security issues found`);
        process.exit(1);
      } else if (this.warningIssues > 0) {
        console.warn(`⚠️ ${this.warningIssues} security warnings found`);
      } else {
        console.log('✅ No critical security issues detected');
      }

    } catch (error) {
      console.error('❌ Security check failed:', error);
      process.exit(1);
    }
  }

  /**
   * Check server routes for proper authorization
   */
  async checkServerRoutesSecurity() {
    console.log('🔒 Checking server route security...');

    const routePaths = [
      'server/routes',
      'server/api',
      'server'
    ].filter(p => fs.existsSync(p));

    for (const routePath of routePaths) {
      const files = this.getAllJSFiles(routePath);

      for (const file of files) {
        const content = fs.readFileSync(file, 'utf8');

        // Check for routes without authentication
        if (this.hasRouteHandlers(content) && !this.hasAuthenticationCheck(content)) {
          this.addFinding('CRITICAL', 'Missing authentication check', file,
            'Route handlers found without authentication middleware');
        }

        // Check for direct database access without validation
        if (this.hasDirectDatabaseAccess(content) && !this.hasUserValidation(content)) {
          this.addFinding('CRITICAL', 'Unvalidated database access', file,
            'Direct database access without user authorization validation');
        }

        // Check for SQL injection vulnerabilities
        if (this.hasPotentialSQLInjection(content)) {
          this.addFinding('CRITICAL', 'Potential SQL injection', file,
            'Raw SQL queries without parameterization detected');
        }

        // Check for sensitive data exposure
        if (this.hasPasswordOrTokenExposure(content)) {
          this.addFinding('WARNING', 'Potential sensitive data exposure', file,
            'Password or token data may be exposed in responses');
        }
      }
    }
  }

  /**
   * Check authentication implementation
   */
  async checkAuthenticationImplementation() {
    console.log('🔐 Checking authentication implementation...');

    const authFiles = this.findAuthenticationFiles();

    for (const file of authFiles) {
      const content = fs.readFileSync(file, 'utf8');

      // Check for weak password requirements
      if (this.hasWeakPasswordValidation(content)) {
        this.addFinding('WARNING', 'Weak password validation', file,
          'Password validation may be insufficient for security requirements');
      }

      // Check for session fixation vulnerabilities
      if (this.hasSessionFixationVulnerability(content)) {
        this.addFinding('CRITICAL', 'Session fixation vulnerability', file,
          'Session ID not regenerated after authentication');
      }

      // Check for timing attack vulnerabilities
      if (this.hasTimingAttackVulnerability(content)) {
        this.addFinding('WARNING', 'Potential timing attack', file,
          'Authentication comparison may be vulnerable to timing attacks');
      }
    }
  }

  /**
   * Check session management security
   */
  async checkSessionManagement() {
    console.log('🍪 Checking session management...');

    const configFiles = ['server/server.js', 'server/config.js', 'app.js'];

    for (const file of configFiles) {
      if (fs.existsSync(file)) {
        const content = fs.readFileSync(file, 'utf8');

        // Check for secure session configuration
        if (this.hasInsecureSessionConfig(content)) {
          this.addFinding('WARNING', 'Insecure session configuration', file,
            'Session configuration may not be secure for production');
        }

        // Check for HTTPS enforcement
        if (!this.hasHTTPSEnforcement(content) && process.env.NODE_ENV === 'production') {
          this.addFinding('CRITICAL', 'Missing HTTPS enforcement', file,
            'HTTPS not enforced in production environment');
        }
      }
    }
  }

  /**
   * Check data validation implementation
   */
  async checkDataValidation() {
    console.log('🛡️ Checking data validation...');

    const serverFiles = this.getAllJSFiles('server');

    for (const file of serverFiles) {
      const content = fs.readFileSync(file, 'utf8');

      // Check for missing input validation
      if (this.hasRequestHandlers(content) && !this.hasInputValidation(content)) {
        this.addFinding('WARNING', 'Missing input validation', file,
          'Request handlers without input validation detected');
      }

      // Check for XSS vulnerabilities
      if (this.hasXSSVulnerability(content)) {
        this.addFinding('CRITICAL', 'Potential XSS vulnerability', file,
          'Unescaped user input may be rendered in responses');
      }
    }
  }

  /**
   * Check SQL injection protection
   */
  async checkSQLInjectionProtection() {
    console.log('💉 Checking SQL injection protection...');

    const serverFiles = this.getAllJSFiles('server');

    for (const file of serverFiles) {
      const content = fs.readFileSync(file, 'utf8');

      // Check for Prisma usage (good)
      const usesPrisma = content.includes('@prisma/client') || content.includes('prisma.');

      // Check for raw SQL without parameters
      if (this.hasRawSQLWithoutParams(content) && !usesPrisma) {
        this.addFinding('CRITICAL', 'SQL injection risk', file,
          'Raw SQL queries without parameterization detected');
      }
    }
  }

  /**
   * Check file access security
   */
  async checkFileAccessSecurity() {
    console.log('📁 Checking file access security...');

    const serverFiles = this.getAllJSFiles('server');

    for (const file of serverFiles) {
      const content = fs.readFileSync(file, 'utf8');

      // Check for path traversal vulnerabilities
      if (this.hasPathTraversalVulnerability(content)) {
        this.addFinding('CRITICAL', 'Path traversal vulnerability', file,
          'User input used in file paths without proper validation');
      }

      // Check for unrestricted file access
      if (this.hasUnrestrictedFileAccess(content)) {
        this.addFinding('WARNING', 'Unrestricted file access', file,
          'File access without proper authorization checks');
      }
    }
  }

  /**
   * Check environment variable security
   */
  async checkEnvironmentVariables() {
    console.log('🌍 Checking environment variable security...');

    const envExample = fs.existsSync('.env.example') ? fs.readFileSync('.env.example', 'utf8') : '';
    const gitignore = fs.existsSync('.gitignore') ? fs.readFileSync('.gitignore', 'utf8') : '';

    // Check if .env is in .gitignore
    if (!gitignore.includes('.env')) {
      this.addFinding('CRITICAL', 'Environment file not ignored', '.gitignore',
        '.env file not included in .gitignore - secrets may be committed');
    }

    // Check for hardcoded secrets in code
    const allFiles = [
      ...this.getAllJSFiles('server'),
      ...this.getAllJSFiles('src'),
      ...this.getAllJSFiles('scripts')
    ];

    for (const file of allFiles) {
      const content = fs.readFileSync(file, 'utf8');

      if (this.hasHardcodedSecrets(content)) {
        this.addFinding('CRITICAL', 'Hardcoded secrets detected', file,
          'Hardcoded passwords, tokens, or API keys found in source code');
      }
    }
  }

  // Helper methods for security checks

  getAllJSFiles(dir) {
    if (!fs.existsSync(dir)) return [];

    const files = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        files.push(...this.getAllJSFiles(fullPath));
      } else if (entry.name.endsWith('.js')) {
        files.push(fullPath);
      }
    }

    return files;
  }

  hasRouteHandlers(content) {
    return /\.(get|post|put|delete|patch)\s*\(/.test(content) ||
           /router\.(get|post|put|delete|patch)/.test(content);
  }

  hasAuthenticationCheck(content) {
    return /authenticate|requireAuth|isAuthenticated|verifyToken/.test(content) ||
           /req\.user|req\.session/.test(content);
  }

  hasDirectDatabaseAccess(content) {
    return /prisma\.|db\.|query|findMany|create|update|delete/.test(content);
  }

  hasUserValidation(content) {
    return /req\.user\.id|userId|userEmail|checkPermission|authorize/.test(content);
  }

  hasPotentialSQLInjection(content) {
    return /\$\{.*\}.*query|query.*\+.*req\.|SELECT.*\+/.test(content);
  }

  hasPasswordOrTokenExposure(content) {
    return /password.*res\.json|token.*res\.send|secret.*response/.test(content);
  }

  findAuthenticationFiles() {
    const authFiles = [];
    const possiblePaths = [
      'server/auth.js',
      'server/middleware/auth.js',
      'server/routes/auth.js',
      'server/controllers/auth.js'
    ];

    for (const filePath of possiblePaths) {
      if (fs.existsSync(filePath)) {
        authFiles.push(filePath);
      }
    }

    return authFiles;
  }

  hasWeakPasswordValidation(content) {
    const hasMinLength = /password.*length.*[8-9]|minLength.*[8-9]/.test(content);
    const hasComplexity = /uppercase|lowercase|number|special/.test(content);
    return !hasMinLength || !hasComplexity;
  }

  hasSessionFixationVulnerability(content) {
    return /session.*regenerate|req\.session\.regenerate/.test(content) === false &&
           /login|signin|authenticate/.test(content);
  }

  hasTimingAttackVulnerability(content) {
    return /===.*password|password.*===/.test(content) &&
           !/bcrypt|crypto\.timingSafeEqual/.test(content);
  }

  hasInsecureSessionConfig(content) {
    return /secure:\s*false|httpOnly:\s*false|sameSite:\s*false/.test(content) ||
           /secret.*=.*['"`][^'"`]{1,10}['"`]/.test(content);
  }

  hasHTTPSEnforcement(content) {
    return /app\.use.*helmet|require.*https|secure.*true/.test(content);
  }

  hasRequestHandlers(content) {
    return /req\.body|req\.params|req\.query/.test(content);
  }

  hasInputValidation(content) {
    return /validate|sanitize|zod|joi|yup|express-validator/.test(content);
  }

  hasXSSVulnerability(content) {
    return /res\.send.*req\.|innerHTML.*=.*req\./.test(content) &&
           !/escape|sanitize|xss/.test(content);
  }

  hasRawSQLWithoutParams(content) {
    return /query\s*\(.*\$\{|SELECT.*\+.*req\.|UPDATE.*\+.*req\./.test(content);
  }

  hasPathTraversalVulnerability(content) {
    return /path.*req\.|filename.*req\.|\.\.\//.test(content) &&
           !/path\.resolve|path\.normalize/.test(content);
  }

  hasUnrestrictedFileAccess(content) {
    return /fs\.read|fs\.write|fs\.unlink/.test(content) &&
           !/checkPermission|authorize|isOwner/.test(content);
  }

  hasHardcodedSecrets(content) {
    const secretPatterns = [
      /password\s*[:=]\s*['"`][^'"`]+['"`]/i,
      /api_key\s*[:=]\s*['"`][^'"`]+['"`]/i,
      /secret\s*[:=]\s*['"`][^'"`]+['"`]/i,
      /token\s*[:=]\s*['"`][^'"`]+['"`]/i
    ];

    return secretPatterns.some(pattern => pattern.test(content));
  }

  addFinding(severity, type, file, description) {
    this.findings.push({ severity, type, file, description });

    if (severity === 'CRITICAL') {
      this.criticalIssues++;
    } else if (severity === 'WARNING') {
      this.warningIssues++;
    }
  }

  generateSecurityReport() {
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        totalFindings: this.findings.length,
        criticalIssues: this.criticalIssues,
        warningIssues: this.warningIssues
      },
      findings: this.findings
    };

    // Ensure reports directory exists
    if (!fs.existsSync('reports')) {
      fs.mkdirSync('reports', { recursive: true });
    }

    fs.writeFileSync(
      'reports/security-report.json',
      JSON.stringify(report, null, 2)
    );

    console.log(`📊 Security report generated: reports/security-report.json`);
    console.log(`📈 Summary: ${this.criticalIssues} critical, ${this.warningIssues} warnings`);
  }
}

// CLI execution
if (require.main === module) {
  const checker = new InvoiceSecurityChecker();
  checker.runSecurityChecks();
}

module.exports = InvoiceSecurityChecker;