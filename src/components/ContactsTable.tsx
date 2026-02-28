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
import { MoreVertical, ChevronDown, ChevronRight, Download, Trash2 } from "lucide-react";
import { useContactsRowActionsStore } from "@/features/contacts/state/rowActions.store";
import { bucketByActivity, bucketByMonthlyActivity, formatActivityGroupSubtotal, fmtCurrency } from "@/features/contacts/activity";
import { Button } from "@/components/ui/button";

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

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD'
});

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

  const [rowSelection, setRowSelection] = useState({});

  const grouping = controlledGrouping ?? [];
  const expanded = controlledExpanded ?? {};

  const sortedCustomers = useMemo(() => {
    if (!sort) return customers;

    return [...customers].sort((a, b) => {
      let aValue: any = a[sort.field as keyof Customer];
      let bValue: any = b[sort.field as keyof Customer];

      if (aValue == null) aValue = '';
      if (bValue == null) bValue = '';

      if (typeof aValue === 'number' && typeof bValue === 'number') {
        // Keep as numbers
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

  const formatPhoneForDisplay = (phone: string | null | undefined): string => {
    if (!phone) return '-';

    if (phone.startsWith('+')) {
      try {
        const parsed = parsePhoneNumber(phone);
        return parsed ? parsed.formatInternational() : phone;
      } catch {
        return phone;
      }
    }

    return phone;
  };

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
        <div className="font-semibold text-slate-900 !pl-3">{row.getValue("display_name") || '-'}</div>
      ),
      meta: { width: 'w-48', className: '!pl-3' },
    },
    {
      accessorKey: "email",
      header: "Email",
      cell: ({ row }) => {
        const email = row.getValue("email") as string;
        return (
          <div className="lowercase truncate" title={email || undefined}>
            {email ? (
              <a href={`mailto:${email}`} className="text-slate-600 hover:text-blue-600 hover:underline transition-colors">
                {email}
              </a>
            ) : <span className="text-slate-400">-</span>}
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
        const formatted = formatPhoneForDisplay(phone);
        return <div className={`whitespace-nowrap truncate ${formatted === '-' ? 'text-slate-400' : 'text-slate-700'}`}>{formatted}</div>;
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
        return (
          <div className={`truncate ${address ? 'text-slate-700' : 'text-slate-400'}`} title={address || undefined}>
            {address || "-"}
          </div>
        );
      },
      meta: { width: 'w-64' },
    },
    {
      accessorKey: "monthly_invoice_count",
      header: () => (
        <div className="text-center">Monthly Inv.</div>
      ),
      cell: ({ row }) => {
        const count = row.getValue("monthly_invoice_count") as number;
        return <div className={`text-center tabular-nums ${count ? 'text-slate-700 font-medium' : 'text-slate-400'}`}>{count || 0}</div>;
      },
      aggregationFn: 'sum',
      meta: { width: 'w-32' },
    },
    {
      accessorKey: "monthly_invoice_total",
      header: () => (
        <div className="text-center">Monthly Amt.</div>
      ),
      cell: ({ row }) => {
        const total = row.getValue("monthly_invoice_total") as number;
        return (
          <div className={`text-center tabular-nums ${total ? 'text-slate-900 font-semibold' : 'text-slate-400'}`}>
            {currencyFormatter.format(total || 0)}
          </div>
        );
      },
      aggregationFn: 'sum',
      meta: { width: 'w-32' },
    },
    {
      accessorKey: "invoice_count",
      header: () => (
        <div className="text-center">Total Inv.</div>
      ),
      cell: ({ row }) => {
        const count = row.getValue("invoice_count") as number;
        return <div className={`text-center tabular-nums ${count ? 'text-slate-700 font-medium' : 'text-slate-400'}`}>{count || 0}</div>;
      },
      aggregationFn: 'sum',
      meta: { width: 'w-28' },
    },
    {
      accessorKey: "invoice_total",
      header: () => (
        <div className="text-center">Total Amt.</div>
      ),
      cell: ({ row }) => {
        const total = row.getValue("invoice_total") as number;
        return (
          <div className={`text-center tabular-nums ${total ? 'text-slate-900 font-semibold' : 'text-slate-400'}`}>
            {currencyFormatter.format(total || 0)}
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
      meta: { width: 'w-16', className: 'p-0' },
      cell: ({ row }) => {
        const customer = row.original;

        return (
          <div className="flex items-center justify-center">
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

                openRowActions({
                  rowId: customer.id,
                  pos: { top: r.bottom + window.scrollY, left },
                  handlers: {
                    newInvoice: () => onNewInvoice?.(customer),
                    viewInvoices: () => onViewInvoices?.(customer.id),
                    edit: () => onEdit?.(customer.id) || navigate(`/contacts/${customer.id}/edit`),
                    del: () => onDelete?.(customer.id),
                  }
                });
              }}
              className="inline-flex items-center justify-center rounded-lg text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-slate-100 h-8 w-8 p-0 transition-colors"
            >
              <MoreVertical className="h-4 w-4 text-slate-400" />
            </button>
          </div>
        );
      },
    },
    // Virtual grouping columns
    {
      id: 'activityBucket',
      header: 'Activity',
      accessorFn: (row) => bucketByActivity(row.invoice_count).label,
      enableGrouping: true,
      cell: ({ row }) => null,
      enableSorting: false,
      enableHiding: false,
    },
    {
      id: 'monthlyActivityBucket',
      header: 'Monthly Activity',
      accessorFn: (row) => bucketByMonthlyActivity(row.monthly_invoice_count).label,
      enableGrouping: true,
      cell: ({ row }) => null,
      enableSorting: false,
      enableHiding: false,
    },
  ], []);

  const table = useReactTable({
    data: sortedCustomers,
    columns,
    state: {
      grouping,
      expanded,
      rowSelection,
    },
    getRowId: row => row.id,
    onGroupingChange,
    onExpandedChange,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getGroupedRowModel: getGroupedRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getSortedRowModel: getSortedRowModel(),
    enableGrouping: true,
    enableRowSelection: true,
    autoResetAll: false,
    autoResetExpanded: false,
  });

  const selectedRows = table.getFilteredSelectedRowModel().rows;
  const selectedCustomers = selectedRows.map(row => row.original);

  return (
    <>
      <div className="screen-only">
        <div className="overflow-x-auto border-t-0 relative">
          {/* Bulk action bar — overlays header row */}
          {selectedRows.length > 0 && (
            <div className="absolute top-0 left-0 right-0 z-20 h-9 bg-white flex items-center border-b border-slate-200">
              <div className="flex items-center pl-6 gap-3">
                <TableCheckbox
                  checked={
                    table.getIsAllPageRowsSelected() ||
                    (table.getIsSomePageRowsSelected() && "indeterminate")
                  }
                  onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
                  aria-label="Select all"
                />
                <span className="text-sm font-medium text-slate-700">
                  {selectedRows.length} item{selectedRows.length === 1 ? '' : 's'} selected
                </span>
              </div>
              <div className="flex items-center gap-2 ml-auto pr-6">
                {onBulkDelete && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => onBulkDelete(selectedCustomers)}
                    className="h-7 px-2 text-xs transition-none"
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
                    className="h-7 px-2 text-xs transition-none"
                  >
                    <Download className="h-3 w-3 mr-1" />
                    Export
                  </Button>
                )}
              </div>
            </div>
          )}
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id} className="hover:bg-white">
                  {headerGroup.headers.map((header) => {
                    if (header.column.id === 'activityBucket' || header.column.id === 'monthlyActivityBucket') {
                      return null;
                    }
                    const columnMeta = header.column.columnDef.meta as any;
                    const isActions = header.column.id === 'actions';
                    return (
                      <TableHead
                        key={header.id}
                        className={isActions
                          ? 'w-8 min-w-[32px] max-w-[32px] p-0'
                          : `${columnMeta?.width || ''} ${columnMeta?.className || ''}`}
                      >
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
                  return table.getRowModel().rows.map((row) => {
                    if (row.getIsGrouped()) {
                      const groupingValue = row.groupingValue as string;
                      const subRowsCount = row.subRows.length;
                      const isExpanded = row.getIsExpanded();

                      const totalRevenue = row.subRows.reduce((sum, subRow) =>
                        sum + (subRow.original.invoice_total || 0), 0);
                      const monthlyRevenue = row.subRows.reduce((sum, subRow) =>
                        sum + (subRow.original.monthly_invoice_total || 0), 0);

                      return (
                        <TableRow
                          key={row.id}
                          className="sticky top-[36px] z-10 bg-slate-50 hover:bg-slate-100/80 border-b border-slate-200"
                        >
                          <TableCell colSpan={columns.length - 1} className="py-2.5">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                row.getToggleExpandedHandler()();
                              }}
                              className="flex items-center justify-between w-full text-left focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 rounded-md p-1 -m-1"
                              aria-expanded={isExpanded}
                              aria-controls={`group-${row.id}`}
                            >
                              <div className="flex items-center gap-3">
                                {isExpanded ? (
                                  <ChevronDown className="h-4 w-4 text-slate-400" />
                                ) : (
                                  <ChevronRight className="h-4 w-4 text-slate-400" />
                                )}
                                <span className="font-semibold text-slate-800 text-sm">{groupingValue}</span>
                                <span className="text-xs text-slate-500 bg-slate-200/70 px-2 py-0.5 rounded-full font-medium">
                                  {subRowsCount}
                                </span>
                              </div>
                              <div className="text-xs text-slate-500 font-medium">
                                {formatActivityGroupSubtotal(subRowsCount, totalRevenue, monthlyRevenue)}
                              </div>
                            </button>
                          </TableCell>
                        </TableRow>
                      );
                    }

                    if (row.depth > 0 && !row.getParentRow()?.getIsExpanded()) {
                      return null;
                    }

                    return (
                      <TableRow
                        key={row.id}
                        data-state={row.getIsSelected() && "selected"}
                      >
                        {row.getVisibleCells().map((cell) => {
                          if (cell.column.id === 'activityBucket' || cell.column.id === 'monthlyActivityBucket') {
                            return null;
                          }
                          const columnMeta = cell.column.columnDef.meta as any;
                          const isActions = cell.column.id === 'actions';
                          return (
                            <TableCell
                              key={cell.id}
                              className={isActions
                                ? 'w-8 min-w-[32px] max-w-[32px] p-0'
                                : `whitespace-nowrap truncate ${columnMeta?.width || ''} ${columnMeta?.className || ''}`}
                            >
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
                  <TableCell colSpan={columns.length} className="h-24 text-center text-slate-400">
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
