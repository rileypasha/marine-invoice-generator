import React, { useState, useRef, useEffect, useCallback } from 'react';
import { GroupingState, ExpandedState } from '@tanstack/react-table';
import { useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { useAuth } from '../context/AuthContext';
import {
  Button,
  Input,
  Label
} from '../components/magic/index';
import { VesselsToolbar } from '../components/vessels/VesselsToolbar';
import { VesselsTable } from '../components/vessels/VesselsTable';
import { Pagination } from '../components/ui/pagination';
import { useVesselsQueryState, VesselGroupBy, VesselSegment } from '../hooks/useVesselsQueryState';

interface Vessel {
  id: string;
  name?: string;
  length_ft?: number;
  weight_tons?: number;
  type?: string;
  imo_number?: string;
  flag?: string;
  owner?: string;
  invoice_count?: number;
  invoice_total?: number;
  monthly_invoice_count?: number;
  monthly_invoice_total?: number;
}

const formatCurrencyCell = (value?: number | null) => {
  if (value === undefined || value === null || Number.isNaN(value)) return '';
  return value.toFixed(2);
};

interface ImportResult {
  success: boolean;
  imported: number;
  skipped: number;
  failed: number;
  errors: Array<{ row: number; error: string }>;
}

const Vessels: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated, csrfToken, currentUser } = useAuth();

  // URL-driven state management
  const queryState = useVesselsQueryState();

  // Vessel data management
  const [vessels, setVessels] = useState<Vessel[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Table state management (controlled)
  const [grouping, setGrouping] = useState<GroupingState>([]);
  const [expanded, setExpanded] = useState<ExpandedState>({});
  const [currentGroupBy, setCurrentGroupBy] = useState<VesselGroupBy>('none');
  const [currentSegment, setCurrentSegment] = useState<VesselSegment>('all');
  const [currentFleet, setCurrentFleet] = useState<string>('all');

  // Import state management
  const [showImportModal, setShowImportModal] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Delete state management
  const [deleteModal, setDeleteModal] = useState<{ show: boolean; vessels: Vessel[] }>({
    show: false,
    vessels: []
  });
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteResult, setDeleteResult] = useState<{ success: boolean; deleted: number; failed: number } | null>(null);

  // State for invoice modal
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [selectedVesselInvoices, setSelectedVesselInvoices] = useState<any[]>([]);
  const [isLoadingInvoices, setIsLoadingInvoices] = useState(false);
  const [selectedVesselName, setSelectedVesselName] = useState('');

  // Filter vessels based on search query and filters
  const filteredVessels = vessels.filter(vessel => {
    // Search query filter
    const searchQuery = queryState.q.toLowerCase();
    if (searchQuery) {
      const matchesSearch = vessel.name?.toLowerCase().includes(searchQuery) ||
                           vessel.type?.toLowerCase().includes(searchQuery) ||
                           vessel.imo_number?.toLowerCase().includes(searchQuery) ||
                           vessel.flag?.toLowerCase().includes(searchQuery) ||
                           vessel.owner?.toLowerCase().includes(searchQuery);
      if (!matchesSearch) return false;
    }

    // Segment filter (active/inactive based on invoice count)
    if (queryState.segment && queryState.segment !== 'all') {
      const hasInvoices = (vessel.invoice_count || 0) > 0;
      if (queryState.segment === 'active' && !hasInvoices) return false;
      if (queryState.segment === 'inactive' && hasInvoices) return false;
    }

    // Fleet filter (active/inactive based on monthly invoice count)
    if (queryState.fleet && queryState.fleet !== 'all') {
      const hasMonthlyInvoices = (vessel.monthly_invoice_count || 0) > 0;
      if (queryState.fleet === 'active' && !hasMonthlyInvoices) return false;
      if (queryState.fleet === 'inactive' && hasMonthlyInvoices) return false;
    }

    // Status filter (active/inactive based on invoice count)
    if (queryState.filters.status) {
      const hasInvoices = (vessel.invoice_count || 0) > 0;
      if (queryState.filters.status === 'active' && !hasInvoices) return false;
      if (queryState.filters.status === 'inactive' && hasInvoices) return false;
    }

    // Size range filter
    if (queryState.filters.lengthRange) {
      const length = vessel.length_ft || 0;
      if (queryState.filters.lengthRange === 'small' && length >= 100) return false;
      if (queryState.filters.lengthRange === 'medium' && (length < 100 || length >= 300)) return false;
      if (queryState.filters.lengthRange === 'large' && length < 300) return false;
    }

    return true;
  });

  // Fetch vessels from API
  const fetchVessels = async () => {
    if (!isAuthenticated || !csrfToken) return;

    setIsLoading(true);
    try {
      const response = await fetch(`/api/v1/vessels?page=${currentPage}&limit=25`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken
        },
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setVessels(data.vessels || []);
        const totalVessels = data.pagination?.total || data.vessels?.length || 0;
        setTotalPages(data.pagination?.totalPages || 1);
      } else {
        console.error('Failed to fetch vessels:', response.statusText);
      }
    } catch (error) {
      console.error('Error fetching vessels:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch vessels on component mount
  useEffect(() => {
    fetchVessels();
  }, [isAuthenticated, csrfToken, currentPage]);

  // Initialize grouping, segment, and fleet from URL on mount only
  useEffect(() => {
    const g = queryState.groupBy;
    const s = queryState.segment;
    const f = queryState.fleet;
    setCurrentGroupBy(g); // Initialize local state for badge
    setCurrentSegment(s); // Initialize local state for dropdown
    setCurrentFleet(f); // Initialize local state for fleet dropdown
    if (g === 'size') setGrouping(['sizeBucket']);
    else if (g === 'activity') setGrouping(['activityBucket']);
    else if (g === 'monthlyActivity') setGrouping(['monthlyActivityBucket']);
    else setGrouping([]);
  }, []); // Only run once on mount

  // Direct group change handler that updates state + URL
  const handleGroupByChangeWithState = useCallback((newGroupBy: VesselGroupBy) => {
    // Update local groupBy state IMMEDIATELY (for badge)
    setCurrentGroupBy(newGroupBy);

    // Update TanStack Table grouping state
    if (newGroupBy === 'size') setGrouping(['sizeBucket']);
    else if (newGroupBy === 'activity') setGrouping(['activityBucket']);
    else if (newGroupBy === 'monthlyActivity') setGrouping(['monthlyActivityBucket']);
    else setGrouping([]);

    // Clear expansion when changing modes
    setExpanded({});

    // Update URL for bookmarking (async, but doesn't affect badge)
    queryState.set({ groupBy: newGroupBy });
  }, [queryState]);

  // Direct segment change handler that updates state + URL
  const handleSegmentChangeWithState = useCallback((newSegment: VesselSegment) => {
    // Update local segment state IMMEDIATELY (for dropdown)
    setCurrentSegment(newSegment);

    // Update URL for bookmarking (async, but doesn't affect dropdown)
    queryState.set({ segment: newSegment });
  }, [queryState]);

  // Direct fleet change handler that updates state + URL
  const handleFleetChangeWithState = useCallback((newFleet: string) => {
    // Update local fleet state IMMEDIATELY (for dropdown)
    setCurrentFleet(newFleet);

    // Update URL for bookmarking (async, but doesn't affect dropdown)
    queryState.set({ fleet: newFleet });
  }, [queryState]);

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

  // Parse CSV content
  const parseCSV = (csvContent: string, userId: string) => {
    const lines = csvContent.trim().split('\n');
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
    const vessels = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.replace(/"/g, '').trim());
      if (values.length >= 3) {
        const vessel = {
          id: `vessel_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          name: values[0] || '',
          length_ft: parseFloat(values[1]) || null, // Length from CSV
          weight_tons: parseFloat(values[2]) || null, // Weight from CSV
          userId: userId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        vessels.push(vessel);
      }
    }

    return vessels;
  };

  // Handle CSV import
  const handleImport = async () => {
    if (!selectedFile || !isAuthenticated || !csrfToken || !currentUser) return;

    setIsImporting(true);
    try {
      // Read CSV file content
      const csvContent = await selectedFile.text();
      const vessels = parseCSV(csvContent, currentUser.id);

      if (vessels.length === 0) {
        alert('No valid vessel data found in CSV file');
        setIsImporting(false);
        return;
      }

      let imported = 0;
      let failed = 0;
      let skipped = 0;
      const errors: Array<{ row: number; error: string }> = [];

      // Process each vessel individually
      for (let i = 0; i < vessels.length; i++) {
        const vessel = vessels[i];

        if (!vessel.name.trim()) {
          skipped++;
          continue;
        }

        try {
          const response = await fetch('/api/v1/vessels', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-CSRF-Token': csrfToken
            },
            body: JSON.stringify(vessel),
            credentials: 'include',
          });

          if (response.ok) {
            imported++;
          } else {
            failed++;
            const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
            errors.push({ row: i + 2, error: errorData.message || 'Unknown error' });
          }
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

      // Refresh vessels list after successful import
      if (imported > 0) {
        fetchVessels();
      }
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

  // Generate sample CSV for download
  const downloadSampleCSV = () => {
    const sampleData = `Vessel Name,Length,Weight,Monthly Invoices,Monthly Amount,Total Invoices,Total Amount
"MV Ocean Explorer","180","25000","2","1250.00","5","3200.00"
"SS Baltic Wave","150","18500","1","850.00","4","2400.00"
"MV Atlantic Star","220","35000","3","1750.00","8","5200.00"`;

    const blob = new Blob([sampleData], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sample_vessels.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Export function
  const handleExportCSV = () => {
    if (vessels.length === 0) {
      alert('No vessels to export');
      return;
    }

    const headers = [
      'Vessel',
      'Length (ft)',
      'Weight (tons)',
      'Monthly Invoices',
      'Monthly Amount',
      'Total Invoices',
      'Total Amount'
    ];
    const csvContent = [
      headers.join(','),
      ...vessels.map(vessel => [
        vessel.name || '',
        vessel.length_ft || '',
        vessel.weight_tons || '',
        vessel.monthly_invoice_count ?? '',
        formatCurrencyCell(vessel.monthly_invoice_total),
        vessel.invoice_count ?? '',
        formatCurrencyCell(vessel.invoice_total)
      ].map(field => `"${field}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `vessels-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Print function
  const handlePrint = () => {
    window.print();
  };

  // Bulk delete function - shows confirmation modal
  const handleBulkDelete = useCallback((selectedRows: Vessel[]) => {
    if (selectedRows.length === 0) {
      alert('Please select vessels to delete');
      return;
    }

    setDeleteModal({
      show: true,
      vessels: selectedRows
    });
  }, []);

  // Handle single vessel delete
  const handleSingleDelete = useCallback((vessel: Vessel) => {
    handleBulkDelete([vessel]);
  }, [handleBulkDelete]);

  // Handle delete confirmation
  const handleDeleteConfirm = async () => {
    if (!isAuthenticated || !csrfToken) {
      alert('Authentication required');
      return;
    }

    setIsDeleting(true);
    let deleted = 0;
    let failed = 0;

    for (const vessel of deleteModal.vessels) {
      try {
        const response = await fetch(`/api/v1/vessels/${vessel.id}`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': csrfToken
          },
          credentials: 'include',
        });

        if (response.ok) {
          deleted++;
        } else {
          failed++;
          console.error(`Failed to delete vessel ${vessel.name}:`, response.statusText);
        }
      } catch (error) {
        failed++;
        console.error(`Error deleting vessel ${vessel.name}:`, error);
      }
    }

    setIsDeleting(false);
    setDeleteResult({
      success: deleted > 0,
      deleted,
      failed
    });

    // Refresh the vessels list if any were deleted
    if (deleted > 0) {
      fetchVessels();
    }
  };

  // Close delete modal
  const closeDeleteModal = () => {
    if (isDeleting) return; // Prevent closing during deletion
    setDeleteModal({ show: false, vessels: [] });
    setDeleteResult(null); // Clear the result state
  };

  // Fetch invoices for a specific vessel
  const fetchVesselInvoices = useCallback(async (vesselId: string) => {
    if (!isAuthenticated || !csrfToken) return;

    setIsLoadingInvoices(true);
    try {
      const response = await fetch(`/api/v1/invoices?vesselId=${vesselId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setSelectedVesselInvoices(data.invoices || []);
      } else {
        console.error('Failed to fetch vessel invoices');
        setSelectedVesselInvoices([]);
      }
    } catch (error) {
      console.error('Error fetching vessel invoices:', error);
      setSelectedVesselInvoices([]);
    } finally {
      setIsLoadingInvoices(false);
    }
  }, [isAuthenticated, csrfToken]);

  // Handle view invoices click
  const handleViewInvoices = useCallback((vessel: Vessel) => {
    setSelectedVesselName(vessel.name || 'Unknown Vessel');
    setShowInvoiceModal(true);
    fetchVesselInvoices(vessel.id);
  }, [fetchVesselInvoices]);

  // Handle edit vessel click
  const handleEdit = useCallback((id: string) => {
    navigate(`/vessels/${id}/edit`);
  }, [navigate]);

  // Close invoice modal
  const closeInvoiceModal = () => {
    setShowInvoiceModal(false);
    setSelectedVesselInvoices([]);
    setSelectedVesselName('');
  };

  // Handle new invoice for vessel
  const handleNewInvoice = useCallback((vessel: Vessel) => {
    const params = new URLSearchParams({
      vesselId: vessel.id,
      vesselName: vessel.name || '',
      vesselWeight: vessel.weight_tons?.toString() || '',
      vesselLength: vessel.length_ft?.toString() || ''
    });

    navigate(`/requests/new?${params.toString()}`);
  }, [navigate]);

  // Bulk export function
  const handleBulkExport = useCallback((selectedRows: Vessel[]) => {
    if (selectedRows.length === 0) {
      alert('Please select vessels to export');
      return;
    }

    const headers = [
      'Vessel',
      'Length (ft)',
      'Weight (tons)',
      'Monthly Invoices',
      'Monthly Amount',
      'Total Invoices',
      'Total Amount'
    ];
    const csvContent = [
      headers.join(','),
      ...selectedRows.map(vessel => [
        vessel.name || '',
        vessel.length_ft || '',
        vessel.weight_tons || '',
        vessel.monthly_invoice_count ?? '',
        formatCurrencyCell(vessel.monthly_invoice_total),
        vessel.invoice_count ?? '',
        formatCurrencyCell(vessel.invoice_total)
      ].map(field => `"${field}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `selected-vessels-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, []);



  return (
    <div className="flex flex-col">
      <VesselsToolbar
        vessels={vessels}
        currentGroupBy={currentGroupBy}
        currentSegment={currentSegment}
        currentFleet={currentFleet}
        onAddClick={() => navigate('/vessels/create')}
        onPrint={handlePrint}
        onImport={() => setShowImportModal(true)}
        onExport={handleExportCSV}
        onGroupByChange={handleGroupByChangeWithState}
        onSegmentChange={handleSegmentChangeWithState}
        onFleetChange={handleFleetChangeWithState}
      />

      <div>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="text-muted-foreground">Loading vessels...</div>
          </div>
        ) : vessels.length === 0 ? (
          <div className="text-center py-8">
            <svg className="mx-auto h-12 w-12 text-muted-foreground mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7H4a2 2 0 00-2 2v6a2 2 0 002 2h4m0-10h8a2 2 0 012 2v6a2 2 0 01-2 2H8m0-10V4a2 2 0 012-2h4a2 2 0 012 2v3M8 17v3a2 2 0 002 2h4a2 2 0 002-2v-3" />
            </svg>
            <div className="text-muted-foreground mb-4">No vessels found</div>
            <div className="flex gap-2 justify-center">
              <Button onClick={() => navigate('/vessels/create')}>
                Add Your First Vessel
              </Button>
              <Button variant="outline" onClick={() => setShowImportModal(true)}>
                Import from CSV
              </Button>
            </div>
          </div>
        ) : (<>
          <VesselsTable
            vessels={filteredVessels}
            sort={queryState.sort}
            groupBy={queryState.groupBy}
            grouping={grouping}
            expanded={expanded}
            onGroupingChange={setGrouping}
            onExpandedChange={setExpanded}
            onEdit={handleEdit}
            onDelete={handleSingleDelete}
            onBulkDelete={handleBulkDelete}
            onBulkExport={handleBulkExport}
            onViewInvoices={handleViewInvoices}
            onNewInvoice={handleNewInvoice}
          />
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
          />
          </>
        )}
      </div>

      {/* Import Modal */}
      {showImportModal && createPortal(
        <div className="fixed inset-0 bg-black bg-opacity-25 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Import Vessels from CSV</h3>

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
                    <li><strong>Vessel Name</strong> (required) - Name of the vessel</li>
                    <li><strong>Length</strong> (required) - Length of the vessel</li>
                    <li><strong>Weight</strong> (required) - Weight of the vessel</li>
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
                  <p><strong>Imported:</strong> {importResult.imported} vessels</p>
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
      {deleteModal.show && createPortal(
        <div className="fixed inset-0 bg-black bg-opacity-25 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg max-w-md w-full mx-4 shadow-lg border">
            {deleteResult ? (
              <>
                <h3 className="text-lg font-semibold mb-4">Delete Complete</h3>
                <div className="space-y-4">
                  <div className="text-center">
                    {deleteResult.success ? (
                      <div className="text-green-600">
                        <svg className="mx-auto h-12 w-12 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <p className="text-lg font-medium">Successfully Deleted</p>
                      </div>
                    ) : (
                      <div className="text-red-600">
                        <svg className="mx-auto h-12 w-12 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                        <p className="text-lg font-medium">Delete Failed</p>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2 text-sm">
                    <p><strong>Deleted:</strong> {deleteResult.deleted} vessel{deleteResult.deleted !== 1 ? 's' : ''}</p>
                    <p><strong>Failed:</strong> {deleteResult.failed} vessel{deleteResult.failed !== 1 ? 's' : ''}</p>
                  </div>

                  <Button onClick={closeDeleteModal} className="w-full">
                    Close
                  </Button>
                </div>
              </>
            ) : (
              <>
                <h3 className="text-lg font-semibold mb-4">Confirm Delete</h3>

                {isDeleting ? (
                  <div className="text-center">
                    <p className="text-gray-600 mb-4">Deleting vessels...</p>
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="text-gray-600 mb-6">
                      Are you sure you want to delete {deleteModal.vessels.length} vessel{deleteModal.vessels.length > 1 ? 's' : ''}? This action cannot be undone.
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
              </>
            )}
          </div>
        </div>,
        document.body
      )}

      {/* Invoice Modal */}
      {showInvoiceModal && createPortal(
        <div className="fixed inset-0 bg-black bg-opacity-25 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg max-w-4xl w-full mx-4 max-h-[80vh] overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Invoices for {selectedVesselName}</h3>
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
              ) : selectedVesselInvoices.length === 0 ? (
                <div className="text-center py-8">
                  <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <p className="text-gray-600">No invoices found for this vessel.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {selectedVesselInvoices.map((invoice) => (
                    <div key={invoice.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-4">
                            <h4 className="font-medium text-gray-900">#{invoice.invoice_number}</h4>
                            <span className={`px-2 py-1 text-xs rounded-full ${
                              invoice.status === 'paid'
                                ? 'bg-green-100 text-green-800'
                                : invoice.status === 'pending'
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-gray-100 text-gray-800'
                            }`}>
                              {invoice.status}
                            </span>
                          </div>
                          <div className="mt-1 text-sm text-gray-600">
                            <div>Created: {new Date(invoice.created_at).toLocaleDateString()}</div>
                            {invoice.due_date && (
                              <div>Due: {new Date(invoice.due_date).toLocaleDateString()}</div>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold text-gray-900">
                            ${invoice.total ? parseFloat(invoice.total).toFixed(2) : '0.00'}
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
    </div>
  );
};

export default Vessels;
