"use client"

import * as React from "react"
import { ColumnDef } from "@tanstack/react-table"
import { Checkbox } from "@/components/ui/checkbox"
import { Avatar, AvatarFallback, AvatarImage } from "./magic/index"
import { MoreVertical } from "lucide-react"

// Fixed Avatar import path

interface Invoice {
  id: string;
  invoiceNumber?: string;
  customerName?: string;
  invoice_number?: string;
  contactName?: string;  // Manually entered contact name (not linked to Customer)
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
    avatarUrl?: string;
  };
  userName?: string;
  userAvatar?: string;
  modifiedByUserName?: string;
  modifiedByUserAvatar?: string;
  total_amount?: number;
  invoice_date?: string;
  updated_at?: string;
  status?: 'requested' | 'change_requested' | 'approved';
}

interface InvoiceTableActionsProps {
  onView?: (invoice: Invoice) => void;
  onEdit?: (invoice: Invoice) => void;
  onPrint?: (invoice: Invoice) => void;
  onCreateInvoice?: (invoice: Invoice) => void;
  onExportPdf?: (invoice: Invoice) => void;
  onExportCsv?: (invoice: Invoice) => void;
  onDelete?: (invoice: Invoice) => void;
  openRowActions?: (args: {rowId: string|number; pos: {top: number; left: number}; handlers: any}) => void;
  numberColumnLabel?: string;
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

// Helper to get user initials
const getInitials = (name?: string) => {
  if (!name) return '?';
  const parts = name.trim().split(' ');
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
};

// Hoist status config outside to prevent recreation
const STATUS_CONFIG = {
  requested: {
    bgColor: '#d2e5fe',
    textColor: '#5d6885',
    label: 'Pending Approval'
  },
  change_requested: {
    bgColor: '#ffe9ae',
    textColor: '#988a6d',
    label: 'Changes Needed'
  },
  approved: {
    bgColor: '#d1f5d1',
    textColor: '#2c270f',
    label: 'Approved'
  }
} as const;

const getStatusBadge = (status?: string) => {
  const config = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.requested;

  return (
    <span
      className="inline-flex px-2 py-1 text-xs rounded-full"
      style={{ backgroundColor: config.bgColor, color: config.textColor }}
    >
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
    meta: { width: 'w-12' },
  },
  {
    accessorKey: "invoice_number",
    id: "invoice_number",
    header: () => (
      <div className="!pl-3">{actions.numberColumnLabel || 'Request #'}</div>
    ),
    cell: ({ row }) => {
      const invoice = row.original;
      return (
        <div className="font-medium !pl-3 truncate min-w-0 text-foreground">
          {invoice.invoice_number || `#${invoice.id}`}
        </div>
      );
    },
    meta: { width: 'min-w-[120px]', className: '!pl-3' },
  },
  {
    accessorKey: "customer.display_name",
    id: "customer",
    header: () => (
      <span className="font-medium">Contact</span>
    ),
    cell: ({ row }) => {
      const invoice = row.original;

      // TEMPORARY DEBUG - log first 3 rows
      if (row.index < 3) {
        console.log(`[InvoiceTableColumns] Row ${row.index}:`, {
          id: invoice.id,
          invoiceNumber: invoice.invoiceNumber || invoice.invoice_number,
          contactName: invoice.contactName,
          customerName: invoice.customerName,
          customer: invoice.customer,
          customerContactName: invoice.customer?.contact_name,
          customerDisplayName: invoice.customer?.display_name,
          customerCompanyName: invoice.customer?.company_name,
        });
      }

      // Display contact: prioritize manually entered contactName over linked customer
      const displayContact = invoice.contactName || invoice.customer?.display_name || invoice.customer?.company_name || '-';

      return (
        <div className="truncate min-w-0">
          <div className="text-foreground">
            {displayContact}
          </div>
        </div>
      );
    },
    meta: { width: 'min-w-[180px]' },
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
        <div className="truncate min-w-0 text-foreground">
          {invoice.vessel?.name || '-'}
        </div>
      );
    },
    meta: { width: 'min-w-[140px]' },
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
    meta: { width: 'min-w-[110px]', className: 'text-left' },
  },
  {
    accessorKey: "user.name",
    id: "created_by",
    header: () => (
      <div className="text-left hidden md:table-cell">Created by</div>
    ),
    cell: ({ row }) => {
      const invoice = row.original;
      const userName = invoice.user?.name || invoice.userName || '-';
      const avatarUrl = invoice.user?.avatarUrl || invoice.userAvatar;
      const initials = getInitials(userName);

      return (
        <div className="text-sm text-gray-600 text-left hidden md:table-cell">
          {userName !== '-' && (
            <span className="inline-flex items-center gap-2">
              <span className="inline-flex h-6 w-6 rounded-full bg-gray-200 items-center justify-center overflow-hidden flex-shrink-0">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={userName}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="text-xs font-medium text-gray-700">
                    {initials}
                  </span>
                )}
              </span>
              <span className="truncate">{userName}</span>
            </span>
          )}
          {userName === '-' && <span>{userName}</span>}
        </div>
      );
    },
    meta: { width: 'min-w-[160px]', className: 'hidden md:table-cell' },
  },
  {
    accessorKey: "invoice_date",
    id: "created_at",
    header: () => (
      <div className="text-right hidden md:table-cell">Created at</div>
    ),
    cell: ({ row }) => {
      const invoice = row.original;
      return (
        <div className="text-sm text-gray-600 text-right tabular-nums hidden md:table-cell">
          {formatDate(invoice.invoice_date)}
        </div>
      );
    },
    meta: { width: 'min-w-[120px]', className: 'hidden md:table-cell' },
  },
  {
    accessorKey: "modifiedByUserName",
    id: "modified_by",
    header: () => (
      <span className="text-left">Modified by</span>
    ),
    cell: ({ row }) => {
      const invoice = row.original;
      const modifiedBy = invoice.modifiedByUserName || '-';
      const avatarUrl = invoice.modifiedByUserAvatar;
      const initials = getInitials(invoice.modifiedByUserName);

      return (
        <div className="flex items-center gap-2 text-sm text-gray-600 text-left whitespace-nowrap">
          {modifiedBy !== '-' && (
            <div className="h-6 w-6 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden flex-shrink-0">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={modifiedBy}
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="text-xs font-medium text-gray-700">
                  {initials}
                </span>
              )}
            </div>
          )}
          <span className="truncate">{modifiedBy}</span>
        </div>
      );
    },
    meta: { width: 'min-w-[160px]' },
  },
  {
    accessorKey: "updated_at",
    id: "updated_at",
    header: () => (
      <div className="text-right whitespace-nowrap">Last modified</div>
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
    meta: { width: 'min-w-[120px]' },
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
    meta: { width: 'min-w-[150px]' },
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

              // Smart positioning to prevent dropdown overflow
              const dropdownWidth = 150; // Estimated width of dropdown menu
              const buttonRight = r.right + window.scrollX;
              const viewportWidth = window.innerWidth;

              // If dropdown would overflow right edge, align it to the right of the button
              const left = (buttonRight + dropdownWidth > viewportWidth)
                ? buttonRight - dropdownWidth  // Align right edges
                : r.left + window.scrollX;      // Default: align left edges

              actions.openRowActions?.({
                rowId: invoice.id,
                pos: { top: r.bottom + window.scrollY, left },
                handlers: {
                  view: () => {
                    console.log('[InvoiceTableColumns] View handler called', { invoice, onView: actions.onView });
                    actions.onView?.(invoice);
                  },
                  edit: () => {
                    console.log('[InvoiceTableColumns] Edit handler called', { invoice, onEdit: actions.onEdit });
                    actions.onEdit?.(invoice);
                  },
                  createInvoice: actions.onCreateInvoice
                    ? () => actions.onCreateInvoice?.(invoice)
                    : undefined,
                  exportPdf: actions.onExportPdf
                    ? () => actions.onExportPdf?.(invoice)
                    : undefined,
                  exportCsv: actions.onExportCsv
                    ? () => actions.onExportCsv?.(invoice)
                    : undefined,
                  del: () => {
                    console.log('[InvoiceTableColumns] Delete handler called', { invoice, onDelete: actions.onDelete });
                    actions.onDelete?.(invoice);
                  },
                }
              });
            }}
            className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-gray-100 hover:bg-gray-200 h-8 w-8 p-0"
          >
            <MoreVertical className="h-4 w-4 text-gray-600 pointer-events-none" />
          </button>
        </div>
      );
    },
    enableSorting: false,
    enableHiding: false,
    meta: { width: 'w-16' },
  },
];
