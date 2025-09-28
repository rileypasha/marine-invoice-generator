import React, { useMemo, useCallback, useState, useEffect } from "react";
import { useNavigate } from 'react-router-dom';
import {
  ColumnDef,
  GroupingState,
  ExpandedState,
  useReactTable,
  getCoreRowModel,
  getGroupedRowModel,
  getExpandedRowModel,
  getSortedRowModel,
  flexRender
} from "@tanstack/react-table";
import { Checkbox as TableCheckbox } from "@/components/ui/checkbox";
import { PaginatedPrintTable } from "@/components/ui/paginated-print-table";
import {
  SimpleTable as Table,
  SimpleTableBody as TableBody,
  SimpleTableCell as TableCell,
  SimpleTableHead as TableHead,
  SimpleTableHeader as TableHeader,
  SimpleTableRow as TableRow,
} from "@/components/ui/simple-table";
import { VesselSort } from "@/hooks/useVesselsQueryState";
import { MoreHorizontal, ChevronDown, ChevronRight } from "lucide-react";
import { useRowActionsStore } from "@/features/vessels/state/rowActions.store";
import { bucketBySize, bucketByActivity, formatGroupSubtotal, formatCurrency } from "@/features/vessels/grouping";

// Column width definitions for consistent spacing across all tables
const VESSELS_COLS = [
  { id: 'select', w: '4%' },            // Checkbox column
  { id: 'name', w: '20%' },             // Vessel name column
  { id: 'length', w: '12%' },           // Length column (right-aligned)
  { id: 'weight', w: '12%' },           // Weight column (right-aligned)
  { id: 'monthly_invoices', w: '10%' }, // Monthly invoices count column (centered)
  { id: 'monthly_total', w: '14%' },    // Monthly total amount column (centered)
  { id: 'invoices', w: '10%' },         // Invoices count column (centered)
  { id: 'total', w: '12%' },            // Total amount column (centered)
  { id: 'actions', w: '6%' }            // Actions column
];

interface Vessel {
  id: string;
  name?: string;
  length_ft?: number;
  weight_tons?: number;
  type?: string;
  imo_number?: string;
  flag?: string;
  owner?: string;
  invoice_count?: number;
  invoice_total?: number;
  monthly_invoice_count?: number;
  monthly_invoice_total?: number;
}

interface VesselsTableProps {
  vessels: Vessel[];
  sort?: VesselSort | null;
  groupBy?: 'size' | 'activity' | 'none';

  // Controlled state props
  grouping?: GroupingState;
  expanded?: ExpandedState;
  onGroupingChange?: (grouping: GroupingState) => void;
  onExpandedChange?: (expanded: ExpandedState) => void;

  onEdit?: (id: string) => void;
  onDelete?: (vessel: Vessel) => void;
  onBulkDelete?: (selectedRows: Vessel[]) => void;
  onBulkExport?: (selectedRows: Vessel[]) => void;
  onViewInvoices?: (vessel: Vessel) => void;
  onNewInvoice?: (vessel: Vessel) => void;
  title?: React.ReactNode;
}

export function VesselsTable({
  vessels,
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
}: VesselsTableProps) {
  const navigate = useNavigate();
  const openRowActions = useRowActionsStore((s) => s.openAt);

  // Use controlled state or fallback to defaults
  const grouping = controlledGrouping ?? [];
  const expanded = controlledExpanded ?? {};

  // Note: No useEffect needed - parent manages grouping state synchronization

  // Sort vessels based on the sort prop
  const sortedVessels = useMemo(() => {
    if (!sort) return vessels;

    return [...vessels].sort((a, b) => {
      let aValue: any = a[sort.field as keyof Vessel];
      let bValue: any = b[sort.field as keyof Vessel];

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
  }, [vessels, sort]);

  // Handle single vessel delete
  const handleSingleDelete = useCallback((vessel: Vessel) => {
    if (onDelete) {
      onDelete(vessel);
    }
  }, [onDelete]);

  // Handle new invoice for vessel
  const handleNewInvoice = useCallback((vessel: Vessel) => {
    if (onNewInvoice) {
      onNewInvoice(vessel);
    } else {
      const params = new URLSearchParams({
        vesselId: vessel.id,
        vesselName: vessel.name || '',
        vesselWeight: vessel.weight_tons?.toString() || '',
        vesselLength: vessel.length_ft?.toString() || ''
      });
      navigate(`/requests/new?${params.toString()}`);
    }
  }, [onNewInvoice, navigate]);

  // Handle view invoices click
  const handleViewInvoices = useCallback((vessel: Vessel) => {
    if (onViewInvoices) {
      onViewInvoices(vessel);
    }
  }, [onViewInvoices]);

  // Print columns definition - includes ALL columns
  const printColumns = [
    { key: 'name' as keyof Vessel, header: 'Vessel' },
    {
      key: 'length_ft' as keyof Vessel,
      header: 'Length',
      render: (value: any) => value ? `${value} ft` : '-'
    },
    {
      key: 'weight_tons' as keyof Vessel,
      header: 'Weight',
      render: (value: any) => value ? `${value} tons` : '-'
    },
    {
      key: 'monthly_invoice_count' as keyof Vessel,
      header: 'Monthly Invoices',
      render: (value: any) => value || 0
    },
    {
      key: 'monthly_invoice_total' as keyof Vessel,
      header: 'Monthly Amount',
      render: (value: any) => (value || 0).toLocaleString('en-US', {
        style: 'currency',
        currency: 'USD'
      })
    },
    {
      key: 'invoice_count' as keyof Vessel,
      header: 'Total Invoices',
      render: (value: any) => value || 0
    },
    {
      key: 'invoice_total' as keyof Vessel,
      header: 'Total Amount',
      render: (value: any) => (value || 0).toLocaleString('en-US', {
        style: 'currency',
        currency: 'USD'
      })
    }
  ];

  // Define columns for DataTable - wrapped in useMemo to prevent recreation on every render
  const columns: ColumnDef<Vessel>[] = useMemo(() => [
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
      accessorKey: "name",
      header: () => (
        <div className="!pl-3">Vessel</div>
      ),
      cell: ({ row }) => (
        <div className="font-medium !pl-3">{row.getValue("name") || '-'}</div>
      ),
      meta: { width: 'w-48', className: '!pl-3' },
    },
    {
      accessorKey: "length_ft",
      header: "Length",
      cell: ({ row }) => {
        const length = row.getValue("length_ft") as number
        return <div>{length ? `${length} ft` : '-'}</div>
      },
      aggregationFn: 'mean',
      meta: { width: 'w-32' },
    },
    {
      accessorKey: "weight_tons",
      header: "Weight",
      cell: ({ row }) => {
        const weight = row.getValue("weight_tons") as number
        return <div>{weight ? `${weight} tons` : '-'}</div>
      },
      aggregationFn: 'mean',
      meta: { width: 'w-32' },
    },
    {
      accessorKey: "monthly_invoice_count",
      header: ({ column }) => (
        <div className="text-center">Monthly Invoices</div>
      ),
      cell: ({ row }) => {
        const count = row.getValue("monthly_invoice_count") as number
        return <div className="text-center">{count || 0}</div>
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
        const total = row.getValue("monthly_invoice_total") as number
        return (
          <div className="text-center">
            {(total || 0).toLocaleString('en-US', {
              style: 'currency',
              currency: 'USD'
            })}
          </div>
        )
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
        const count = row.getValue("invoice_count") as number
        return <div className="text-center">{count || 0}</div>
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
      aggregationFn: 'sum',
      meta: { width: 'w-32' },
    },
    {
      id: "actions",
      header: "",
      enableHiding: false,
      meta: { width: 'w-16' },
      cell: ({ row }) => {
        const vessel = row.original;

        return (
          <button
            aria-label="Row actions"
            data-row-actions-trigger
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
              openRowActions({
                rowId: vessel.id,
                pos: { top: r.bottom + window.scrollY, left: r.left + window.scrollX },
                handlers: {
                  viewInvoices: (id) => handleViewInvoices(vessel),
                  newInvoice: (id) => handleNewInvoice(vessel),
                  edit: (id) => onEdit?.(vessel.id) || navigate(`/vessels/${vessel.id}/edit`),
                  del: (id) => handleSingleDelete(vessel),
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
    // Virtual grouping columns
    {
      id: 'sizeBucket',
      header: 'Size',
      accessorFn: (row) => bucketBySize(row.length_ft).label,
      enableGrouping: true,
      cell: ({ row }) => null, // Hidden in normal rows
      enableSorting: false,
      enableHiding: false,
    },
    {
      id: 'activityBucket',
      header: 'Activity',
      accessorFn: (row) => bucketByActivity(row.invoice_count).label,
      enableGrouping: true,
      cell: ({ row }) => null, // Hidden in normal rows
      enableSorting: false,
      enableHiding: false,
    },
  ], []); // Stable column definitions - callbacks captured in closure

  // TanStack Table setup with grouping
  const table = useReactTable({
    data: sortedVessels,
    columns,
    state: {
      grouping,
      expanded,
    },
    getRowId: (row) => row.id, // Stable unique ID for proper expansion state
    onGroupingChange,
    onExpandedChange,
    getCoreRowModel: getCoreRowModel(),
    getGroupedRowModel: getGroupedRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getSortedRowModel: getSortedRowModel(),
    enableGrouping: true,
    // CRITICAL: prevent resets that collapse groups
    autoResetAll: false,
    autoResetExpanded: false,
  });

  return (
    <>
      {/* Screen-only interactive table with Airtable-style layout */}
      <div className="screen-only">
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => {
                    // Skip virtual grouping columns in header
                    if (header.column.id === 'sizeBucket' || header.column.id === 'activityBucket') {
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
                table.getRowModel().rows.map((row) => {
                  if (row.getIsGrouped()) {
                    // Group header row
                    const groupingValue = row.groupingValue as string;
                    const subRowsCount = row.subRows.length;
                    const isExpanded = row.getIsExpanded();

                    // Calculate aggregated values for group
                    const totalRevenue = row.subRows.reduce((sum, subRow) =>
                      sum + (subRow.original.invoice_total || 0), 0);
                    const avgLength = row.subRows.length > 0
                      ? row.subRows.reduce((sum, subRow) => sum + (subRow.original.length_ft || 0), 0) / row.subRows.length
                      : 0;
                    const avgWeight = row.subRows.length > 0
                      ? row.subRows.reduce((sum, subRow) => sum + (subRow.original.weight_tons || 0), 0) / row.subRows.length
                      : 0;

                    return (
                      <TableRow
                        key={row.id}
                        className="sticky top-[48px] z-10 bg-gray-50 hover:bg-gray-100 border-b-2 border-gray-200"
                      >
                        <TableCell colSpan={columns.length - 2} className="py-3">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              row.getToggleExpandedHandler()(e);
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
                              {formatGroupSubtotal(subRowsCount, totalRevenue, avgLength, avgWeight)}
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

                  return (
                    <TableRow
                      key={row.id}
                      data-state={row.getIsSelected() && "selected"}
                    >
                      {row.getVisibleCells().map((cell) => {
                        // Skip virtual grouping columns in data rows
                        if (cell.column.id === 'sizeBucket' || cell.column.id === 'activityBucket') {
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
                })
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

      {/* Print-only paginated table */}
      <PaginatedPrintTable
        columns={printColumns}
        rows={sortedVessels}
        approxRowsPerPage={26}
      />
    </>
  )
}