import { compare, Operation } from 'fast-json-patch';
import { logger } from '../utils/logger';

/**
 * Normalized invoice structure with consistent formatting
 */
interface NormalizedInvoice {
  [key: string]: unknown;
}

/**
 * Field-level change description
 */
interface FieldChange {
  field: string;
  path: string;
  oldValue: unknown;
  newValue: unknown;
  operation: 'add' | 'replace' | 'remove';
}

/**
 * Human-readable diff summary
 */
interface DiffSummary {
  totalChanges: number;
  fields: FieldChange[];
  categories: {
    customer?: number;
    vessel?: number;
    items?: number;
    pricing?: number;
    metadata?: number;
  };
}

/**
 * Configuration options for diff generation
 */
interface DiffOptions {
  normalizeDates?: boolean;
  numericPrecision?: number;
  normalizeEmpty?: boolean;
}

/**
 * DiffService: Handles RFC-6902 JSON Patch generation and analysis
 *
 * Provides functionality for:
 * - Normalizing invoice snapshots for consistent comparison
 * - Generating RFC-6902 JSON Patch diffs
 * - Creating human-readable change summaries
 * - Detecting no-op changes
 */
export class DiffService {
  /**
   * Normalize invoice snapshot for consistent diffing
   *
   * Performs the following normalizations:
   * - Trims all strings
   * - Formats dates to ISO strings
   * - Rounds numbers to 2 decimals
   * - Sorts array items by stable IDs
   * - Removes undefined/null values
   *
   * @param invoice - Raw invoice data
   * @param options - Normalization options
   * @returns Normalized invoice object
   */
  private normalizeSnapshot(invoice: unknown, options: DiffOptions = {}): NormalizedInvoice {
    const {
      normalizeDates = true,
      numericPrecision = 2,
      normalizeEmpty = true
    } = options;

    const normalized = JSON.parse(JSON.stringify(invoice, (key, value) => {
      // Remove undefined/null
      if (value === undefined || value === null) {
        return normalizeEmpty ? undefined : null;
      }

      // Trim strings
      if (typeof value === 'string') {
        const trimmed = value.trim();
        return normalizeEmpty && trimmed === '' ? undefined : trimmed;
      }

      // Format dates
      if (normalizeDates && value instanceof Date) {
        return value.toISOString().split('T')[0]; // Date only, ignore time
      }

      // Round numbers (preserve integers, round decimals)
      if (typeof value === 'number') {
        if (Number.isInteger(value)) return value;
        return Math.round(value * Math.pow(10, numericPrecision)) / Math.pow(10, numericPrecision);
      }

      return value;
    }));

    // Sort line items by stable ID if present
    if (normalized.data && typeof normalized.data === 'string') {
      try {
        const parsedData = JSON.parse(normalized.data);
        if (parsedData.lineItems && Array.isArray(parsedData.lineItems)) {
          parsedData.lineItems.sort((a: { id?: string; tempId?: string }, b: { id?: string; tempId?: string }) => {
            const aId = a.id || a.tempId || '';
            const bId = b.id || b.tempId || '';
            return aId.localeCompare(bId);
          });
          normalized.data = JSON.stringify(parsedData);
        }
      } catch (err) {
        // If data is not parseable JSON, leave as is
        logger.debug('Invoice data field is not parseable JSON', { error: err });
      }
    }

    return normalized as NormalizedInvoice;
  }

  /**
   * Generate RFC-6902 JSON Patch between two snapshots
   *
   * @param fromSnapshot - Previous invoice state
   * @param toSnapshot - Current invoice state
   * @param options - Normalization options
   * @returns Array of RFC-6902 operations
   */
  generatePatch(fromSnapshot: unknown, toSnapshot: unknown, options: DiffOptions = {}): Operation[] {
    const normalizedFrom = this.normalizeSnapshot(fromSnapshot, options);
    const normalizedTo = this.normalizeSnapshot(toSnapshot, options);

    const patch = compare(normalizedFrom, normalizedTo);

    logger.debug('Generated JSON Patch', {
      operationCount: patch.length,
      operations: patch.map(op => ({ op: op.op, path: op.path })),
    });

    return patch;
  }

  /**
   * Detect if patch represents no meaningful changes
   *
   * @param patch - RFC-6902 patch array
   * @returns True if patch is empty (no-op)
   */
  isNoOp(patch: Operation[]): boolean {
    return patch.length === 0;
  }

  /**
   * Generate human-readable summary from RFC-6902 patch
   *
   * @param patch - RFC-6902 patch array
   * @param fromSnapshot - Previous invoice state
   * @param toSnapshot - Current invoice state
   * @returns Structured change summary
   */
  generateSummary(patch: Operation[], fromSnapshot: unknown, toSnapshot: unknown): DiffSummary {
    const fields: FieldChange[] = [];
    const categories = {
      customer: 0,
      vessel: 0,
      items: 0,
      pricing: 0,
      metadata: 0,
    };

    for (const op of patch) {
      const pathParts = op.path.split('/').filter(p => p);
      const field = pathParts[pathParts.length - 1] || 'unknown';

      // Extract old/new values
      const oldValue = this.getValueAtPath(fromSnapshot, op.path);
      let newValue: unknown;

      if (op.op === 'remove') {
        newValue = undefined;
      } else if (op.op === 'add' || op.op === 'replace') {
        newValue = op.value;
      }

      fields.push({
        field,
        path: op.path,
        oldValue,
        newValue,
        operation: op.op as 'add' | 'replace' | 'remove',
      });

      // Categorize change
      if (op.path.includes('customer')) {
        categories.customer++;
      } else if (op.path.includes('vessel')) {
        categories.vessel++;
      } else if (op.path.match(/lineItems|items|services/i)) {
        categories.items++;
      } else if (op.path.match(/total|subtotal|tax|profit|price|amount/i)) {
        categories.pricing++;
      } else {
        categories.metadata++;
      }
    }

    return {
      totalChanges: patch.length,
      fields,
      categories,
    };
  }

  /**
   * Get value at JSON Pointer path
   *
   * @param obj - Object to traverse
   * @param path - JSON Pointer path (e.g., "/customer/name")
   * @returns Value at path, or undefined if not found
   */
  private getValueAtPath(obj: unknown, path: string): unknown {
    if (!obj || typeof obj !== 'object') return undefined;

    const pathParts = path.split('/').filter(p => p);
    let current: any = obj;

    for (const part of pathParts) {
      if (current === undefined || current === null) return undefined;
      current = current[part];
    }

    return current;
  }

  /**
   * Optimize patch for storage (remove redundant operations)
   *
   * @param patch - RFC-6902 patch array
   * @returns Optimized patch array
   */
  optimizePatch(patch: Operation[]): Operation[] {
    // Remove operations that cancel each other out
    // Example: remove followed by add at same path -> replace
    const optimized: Operation[] = [];
    const pathMap = new Map<string, Operation>();

    for (const op of patch) {
      const existing = pathMap.get(op.path);

      if (existing) {
        // Merge operations at same path
        if (existing.op === 'remove' && op.op === 'add') {
          // Convert to replace
          pathMap.set(op.path, {
            op: 'replace',
            path: op.path,
            value: op.value,
          });
        } else if (existing.op === 'add' && op.op === 'remove') {
          // Cancel each other out
          pathMap.delete(op.path);
        } else {
          // Keep latest operation
          pathMap.set(op.path, op);
        }
      } else {
        pathMap.set(op.path, op);
      }
    }

    pathMap.forEach(op => optimized.push(op));

    return optimized;
  }

  /**
   * Calculate similarity score between two invoices
   *
   * @param fromSnapshot - Previous invoice state
   * @param toSnapshot - Current invoice state
   * @returns Similarity score (0-1, where 1 is identical)
   */
  calculateSimilarity(fromSnapshot: unknown, toSnapshot: unknown): number {
    const patch = this.generatePatch(fromSnapshot, toSnapshot);

    if (patch.length === 0) return 1; // Identical

    // Simple heuristic: fewer changes = more similar
    // In a real implementation, weight changes by field importance
    const normalizedFrom = this.normalizeSnapshot(fromSnapshot);
    const fieldCount = Object.keys(normalizedFrom).length || 1;

    return Math.max(0, 1 - (patch.length / fieldCount));
  }
}

// Singleton instance
export const diffService = new DiffService();