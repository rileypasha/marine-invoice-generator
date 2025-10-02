import * as React from "react"

// Type definition for table columns
type Column<T> = {
  key: keyof T
  header: string
  render?: (value: any, row: T) => React.ReactNode
}

// Utility function to chunk array into pages
function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size))
  }
  return out
}

interface PaginatedPrintTableProps<T> {
  columns: Column<T>[]
  rows: T[]
  approxRowsPerPage?: number
  className?: string
}

/**
 * PaginatedPrintTable - Guaranteed header repetition for print
 *
 * Renders ONLY in print view, splits data into chunks and creates
 * one complete table per chunk. Each table has its own header,
 * ensuring headers appear at the top of every printed page.
 *
 * Usage:
 * const columns = [
 *   { key: 'name', header: 'Name' },
 *   { key: 'email', header: 'Email' },
 * ] as const;
 *
 * <PaginatedPrintTable
 *   columns={columns}
 *   rows={data}
 *   approxRowsPerPage={26}
 * />
 */
function PaginatedPrintTableComponent<T>({
  columns,
  rows,
  approxRowsPerPage = 25,
  className = ""
}: PaginatedPrintTableProps<T>) {
  const pages = React.useMemo(() => chunk(rows, approxRowsPerPage), [rows, approxRowsPerPage])

  if (pages.length === 0) {
    return null
  }

  return (
    <div className={`print-only ${className}`}>
      {pages.map((page, pageIndex) => (
        <div key={`page-${pageIndex}`}>
          <table className="w-full border-collapse print:table">
            <thead className="print:table-header-group">
              <tr className="print:table-row">
                {columns.map((col) => (
                  <th
                    key={String(col.key)}
                    className="border border-black p-2 text-left bg-gray-100 font-bold print:table-cell min-w-[120px]"
                  >
                    {col.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="print:table-row-group">
              {page.map((row, rowIndex) => {
                const rowId = (row as any).id || `row-${pageIndex}-${rowIndex}`;
                return (
                <tr key={rowId} className="print:table-row">
                  {columns.map((col) => (
                    <td
                      key={String(col.key)}
                      className="border border-black p-2 align-top print:table-cell min-w-[120px] break-words"
                    >
                      {col.render
                        ? col.render((row as any)[col.key], row)
                        : String((row as any)[col.key] || '-')
                      }
                    </td>
                  ))}
                </tr>
              )})}
            </tbody>
          </table>
          {/* Page break after each table except the last */}
          {pageIndex < pages.length - 1 && (
            <div className="page-break" />
          )}
        </div>
      ))}
    </div>
  )
}

export const PaginatedPrintTable = React.memo(PaginatedPrintTableComponent) as <T>(props: PaginatedPrintTableProps<T>) => JSX.Element | null