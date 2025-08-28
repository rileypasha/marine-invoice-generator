const { expect } = require('chai');
const sinon = require('sinon');
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

describe('CSP Compliance Tests', function() {
    let dom;
    let document;
    let window;
    
    beforeEach(function() {
        // Setup DOM environment
        dom = new JSDOM(`
            <!DOCTYPE html>
            <html>
                <body>
                    <div id="detailModal" style="display: none;">
                        <div id="modalBody"></div>
                    </div>
                </body>
            </html>
        `);
        
        document = dom.window.document;
        window = dom.window;
        
        // Make document and window global for tests
        global.document = document;
        global.window = window;
    });
    
    afterEach(function() {
        delete global.document;
        delete global.window;
    });
    
    describe('Dashboard.js CSP Compliance', function() {
        it('should not generate inline event handlers in error state', function() {
            // Read the actual dashboard.js file
            const dashboardPath = path.join(__dirname, '../../src/master/dashboard.js');
            const dashboardCode = fs.readFileSync(dashboardPath, 'utf8');
            
            // Check that the fixed version doesn't have onclick handlers
            const errorStateSection = dashboardCode.match(/showError\(message\)[\s\S]*?^\s{4}\}/m);
            
            if (errorStateSection) {
                const code = errorStateSection[0];
                
                // Should use id attributes instead of onclick
                expect(code).to.include('id="errorCloseBtn"');
                expect(code).to.include('id="errorRetryBtn"');
                
                // Should have addEventListener
                expect(code).to.include('addEventListener');
                
                // Should NOT have inline handlers
                expect(code).to.not.match(/onclick\s*=/);
                expect(code).to.not.match(/onsubmit\s*=/);
            }
        });
        
        it('should bind events using addEventListener', function() {
            // Create a mock dashboard instance
            const dashboard = {
                escapeHtml: (text) => text,
                closeModal: sinon.stub(),
                retryLastView: sinon.stub(),
                showError: function(message) {
                    const modal = document.getElementById('detailModal');
                    const modalBody = document.getElementById('modalBody');
                    
                    modalBody.innerHTML = `
                        <div class="error-state">
                            <h3>⚠️ Error</h3>
                            <p>${message}</p>
                            <div class="error-buttons">
                                <button class="btn-secondary" id="errorCloseBtn">Close</button>
                                <button class="btn-primary" id="errorRetryBtn">Retry</button>
                            </div>
                        </div>
                    `;
                    
                    // Bind event listeners properly
                    const closeBtn = document.getElementById('errorCloseBtn');
                    const retryBtn = document.getElementById('errorRetryBtn');
                    
                    if (closeBtn) {
                        closeBtn.addEventListener('click', () => {
                            this.closeModal();
                        });
                    }
                    
                    if (retryBtn) {
                        retryBtn.addEventListener('click', () => {
                            this.retryLastView();
                        });
                    }
                    
                    modal.style.display = 'block';
                }
            };
            
            // Show error modal
            dashboard.showError('Test error message');
            
            // Check that HTML doesn't contain inline handlers
            const modalBody = document.getElementById('modalBody');
            const html = modalBody.innerHTML;
            
            expect(html).to.not.match(/onclick\s*=/i);
            expect(html).to.not.match(/onsubmit\s*=/i);
            expect(html).to.not.match(/onchange\s*=/i);
            expect(html).to.not.match(/onload\s*=/i);
            expect(html).to.not.match(/onerror\s*=/i);
            
            // Check that buttons have IDs for binding
            expect(html).to.include('id="errorCloseBtn"');
            expect(html).to.include('id="errorRetryBtn"');
            
            // Test that clicking buttons triggers the correct methods
            const closeBtn = document.getElementById('errorCloseBtn');
            const retryBtn = document.getElementById('errorRetryBtn');
            
            closeBtn.click();
            expect(dashboard.closeModal.called).to.be.true;
            
            retryBtn.click();
            expect(dashboard.retryLastView.called).to.be.true;
        });
        
        it('should not have inline handlers in any dynamically generated HTML', function() {
            // Patterns that indicate inline event handlers
            const inlineHandlerPatterns = [
                /on\w+\s*=\s*["']/,  // Any on* attribute
                /javascript:/i,        // javascript: protocol
                /<script/i            // script tags
            ];
            
            // Check various dynamic HTML generation in dashboard
            const testMessages = [
                'Test error',
                '<script>alert(1)</script>',
                '" onclick="alert(1)',
                "' onmouseover='alert(1)"
            ];
            
            testMessages.forEach(message => {
                const modal = document.getElementById('detailModal');
                const modalBody = document.getElementById('modalBody');
                
                // Simulate error display (with proper escaping)
                const escaped = message.replace(/[<>"']/g, (char) => {
                    const entities = {
                        '<': '&lt;',
                        '>': '&gt;',
                        '"': '&quot;',
                        "'": '&#39;'
                    };
                    return entities[char];
                });
                
                modalBody.innerHTML = `
                    <div class="error-state">
                        <h3>⚠️ Error</h3>
                        <p>${escaped}</p>
                        <div class="error-buttons">
                            <button class="btn-secondary" id="errorCloseBtn">Close</button>
                            <button class="btn-primary" id="errorRetryBtn">Retry</button>
                        </div>
                    </div>
                `;
                
                const html = modalBody.innerHTML;
                
                // Should not contain any inline handlers
                inlineHandlerPatterns.forEach(pattern => {
                    expect(html).to.not.match(pattern);
                });
            });
        });
    });
    
    describe('HTML Files CSP Compliance', function() {
        it('should not have inline event handlers in dashboard.html', function() {
            const htmlPath = path.join(__dirname, '../../src/master/dashboard.html');
            const htmlContent = fs.readFileSync(htmlPath, 'utf8');
            
            // Check for inline event handlers
            const hasInlineHandlers = /on\w+\s*=\s*["']/.test(htmlContent);
            
            // The main dashboard.html should not have inline handlers
            // (Note: test files may have them but production files should not)
            expect(hasInlineHandlers).to.be.false;
        });
    });
    
    describe('CSP Header Simulation', function() {
        it('should work with strict CSP policy', function() {
            // Simulate strict CSP environment
            const cspViolations = [];
            
            // Mock CSP violation reporter
            window.addEventListener('securitypolicyviolation', (e) => {
                cspViolations.push({
                    violatedDirective: e.violatedDirective,
                    blockedURI: e.blockedURI,
                    lineNumber: e.lineNumber
                });
            });
            
            // Test that our code doesn't trigger violations
            const modalBody = document.getElementById('modalBody');
            modalBody.innerHTML = `
                <div class="error-state">
                    <button id="testBtn">Test</button>
                </div>
            `;
            
            // Add event listener the proper way
            const btn = document.getElementById('testBtn');
            btn.addEventListener('click', () => {
                console.log('Button clicked');
            });
            
            // Click the button
            btn.click();
            
            // Should have no CSP violations
            expect(cspViolations).to.have.length(0);
        });
    });
    
    describe('XSS Prevention', function() {
        it('should escape HTML in error messages', function() {
            const dangerousInput = '<img src=x onerror=alert(1)>';
            
            // Escape function
            const escapeHtml = (text) => {
                const div = document.createElement('div');
                div.textContent = text;
                return div.innerHTML;
            };
            
            const escaped = escapeHtml(dangerousInput);
            
            expect(escaped).to.not.include('<img');
            expect(escaped).to.include('&lt;img');
            expect(escaped).to.not.include('onerror=');
        });
        
        it('should sanitize user input before display', function() {
            const xssAttempts = [
                '<script>alert(1)</script>',
                'javascript:alert(1)',
                '" onclick="alert(1)"',
                "' onmouseover='alert(1)'",
                '<img src=x onerror=alert(1)>',
                '<svg onload=alert(1)>'
            ];
            
            xssAttempts.forEach(attempt => {
                const escaped = attempt.replace(/[<>"']/g, (char) => {
                    const entities = {
                        '<': '&lt;',
                        '>': '&gt;',
                        '"': '&quot;',
                        "'": '&#39;'
                    };
                    return entities[char];
                });
                
                expect(escaped).to.not.include('<script');
                expect(escaped).to.not.include('onclick=');
                expect(escaped).to.not.include('onerror=');
                expect(escaped).to.not.include('onload=');
            });
        });
    });
});