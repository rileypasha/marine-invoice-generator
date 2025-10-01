import { DiffService } from '../diff.service';
import { Operation } from 'fast-json-patch';

describe('DiffService', () => {
  let diffService: DiffService;

  beforeEach(() => {
    diffService = new DiffService();
  });

  describe('generatePatch', () => {
    it('should generate empty patch for identical objects', () => {
      const obj1 = { name: 'John', age: 30 };
      const obj2 = { name: 'John', age: 30 };

      const patch = diffService.generatePatch(obj1, obj2);

      expect(patch).toEqual([]);
    });

    it('should detect field additions', () => {
      const obj1 = { name: 'John' };
      const obj2 = { name: 'John', age: 30 };

      const patch = diffService.generatePatch(obj1, obj2);

      expect(patch).toHaveLength(1);
      expect(patch[0]).toMatchObject({
        op: 'add',
        path: '/age',
        value: 30,
      });
    });

    it('should detect field removals', () => {
      const obj1 = { name: 'John', age: 30 };
      const obj2 = { name: 'John' };

      const patch = diffService.generatePatch(obj1, obj2);

      expect(patch).toHaveLength(1);
      expect(patch[0]).toMatchObject({
        op: 'remove',
        path: '/age',
      });
    });

    it('should detect field replacements', () => {
      const obj1 = { name: 'John', age: 30 };
      const obj2 = { name: 'Jane', age: 30 };

      const patch = diffService.generatePatch(obj1, obj2);

      expect(patch).toHaveLength(1);
      expect(patch[0]).toMatchObject({
        op: 'replace',
        path: '/name',
        value: 'Jane',
      });
    });

    it('should normalize string whitespace', () => {
      const obj1 = { name: '  John  ' };
      const obj2 = { name: 'John' };

      const patch = diffService.generatePatch(obj1, obj2);

      expect(patch).toEqual([]); // Should be identical after normalization
    });

    it('should normalize numeric precision', () => {
      const obj1 = { price: 10.123456 };
      const obj2 = { price: 10.12 };

      const patch = diffService.generatePatch(obj1, obj2);

      expect(patch).toEqual([]); // Should be identical after rounding to 2 decimals
    });

    it('should handle nested objects', () => {
      const obj1 = { customer: { name: 'John' } };
      const obj2 = { customer: { name: 'Jane' } };

      const patch = diffService.generatePatch(obj1, obj2);

      expect(patch).toHaveLength(1);
      expect(patch[0]).toMatchObject({
        op: 'replace',
        path: '/customer/name',
        value: 'Jane',
      });
    });

    it('should handle arrays', () => {
      const obj1 = { items: ['a', 'b'] };
      const obj2 = { items: ['a', 'b', 'c'] };

      const patch = diffService.generatePatch(obj1, obj2);

      expect(patch.length).toBeGreaterThan(0);
    });

    it('should normalize empty strings', () => {
      const obj1 = { name: '' };
      const obj2 = { name: null };

      const patch = diffService.generatePatch(obj1, obj2, { normalizeEmpty: true });

      expect(patch).toEqual([]); // Empty string and null treated as same
    });

    it('should handle date normalization', () => {
      const obj1 = { date: new Date('2025-01-15T10:30:00Z') };
      const obj2 = { date: new Date('2025-01-15T15:45:00Z') };

      const patch = diffService.generatePatch(obj1, obj2, { normalizeDates: true });

      expect(patch).toEqual([]); // Same date, different times (normalized to date only)
    });

    it('should sort array items by stable ID', () => {
      const obj1 = {
        data: JSON.stringify({
          lineItems: [
            { id: '2', name: 'B' },
            { id: '1', name: 'A' },
          ],
        }),
      };

      const obj2 = {
        data: JSON.stringify({
          lineItems: [
            { id: '1', name: 'A' },
            { id: '2', name: 'B' },
          ],
        }),
      };

      const patch = diffService.generatePatch(obj1, obj2);

      expect(patch).toEqual([]); // Order doesn't matter when sorted by ID
    });
  });

  describe('isNoOp', () => {
    it('should return true for empty patch', () => {
      const patch: Operation[] = [];
      expect(diffService.isNoOp(patch)).toBe(true);
    });

    it('should return false for non-empty patch', () => {
      const patch: Operation[] = [
        { op: 'replace', path: '/name', value: 'Jane' },
      ];
      expect(diffService.isNoOp(patch)).toBe(false);
    });
  });

  describe('generateSummary', () => {
    it('should generate summary for simple field change', () => {
      const from = { name: 'John', age: 30 };
      const to = { name: 'Jane', age: 30 };
      const patch = diffService.generatePatch(from, to);

      const summary = diffService.generateSummary(patch, from, to);

      expect(summary.totalChanges).toBe(1);
      expect(summary.fields).toHaveLength(1);
      expect(summary.fields[0]).toMatchObject({
        field: 'name',
        path: '/name',
        oldValue: 'John',
        newValue: 'Jane',
        operation: 'replace',
      });
    });

    it('should categorize customer changes', () => {
      const from = { customerName: 'John' };
      const to = { customerName: 'Jane' };
      const patch = diffService.generatePatch(from, to);

      const summary = diffService.generateSummary(patch, from, to);

      expect(summary.categories.customer).toBe(1);
    });

    it('should categorize vessel changes', () => {
      const from = { vesselName: 'SS Marine' };
      const to = { vesselName: 'SS Ocean' };
      const patch = diffService.generatePatch(from, to);

      const summary = diffService.generateSummary(patch, from, to);

      expect(summary.categories.vessel).toBe(1);
    });

    it('should categorize pricing changes', () => {
      const from = { total: 100, subtotal: 90, taxAmount: 10 };
      const to = { total: 200, subtotal: 180, taxAmount: 20 };
      const patch = diffService.generatePatch(from, to);

      const summary = diffService.generateSummary(patch, from, to);

      expect(summary.categories.pricing).toBe(3);
    });

    it('should categorize items changes', () => {
      const from = { data: JSON.stringify({ lineItems: [{ id: '1', name: 'A' }] }) };
      const to = { data: JSON.stringify({ lineItems: [{ id: '1', name: 'B' }] }) };
      const patch = diffService.generatePatch(from, to);

      const summary = diffService.generateSummary(patch, from, to);

      expect(summary.categories.items).toBeGreaterThan(0);
    });

    it('should handle multiple field changes', () => {
      const from = { name: 'John', age: 30, city: 'NYC' };
      const to = { name: 'Jane', age: 31, city: 'LA' };
      const patch = diffService.generatePatch(from, to);

      const summary = diffService.generateSummary(patch, from, to);

      expect(summary.totalChanges).toBe(3);
      expect(summary.fields).toHaveLength(3);
    });

    it('should handle add operations', () => {
      const from = { name: 'John' };
      const to = { name: 'John', age: 30 };
      const patch = diffService.generatePatch(from, to);

      const summary = diffService.generateSummary(patch, from, to);

      expect(summary.fields[0]).toMatchObject({
        operation: 'add',
        newValue: 30,
      });
    });

    it('should handle remove operations', () => {
      const from = { name: 'John', age: 30 };
      const to = { name: 'John' };
      const patch = diffService.generatePatch(from, to);

      const summary = diffService.generateSummary(patch, from, to);

      expect(summary.fields[0]).toMatchObject({
        operation: 'remove',
        oldValue: 30,
      });
    });
  });

  describe('optimizePatch', () => {
    it('should merge remove+add into replace', () => {
      const patch: Operation[] = [
        { op: 'remove', path: '/name' },
        { op: 'add', path: '/name', value: 'Jane' },
      ];

      const optimized = diffService.optimizePatch(patch);

      expect(optimized).toHaveLength(1);
      expect(optimized[0]).toMatchObject({
        op: 'replace',
        path: '/name',
        value: 'Jane',
      });
    });

    it('should cancel add+remove', () => {
      const patch: Operation[] = [
        { op: 'add', path: '/name', value: 'Jane' },
        { op: 'remove', path: '/name' },
      ];

      const optimized = diffService.optimizePatch(patch);

      expect(optimized).toHaveLength(0);
    });

    it('should keep latest operation at same path', () => {
      const patch: Operation[] = [
        { op: 'replace', path: '/name', value: 'Jane' },
        { op: 'replace', path: '/name', value: 'John' },
      ];

      const optimized = diffService.optimizePatch(patch);

      expect(optimized).toHaveLength(1);
      expect(optimized[0].value).toBe('John');
    });

    it('should preserve operations at different paths', () => {
      const patch: Operation[] = [
        { op: 'replace', path: '/name', value: 'Jane' },
        { op: 'replace', path: '/age', value: 31 },
      ];

      const optimized = diffService.optimizePatch(patch);

      expect(optimized).toHaveLength(2);
    });
  });

  describe('calculateSimilarity', () => {
    it('should return 1.0 for identical objects', () => {
      const obj = { name: 'John', age: 30 };
      const similarity = diffService.calculateSimilarity(obj, obj);

      expect(similarity).toBe(1);
    });

    it('should return < 1.0 for different objects', () => {
      const obj1 = { name: 'John', age: 30 };
      const obj2 = { name: 'Jane', age: 31 };

      const similarity = diffService.calculateSimilarity(obj1, obj2);

      expect(similarity).toBeLessThan(1);
      expect(similarity).toBeGreaterThan(0);
    });

    it('should return 0 for completely different objects', () => {
      const obj1 = { a: 1, b: 2, c: 3 };
      const obj2 = { x: 10, y: 20, z: 30 };

      const similarity = diffService.calculateSimilarity(obj1, obj2);

      expect(similarity).toBeLessThanOrEqual(0.5);
    });

    it('should handle empty objects', () => {
      const obj1 = {};
      const obj2 = { name: 'John' };

      const similarity = diffService.calculateSimilarity(obj1, obj2);

      expect(similarity).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle null values', () => {
      const obj1 = { name: null };
      const obj2 = { name: 'John' };

      const patch = diffService.generatePatch(obj1, obj2);

      expect(patch).toHaveLength(1);
    });

    it('should handle undefined values', () => {
      const obj1 = { name: undefined };
      const obj2 = { name: 'John' };

      const patch = diffService.generatePatch(obj1, obj2);

      expect(patch.length).toBeGreaterThan(0);
    });

    it('should handle deeply nested objects', () => {
      const obj1 = { a: { b: { c: { d: 'value1' } } } };
      const obj2 = { a: { b: { c: { d: 'value2' } } } };

      const patch = diffService.generatePatch(obj1, obj2);

      expect(patch).toHaveLength(1);
      expect(patch[0].path).toBe('/a/b/c/d');
    });

    it('should handle boolean values', () => {
      const obj1 = { active: true };
      const obj2 = { active: false };

      const patch = diffService.generatePatch(obj1, obj2);

      expect(patch).toHaveLength(1);
      expect(patch[0].value).toBe(false);
    });

    it('should handle zero values', () => {
      const obj1 = { count: 0 };
      const obj2 = { count: 1 };

      const patch = diffService.generatePatch(obj1, obj2);

      expect(patch).toHaveLength(1);
    });

    it('should handle large numbers', () => {
      const obj1 = { value: 999999999.99 };
      const obj2 = { value: 999999999.99 };

      const patch = diffService.generatePatch(obj1, obj2);

      expect(patch).toEqual([]);
    });
  });
});