import * as React from "react"
import { cn } from "@/lib/utils"
import {
  SimpleTable,
  SimpleTableHeader,
  SimpleTableBody,
  SimpleTableHead,
  SimpleTableRow,
  SimpleTableCell,
} from "./simple-table"

// PrintTable wrapper component to ensure proper semantic structure for printing
// Guarantees that table headers repeat on every printed page
interface PrintTableProps extends React.HTMLAttributes<HTMLTableElement> {
  children: React.ReactNode
}

const PrintTable = React.forwardRef<HTMLTableElement, PrintTableProps>(
  ({ className, children, ...props }, ref) => (
    <SimpleTable
      ref={ref}
      className={cn(
        // Ensure semantic table structure for print
        "print-table",
        className
      )}
      {...props}
    >
      {children}
    </SimpleTable>
  )
)
PrintTable.displayName = "PrintTable"

// Re-export table components for convenience
export {
  PrintTable,
  SimpleTableHeader as PrintTableHeader,
  SimpleTableBody as PrintTableBody,
  SimpleTableHead as PrintTableHead,
  SimpleTableRow as PrintTableRow,
  SimpleTableCell as PrintTableCell,
}

// Example usage for reference:
/*
import { PrintTable, PrintTableHeader, PrintTableBody, PrintTableHead, PrintTableRow, PrintTableCell } from "@/components/ui/print-table"

<PrintTable>
  <PrintTableHeader>
    <PrintTableRow>
      <PrintTableHead>Name</PrintTableHead>
      <PrintTableHead>Email</PrintTableHead>
      <PrintTableHead>Phone</PrintTableHead>
    </PrintTableRow>
  </PrintTableHeader>
  <PrintTableBody>
    {data.map((item) => (
      <PrintTableRow key={item.id}>
        <PrintTableCell>{item.name}</PrintTableCell>
        <PrintTableCell>{item.email}</PrintTableCell>
        <PrintTableCell>{item.phone}</PrintTableCell>
      </PrintTableRow>
    ))}
  </PrintTableBody>
</PrintTable>
*/