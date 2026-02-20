import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Invoices from './Invoices';
import { Pagination } from '../components/ui/pagination';
import { useConfirmDialog } from '../components/ui/confirm-dialog';
import { useRequestsQueryState } from '../hooks/useRequestsQueryState';
import { useRequestSection } from '../hooks/useRequestSection';

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
  contactName?: string;
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
  modifiedByUserAvatar?: string;
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
  contactName?: string;
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
  modifiedByUserAvatar?: string;
  total_amount?: number;
  invoice_date?: string;
  updated_at?: string;
  status?: 'requested' | 'change_requested' | 'approved';
}

const InvoicesPage: React.FC = () => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [rawInvoices, setRawInvoices] = useState<ApiInvoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const latestFetchIdRef = useRef(0);
  const { isAuthenticated, csrfToken } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { confirm, dialog } = useConfirmDialog();
  const { isEstimate, singularLabel, pluralLabel, documentTypeParam, toEdit, toView, toNew } = useRequestSection();

  // Use the query state hook to get filters from URL
  const { month, q: searchTerm, filters } = useRequestsQueryState();

  const fetchInvoices = useCallback(async (page: number, currentMonth: string, search: string, currentFilters: any) => {
    if (!isAuthenticated || !csrfToken) return;

    const fetchId = ++latestFetchIdRef.current;
    setIsLoading(true);
    try {
      const searchParams = new URLSearchParams({
        page: page.toString(),
        limit: '25'
      });

      // Add search parameter
      if (search && search.trim()) {
        searchParams.append('search', search.trim());
      }
      searchParams.append('documentType', documentTypeParam);

      // Add month filter (convert to date range)
      if (currentMonth && currentMonth !== 'all') {
        const [year, monthNum] = currentMonth.split('-');
        const startDate = new Date(parseInt(year), parseInt(monthNum) - 1, 1);
        const endDate = new Date(parseInt(year), parseInt(monthNum), 0, 23, 59, 59);
        searchParams.append('startDate', startDate.toISOString());
        searchParams.append('endDate', endDate.toISOString());
      }

      // Add status filter
      if (currentFilters.status) {
        searchParams.append('status', currentFilters.status);
      }

      // Add amount filters
      if (currentFilters.minAmount !== undefined) {
        searchParams.append('minAmount', currentFilters.minAmount.toString());
      }
      if (currentFilters.maxAmount !== undefined) {
        searchParams.append('maxAmount', currentFilters.maxAmount.toString());
      }

      // Add contact/vessel/user filters if they exist
      // Note: API might need to be updated to support these
      if (currentFilters.contact) {
        searchParams.append('contact', currentFilters.contact);
      }
      if (currentFilters.vessel) {
        searchParams.append('vessel', currentFilters.vessel);
      }
      if (currentFilters.createdBy) {
        searchParams.append('createdBy', currentFilters.createdBy);
      }
      if (currentFilters.modifiedBy) {
        searchParams.append('modifiedBy', currentFilters.modifiedBy);
      }

      const response = await fetch(`/api/v1/invoice?${searchParams}`, {
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken || ''
        },
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch invoices: ${response.status}`);
      }

      const data = await response.json();

      // Ignore stale responses that finish after a newer request.
      if (fetchId !== latestFetchIdRef.current) {
        return;
      }

      // Store raw API data - transformation happens in useMemo
      setRawInvoices(data.invoices || []);

      const currentPageNum = data.pagination?.page || 1;
      const totalPagesNum = data.pagination?.totalPages || 1;
      setCurrentPage(currentPageNum);
      setTotalPages(totalPagesNum);

    } catch (error) {
      if (fetchId !== latestFetchIdRef.current) {
        return;
      }
      console.error('Error fetching invoices:', error);
      setRawInvoices([]);
    } finally {
      if (fetchId === latestFetchIdRef.current) {
        setIsLoading(false);
      }
    }
  }, [isAuthenticated, csrfToken, documentTypeParam]);

  // Memoize transformation to prevent re-computation on every render
  const transformedInvoices = useMemo(() => {
    return rawInvoices.map((apiInvoice) => ({
      id: apiInvoice.id,
      invoice_number: apiInvoice.invoiceNumber || `#${apiInvoice.id.substring(0, 8)}`,
      contactName: apiInvoice.contactName,  // Pass through manually entered contact name
      customer: apiInvoice.customer ? {  // Only create customer object if there's a linked customer
        display_name: apiInvoice.customer.display_name,
        company_name: apiInvoice.customer.legal_name,
      } : undefined,
      vessel: {
        name: apiInvoice.vessel?.name || apiInvoice.vesselName
      },
      user: apiInvoice.user,
      userName: apiInvoice.userName,
      modifiedByUserName: apiInvoice.modifiedByUserName,
      modifiedByUserAvatar: apiInvoice.modifiedByUserAvatar,
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

  // Fetch records when query state or section type changes.
  useEffect(() => {
    if (!isAuthenticated || !csrfToken) return;

    let cancelled = false;

    const doFetch = async () => {
      if (!cancelled) {
        await fetchInvoices(currentPage, month, searchTerm, filters);
      }
    };

    doFetch();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, csrfToken, fetchInvoices, month, searchTerm, filters, currentPage]);

  // Reset to page 1 when filters or section type changes.
  useEffect(() => {
    setCurrentPage(1);
  }, [month, searchTerm, filters, documentTypeParam]);

  // Avoid rendering stale rows when switching between requests and estimates.
  useEffect(() => {
    setRawInvoices([]);
  }, [documentTypeParam]);


  const handleEdit = useCallback((invoice: Invoice) => {
    navigate(toEdit(invoice.id));
  }, [navigate, toEdit]);

  const handleView = useCallback((invoice: Invoice) => {
    navigate(toView(invoice.id));
  }, [navigate, toView]);

  const handleDelete = useCallback(async (invoice: Invoice) => {
    if (!isAuthenticated || !csrfToken) return;

    const confirmed = await confirm({
      title: `Delete ${singularLabel}`,
      description: `Are you sure you want to delete this ${singularLabel.toLowerCase()}? This action cannot be undone.`,
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
      variant: 'destructive'
    });

    if (!confirmed) return;

    try {
      const response = await fetch(`/api/v1/invoice/${invoice.id}?documentType=${documentTypeParam}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken || ''
        },
        credentials: 'include'
      });

      if (response.ok) {
        // Refresh the list
        fetchInvoices(currentPage, month, searchTerm, filters);
      } else {
        alert(`Failed to delete ${singularLabel.toLowerCase()}`);
      }
    } catch (error) {
      console.error('Error deleting invoice:', error);
      alert(`Error deleting ${singularLabel.toLowerCase()}`);
    }
  }, [isAuthenticated, csrfToken, confirm, fetchInvoices, currentPage, searchTerm, filters, singularLabel, documentTypeParam]);

  const handlePrint = useCallback((invoice: Invoice) => {
    // Navigate to invoice view page with print parameter to auto-trigger print
    navigate(`${toView(invoice.id)}?print=true`);
  }, [navigate, toView]);

  const handleExportPdf = useCallback((invoice: Invoice) => {
    navigate(`${toView(invoice.id)}?export=pdf`);
  }, [navigate, toView]);

  const handleExportCsv = useCallback((invoice: Invoice) => {
    navigate(`${toView(invoice.id)}?export=csv`);
  }, [navigate, toView]);

  const handleAddNew = useCallback(() => {
    navigate(toNew());
  }, [navigate, toNew]);

  const handleBulkDelete = useCallback(async (invoices: Invoice[]) => {
    if (!isAuthenticated || !csrfToken) return;

    const confirmed = await confirm({
      title: `Delete Multiple ${pluralLabel}`,
      description: `Are you sure you want to delete ${invoices.length} ${singularLabel.toLowerCase()}(s)? This action cannot be undone.`,
      confirmLabel: 'Delete All',
      cancelLabel: 'Cancel',
      variant: 'destructive'
    });

    if (!confirmed) return;

    try {
      const deletePromises = invoices.map(invoice =>
        fetch(`/api/v1/invoice/${invoice.id}?documentType=${documentTypeParam}`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': csrfToken || ''
          },
          credentials: 'include'
        })
      );

      await Promise.all(deletePromises);
      // Refresh the list
      fetchInvoices(currentPage, month, searchTerm, filters);
    } catch (error) {
      console.error('Error deleting invoices:', error);
      alert(`Error deleting ${pluralLabel.toLowerCase()}`);
    }
  }, [isAuthenticated, csrfToken, confirm, fetchInvoices, currentPage, searchTerm, filters, singularLabel, pluralLabel, documentTypeParam]);

  const handleCreateInvoiceFromEstimate = useCallback(async (invoice: Invoice) => {
    if (!isAuthenticated || !csrfToken || !isEstimate) return;

    try {
      const response = await fetch(`/api/v1/invoice/${invoice.id}/create-invoice`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken || ''
        },
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error(`Failed to create invoice: ${response.status}`);
      }

      await fetchInvoices(currentPage, month, searchTerm, filters);
      alert('Invoice created from estimate successfully.');
    } catch (error) {
      console.error('Error creating invoice from estimate:', error);
      alert('Failed to create invoice from estimate');
    }
  }, [isAuthenticated, csrfToken, isEstimate, fetchInvoices, currentPage, month, searchTerm, filters]);

  const handleBulkExport = useCallback((invoices: Invoice[]) => {
    const headers = [`${singularLabel} #`, 'Contact', 'Vessel', 'Amount', 'Created At', 'Status'];
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
    link.setAttribute('download', `${pluralLabel.toLowerCase()}-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [pluralLabel, singularLabel]);

  return (
    <>
      <Invoices
        invoices={transformedInvoices}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onView={handleView}
        onCreateInvoice={isEstimate ? handleCreateInvoiceFromEstimate : undefined}
        onPrint={handlePrint}
        onExportPdf={handleExportPdf}
        onExportCsv={handleExportCsv}
        onAddNew={handleAddNew}
        onBulkDelete={handleBulkDelete}
        onBulkExport={handleBulkExport}
        isLoading={isLoading}
        paginationComponent={
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
          />
        }
      />
      {dialog}
    </>
  );
};

export default InvoicesPage;
