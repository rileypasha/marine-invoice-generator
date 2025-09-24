"use client"

import * as React from "react"
import { useNavigate } from 'react-router-dom'
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table"
import { ArrowUpDown, MoreHorizontal } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { DataTable } from "@/components/ui/data-table"

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
}

export function ContactsTable({ customers, onEdit, onDelete }: ContactsTableProps) {
  const navigate = useNavigate()

  const columns: ColumnDef<Customer>[] = [
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={
            table.getIsAllPageRowsSelected() ||
            (table.getIsSomePageRowsSelected() && "indeterminate")
          }
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Select row"
        />
      ),
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: "legal_name",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Contact
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        )
      },
      cell: ({ row }) => (
        <div className="font-medium">{row.getValue("legal_name") || '-'}</div>
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
              <a href={`mailto:${email}`} className="text-blue-600 hover:underline">
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
        return <div className="whitespace-nowrap">{phone || '-'}</div>
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
                onSelect={() => navigate(`/invoices?customer_id=${customer.id}`)}
              >
                View Invoices
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => onEdit?.(customer.id) || navigate(`/customers/${customer.id}/edit`)}
              >
                Edit contact
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => {
                  if (confirm('Are you sure you want to delete this contact?')) {
                    onDelete?.(customer.id)
                  }
                }}
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
      searchPlaceholder="Filter contacts..."
      searchColumn="display_name"
    />
  )
}