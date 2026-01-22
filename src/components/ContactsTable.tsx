import React, { useMemo, useCallback, useState, useEffect } from "react";
import { useNavigate } from 'react-router-dom';
import {
  ColumnDef,
  GroupingState,
  ExpandedState,
  OnChangeFn,
  useReactTable,
  getCoreRowModel,
  getGroupedRowModel,
  getExpandedRowModel,
  getSortedRowModel,
  flexRender
} from "@tanstack/react-table";
import { parsePhoneNumber } from 'libphonenumber-js';
import { Checkbox as TableCheckbox } from "@/components/ui/checkbox";
import {
  SimpleTable as Table,
  SimpleTableBody as TableBody,
  SimpleTableCell as TableCell,
  SimpleTableHead as TableHead,
  SimpleTableHeader as TableHeader,
  SimpleTableRow as TableRow,
} from "@/components/ui/simple-table";
import { ContactSort } from "@/hooks/useContactsQueryState";
import { MoreVertical, ChevronDown, ChevronRight, Download, Trash2, X } from "lucide-react";
import { useContactsRowActionsStore } from "@/features/contacts/state/rowActions.store";
import { bucketByActivity, bucketByMonthlyActivity, formatActivityGroupSubtotal, fmtCurrency } from "@/features/contacts/activity";
import { Button } from "@/components/ui/button";

// Column width definitions for consistent spacing across all tables
const CONTACTS_COLS = [
  { id: 'select', w: '4%' },               // Checkbox column
  { id: 'name', w: '15%' },                // Contact name column
  { id: 'email', w: '15%' },               // Email column
  { id: 'phone', w: '10%' },               // Phone column
  { id: 'address', w: '20%' },             // Address column
  { id: 'monthly_invoices', w: '8%' },    // Monthly invoices count column (centered)
  { id: 'monthly_total', w: '10%' },       // Monthly total amount column (centered)
  { id: 'invoices', w: '8%' },            // Total invoices count column (centered)
  { id: 'total', w: '10%' },               // Total amount column (centered)
  { id: 'actions', w: '4%' }               // Actions column
];

interface Customer {
  id: string;
  display_name: string;
  legal_name?: string;
  email?: string;
  phone?: string;
  address_line1?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
  created_at: string;
  updated_at: string;
  invoice_count?: number;
  invoice_total?: number;
  monthly_invoice_count?: number;
  monthly_invoice_total?: number;
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
  monthly_invoice_count?: number;
  monthly_invoice_total?: number;
  invoice_count?: number;
  invoice_total?: number;
};

interface ContactsTableProps {
  customers: Customer[];
  sort?: ContactSort | null;
  groupBy?: 'activity' | 'monthlyActivity' | 'none';

  // Controlled state props
  grouping?: GroupingState;
  expanded?: ExpandedState;
  onGroupingChange?: OnChangeFn<GroupingState>;
  onExpandedChange?: OnChangeFn<ExpandedState>;

  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
  onBulkDelete?: (selectedRows: Customer[]) => void;
  onBulkExport?: (selectedRows: Customer[]) => void;
  onViewInvoices?: (customerId: string) => void;
  onNewInvoice?: (customer: Customer) => void;
  title?: React.ReactNode;
}

export function ContactsTable({
  customers,
  sort,
  groupBy = 'none',
  grouping: controlledGrouping,
  expanded: controlledExpanded,
  onGroupingChange,
  onExpandedChange,
  onEdit,
  onDelete,
  onBulkDelete,
  onBulkExport,
  onViewInvoices,
  onNewInvoice,
  title
}: ContactsTableProps) {
  const navigate = useNavigate();
  const openRowActions = useContactsRowActionsStore((s) => s.openAt);

  // Row selection state
  const [rowSelection, setRowSelection] = useState({});

  // Use controlled state or fallback to defaults
  const grouping = controlledGrouping ?? [];
  const expanded = controlledExpanded ?? {};

  // Sort customers based on the sort prop
  const sortedCustomers = useMemo(() => {
    if (!sort) return customers;

    return [...customers].sort((a, b) => {
      let aValue: any = a[sort.field as keyof Customer];
      let bValue: any = b[sort.field as keyof Customer];

      // Handle null/undefined values
      if (aValue == null) aValue = '';
      if (bValue == null) bValue = '';

      // Convert to string for comparison (except for numbers)
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        // Keep as numbers for proper numeric sorting
      } else {
        aValue = String(aValue).toLowerCase();
        bValue = String(bValue).toLowerCase();
      }

      if (sort.direction === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    });
  }, [customers, sort]);

  // Helper function to format phone numbers for display
  const formatPhoneForDisplay = (phone: string | null | undefined): string => {
    if (!phone) return '-';

    // If it's already in E.164 format, format it nicely
    if (phone.startsWith('+')) {
      try {
        const parsed = parsePhoneNumber(phone);
        return parsed ? parsed.formatInternational() : phone;
      } catch {
        return phone;
      }
    }

    // If it's in old format like "(555) 123-4567", return as-is
    return phone;
  };

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

  // Print columns definition - includes ALL columns
  const printColumns = [
    { key: 'name' as keyof Contact, header: 'Name' },
    { key: 'email' as keyof Contact, header: 'Email' },
    { key: 'phone' as keyof Contact, header: 'Phone' },
    { key: 'address' as keyof Contact, header: 'Address' },
    {
      key: 'monthly_invoice_count' as keyof Contact,
      header: 'Monthly Invoices',
      render: (value: any) => value || 0
    },
    {
      key: 'monthly_invoice_total' as keyof Contact,
      header: 'Monthly Amount',
      render: (value: any) => (value || 0).toLocaleString('en-US', {
        style: 'currency',
        currency: 'USD'
      })
    },
    {
      key: 'invoice_count' as keyof Contact,
      header: 'Total Invoices',
      render: (value: any) => value || 0
    },
    {
      key: 'invoice_total' as keyof Contact,
      header: 'Total Amount',
      render: (value: any) => (value || 0).toLocaleString('en-US', {
        style: 'currency',
        currency: 'USD'
      })
    }
  ];

  // Define columns for DataTable - wrapped in useMemo to prevent recreation on every render
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
        const email = row.getValue("email") as string;
        return (
          <div className="lowercase" title={email || undefined}>
            {email ? (
              <a href={`mailto:${email}`} className="text-black hover:underline">
                {email}
              </a>
            ) : '-'}
          </div>
        );
      },
      meta: { width: 'w-44' },
    },
    {
      accessorKey: "phone",
      header: "Phone",
      cell: ({ row }) => {
        const phone = row.getValue("phone") as string;
        return <div className="whitespace-nowrap">{formatPhoneForDisplay(phone)}</div>;
      },
      meta: { width: 'w-32' },
    },
    {
      accessorKey: "address",
      header: "Address",
      cell: ({ row }) => {
        const address = [
          row.original.address_line1,
          row.original.city,
          row.original.state,
          row.original.postal_code,
          row.original.country,
        ]
          .filter(Boolean)
          .join(", ");
        return <div>{address || "-"}</div>;
      },
      meta: { width: 'w-64' },
    },
    {
      accessorKey: "monthly_invoice_count",
      header: ({ column }) => (
        <div className="text-center">Monthly Invoices</div>
      ),
      cell: ({ row }) => {
        const count = row.getValue("monthly_invoice_count") as number;
        return <div className="text-center">{count || 0}</div>;
      },
      aggregationFn: 'sum',
      meta: { width: 'w-32' },
    },
    {
      accessorKey: "monthly_invoice_total",
      header: ({ column }) => (
        <div className="text-center">Monthly Amount</div>
      ),
      cell: ({ row }) => {
        const total = row.getValue("monthly_invoice_total") as number;
        return (
          <div className="text-center">
            {(total || 0).toLocaleString('en-US', {
              style: 'currency',
              currency: 'USD'
            })}
          </div>
        );
      },
      aggregationFn: 'sum',
      meta: { width: 'w-32' },
    },
    {
      accessorKey: "invoice_count",
      header: ({ column }) => (
        <div className="text-center">Total Invoices</div>
      ),
      cell: ({ row }) => {
        const count = row.getValue("invoice_count") as number;
        return <div className="text-center">{count || 0}</div>;
      },
      aggregationFn: 'sum',
      meta: { width: 'w-28' },
    },
    {
      accessorKey: "invoice_total",
      header: ({ column }) => (
        <div className="text-center">Total Amount</div>
      ),
      cell: ({ row }) => {
        const total = row.getValue("invoice_total") as number;
        return (
          <div className="text-center">
            {(total || 0).toLocaleString('en-US', {
              style: 'currency',
              currency: 'USD'
            })}
          </div>
        );
      },
      aggregationFn: 'sum',
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

                openRowActions({
                  rowId: customer.id,
                  pos: { top: r.bottom + window.scrollY, left },
                  handlers: {
                    newInvoice: (id) => onNewInvoice?.(customer),
                    viewInvoices: (id) => onViewInvoices?.(customer.id),
                    edit: (id) => onEdit?.(customer.id) || navigate(`/contacts/${customer.id}/edit`),
                    del: (id) => onDelete?.(customer.id),
                  }
                });
              }}
              className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-gray-100 hover:bg-gray-200 h-8 w-8 p-0"
            >
              <MoreVertical className="h-4 w-4 text-gray-600" />
            </button>
          </div>
        );
      },
    },
    // Virtual grouping column for activity
    {
      id: 'activityBucket',
      header: 'Activity',
      accessorFn: (row) => bucketByActivity(row.invoice_count).label,
      enableGrouping: true,
      cell: ({ row }) => null, // Hidden in normal rows
      enableSorting: false,
      enableHiding: false,
    },
    // Virtual grouping column for monthly activity
    {
      id: 'monthlyActivityBucket',
      header: 'Monthly Activity',
      accessorFn: (row) => bucketByMonthlyActivity(row.monthly_invoice_count).label,
      enableGrouping: true,
      cell: ({ row }) => null, // Hidden in normal rows
      enableSorting: false,
      enableHiding: false,
    },
  ], []); // Stable column definitions - callbacks captured in closure

  // TanStack Table setup with grouping
  const table = useReactTable({
    data: sortedCustomers,
    columns,
    state: {
      grouping,
      expanded,
      rowSelection,
    },
    getRowId: row => row.id, // Stable unique ID for proper expansion state
    onGroupingChange,
    onExpandedChange,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getGroupedRowModel: getGroupedRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getSortedRowModel: getSortedRowModel(),
    enableGrouping: true,
    enableRowSelection: true,
    // CRITICAL: prevent resets that collapse groups
    autoResetAll: false,
    autoResetExpanded: false,
  });

  // Get selected customers
  const selectedRows = table.getFilteredSelectedRowModel().rows;
  const selectedCustomers = selectedRows.map(row => row.original);

  return (
    <>
      {/* Screen-only interactive table with Airtable-style layout */}
      <div className="screen-only">
        {/* Bulk selection toolbar */}
        {selectedRows.length > 0 && (
          <div className="flex items-center justify-between border-b border-gray-200 px-6 py-3">
            <div className="flex items-center">
              <span className="text-sm font-medium">
                {selectedRows.length} item{selectedRows.length === 1 ? '' : 's'} selected
              </span>
            </div>
            <div className="flex items-center gap-2 ml-auto">
              <Button
                variant="outline"
                size="sm"
                onClick={() => table.resetRowSelection()}
                className="h-8 px-2 text-xs transition-none"
              >
                <X className="h-3 w-3 mr-1" />
                Clear
              </Button>
              {onBulkDelete && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => onBulkDelete(selectedCustomers)}
                  className="h-8 px-2 text-xs transition-none"
                >
                  <Trash2 className="h-3 w-3 mr-1" />
                  Delete
                </Button>
              )}
              {onBulkExport && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onBulkExport(selectedCustomers)}
                  className="h-8 px-2 text-xs transition-none"
                >
                  <Download className="h-3 w-3 mr-1" />
                  Export
                </Button>
              )}
            </div>
          </div>
        )}

        <div className="border-r border-b overflow-x-auto">
          <Table>
            <TableHeader className="before:content-none">
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => {
                    // Skip virtual grouping columns in header
                    if (header.column.id === 'activityBucket' || header.column.id === 'monthlyActivityBucket') {
                      return null;
                    }
                    return (
                      <TableHead key={header.id}>
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )}
                      </TableHead>
                    );
                  })}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows?.length ? (
                (() => {
                  let visibleRowIndex = 0; // Track visible data rows for banding
                  return table.getRowModel().rows.map((row) => {
                    if (row.getIsGrouped()) {
                      // Group header row
                      const groupingValue = row.groupingValue as string;
                      const subRowsCount = row.subRows.length;
                      const isExpanded = row.getIsExpanded();

                      // Calculate aggregated values for group
                      const totalRevenue = row.subRows.reduce((sum, subRow) =>
                        sum + (subRow.original.invoice_total || 0), 0);
                      const monthlyRevenue = row.subRows.reduce((sum, subRow) =>
                        sum + (subRow.original.monthly_invoice_total || 0), 0);

                      return (
                        <TableRow
                          key={row.id}
                          className="sticky top-[48px] z-10 bg-gray-50 hover:bg-gray-100 border-b-2 border-gray-200"
                        >
                          <TableCell colSpan={columns.length - 1} className="py-3">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                row.getToggleExpandedHandler()();
                              }}
                              className="flex items-center justify-between w-full text-left focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 rounded p-1 -m-1"
                              aria-expanded={isExpanded}
                              aria-controls={`group-${row.id}`}
                            >
                              <div className="flex items-center gap-3">
                                {isExpanded ? (
                                  <ChevronDown className="h-4 w-4 text-gray-500 pointer-events-none" />
                                ) : (
                                  <ChevronRight className="h-4 w-4 text-gray-500 pointer-events-none" />
                                )}
                                <span className="font-medium text-gray-900">{groupingValue}</span>
                                <span className="text-sm text-gray-500 bg-gray-200 px-2 py-1 rounded-full">
                                  {subRowsCount}
                                </span>
                              </div>
                              <div className="text-sm text-gray-600">
                                {formatActivityGroupSubtotal(subRowsCount, totalRevenue, monthlyRevenue)}
                              </div>
                            </button>
                          </TableCell>
                        </TableRow>
                      );
                    }

                    // Regular data row - only show if parent is expanded or no grouping
                    if (row.depth > 0 && !row.getParentRow()?.getIsExpanded()) {
                      return null;
                    }

                    const currentIndex = visibleRowIndex++;
                    return (
                      <TableRow
                        key={row.id}
                        data-state={row.getIsSelected() && "selected"}
                        className={`border-b border-gray-200 ${
                          currentIndex % 2 === 0 ? 'bg-white hover:bg-gray-50' : 'bg-gray-50/50 hover:bg-gray-100'
                        }`}
                      >
                        {row.getVisibleCells().map((cell) => {
                          // Skip virtual grouping columns in data rows
                          if (cell.column.id === 'activityBucket' || cell.column.id === 'monthlyActivityBucket') {
                            return null;
                          }
                          return (
                            <TableCell key={cell.id}>
                              {flexRender(cell.column.columnDef.cell, cell.getContext())}
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    );
                  });
                })()
              ) : (
                <TableRow>
                  <TableCell colSpan={columns.length} className="h-24 text-center">
                    No results.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

    </>
  );
}
