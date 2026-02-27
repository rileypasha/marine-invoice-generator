"use client"

import * as React from "react"
import { ColumnDef } from "@tanstack/react-table"
import { Checkbox } from "@/components/ui/checkbox"
import { MoreVertical } from "lucide-react"

interface Invoice {
  id: string;
  invoiceNumber?: string;
  customerName?: string;
  invoice_number?: string;
  contactName?: string;
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
  subtotal?: number;
  tax_amount?: number;
  gross_profit?: number;
  profit_percent?: number;
  total_quantity?: number;
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

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD'
});

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric'
});

const formatDate = (dateString?: string) => {
  if (!dateString) return '-';
  return dateFormatter.format(new Date(dateString));
};

const formatCurrency = (amount?: number) => {
  if (!amount) return '$0.00';
  return currencyFormatter.format(amount);
};

const getInitials = (name?: string) => {
  if (!name) return '?';
  const parts = name.trim().split(' ');
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
};

const STATUS_CONFIG = {
  requested: {
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    dot: 'bg-blue-500',
    label: 'Pending'
  },
  change_requested: {
    bg: 'bg-violet-50',
    text: 'text-violet-700',
    dot: 'bg-violet-500',
    label: 'Revision'
  },
  approved: {
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    dot: 'bg-emerald-500',
    label: 'Approved'
  }
} as const;

const getStatusBadge = (status?: string) => {
  const config = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.requested;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full ${config.bg} ${config.text}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${config.dot}`} />
      {config.label}
    </span>
  );
};

const AvatarCell = ({ name, avatarUrl }: { name: string; avatarUrl?: string }) => {
  const initials = getInitials(name);
  return (
    <div className="flex items-center gap-2.5">
      <div className="h-7 w-7 rounded-full bg-slate-100 flex items-center justify-center overflow-hidden flex-shrink-0 ring-1 ring-slate-200/60">
        {avatarUrl ? (
          <img src={avatarUrl} alt={name} className="h-full w-full object-cover" />
        ) : (
          <span className="text-[10px] font-semibold text-slate-500">{initials}</span>
        )}
      </div>
      <span className="truncate text-slate-600">{name}</span>
    </div>
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
      const num = (invoice.invoice_number || `#${invoice.id}`).replace(/^(REQ-|EST-|INV-)/i, '');
      return (
        <div className="!pl-3 truncate min-w-0 text-slate-900">
          {num}
        </div>
      );
    },
    meta: { className: '!pl-3' },
  },
  {
    accessorKey: "vessel.name",
    id: "vessel",
    header: () => (
      <span>Vessel</span>
    ),
    cell: ({ row }) => {
      const invoice = row.original;
      return (
        <div className="truncate min-w-0 text-slate-700">
          {invoice.vessel?.name || '-'}
        </div>
      );
    },
    meta: {},
  },
  {
    accessorKey: "customer.display_name",
    id: "customer",
    header: () => (
      <span>Contact</span>
    ),
    cell: ({ row }) => {
      const invoice = row.original;
      const displayContact = invoice.contactName || invoice.customer?.display_name || invoice.customer?.company_name || '-';

      return (
        <div className="truncate min-w-0 text-slate-700">
          {displayContact}
        </div>
      );
    },
    meta: {},
  },
  {
    accessorKey: "total_quantity",
    id: "qty",
    header: () => (
      <div className="text-center pl-6">Qty</div>
    ),
    cell: ({ row }) => {
      const invoice = row.original;
      return (
        <div className="text-center pl-6 tabular-nums text-slate-700">
          {invoice.total_quantity || 0}
        </div>
      );
    },
    meta: {},
  },
  {
    id: "rate",
    header: () => (
      <div className="text-right">Rate</div>
    ),
    cell: ({ row }) => {
      const invoice = row.original;
      const baseCost = (invoice.subtotal || 0) - (invoice.gross_profit || 0);
      return (
        <div className="text-right tabular-nums text-slate-700">
          {formatCurrency(baseCost)}
        </div>
      );
    },
    meta: {},
  },
  {
    accessorKey: "gross_profit",
    id: "markup",
    header: () => (
      <div className="text-right">Markup</div>
    ),
    cell: ({ row }) => {
      const invoice = row.original;
      return (
        <div className="text-right tabular-nums text-slate-700">
          {formatCurrency(invoice.gross_profit)}
        </div>
      );
    },
    meta: {},
  },
  {
    accessorKey: "subtotal",
    id: "subtotal",
    header: () => (
      <div className="text-right">Subtotal</div>
    ),
    cell: ({ row }) => {
      const invoice = row.original;
      return (
        <div className="text-right tabular-nums text-slate-700">
          {formatCurrency(invoice.subtotal)}
        </div>
      );
    },
    meta: {},
  },
  {
    accessorKey: "tax_amount",
    id: "tax",
    header: () => (
      <div className="text-right">Tax</div>
    ),
    cell: ({ row }) => {
      const invoice = row.original;
      return (
        <div className="text-right tabular-nums text-slate-700">
          {formatCurrency(invoice.tax_amount)}
        </div>
      );
    },
    meta: {},
  },
  {
    accessorKey: "total_amount",
    id: "amount",
    header: () => (
      <div className="text-right">Total</div>
    ),
    cell: ({ row }) => {
      const invoice = row.original;
      return (
        <div className="text-right tabular-nums text-slate-900">
          {formatCurrency(invoice.total_amount)}
        </div>
      );
    },
    meta: { className: 'text-right' },
  },
  {
    accessorKey: "updated_at",
    id: "modified",
    header: () => (
      <div className="text-right">Modified</div>
    ),
    cell: ({ row }) => {
      const invoice = row.original;
      return (
        <div className="text-slate-500 text-right tabular-nums">
          {formatDate(invoice.updated_at)}
        </div>
      );
    },
    meta: {},
  },
  {
    accessorKey: "invoice_date",
    id: "created_at",
    header: () => (
      <div className="text-right">Created</div>
    ),
    cell: ({ row }) => {
      const invoice = row.original;
      return (
        <div className="text-slate-500 text-right tabular-nums">
          {formatDate(invoice.invoice_date)}
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
        <button
          aria-label="Row actions"
          data-row-actions-trigger
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            const r = (e.currentTarget as HTMLElement).getBoundingClientRect();

            const dropdownWidth = 150;
            const buttonRight = r.right + window.scrollX;
            const viewportWidth = window.innerWidth;

            const left = (buttonRight + dropdownWidth > viewportWidth)
              ? buttonRight - dropdownWidth
              : r.left + window.scrollX;

            actions.openRowActions?.({
              rowId: invoice.id,
              pos: { top: r.bottom + window.scrollY, left },
              handlers: {
                view: () => actions.onView?.(invoice),
                edit: () => actions.onEdit?.(invoice),
                createInvoice: actions.onCreateInvoice
                  ? () => actions.onCreateInvoice?.(invoice)
                  : undefined,
                exportPdf: actions.onExportPdf
                  ? () => actions.onExportPdf?.(invoice)
                  : undefined,
                exportCsv: actions.onExportCsv
                  ? () => actions.onExportCsv?.(invoice)
                  : undefined,
                del: () => actions.onDelete?.(invoice),
              }
            });
          }}
          className="flex items-center justify-center w-full cursor-pointer select-none"
          style={{ transition: 'none', margin: '-0.75rem', padding: '0.75rem' }}
        >
          <MoreVertical className="h-4 w-4 text-slate-400" style={{ pointerEvents: 'none' }} />
        </button>
      );
    },
    enableSorting: false,
    enableHiding: false,
    meta: { width: 'w-16', className: 'cursor-pointer' },
  },
];
