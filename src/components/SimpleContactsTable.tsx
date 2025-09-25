import React, { useState } from "react"
import { useNavigate } from 'react-router-dom'
import { ArrowUpDown, MoreHorizontal, Plus, Printer, Upload, Download } from "lucide-react"
import { parsePhoneNumber } from 'libphonenumber-js'

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

export function ContactsTable({
  customers,
  onEdit,
  onDelete,
  onAddClick,
  onPrint,
  onImport,
  onExport,
  onBulkDelete,
  onBulkExport,
  onViewInvoices,
  onNewInvoice
}: ContactsTableProps) {
  const navigate = useNavigate()
  const [selectedCustomers, setSelectedCustomers] = useState<string[]>([])
  const [sortField, setSortField] = useState<keyof Customer | null>(null)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')

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

  const handleSort = (field: keyof Customer) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedCustomers(customers.map(c => c.id))
    } else {
      setSelectedCustomers([])
    }
  }

  const handleSelectCustomer = (customerId: string, checked: boolean) => {
    if (checked) {
      setSelectedCustomers([...selectedCustomers, customerId])
    } else {
      setSelectedCustomers(selectedCustomers.filter(id => id !== customerId))
    }
  }

  // Sort customers
  let sortedCustomers = [...customers]
  if (sortField) {
    sortedCustomers.sort((a, b) => {
      const aVal = String(a[sortField] || '')
      const bVal = String(b[sortField] || '')
      const comparison = aVal.localeCompare(bVal)
      return sortDirection === 'asc' ? comparison : -comparison
    })
  }

  const getSelectedCustomers = () => {
    return customers.filter(c => selectedCustomers.includes(c.id))
  }

  return (
    <div className="w-full">
      {/* Toolbar */}
      <div className="flex items-center py-4">
        {selectedCustomers.length === 0 ? (
          <>
            <div className="flex-1"></div>
            <div className="flex items-center gap-2">
              <button
                onClick={onPrint}
                className="flex items-center gap-1 px-3 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
              >
                <Printer className="h-4 w-4" />
                Print
              </button>
              <button
                onClick={onImport}
                className="flex items-center gap-1 px-3 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
              >
                <Upload className="h-4 w-4" />
                Import
              </button>
              <button
                onClick={onExport}
                className="flex items-center gap-1 px-3 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
              >
                <Download className="h-4 w-4" />
                Export
              </button>
              <button
                onClick={onAddClick}
                className="flex items-center gap-1 px-3 py-2 text-sm bg-black text-white rounded-md hover:bg-gray-800"
              >
                <Plus className="h-4 w-4" />
                Add Contact
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="flex-1">
              <span className="text-sm font-medium">
                {selectedCustomers.length} item{selectedCustomers.length === 1 ? '' : 's'} selected
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSelectedCustomers([])}
                className="px-3 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Clear
              </button>
              <button
                onClick={() => onBulkDelete?.(getSelectedCustomers())}
                className="px-3 py-2 text-sm bg-red-500 text-white rounded-md hover:bg-red-600"
              >
                Delete
              </button>
              <button
                onClick={() => onBulkExport?.(getSelectedCustomers())}
                className="px-3 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Export
              </button>
            </div>
          </>
        )}
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <table className="w-full border-collapse">
          <thead className="bg-gray-50">
            <tr className="border-b">
              <th className="h-12 px-4 text-left">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-gray-300"
                  checked={selectedCustomers.length === customers.length && customers.length > 0}
                  onChange={(e) => handleSelectAll(e.target.checked)}
                />
              </th>
              <th className="h-12 px-4 text-left">
                <button
                  onClick={() => handleSort('display_name')}
                  className="flex items-center gap-2 font-medium text-gray-500 hover:text-gray-700"
                >
                  Name
                  <ArrowUpDown className="h-4 w-4" />
                </button>
              </th>
              <th className="h-12 px-4 text-left">
                <button
                  onClick={() => handleSort('email')}
                  className="flex items-center gap-2 font-medium text-gray-500 hover:text-gray-700"
                >
                  Email
                  <ArrowUpDown className="h-4 w-4" />
                </button>
              </th>
              <th className="h-12 px-4 text-left font-medium text-gray-500">Phone</th>
              <th className="h-12 px-4 text-left font-medium text-gray-500">Address</th>
              <th className="h-12 px-4 text-left font-medium text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody>
            {sortedCustomers.length > 0 ? (
              sortedCustomers.map((customer) => (
                <tr key={customer.id} className="border-b hover:bg-gray-50">
                  <td className="p-4">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-gray-300"
                      checked={selectedCustomers.includes(customer.id)}
                      onChange={(e) => handleSelectCustomer(customer.id, e.target.checked)}
                    />
                  </td>
                  <td className="p-4 font-medium">{customer.display_name || '-'}</td>
                  <td className="p-4">
                    {customer.email ? (
                      <a href={`mailto:${customer.email}`} className="text-blue-600 hover:underline">
                        {customer.email}
                      </a>
                    ) : '-'}
                  </td>
                  <td className="p-4 whitespace-nowrap">{formatPhoneForDisplay(customer.phone)}</td>
                  <td className="p-4">
                    {customer.address_line1 && customer.city
                      ? `${customer.address_line1}, ${customer.city}${customer.state ? `, ${customer.state}` : ''}`
                      : customer.address_line1 || '-'}
                  </td>
                  <td className="p-4">
                    <div className="relative">
                      <button className="flex items-center gap-1 px-2 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50">
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                      {/* Simple dropdown - could be enhanced with proper dropdown later */}
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="h-24 text-center text-gray-500">
                  No contacts found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}