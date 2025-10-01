/**
 * Unit tests for DiffService
 *
 * Tests diff computation, normalization, and edge case handling
 */

import { diffService } from '../diff.service';
import { Operation } from 'fast-json-patch';

describe('DiffService', () => {
  describe('Primitive value changes', () => {
    it('should detect string addition', () => {
      const from = { title: undefined };
      const to = { title: 'New Invoice' };

      const patch = diffService.generatePatch(from, to);

      expect(patch).toHaveLength(1);
      expect(patch[0]).toMatchObject({
        op: 'add',
        path: '/title',
        value: 'New Invoice',
      });
    });

    it('should detect string removal', () => {
      const from = { title: 'Old Invoice' };
      const to = { title: undefined };

      const patch = diffService.generatePatch(from, to);

      expect(patch).toHaveLength(1);
      expect(patch[0]).toMatchObject({
        op: 'remove',
        path: '/title',
      });
    });

    it('should detect string change', () => {
      const from = { customerName: 'John Doe' };
      const to = { customerName: 'Jane Smith' };

      const patch = diffService.generatePatch(from, to);

      expect(patch).toHaveLength(1);
      expect(patch[0]).toMatchObject({
        op: 'replace',
        path: '/customerName',
        value: 'Jane Smith',
      });
    });

    it('should detect number change', () => {
      const from = { total: 1000.00 };
      const to = { total: 1500.50 };

      const patch = diffService.generatePatch(from, to);

      expect(patch).toHaveLength(1);
      expect(patch[0]).toMatchObject({
        op: 'replace',
        path: '/total',
        value: 1500.50,
      });
    });

    it('should detect boolean change', () => {
      const from = { isTaxable: true };
      const to = { isTaxable: false };

      const patch = diffService.generatePatch(from, to);

      expect(patch).toHaveLength(1);
      expect(patch[0]).toMatchObject({
        op: 'replace',
        path: '/isTaxable',
        value: false,
      });
    });
  });

  describe('Nested object changes', () => {
    it('should detect changes at depth 1', () => {
      const from = { customer: { name: 'John' } };
      const to = { customer: { name: 'Jane' } };

      const patch = diffService.generatePatch(from, to);

      expect(patch).toHaveLength(1);
      expect(patch[0].path).toMatch(/\/customer\/name/);
    });

    it('should detect changes at depth 3', () => {
      const from = {
        data: {
          invoice: {
            customer: { name: 'John' }
          }
        }
      };
      const to = {
        data: {
          invoice: {
            customer: { name: 'Jane' }
          }
        }
      };

      const patch = diffService.generatePatch(from, to);

      expect(patch).toHaveLength(1);
      expect(patch[0].path).toContain('/customer/name');
    });

    it('should detect multiple nested changes', () => {
      const from = {
        customer: { name: 'John', email: 'john@test.com' },
        vessel: { name: 'SS Marine' },
      };
      const to = {
        customer: { name: 'Jane', email: 'jane@test.com' },
        vessel: { name: 'SS Marine' },
      };

      const patch = diffService.generatePatch(from, to);

      expect(patch.length).toBeGreaterThanOrEqual(2);
      const paths = patch.map(op => op.path);
      expect(paths.some(p => p.includes('name'))).toBe(true);
      expect(paths.some(p => p.includes('email'))).toBe(true);
    });
  });

  describe('Array changes', () => {
    it('should detect array item addition with id', () => {
      const from = { lineItems: [{ id: '1', description: 'Item 1' }] };
      const to = {
        lineItems: [
          { id: '1', description: 'Item 1' },
          { id: '2', description: 'Item 2' },
        ]
      };

      const patch = diffService.generatePatch(from, to);

      expect(patch.length).toBeGreaterThan(0);
      const addOps = patch.filter(op => op.op === 'add');
      expect(addOps.length).toBeGreaterThan(0);
    });

    it('should detect array item removal', () => {
      const from = {
        lineItems: [
          { id: '1', description: 'Item 1' },
          { id: '2', description: 'Item 2' },
        ]
      };
      const to = { lineItems: [{ id: '1', description: 'Item 1' }] };

      const patch = diffService.generatePatch(from, to);

      expect(patch.length).toBeGreaterThan(0);
      const removeOps = patch.filter(op => op.op === 'remove');
      expect(removeOps.length).toBeGreaterThan(0);
    });

    it('should detect array item modification', () => {
      const from = {
        lineItems: [{ id: '1', description: 'Item 1', quantity: 1 }]
      };
      const to = {
        lineItems: [{ id: '1', description: 'Item 1', quantity: 5 }]
      };

      const patch = diffService.generatePatch(from, to);

      expect(patch.length).toBeGreaterThan(0);
      const quantityChange = patch.find(op => op.path.includes('quantity'));
      expect(quantityChange).toBeDefined();
      expect(quantityChange?.value).toBe(5);
    });

    it('should detect price and description changes', () => {
      const from = {
        lineItems: [
          { id: '1', description: 'Labor', price: 100.00 }
        ]
      };
      const to = {
        lineItems: [
          { id: '1', description: 'Labor - Updated', price: 125.00 }
        ]
      };

      const patch = diffService.generatePatch(from, to);

      expect(patch.length).toBeGreaterThanOrEqual(2);
      expect(patch.some(op => op.path.includes('description'))).toBe(true);
      expect(patch.some(op => op.path.includes('price'))).toBe(true);
    });

    it('should handle array reordering without spurious diffs', () => {
      const from = {
        lineItems: [
          { id: '1', description: 'Item 1' },
          { id: '2', description: 'Item 2' },
        ]
      };
      const to = {
        lineItems: [
          { id: '2', description: 'Item 2' },
          { id: '1', description: 'Item 1' },
        ]
      };

      const patch = diffService.generatePatch(from, to);

      // Should have minimal diffs due to sorting normalization
      expect(patch.length).toBe(0);
    });

    it('should handle large arrays (100+ items)', () => {
      const items = Array.from({ length: 100 }, (_, i) => ({
        id: `item-${i}`,
        description: `Item ${i}`,
        quantity: 1,
      }));

      const from = { lineItems: items };
      const to = {
        lineItems: items.map((item, i) =>
          i === 50 ? { ...item, quantity: 10 } : item
        )
      };

      const patch = diffService.generatePatch(from, to);

      expect(patch.length).toBeGreaterThan(0);
      expect(patch.length).toBeLessThan(10); // Should only detect the single change
    });
  });

  describe('Normalization', () => {
    it('should normalize whitespace', () => {
      const from = { title: '  Invoice  ' };
      const to = { title: 'Invoice' };

      const patch = diffService.generatePatch(from, to);

      expect(patch).toHaveLength(0); // Should be considered equal after trim
    });

    it('should normalize numeric precision', () => {
      const from = { total: 100.123456789 };
      const to = { total: 100.12 };

      const patch = diffService.generatePatch(from, to);

      expect(patch).toHaveLength(0); // Should round to 2 decimals
    });

    it('should treat numeric string formats as equal', () => {
      const from = { total: 1000.00 };
      const to = { total: 1000 };

      const patch = diffService.generatePatch(from, to);

      expect(patch).toHaveLength(0);
    });

    it('should normalize date formats to ISO', () => {
      const from = { createdAt: new Date('2025-01-15T10:30:00Z') };
      const to = { createdAt: new Date('2025-01-15T15:45:00Z') };

      const patch = diffService.generatePatch(from, to);

      // Dates should normalize to date-only (ignore time)
      expect(patch).toHaveLength(0);
    });
  });

  describe('Edge cases', () => {
    it('should handle null vs undefined as empty', () => {
      const from = { notes: null };
      const to = { notes: undefined };

      const patch = diffService.generatePatch(from, to);

      expect(patch).toHaveLength(0);
    });

    it('should treat empty string as undefined', () => {
      const from = { notes: '' };
      const to = { notes: undefined };

      const patch = diffService.generatePatch(from, to);

      expect(patch).toHaveLength(0);
    });

    it('should handle deep nesting (5+ levels)', () => {
      const from = {
        a: {
          b: {
            c: {
              d: {
                e: { value: 'deep' }
              }
            }
          }
        }
      };
      const to = {
        a: {
          b: {
            c: {
              d: {
                e: { value: 'deeper' }
              }
            }
          }
        }
      };

      const patch = diffService.generatePatch(from, to);

      expect(patch).toHaveLength(1);
      expect(patch[0].path).toContain('/e/value');
    });

    it('should handle empty objects', () => {
      const from = {};
      const to = {};

      const patch = diffService.generatePatch(from, to);

      expect(patch).toHaveLength(0);
    });

    it('should handle circular references gracefully', () => {
      const from: any = { name: 'test' };
      from.self = from; // Create circular reference

      expect(() => {
        diffService.generatePatch(from, { name: 'test2' });
      }).not.toThrow();
    });
  });

  describe('isNoOp', () => {
    it('should detect no-op with empty patch', () => {
      const patch: Operation[] = [];

      expect(diffService.isNoOp(patch)).toBe(true);
    });

    it('should detect changes with non-empty patch', () => {
      const patch: Operation[] = [
        { op: 'replace', path: '/title', value: 'New' }
      ];

      expect(diffService.isNoOp(patch)).toBe(false);
    });
  });

  describe('generateSummary', () => {
    it('should categorize customer changes', () => {
      const from = { customerName: 'John' };
      const to = { customerName: 'Jane' };

      const patch = diffService.generatePatch(from, to);
      const summary = diffService.generateSummary(patch, from, to);

      expect(summary.totalChanges).toBeGreaterThan(0);
      expect(summary.categories.customer).toBeGreaterThan(0);
    });

    it('should categorize vessel changes', () => {
      const from = { vesselName: 'SS Old' };
      const to = { vesselName: 'SS New' };

      const patch = diffService.generatePatch(from, to);
      const summary = diffService.generateSummary(patch, from, to);

      expect(summary.categories.vessel).toBeGreaterThan(0);
    });

    it('should categorize pricing changes', () => {
      const from = { total: 1000, subtotal: 900 };
      const to = { total: 1500, subtotal: 1350 };

      const patch = diffService.generatePatch(from, to);
      const summary = diffService.generateSummary(patch, from, to);

      expect(summary.categories.pricing).toBeGreaterThanOrEqual(2);
    });

    it('should provide field-level change details', () => {
      const from = { total: 1000 };
      const to = { total: 1500 };

      const patch = diffService.generatePatch(from, to);
      const summary = diffService.generateSummary(patch, from, to);

      expect(summary.fields).toHaveLength(1);
      expect(summary.fields[0]).toMatchObject({
        field: 'total',
        oldValue: 1000,
        newValue: 1500,
        operation: 'replace',
      });
    });
  });

  describe('optimizePatch', () => {
    it('should merge remove + add into replace', () => {
      const patch: Operation[] = [
        { op: 'remove', path: '/title' },
        { op: 'add', path: '/title', value: 'New Title' },
      ];

      const optimized = diffService.optimizePatch(patch);

      expect(optimized).toHaveLength(1);
      expect(optimized[0]).toMatchObject({
        op: 'replace',
        path: '/title',
        value: 'New Title',
      });
    });

    it('should cancel out add + remove', () => {
      const patch: Operation[] = [
        { op: 'add', path: '/temp', value: 'temporary' },
        { op: 'remove', path: '/temp' },
      ];

      const optimized = diffService.optimizePatch(patch);

      expect(optimized).toHaveLength(0);
    });

    it('should keep latest operation for same path', () => {
      const patch: Operation[] = [
        { op: 'replace', path: '/title', value: 'First' },
        { op: 'replace', path: '/title', value: 'Second' },
        { op: 'replace', path: '/title', value: 'Final' },
      ];

      const optimized = diffService.optimizePatch(patch);

      expect(optimized).toHaveLength(1);
      expect(optimized[0].value).toBe('Final');
    });
  });

  describe('calculateSimilarity', () => {
    it('should return 1 for identical objects', () => {
      const obj = { title: 'Invoice', total: 1000 };

      const similarity = diffService.calculateSimilarity(obj, obj);

      expect(similarity).toBe(1);
    });

    it('should return < 1 for different objects', () => {
      const from = { title: 'Invoice', total: 1000 };
      const to = { title: 'Updated', total: 1500 };

      const similarity = diffService.calculateSimilarity(from, to);

      expect(similarity).toBeLessThan(1);
      expect(similarity).toBeGreaterThan(0);
    });

    it('should return lower score for more changes', () => {
      const base = { a: 1, b: 2, c: 3, d: 4, e: 5 };
      const oneChange = { a: 10, b: 2, c: 3, d: 4, e: 5 };
      const threeChanges = { a: 10, b: 20, c: 30, d: 4, e: 5 };

      const sim1 = diffService.calculateSimilarity(base, oneChange);
      const sim3 = diffService.calculateSimilarity(base, threeChanges);

      expect(sim1).toBeGreaterThan(sim3);
    });
  });
});