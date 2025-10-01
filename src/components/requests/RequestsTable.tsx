import React, { useMemo, useCallback } from "react";
import { useNavigate } from 'react-router-dom';
import { DataTable } from "@/components/ui/data-table";
import { PaginatedPrintTable } from "@/components/ui/paginated-print-table";
import { createInvoiceColumns } from "@/components/InvoiceTableColumns";
import { RequestSort } from "@/hooks/useRequestsQueryState";
import { useRequestsRowActionsStore } from "@/features/requests/state/rowActions.store";

// Column width definitions for consistent spacing across all tables
const REQUESTS_COLS = [
  { id: 'select', w: '3%' },   // Checkbox column
  { id: 'request', w: '14%' }, // Request # column
  { id: 'contact', w: '14%' }, // Contact column
  { id: 'vessel', w: '14%' },  // Vessel column
  { id: 'amount', w: '9%' },   // Amount column (left-aligned)
  { id: 'createdBy', w: '11%' }, // Created by column
  { id: 'created', w: '9%' },  // Created at column (right-aligned)
  { id: 'modifiedBy', w: '11%' }, // Modified by column
  { id: 'modified', w: '9%' }, // Last modified column (right-aligned)
  { id: 'status', w: '9%' },   // Status column (centered)
  { id: 'actions', w: '6%' }   // Actions column
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

  // Create print columns (simplified for printing)
  const printColumns = [
    {
      key: 'invoice_number',
      header: 'Invoice #',
      render: (request: Invoice) => request.invoice_number || `#${request.id}`,
      width: 'w-24'
    },
    {
      key: 'customer',
      header: 'Contact',
      render: (request: Invoice) => request.customer?.display_name || request.customer?.company_name || '-',
      width: 'w-32'
    },
    {
      key: 'vessel',
      header: 'Vessel',
      render: (request: Invoice) => request.vessel?.name || '-',
      width: 'w-28'
    },
    {
      key: 'total_amount',
      header: 'Amount',
      render: (request: Invoice) => {
        const amount = request.total_amount || 0;
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD'
        }).format(amount);
      },
      width: 'w-24',
      className: 'text-right'
    },
    {
      key: 'created_by',
      header: 'Created By',
      render: (request: Invoice) => request?.user?.name || request?.userName || '-',
      width: 'w-28'
    },
    {
      key: 'invoice_date',
      header: 'Created At',
      render: (request: Invoice) => {
        if (!request.invoice_date) return '-';
        return new Date(request.invoice_date).toLocaleDateString();
      },
      width: 'w-28'
    },
    {
      key: 'modified_by',
      header: 'Modified By',
      render: (request: Invoice) => request?.modifiedByUserName || '-',
      width: 'w-28'
    },
    {
      key: 'status',
      header: 'Status',
      render: (request: Invoice) => {
        const statusMap = {
          requested: 'Requested',
          change_requested: 'Change Requested',
          approved: 'Approved'
        };
        return statusMap[request.status as keyof typeof statusMap] || 'Requested';
      },
      width: 'w-20'
    }
  ];

  return (
    <>
      {/* Screen-only interactive table with Airtable-style layout */}
      <div className="screen-only">
        <div>
          <div>
            <DataTable
              columns={columns}
              data={sortedRequests}
              onBulkDelete={onBulkDelete}
              onBulkExport={onBulkExport}
              title={title}
              colWidths={REQUESTS_COLS}
            />
          </div>
        </div>
      </div>

      {/* Print-only paginated table */}
      <PaginatedPrintTable
        columns={printColumns}
        rows={sortedRequests}
        approxRowsPerPage={26}
      />
    </>
  )
}