import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Invoices from './Invoices';

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

interface ApiInvoice {
  id: string;
  invoiceNumber?: string;
  title: string;
  status: 'saved' | 'draft' | 'submitted';
  total: number;
  createdAt: string;
  updatedAt: string;
  customerName?: string;
  vesselName?: string;
  customer?: {
    id: string;
    display_name: string;
    legal_name?: string;
  };
  vessel?: {
    id: string;
    name: string;
  };
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

const InvoicesPage: React.FC = () => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [stats, setStats] = useState({ total: 0, saved: 0, drafts: 0, submitted: 0 });
  const [filters, setFilters] = useState<FilterOptions>({});
  const [availableCustomers, setAvailableCustomers] = useState<Customer[]>([]);
  const [availableVessels, setAvailableVessels] = useState<Vessel[]>([]);

  const { isAuthenticated, csrfToken } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const fetchInvoices = async (page = 1, search = '', filterOptions: FilterOptions = {}) => {
    if (!isAuthenticated || !csrfToken) return;

    setIsLoading(true);
    try {
      const searchParams = new URLSearchParams({
        page: page.toString(),
        limit: '25'
      });

      if (search.trim()) {
        searchParams.append('search', search);
      }

      // Add filter parameters
      if (filterOptions.dateRange?.start) {
        searchParams.append('startDate', filterOptions.dateRange.start.toISOString());
      }
      if (filterOptions.dateRange?.end) {
        searchParams.append('endDate', filterOptions.dateRange.end.toISOString());
      }
      if (filterOptions.customerId) {
        searchParams.append('customerId', filterOptions.customerId);
      }
      if (filterOptions.vesselId) {
        searchParams.append('vesselId', filterOptions.vesselId);
      }
      if (filterOptions.amountRange?.min !== undefined) {
        searchParams.append('minAmount', filterOptions.amountRange.min.toString());
      }
      if (filterOptions.amountRange?.max !== undefined) {
        searchParams.append('maxAmount', filterOptions.amountRange.max.toString());
      }

      const response = await fetch(`/api/v1/invoice?${searchParams}`, {
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken
        },
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch invoices: ${response.status}`);
      }

      const data = await response.json();

      // Transform API response to match component interface
      const transformedInvoices: Invoice[] = (data.invoices || []).map((apiInvoice: ApiInvoice) => ({
        id: apiInvoice.id,
        invoice_number: apiInvoice.invoiceNumber || `#${apiInvoice.id.substring(0, 8)}`,
        customer: {
          display_name: apiInvoice.customer?.display_name || apiInvoice.customerName,
          company_name: apiInvoice.customer?.legal_name,
          contact_name: undefined
        },
        vessel: {
          name: apiInvoice.vessel?.name || apiInvoice.vesselName
        },
        total_amount: apiInvoice.total,
        invoice_date: apiInvoice.createdAt,
        updated_at: apiInvoice.updatedAt,
        status: apiInvoice.status
      }));

      setInvoices(transformedInvoices);
      setCurrentPage(data.pagination?.page || 1);
      setTotalPages(data.pagination?.totalPages || 1);

      // Calculate stats from the invoices
      const total = transformedInvoices.length;
      const saved = transformedInvoices.filter(i => i.status === 'saved').length;
      const drafts = transformedInvoices.filter(i => i.status === 'draft').length;
      const submitted = transformedInvoices.filter(i => i.status === 'submitted').length;

      setStats({ total, saved, drafts, submitted });

    } catch (error) {
      console.error('Error fetching invoices:', error);
      setInvoices([]);
      setStats({ total: 0, saved: 0, drafts: 0, submitted: 0 });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchCustomers = async () => {
    if (!isAuthenticated || !csrfToken) return;

    try {
      const response = await fetch('/api/v1/customers', {
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken
        },
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        setAvailableCustomers(data.customers || []);
      }
    } catch (error) {
      console.error('Error fetching customers:', error);
    }
  };

  const fetchVessels = async () => {
    if (!isAuthenticated || !csrfToken) return;

    try {
      const response = await fetch('/api/v1/vessels', {
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken
        },
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        setAvailableVessels(data.vessels || []);
      }
    } catch (error) {
      console.error('Error fetching vessels:', error);
    }
  };

  useEffect(() => {
    if (isAuthenticated && csrfToken) {
      fetchCustomers();
      fetchVessels();
    }
  }, [isAuthenticated, csrfToken]);

  useEffect(() => {
    fetchInvoices(currentPage, searchTerm, filters);
  }, [isAuthenticated, csrfToken, currentPage, searchTerm, filters]);

  // Apply customer filter from URL parameter when availableCustomers is loaded
  useEffect(() => {
    const customerIdFromUrl = searchParams.get('customer_id');
    if (customerIdFromUrl && availableCustomers.length > 0) {
      // Check if the customer exists in the available customers
      const customerExists = availableCustomers.some(customer => customer.id === customerIdFromUrl);
      if (customerExists) {
        setFilters(prevFilters => ({
          ...prevFilters,
          customerId: customerIdFromUrl
        }));
      }
    }
  }, [searchParams, availableCustomers]);

  const handleSearch = (term: string) => {
    setSearchTerm(term);
    setCurrentPage(1);
  };

  const handleFiltersChange = (newFilters: FilterOptions) => {
    setFilters(newFilters);
    setCurrentPage(1);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleEdit = (invoice: Invoice) => {
    navigate(`/invoices/${invoice.id}/edit`);
  };

  const handleView = (invoice: Invoice) => {
    navigate(`/invoices/${invoice.id}`);
  };

  const handleDelete = async (invoice: Invoice) => {
    if (!isAuthenticated || !csrfToken || !confirm('Are you sure you want to delete this invoice?')) return;

    try {
      const response = await fetch(`/api/v1/invoice/${invoice.id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken
        },
        credentials: 'include'
      });

      if (response.ok) {
        // Refresh the list
        fetchInvoices(currentPage, searchTerm, filters);
      } else {
        alert('Failed to delete invoice');
      }
    } catch (error) {
      console.error('Error deleting invoice:', error);
      alert('Error deleting invoice');
    }
  };

  const handlePrint = (invoice: Invoice) => {
    // Navigate to invoice view page with print parameter to auto-trigger print
    navigate(`/invoices/${invoice.id}?print=true`);
  };

  const handleAddNew = () => {
    navigate('/invoices/create');
  };

  return (
    <Invoices
      invoices={invoices}
      onEdit={handleEdit}
      onDelete={handleDelete}
      onView={handleView}
      onPrint={handlePrint}
      onAddNew={handleAddNew}
      onSearch={handleSearch}
      searchTerm={searchTerm}
      isLoading={isLoading}
      stats={stats}
      currentPage={currentPage}
      totalPages={totalPages}
      onPageChange={handlePageChange}
      filters={filters}
      onFiltersChange={handleFiltersChange}
      availableCustomers={availableCustomers}
      availableVessels={availableVessels}
    />
  );
};

export default InvoicesPage;