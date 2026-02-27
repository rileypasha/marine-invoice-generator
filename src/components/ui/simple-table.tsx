import * as React from "react"
import { cn } from "@/lib/utils"

// Premium table components for a modern SaaS look

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
      "sticky top-0 z-30 bg-white border-b border-slate-200",
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
    className={cn("bg-slate-50 font-medium text-slate-900", className)}
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
      "border-b border-slate-100 bg-white hover:bg-slate-50/70 data-[state=selected]:bg-blue-50/40",
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
      "sticky top-0 z-20 h-11 px-4 text-left align-middle text-xs font-semibold uppercase tracking-wider text-slate-500 bg-white border-b border-slate-200 [&:has([role=checkbox])]:pr-0",
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
    className={cn("px-4 py-3 align-middle text-slate-700 [&:has([role=checkbox])]:pr-0", className)}
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
    className={cn("mt-4 text-sm text-slate-500", className)}
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
