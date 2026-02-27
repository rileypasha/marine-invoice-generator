import { GoogleGenerativeAI } from '@google/generative-ai';
import { logger } from '../utils/logger';

const VALID_JOB_TYPES = [
  'Agent Services',
  'Car Rental',
  'Clearance Fee',
  'Consulting Services',
  'Crew Placement',
  'Fueling Services',
  'Good Stew',
  'Manual Entry',
  'Pilotage',
  'Provisioning Services',
  'Shipping Services',
  'Trash Removal',
];

const VALID_ITEM_TYPES = ['Labor', 'Material', 'Subcontractor'];

const PARSE_PDF_PROMPT = `You are a marine invoice data extraction specialist. Analyze this vendor PDF invoice and extract structured data.

Return ONLY valid JSON (no markdown, no code fences) matching this exact schema:

{
  "vessel": {
    "name": "<vessel name or empty string>",
    "weight": "<weight/tonnage as string or empty string>",
    "beam": "<beam measurement as string or empty string>"
  },
  "customer": {
    "customerName": "<vendor/company name>",
    "customerEmail": "<email or empty string>",
    "customerPhone": "<phone or empty string>",
    "customerAddress": "<full address or empty string>",
    "estimatorName": "",
    "contactName": "<contact person name or empty string>"
  },
  "services": [
    {
      "description": "<line item description>",
      "quantity": <number, default 1>,
      "cost": <unit price/cost as number>,
      "total": <line total as number>,
      "jobType": "<MUST be one of: Agent Services, Car Rental, Clearance Fee, Consulting Services, Crew Placement, Fueling Services, Good Stew, Manual Entry, Pilotage, Provisioning Services, Shipping Services, Trash Removal>",
      "itemType": "<Material, Labor, or Subcontractor>",
      "laborHours": <estimated hours or 0>,
      "otHours": 0,
      "taxStatus": "<Taxable or Non-Taxable>",
      "markupType": "No Markup",
      "markupRate": 0
    }
  ],
  "notes": "<any additional notes, PO numbers, payment terms, due dates>",
  "metadata": {
    "title": "<invoice number or title>",
    "taxRate": <tax rate as decimal e.g. 0.0775 for 7.75%, or 0 if unknown>
  }
}

Rules:
- Extract ALL line items from the invoice
- If a field cannot be determined, use empty string for strings, 0 for numbers
- For quantities, default to 1 if not specified
- The "total" for each service should be quantity * cost
- Include any tax rate found on the invoice in metadata.taxRate as a decimal (not percentage)
- Put PO numbers, payment terms, due dates, and special instructions in the "notes" field
- The "title" in metadata should be the vendor invoice number if present
- For jobType: most vendor invoice line items should be "Manual Entry". Only use other types if the description clearly matches (e.g. "fuel" → "Fueling Services", "shipping" → "Shipping Services", "consulting" → "Consulting Services", "trash" → "Trash Removal", "pilot" → "Pilotage", "clearance" → "Clearance Fee")
- For itemType: categorize as "Material" for physical goods/parts/supplies, "Labor" for labor/work hours, or "Subcontractor" for subcontracted services. Default to "Material" if unclear`;

export interface ParsedInvoiceResult {
  success: boolean;
  data?: any;
  error?: string;
}

export async function parsePdfWithGemini(base64Data: string, mimeType: string): Promise<ParsedInvoiceResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { success: false, error: 'GEMINI_API_KEY is not configured' };
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    // Strip the data URL prefix if present (e.g., "data:application/pdf;base64,")
    const rawBase64 = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;

    const result = await model.generateContent([
      {
        inlineData: {
          mimeType: mimeType || 'application/pdf',
          data: rawBase64,
        },
      },
      { text: PARSE_PDF_PROMPT },
    ]);

    const responseText = result.response.text();

    // Clean up response — Gemini sometimes wraps in markdown code fences
    let jsonText = responseText.trim();
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.slice(7);
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.slice(3);
    }
    if (jsonText.endsWith('```')) {
      jsonText = jsonText.slice(0, -3);
    }
    jsonText = jsonText.trim();

    const parsed = JSON.parse(jsonText);

    // Validate required structure
    if (!parsed.vessel || !parsed.customer || !Array.isArray(parsed.services)) {
      return { success: false, error: 'AI returned data missing required fields (vessel, customer, services)' };
    }

    // Normalize: ensure each service has an id, correct types, and valid dropdown values
    parsed.services = parsed.services.map((s: any, i: number) => {
      const quantity = Number(s.quantity) || 1;
      const rawCost = Number(s.cost ?? s.rate ?? 0);
      const rawTotal = Number(s.total) || 0;

      // Derive unit cost: prefer total/quantity since Gemini sometimes
      // puts the line total in the cost field instead of the unit price
      let unitCost: number;
      if (rawTotal > 0 && quantity > 0) {
        unitCost = rawTotal / quantity;
      } else {
        unitCost = rawCost;
      }
      const total = rawTotal || (quantity * unitCost);

      // Validate jobType against allowed dropdown values, default to "Manual Entry"
      const jobType = VALID_JOB_TYPES.includes(s.jobType) ? s.jobType : 'Manual Entry';

      // Validate itemType against allowed values, default to "Material"
      const itemType = VALID_ITEM_TYPES.includes(s.itemType) ? s.itemType : 'Material';

      return {
        id: `pdf-import-${Date.now()}-${i}`,
        description: s.description || '',
        quantity,
        quantityDisplay: String(quantity),
        rate: unitCost,
        total,
        jobType,
        itemType,
        laborHours: Number(s.laborHours) || 0,
        laborHoursInput: String(Number(s.laborHours) || 0),
        otHours: Number(s.otHours) || 0,
        otHoursInput: String(Number(s.otHours) || 0),
        manualCost: unitCost,
        manualCostInput: unitCost ? String(unitCost) : '',
        taxStatus: s.taxStatus === 'Non-Taxable' ? 'Non-Taxable' : 'Taxable',
        markupType: s.markupType || 'No Markup',
        markupRate: Number(s.markupRate) || 0,
      };
    });

    return { success: true, data: parsed };
  } catch (error: any) {
    logger.error('Gemini PDF parsing failed', {
      error: error.message,
      stack: error.stack,
    });

    if (error instanceof SyntaxError) {
      return { success: false, error: 'Failed to parse AI response as JSON. The PDF may not be a recognizable invoice.' };
    }

    // Return friendly error messages instead of raw API dumps
    const msg = error.message || '';
    if (msg.includes('429') || msg.includes('Too Many Requests') || msg.includes('quota')) {
      return { success: false, error: 'AI service rate limit reached. Please wait a minute and try again.' };
    }
    if (msg.includes('403') || msg.includes('API key')) {
      return { success: false, error: 'AI service authentication failed. Please check the Gemini API key configuration.' };
    }

    return { success: false, error: 'PDF parsing failed. Please try again or upload a different file.' };
  }
}
