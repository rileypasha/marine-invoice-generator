/**
 * CanonicalInvoice - First-Principles Canonical State Representation
 *
 * This class provides:
 * - Deterministic state normalization (consistent types, ordering, null handling)
 * - Canonical JSON representation for stable comparison
 * - Field-level change detection with precise section mapping
 * - UI state exclusion to prevent false positives
 *
 * Root Cause Fix for: False dirty state, broken section diff, baseline corruption
 */

import { safeString } from './safeString.js';

/**
 * Field-to-section mapping for granular change detection
 */
export const SECTION_MAPPING = {
  // Vessel section
  'vessel.name': 'Vessel details',
  'vessel.weight': 'Vessel details',
  'vessel.beam': 'Vessel details',

  // Customer section
  'customer.customerName': 'Customer information',
  'customer.customerEmail': 'Customer information',
  'customer.customerPhone': 'Customer information',

  // Line items section (special handling for array changes)
  'scope.lineItems': 'Service line items',
  'scope.markupRate': 'Service line items',
  'scope.isTaxable': 'Service line items',

  // Comments section
  'notes.comments': 'Comments'
};

/**
 * Fields to exclude from dirty state detection (UI/computed/ephemeral)
 */
export const EXCLUDED_FIELDS = new Set([
  'createdAt',
  'updatedAt',
  'taxAmount', // Computed field
  'id', // Line item IDs can change during normalization
  'serverId',
  'status',
  'metadata'
]);

export class CanonicalInvoice {
  constructor(rawInvoice) {
    if (!rawInvoice) {
      throw new Error('CanonicalInvoice requires invoice data');
    }

    // Normalize each section deterministically
    this.vessel = this.normalizeVessel(rawInvoice.vessel);
    this.customer = this.normalizeCustomer(rawInvoice.customer);
    this.scope = this.normalizeScope(rawInvoice.scope);
    this.notes = this.normalizeNotes(rawInvoice.notes);

    // Store raw for debugging
    this._raw = rawInvoice;
  }

  /**
   * Normalize vessel data with type safety and consistent ordering
   */
  normalizeVessel(vessel = {}) {
    return {
      name: safeString(vessel.name),
      weight: safeString(vessel.weight),
      beam: safeString(vessel.beam)
    };
  }

  /**
   * Normalize customer data with type safety and consistent ordering
   */
  normalizeCustomer(customer = {}) {
    return {
      customerName: safeString(customer.customerName),
      customerEmail: safeString(customer.customerEmail),
      customerPhone: safeString(customer.customerPhone)
    };
  }

  /**
   * Normalize scope data with deterministic line item ordering
   */
  normalizeScope(scope = {}) {
    const lineItems = (scope.lineItems || [])
      .map(item => this.normalizeLineItem(item))
      .sort((a, b) => {
        // Sort by ID first, then by creation order for stability
        if (a.id !== b.id) {
          return (a.id || 0) - (b.id || 0);
        }
        // Fallback to content-based sorting for identical IDs
        return (a.jobType || '').localeCompare(b.jobType || '');
      });

    return {
      markupRate: safeString(scope.markupRate, '2.5'),
      isTaxable: Boolean(scope.isTaxable),
      lineItems: lineItems
    };
  }

  /**
   * Normalize line item with consistent field ordering and type safety
   */
  normalizeLineItem(item = {}) {
    return {
      id: item.id || 0,
      jobType: safeString(item.jobType),
      itemType: safeString(item.itemType),
      manualCost: safeString(item.manualCost),
      laborHours: safeString(item.laborHours),
      otHours: safeString(item.otHours),
      description: safeString(item.description),
      taxStatus: safeString(item.taxStatus, 'taxable'),
      taxRate: Number(item.taxRate || 0.0875),
      markupType: safeString(item.markupType, 'preset'),
      markupRate: safeString(item.markupRate, '2.5'),
      isMarkupExempt: Boolean(item.isMarkupExempt)
      // Exclude computed fields like taxAmount, createdAt
    };
  }

  /**
   * Normalize notes data with consistent comment ordering
   */
  normalizeNotes(notes = {}) {
    const comments = (notes.comments || [])
      .map(comment => this.normalizeComment(comment))
      .sort((a, b) => {
        // Sort by timestamp for deterministic ordering
        return (a.timestamp || 0) - (b.timestamp || 0);
      });

    return {
      comments: comments
    };
  }

  /**
   * Normalize comment with consistent field ordering
   */
  normalizeComment(comment = {}) {
    return {
      id: comment.id || 0,
      text: safeString(comment.text),
      author: safeString(comment.author),
      timestamp: Number(comment.timestamp || 0)
    };
  }

  /**
   * Get canonical JSON representation for stable comparison
   */
  toCanonicalJSON() {
    // Sort keys at all levels for deterministic output
    return JSON.stringify(this, this.sortedStringify);
  }

  /**
   * Custom JSON.stringify replacer for deterministic key ordering
   */
  sortedStringify(key, value) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      // Sort object keys for deterministic output
      const sorted = {};
      Object.keys(value).sort().forEach(k => {
        sorted[k] = value[k];
      });
      return sorted;
    }
    return value;
  }

  /**
   * Calculate stable hash for efficient comparison
   */
  getHash() {
    const canonical = this.toCanonicalJSON();
    return this.simpleHash(canonical);
  }

  /**
   * Simple hash function for comparison
   */
  simpleHash(str) {
    let hash = 0;
    if (str.length === 0) return hash.toString();

    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }

    return Math.abs(hash).toString();
  }

  /**
   * Compare with another canonical invoice and return field-level differences
   */
  diff(other) {
    if (!(other instanceof CanonicalInvoice)) {
      throw new Error('Can only diff with another CanonicalInvoice');
    }

    const changes = [];

    // Compare vessel fields
    this.diffObject(this.vessel, other.vessel, 'vessel', changes);

    // Compare customer fields
    this.diffObject(this.customer, other.customer, 'customer', changes);

    // Compare scope fields (excluding lineItems)
    const scopeWithoutItems = { ...this.scope };
    const otherScopeWithoutItems = { ...other.scope };
    delete scopeWithoutItems.lineItems;
    delete otherScopeWithoutItems.lineItems;
    this.diffObject(scopeWithoutItems, otherScopeWithoutItems, 'scope', changes);

    // Special handling for line items array
    if (!this.arrayEqual(this.scope.lineItems, other.scope.lineItems)) {
      changes.push('scope.lineItems');
    }

    // Compare notes fields
    if (!this.arrayEqual(this.notes.comments, other.notes.comments)) {
      changes.push('notes.comments');
    }

    return changes;
  }

  /**
   * Deep diff two objects and add field paths to changes array
   */
  diffObject(current, saved, prefix, changes) {
    const allKeys = new Set([...Object.keys(current), ...Object.keys(saved)]);

    for (const key of allKeys) {
      const fieldPath = `${prefix}.${key}`;

      if (current[key] !== saved[key]) {
        changes.push(fieldPath);
      }
    }
  }

  /**
   * Compare two arrays for equality (order-independent for sorted arrays)
   */
  arrayEqual(arr1, arr2) {
    if (arr1.length !== arr2.length) return false;

    for (let i = 0; i < arr1.length; i++) {
      if (!this.objectEqual(arr1[i], arr2[i])) {
        return false;
      }
    }

    return true;
  }

  /**
   * Deep equality check for objects
   */
  objectEqual(obj1, obj2) {
    if (obj1 === obj2) return true;
    if (!obj1 || !obj2) return false;

    const keys1 = Object.keys(obj1);
    const keys2 = Object.keys(obj2);

    if (keys1.length !== keys2.length) return false;

    for (const key of keys1) {
      if (obj1[key] !== obj2[key]) return false;
    }

    return true;
  }

  /**
   * Map field changes to affected sections
   */
  getChangedSections(fieldChanges) {
    const sections = new Set();

    for (const fieldPath of fieldChanges) {
      const section = SECTION_MAPPING[fieldPath];
      if (section) {
        sections.add(section);
      }
    }

    return Array.from(sections).sort();
  }

  /**
   * Check if there are any meaningful changes (excluding UI/computed fields)
   */
  static hasChanges(current, baseline) {
    if (!current || !baseline) return false;

    try {
      const currentCanonical = new CanonicalInvoice(current);
      const baselineCanonical = new CanonicalInvoice(baseline);

      const changes = currentCanonical.diff(baselineCanonical);
      return changes.length > 0;
    } catch (error) {
      console.error('❌ Error in CanonicalInvoice.hasChanges:', error);
      return false;
    }
  }

  /**
   * Get comprehensive change summary with field paths and sections
   */
  static getChangesSummary(current, baseline) {
    if (!current || !baseline) {
      return { hasChanges: false, changes: [], fieldChanges: [], sections: [] };
    }

    try {
      const currentCanonical = new CanonicalInvoice(current);
      const baselineCanonical = new CanonicalInvoice(baseline);

      const fieldChanges = currentCanonical.diff(baselineCanonical);
      const sections = currentCanonical.getChangedSections(fieldChanges);

      return {
        hasChanges: fieldChanges.length > 0,
        changes: sections, // For UI compatibility
        fieldChanges: fieldChanges,
        sections: sections
      };
    } catch (error) {
      console.error('❌ Error in CanonicalInvoice.getChangesSummary:', error);
      return { hasChanges: false, changes: [], fieldChanges: [], sections: [] };
    }
  }

  /**
   * Create canonical invoice from current state safely
   */
  static fromState(state) {
    try {
      return new CanonicalInvoice(state);
    } catch (error) {
      console.error('❌ Error creating canonical invoice from state:', error);
      // Return minimal canonical invoice as fallback
      return new CanonicalInvoice({
        vessel: {},
        customer: {},
        scope: { lineItems: [] },
        notes: { comments: [] }
      });
    }
  }

  /**
   * Debug helper to log canonical representation
   */
  debug(label = 'CanonicalInvoice') {
    console.log(`🔍 ${label}:`, {
      hash: this.getHash(),
      vessel: this.vessel,
      customer: this.customer,
      lineItemsCount: this.scope.lineItems.length,
      commentsCount: this.notes.comments.length,
      canonical: this.toCanonicalJSON()
    });
  }
}