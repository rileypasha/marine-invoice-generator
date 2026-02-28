"use client"

import * as React from "react"
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table"
import { ArrowUpDown, ChevronDown, MoreHorizontal, Plus, Printer, Upload, Download, Trash2, Search } from "lucide-react"

import { SimpleButton as Button } from "@/components/ui/simple-button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import {
  SimpleTable as Table,
  SimpleTableBody as TableBody,
  SimpleTableCell as TableCell,
  SimpleTableHead as TableHead,
  SimpleTableHeader as TableHeader,
  SimpleTableRow as TableRow,
} from "@/components/ui/simple-table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
  searchPlaceholder?: string
  searchColumn?: string
  onRowAction?: (row: TData, action: string) => void
  showAddButton?: boolean
  addButtonText?: string
  onAddClick?: () => void
  onPrint?: () => void
  onImport?: () => void
  onExport?: () => void
  onBulkDelete?: (selectedRows: TData[]) => void
  onBulkExport?: (selectedRows: TData[]) => void
  initialPageSize?: number
  title?: React.ReactNode
  colWidths?: Array<{ id: string; w: string }>
}

export function DataTable<TData, TValue>({
  columns,
  data,
  searchPlaceholder = "Filter data...",
  searchColumn,
  onRowAction,
  showAddButton = false,
  addButtonText = "Add",
  onAddClick,
  onPrint,
  onImport,
  onExport,
  onBulkDelete,
  onBulkExport,
  initialPageSize = 25,
  title,
  colWidths,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({})
  const [rowSelection, setRowSelection] = React.useState({})
  const [showSearch, setShowSearch] = React.useState(false)

  const table = useReactTable({
    data,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
    },
  })

  const selectedRows = table.getFilteredSelectedRowModel().rows.map(row => row.original)
  const hasSelectedRows = selectedRows.length > 0
  const hasTopBar = !!title || showAddButton || onPrint || onImport || onExport

  return (
    <div className="w-full">
      {hasTopBar && (
        <div className="flex items-center py-1">
          {title && <div className="flex-1">{title}</div>}
          <div className="flex items-center gap-2 ml-auto">
            {(onPrint || onImport || onExport) && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="h-8 px-2 text-xs">
                    <MoreHorizontal className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                <div className="w-[200px]" onClick={(e) => e.stopPropagation()}>
                  <div className="px-3 pt-2.5 pb-2">
                    <span className="text-[13px] font-semibold text-gray-900">Actions</span>
                  </div>
                  <div className="h-px bg-gray-100" />
                  <div className="px-1.5 py-1.5 space-y-0.5">
                    {onPrint && (
                      <button
                        onClick={onPrint}
                        className="flex items-center gap-2 w-full px-2.5 py-2 text-[13px] rounded-md transition-colors text-gray-600 hover:bg-gray-50"
                      >
                        <Printer className="h-4 w-4 text-gray-400 flex-shrink-0" />
                        Print this page
                      </button>
                    )}
                    {onImport && (
                      <button
                        onClick={onImport}
                        className="flex items-center gap-2 w-full px-2.5 py-2 text-[13px] rounded-md transition-colors text-gray-600 hover:bg-gray-50"
                      >
                        <Upload className="h-4 w-4 text-gray-400 flex-shrink-0" />
                        Import from CSV
                      </button>
                    )}
                    {onExport && (
                      <button
                        onClick={onExport}
                        className="flex items-center gap-2 w-full px-2.5 py-2 text-[13px] rounded-md transition-colors text-gray-600 hover:bg-gray-50"
                      >
                        <Download className="h-4 w-4 text-gray-400 flex-shrink-0" />
                        Export as CSV
                      </button>
                    )}
                  </div>
                </div>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            {showAddButton && (
              <Button onClick={onAddClick} className="h-8 px-3 text-xs transition-none !bg-[#1E3A5F] !text-white hover:!bg-[#152b47]">
                <Plus className="h-3 w-3 mr-1" />
                {addButtonText}
              </Button>
            )}
          </div>
        </div>
      )}
      {searchColumn && (
        <div className="flex justify-end -mt-2 pb-4">
          <div className={`flex items-center border border-slate-200 rounded-lg transition-[width,background-color,box-shadow] duration-300 ease-in-out overflow-hidden ${
            showSearch
              ? 'w-64 bg-white shadow-sm'
              : 'w-8 bg-white hover:bg-slate-50'
          }`}>
            <input
              className={`flex-1 h-6 outline-none transition-all duration-300 bg-transparent text-sm ${
                showSearch ? 'opacity-100 px-3' : 'opacity-0 w-0 px-0'
              }`}
              placeholder={showSearch ? searchPlaceholder : ''}
              value={(table.getColumn(searchColumn)?.getFilterValue() as string) ?? ""}
              onChange={(event) =>
                table.getColumn(searchColumn)?.setFilterValue(event.target.value)
              }
              disabled={!showSearch}
            />
            <button
              onClick={() => setShowSearch(!showSearch)}
              className="h-8 w-8 flex items-center justify-center flex-shrink-0 hover:bg-slate-100 transition-colors rounded-lg"
              type="button"
            >
              <Search className="h-3 w-3 text-slate-400" />
            </button>
          </div>
        </div>
      )}
      {/* Clean table container */}
      <div className="bg-white rounded-b-lg relative">
        {/* Bulk action bar — overlays header row when rows are selected */}
        {hasSelectedRows && (
          <div className="absolute top-0 left-0 right-0 z-20 h-[45px] bg-white flex items-center border-b border-slate-200">
            <div className="flex items-center pl-6 gap-3">
              <Checkbox
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
                  onClick={() => onBulkDelete(selectedRows)}
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
                  onClick={() => onBulkExport(selectedRows)}
                  className="h-7 px-2 text-xs transition-none"
                >
                  <Download className="h-3 w-3 mr-1" />
                  Export
                </Button>
              )}
            </div>
          </div>
        )}
        <div style={{ minWidth: '1200px' }}>
          <Table className="w-full table-fixed border-collapse bg-white">
            {colWidths && (
              <colgroup>
                {colWidths.map(col => (
                  <col key={col.id} style={{ width: col.w }} />
                ))}
              </colgroup>
            )}
            <TableHeader className="sticky top-0 z-10 bg-white">
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id} className="border-b border-slate-200 hover:bg-white bg-white">
              {headerGroup.headers.map((header) => {
                const columnMeta = header.column.columnDef.meta as any
                return (
                  <TableHead
                    key={header.id}
                    className={`px-3 py-3 first:pl-6 last:pr-6 bg-white ${columnMeta?.width || ''} ${columnMeta?.minWidth || ''} ${columnMeta?.className || ''}`}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                  </TableHead>
                )
              })}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows?.length ? (
            table.getRowModel().rows.map((row, index) => (
              <TableRow
                key={row.id}
                data-state={row.getIsSelected() && "selected"}
              >
                {row.getVisibleCells().map((cell) => {
                  const columnMeta = cell.column.columnDef.meta as any
                  return (
                    <TableCell
                      key={cell.id}
                      className={`text-sm align-middle px-3 py-3 first:pl-6 last:pr-6 ${columnMeta?.width || ''} ${columnMeta?.minWidth || ''} ${columnMeta?.className || ''}`}
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </TableCell>
                  )
                })}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell
                colSpan={columns.length}
                className="h-24 text-center py-2.5 px-3 text-slate-400"
              >
                No results.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
        </div>
      </div>
    </div>
  )
}
