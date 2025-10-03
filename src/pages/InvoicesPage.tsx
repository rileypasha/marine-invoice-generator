import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
  status: 'requested' | 'change_requested' | 'approved';
  total: number;
  createdAt: string;
  updatedAt: string;
  customerName?: string;
  vesselName?: string;
  userName?: string;
  userEmail?: string;
  modifiedByUserName?: string;
  modifiedByUserEmail?: string;
  customer?: {
    id: string;
    display_name: string;
    legal_name?: string;
  };
  vessel?: {
    id: string;
    name: string;
  };
  user?: {
    name?: string;
    email?: string;
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
  user?: {
    name?: string;
    email?: string;
  };
  userName?: string;
  modifiedByUserName?: string;
  total_amount?: number;
  invoice_date?: string;
  updated_at?: string;
  status?: 'requested' | 'change_requested' | 'approved';
}

const InvoicesPage: React.FC = () => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [rawInvoices, setRawInvoices] = useState<ApiInvoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const { isAuthenticated, csrfToken } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // Initialize filters from URL on mount
  const [filters, setFilters] = useState<FilterOptions>(() => {
    const customerIdFromUrl = new URLSearchParams(window.location.search).get('customer_id');
    return customerIdFromUrl ? { customerId: customerIdFromUrl } : {};
  });

  const fetchInvoices = useCallback(async (page = 1, search = '', filterOptions: FilterOptions = {}, append = false) => {
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

      // Store raw API data - transformation happens in useMemo
      if (append) {
        setRawInvoices(prev => [...prev, ...(data.invoices || [])]);
      } else {
        setRawInvoices(data.invoices || []);
      }

      const currentPageNum = data.pagination?.page || 1;
      const totalPagesNum = data.pagination?.totalPages || 1;
      setCurrentPage(currentPageNum);
      setHasMore(currentPageNum < totalPagesNum);

    } catch (error) {
      console.error('Error fetching invoices:', error);
      if (!append) {
        setRawInvoices([]);
      }
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, csrfToken]);

  // Memoize transformation to prevent re-computation on every render
  const transformedInvoices = useMemo(() => {
    return rawInvoices.map((apiInvoice) => ({
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
      user: apiInvoice.user,
      userName: apiInvoice.userName,
      modifiedByUserName: apiInvoice.modifiedByUserName,
      total_amount: apiInvoice.total,
      invoice_date: apiInvoice.createdAt,
      updated_at: apiInvoice.updatedAt,
      status: apiInvoice.status
    }));
  }, [rawInvoices]);

  // Memoize stats calculation
  const stats = useMemo(() => {
    const total = transformedInvoices.length;
    const requested = transformedInvoices.filter(i => i.status === 'requested').length;
    const change_requested = transformedInvoices.filter(i => i.status === 'change_requested').length;
    const approved = transformedInvoices.filter(i => i.status === 'approved').length;
    return { total, requested, change_requested, approved };
  }, [transformedInvoices]);

  // Fetch invoices when search or filters change (reset to page 1)
  useEffect(() => {
    if (!isAuthenticated || !csrfToken) return;

    let cancelled = false;

    const doFetch = async () => {
      if (!cancelled) {
        await fetchInvoices(1, searchTerm, filters);
      }
    };

    doFetch();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm, filters]);

  // Load more function for infinite scroll
  const loadMore = useCallback(() => {
    if (!isLoading && hasMore) {
      const nextPage = currentPage + 1;
      fetchInvoices(nextPage, searchTerm, filters, true);
    }
  }, [isLoading, hasMore, currentPage, searchTerm, filters, fetchInvoices]);

  // Intersection Observer for infinite scroll
  useEffect(() => {
    if (!loadMoreRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadMore();
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(loadMoreRef.current);

    return () => observer.disconnect();
  }, [loadMore]);

  const handleSearch = (term: string) => {
    setSearchTerm(term);
    setCurrentPage(1);
    setRawInvoices([]); // Clear existing invoices
  };

  const handleFiltersChange = (newFilters: FilterOptions) => {
    setFilters(newFilters);
    setCurrentPage(1);
    setRawInvoices([]); // Clear existing invoices
  };

  const handleEdit = useCallback((invoice: Invoice) => {
    navigate(`/requests/${invoice.id}/edit`);
  }, [navigate]);

  const handleView = useCallback((invoice: Invoice) => {
    navigate(`/requests/${invoice.id}`);
  }, [navigate]);

  const handleDelete = useCallback(async (invoice: Invoice) => {
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
  }, [isAuthenticated, csrfToken, fetchInvoices, currentPage, searchTerm, filters]);

  const handlePrint = useCallback((invoice: Invoice) => {
    // Navigate to invoice view page with print parameter to auto-trigger print
    navigate(`/requests/${invoice.id}?print=true`);
  }, [navigate]);

  const handleAddNew = useCallback(() => {
    navigate('/requests/new');
  }, [navigate]);

  const handleBulkDelete = useCallback(async (invoices: Invoice[]) => {
    if (!isAuthenticated || !csrfToken || !confirm(`Are you sure you want to delete ${invoices.length} invoice(s)?`)) return;

    try {
      const deletePromises = invoices.map(invoice =>
        fetch(`/api/v1/invoice/${invoice.id}`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': csrfToken
          },
          credentials: 'include'
        })
      );

      await Promise.all(deletePromises);
      // Refresh the list
      fetchInvoices(currentPage, searchTerm, filters);
    } catch (error) {
      console.error('Error deleting invoices:', error);
      alert('Error deleting invoices');
    }
  }, [isAuthenticated, csrfToken, fetchInvoices, currentPage, searchTerm, filters]);

  const handleBulkExport = useCallback((invoices: Invoice[]) => {
    const headers = ['Invoice #', 'Contact', 'Vessel', 'Amount', 'Created At', 'Status'];
    const csvContent = [
      headers.join(','),
      ...invoices.map(invoice => [
        invoice.invoice_number || `#${invoice.id}`,
        invoice.customer?.display_name || invoice.customer?.company_name || '',
        invoice.vessel?.name || '',
        invoice.total_amount || '0',
        invoice.invoice_date ? new Date(invoice.invoice_date).toLocaleDateString() : '',
        invoice.status || 'requested'
      ].map(field => `"${field}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `invoices-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, []);

  return (
    <Invoices
      invoices={transformedInvoices}
      onEdit={handleEdit}
      onDelete={handleDelete}
      onView={handleView}
      onPrint={handlePrint}
      onAddNew={handleAddNew}
      onBulkDelete={handleBulkDelete}
      onBulkExport={handleBulkExport}
      isLoading={isLoading}
      loadMoreRef={loadMoreRef}
      hasMore={hasMore}
    />
  );
};

export default InvoicesPage;