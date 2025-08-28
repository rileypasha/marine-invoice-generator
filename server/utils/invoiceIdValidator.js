/**
 * Invoice ID Validator Utility
 * 
 * Validates invoice IDs in the format: inv_<timestamp>_<random>
 * Example: inv_1756271771724_geg1fza0e
 */

class InvoiceIdValidator {
    /**
     * Regular expressions for different ID formats
     */
    static PATTERNS = {
        // Primary format: inv_<13-digit-timestamp>_<9-char-alphanumeric>
        INVOICE: /^inv_\d{13}_[a-z0-9]{9}$/,
        
        // Legacy UUID format (for backward compatibility)
        UUID: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
        
        // Temporary/test format (if needed)
        TEST: /^test_inv_\d+$/
    };

    /**
     * Validate if an ID matches the invoice format
     * @param {string} id - The ID to validate
     * @param {boolean} allowLegacy - Whether to accept UUID format
     * @returns {boolean} True if valid
     */
    static isValid(id, allowLegacy = false) {
        if (!id || typeof id !== 'string') {
            return false;
        }

        // Check primary invoice format
        if (this.PATTERNS.INVOICE.test(id)) {
            return true;
        }

        // Check legacy UUID format if allowed
        if (allowLegacy && this.PATTERNS.UUID.test(id)) {
            return true;
        }

        // Check test format in development
        if (process.env.NODE_ENV === 'development' && this.PATTERNS.TEST.test(id)) {
            return true;
        }

        return false;
    }

    /**
     * Get the format type of an ID
     * @param {string} id - The ID to check
     * @returns {string|null} Format type or null if invalid
     */
    static getFormat(id) {
        if (!id || typeof id !== 'string') {
            return null;
        }

        if (this.PATTERNS.INVOICE.test(id)) {
            return 'invoice';
        }

        if (this.PATTERNS.UUID.test(id)) {
            return 'uuid';
        }

        if (this.PATTERNS.TEST.test(id)) {
            return 'test';
        }

        return null;
    }

    /**
     * Parse invoice ID components
     * @param {string} id - The invoice ID
     * @returns {object|null} Parsed components or null if invalid
     */
    static parse(id) {
        if (!this.isValid(id)) {
            return null;
        }

        // Parse invoice format: inv_<timestamp>_<random>
        if (this.PATTERNS.INVOICE.test(id)) {
            const parts = id.split('_');
            return {
                prefix: parts[0],
                timestamp: parseInt(parts[1], 10),
                random: parts[2],
                date: new Date(parseInt(parts[1], 10))
            };
        }

        // Return basic info for other formats
        return {
            format: this.getFormat(id),
            raw: id
        };
    }

    /**
     * Generate a new invoice ID
     * @param {string} prefix - Optional prefix (default: 'inv')
     * @returns {string} New invoice ID
     */
    static generate(prefix = 'inv') {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substr(2, 9);
        return `${prefix}_${timestamp}_${random}`;
    }

    /**
     * Validate and sanitize an ID for safe use
     * @param {string} id - The ID to sanitize
     * @returns {string|null} Sanitized ID or null if invalid
     */
    static sanitize(id) {
        if (!id || typeof id !== 'string') {
            return null;
        }

        // Remove any potentially dangerous characters
        const sanitized = id.replace(/[^a-z0-9_-]/gi, '');

        // Validate the sanitized ID
        if (this.isValid(sanitized, true)) {
            return sanitized;
        }

        return null;
    }

    /**
     * Get a user-friendly error message for invalid IDs
     * @param {string} id - The invalid ID
     * @returns {string} Error message
     */
    static getErrorMessage(id) {
        if (!id) {
            return 'Invoice ID is required';
        }

        const format = this.getFormat(id);
        
        if (format === 'uuid') {
            return 'This appears to be an old invoice ID format. Please refresh and try again.';
        }

        if (id.includes('inv_') && !this.PATTERNS.INVOICE.test(id)) {
            return 'Invoice ID is malformed. Expected format: inv_<timestamp>_<random>';
        }

        return 'Invalid invoice ID format. Please check the ID and try again.';
    }
}

module.exports = InvoiceIdValidator;