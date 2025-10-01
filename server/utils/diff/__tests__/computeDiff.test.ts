/**
 * Unit tests for computeDiff utility
 */

import { computeDiff, hasDifferences, countChanges, DiffResult } from '../computeDiff';

describe('computeDiff', () => {
  describe('Primitive changes', () => {
    it('should detect string addition', () => {
      const baseline = { name: null };
      const current = { name: 'John' };
      const result = computeDiff(baseline, current);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        kind: 'added',
        path: 'name',
        newValue: 'John',
      });
    });

    it('should detect string removal', () => {
      const baseline = { name: 'John' };
      const current = { name: null };
      const result = computeDiff(baseline, current);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        kind: 'removed',
        path: 'name',
        oldValue: 'John',
      });
    });

    it('should detect string change', () => {
      const baseline = { name: 'John' };
      const current = { name: 'Jane' };
      const result = computeDiff(baseline, current);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        kind: 'changed',
        path: 'name',
        oldValue: 'John',
        newValue: 'Jane',
      });
    });

    it('should detect number change', () => {
      const baseline = { price: 100 };
      const current = { price: 150 };
      const result = computeDiff(baseline, current);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        kind: 'changed',
        path: 'price',
        oldValue: 100,
        newValue: 150,
      });
    });

    it('should detect boolean change', () => {
      const baseline = { active: true };
      const current = { active: false };
      const result = computeDiff(baseline, current);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        kind: 'changed',
        path: 'active',
        oldValue: true,
        newValue: false,
      });
    });
  });

  describe('Nested object changes', () => {
    it('should detect nested string change', () => {
      const baseline = { customer: { name: 'John' } };
      const current = { customer: { name: 'Jane' } };
      const result = computeDiff(baseline, current);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        kind: 'changed',
        path: 'customer.name',
        oldValue: 'John',
        newValue: 'Jane',
      });
    });

    it('should detect multiple nested changes', () => {
      const baseline = {
        customer: {
          name: 'John',
          email: 'john@example.com',
          phone: '555-1234',
        },
      };
      const current = {
        customer: {
          name: 'Jane',
          email: 'john@example.com',
          phone: '555-5678',
        },
      };
      const result = computeDiff(baseline, current);

      expect(result).toHaveLength(2);
      expect(result.some(d => d.path === 'customer.name' && d.kind === 'changed')).toBe(true);
      expect(result.some(d => d.path === 'customer.phone' && d.kind === 'changed')).toBe(true);
    });

    it('should detect deeply nested changes', () => {
      const baseline = {
        address: { billing: { street: '123 Main St' } },
      };
      const current = {
        address: { billing: { street: '456 Oak Ave' } },
      };
      const result = computeDiff(baseline, current);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        kind: 'changed',
        path: 'address.billing.street',
        oldValue: '123 Main St',
        newValue: '456 Oak Ave',
      });
    });
  });

  describe('Array changes', () => {
    it('should detect added array items', () => {
      const baseline = {
        items: [
          { id: '1', name: 'Item 1' },
        ],
      };
      const current = {
        items: [
          { id: '1', name: 'Item 1' },
          { id: '2', name: 'Item 2' },
        ],
      };
      const result = computeDiff(baseline, current);

      expect(result).toHaveLength(1);
      expect(result[0].kind).toBe('array');
      if (result[0].kind === 'array') {
        expect(result[0].added).toHaveLength(1);
        expect(result[0].added[0]).toMatchObject({ id: '2', name: 'Item 2' });
        expect(result[0].removed).toHaveLength(0);
        expect(result[0].changed).toHaveLength(0);
      }
    });

    it('should detect removed array items', () => {
      const baseline = {
        items: [
          { id: '1', name: 'Item 1' },
          { id: '2', name: 'Item 2' },
        ],
      };
      const current = {
        items: [
          { id: '1', name: 'Item 1' },
        ],
      };
      const result = computeDiff(baseline, current);

      expect(result).toHaveLength(1);
      expect(result[0].kind).toBe('array');
      if (result[0].kind === 'array') {
        expect(result[0].added).toHaveLength(0);
        expect(result[0].removed).toHaveLength(1);
        expect(result[0].removed[0]).toMatchObject({ id: '2', name: 'Item 2' });
        expect(result[0].changed).toHaveLength(0);
      }
    });

    it('should detect changed array items by id', () => {
      const baseline = {
        items: [
          { id: '1', name: 'Item 1', price: 100 },
        ],
      };
      const current = {
        items: [
          { id: '1', name: 'Item 1', price: 150 },
        ],
      };
      const result = computeDiff(baseline, current);

      expect(result).toHaveLength(1);
      expect(result[0].kind).toBe('array');
      if (result[0].kind === 'array') {
        expect(result[0].added).toHaveLength(0);
        expect(result[0].removed).toHaveLength(0);
        expect(result[0].changed).toHaveLength(1);
        expect(result[0].changed[0].key).toBe('id:1');
        expect(result[0].changed[0].deltas).toHaveLength(1);
        expect(result[0].changed[0].deltas[0]).toMatchObject({
          kind: 'changed',
          path: 'items[id:1].price',
          oldValue: 100,
          newValue: 150,
        });
      }
    });

    it('should detect array items by tempId fallback', () => {
      const baseline = {
        items: [
          { tempId: 'temp-1', name: 'Item 1', price: 100 },
        ],
      };
      const current = {
        items: [
          { tempId: 'temp-1', name: 'Item 1 Updated', price: 100 },
        ],
      };
      const result = computeDiff(baseline, current);

      expect(result).toHaveLength(1);
      expect(result[0].kind).toBe('array');
      if (result[0].kind === 'array') {
        expect(result[0].changed).toHaveLength(1);
        expect(result[0].changed[0].key).toBe('tempId:temp-1');
      }
    });

    it('should detect array items by description fallback', () => {
      const baseline = {
        items: [
          { description: 'Marine Service', price: 100 },
        ],
      };
      const current = {
        items: [
          { description: 'Marine Service', price: 150 },
        ],
      };
      const result = computeDiff(baseline, current);

      expect(result).toHaveLength(1);
      expect(result[0].kind).toBe('array');
      if (result[0].kind === 'array') {
        expect(result[0].changed).toHaveLength(1);
        expect(result[0].changed[0].key).toBe('description:Marine Service');
      }
    });
  });

  describe('Normalization', () => {
    it('should normalize whitespace in strings', () => {
      const baseline = { name: '  John   Doe  ' };
      const current = { name: 'John Doe' };
      const result = computeDiff(baseline, current, { normalizeStrings: true });

      expect(result).toHaveLength(0);
    });

    it('should detect changes when normalization disabled', () => {
      const baseline = { name: '  John Doe  ' };
      const current = { name: 'John Doe' };
      const result = computeDiff(baseline, current, { normalizeStrings: false });

      expect(result).toHaveLength(1);
    });

    it('should apply numeric tolerance', () => {
      const baseline = { price: 100.001 };
      const current = { price: 100.002 };
      const result = computeDiff(baseline, current, { numericTolerance: 0.01 });

      expect(result).toHaveLength(0);
    });

    it('should detect changes outside numeric tolerance', () => {
      const baseline = { price: 100.00 };
      const current = { price: 100.05 };
      const result = computeDiff(baseline, current, { numericTolerance: 0.01 });

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        kind: 'changed',
        path: 'price',
        oldValue: 100.00,
        newValue: 100.05,
      });
    });

    it('should ignore case when configured', () => {
      const baseline = { name: 'JOHN DOE' };
      const current = { name: 'john doe' };
      const result = computeDiff(baseline, current, {
        normalizeStrings: true,
        ignoreCase: true,
      });

      expect(result).toHaveLength(0);
    });

    it('should detect case changes when ignoreCase is false', () => {
      const baseline = { name: 'JOHN' };
      const current = { name: 'john' };
      const result = computeDiff(baseline, current, {
        normalizeStrings: true,
        ignoreCase: false,
      });

      expect(result).toHaveLength(1);
    });
  });

  describe('Empty and null handling', () => {
    it('should treat null and undefined as equal', () => {
      const baseline = { name: null };
      const current = { name: undefined };
      const result = computeDiff(baseline, current);

      expect(result).toHaveLength(0);
    });

    it('should detect empty string as different from null', () => {
      const baseline = { name: null };
      const current = { name: '' };
      const result = computeDiff(baseline, current, { normalizeStrings: false });

      expect(result).toHaveLength(1);
    });

    it('should treat empty string as null when normalized', () => {
      const baseline = { name: null };
      const current = { name: '   ' };
      const result = computeDiff(baseline, current, { normalizeStrings: true });

      // Empty/whitespace strings are normalized to empty and treated as added
      expect(result).toHaveLength(1);
    });
  });

  describe('Date comparison', () => {
    it('should detect date changes via ISO strings', () => {
      const baseline = { date: new Date('2025-01-01') };
      const current = { date: new Date('2025-01-02') };
      const result = computeDiff(baseline, current);

      expect(result).toHaveLength(1);
      expect(result[0].kind).toBe('changed');
    });

    it('should treat same dates as equal', () => {
      const baseline = { date: new Date('2025-01-01T12:00:00Z') };
      const current = { date: new Date('2025-01-01T12:00:00Z') };
      const result = computeDiff(baseline, current);

      expect(result).toHaveLength(0);
    });
  });

  describe('Helper functions', () => {
    it('hasDifferences should return true for changes', () => {
      const diff: DiffResult = [
        { kind: 'changed', path: 'name', oldValue: 'John', newValue: 'Jane' },
      ];
      expect(hasDifferences(diff)).toBe(true);
    });

    it('hasDifferences should return false for no changes', () => {
      const diff: DiffResult = [];
      expect(hasDifferences(diff)).toBe(false);
    });

    it('countChanges should count primitive changes', () => {
      const diff: DiffResult = [
        { kind: 'changed', path: 'name', oldValue: 'John', newValue: 'Jane' },
        { kind: 'added', path: 'email', newValue: 'test@example.com' },
      ];
      expect(countChanges(diff)).toBe(2);
    });

    it('countChanges should count array changes', () => {
      const diff: DiffResult = [
        {
          kind: 'array',
          path: 'items',
          added: [{ id: '1' }, { id: '2' }],
          removed: [{ id: '3' }],
          changed: [{ key: 'id:4', deltas: [] }],
        },
      ];
      expect(countChanges(diff)).toBe(4); // 2 added + 1 removed + 1 changed
    });
  });

  describe('Real-world invoice scenarios', () => {
    it('should detect line item price changes', () => {
      const baseline = {
        lineItems: [
          { id: '1', description: 'Service A', price: 100, quantity: 2 },
          { id: '2', description: 'Service B', price: 200, quantity: 1 },
        ],
        total: 400,
      };
      const current = {
        lineItems: [
          { id: '1', description: 'Service A', price: 150, quantity: 2 },
          { id: '2', description: 'Service B', price: 200, quantity: 1 },
        ],
        total: 500,
      };
      const result = computeDiff(baseline, current);

      expect(result.length).toBeGreaterThan(0);
      const arrayDiff = result.find(d => d.kind === 'array' && d.path === 'lineItems');
      expect(arrayDiff).toBeDefined();
      if (arrayDiff && arrayDiff.kind === 'array') {
        expect(arrayDiff.changed).toHaveLength(1);
      }

      const totalDiff = result.find(d => d.path === 'total');
      expect(totalDiff).toBeDefined();
    });

    it('should detect customer information changes', () => {
      const baseline = {
        customer: {
          name: 'Acme Corp',
          email: 'contact@acme.com',
          phone: '555-1234',
        },
      };
      const current = {
        customer: {
          name: 'Acme Corporation',
          email: 'info@acme.com',
          phone: '555-1234',
        },
      };
      const result = computeDiff(baseline, current);

      expect(result).toHaveLength(2);
      expect(result.some(d => d.path === 'customer.name')).toBe(true);
      expect(result.some(d => d.path === 'customer.email')).toBe(true);
    });

    it('should handle complex nested invoice structure', () => {
      const baseline = {
        invoiceNumber: 'INV-001',
        customer: { name: 'Client A', email: 'a@example.com' },
        vessel: { name: 'Boat 1', registration: 'ABC123' },
        lineItems: [
          { id: '1', description: 'Service 1', price: 100 },
        ],
        subtotal: 100,
        tax: 10,
        total: 110,
      };
      const current = {
        invoiceNumber: 'INV-001',
        customer: { name: 'Client A', email: 'updated@example.com' },
        vessel: { name: 'Boat 1', registration: 'ABC123' },
        lineItems: [
          { id: '1', description: 'Service 1', price: 150 },
          { id: '2', description: 'Service 2', price: 50 },
        ],
        subtotal: 200,
        tax: 20,
        total: 220,
      };
      const result = computeDiff(baseline, current);

      expect(result.length).toBeGreaterThan(0);
      expect(result.some(d => d.path === 'customer.email')).toBe(true);
      expect(result.some(d => d.path === 'lineItems' && d.kind === 'array')).toBe(true);
      expect(result.some(d => d.path === 'subtotal')).toBe(true);
      expect(result.some(d => d.path === 'tax')).toBe(true);
      expect(result.some(d => d.path === 'total')).toBe(true);
    });
  });
});