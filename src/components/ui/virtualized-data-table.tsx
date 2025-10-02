"use client"

import * as React from "react"
import { useVirtualizer } from '@tanstack/react-virtual'
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table"
import { ArrowUpDown, ChevronDown, Plus, Printer, Upload, Download, Trash2, X, Search } from "lucide-react"
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
import {
  SimpleTable as Table,
  SimpleTableBody as TableBody,
  SimpleTableCell as TableCell,
  SimpleTableHead as TableHead,
  SimpleTableHeader as TableHeader,
  SimpleTableRow as TableRow,
} from "@/components/ui/simple-table"

interface VirtualizedDataTableProps<TData, TValue> {
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
  title?: React.ReactNode
  colWidths?: Array<{ id: string; w: string }>
  rowHeight?: number
}

export function VirtualizedDataTable<TData, TValue>({
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
  title,
  colWidths,
  rowHeight = 45, // Default row height in pixels
}: VirtualizedDataTableProps<TData, TValue>) {
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

  const tableContainerRef = React.useRef<HTMLDivElement>(null)
  const { rows } = table.getRowModel()

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => rowHeight,
    overscan: 10, // Render 10 extra rows above and below the viewport
  })

  const selectedRows = table.getFilteredSelectedRowModel().rows.map(row => row.original)
  const hasSelection = selectedRows.length > 0

  return (
    <div className="w-full">
      {/* Toolbar */}
      <div className="flex flex-col gap-2 mb-4 py-2">
        {title && <div className="text-2xl font-bold">{title}</div>}
        {(showAddButton || onPrint || onImport || onExport || hasSelection) && (
          <>
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                {showAddButton && onAddClick && (
                  <Button variant="default" size="sm" onClick={onAddClick} className="h-9 px-3">
                    <Plus className="mr-2 h-4 w-4" />
                    {addButtonText}
                  </Button>
                )}
                {onPrint && (
                  <Button variant="outline" size="sm" onClick={onPrint} className="h-9 px-3">
                    <Printer className="mr-2 h-4 w-4" />
                    Print
                  </Button>
                )}
                {onImport && (
                  <Button variant="outline" size="sm" onClick={onImport} className="h-9 px-3">
                    <Upload className="mr-2 h-4 w-4" />
                    Import
                  </Button>
                )}
                {onExport && (
                  <Button variant="outline" size="sm" onClick={onExport} className="h-9 px-3">
                    <Download className="mr-2 h-4 w-4" />
                    Export
                  </Button>
                )}
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="ml-auto h-9 px-3">
                    <span className="hidden sm:inline">Columns</span>
                    <ChevronDown className="ml-2 h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {table
                    .getAllColumns()
                    .filter((column) => column.getCanHide())
                    .map((column) => {
                      return (
                        <DropdownMenuCheckboxItem
                          key={column.id}
                          className="capitalize"
                          checked={column.getIsVisible()}
                          onCheckedChange={(value) => column.toggleVisibility(!!value)}
                        >
                          {column.id}
                        </DropdownMenuCheckboxItem>
                      )
                    })}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            {hasSelection && (
              <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-md px-4 py-2">
                <span className="text-sm font-medium text-blue-900">
                  {selectedRows.length} row{selectedRows.length !== 1 ? 's' : ''} selected
                </span>
                <div className="flex items-center gap-2 ml-auto">
                  {onBulkExport && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onBulkExport(selectedRows)}
                      className="h-8 px-3 text-blue-900 hover:bg-blue-100"
                    >
                      <Download className="mr-2 h-4 w-4" />
                      Export Selected
                    </Button>
                  )}
                  {onBulkDelete && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onBulkDelete(selectedRows)}
                      className="h-8 px-3 text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete Selected
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => table.resetRowSelection()}
                    className="h-8 w-8 p-0 text-blue-900 hover:bg-blue-100"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
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

      {/* Virtualized Table */}
      <div className="overflow-x-auto">
        <div className="min-w-[1200px] md:min-w-0">
          <div
            ref={tableContainerRef}
            className="h-[calc(100vh-300px)] overflow-auto relative"
          >
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
              <TableBody
                className="text-[13.5px]"
                style={{
                  height: `${rowVirtualizer.getTotalSize()}px`,
                  position: 'relative',
                }}
              >
                {rowVirtualizer.getVirtualItems().length ? (
                  rowVirtualizer.getVirtualItems().map((virtualRow) => {
                    const row = rows[virtualRow.index]
                    return (
                      <TableRow
                        key={row.id}
                        data-state={row.getIsSelected() && "selected"}
                        className={`border-b border-gray-200 absolute w-full ${
                          virtualRow.index % 2 === 0 ? 'bg-white hover:bg-gray-50' : 'bg-gray-50/50 hover:bg-gray-100'
                        }`}
                        style={{
                          height: `${virtualRow.size}px`,
                          transform: `translateY(${virtualRow.start}px)`,
                        }}
                      >
                        {row.getVisibleCells().map((cell) => {
                          const columnMeta = cell.column.columnDef.meta as any
                          return (
                            <TableCell
                              key={cell.id}
                              className={`text-sm text-foreground align-middle px-6 py-3 md:px-4 xl:px-6 first:pl-6 last:pr-6 truncate ${columnMeta?.width || ''} ${columnMeta?.minWidth || ''} ${columnMeta?.className || ''}`}
                            >
                              {flexRender(
                                cell.column.columnDef.cell,
                                cell.getContext(),
                              )}
                            </TableCell>
                          )
                        })}
                      </TableRow>
                    )
                  })
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

      {/* Row count */}
      <div className="flex items-center justify-between space-x-2 py-4">
        <div className="flex-1 text-sm text-muted-foreground">
          {table.getFilteredSelectedRowModel().rows.length} of{" "}
          {table.getFilteredRowModel().rows.length} row(s) selected.
        </div>
      </div>
    </div>
  )
}
