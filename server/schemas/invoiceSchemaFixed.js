const { z } = require('zod');

// Simple number coercion that handles empty strings
const numberOrNull = z.union([
  z.number(),
  z.string().transform((val) => {
    if (val === '' || val === null || val === undefined) return null;
    const cleaned = String(val).replace(/[$,]/g, '').trim();
    if (cleaned === '') return null;
    const num = parseFloat(cleaned);
    return isNaN(num) ? null : num;
  }),
  z.null(),
  z.undefined()
]).nullable().optional();

// Line item schema
const LineItemSchema = z.object({
  id: z.union([z.string(), z.number()]).transform(val => String(val)),
  jobType: z.string().optional().default(''),
  itemType: z.string().optional().default(''),
  manualCost: numberOrNull,
  laborHours: numberOrNull,
  otHours: numberOrNull,
  description: z.string().optional().default(''),
  cost: numberOrNull,
  laborCost: z.number().optional(),
  materialCost: z.number().optional(),
  subcontractorCost: z.number().optional()
}).passthrough(); // Allow extra fields

// Scope schema
const ScopeSchema = z.object({
  markupRate: z.union([
    z.number(),
    z.string().transform((val) => {
      if (!val || val === '') return 0;
      const cleaned = String(val).replace('%', '').trim();
      if (cleaned === '') return 0;
      const num = parseFloat(cleaned);
      if (num > 10) return num / 100; // Convert percentage to decimal
      return isNaN(num) ? 0 : num;
    })
  ]).optional().default(0),
  isTaxable: z.boolean().optional().default(false),
  lineItems: z.array(LineItemSchema).optional().default([])
}).passthrough();

// Vessel schema
const VesselSchema = z.object({
  name: z.string().nullable().optional(),
  weight: numberOrNull,
  beam: numberOrNull
}).passthrough();

// Customer schema  
const CustomerSchema = z.object({
  customerName: z.string().nullable().optional(),
  customerEmail: z.string().nullable().optional(),
  customerPhone: z.string().nullable().optional()
}).passthrough();

// Data schema
const DataSchema = z.object({
  vessel: VesselSchema.optional(),
  customer: CustomerSchema.optional(),
  scope: ScopeSchema.optional(),
  laborRate: z.number().optional().default(85),
  otRate: z.number().optional().default(127.5)
}).passthrough();

// Main invoice schema
const InvoiceSaveInputSchema = z.object({
  title: z.string().optional().default('Untitled Invoice'),
  data: DataSchema.optional().default({}),
  metadata: z.record(z.any()).optional().default({})
}).passthrough();

module.exports = {
  InvoiceSaveInputSchema,
  LineItemSchema,
  ScopeSchema
};