import React, { useState } from "react"
import { useNavigate } from 'react-router-dom'
import { ArrowUpDown, MoreHorizontal, Plus, Printer, Upload, Download } from "lucide-react"
import { parsePhoneNumber } from 'libphonenumber-js'
import { ColumnDef } from "@tanstack/react-table"
import { DataTable } from "@/components/ui/data-table"
import { Checkbox as TableCheckbox } from "@/components/ui/checkbox"
import { SimpleButton as Button } from "@/components/ui/simple-button"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu"

interface Customer {
  id: string;
  display_name: string;
  legal_name?: string;
  email?: string;
  phone?: string;
  address_line1?: string;
  city?: string;
  state?: string;
  created_at: string;
  updated_at: string;
}

interface ContactsTableProps {
  customers: Customer[]
  onEdit?: (id: string) => void
  onDelete?: (id: string) => void
  onAddClick?: () => void
  onPrint?: () => void
  onImport?: () => void
  onExport?: () => void
  onBulkDelete?: (selectedRows: Customer[]) => void
  onBulkExport?: (selectedRows: Customer[]) => void
  onViewInvoices?: (customerId: string) => void
  onNewInvoice?: (customer: Customer) => void
}

export function ContactsTable({ customers, onEdit, onDelete, onAddClick, onPrint, onImport, onExport, onBulkDelete, onBulkExport, onViewInvoices, onNewInvoice }: ContactsTableProps) {
  const navigate = useNavigate()

  // Helper function to format phone numbers for display
  const formatPhoneForDisplay = (phone: string | null | undefined): string => {
    if (!phone) return '-'

    // If it's already in E.164 format, format it nicely
    if (phone.startsWith('+')) {
      try {
        const parsed = parsePhoneNumber(phone)
        return parsed ? parsed.formatInternational() : phone
      } catch {
        return phone
      }
    }

    // If it's in old format like "(555) 123-4567", return as-is
    return phone
  }

  const columns: ColumnDef<Customer>[] = [
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
    },
    {
      accessorKey: "display_name",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Name
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        )
      },
      cell: ({ row }) => (
        <div className="font-medium">{row.getValue("display_name") || '-'}</div>
      ),
    },
    {
      accessorKey: "email",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Email
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        )
      },
      cell: ({ row }) => {
        const email = row.getValue("email") as string
        return (
          <div className="lowercase" title={email || undefined}>
            {email ? (
              <a href={`mailto:${email}`} className="text-black hover:underline">
                {email}
              </a>
            ) : '-'}
          </div>
        )
      },
    },
    {
      accessorKey: "phone",
      header: "Phone",
      cell: ({ row }) => {
        const phone = row.getValue("phone") as string
        return <div className="whitespace-nowrap">{formatPhoneForDisplay(phone)}</div>
      },
    },
    {
      id: "address",
      header: "Address",
      cell: ({ row }) => {
        const customer = row.original
        const address = customer.address_line1 && customer.city
          ? `${customer.address_line1}, ${customer.city}${customer.state ? `, ${customer.state}` : ''}`
          : customer.address_line1 || '-'

        return <div title={address}>{address}</div>
      },
    },
    {
      id: "actions",
      enableHiding: false,
      cell: ({ row }) => {
        const customer = row.original

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only">Open menu</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onSelect={() => onNewInvoice?.(customer)}
              >
                New Invoice
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => onViewInvoices?.(customer.id)}
              >
                View Invoices
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => onEdit?.(customer.id) || navigate(`/contacts/${customer.id}/edit`)}
              >
                Edit contact
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => onDelete?.(customer.id)}
                className="text-red-600"
              >
                Delete contact
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )
      },
    },
  ]

  return (
    <DataTable
      columns={columns}
      data={customers}
      searchPlaceholder="Search clients..."
      searchColumn="display_name"
      showAddButton={true}
      addButtonText="Add Contact"
      onAddClick={onAddClick}
      onPrint={onPrint}
      onImport={onImport}
      onExport={onExport}
      onBulkDelete={onBulkDelete}
      onBulkExport={onBulkExport}
    />
  )
}