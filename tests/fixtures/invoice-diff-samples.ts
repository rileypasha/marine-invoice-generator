/**
 * Test Data Fixtures for Invoice Diff Testing
 *
 * Provides baseline and modified invoice samples for comprehensive testing
 */

export interface InvoiceFixture {
  id: string;
  userId: string;
  invoiceNumber: string;
  title: string;
  status: 'requested' | 'change_requested' | 'approved';
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  vesselName: string;
  vesselWeight: number;
  vesselBeam: number;
  subtotal: number;
  taxAmount: number;
  total: number;
  grossProfit: number;
  profitPercent: number;
  notes?: string;
  data?: string;
}

/**
 * Baseline invoice - Clean state before any modifications
 */
export const baselineInvoice: InvoiceFixture = {
  id: 'baseline-001',
  userId: 'user-test-001',
  invoiceNumber: 'INV-2025-001',
  title: 'Marine Services Invoice',
  status: 'requested',
  customerName: 'ABC Shipping Co.',
  customerEmail: 'contact@abcshipping.com',
  customerPhone: '+1-555-0100',
  vesselName: 'SS Atlantic',
  vesselWeight: 5000,
  vesselBeam: 45,
  subtotal: 10000.00,
  taxAmount: 875.00,
  total: 10875.00,
  grossProfit: 2500.00,
  profitPercent: 33.33,
  notes: 'Standard maintenance and repair services.',
  data: JSON.stringify({
    lineItems: [
      {
        id: 'item-1',
        description: 'Hull Inspection',
        quantity: 1,
        cost: 2500.00,
        markupRate: 0.25,
        taxRate: 0.0875,
      },
      {
        id: 'item-2',
        description: 'Engine Maintenance',
        quantity: 1,
        cost: 5000.00,
        markupRate: 0.25,
        taxRate: 0.0875,
      },
      {
        id: 'item-3',
        description: 'Safety Equipment Check',
        quantity: 1,
        cost: 2500.00,
        markupRate: 0.25,
        taxRate: 0.0875,
      },
    ],
  }),
};

/**
 * Modified invoice with additions only
 */
export const invoiceWithAdditions: InvoiceFixture = {
  ...baselineInvoice,
  id: 'modified-additions-001',
  status: 'change_requested',
  title: 'Marine Services Invoice - Updated', // Added title suffix
  customerEmail: 'newcontact@abcshipping.com', // Changed email (addition in diff context)
  notes: 'Standard maintenance and repair services.\n\nAdditional notes: Customer requested express service.', // Added notes
  data: JSON.stringify({
    lineItems: [
      ...JSON.parse(baselineInvoice.data!).lineItems,
      {
        id: 'item-4',
        description: 'Emergency Response Fee',
        quantity: 1,
        cost: 1000.00,
        markupRate: 0.25,
        taxRate: 0.0875,
      },
    ],
  }),
  subtotal: 11250.00,
  taxAmount: 984.38,
  total: 12234.38,
};

/**
 * Modified invoice with removals only
 */
export const invoiceWithRemovals: InvoiceFixture = {
  ...baselineInvoice,
  id: 'modified-removals-001',
  status: 'change_requested',
  customerPhone: '', // Removed phone
  notes: undefined, // Removed notes
  data: JSON.stringify({
    lineItems: [
      // Removed item-3 (Safety Equipment Check)
      {
        id: 'item-1',
        description: 'Hull Inspection',
        quantity: 1,
        cost: 2500.00,
        markupRate: 0.25,
        taxRate: 0.0875,
      },
      {
        id: 'item-2',
        description: 'Engine Maintenance',
        quantity: 1,
        cost: 5000.00,
        markupRate: 0.25,
        taxRate: 0.0875,
      },
    ],
  }),
  subtotal: 7500.00,
  taxAmount: 656.25,
  total: 8156.25,
  grossProfit: 1875.00,
  profitPercent: 33.33,
};

/**
 * Modified invoice with changes (old→new)
 */
export const invoiceWithChanges: InvoiceFixture = {
  ...baselineInvoice,
  id: 'modified-changes-001',
  status: 'change_requested',
  customerName: 'XYZ Maritime Ltd.', // Changed from ABC Shipping Co.
  vesselName: 'SS Pacific', // Changed from SS Atlantic
  vesselWeight: 6500, // Changed from 5000
  vesselBeam: 50, // Changed from 45
  subtotal: 12500.00, // Changed from 10000.00
  taxAmount: 1093.75, // Changed from 875.00
  total: 13593.75, // Changed from 10875.00
  notes: 'Priority maintenance and urgent repair services.', // Changed text
  data: JSON.stringify({
    lineItems: [
      {
        id: 'item-1',
        description: 'Hull Inspection',
        quantity: 1,
        cost: 2500.00,
        markupRate: 0.25,
        taxRate: 0.0875,
      },
      {
        id: 'item-2',
        description: 'Engine Overhaul', // Changed from "Engine Maintenance"
        quantity: 1,
        cost: 7500.00, // Changed from 5000.00
        markupRate: 0.25,
        taxRate: 0.0875,
      },
      {
        id: 'item-3',
        description: 'Safety Equipment Check',
        quantity: 1,
        cost: 2500.00,
        markupRate: 0.25,
        taxRate: 0.0875,
      },
    ],
  }),
};

/**
 * Modified invoice with mixed changes (add/remove/modify)
 */
export const invoiceWithMixedChanges: InvoiceFixture = {
  ...baselineInvoice,
  id: 'modified-mixed-001',
  status: 'change_requested',
  title: 'Comprehensive Marine Services', // Changed
  customerName: 'Global Shipping Inc.', // Changed
  customerEmail: 'ops@globalshipping.com', // Changed
  customerPhone: '', // Removed
  vesselName: 'MV Neptune', // Changed
  vesselWeight: 7200, // Changed
  data: JSON.stringify({
    lineItems: [
      // item-1 modified
      {
        id: 'item-1',
        description: 'Comprehensive Hull Inspection',
        quantity: 1,
        cost: 3500.00, // Changed
        markupRate: 0.25,
        taxRate: 0.0875,
      },
      // item-2 removed
      // item-3 kept same
      {
        id: 'item-3',
        description: 'Safety Equipment Check',
        quantity: 1,
        cost: 2500.00,
        markupRate: 0.25,
        taxRate: 0.0875,
      },
      // item-4 added
      {
        id: 'item-4',
        description: 'Navigation Systems Upgrade',
        quantity: 1,
        cost: 8000.00,
        markupRate: 0.25,
        taxRate: 0.0875,
      },
    ],
  }),
  subtotal: 14000.00,
  taxAmount: 1225.00,
  total: 15225.00,
  notes: 'Upgraded service package with navigation improvements.',
  grossProfit: 3500.00,
  profitPercent: 33.33,
};

/**
 * Invoice with line item quantity and price changes
 */
export const invoiceWithLineItemChanges: InvoiceFixture = {
  ...baselineInvoice,
  id: 'modified-lineitems-001',
  status: 'change_requested',
  data: JSON.stringify({
    lineItems: [
      {
        id: 'item-1',
        description: 'Hull Inspection',
        quantity: 2, // Changed from 1
        cost: 2500.00,
        markupRate: 0.25,
        taxRate: 0.0875,
      },
      {
        id: 'item-2',
        description: 'Engine Maintenance',
        quantity: 1,
        cost: 7500.00, // Changed from 5000.00
        markupRate: 0.25,
        taxRate: 0.0875,
      },
      {
        id: 'item-3',
        description: 'Safety Equipment Check - Updated', // Changed description
        quantity: 1,
        cost: 3000.00, // Changed from 2500.00
        markupRate: 0.25,
        taxRate: 0.0875,
      },
    ],
  }),
  subtotal: 15000.00,
  taxAmount: 1312.50,
  total: 16312.50,
  grossProfit: 3750.00,
  profitPercent: 33.33,
};

/**
 * Approved invoice with attachment (post-approval state)
 */
export const approvedInvoiceWithAttachment: InvoiceFixture = {
  ...invoiceWithChanges,
  id: 'approved-001',
  status: 'approved',
};

/**
 * Helper function to create minimal invoice for testing
 */
export function createMinimalInvoice(overrides: Partial<InvoiceFixture> = {}): InvoiceFixture {
  return {
    id: 'minimal-001',
    userId: 'user-test-001',
    invoiceNumber: 'INV-MIN-001',
    title: 'Test Invoice',
    status: 'requested',
    customerName: 'Test Customer',
    customerEmail: 'test@example.com',
    customerPhone: '+1-555-0000',
    vesselName: 'Test Vessel',
    vesselWeight: 1000,
    vesselBeam: 20,
    subtotal: 1000.00,
    taxAmount: 87.50,
    total: 1087.50,
    grossProfit: 250.00,
    profitPercent: 33.33,
    ...overrides,
  };
}

/**
 * Helper function to clone and modify invoice
 */
export function cloneInvoice(
  base: InvoiceFixture,
  modifications: Partial<InvoiceFixture>
): InvoiceFixture {
  return {
    ...base,
    ...modifications,
  };
}

/**
 * Export all fixtures as a collection
 */
export const invoiceFixtures = {
  baseline: baselineInvoice,
  withAdditions: invoiceWithAdditions,
  withRemovals: invoiceWithRemovals,
  withChanges: invoiceWithChanges,
  withMixedChanges: invoiceWithMixedChanges,
  withLineItemChanges: invoiceWithLineItemChanges,
  approved: approvedInvoiceWithAttachment,
};