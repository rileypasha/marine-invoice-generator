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

interface InvoiceTableActionsProps {
  onView?: (invoice: Invoice) => void;
  onEdit?: (invoice: Invoice) => void;
  onPrint?: (invoice: Invoice) => void;
  onDelete?: (invoice: Invoice) => void;
  openRowActions?: (args: {rowId: string|number; pos: {top: number; left: number}; handlers: any}) => void;
}

// Create formatters once outside component to prevent recreation on every render
const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD'
});

const dateFormatter = new Intl.DateTimeFormat('en-US');

const formatDate = (dateString?: string) => {
  if (!dateString) return '-';
  return dateFormatter.format(new Date(dateString));
};

const formatCurrency = (amount?: number) => {
  if (!amount) return '$0.00';
  return currencyFormatter.format(amount);
};

// Hoist status config outside to prevent recreation
const STATUS_CONFIG = {
  requested: {
    className: 'bg-blue-400 text-white dark:bg-blue-500 dark:text-white',
    label: 'Requested'
  },
  change_requested: {
    className: 'bg-purple-400 text-white dark:bg-purple-500 dark:text-white',
    label: 'Change Requested'
  },
  approved: {
    className: 'bg-green-400 text-white dark:bg-green-500 dark:text-white',
    label: 'Approved'
  }
} as const;

const getStatusBadge = (status?: string) => {
  const config = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.requested;

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
      <div className="text-left">Amount</div>
    ),
    cell: ({ row }) => {
      const invoice = row.original;
      return (
        <div className="text-left tabular-nums">
          {formatCurrency(invoice.total_amount)}
        </div>
      );
    },
    meta: { width: 'w-32', className: 'text-left' },
  },
  {
    accessorKey: "user.name",
    id: "created_by",
    header: () => (
      <div className="text-left">Created by</div>
    ),
    cell: ({ row }) => {
      const invoice = row.original;
      const userName = invoice.user?.name || invoice.userName || '-';
      return (
        <div className="text-sm text-gray-600 text-left truncate min-w-0 max-w-full">
          {userName}
        </div>
      );
    },
    meta: { width: 'w-32' },
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
    meta: {},
  },
  {
    accessorKey: "modifiedByUserName",
    id: "modified_by",
    header: () => (
      <div className="text-left">Modified by</div>
    ),
    cell: ({ row }) => {
      const invoice = row.original;
      const modifiedBy = invoice.modifiedByUserName || '-';
      return (
        <div className="text-sm text-gray-600 text-left whitespace-nowrap overflow-visible">
          {modifiedBy}
        </div>
      );
    },
    meta: {},
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
    meta: {},
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
    meta: {},
  },
  {
    id: "actions",
    header: "",
    cell: ({ row }) => {
      const invoice = row.original;

      return (
        <div className="flex items-center justify-start">
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
            className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-8 w-8 p-0 md:h-5 md:w-5"
          >
            <MoreHorizontal className="h-4 w-4 md:h-3 md:w-3" />
          </button>
        </div>
      );
    },
    enableSorting: false,
    enableHiding: false,
    meta: { width: 'w-16' },
  },
];