import React, { useState, useMemo } from "react"
import { useNavigate } from 'react-router-dom'
import { ArrowUpDown, Plus, Printer, Upload, Download } from "lucide-react"
import { parsePhoneNumber } from 'libphonenumber-js'
import { ColumnDef } from "@tanstack/react-table"
import { DataTable } from "@/components/ui/data-table"
import { Checkbox as TableCheckbox } from "@/components/ui/checkbox"
import { MoreHorizontal } from "lucide-react"
import { useContactsRowActionsStore } from "@/features/contacts/state/rowActions.store"
import { PaginatedPrintTable } from "@/components/ui/paginated-print-table"
import { ContactSort } from "@/hooks/useContactsQueryState"

interface Customer {
  id: string;
  display_name: string;
  legal_name?: string;
  email?: string;
  phone?: string;
  address_line1?: string;
  city?: string;
  state?: string;
  created_at: string;
  updated_at: string;
  invoice_count?: number;
  invoice_total?: number;
}

type ContactIn = {
  firstName?: string;
  lastName?: string;
  display_name?: string;
  name?: string;
  email?: string;
  phone?: string;
  address1?: string;
  address2?: string;
  address_line1?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  address?: string;
};

type Contact = {
  name: string;
  email: string;
  phone: string;
  address: string;
};

interface ContactsTableProps {
  customers: Customer[]
  sort?: ContactSort | null
  onEdit?: (id: string) => void
  onDelete?: (id: string) => void
  onAddClick?: () => void
  onPrint?: () => void
  onImport?: () => void
  onExport?: () => void
  onBulkDelete?: (selectedRows: Customer[]) => void
  onBulkExport?: (selectedRows: Customer[]) => void
  onViewInvoices?: (customerId: string) => void
  onNewInvoice?: (customer: Customer) => void
  title?: React.ReactNode
}

export function ContactsTable({ customers, sort, onEdit, onDelete, onAddClick, onPrint, onImport, onExport, onBulkDelete, onBulkExport, onViewInvoices, onNewInvoice, title }: ContactsTableProps) {
  const navigate = useNavigate()
  const openRowActions = useContactsRowActionsStore((s) => s.openAt);

  // Sort customers based on the sort prop
  const sortedCustomers = useMemo(() => {
    if (!sort) return customers;

    return [...customers].sort((a, b) => {
      let aValue: any = a[sort.field as keyof Customer];
      let bValue: any = b[sort.field as keyof Customer];

      // Handle null/undefined values
      if (aValue == null) aValue = '';
      if (bValue == null) bValue = '';

      // Convert to string for comparison
      aValue = String(aValue).toLowerCase();
      bValue = String(bValue).toLowerCase();

      if (sort.direction === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    });
  }, [customers, sort]);

  // Helper function to format phone numbers for display
  const formatPhoneForDisplay = (phone: string | null | undefined): string => {
    if (!phone) return '-'

    // If it's already in E.164 format, format it nicely
    if (phone.startsWith('+')) {
      try {
        const parsed = parsePhoneNumber(phone)
        return parsed ? parsed.formatInternational() : phone
      } catch {
        return phone
      }
    }

    // If it's in old format like "(555) 123-4567", return as-is
    return phone
  }

  // Normalize contacts for print
  function normalizeContacts(rows: ContactIn[]): Contact[] {
    return rows.map(r => {
      const name =
        r.name ??
        r.display_name ??
        [r.firstName, r.lastName].filter(Boolean).join(' ').trim();

      const address =
        r.address ??
        [r.address1, r.address2, r.address_line1, r.city, r.state, r.postalCode, r.country]
          .filter(Boolean)
          .join(', ')
          .replace(/\s+,/g, ',')
          .trim();

      return {
        name: name || '',
        email: r.email || '',
        phone: r.phone || '',
        address: address || '',
      };
    });
  }

  // Explicit contact columns for print - includes ALL columns
  const contactCols = [
    { key: 'name' as keyof Contact, header: 'Name' },
    { key: 'email' as keyof Contact, header: 'Email' },
    { key: 'phone' as keyof Contact, header: 'Phone' },
    { key: 'address' as keyof Contact, header: 'Address' },
  ] as const;

  const columns: ColumnDef<Customer>[] = useMemo(() => [
    {
      id: "select",
      header: ({ table }) => (
        <TableCheckbox
          checked={
            table.getIsAllPageRowsSelected() ||
            (table.getIsSomePageRowsSelected() && "indeterminate")
          }
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all"
        />
      ),
      cell: ({ row }) => (
        <TableCheckbox
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
      accessorKey: "display_name",
      header: () => (
        <div className="!pl-3">Name</div>
      ),
      cell: ({ row }) => (
        <div className="font-medium !pl-3">{row.getValue("display_name") || '-'}</div>
      ),
      meta: { width: 'w-48', className: '!pl-3' },
    },
    {
      accessorKey: "email",
      header: "Email",
      cell: ({ row }) => {
        const email = row.getValue("email") as string
        return (
          <div className="lowercase" title={email || undefined}>
            {email ? (
              <a href={`mailto:${email}`} className="text-black hover:underline">
                {email}
              </a>
            ) : '-'}
          </div>
        )
      },
      meta: { width: 'w-44' },
    },
    {
      accessorKey: "phone",
      header: "Phone",
      cell: ({ row }) => {
        const phone = row.getValue("phone") as string
        return <div className="whitespace-nowrap">{formatPhoneForDisplay(phone)}</div>
      },
      meta: { width: 'w-32' },
    },
    {
      id: "address",
      header: "Address",
      cell: ({ row }) => {
        const customer = row.original
        const address = customer.address_line1 && customer.city
          ? `${customer.address_line1}, ${customer.city}${customer.state ? `, ${customer.state}` : ''}`
          : customer.address_line1 || '-'

        return <div title={address}>{address}</div>
      },
      meta: { className: 'hidden lg:table-cell', width: 'w-56' },
    },
    {
      accessorKey: "invoice_count",
      header: ({ column }) => (
        <div className="text-center">Invoices</div>
      ),
      cell: ({ row }) => {
        const count = row.getValue("invoice_count") as number
        return <div className="text-center">{count || 0}</div>
      },
      meta: { width: 'w-28' },
    },
    {
      accessorKey: "invoice_total",
      header: ({ column }) => (
        <div className="text-center">Total</div>
      ),
      cell: ({ row }) => {
        const total = row.getValue("invoice_total") as number
        return (
          <div className="text-center">
            {(total || 0).toLocaleString('en-US', {
              style: 'currency',
              currency: 'USD'
            })}
          </div>
        )
      },
      meta: { width: 'w-32' },
    },
    {
      id: "actions",
      header: "",
      enableHiding: false,
      meta: { width: 'w-16' },
      cell: ({ row }) => {
        const customer = row.original;

        return (
          <button
            aria-label="Row actions"
            data-row-actions-trigger
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
              openRowActions({
                rowId: customer.id,
                pos: { top: r.bottom + window.scrollY, left: r.left + window.scrollX },
                handlers: {
                  newInvoice: (id) => onNewInvoice?.(customer),
                  viewInvoices: (id) => onViewInvoices?.(customer.id),
                  edit: (id) => onEdit?.(customer.id) || navigate(`/contacts/${customer.id}/edit`),
                  del: (id) => onDelete?.(customer.id),
                }
              });
            }}
            className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-5 w-5 p-0"
          >
            <MoreHorizontal className="h-3 w-3" />
          </button>
        );
      },
    },
  ], [navigate, onNewInvoice, onViewInvoices, onEdit, onDelete, openRowActions])

  return (
    <>
      {/* Screen-only interactive table with Airtable-style layout */}
      <div className="screen-only">
        <div>
          <div>
            <DataTable
              columns={columns}
              data={sortedCustomers}
              onPrint={onPrint}
              onImport={onImport}
              onExport={onExport}
              onBulkDelete={onBulkDelete}
              onBulkExport={onBulkExport}
              title={title}
            />
          </div>
        </div>
      </div>

      {/* Print-only paginated table */}
      <PaginatedPrintTable
        columns={contactCols}
        rows={normalizeContacts(sortedCustomers as ContactIn[])}
        approxRowsPerPage={26}
      />
    </>
  )
}