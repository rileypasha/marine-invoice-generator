/**
 * Unit tests for LineItemsDiff helper
 *
 * Tests line item change detection and visual styling
 */

import { getLineItemOp, hasLineItemChanges, hasLineItemFieldChange, buildDiffIndex } from '../LineItemsDiff';
import { PatchOperation } from '../../../types/diff.types';

// Import buildDiffIndex from ChangedValue since it's used by LineItemsDiff
import { buildDiffIndex as buildIndex } from '../ChangedValue';

describe('LineItemsDiff', () => {
  describe('getLineItemOp', () => {
    it('should detect added line item', () => {
      const diff = buildIndex([
        { op: 'add', path: '/lineItems/2', value: { description: 'New Item' } }
      ]);

      const result = getLineItemOp(diff, 2);

      expect(result).toEqual({
        op: 'add',
        path: '/lineItems/2',
        value: { description: 'New Item' }
      });
    });

    it('should detect removed line item', () => {
      const diff = buildIndex([
        { op: 'remove', path: '/lineItems/0', value: { description: 'Old Item' } }
      ]);

      const result = getLineItemOp(diff, 0);

      expect(result).toEqual({
        op: 'remove',
        path: '/lineItems/0',
        value: { description: 'Old Item' }
      });
    });

    it('should return undefined for unchanged line item', () => {
      const diff = buildIndex([
        { op: 'replace', path: '/lineItems/0/description', value: 'Changed' }
      ]);

      const result = getLineItemOp(diff, 5);

      expect(result).toBeUndefined();
    });

    it('should handle empty diff index', () => {
      const diff = buildIndex([]);

      const result = getLineItemOp(diff, 0);

      expect(result).toBeUndefined();
    });

    it('should return exact line item match', () => {
      const diff = buildIndex([
        { op: 'add', path: '/lineItems/0', value: { id: '1', description: 'New' } },
        { op: 'replace', path: '/lineItems/0/description', value: 'Changed' },
      ]);

      const result = getLineItemOp(diff, 0);

      // Should return the exact /lineItems/0 match
      expect(result?.path).toBe('/lineItems/0');
      expect(result?.op).toBe('add');
    });
  });

  describe('hasLineItemChanges', () => {
    it('should return true when line items have changes', () => {
      const diff = buildIndex([
        { op: 'replace', path: '/lineItems/0/description', value: 'Changed' }
      ]);

      expect(hasLineItemChanges(diff)).toBe(true);
    });

    it('should return true for line item addition', () => {
      const diff = buildIndex([
        { op: 'add', path: '/lineItems/2', value: { description: 'New' } }
      ]);

      expect(hasLineItemChanges(diff)).toBe(true);
    });

    it('should return false when no line item changes', () => {
      const diff = buildIndex([
        { op: 'replace', path: '/customerName', value: 'Changed' },
        { op: 'replace', path: '/total', value: 1500 }
      ]);

      expect(hasLineItemChanges(diff)).toBe(false);
    });

    it('should return false for undefined diff', () => {
      expect(hasLineItemChanges(undefined)).toBe(false);
    });

    it('should return false for empty diff', () => {
      const diff = buildIndex([]);

      expect(hasLineItemChanges(diff)).toBe(false);
    });
  });

  describe('hasLineItemFieldChange', () => {
    it('should detect field change in line item', () => {
      const diff = buildIndex([
        { op: 'replace', path: '/lineItems/0/description', value: 'Updated' }
      ]);

      expect(hasLineItemFieldChange(diff, 0, 'description')).toBe(true);
    });

    it('should detect quantity change', () => {
      const diff = buildIndex([
        { op: 'replace', path: '/lineItems/1/quantity', value: 5 }
      ]);

      expect(hasLineItemFieldChange(diff, 1, 'quantity')).toBe(true);
    });

    it('should detect cost change', () => {
      const diff = buildIndex([
        { op: 'replace', path: '/lineItems/2/cost', value: 1500.00 }
      ]);

      expect(hasLineItemFieldChange(diff, 2, 'cost')).toBe(true);
    });

    it('should return false for unchanged field', () => {
      const diff = buildIndex([
        { op: 'replace', path: '/lineItems/0/description', value: 'Changed' }
      ]);

      expect(hasLineItemFieldChange(diff, 0, 'quantity')).toBe(false);
      expect(hasLineItemFieldChange(diff, 1, 'description')).toBe(false);
    });

    it('should return false for empty diff', () => {
      const diff = buildIndex([]);

      expect(hasLineItemFieldChange(diff, 0, 'description')).toBe(false);
    });

    it('should detect nested field changes', () => {
      const diff = buildIndex([
        { op: 'replace', path: '/lineItems/0/pricing/markup', value: 0.30 }
      ]);

      expect(hasLineItemFieldChange(diff, 0, 'pricing/markup')).toBe(true);
    });
  });

  describe('Line item diff styling', () => {
    it('should identify added item for styling', () => {
      const diff = buildIndex([
        { op: 'add', path: '/lineItems/1', value: { description: 'New' } }
      ]);

      const op = getLineItemOp(diff, 1);

      expect(op?.op).toBe('add');
      // Component should apply: bg-green-50 border-green-500
    });

    it('should identify removed item for styling', () => {
      const diff = buildIndex([
        { op: 'remove', path: '/lineItems/0', value: { description: 'Old' } }
      ]);

      const op = getLineItemOp(diff, 0);

      expect(op?.op).toBe('remove');
      // Component should apply: bg-red-50 border-red-500 opacity-75
    });

    it('should identify modified item for styling', () => {
      const diff = buildIndex([
        { op: 'replace', path: '/lineItems/2', value: { cost: 1000 } }
      ]);

      const op = getLineItemOp(diff, 2);

      expect(op?.op).toBe('replace');
      // Component should apply: bg-yellow-50 border-yellow-500
    });
  });

  describe('Edge cases', () => {
    it('should handle negative index gracefully', () => {
      const diff = buildIndex([
        { op: 'add', path: '/lineItems/0', value: {} }
      ]);

      const result = getLineItemOp(diff, -1);

      expect(result).toBeUndefined();
    });

    it('should handle very large index', () => {
      const diff = buildIndex([
        { op: 'add', path: '/lineItems/0', value: {} }
      ]);

      const result = getLineItemOp(diff, 999);

      expect(result).toBeUndefined();
    });

    it('should not match partial paths', () => {
      const diff = buildIndex([
        { op: 'replace', path: '/lineItems/0/description', value: 'Test' }
      ]);

      // getLineItemOp looks for exact /lineItems/INDEX match, not subpaths
      const result = getLineItemOp(diff, 0);

      expect(result).toBeUndefined(); // No exact match at /lineItems/0
    });

    it('should handle paths without lineItems', () => {
      const diff = buildIndex([
        { op: 'replace', path: '/customerName', value: 'Test' }
      ]);

      expect(hasLineItemChanges(diff)).toBe(false);
      expect(getLineItemOp(diff, 0)).toBeUndefined();
    });

    it('should handle diff with null value', () => {
      const diff = buildIndex([
        { op: 'remove', path: '/lineItems/0/notes', value: null }
      ]);

      expect(hasLineItemFieldChange(diff, 0, 'notes')).toBe(true);
    });

    it('should handle diff with undefined value', () => {
      const diff = buildIndex([
        { op: 'add', path: '/lineItems/1', value: undefined }
      ]);

      const result = getLineItemOp(diff, 1);

      expect(result?.op).toBe('add');
    });
  });

  describe('Performance', () => {
    it('should handle large diff arrays efficiently', () => {
      // Create 1000 diff operations
      const operations: PatchOperation[] = Array.from({ length: 1000 }, (_, i) => ({
        op: 'replace',
        path: `/lineItems/${i}/description`,
        value: `Item ${i}`
      }));

      const diff = buildIndex(operations);

      const startTime = performance.now();
      const hasChanges = hasLineItemChanges(diff);
      const endTime = performance.now();

      expect(hasChanges).toBe(true);
      expect(endTime - startTime).toBeLessThan(50); // Should be fast
    });

    it('should handle multiple field lookups efficiently', () => {
      const operations: PatchOperation[] = Array.from({ length: 100 }, (_, i) => ({
        op: 'replace',
        path: `/lineItems/${i}/cost`,
        value: i * 100
      }));

      const diff = buildIndex(operations);

      const startTime = performance.now();
      for (let i = 0; i < 100; i++) {
        hasLineItemFieldChange(diff, i, 'cost');
      }
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(50); // All lookups should be O(1)
    });
  });
});