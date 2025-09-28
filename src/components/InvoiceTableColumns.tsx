"use client"

import * as React from "react"
import { ColumnDef } from "@tanstack/react-table"
import { Checkbox } from "@/components/ui/checkbox"
import { MoreHorizontal } from "lucide-react"

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
  total_amount?: number;
  invoice_date?: string;
  updated_at?: string;
  status?: 'saved' | 'draft' | 'submitted';
}

interface InvoiceTableActionsProps {
  onView?: (invoice: Invoice) => void;
  onEdit?: (invoice: Invoice) => void;
  onPrint?: (invoice: Invoice) => void;
  onDelete?: (invoice: Invoice) => void;
  openRowActions?: (args: {rowId: string|number; pos: {top: number; left: number}; handlers: any}) => void;
}

const formatDate = (dateString?: string) => {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleDateString();
};

const formatCurrency = (amount?: number) => {
  if (!amount) return '$0.00';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(amount);
};

const getStatusBadge = (status?: string) => {
  const statusConfig = {
    saved: {
      className: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
      label: 'Saved'
    },
    draft: {
      className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
      label: 'Draft'
    },
    submitted: {
      className: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
      label: 'Submitted'
    }
  };

  const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.draft;

  return (
    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${config.className}`}>
      {config.label}
    </span>
  );
};

export const createInvoiceColumns = (actions: InvoiceTableActionsProps): ColumnDef<Invoice>[] => [
  {
    id: "select",
    header: ({ table }) => (
      <Checkbox
        checked={
          table.getIsAllPageRowsSelected() ||
          (table.getIsSomePageRowsSelected() && "indeterminate")
        }
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label="Select all"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label="Select row"
      />
    ),
    enableSorting: false,
    enableHiding: false,
    meta: { width: 'w-10' },
  },
  {
    accessorKey: "invoice_number",
    id: "invoice_number",
    header: () => (
      <div className="!pl-3">Request #</div>
    ),
    cell: ({ row }) => {
      const invoice = row.original;
      return (
        <div className="font-medium !pl-3 truncate min-w-0 max-w-full text-foreground">
          {invoice.invoice_number || `#${invoice.id}`}
        </div>
      );
    },
    meta: { width: 'w-40', className: '!pl-3' },
  },
  {
    accessorKey: "customer.display_name",
    id: "customer",
    header: () => (
      <span className="font-medium">Contact</span>
    ),
    cell: ({ row }) => {
      const invoice = row.original;
      return (
        <div className="truncate min-w-0 max-w-full">
          <div className="text-foreground">
            {invoice.customer?.company_name || invoice.customer?.display_name || '-'}
          </div>
          {invoice.customer?.contact_name && (
            <div className="text-sm text-muted-foreground">
              {invoice.customer.contact_name}
            </div>
          )}
        </div>
      );
    },
    meta: { width: 'w-48' },
  },
  {
    accessorKey: "vessel.name",
    id: "vessel",
    header: () => (
      <span className="font-medium">Vessel</span>
    ),
    cell: ({ row }) => {
      const invoice = row.original;
      return (
        <div className="truncate min-w-0 max-w-full text-foreground">
          {invoice.vessel?.name || '-'}
        </div>
      );
    },
    meta: { width: 'w-40' },
  },
  {
    accessorKey: "total_amount",
    id: "amount",
    header: () => (
      <div className="text-right">Amount</div>
    ),
    cell: ({ row }) => {
      const invoice = row.original;
      return (
        <div className="text-right tabular-nums">
          {formatCurrency(invoice.total_amount)}
        </div>
      );
    },
    meta: { width: 'w-32', className: 'text-right' },
  },
  {
    accessorKey: "invoice_date",
    id: "created_at",
    header: () => (
      <div className="text-right">Created at</div>
    ),
    cell: ({ row }) => {
      const invoice = row.original;
      return (
        <div className="text-sm text-gray-600 text-right tabular-nums">
          {formatDate(invoice.invoice_date)}
        </div>
      );
    },
    meta: { width: 'w-32' },
  },
  {
    accessorKey: "updated_at",
    id: "updated_at",
    header: () => (
      <div className="text-right">Last modified</div>
    ),
    cell: ({ row }) => {
      const invoice = row.original;
      return (
        <div className="text-sm text-gray-600 text-right tabular-nums">
          {invoice.updated_at && invoice.updated_at !== invoice.invoice_date
            ? formatDate(invoice.updated_at)
            : formatDate(invoice.invoice_date)}
        </div>
      );
    },
    meta: { width: 'w-32' },
  },
  {
    accessorKey: "status",
    id: "status",
    header: () => (
      <div className="text-center">Status</div>
    ),
    cell: ({ row }) => {
      const invoice = row.original;
      return (
        <div className="text-center whitespace-nowrap">
          {getStatusBadge(invoice.status)}
        </div>
      );
    },
    meta: { width: 'w-28' },
  },
  {
    id: "actions",
    header: "",
    cell: ({ row }) => {
      const invoice = row.original;

      return (
        <button
          aria-label="Row actions"
          data-row-actions-trigger
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
            actions.openRowActions?.({
              rowId: invoice.id,
              pos: { top: r.bottom + window.scrollY, left: r.left + window.scrollX },
              handlers: {
                view: (id) => actions.onView?.(invoice),
                edit: (id) => actions.onEdit?.(invoice),
                print: (id) => actions.onPrint?.(invoice),
                del: (id) => actions.onDelete?.(invoice),
              }
            });
          }}
          className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-5 w-5 p-0"
        >
          <MoreHorizontal className="h-3 w-3" />
        </button>
      );
    },
    enableSorting: false,
    enableHiding: false,
    meta: { width: 'w-16' },
  },
];