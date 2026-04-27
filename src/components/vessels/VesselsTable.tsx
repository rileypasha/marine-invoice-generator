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
import {
  SimpleTable as Table,
  SimpleTableBody as TableBody,
  SimpleTableCell as TableCell,
  SimpleTableHead as TableHead,
  SimpleTableHeader as TableHeader,
  SimpleTableRow as TableRow,
} from "@/components/ui/simple-table";
import { VesselSort } from "@/hooks/useVesselsQueryState";
import { MoreVertical, ChevronDown, ChevronRight, Download, Trash2 } from "lucide-react";
import { useRowActionsStore } from "@/features/vessels/state/rowActions.store";
import { bucketBySize, bucketByActivity, bucketByMonthlyActivity, formatGroupSubtotal, formatCurrency } from "@/features/vessels/grouping";
import { Button } from "@/components/ui/button";

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
  customer?: {
    id?: string;
    display_name?: string | null;
    legal_name?: string | null;
    email?: string | null;
    phone?: string | null;
    city?: string | null;
    state?: string | null;
  } | null;
}

interface VesselsTableProps {
  vessels: Vessel[];
  sort?: VesselSort | null;
  groupBy?: 'size' | 'activity' | 'monthlyActivity' | 'none';

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

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD'
});

const numberFormatter = new Intl.NumberFormat('en-US');

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

  const [rowSelection, setRowSelection] = useState({});

  const grouping = controlledGrouping ?? [];
  const expanded = controlledExpanded ?? {};

  const sortedVessels = useMemo(() => {
    if (!sort) return vessels;

    return [...vessels].sort((a, b) => {
      let aValue: any = a[sort.field as keyof Vessel];
      let bValue: any = b[sort.field as keyof Vessel];

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
  }, [vessels, sort]);

  const handleSingleDelete = useCallback((vessel: Vessel) => {
    if (onDelete) {
      onDelete(vessel);
    }
  }, [onDelete]);

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

  const handleViewInvoices = useCallback((vessel: Vessel) => {
    if (onViewInvoices) {
      onViewInvoices(vessel);
    }
  }, [onViewInvoices]);

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
        <div className="font-semibold text-slate-900 !pl-3">{row.getValue("name") || '-'}</div>
      ),
      meta: { width: 'w-48', className: '!pl-3' },
    },
    {
      id: "contact",
      header: "Contact",
      cell: ({ row }) => {
        const c = (row.original as Vessel).customer;
        if (!c) return <div className="text-slate-400">-</div>;
        const cityState = [c.city, c.state].filter(Boolean).join(', ');
        const primary = c.legal_name || c.display_name || '';
        return (
          <div className="leading-tight">
            {primary && <div className="text-slate-900">{primary}</div>}
            {c.email && <div className="text-xs text-slate-500 truncate">{c.email}</div>}
            {cityState && <div className="text-xs text-slate-400">{cityState}</div>}
            {!primary && !c.email && !cityState && <div className="text-slate-400">-</div>}
          </div>
        );
      },
      enableSorting: false,
      meta: { width: 'w-64' },
    },
    {
      accessorKey: "length_ft",
      header: "Length",
      cell: ({ row }) => {
        const length = row.getValue("length_ft") as number;
        return <div className={`tabular-nums ${length ? 'text-slate-700' : 'text-slate-400'}`}>{length ? `${numberFormatter.format(length)} ft` : '-'}</div>;
      },
      aggregationFn: 'mean',
      meta: { width: 'w-32' },
    },
    {
      accessorKey: "weight_tons",
      header: "Weight",
      cell: ({ row }) => {
        const weight = row.getValue("weight_tons") as number;
        return <div className={`tabular-nums ${weight ? 'text-slate-700' : 'text-slate-400'}`}>{weight ? `${numberFormatter.format(weight)} tons` : '-'}</div>;
      },
      aggregationFn: 'mean',
      meta: { width: 'w-32' },
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
        const vessel = row.original;

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
                  rowId: vessel.id,
                  pos: { top: r.bottom + window.scrollY, left },
                  handlers: {
                    viewInvoices: () => handleViewInvoices(vessel),
                    newInvoice: () => handleNewInvoice(vessel),
                    edit: () => onEdit?.(vessel.id) || navigate(`/vessels/${vessel.id}/edit`),
                    del: () => handleSingleDelete(vessel),
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
      id: 'sizeBucket',
      header: 'Size',
      accessorFn: (row) => bucketBySize(row.length_ft).label,
      enableGrouping: true,
      cell: ({ row }) => null,
      enableSorting: false,
      enableHiding: false,
    },
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
    data: sortedVessels,
    columns,
    state: {
      grouping,
      expanded,
      rowSelection,
    },
    getRowId: (row) => row.id,
    onGroupingChange: (updater) => {
      if (!onGroupingChange) return;
      const next = typeof updater === 'function' ? updater(grouping) : updater;
      onGroupingChange(next);
    },
    onExpandedChange: (updater) => {
      if (!onExpandedChange) return;
      const next = typeof updater === 'function' ? updater(expanded) : updater;
      onExpandedChange(next);
    },
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
  const selectedVessels = selectedRows.map(row => row.original);

  return (
    <>
      <div className="screen-only">
        <div className="overflow-x-auto relative">
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
                    onClick={() => onBulkDelete(selectedVessels)}
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
                    onClick={() => onBulkExport(selectedVessels)}
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
                    if (header.column.id === 'sizeBucket' || header.column.id === 'activityBucket' || header.column.id === 'monthlyActivityBucket') {
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
                    const avgLength = row.subRows.length > 0
                      ? row.subRows.reduce((sum, subRow) => sum + (subRow.original.length_ft || 0), 0) / row.subRows.length
                      : 0;
                    const avgWeight = row.subRows.length > 0
                      ? row.subRows.reduce((sum, subRow) => sum + (subRow.original.weight_tons || 0), 0) / row.subRows.length
                      : 0;

                    return (
                      <TableRow
                        key={row.id}
                        className="sticky top-[36px] z-10 bg-slate-50 hover:bg-slate-100/80 border-b border-slate-200"
                      >
                        <TableCell colSpan={columns.length - 2} className="py-2.5">
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
                              {formatGroupSubtotal(subRowsCount, totalRevenue, avgLength, avgWeight)}
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
                        if (cell.column.id === 'sizeBucket' || cell.column.id === 'activityBucket' || cell.column.id === 'monthlyActivityBucket') {
                          return null;
                        }
                        const columnMeta = cell.column.columnDef.meta as any;
                        const isActions = cell.column.id === 'actions';
                        return (
                          <TableCell
                            key={cell.id}
                            className={isActions
                              ? 'w-8 min-w-[32px] max-w-[32px] p-0'
                              : `${columnMeta?.width || ''} ${columnMeta?.className || ''}`}
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
  )
}
