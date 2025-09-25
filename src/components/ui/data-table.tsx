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
import { ArrowUpDown, ChevronDown, MoreHorizontal, Plus, Printer, Upload, Download, Trash2, X } from "lucide-react"

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
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationEllipsis,
} from "@/components/ui/pagination"

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
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({})
  const [rowSelection, setRowSelection] = React.useState({})

  const table = useReactTable({
    data,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    initialState: {
      pagination: {
        pageSize: 25,
      },
    },
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
      <div className="flex items-center py-4">
        {!hasSelectedRows ? (
          <>
            {searchColumn && (
              <Input
                placeholder={searchPlaceholder}
                value={(table.getColumn(searchColumn)?.getFilterValue() as string) ?? ""}
                onChange={(event) =>
                  table.getColumn(searchColumn)?.setFilterValue(event.target.value)
                }
                className="flex-1 mr-4 h-8"
              />
            )}
            <div className="flex items-center gap-2">
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
                <Button onClick={onAddClick} className="h-8 px-3 text-xs transition-none !bg-black !text-white hover:!bg-gray-800">
                  <Plus className="h-3 w-3 mr-1" />
                  {addButtonText}
                </Button>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center flex-1 mr-4">
              <span className="text-sm font-medium">
                {selectedRows.length} item{selectedRows.length === 1 ? '' : 's'} selected
              </span>
            </div>
            <div className="flex items-center gap-2">
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
                <Button onClick={onAddClick} className="h-8 px-3 text-xs transition-none !bg-black !text-white hover:!bg-gray-800">
                  <Plus className="h-3 w-3 mr-1" />
                  {addButtonText}
                </Button>
              )}
            </div>
          </>
        )}
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader style={{ backgroundColor: '#f9f9f9' }}>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead key={header.id}>
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
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-between py-4 px-1">
        <div className="flex items-center space-x-2">
          <p className="text-sm font-medium">Rows per page</p>
          <Select
            value={`${table.getState().pagination.pageSize}`}
            onValueChange={(value) => {
              table.setPageSize(Number(value))
            }}
          >
            <SelectTrigger className="h-8 w-[70px]">
              <SelectValue placeholder={table.getState().pagination.pageSize} />
            </SelectTrigger>
            <SelectContent side="top">
              {[10, 25, 50].map((pageSize) => (
                <SelectItem key={pageSize} value={`${pageSize}`}>
                  {pageSize}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center space-x-2 -mr-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            className="h-8 px-3"
          >
            Previous
          </Button>

          <div className="flex items-center space-x-1">
            {Array.from({ length: Math.min(7, table.getPageCount()) }, (_, i) => {
              const currentPage = table.getState().pagination.pageIndex
              const totalPages = table.getPageCount()

              let pageNumber: number
              if (totalPages <= 7) {
                pageNumber = i
              } else if (currentPage < 4) {
                pageNumber = i
              } else if (currentPage > totalPages - 5) {
                pageNumber = totalPages - 7 + i
              } else {
                pageNumber = currentPage - 3 + i
              }

              if (pageNumber < 0 || pageNumber >= totalPages) return null

              const isActive = pageNumber === currentPage

              return (
                <Button
                  key={pageNumber}
                  variant={isActive ? "default" : "outline"}
                  size="sm"
                  onClick={() => table.setPageIndex(pageNumber)}
                  className={`h-8 w-8 p-0 ${isActive ? 'bg-black hover:bg-gray-800 text-white' : 'hover:bg-gray-100'}`}
                >
                  {pageNumber + 1}
                </Button>
              )
            })}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            className="h-8 px-3"
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  )
}