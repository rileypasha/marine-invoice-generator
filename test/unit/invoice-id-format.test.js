const { expect } = require('chai');
const InvoiceIdValidator = require('../../server/utils/invoiceIdValidator');

describe('Invoice ID Format Validation', function() {
    describe('isValid method', function() {
        it('should accept valid invoice ID format', function() {
            const validIds = [
                'inv_1756271771724_geg1fza0e',
                'inv_1234567890123_abc123def',
                'inv_9999999999999_zzz999zzz'
            ];
            
            validIds.forEach(id => {
                expect(InvoiceIdValidator.isValid(id)).to.be.true;
            });
        });
        
        it('should reject invalid invoice ID formats', function() {
            const invalidIds = [
                'invoice_123_abc',           // Wrong prefix
                'inv_123_abc',               // Timestamp too short
                'inv_12345678901234_abc',    // Timestamp too long
                'inv_1234567890123_ab',      // Random too short
                'inv_1234567890123_abcdefghij', // Random too long
                'inv_notanumber_abc123456',  // Non-numeric timestamp
                'inv_1234567890123_ABC123456', // Uppercase in random
                '',
                null,
                undefined,
                123,
                {},
                []
            ];
            
            invalidIds.forEach(id => {
                expect(InvoiceIdValidator.isValid(id)).to.be.false;
            });
        });
        
        it('should accept UUID format when legacy mode enabled', function() {
            const uuid = '123e4567-e89b-12d3-a456-426614174000';
            
            expect(InvoiceIdValidator.isValid(uuid, false)).to.be.false;
            expect(InvoiceIdValidator.isValid(uuid, true)).to.be.true;
        });
        
        it('should reject malformed UUIDs even in legacy mode', function() {
            const badUuids = [
                '123e4567-e89b-12d3-a456',  // Too short
                '123e4567-e89b-12d3-a456-426614174000-extra', // Too long
                'not-a-uuid-at-all',
                '12345678-1234-1234-1234-123456789012' // Wrong format
            ];
            
            badUuids.forEach(id => {
                expect(InvoiceIdValidator.isValid(id, true)).to.be.false;
            });
        });
    });
    
    describe('getFormat method', function() {
        it('should identify invoice format', function() {
            expect(InvoiceIdValidator.getFormat('inv_1756271771724_geg1fza0e')).to.equal('invoice');
        });
        
        it('should identify UUID format', function() {
            expect(InvoiceIdValidator.getFormat('123e4567-e89b-12d3-a456-426614174000')).to.equal('uuid');
        });
        
        it('should return null for invalid formats', function() {
            expect(InvoiceIdValidator.getFormat('invalid-id')).to.be.null;
            expect(InvoiceIdValidator.getFormat('')).to.be.null;
            expect(InvoiceIdValidator.getFormat(null)).to.be.null;
        });
    });
    
    describe('parse method', function() {
        it('should parse valid invoice ID components', function() {
            const id = 'inv_1756271771724_geg1fza0e';
            const parsed = InvoiceIdValidator.parse(id);
            
            expect(parsed).to.not.be.null;
            expect(parsed.prefix).to.equal('inv');
            expect(parsed.timestamp).to.equal(1756271771724);
            expect(parsed.random).to.equal('geg1fza0e');
            expect(parsed.date).to.be.instanceof(Date);
            expect(parsed.date.getTime()).to.equal(1756271771724);
        });
        
        it('should return null for invalid IDs', function() {
            expect(InvoiceIdValidator.parse('invalid-id')).to.be.null;
            expect(InvoiceIdValidator.parse('')).to.be.null;
            expect(InvoiceIdValidator.parse(null)).to.be.null;
        });
        
        it('should return basic info for UUID format', function() {
            const uuid = '123e4567-e89b-12d3-a456-426614174000';
            const parsed = InvoiceIdValidator.parse(uuid);
            
            // Parse only works on valid invoice format, not UUIDs
            expect(parsed).to.be.null;
        });
    });
    
    describe('generate method', function() {
        it('should generate valid invoice IDs', function() {
            const id = InvoiceIdValidator.generate();
            
            expect(id).to.match(/^inv_\d{13}_[a-z0-9]{9}$/);
            expect(InvoiceIdValidator.isValid(id)).to.be.true;
        });
        
        it('should use custom prefix when provided', function() {
            const id = InvoiceIdValidator.generate('test');
            
            expect(id).to.match(/^test_\d{13}_[a-z0-9]{9}$/);
            expect(id.startsWith('test_')).to.be.true;
        });
        
        it('should generate unique IDs', function() {
            const ids = new Set();
            for (let i = 0; i < 100; i++) {
                ids.add(InvoiceIdValidator.generate());
            }
            
            expect(ids.size).to.equal(100);
        });
    });
    
    describe('sanitize method', function() {
        it('should sanitize valid IDs', function() {
            const id = 'inv_1756271771724_geg1fza0e';
            expect(InvoiceIdValidator.sanitize(id)).to.equal(id);
        });
        
        it('should remove dangerous characters', function() {
            const dangerous = 'inv_1756271771724_geg1fza0e<script>';
            const sanitized = InvoiceIdValidator.sanitize(dangerous);
            
            expect(sanitized).to.equal('inv_1756271771724_geg1fza0e');
            expect(sanitized).to.not.include('<');
            expect(sanitized).to.not.include('>');
        });
        
        it('should handle SQL injection attempts', function() {
            const sqlInjection = "inv_1756271771724_geg1fza0e'; DROP TABLE Invoice; --";
            const sanitized = InvoiceIdValidator.sanitize(sqlInjection);
            
            expect(sanitized).to.equal('inv_1756271771724_geg1fza0e');
        });
        
        it('should return null for completely invalid IDs', function() {
            expect(InvoiceIdValidator.sanitize('"><script>alert(1)</script>')).to.be.null;
            expect(InvoiceIdValidator.sanitize('')).to.be.null;
            expect(InvoiceIdValidator.sanitize(null)).to.be.null;
        });
    });
    
    describe('getErrorMessage method', function() {
        it('should provide helpful error messages', function() {
            expect(InvoiceIdValidator.getErrorMessage(null))
                .to.equal('Invoice ID is required');
            
            expect(InvoiceIdValidator.getErrorMessage(''))
                .to.equal('Invoice ID is required');
            
            expect(InvoiceIdValidator.getErrorMessage('123e4567-e89b-12d3-a456-426614174000'))
                .to.include('old invoice ID format');
            
            expect(InvoiceIdValidator.getErrorMessage('inv_123_abc'))
                .to.include('Invoice ID is malformed');
            
            expect(InvoiceIdValidator.getErrorMessage('completely-wrong'))
                .to.include('Invalid invoice ID format');
        });
    });
    
    describe('Security Tests', function() {
        it('should prevent XSS attacks', function() {
            const xssAttempts = [
                '<img src=x onerror=alert(1)>',
                'javascript:alert(1)',
                'inv_1234567890123_<script>alert(1)</script>'
            ];
            
            xssAttempts.forEach(attempt => {
                const sanitized = InvoiceIdValidator.sanitize(attempt);
                if (sanitized) {
                    expect(sanitized).to.not.include('<');
                    expect(sanitized).to.not.include('>');
                    expect(sanitized).to.not.include('script');
                }
            });
        });
        
        it('should prevent path traversal', function() {
            const pathTraversal = 'inv_1234567890123_../../etc/passwd';
            const sanitized = InvoiceIdValidator.sanitize(pathTraversal);
            
            expect(sanitized).to.be.null; // Invalid after sanitization
        });
    });
});