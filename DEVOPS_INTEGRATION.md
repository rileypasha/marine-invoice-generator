# DevOps Integration Guide
## Marine Invoice Generator - Production CI/CD & Infrastructure

This document provides comprehensive guidance for the DevOps integration, including CI/CD pipeline, monitoring, deployment strategies, and operational procedures.

## 🏗️ Architecture Overview

### CI/CD Pipeline Structure
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Build Stage   │ -> │ Security Stage  │ -> │  Test Stages    │ -> │ Deploy Stage    │
│                 │    │                 │    │                 │    │                 │
│ • Compile       │    │ • SAST Scan     │    │ • Unit Tests    │    │ • Production    │
│ • Dependencies  │    │ • Audit         │    │ • Integration   │    │ • Blue/Green    │
│ • Artifacts     │    │ • Secret Scan   │    │ • E2E Tests     │    │ • Health Check  │
└─────────────────┘    └─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Quality Gates
- **🔒 Security Validation**: No vulnerabilities above moderate level
- **🧪 Test Coverage**: >90% unit test coverage, 100% E2E critical path coverage
- **⚡ Performance**: Response time <500ms, throughput >200 req/s
- **♿ Accessibility**: Lighthouse accessibility score >90
- **🔍 Code Quality**: ESLint compliance, no critical Sonar issues

## 🚀 Getting Started

### Prerequisites
```bash
# Required tools
- Docker & Docker Compose
- Node.js 18+
- PostgreSQL 15+
- Git

# Optional tools
- kubectl (for Kubernetes deployment)
- helm (for Kubernetes package management)
- terraform (for infrastructure as code)
```

### Local Development Setup
```bash
# 1. Clone repository
git clone <repository-url>
cd marine-invoice-generator

# 2. Install dependencies
npm install

# 3. Start development environment
npm run docker:dev

# 4. Run tests
npm run ci:test

# 5. Access application
# App: http://localhost:3000
# Grafana: http://localhost:3001 (admin/admin123)
# Prometheus: http://localhost:9090
```

## 📦 CI/CD Pipeline Configuration

### GitHub Workflows

#### 1. Comprehensive CI/CD Pipeline (`.github/workflows/comprehensive-ci-cd.yml`)
**Triggers**: Push to main/develop, pull requests
**Stages**:
- **Build**: Application compilation, dependency validation
- **Security**: SAST, dependency audit, secret scanning
- **Unit Tests**: Jest tests with coverage reporting
- **Integration Tests**: API and database integration testing
- **E2E Tests**: Cross-browser Playwright testing
- **Performance**: Load testing and Lighthouse audits
- **Quality Gates**: Comprehensive validation checkpoint
- **Container Build**: Docker image creation and scanning
- **Deployment**: Production deployment with health checks
- **Notifications**: Slack/email notifications

#### 2. Quality Validation Workflow (`.github/workflows/edit-workflow-quality.yml`)
**Specific Focus**: Invoice edit functionality quality assurance
**Key Features**:
- Duplicate detection validation
- Edit workflow integrity testing
- Performance validation under load
- Business logic verification

### NPM Scripts Integration
```json
{
  "ci:build": "Build application for CI environment",
  "ci:test": "Run comprehensive test suite",
  "ci:security": "Security audit and vulnerability scanning",
  "quality:check": "Combined quality validation",
  "e2e:ci": "E2E tests optimized for CI",
  "docker:prod": "Production container deployment",
  "monitor:start": "Start production monitoring",
  "performance:load": "Load testing execution",
  "security:scan": "Container and code security scanning"
}
```

## 🧪 Testing Strategy

### Test Pyramid Structure
```
                    ▲
                   /│\
                  / │ \
                 /  │  \
            E2E /   │   \ Manual
               /    │    \
              /     │     \
             /      │      \
            /   Integration \
           /        │        \
          /         │         \
         /          │          \
        /___________│___________\
               Unit Tests
```

### Test Categories

#### Unit Tests (`test/unit/`)
- **Coverage Target**: >90%
- **Focus**: Individual functions, business logic validation
- **Tools**: Jest, Supertest
- **Execution**: `npm run test:unit`

#### Integration Tests (`test/integration/`)
- **Coverage**: API endpoints, database operations
- **Environment**: Test database, mocked external services
- **Validation**: Data flow, service integration
- **Execution**: `npm run test:integration`

#### E2E Tests (`test/e2e/`)
- **Coverage**: Complete user workflows
- **Browsers**: Chromium, Firefox, Webkit (Safari)
- **Tools**: Playwright with video/trace capture
- **Execution**: `npm run test:e2e`

#### Performance Tests
- **Load Testing**: Autocannon for HTTP load simulation
- **Frontend Performance**: Lighthouse audits
- **Database Performance**: Query performance validation
- **Execution**: `npm run performance:load`

### Test Data Management
```bash
# Test data seeding
node scripts/seed-test-data.js

# Performance test data
node scripts/create-performance-test-data.js

# Clean test data
npm run db:reset
```

## 🐳 Containerization & Deployment

### Docker Configuration

#### Development (`docker-compose.yml`)
- **Services**: App, PostgreSQL, Redis, Monitoring stack
- **Features**: Hot reloading, debug capabilities, test databases
- **Usage**: `npm run docker:dev`

#### Production (`docker-compose.prod.yml`)
- **Services**: App cluster, Load balancer, Monitoring, Logging
- **Features**: Security hardening, resource limits, health checks
- **Usage**: `npm run docker:prod`

### Container Security
- **Base Images**: Official Alpine images for minimal attack surface
- **User Management**: Non-root user execution
- **Secret Management**: Environment variable injection
- **Health Checks**: Comprehensive health validation
- **Resource Limits**: CPU and memory constraints

### Production Deployment Strategies

#### Blue-Green Deployment
```bash
# 1. Deploy to staging environment
docker-compose -f docker-compose.staging.yml up -d

# 2. Run smoke tests
npm run test:smoke

# 3. Switch traffic to new version
# (Load balancer configuration update)

# 4. Monitor health and rollback if necessary
npm run monitor:health
```

#### Rolling Updates
```bash
# Kubernetes deployment
kubectl apply -f k8s/marine-invoice-deployment.yml
kubectl rollout status deployment/marine-invoice-app
```

## 📊 Monitoring & Observability

### Monitoring Stack Architecture
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Application   │ -> │   Prometheus    │ -> │    Grafana      │
│                 │    │                 │    │                 │
│ • Custom Metrics│    │ • Data Storage  │    │ • Dashboards    │
│ • Health Checks │    │ • Alert Rules   │    │ • Visualizations│
│ • Performance   │    │ • Recording     │    │ • Notifications │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                        │                        │
         v                        v                        v
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│      Logs       │    │   Alertmanager  │    │   ELK Stack     │
│                 │    │                 │    │                 │
│ • Structured    │    │ • Alert Routing │    │ • Log Analysis  │
│ • Correlation   │    │ • Grouping      │    │ • Search        │
│ • Aggregation   │    │ • Silencing     │    │ • Dashboards    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Key Metrics

#### Application Metrics
- **Invoice Operations**: Creation rate, edit success rate, duplicate detection
- **Performance**: Response times, throughput, error rates
- **Business Logic**: Invoice status distribution, user activity
- **System Health**: Memory usage, CPU utilization, database connections

#### Infrastructure Metrics
- **Container Health**: Resource usage, restart counts, health check status
- **Database Performance**: Connection pools, query performance, storage usage
- **Network**: Request rates, latency, error rates
- **Security**: Failed authentication attempts, unusual access patterns

### Alerting Configuration

#### Critical Alerts
- **High Error Rate**: >5% in 5 minutes
- **Database Downtime**: Connection failures
- **Memory/CPU**: >90% utilization for 5 minutes
- **Edit Workflow Failures**: Duplicate creation detection

#### Warning Alerts
- **Performance Degradation**: Response time >1s for 10 minutes
- **High Load**: >80% resource utilization
- **Security Events**: Multiple failed login attempts
- **Storage Space**: >85% disk usage

### Health Checks
```bash
# Application health
curl http://localhost:3000/health

# Comprehensive health check
npm run health:check

# Monitor edit quality
npm run monitor:start
```

## 🔒 Security Integration

### Security Scanning Pipeline

#### Static Analysis Security Testing (SAST)
- **Tools**: ESLint security rules, GitHub CodeQL
- **Coverage**: JavaScript vulnerabilities, coding standards
- **Execution**: Automated in CI pipeline

#### Dependency Scanning
- **Tools**: npm audit, Snyk
- **Coverage**: Known vulnerabilities in dependencies
- **Thresholds**: No high/critical vulnerabilities allowed

#### Container Security
- **Tools**: Trivy, Docker Scout
- **Coverage**: Base image vulnerabilities, misconfigurations
- **Validation**: Security best practices compliance

#### Dynamic Security Testing
- **Access Control**: Invoice data authorization validation
- **Input Validation**: SQL injection, XSS prevention
- **Session Management**: Secure session handling
- **Script**: `node scripts/security-check-invoice-access.js`

### Security Best Practices

#### Application Security
- **Authentication**: bcrypt password hashing, session management
- **Authorization**: Role-based access control, resource ownership validation
- **Input Validation**: Zod schema validation, sanitization
- **SQL Injection Prevention**: Prisma ORM parameterized queries

#### Infrastructure Security
- **Container Security**: Non-root users, minimal base images
- **Network Security**: Service isolation, encrypted communication
- **Secret Management**: Environment variables, no hardcoded secrets
- **HTTPS Enforcement**: TLS termination, secure headers

## 📈 Performance Optimization

### Performance Testing Strategy

#### Load Testing
```bash
# HTTP load testing
npm run performance:load

# API endpoint testing
autocannon -c 50 -d 30 http://localhost:3000/api/invoices

# Database performance
node scripts/test-db-performance.js
```

#### Frontend Performance
```bash
# Lighthouse audit
npm run performance:lighthouse

# Bundle analysis
npm run analyze:bundle

# Performance monitoring
npm run monitor:performance
```

### Performance Thresholds
- **Response Time**: <500ms for 95th percentile
- **Throughput**: >200 requests/second
- **Error Rate**: <1% under normal load
- **Lighthouse Performance Score**: >90

### Optimization Strategies

#### Backend Optimization
- **Database**: Query optimization, connection pooling, indexing
- **Caching**: Redis for session storage, response caching
- **Resource Management**: Connection limits, memory optimization
- **Code Optimization**: Async/await patterns, efficient algorithms

#### Frontend Optimization
- **Asset Optimization**: Image compression, CSS/JS minification
- **Code Splitting**: Lazy loading, chunk optimization
- **Caching**: Browser caching, CDN utilization
- **Performance Budgets**: Bundle size limits, metric thresholds

## 🔄 Deployment Procedures

### Pre-Deployment Checklist
- [ ] All tests passing (unit, integration, E2E)
- [ ] Security scans completed with no critical issues
- [ ] Performance tests within acceptable thresholds
- [ ] Database migrations tested and validated
- [ ] Monitoring and alerting configured
- [ ] Rollback procedure documented and tested

### Deployment Steps

#### 1. Pre-Deployment Validation
```bash
# Run comprehensive quality checks
npm run quality:check

# Validate container build
docker build -t marine-invoice-test .
docker run --rm marine-invoice-test npm test

# Database migration dry run
npm run db:migrate:dry-run
```

#### 2. Production Deployment
```bash
# Deploy to production
npm run deploy:production

# Health check validation
npm run monitor:health

# Smoke tests
npm run test:smoke:production
```

#### 3. Post-Deployment Monitoring
```bash
# Monitor application metrics
# Check Grafana dashboards
# Validate business metrics
# Monitor error rates and logs
```

### Rollback Procedures

#### Database Rollback
```bash
# Create backup before deployment
npm run backup:db

# Rollback to previous migration
npm run db:migrate:rollback

# Restore from backup if necessary
npm run restore:db backup-YYYYMMDD-HHMMSS.sql
```

#### Application Rollback
```bash
# Docker rollback
docker-compose -f docker-compose.prod.yml down
docker-compose -f docker-compose.prod.yml up -d --scale app=0
# Deploy previous version
# Scale up previous version

# Kubernetes rollback
kubectl rollout undo deployment/marine-invoice-app
kubectl rollout status deployment/marine-invoice-app
```

## 🚨 Incident Response

### Monitoring & Alerting
- **Real-time Monitoring**: Grafana dashboards for system health
- **Automated Alerts**: Slack/email notifications for critical issues
- **Log Aggregation**: ELK stack for centralized logging
- **Performance Tracking**: Continuous performance monitoring

### Incident Classification
- **P0 (Critical)**: System down, data loss, security breach
- **P1 (High)**: Major functionality impaired, high error rates
- **P2 (Medium)**: Partial functionality affected, performance degradation
- **P3 (Low)**: Minor issues, cosmetic problems

### Response Procedures
1. **Detection**: Automated monitoring alerts or user reports
2. **Assessment**: Determine severity and impact
3. **Communication**: Notify stakeholders and team members
4. **Resolution**: Implement fix or activate rollback procedures
5. **Post-Incident**: Document lessons learned and improve processes

## 📚 Additional Resources

### Documentation
- **API Documentation**: Generated from OpenAPI specifications
- **Database Schema**: Prisma schema documentation
- **Monitoring Runbooks**: Operational procedures and troubleshooting
- **Security Procedures**: Security incident response and compliance

### Training Materials
- **DevOps Onboarding**: Getting started with the CI/CD pipeline
- **Monitoring Guide**: Understanding metrics and dashboards
- **Incident Response**: Emergency procedures and escalation
- **Performance Optimization**: Best practices and tools

### Contact Information
- **DevOps Team**: devops@marinegroup.com
- **Security Team**: security@marinegroup.com
- **On-Call Rotation**: Defined in PagerDuty/OpsGenie
- **Emergency Escalation**: Critical incident contact procedures

---

## 🎯 Next Steps

1. **Review Configuration**: Validate all environment-specific configurations
2. **Test Deployment**: Execute deployment in staging environment
3. **Monitor Performance**: Establish baseline metrics and thresholds
4. **Security Review**: Conduct comprehensive security assessment
5. **Team Training**: Ensure all team members understand procedures
6. **Documentation Updates**: Keep documentation current with changes

For detailed technical implementation, refer to the individual configuration files and scripts in this repository.