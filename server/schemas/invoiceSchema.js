const { z } = require('zod');

// Helper to coerce empty strings to null
const coerceEmptyToNull = z.preprocess(
  (val) => {
    // Handle various empty values
    if (val === '' || val === null || val === undefined) {
      return null;
    }
    // Handle string numbers with formatting
    if (typeof val === 'string') {
      // Remove common formatting characters
      const cleaned = val.replace(/[$,]/g, '').trim();
      if (cleaned === '') return null;
      const num = parseFloat(cleaned);
      return isNaN(num) ? null : num;
    }
    return val;
  },
  z.number().nullable()
);

// Line item schema with full coercion
const LineItemSchema = z.object({
  id: z.union([z.string(), z.number()]).transform(val => String(val)),
  jobType: z.string().optional().default(''),
  itemType: z.string().optional().default(''),
  manualCost: coerceEmptyToNull.optional(),
  laborHours: coerceEmptyToNull.optional(),
  otHours: coerceEmptyToNull.optional(),
  description: z.string().optional().default(''),
  cost: coerceEmptyToNull.optional(),
  // Computed fields (ignored from input, server-calculated)
  laborCost: z.number().optional(),
  materialCost: z.number().optional(),
  subcontractorCost: z.number().optional()
});

// Scope with markup and tax settings
const ScopeSchema = z.object({
  markupRate: z.preprocess(
    (val) => {
      if (val === '' || val === null || val === undefined) return 0;
      if (typeof val === 'string') {
        // Handle "2.5" or "250%" formats
        const cleaned = val.replace('%', '').trim();
        if (cleaned === '') return 0;
        const num = parseFloat(cleaned);
        // If it's a percentage > 10, convert to decimal (250 -> 2.5)
        if (num > 10) return num / 100;
        return isNaN(num) ? 0 : num;
      }
      return typeof val === 'number' ? val : 0;
    },
    z.number().min(0).max(10).default(0)
  ),
  isTaxable: z.boolean().default(false),
  lineItems: z.array(LineItemSchema).default([])
});

// Main invoice save payload
const InvoiceSaveInputSchema = z.object({
  title: z.string().optional().default('Untitled Invoice'),
  data: z.object({
    vessel: z.object({
      name: z.string().optional().nullable(),
      weight: coerceEmptyToNull.optional(),
      beam: coerceEmptyToNull.optional()
    }).optional().default({ name: null, weight: null, beam: null }),
    customer: z.object({
      customerName: z.string().optional().nullable(),
      customerEmail: z.string().optional().nullable(),
      customerPhone: z.string().optional().nullable()
    }).optional().default({ customerName: null, customerEmail: null, customerPhone: null }),
    scope: ScopeSchema.optional().default({ markupRate: 0, isTaxable: false, lineItems: [] }),
    // Optional labor rates (from saved invoice or defaults)
    laborRate: z.number().optional().default(85),
    otRate: z.number().optional().default(127.5)
  }).optional().default({}),
  metadata: z.record(z.any()).optional().default({})
});

module.exports = {
  InvoiceSaveInputSchema,
  LineItemSchema,
  ScopeSchema
};