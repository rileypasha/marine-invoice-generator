import React, { useMemo, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { Button, Label } from '../components/magic/index';
import { RequestsToolbar } from '../components/requests/RequestsToolbar';
import { RequestsTable } from '../components/requests/RequestsTable';
import { useRequestsQueryState } from '../hooks/useRequestsQueryState';

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
  userName?: string;
  modifiedByUserName?: string;
  total_amount?: number;
  invoice_date?: string;
  updated_at?: string;
  status?: 'saved' | 'draft' | 'submitted';
}

interface ImportResult {
  success: boolean;
  imported: number;
  skipped: number;
  failed: number;
  errors: Array<{ row: number; error: string }>;
}

interface InvoicesProps {
  invoices?: Invoice[];
  onEdit?: (invoice: Invoice) => void;
  onDelete?: (invoice: Invoice) => void;
  onView?: (invoice: Invoice) => void;
  onPrint?: (invoice: Invoice) => void;
  onAddNew?: () => void;
  onBulkDelete?: (invoices: Invoice[]) => void;
  onBulkExport?: (invoices: Invoice[]) => void;
  isLoading?: boolean;
  isLoadingMore?: boolean;
  loadMoreRef?: React.RefObject<HTMLDivElement>;
  hasMore?: boolean;
}

const Invoices: React.FC<InvoicesProps> = ({
  invoices = [],
  onEdit,
  onDelete,
  onView,
  onPrint,
  onAddNew,
  onBulkDelete,
  onBulkExport,
  isLoading = false,
  isLoadingMore = false,
  loadMoreRef,
  hasMore = false
}) => {
  const navigate = useNavigate();
  const { month, view, q, groupBy, sort, filters } = useRequestsQueryState();

  // Import state management
  const [showImportModal, setShowImportModal] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Apply month filter
  const filteredByMonth = useMemo(() => {
    if (month === 'all') return invoices;

    return invoices.filter(invoice => {
      if (!invoice.invoice_date) return false;
      const invoiceMonth = invoice.invoice_date.slice(0, 7); // YYYY-MM
      return invoiceMonth === month;
    });
  }, [invoices, month]);

  // Apply search filter
  const filteredBySearch = useMemo(() => {
    if (!q) return filteredByMonth;

    const searchLower = q.toLowerCase();
    return filteredByMonth.filter(invoice =>
      invoice.invoice_number?.toLowerCase().includes(searchLower) ||
      invoice.customer?.display_name?.toLowerCase().includes(searchLower) ||
      invoice.customer?.company_name?.toLowerCase().includes(searchLower) ||
      invoice.vessel?.name?.toLowerCase().includes(searchLower)
    );
  }, [filteredByMonth, q]);

  // Apply status filters
  const filteredData = useMemo(() => {
    let result = filteredBySearch;

    // Apply contact filter
    if (filters.contact) {
      const contactLower = filters.contact.toLowerCase();
      result = result.filter(invoice =>
        invoice.customer?.display_name?.toLowerCase().includes(contactLower) ||
        invoice.customer?.company_name?.toLowerCase().includes(contactLower)
      );
    }

    // Apply vessel filter
    if (filters.vessel) {
      const vesselLower = filters.vessel.toLowerCase();
      result = result.filter(invoice =>
        invoice.vessel?.name?.toLowerCase().includes(vesselLower)
      );
    }

    // Apply createdBy filter
    if (filters.createdBy) {
      const createdByLower = filters.createdBy.toLowerCase();
      result = result.filter(invoice =>
        invoice.userName?.toLowerCase().includes(createdByLower)
      );
    }

    // Apply modifiedBy filter
    if (filters.modifiedBy) {
      const modifiedByLower = filters.modifiedBy.toLowerCase();
      result = result.filter(invoice =>
        invoice.modifiedByUserName?.toLowerCase().includes(modifiedByLower)
      );
    }

    // Apply status filter
    if (filters.status) {
      result = result.filter(invoice => invoice.status === filters.status);
    }

    // Apply amount filters
    if (filters.minAmount) {
      result = result.filter(invoice => (invoice.total_amount || 0) >= filters.minAmount!);
    }

    if (filters.maxAmount) {
      result = result.filter(invoice => (invoice.total_amount || 0) <= filters.maxAmount!);
    }

    return result;
  }, [filteredBySearch, filters]);

  // Group invoices by the selected groupBy field
  const groupedInvoices = useMemo(() => {
    if (groupBy === 'none') {
      return [{ group: 'All Invoices', invoices: filteredData }];
    }

    const groups: Record<string, Invoice[]> = {};

    filteredData.forEach(invoice => {
      let groupKey = 'Unknown';

      switch (groupBy) {
        case 'contact':
          groupKey = invoice.customer?.display_name || invoice.customer?.company_name || 'Unknown Contact';
          break;
        case 'vessel':
          groupKey = invoice.vessel?.name || 'Unknown Vessel';
          break;
        case 'createdBy':
          groupKey = invoice.userName || 'Unknown User';
          break;
        case 'modifiedBy':
          groupKey = invoice.modifiedByUserName || 'Unknown User';
          break;
        case 'status':
          const statusMap = {
            requested: 'Requested',
            change_requested: 'Change Requested',
            approved: 'Approved'
          };
          groupKey = statusMap[invoice.status as keyof typeof statusMap] || 'Unknown Status';
          break;
      }

      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      groups[groupKey].push(invoice);
    });

    // Convert to array and sort alphabetically
    return Object.entries(groups)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([group, invoices]) => ({ group, invoices }));
  }, [filteredData, groupBy]);

  // Handle action callbacks
  const handleAddClick = useCallback(() => {
    if (onAddNew) {
      onAddNew();
    } else {
      navigate('/requests/new');
    }
  }, [onAddNew, navigate]);

  const handleEdit = useCallback((id: string) => {
    const invoice = invoices.find(inv => inv.id === id);
    if (invoice && onEdit) {
      onEdit(invoice);
    } else {
      navigate(`/requests/${id}/edit`);
    }
  }, [invoices, onEdit, navigate]);

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  // Export function
  const handleExportCSV = useCallback(() => {
    if (filteredData.length === 0) {
      alert('No invoices to export');
      return;
    }

    const headers = ['Invoice #', 'Contact', 'Vessel', 'Amount', 'Created At', 'Status'];
    const csvContent = [
      headers.join(','),
      ...filteredData.map(invoice => [
        invoice.invoice_number || `#${invoice.id}`,
        invoice.customer?.display_name || invoice.customer?.company_name || '',
        invoice.vessel?.name || '',
        invoice.total_amount || '0',
        invoice.invoice_date ? new Date(invoice.invoice_date).toLocaleDateString() : '',
        invoice.status || 'draft'
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
  }, [filteredData]);

  // Import function - for now just opens modal
  const handleImportCSV = async () => {
    if (!selectedFile) return;

    setIsImporting(true);
    try {
      // Read CSV file content
      const csvContent = await selectedFile.text();
      const invoiceData = parseInvoiceCSV(csvContent);

      if (invoiceData.length === 0) {
        alert('No valid invoice data found in CSV file');
        setIsImporting(false);
        return;
      }

      // For now, simulate import (in real implementation, would POST to API)
      let imported = 0;
      let failed = 0;
      let skipped = 0;
      const errors: Array<{ row: number; error: string }> = [];

      // Simulate processing each invoice
      for (let i = 0; i < invoiceData.length; i++) {
        const invoice = invoiceData[i];

        if (!invoice.invoice_number?.trim()) {
          skipped++;
          continue;
        }

        try {
          // TODO: Replace with actual API call to /api/v1/invoices
          // const response = await fetch('/api/v1/invoices', { ... });

          // Simulate success for demo
          imported++;
        } catch (error) {
          failed++;
          errors.push({ row: i + 2, error: 'Network error' });
        }
      }

      // Set import results
      setImportResult({
        success: failed === 0,
        imported,
        skipped,
        failed,
        errors
      });

      // TODO: Refresh invoices list after successful import
      // if (imported > 0) {
      //   fetchInvoices();
      // }
    } catch (error) {
      console.error('Import error:', error);
      alert('Failed to read CSV file. Please try again.');
    } finally {
      setIsImporting(false);
    }
  };

  // Close import modal
  const closeImportModal = () => {
    setShowImportModal(false);
    setSelectedFile(null);
    setImportResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Parse CSV for invoices
  const parseInvoiceCSV = (csvContent: string) => {
    const lines = csvContent.split('\n');
    const invoices = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const [invoiceNumber, contact, vessel, amount, status] = line.split(',').map(field =>
        field.replace(/^"|"$/g, '').trim()
      );

      invoices.push({
        invoice_number: invoiceNumber,
        customer: { display_name: contact },
        vessel: { name: vessel },
        total_amount: parseFloat(amount) || 0,
        status: status || 'draft',
        invoice_date: new Date().toISOString()
      });
    }

    return invoices;
  };

  // Handle file selection
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  // Generate sample CSV for download
  const downloadSampleCSV = () => {
    const sampleData = `Invoice #,Contact,Vessel,Amount,Status
"INV-001","ABC Marine Services","MV Ocean Explorer","5000","saved"
"INV-002","Coastal Shipping Co","SS Baltic Wave","3500","draft"
"INV-003","Pacific Fleet Ltd","MV Atlantic Star","7500","submitted"`;

    const blob = new Blob([sampleData], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sample_invoices.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="h-full flex flex-col">
      {/* Sticky Toolbar */}
      <RequestsToolbar
        requests={filteredData}
        onAddClick={handleAddClick}
        onPrint={handlePrint}
        onImport={() => setShowImportModal(true)}
        onExport={handleExportCSV}
      />

      {/* Table Content */}
      <div className="flex-1 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-muted-foreground">Loading requests...</div>
          </div>
        ) : filteredData.length === 0 ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <svg className="mx-auto h-12 w-12 text-muted-foreground mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <div className="text-muted-foreground mb-4">
                {month === 'all' ? 'No requests found' : `No requests found for ${month}`}
              </div>
              <button
                onClick={handleAddClick}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-black hover:bg-gray-800"
              >
                Create Your First Request
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {groupedInvoices.map(({ group, invoices }) => (
              <RequestsTable
                key={group}
                requests={invoices}
                sort={sort}
                onEdit={handleEdit}
                onDelete={onDelete}
                onBulkDelete={onBulkDelete}
                onBulkExport={onBulkExport}
                onView={onView}
                onPrint={onPrint}
                title={groupBy !== 'none' ? (
                  <h3 className="text-lg font-semibold text-gray-900 px-6 py-3 bg-gray-50 border-b border-gray-200">
                    {group} ({invoices.length})
                  </h3>
                ) : undefined}
              />
            ))}
          </div>
        )}
      </div>

      {/* Infinite Scroll Trigger */}
      {hasMore && (
        <div ref={loadMoreRef} className="h-20 flex items-center justify-center">
          {isLoadingMore && (
            <div className="text-xs text-gray-400">Loading...</div>
          )}
        </div>
      )}

      {/* End of results message */}
      {!hasMore && filteredData.length > 0 && (
        <div className="py-8 text-center text-sm text-gray-500">
          End of results
        </div>
      )}

      {/* Import Modal */}
      {showImportModal && createPortal(
        <div className="fixed inset-0 bg-black bg-opacity-25 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Import Invoices from CSV</h3>

            {!importResult ? (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="csv-file">Select CSV File</Label>
                  <div className="mt-2 flex gap-2 items-center">
                    <Button
                      onClick={() => fileInputRef.current?.click()}
                      variant="outline"
                      type="button"
                    >
                      {selectedFile ? 'Change File' : 'Choose File'}
                    </Button>
                    {selectedFile && (
                      <Button
                        onClick={() => {
                          setSelectedFile(null);
                          if (fileInputRef.current) {
                            fileInputRef.current.value = '';
                          }
                        }}
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
                    ref={fileInputRef}
                    onChange={handleFileSelect}
                  />

                  {selectedFile && (
                    <p className="text-sm text-muted-foreground mt-2">
                      Selected: {selectedFile.name}
                    </p>
                  )}
                </div>

                <div className="text-sm text-gray-600">
                  <p className="font-medium mb-2">CSV column headers:</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li><strong>Invoice #</strong> (required) - Invoice number</li>
                    <li><strong>Contact</strong> (required) - Customer/contact name</li>
                    <li><strong>Vessel</strong> (optional) - Vessel name</li>
                    <li><strong>Amount</strong> (required) - Invoice amount</li>
                    <li><strong>Status</strong> (optional) - saved, draft, or submitted</li>
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
                    onClick={handleImportCSV}
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
                  <h4 className="text-lg font-medium mb-2">
                    {importResult.success ? '✅ Import Complete' : '⚠️ Import Results'}
                  </h4>
                  <div className="space-y-1 text-sm">
                    <p><strong>{importResult.imported}</strong> invoices imported successfully</p>
                    {importResult.skipped > 0 && (
                      <p><strong>{importResult.skipped}</strong> rows skipped (missing required data)</p>
                    )}
                    {importResult.failed > 0 && (
                      <p className="text-red-600"><strong>{importResult.failed}</strong> invoices failed to import</p>
                    )}
                  </div>
                </div>

                {importResult.errors.length > 0 && (
                  <div className="max-h-32 overflow-y-auto">
                    <p className="font-medium text-sm mb-2">Errors:</p>
                    <ul className="text-sm space-y-1">
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
    </div>
  );
};

export default Invoices;