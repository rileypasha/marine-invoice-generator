#!/bin/bash

##############################################################################
# Phase 4: Customers Navigation Test Execution Script
#
# This script runs comprehensive automated tests to verify the Customers page
# navigation functionality implemented in Phases 1-3.
#
# Usage:
#   ./run-phase4-tests.sh [options]
#
# Options:
#   --quick         Run quick health check only
#   --comprehensive Run full comprehensive test suite
#   --production    Run production environment tests only
#   --local         Run against local development server
#   --help          Show this help message
##############################################################################

set -e  # Exit on any error

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$SCRIPT_DIR"
TEST_RESULTS_DIR="$PROJECT_ROOT/test-results/phase4"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_header() {
    echo -e "${BLUE}"
    echo "################################################################"
    echo "# Phase 4: Customers Navigation Automated Testing"
    echo "# Target: https://mginvoices.com"
    echo "# Credentials: test-user@mginvoices.com"
    echo "# Timestamp: $TIMESTAMP"
    echo "################################################################"
    echo -e "${NC}"
}

show_help() {
    echo "Phase 4 Test Execution Script"
    echo ""
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  --quick         Quick health check (30 seconds)"
    echo "  --comprehensive Full test suite with all validations"
    echo "  --production    Production environment tests only"
    echo "  --local         Test against localhost:3000"
    echo "  --help          Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 --quick                    # Fast verification"
    echo "  $0 --comprehensive            # Complete test suite"
    echo "  $0 --production               # Production environment only"
    echo ""
}

setup_environment() {
    log_info "Setting up test environment..."

    # Create test results directory
    mkdir -p "$TEST_RESULTS_DIR"
    mkdir -p "$TEST_RESULTS_DIR/screenshots"
    mkdir -p "$TEST_RESULTS_DIR/har-files"
    mkdir -p "$TEST_RESULTS_DIR/videos"

    # Verify Playwright is installed
    if ! command -v npx &> /dev/null; then
        log_error "npx not found. Please install Node.js and npm."
        exit 1
    fi

    # Check if Playwright is installed
    if ! npx playwright --version &> /dev/null; then
        log_warning "Playwright not found. Installing..."
        npm install @playwright/test
        npx playwright install chromium firefox
    fi

    log_success "Environment setup complete"
}

run_quick_health_check() {
    log_info "Running quick health check..."

    # Use the test runner's health check
    cd "$PROJECT_ROOT"

    if node test/e2e/phase4-test-runner.js --health; then
        log_success "Quick health check passed!"
        return 0
    else
        log_error "Quick health check failed!"
        return 1
    fi
}

run_comprehensive_tests() {
    log_info "Running comprehensive test suite..."

    cd "$PROJECT_ROOT"

    # Set environment variables
    export PHASE4_BASE_URL="https://mginvoices.com"
    export PHASE4_INCLUDE_MOBILE="false"
    export PHASE4_GLOBAL_SETUP="false"

    # Run tests using custom configuration
    log_info "Executing comprehensive navigation tests..."

    if npx playwright test \
        --config=playwright.phase4.config.js \
        --reporter=html,json,junit \
        --output-dir="$TEST_RESULTS_DIR/artifacts" \
        test/e2e/phase4-customers-navigation-comprehensive.spec.js; then

        log_success "Comprehensive tests completed successfully!"
    else
        log_error "Comprehensive tests failed!"
        return 1
    fi
}

run_production_tests() {
    log_info "Running production environment tests..."

    cd "$PROJECT_ROOT"

    # Set production-specific environment
    export PHASE4_BASE_URL="https://mginvoices.com"
    export PHASE4_PRODUCTION_MODE="true"

    # Run production-specific tests
    if npx playwright test \
        --config=playwright.phase4.config.js \
        --reporter=html,json \
        --output-dir="$TEST_RESULTS_DIR/production-artifacts" \
        test/e2e/phase4-production-navigation.spec.js; then

        log_success "Production tests completed successfully!"
    else
        log_error "Production tests failed!"
        return 1
    fi
}

run_local_tests() {
    log_info "Running tests against local development server..."

    # Check if local server is running
    if ! curl -f http://localhost:3000/health &> /dev/null; then
        log_warning "Local server not responding at localhost:3000"
        log_info "Please ensure the development server is running:"
        log_info "  npm run server:dev"
        return 1
    fi

    cd "$PROJECT_ROOT"

    # Set local environment
    export PHASE4_BASE_URL="http://localhost:3000"

    # Run tests against local server
    if npx playwright test \
        --config=playwright.phase4.config.js \
        --reporter=html \
        --output-dir="$TEST_RESULTS_DIR/local-artifacts" \
        test/e2e/phase4-customers-navigation-comprehensive.spec.js; then

        log_success "Local tests completed successfully!"
    else
        log_error "Local tests failed!"
        return 1
    fi
}

generate_summary_report() {
    log_info "Generating summary report..."

    local report_file="$TEST_RESULTS_DIR/phase4-summary-$TIMESTAMP.md"

    cat > "$report_file" << EOF
# Phase 4 Test Execution Summary

**Execution Date:** $(date)
**Execution ID:** $TIMESTAMP
**Target Environment:** ${PHASE4_BASE_URL:-"https://mginvoices.com"}

## Test Results

### Files Generated
- HTML Report: \`test-results/phase4-playwright-report/index.html\`
- JSON Results: \`test-results/phase4-results.json\`
- JUnit XML: \`test-results/phase4-junit.xml\`
- HAR Files: \`test-results/phase4/har-files/\`
- Screenshots: \`test-results/phase4/screenshots/\`

### Key Validation Points
- ✅ Incognito browser setup with force refresh
- ✅ Authentication flow with saved credentials
- ✅ App loading and sidebar detection
- ✅ Customers navigation click handling
- ✅ URL navigation or SPA route activation
- ✅ DOM verification and content validation
- ✅ Console error monitoring
- ✅ Performance metrics collection

### Next Steps
1. Review HTML report for detailed results
2. Analyze HAR files for network performance
3. Check screenshots for any visual issues
4. Validate console logs for JavaScript errors
5. Verify performance metrics meet requirements

### Troubleshooting
If tests fail, check:
1. Network connectivity to mginvoices.com
2. Test credentials are still valid
3. Application deployment status
4. Browser compatibility issues

---
*Generated by Phase 4 Test Runner at $(date)*
EOF

    log_success "Summary report generated: $report_file"
}

open_results() {
    local html_report="$TEST_RESULTS_DIR/phase4-playwright-report/index.html"

    if [[ -f "$html_report" ]]; then
        log_info "Opening test results..."

        # Try to open the HTML report
        if command -v open &> /dev/null; then
            open "$html_report"  # macOS
        elif command -v xdg-open &> /dev/null; then
            xdg-open "$html_report"  # Linux
        elif command -v start &> /dev/null; then
            start "$html_report"  # Windows
        else
            log_info "Please open the following file in your browser:"
            log_info "file://$html_report"
        fi
    else
        log_warning "HTML report not found at: $html_report"
    fi
}

# Main execution logic
main() {
    print_header

    case "${1:-}" in
        --help)
            show_help
            exit 0
            ;;
        --quick)
            setup_environment
            if run_quick_health_check; then
                log_success "Phase 4 quick check completed successfully!"
                exit 0
            else
                log_error "Phase 4 quick check failed!"
                exit 1
            fi
            ;;
        --comprehensive)
            setup_environment
            if run_comprehensive_tests; then
                generate_summary_report
                open_results
                log_success "Phase 4 comprehensive testing completed successfully!"
                exit 0
            else
                log_error "Phase 4 comprehensive testing failed!"
                exit 1
            fi
            ;;
        --production)
            setup_environment
            if run_production_tests; then
                generate_summary_report
                open_results
                log_success "Phase 4 production testing completed successfully!"
                exit 0
            else
                log_error "Phase 4 production testing failed!"
                exit 1
            fi
            ;;
        --local)
            setup_environment
            if run_local_tests; then
                generate_summary_report
                open_results
                log_success "Phase 4 local testing completed successfully!"
                exit 0
            else
                log_error "Phase 4 local testing failed!"
                exit 1
            fi
            ;;
        "")
            log_info "No option specified. Running comprehensive tests by default."
            setup_environment
            if run_comprehensive_tests; then
                generate_summary_report
                open_results
                log_success "Phase 4 testing completed successfully!"
                exit 0
            else
                log_error "Phase 4 testing failed!"
                exit 1
            fi
            ;;
        *)
            log_error "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
}

# Execute main function with all arguments
main "$@"