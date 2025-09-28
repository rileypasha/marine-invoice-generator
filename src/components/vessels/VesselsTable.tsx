import React, { useMemo, useCallback } from "react";
import { useNavigate } from 'react-router-dom';
import { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/ui/data-table";
import { Checkbox as TableCheckbox } from "@/components/ui/checkbox";
import { PaginatedPrintTable } from "@/components/ui/paginated-print-table";
import { VesselSort } from "@/hooks/useVesselsQueryState";
import { MoreHorizontal } from "lucide-react";
import { useRowActionsStore } from "@/features/vessels/state/rowActions.store";

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
}

interface VesselsTableProps {
  vessels: Vessel[];
  sort?: VesselSort | null;
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
      key: 'invoice_count' as keyof Vessel,
      header: 'Invoices',
      render: (value: any) => value || 0
    },
    {
      key: 'invoice_total' as keyof Vessel,
      header: 'Total',
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
      meta: { width: 'w-32' },
    },
    {
      accessorKey: "weight_tons",
      header: "Weight",
      cell: ({ row }) => {
        const weight = row.getValue("weight_tons") as number
        return <div>{weight ? `${weight} tons` : '-'}</div>
      },
      meta: { width: 'w-32' },
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
  ], [navigate, onEdit, onDelete, handleNewInvoice, handleViewInvoices, handleSingleDelete, openRowActions]);

  return (
    <>
      {/* Screen-only interactive table with Airtable-style layout */}
      <div className="screen-only">
        <div>
          <div>
            <DataTable
              columns={columns}
              data={sortedVessels}
              onBulkDelete={onBulkDelete}
              onBulkExport={onBulkExport}
              title={title}
            />
          </div>
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