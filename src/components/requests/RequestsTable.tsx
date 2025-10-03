import React, { useMemo, useCallback, useState, useEffect } from "react";
import { useNavigate } from 'react-router-dom';
import { DataTable } from "@/components/ui/data-table";
import { createInvoiceColumns } from "@/components/InvoiceTableColumns";
import { RequestSort } from "@/hooks/useRequestsQueryState";
import { useRequestsRowActionsStore } from "@/features/requests/state/rowActions.store";

// Column width definitions - use actual column IDs from InvoiceTableColumns
// Desktop widths - reduced left columns to give more space to right columns
const REQUESTS_COLS = [
  { id: 'select', w: '3%' },   // Checkbox column
  { id: 'invoice_number', w: '9%' }, // Request # column
  { id: 'customer', w: '9%' }, // Contact column
  { id: 'vessel', w: '8%' },  // Vessel column
  { id: 'amount', w: '6%' },   // Amount column
  { id: 'created_by', w: '8%' }, // Created by column
  { id: 'created_at', w: '11%' },  // Created at column
  { id: 'modified_by', w: '14%' }, // Modified by column (needs space for full names)
  { id: 'updated_at', w: '11%' }, // Last modified column
  { id: 'status', w: '20%' },   // Status column (needs space for "Change Requested")
  { id: 'actions', w: '4%' }   // Actions column
];

// Mobile-specific widths - all columns visible, horizontally scrollable
const REQUESTS_COLS_MOBILE = [
  { id: 'select', w: '5%' },     // Checkbox column
  { id: 'invoice_number', w: '15%' },    // Request # column
  { id: 'customer', w: '15%' },    // Contact column
  { id: 'vessel', w: '12%' },     // Vessel column
  { id: 'amount', w: '10%' },     // Amount column
  { id: 'created_by', w: '12%' },  // Created by column
  { id: 'created_at', w: '12%' },    // Created at column
  { id: 'modified_by', w: '12%' }, // Modified by column
  { id: 'updated_at', w: '12%' },  // Last modified column
  { id: 'status', w: '12%' },    // Status column
  { id: 'actions', w: '8%' }    // Actions column (three dots menu)
];

interface Invoice {
  id: string;
  invoice_number?: string;
  customer?: {
    company_name?: string;
    display_name?: string;
    contact_name?: string;
  };
  vessel?: {
    name?: string;
  };
  user?: {
    name?: string;
    email?: string;
  };
  userName?: string;
  modifiedByUserName?: string;
  total_amount?: number;
  invoice_date?: string;
  updated_at?: string;
  status?: 'requested' | 'change_requested' | 'approved';
}

interface RequestsTableProps {
  requests: Invoice[];
  sort?: RequestSort | null;
  onEdit?: (id: string) => void;
  onDelete?: (invoice: Invoice) => void;
  onBulkDelete?: (selectedRows: Invoice[]) => void;
  onBulkExport?: (selectedRows: Invoice[]) => void;
  onView?: (invoice: Invoice) => void;
  onPrint?: (invoice: Invoice) => void;
  title?: React.ReactNode;
}

export function RequestsTable({
  requests,
  sort,
  onEdit,
  onDelete,
  onBulkDelete,
  onBulkExport,
  onView,
  onPrint,
  title
}: RequestsTableProps) {
  const navigate = useNavigate();
  const openRowActions = useRequestsRowActionsStore((s) => s.openAt);

  // Proper responsive detection using React state
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    // Check on mount
    checkMobile();

    // Add resize listener
    window.addEventListener('resize', checkMobile);

    // Cleanup
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Memoized edit handler to prevent column recreation
  const handleEditWrapper = useCallback((invoice: any) => {
    if (onEdit) {
      onEdit(invoice.id);
    }
  }, [onEdit]);

  // Sort requests based on the sort prop
  const sortedRequests = useMemo(() => {
    if (!sort) return requests;

    return [...requests].sort((a, b) => {
      let aValue: any = a[sort.field as keyof Invoice];
      let bValue: any = b[sort.field as keyof Invoice];

      // Handle nested properties
      if (sort.field === 'customer.display_name') {
        aValue = a.customer?.display_name || a.customer?.company_name || '';
        bValue = b.customer?.display_name || b.customer?.company_name || '';
      } else if (sort.field === 'vessel.name') {
        aValue = a.vessel?.name || '';
        bValue = b.vessel?.name || '';
      }

      // Handle different data types
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        const comparison = aValue.toLowerCase().localeCompare(bValue.toLowerCase());
        return sort.direction === 'asc' ? comparison : -comparison;
      }

      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sort.direction === 'asc' ? aValue - bValue : bValue - aValue;
      }

      // Handle dates
      if (sort.field === 'invoice_date' || sort.field === 'updated_at') {
        const aDate = new Date(aValue || 0);
        const bDate = new Date(bValue || 0);
        return sort.direction === 'asc' ? aDate.getTime() - bDate.getTime() : bDate.getTime() - aDate.getTime();
      }

      // Default string comparison
      const aStr = String(aValue || '');
      const bStr = String(bValue || '');
      const comparison = aStr.toLowerCase().localeCompare(bStr.toLowerCase());
      return sort.direction === 'asc' ? comparison : -comparison;
    });
  }, [requests, sort]);

  // Create table columns with action handlers
  const columns = useMemo(() => createInvoiceColumns({
    onView,
    onEdit: onEdit ? handleEditWrapper : undefined,
    onPrint,
    onDelete,
    openRowActions
  }), [onView, onEdit, handleEditWrapper, onPrint, onDelete, openRowActions]);

  // Select column widths based on device
  const columnWidths = isMobile ? REQUESTS_COLS_MOBILE : REQUESTS_COLS;

  return (
    <DataTable
      columns={columns}
      data={sortedRequests}
      onBulkDelete={onBulkDelete}
      onBulkExport={onBulkExport}
      title={title}
      colWidths={columnWidths}
    />
  )
}