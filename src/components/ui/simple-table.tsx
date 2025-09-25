import * as React from "react"
import { cn } from "@/lib/utils"

// Simple HTML table components compatible with TanStack Table
// These avoid the React Aria Components conflicts

const SimpleTable = React.forwardRef<
  HTMLTableElement,
  React.HTMLAttributes<HTMLTableElement>
>(({ className, ...props }, ref) => (
  <table
    ref={ref}
    className={cn(
      "w-full caption-bottom text-sm border-collapse",
      className
    )}
    {...props}
  />
))
SimpleTable.displayName = "SimpleTable"

const SimpleTableHeader = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <thead
    ref={ref}
    className={cn(
      "bg-gray-50/50 [&_tr]:border-b",
      className
    )}
    {...props}
  />
))
SimpleTableHeader.displayName = "SimpleTableHeader"

const SimpleTableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tbody
    ref={ref}
    className={cn("[&_tr:last-child]:border-0", className)}
    {...props}
  />
))
SimpleTableBody.displayName = "SimpleTableBody"

const SimpleTableFooter = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tfoot
    ref={ref}
    className={cn("bg-gray-900 font-medium text-gray-50 dark:bg-gray-50 dark:text-gray-900", className)}
    {...props}
  />
))
SimpleTableFooter.displayName = "SimpleTableFooter"

const SimpleTableRow = React.forwardRef<
  HTMLTableRowElement,
  React.HTMLAttributes<HTMLTableRowElement>
>(({ className, ...props }, ref) => (
  <tr
    ref={ref}
    className={cn(
      "border-b transition-colors hover:bg-gray-50/50 data-[state=selected]:bg-gray-100",
      className
    )}
    {...props}
  />
))
SimpleTableRow.displayName = "SimpleTableRow"

const SimpleTableHead = React.forwardRef<
  HTMLTableCellElement,
  React.ThHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <th
    ref={ref}
    className={cn(
      "h-12 px-4 text-left align-middle font-medium text-gray-500 [&:has([role=checkbox])]:pr-0",
      className
    )}
    {...props}
  />
))
SimpleTableHead.displayName = "SimpleTableHead"

const SimpleTableCell = React.forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <td
    ref={ref}
    className={cn("p-4 align-middle [&:has([role=checkbox])]:pr-0", className)}
    {...props}
  />
))
SimpleTableCell.displayName = "SimpleTableCell"

const SimpleTableCaption = React.forwardRef<
  HTMLTableCaptionElement,
  React.HTMLAttributes<HTMLTableCaptionElement>
>(({ className, ...props }, ref) => (
  <caption
    ref={ref}
    className={cn("mt-4 text-sm text-gray-500", className)}
    {...props}
  />
))
SimpleTableCaption.displayName = "SimpleTableCaption"

export {
  SimpleTable,
  SimpleTableHeader,
  SimpleTableBody,
  SimpleTableFooter,
  SimpleTableHead,
  SimpleTableRow,
  SimpleTableCell,
  SimpleTableCaption,
}