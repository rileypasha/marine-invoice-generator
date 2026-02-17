import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GroupingState, ExpandedState } from '@tanstack/react-table';
import { useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { useAuth } from '../context/AuthContext';
import { Users } from 'lucide-react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Button,
  Input,
  Label
} from '../components/magic/index';
import { ContactsTable } from '../components/ContactsTable';
import { ContactsToolbar } from '../components/contacts/ContactsToolbar';
import { useContactsQueryState, ContactGroupBy, ContactActivity } from '../hooks/useContactsQueryState';
import { useFileInput } from '../components/hooks/use-file-input';
import ContactsRowActionsLayer from '../features/contacts/components/ContactsRowActionsLayer';
import { Pagination } from '../components/ui/pagination';

interface Customer {
  id: string;
  display_name: string;
  legal_name?: string;
  email?: string;
  phone?: string;
  address_line1?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
  created_at: string;
  updated_at: string;
  invoice_count?: number;
  invoice_total?: number;
  monthly_invoice_count?: number;
  monthly_invoice_total?: number;
}

const formatCurrencyCell = (value?: number | null) => {
  if (value === undefined || value === null || Number.isNaN(value)) return '';
  return value.toFixed(2);
};

const formatCurrency = (value: number | string | undefined): string => {
  if (!value) return '$0.00';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return `$${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

interface ImportResult {
  success: boolean;
  imported: number;
  skipped: number;
  failed: number;
  errors: Array<{ row: number; error: string }>;
}

const Customers: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated, csrfToken } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // URL-driven state management
  const queryState = useContactsQueryState();

  // State management
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Table state management (controlled)
  const [grouping, setGrouping] = useState<GroupingState>([]);
  const [expanded, setExpanded] = useState<ExpandedState>({});
  const [currentGroupBy, setCurrentGroupBy] = useState<ContactGroupBy>('none');
  const [currentActivity, setCurrentActivity] = useState<ContactActivity>('all');
  const [currentFleet, setCurrentFleet] = useState<string>('all');

  const [showImportModal, setShowImportModal] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [deleteModal, setDeleteModal] = useState<{ show: boolean; customerId: string; customerName: string }>({
    show: false,
    customerId: '',
    customerName: ''
  });

  // State for bulk delete operations
  const [selectedCustomers, setSelectedCustomers] = useState<Customer[]>([]);

  // Initialize file input hook for CSV imports
  const {
    fileName,
    error: fileError,
    fileInputRef: styledFileInputRef,
    handleFileSelect: handleStyledFileSelect,
    clearFile
  } = useFileInput({
    accept: ".csv",
    maxSize: 5
  });
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  // State for total customers count (for header display)
  const [totalCustomers, setTotalCustomers] = useState(0);

  // State for invoice modal
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [selectedCustomerInvoices, setSelectedCustomerInvoices] = useState<any[]>([]);
  const [isLoadingInvoices, setIsLoadingInvoices] = useState(false);
  const [selectedCustomerName, setSelectedCustomerName] = useState('');

  // Fetch all customers from API with URL-driven filtering
  const fetchCustomers = useCallback(async (page = 1) => {
    if (!isAuthenticated || !csrfToken) return;

    try {
      setIsLoading(true);

      // Build query parameters
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '25',
      });

      if (queryState.q.trim()) {
        params.append('search', queryState.q.trim());
      }

      // Add segment filter
      if (queryState.segment !== 'all') {
        params.append('type', queryState.segment);
      }

      const response = await fetch(`/api/v1/customers?${params}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setCustomers(data.customers || []);

        // Update pagination state
        if (data.pagination) {
          setTotalCustomers(data.pagination.total);
          setTotalPages(data.pagination.totalPages || 1);
          setCurrentPage(page);
        } else {
          setTotalCustomers(data.customers?.length || 0);
          setTotalPages(1);
        }
      } else {
        console.error('Failed to fetch customers');
      }
    } catch (error) {
      console.error('Error fetching customers:', error);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, csrfToken, queryState.q, queryState.segment]);

  // Filter customers based on search query and filters
  const filteredCustomers = customers.filter(customer => {
    // Search query filter
    const searchQuery = queryState.q.toLowerCase();
    if (searchQuery) {
      const matchesSearch = customer.display_name?.toLowerCase().includes(searchQuery) ||
                           customer.legal_name?.toLowerCase().includes(searchQuery) ||
                           customer.email?.toLowerCase().includes(searchQuery) ||
                           customer.phone?.toLowerCase().includes(searchQuery) ||
                           customer.address_line1?.toLowerCase().includes(searchQuery) ||
                           customer.city?.toLowerCase().includes(searchQuery) ||
                           customer.state?.toLowerCase().includes(searchQuery);
      if (!matchesSearch) return false;
    }

    // Activity filter (active/inactive based on invoice count)
    if (queryState.activity && queryState.activity !== 'all') {
      const activityValue = String(queryState.activity);
      const hasInvoices = (customer.invoice_count || 0) > 0;
      if (activityValue === 'active' && !hasInvoices) return false;
      if (activityValue === 'inactive' && hasInvoices) return false;
    }

    // Fleet filter (active/inactive based on monthly invoice count)
    if (queryState.fleet && queryState.fleet !== 'all') {
      const fleetValue = String(queryState.fleet);
      const hasMonthlyInvoices = (customer.monthly_invoice_count || 0) > 0;
      if (fleetValue === 'active' && !hasMonthlyInvoices) return false;
      if (fleetValue === 'inactive' && hasMonthlyInvoices) return false;
    }

    // Status filter from filters object (active/inactive based on invoice count)
    if (queryState.filters.status) {
      const hasInvoices = (customer.invoice_count || 0) > 0;
      if (queryState.filters.status === 'active' && !hasInvoices) return false;
      if (queryState.filters.status === 'inactive' && hasInvoices) return false;
    }

    return true;
  });

  // Load customers on mount and when URL state changes
  useEffect(() => {
    setCurrentPage(1);
    fetchCustomers(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryState.q, queryState.activity, queryState.fleet, queryState.segment]);

  // Fetch customers when page changes
  useEffect(() => {
    fetchCustomers(currentPage);
  }, [currentPage, fetchCustomers]);

  // Initialize grouping, activity, and fleet from URL on mount only
  useEffect(() => {
    const g = queryState.groupBy;
    const a = queryState.activity;
    const f = queryState.fleet;
    setCurrentGroupBy(g); // Initialize local state for badge
    setCurrentActivity(a); // Initialize local state for dropdown
    setCurrentFleet(f); // Initialize local state for fleet dropdown
    if (g === 'activity') setGrouping(['activityBucket']);
    else if (g === 'monthlyActivity') setGrouping(['monthlyActivityBucket']);
    else setGrouping([]);
  }, []); // Only run once on mount

  // Search is now handled by the toolbar component via URL state

  // Fetch invoices for a specific customer
  const fetchCustomerInvoices = useCallback(async (customerId: string) => {
    if (!isAuthenticated || !csrfToken) return;

    setIsLoadingInvoices(true);
    try {
      const response = await fetch(`/api/v1/invoice?customerId=${customerId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken
        },
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setSelectedCustomerInvoices(data.invoices || []);
      } else {
        console.error('Failed to fetch customer invoices');
        setSelectedCustomerInvoices([]);
      }
    } catch (error) {
      console.error('Error fetching customer invoices:', error);
      setSelectedCustomerInvoices([]);
    } finally {
      setIsLoadingInvoices(false);
    }
  }, [isAuthenticated, csrfToken]);

  // Handle view invoices click
  const handleViewInvoices = useCallback((customerId: string) => {
    const customer = customers.find(c => c.id === customerId);
    setSelectedCustomerName(customer?.display_name || 'Unknown Contact');
    setShowInvoiceModal(true);
    fetchCustomerInvoices(customerId);
  }, [customers, fetchCustomerInvoices]);

  // Close invoice modal
  const closeInvoiceModal = () => {
    setShowInvoiceModal(false);
    setSelectedCustomerInvoices([]);
    setSelectedCustomerName('');
  };

  // Handle new invoice click
  const handleNewInvoice = useCallback((customer: Customer) => {
    // Build query parameters with customer information
    const addressParts = [
      customer.address_line1,
      customer.city,
      customer.state,
      customer.postal_code,
      customer.country
    ].filter(Boolean);

    const params = new URLSearchParams({
      customerId: customer.id,
      customerName: customer.display_name,
      legalName: customer.legal_name || customer.display_name,
      email: customer.email || '',
      phone: customer.phone || '',
      address: addressParts.join(', ')
    });

    // Navigate to new invoice page with customer data
    navigate(`/requests/new?${params.toString()}`);
  }, [navigate]);

  // Handle file selection
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type === 'text/csv') {
      setSelectedFile(file);
      setImportResult(null);
    } else {
      alert('Please select a valid CSV file');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Enhanced file select handler that integrates with the styled file input
  const handleStyledFileSelectWrapper = (event: React.ChangeEvent<HTMLInputElement>) => {
    handleStyledFileSelect(event);
    const file = event.target.files?.[0];
    if (file && file.type === 'text/csv') {
      setSelectedFile(file);
      setImportResult(null);
    } else if (file) {
      setSelectedFile(null);
      alert('Please select a valid CSV file');
    }
  };

  // Handle CSV import
  const handleImport = async () => {
    if (!selectedFile || !isAuthenticated || !csrfToken) return;

    setIsImporting(true);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const response = await fetch('/api/v1/customers/import', {
        method: 'POST',
        headers: {
          'X-CSRF-Token': csrfToken
        },
        body: formData,
        credentials: 'include',
      });

      const result = await response.json();

      if (response.ok) {
        setImportResult(result);
        // Refresh customers list to show newly imported customers
        await fetchCustomers();
      } else {
        alert(`Import failed: ${result.message}`);
      }
    } catch (error) {
      console.error('Import error:', error);
      alert('Import failed. Please try again.');
    } finally {
      setIsImporting(false);
    }
  };

  // Close import modal
  const closeImportModal = () => {
    setShowImportModal(false);
    setSelectedFile(null);
    setImportResult(null);
    clearFile(); // Clear the styled file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Handle delete confirmation
  const handleDeleteConfirm = async () => {
    if (!isAuthenticated || !csrfToken) return;

    try {
      if (deleteModal.customerId === 'bulk') {
        console.log('Bulk delete confirmed for:', selectedCustomers.length, 'customers');
        setIsBulkDeleting(true);

        // Delete each selected customer one by one
        let successCount = 0;
        let errorCount = 0;
        const errors: string[] = [];

        for (const customer of selectedCustomers) {
          try {
            const response = await fetch(`/api/v1/customers/${customer.id}`, {
              method: 'DELETE',
              headers: {
                'Content-Type': 'application/json',
                'X-CSRF-Token': csrfToken
              },
              credentials: 'include',
            });

            if (response.ok) {
              successCount++;
            } else {
              errorCount++;
              const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
              errors.push(`${customer.display_name}: ${errorData.message || 'Unknown error'}`);
            }
          } catch (error) {
            errorCount++;
            errors.push(`${customer.display_name}: Network error`);
          }
        }

        setIsBulkDeleting(false);

        // Show results
        if (errorCount === 0) {
          // All deletions successful
          console.log(`Successfully deleted ${successCount} customers`);
        } else if (successCount > 0) {
          // Partial success
          alert(`Deleted ${successCount} clients successfully, but ${errorCount} failed:\n${errors.join('\n')}`);
        } else {
          // All failed
          alert(`Failed to delete all clients:\n${errors.join('\n')}`);
          setDeleteModal({ show: false, customerId: '', customerName: '' });
          return; // Don't refresh if all failed
        }

        // Refresh the list to show updated data
        await fetchCustomers();
        setSelectedCustomers([]); // Clear selection
      } else {
        // Single delete API call
        console.log('Deleting customer with ID:', deleteModal.customerId);

        const response = await fetch(`/api/v1/customers/${deleteModal.customerId}`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': csrfToken
          },
          credentials: 'include',
        });

        console.log('Delete response status:', response.status);

        if (response.ok) {
          // Successfully deleted - refresh the list
          await fetchCustomers();
        } else {
          const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
          console.error('Delete failed:', {
            status: response.status,
            statusText: response.statusText,
            error: errorData,
            customerId: deleteModal.customerId
          });
          alert(`Failed to delete client: ${errorData.message || response.statusText || 'Unknown error'}`);
          return; // Don't close modal if deletion failed
        }
      }
    } catch (error) {
      console.error('Delete error:', error);
      alert('Failed to delete client. Please try again.');
      setIsBulkDeleting(false);
      return; // Don't close modal if deletion failed
    }

    setDeleteModal({ show: false, customerId: '', customerName: '' });
  };

  // Close delete modal
  const closeDeleteModal = () => {
    if (isBulkDeleting) return; // Prevent closing during bulk deletion
    setDeleteModal({ show: false, customerId: '', customerName: '' });
    setSelectedCustomers([]); // Clear selected customers
    setIsBulkDeleting(false); // Reset bulk deleting state
  };

  // Memoized callback handlers for ContactsTable
  const handleEdit = useCallback((id: string) => {
    navigate(`/contacts/${id}/edit`);
  }, [navigate]);

  const handleDelete = useCallback((id: string) => {
    const customer = customers.find(c => c.id === id);
    console.log('Delete clicked for customer:', { id, customer });
    setDeleteModal({
      show: true,
      customerId: id,
      customerName: customer?.display_name || 'this contact'
    });
  }, [customers]);

  const handleBulkDelete = useCallback((selectedRows: Customer[]) => {
    setSelectedCustomers(selectedRows);
    setDeleteModal({
      show: true,
      customerId: 'bulk',
      customerName: `${selectedRows.length} selected client${selectedRows.length === 1 ? '' : 's'}`
    });
  }, []);

  const handleBulkExport = useCallback((selectedRows: Customer[]) => {
    // Create CSV with only selected rows
    const csvData = selectedRows.map(customer => ({
      'Contact Name': customer.display_name,
      'Email Address': customer.email || '',
      'Phone Number': customer.phone || '',
      'Address': [
        customer.address_line1,
        customer.city,
        customer.state,
        customer.postal_code,
        customer.country
      ].filter(Boolean).join(', '),
      'Monthly Invoices': customer.monthly_invoice_count ?? '',
      'Monthly Amount': formatCurrencyCell(customer.monthly_invoice_total),
      'Total Invoices': customer.invoice_count ?? '',
      'Total Amount': formatCurrencyCell(customer.invoice_total)
    }));

    const headers = ['Contact Name', 'Email Address', 'Phone Number', 'Address', 'Monthly Invoices', 'Monthly Amount', 'Total Invoices', 'Total Amount'];
    const csvContent = [
      headers.join(','),
      ...csvData.map(row => headers.map(header => `"${row[header as keyof typeof row]}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `selected_clients_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, []);

  // Generate sample CSV for download
  const downloadSampleCSV = () => {
    const sampleData = `Contact Name,Email Address,Phone Number,Address,Monthly Invoices,Monthly Amount,Total Invoices,Total Amount
"Acme Corp","contact@acme.com","5551234567","123 Main St, New York, NY 10001","3","1450.00","12","5600.00"
"TechStart Inc","info@techstart.com","5555678901","456 Tech Ave, San Francisco, CA 94105","1","620.00","5","1920.00"
"Marine Services","admin@marineservices.com","5559990000","789 Harbor Dr, Miami, FL 33101","2","980.00","7","3125.00"`;

    const blob = new Blob([sampleData], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sample_customers.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Direct group change handler that updates state + URL
  const handleGroupByChangeWithState = useCallback((newGroupBy: ContactGroupBy) => {
    // Update local groupBy state IMMEDIATELY (for badge)
    setCurrentGroupBy(newGroupBy);

    // Update TanStack Table grouping state
    if (newGroupBy === 'activity') setGrouping(['activityBucket']);
    else if (newGroupBy === 'monthlyActivity') setGrouping(['monthlyActivityBucket']);
    else setGrouping([]);

    // Clear expansion when changing modes
    setExpanded({});

    // Update URL for bookmarking (async, but doesn't affect badge)
    queryState.set({ groupBy: newGroupBy });
  }, [queryState]);

  // Direct activity change handler that updates state + URL
  const handleActivityChangeWithState = useCallback((newActivity: ContactActivity) => {
    // Update local activity state IMMEDIATELY (for dropdown)
    setCurrentActivity(newActivity);

    // Update URL for bookmarking (async, but doesn't affect dropdown)
    queryState.set({ activity: newActivity });
  }, [queryState]);

  // Direct fleet change handler that updates state + URL
  const handleFleetChangeWithState = useCallback((newFleet: string) => {
    // Update local fleet state IMMEDIATELY (for dropdown)
    setCurrentFleet(newFleet);

    // Update URL for bookmarking (async, but doesn't affect dropdown)
    queryState.set({ fleet: newFleet });
  }, [queryState]);

  return (
    <>
      <div className="h-full flex flex-col">
        {/* Sticky Toolbar - always visible at top */}
        <div className="flex-shrink-0 sticky top-[56px] md:static md:top-0 z-[2999] bg-white/95 md:bg-white backdrop-blur-[10px] backdrop-saturate-[180%] md:backdrop-blur-none border-b pt-4 md:pt-0">
          <ContactsToolbar
            customers={customers}
            currentGroupBy={currentGroupBy}
            currentActivity={currentActivity}
            currentFleet={currentFleet}
            onAddClick={() => navigate('/contacts/create')}
            onGroupByChange={handleGroupByChangeWithState}
            onActivityChange={handleActivityChangeWithState}
            onFleetChange={handleFleetChangeWithState}
            onPrint={() => {
              // Add print-specific styles to hide sidebar and format table properly
              const printStyles = document.createElement('style');
              printStyles.innerHTML = `
                @media print {
                  @page {
                    size: landscape;
                    margin: 0.5in;
                  }

                  /* Hide sidebar */
                  .fixed.left-0.top-0.h-screen,
                  [class*="sidebar"] {
                    display: none !important;
                  }

                  /* Reset main content margin and padding */
                  main {
                    margin: 0 !important;
                    padding: 0 !important;
                    width: 100% !important;
                  }

                  /* Hide fixed header and reset margin */
                  .fixed.top-0.z-30 {
                    position: relative !important;
                    left: 0 !important;
                    right: auto !important;
                  }

                  /* Container adjustments for centering */
                  .max-w-7xl {
                    max-width: none !important;
                    width: 100% !important;
                  }

                  .mx-auto {
                    margin: 0 auto !important;
                    width: 100% !important;
                  }

                  .px-4, .sm\\:px-6, .lg\\:px-8 {
                    padding: 0 !important;
                  }

                  .py-8 {
                    padding-top: 0 !important;
                    padding-bottom: 0 !important;
                  }

                  /* Hide search bar and buttons for cleaner print */
                  .flex.items-center.py-4,
                  .flex.items-center.justify-between.py-4 {
                    display: none !important;
                  }

                  /* Ensure content fills page and centers */
                  body, html {
                    margin: 0 !important;
                    padding: 0 !important;
                    width: 100% !important;
                  }

                  /* Table container centering */
                  .rounded-md.border {
                    border: none !important;
                    border-radius: 0 !important;
                    margin: 0 auto !important;
                    width: 100% !important;
                  }

                  /* Style the table for print */
                  table {
                    border-collapse: collapse !important;
                    width: 100% !important;
                    font-size: 11px !important;
                    table-layout: fixed !important;
                    margin: 0 auto !important;
                  }

                  /* Repeat headers on each page */
                  thead {
                    display: table-header-group !important;
                  }

                  tbody {
                    display: table-row-group !important;
                  }

                  /* Column widths */
                  th:nth-child(2), td:nth-child(2) { width: 20% !important; } /* Name */
                  th:nth-child(3), td:nth-child(3) { width: 25% !important; } /* Email */
                  th:nth-child(4), td:nth-child(4) { width: 15% !important; } /* Phone */
                  th:nth-child(5), td:nth-child(5) { width: 35% !important; } /* Address */

                  th, td {
                    border: 1px solid #000 !important;
                    padding: 4px 6px !important;
                    text-align: left !important;
                    word-wrap: break-word !important;
                    overflow: visible !important;
                    white-space: normal !important;
                    page-break-inside: avoid !important;
                  }

                  /* Header styling - ensure repeats on all pages */
                  th {
                    background-color: #f0f0f0 !important;
                    font-weight: bold !important;
                    height: auto !important;
                    vertical-align: top !important;
                    page-break-after: avoid !important;
                    page-break-before: avoid !important;
                  }

                  /* Force header buttons to show in print */
                  th button,
                  th button *,
                  thead th button,
                  thead th button * {
                    display: inline !important;
                    visibility: visible !important;
                    background: none !important;
                    border: none !important;
                    padding: 0 !important;
                    margin: 0 !important;
                    font-weight: bold !important;
                    color: black !important;
                    white-space: normal !important;
                    opacity: 1 !important;
                  }

                  /* Hide sort arrows in print but keep text */
                  th button svg,
                  thead th button svg {
                    display: none !important;
                  }

                  /* Hide checkboxes column */
                  th:first-child, td:first-child {
                    display: none !important;
                  }

                  /* Hide actions column */
                  th:last-child, td:last-child {
                    display: none !important;
                  }

                  /* Override general button hiding for table headers */
                  th button {
                    display: inline !important;
                  }

                  /* Hide all other buttons except table header buttons */
                  button:not(th button):not(thead th button) {
                    display: none !important;
                  }

                  /* Add title - commented out to prevent page breaks */
                  /*
                  body::before {
                    content: "Clients Directory";
                    display: block;
                    font-size: 18px;
                    font-weight: bold;
                    margin-bottom: 10px;
                    text-align: center;
                  }
                  */
                }
              `;

              document.head.appendChild(printStyles);
              window.print();

              // Clean up styles after print dialog closes
              setTimeout(() => {
                document.head.removeChild(printStyles);
              }, 1000);
            }}
            onImport={() => setShowImportModal(true)}
            onExport={() => {
              // Export all customers to CSV
              const csvData = customers.map(customer => ({
                'Contact Name': customer.display_name,
                'Email Address': customer.email || '',
                'Phone Number': customer.phone || '',
                'Address': [
                  customer.address_line1,
                  customer.city,
                  customer.state,
                  customer.postal_code,
                  customer.country
                ].filter(Boolean).join(', '),
                'Monthly Invoices': customer.monthly_invoice_count ?? '',
                'Monthly Amount': formatCurrencyCell(customer.monthly_invoice_total),
                'Total Invoices': customer.invoice_count ?? '',
                'Total Amount': formatCurrencyCell(customer.invoice_total)
              }));

              const headers = ['Contact Name', 'Email Address', 'Phone Number', 'Address', 'Monthly Invoices', 'Monthly Amount', 'Total Invoices', 'Total Amount'];
              const csvContent = [
                headers.join(','),
                ...csvData.map(row => headers.map(header => `"${row[header as keyof typeof row]}"`).join(','))
              ].join('\n');

              const blob = new Blob([csvContent], { type: 'text/csv' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `all_clients_${new Date().toISOString().split('T')[0]}.csv`;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              URL.revokeObjectURL(url);
            }}
          />
        </div>

        {/* Content - flex-1 and overflow-y-auto makes this the scrollable area */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="text-muted-foreground">Loading contacts...</div>
              </div>
            ) : customers.length === 0 ? (
              <div className="text-center py-8">
                <svg className="mx-auto h-12 w-12 text-muted-foreground mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <div className="text-muted-foreground mb-4">
                  {queryState.q ? 'No contacts found matching your search' : 'No contacts found'}
                </div>
                {!queryState.q && (
                  <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <Button onClick={() => navigate('/contacts/create')}>Add Your First Contact</Button>
                    <Button onClick={() => setShowImportModal(true)} variant="outline">Import from CSV</Button>
                  </div>
                )}
                {queryState.q && (
                  <Button onClick={() => navigate('/contacts/create')}>Add Contact</Button>
                )}
              </div>
            ) : (<>
              <ContactsTable
            customers={filteredCustomers}
            sort={queryState.sort}
            groupBy={queryState.groupBy as 'none' | 'activity' | 'monthlyActivity'}
            grouping={grouping}
            expanded={expanded}
            onGroupingChange={setGrouping}
            onExpandedChange={setExpanded}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onViewInvoices={handleViewInvoices}
            onNewInvoice={handleNewInvoice}
            onBulkDelete={handleBulkDelete}
            onBulkExport={handleBulkExport}
          />

          {/* Pagination */}
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
          />
          </>
            )}
        </div>
      </div>

      {/* Contacts Row Actions Layer */}
      <ContactsRowActionsLayer />

      {/* Import Modal */}
      {showImportModal && createPortal(
        <div className="fixed inset-0 bg-black bg-opacity-25 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Import Contacts from CSV</h3>

            {!importResult ? (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="csv-file">Select CSV File</Label>
                  <div className="mt-2 flex gap-2 items-center">
                    <Button
                      onClick={() => styledFileInputRef.current?.click()}
                      variant="outline"
                      type="button"
                    >
                      {fileName ? 'Change File' : 'Choose File'}
                    </Button>
                    {fileName && (
                      <Button
                        onClick={clearFile}
                        variant="ghost"
                        size="sm"
                        type="button"
                      >
                        Clear
                      </Button>
                    )}
                  </div>

                  <input
                    type="file"
                    accept=".csv"
                    className="hidden"
                    ref={styledFileInputRef}
                    onChange={handleStyledFileSelectWrapper}
                  />

                  {fileName && (
                    <p className="text-sm text-muted-foreground mt-2">
                      Selected: {fileName}
                    </p>
                  )}
                  {fileError && (
                    <p className="text-sm text-red-500 mt-2">
                      Error: {fileError}
                    </p>
                  )}
                </div>

                <div className="text-sm text-gray-600">
                  <p className="font-medium mb-2">CSV column headers:</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li><strong>Contact Name</strong> (required) - Contact display name</li>
                    <li><strong>Email Address</strong> (optional) - Email address</li>
                    <li><strong>Phone Number</strong> (optional) - Phone number</li>
                    <li><strong>Address</strong> (optional) - Complete address (e.g., "123 Main St, New York, NY 10001")</li>
                  </ul>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={downloadSampleCSV}
                  className="w-full"
                >
                  Download Sample CSV
                </Button>

                <div className="flex gap-2">
                  <Button onClick={closeImportModal} variant="outline" className="flex-1">
                    Cancel
                  </Button>
                  <Button
                    onClick={handleImport}
                    disabled={!selectedFile || isImporting}
                    className="flex-1"
                  >
                    {isImporting ? 'Importing...' : 'Import'}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="text-center">
                  {importResult.failed === 0 ? (
                    <div className="text-green-600">
                      <svg className="mx-auto h-12 w-12 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <h4 className="text-lg font-semibold">Import Successful!</h4>
                    </div>
                  ) : (
                    <div className="text-red-600">
                      <svg className="mx-auto h-12 w-12 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <h4 className="text-lg font-semibold">Import Completed with Issues</h4>
                    </div>
                  )}
                </div>

                <div className="space-y-2 text-sm">
                  <p><strong>Imported:</strong> {importResult.imported} contacts</p>
                  <p><strong>Skipped:</strong> {importResult.skipped} (already exist)</p>
                  <p><strong>Failed:</strong> {importResult.failed} rows</p>
                </div>

                {importResult.errors.length > 0 && (
                  <div className="max-h-32 overflow-y-auto">
                    <p className="font-medium text-sm mb-2">Errors:</p>
                    <ul className="text-xs space-y-1">
                      {importResult.errors.map((error, index) => (
                        <li key={index} className="text-red-600">
                          Row {error.row}: {error.error}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <Button onClick={closeImportModal} className="w-full">
                  Close
                </Button>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}

      {/* Delete Confirmation Modal */}
      {deleteModal.show && (
        <div className="fixed inset-0 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg max-w-md w-full mx-4 shadow-lg border">
            <h3 className="text-lg font-semibold mb-4">Confirm Delete</h3>

            {isBulkDeleting ? (
              <div className="text-center py-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Deleting selected clients...</p>
                <p className="text-sm text-gray-500 mt-2">Please wait while we delete {selectedCustomers.length} client{selectedCustomers.length === 1 ? '' : 's'}.</p>
              </div>
            ) : (
              <>
                <p className="text-gray-600 mb-6">
                  Are you sure you want to delete {deleteModal.customerName}? This action cannot be undone.
                </p>

                <div className="flex gap-3 justify-end">
                  <Button onClick={closeDeleteModal} variant="outline">
                    Cancel
                  </Button>
                  <Button onClick={handleDeleteConfirm} variant="destructive">
                    Delete
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Invoice Modal */}
      {showInvoiceModal && createPortal(
        <div className="fixed inset-0 bg-black bg-opacity-25 flex items-center justify-center z-[9999]">
          <div className="bg-white rounded-lg max-w-4xl w-full mx-4 max-h-[80vh] overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Invoices for {selectedCustomerName}</h3>
                <Button onClick={closeInvoiceModal} variant="ghost" size="sm">
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </Button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto max-h-[calc(80vh-120px)]">
              {isLoadingInvoices ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  <span className="ml-2 text-gray-600">Loading invoices...</span>
                </div>
              ) : selectedCustomerInvoices.length === 0 ? (
                <div className="text-center py-8">
                  <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <p className="text-gray-600">No invoices found for this contact.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {selectedCustomerInvoices.map((invoice) => (
                    <div key={invoice.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex flex-col gap-1">
                            <div className="font-medium text-gray-900">{invoice.invoiceNumber || invoice.invoice_number || 'N/A'}</div>
                            {invoice.vessel?.name && (
                              <div className="text-sm text-gray-600">{invoice.vessel.name}</div>
                            )}
                            <div className="text-sm text-gray-600">
                              {invoice.createdAt ? new Date(invoice.createdAt).toLocaleDateString() :
                               invoice.created_at ? new Date(invoice.created_at).toLocaleDateString() : 'N/A'}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold text-gray-900">
                            {formatCurrency(invoice.total)}
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            className="mt-2"
                            onClick={() => navigate(`/requests/${invoice.id}`)}
                          >
                            View Details
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
};

export default Customers;
