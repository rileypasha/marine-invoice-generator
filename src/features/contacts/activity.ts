/**
 * Contact activity utilities and monthly metrics computation
 */

export interface MonthlyMetrics {
  monthlyInvoices: number;
  monthlyAmount: number;
}

export interface Invoice {
  total?: number;
  createdAt: string | Date;
}

/**
 * Compute monthly metrics for a contact given their invoices and selected month
 */
export function computeMonthlyMetrics(
  invoices: Invoice[],
  selectedMonth?: Date
): MonthlyMetrics {
  if (!invoices || invoices.length === 0) {
    return { monthlyInvoices: 0, monthlyAmount: 0 };
  }

  // Use current month if no specific month selected
  const targetMonth = selectedMonth || new Date();
  const monthStart = new Date(targetMonth.getFullYear(), targetMonth.getMonth(), 1);
  const monthEnd = new Date(targetMonth.getFullYear(), targetMonth.getMonth() + 1, 0);

  const monthlyInvoices = invoices.filter(invoice => {
    const invoiceDate = new Date(invoice.createdAt);
    return invoiceDate >= monthStart && invoiceDate <= monthEnd;
  });

  const monthlyAmount = monthlyInvoices.reduce(
    (sum, invoice) => sum + (invoice.total || 0),
    0
  );

  return {
    monthlyInvoices: monthlyInvoices.length,
    monthlyAmount
  };
}

/**
 * Format currency amount for display
 */
export function fmtCurrency(amount: number): string {
  return amount.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD'
  });
}

/**
 * Determine contact activity status based on invoice counts
 */
export function getContactStatus(totalInvoices: number, monthlyInvoices: number): 'active' | 'inactive' {
  // Consider active if they have any invoices (total or monthly)
  return (totalInvoices > 0 || monthlyInvoices > 0) ? 'active' : 'inactive';
}

/**
 * Activity bucket for grouping contacts
 */
export function bucketByActivity(invoiceCount?: number): { label: string; order: number } {
  const hasInvoices = (invoiceCount || 0) > 0;
  return hasInvoices
    ? { label: 'Active', order: 1 }
    : { label: 'Inactive', order: 2 };
}

/**
 * Monthly activity bucket for grouping contacts by monthly activity
 */
export function bucketByMonthlyActivity(monthlyInvoiceCount?: number): { label: string; order: number } {
  const hasMonthlyInvoices = (monthlyInvoiceCount || 0) > 0;
  return hasMonthlyInvoices
    ? { label: 'Active', order: 1 }
    : { label: 'Inactive', order: 2 };
}

/**
 * Format group subtotal for activity groups
 */
export function formatActivityGroupSubtotal(
  count: number,
  totalRevenue: number,
  monthlyRevenue: number
): string {
  const parts = [
    `${count} contact${count !== 1 ? 's' : ''}`,
    `${fmtCurrency(totalRevenue)} total`,
  ];

  if (monthlyRevenue > 0) {
    parts.push(`${fmtCurrency(monthlyRevenue)} this month`);
  }

  return parts.join(' • ');
}