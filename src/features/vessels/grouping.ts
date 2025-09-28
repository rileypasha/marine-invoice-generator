export interface BucketResult {
  key: string;
  label: string;
}

/**
 * Categorize vessel by size based on length in feet
 * Size ranges: ≤99, 100-149, 150-199, ≥200
 */
export function bucketBySize(length_ft?: number): BucketResult {
  const len = length_ft || 0;

  if (len <= 99) {
    return { key: 'small', label: 'Small (≤99 ft)' };
  }
  if (len <= 149) {
    return { key: 'medium', label: 'Medium (100–149 ft)' };
  }
  if (len <= 199) {
    return { key: 'large', label: 'Large (150–199 ft)' };
  }
  return { key: 'mega', label: 'Mega (≥200 ft)' };
}

/**
 * Categorize vessel by activity level based on invoice count
 * Activity levels: 0, 1-2, 3-5, ≥6
 */
export function bucketByActivity(invoice_count?: number): BucketResult {
  const count = invoice_count || 0;

  if (count === 0) {
    return { key: 'inactive', label: 'Inactive (0 invoices)' };
  }
  if (count <= 2) {
    return { key: 'low', label: 'Low (1–2)' };
  }
  if (count <= 5) {
    return { key: 'medium', label: 'Medium (3–5)' };
  }
  return { key: 'high', label: 'High (6+)' };
}

/**
 * Format currency values for group summaries
 */
export function formatCurrency(amount?: number): string {
  if (!amount) return '$0';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Format measurement values for group summaries
 */
export function formatMeasurement(value?: number, unit: string = ''): string {
  if (!value) return '0';
  const rounded = Math.round(value);
  return unit ? `${rounded} ${unit}` : rounded.toString();
}

/**
 * Format group subtotal display for Airtable-style headers
 */
export function formatGroupSubtotal(
  vesselsCount: number,
  totalRevenue?: number,
  avgLength?: number,
  avgWeight?: number
): string {
  const parts = [`${vesselsCount} vessel${vesselsCount !== 1 ? 's' : ''}`];

  if (totalRevenue) {
    parts.push(`Total: ${formatCurrency(totalRevenue)}`);
  }

  if (avgLength) {
    parts.push(`Avg: ${formatMeasurement(avgLength, 'ft')}`);
  }

  if (avgWeight) {
    parts.push(`${formatMeasurement(avgWeight, 'tons')}`);
  }

  return parts.join('  •  ');
}

/**
 * Sum array of values, handling null/undefined
 */
export function sumValues(values: (number | null | undefined)[]): number {
  return values.reduce((sum, val) => sum + (val || 0), 0);
}

/**
 * Calculate average of array of values, handling null/undefined
 */
export function avgValues(values: (number | null | undefined)[]): number {
  const cleanValues = values.filter((val): val is number => val != null && val > 0);
  if (cleanValues.length === 0) return 0;
  return cleanValues.reduce((sum, val) => sum + val, 0) / cleanValues.length;
}

/**
 * Get sort order for size buckets
 */
export function getSizeBucketOrder(bucketKey: string): number {
  const order = { small: 1, medium: 2, large: 3, mega: 4 };
  return order[bucketKey as keyof typeof order] || 999;
}

/**
 * Get sort order for activity buckets
 */
export function getActivityBucketOrder(bucketKey: string): number {
  const order = { inactive: 1, low: 2, medium: 3, high: 4 };
  return order[bucketKey as keyof typeof order] || 999;
}