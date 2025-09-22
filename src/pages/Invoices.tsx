import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Button,
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '../components/magic/index';
import DateRangePicker from '../components/DateRangePicker';

interface Customer {
  id: string;
  display_name: string;
  legal_name?: string;
}

interface Vessel {
  id: string;
  name: string;
}

interface FilterOptions {
  dateRange?: { start?: Date; end?: Date };
  customerId?: string;
  vesselId?: string;
  amountRange?: { min?: number; max?: number };
}

interface Invoice {
  id: string;
  invoice_number?: string;
  customer?: {
    company_name?: string;
    display_name?: string;
    contact_name?: string;
  };
  vessel?: {
    name?: string;
  };
  total_amount?: number;
  invoice_date?: string;
  updated_at?: string;
  status?: 'saved' | 'draft' | 'submitted';
}

interface InvoicesProps {
  invoices?: Invoice[];
  onEdit?: (invoice: Invoice) => void;
  onDelete?: (invoice: Invoice) => void;
  onView?: (invoice: Invoice) => void;
  onPrint?: (invoice: Invoice) => void;
  onAddNew?: () => void;
  onSearch?: (term: string) => void;
  searchTerm?: string;
  isLoading?: boolean;
  stats?: { total: number; saved: number; drafts: number; submitted: number };
  currentPage?: number;
  totalPages?: number;
  onPageChange?: (page: number) => void;
  filters?: FilterOptions;
  onFiltersChange?: (filters: FilterOptions) => void;
  availableCustomers?: Customer[];
  availableVessels?: Vessel[];
}

const Invoices: React.FC<InvoicesProps> = ({
  invoices = [],
  onEdit,
  onDelete,
  onView,
  onPrint,
  onAddNew,
  onSearch,
  searchTerm = '',
  isLoading = false,
  stats = { total: 0, saved: 0, drafts: 0, submitted: 0 },
  currentPage = 1,
  totalPages = 1,
  onPageChange,
  filters = {},
  onFiltersChange,
  availableCustomers = [],
  availableVessels = []
}) => {
  const navigate = useNavigate();
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString();
  };

  const formatCurrency = (amount?: number) => {
    if (!amount) return '$0.00';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const getStatusBadge = (status?: string) => {
    const statusConfig = {
      saved: {
        className: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
        label: 'Saved'
      },
      draft: {
        className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
        label: 'Draft'
      },
      submitted: {
        className: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
        label: 'Submitted'
      }
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.draft;

    return (
      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${config.className}`}>
        {config.label}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Invoices</CardTitle>
              <CardDescription>
                Manage and view all your saved invoices
              </CardDescription>
            </div>
            <Button onClick={() => navigate('/invoices/create')}>
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 5v14m-7-7h14" />
              </svg>
              New Invoice
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
              <div className="flex-1 max-w-sm">
                <Input
                  placeholder="Search invoices by title, customer, or vessel..."
                  value={searchTerm}
                  onChange={(e) => onSearch?.(e.target.value)}
                  className="w-full"
                />
              </div>
              <Button
                variant="outline"
                onClick={() => setFiltersExpanded(!filtersExpanded)}
              >
                {filtersExpanded ? 'Hide Filters' : 'Show Filters'}
              </Button>
            </div>

            {filtersExpanded && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-4 bg-gray-50 rounded-lg">
                <div>
                  <label className="block text-sm font-medium mb-2">Date Range</label>
                  <DateRangePicker
                    value={filters.dateRange || {}}
                    onChange={(dateRange) => onFiltersChange?.({ ...filters, dateRange })}
                    placeholder="Select date range"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Customer</label>
                  <Select
                    value={filters.customerId || ''}
                    onValueChange={(customerId) => onFiltersChange?.({ ...filters, customerId: customerId || undefined })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select customer" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All Customers</SelectItem>
                      {availableCustomers.map(customer => (
                        <SelectItem key={customer.id} value={customer.id}>
                          {customer.display_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Vessel</label>
                  <Select
                    value={filters.vesselId || ''}
                    onValueChange={(vesselId) => onFiltersChange?.({ ...filters, vesselId: vesselId || undefined })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select vessel" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All Vessels</SelectItem>
                      {availableVessels.map(vessel => (
                        <SelectItem key={vessel.id} value={vessel.id}>
                          {vessel.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Amount Range</label>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      placeholder="Min"
                      value={filters.amountRange?.min || ''}
                      onChange={(e) => {
                        const min = e.target.value ? parseFloat(e.target.value) : undefined;
                        onFiltersChange?.({
                          ...filters,
                          amountRange: { ...filters.amountRange, min }
                        });
                      }}
                    />
                    <Input
                      type="number"
                      placeholder="Max"
                      value={filters.amountRange?.max || ''}
                      onChange={(e) => {
                        const max = e.target.value ? parseFloat(e.target.value) : undefined;
                        onFiltersChange?.({
                          ...filters,
                          amountRange: { ...filters.amountRange, max }
                        });
                      }}
                    />
                  </div>
                </div>

                <div className="md:col-span-2 lg:col-span-4 flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      onFiltersChange?.({});
                    }}
                  >
                    Clear All Filters
                  </Button>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>


      {/* Invoices Table */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Invoices</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-muted-foreground">Loading invoices...</div>
            </div>
          ) : invoices.length === 0 ? (
            <div className="text-center py-8">
              <svg className="mx-auto h-12 w-12 text-muted-foreground mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <div className="text-muted-foreground mb-4">No invoices found</div>
              <Button onClick={() => navigate('/invoices/create')}>Create Your First Invoice</Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Vessel</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Created At</TableHead>
                  <TableHead>Last Modified</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((invoice) => (
                  <TableRow key={invoice.id}>
                    <TableCell className="font-medium">
                      {invoice.invoice_number || `#${invoice.id}`}
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">
                          {invoice.customer?.company_name || invoice.customer?.display_name || '-'}
                        </div>
                        {invoice.customer?.contact_name && (
                          <div className="text-sm text-muted-foreground">
                            {invoice.customer.contact_name}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {invoice.vessel?.name || '-'}
                    </TableCell>
                    <TableCell>
                      {formatCurrency(invoice.total_amount)}
                    </TableCell>
                    <TableCell className="text-sm text-gray-600">
                      {formatDate(invoice.invoice_date)}
                    </TableCell>
                    <TableCell className="text-sm text-gray-600">
                      {invoice.updated_at && invoice.updated_at !== invoice.invoice_date ? formatDate(invoice.updated_at) : formatDate(invoice.invoice_date)}
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(invoice.status)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-2 justify-end">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onView?.(invoice)}
                        >
                          View
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onEdit?.(invoice)}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onPrint?.(invoice)}
                        >
                          Print
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => onDelete?.(invoice)}
                        >
                          Delete
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {invoices.length > 0 && totalPages > 1 && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                Page {currentPage} of {totalPages}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage <= 1}
                  onClick={() => onPageChange?.(currentPage - 1)}
                >
                  Previous
                </Button>
                <div className="flex gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    const page = i + 1;
                    return (
                      <Button
                        key={page}
                        variant={currentPage === page ? "default" : "outline"}
                        size="sm"
                        onClick={() => onPageChange?.(page)}
                      >
                        {page}
                      </Button>
                    );
                  })}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage >= totalPages}
                  onClick={() => onPageChange?.(currentPage + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Invoices;