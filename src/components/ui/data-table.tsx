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
import { ArrowUpDown, ChevronDown, MoreHorizontal, Plus, Printer, Upload, Download, Trash2, X, Search } from "lucide-react"

import { SimpleButton as Button } from "@/components/ui/simple-button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
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

  return (
    <div className="w-full">
      <div className={`flex items-center ${hasSelectedRows ? 'py-2' : 'py-1'}`}>
        {!hasSelectedRows ? (
          <>
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
                {onPrint && (
                  <DropdownMenuItem onClick={onPrint}>
                    <Printer className="mr-2 h-4 w-4" />
                    Print this page
                  </DropdownMenuItem>
                )}
                {onImport && (
                  <DropdownMenuItem onClick={onImport}>
                    <Upload className="mr-2 h-4 w-4" />
                    Import data from CSV
                  </DropdownMenuItem>
                )}
                {onExport && (
                  <DropdownMenuItem onClick={onExport}>
                    <Download className="mr-2 h-4 w-4" />
                    Export data as CSV
                  </DropdownMenuItem>
                )}
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
          </>
        ) : (
          <>
            <div className="flex items-center pl-6">
              {title && <div className="mr-4">{title}</div>}
              <span className="text-sm font-medium">
                {selectedRows.length} item{selectedRows.length === 1 ? '' : 's'} selected
              </span>
            </div>
            <div className="flex items-center gap-2 ml-auto pr-6">
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
                  onClick={() => onBulkDelete(selectedRows)}
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
                  onClick={() => onBulkExport(selectedRows)}
                  className="h-8 px-2 text-xs transition-none"
                >
                  <Download className="h-3 w-3 mr-1" />
                  Export
                </Button>
              )}
              {showAddButton && (
                <Button onClick={onAddClick} className="h-8 px-3 text-xs transition-none !bg-[#1E3A5F] !text-white hover:!bg-[#152b47]">
                  <Plus className="h-3 w-3 mr-1" />
                  {addButtonText}
                </Button>
              )}
            </div>
          </>
        )}
      </div>
      {searchColumn && (
        <div className="flex justify-end -mt-2 pb-4">
          <div className={`flex items-center border border-gray-300 rounded-md transition-all duration-300 ease-in-out overflow-hidden ${
            showSearch
              ? 'w-64 bg-white'
              : 'w-8 bg-white hover:bg-gray-100'
          }`}>
            <input
              className={`flex-1 h-6 outline-none transition-all duration-300 bg-transparent ${
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
              className="h-8 w-8 flex items-center justify-center flex-shrink-0 hover:bg-gray-100 transition-colors"
              type="button"
            >
              <Search className="h-3 w-3" />
            </button>
          </div>
        </div>
      )}
      {/* Airtable-style table without card wrapper - wrapped for mobile horizontal scroll */}
      <div className="overflow-x-auto">
        <div style={{ minWidth: '1200px' }}>
          <Table className="w-full table-fixed border-collapse">
            {colWidths && (
              <colgroup>
                {colWidths.map(col => (
                  <col key={col.id} style={{ width: col.w }} />
                ))}
              </colgroup>
            )}
            <TableHeader className="sticky top-0 z-20 bg-gray-50 border-b border-gray-200">
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => {
                const columnMeta = header.column.columnDef.meta as any
                return (
                  <TableHead
                    key={header.id}
                    className={`font-medium text-muted-foreground tracking-wide px-6 py-3 md:px-4 xl:px-6 first:pl-6 last:pr-6 ${columnMeta?.width || ''} ${columnMeta?.minWidth || ''} ${columnMeta?.className || ''}`}
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
        <TableBody className="text-[13.5px]">
          {table.getRowModel().rows?.length ? (
            table.getRowModel().rows.map((row, index) => (
              <TableRow
                key={row.id}
                data-state={row.getIsSelected() && "selected"}
                className={`border-b border-gray-200 ${
                  index % 2 === 0 ? 'bg-white hover:bg-gray-50' : 'bg-gray-50/50 hover:bg-gray-100'
                }`}
              >
                {row.getVisibleCells().map((cell) => {
                  const columnMeta = cell.column.columnDef.meta as any
                  return (
                    <TableCell
                      key={cell.id}
                      className={`text-sm text-foreground align-middle px-6 py-3 md:px-4 xl:px-6 first:pl-6 last:pr-6 ${columnMeta?.width || ''} ${columnMeta?.minWidth || ''} ${columnMeta?.className || ''}`}
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
                className="h-24 text-center py-2.5 px-3"
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
