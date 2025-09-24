import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
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

  // State management
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showImportModal, setShowImportModal] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // State for total customers count (for header display)
  const [totalCustomers, setTotalCustomers] = useState(0);

  // Fetch all customers from API (client-side pagination)
  const fetchCustomers = async (search: string = searchQuery) => {
    if (!isAuthenticated || !csrfToken) return;

    try {
      setIsLoading(true);

      // Build query parameters - fetch all customers at once
      const params = new URLSearchParams({
        page: '1',
        limit: '1000', // Fetch all customers for client-side pagination
      });

      if (search.trim()) {
        params.append('search', search.trim());
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

        // Update total count for header display
        if (data.pagination) {
          setTotalCustomers(data.pagination.total);
        } else {
          setTotalCustomers(data.customers?.length || 0);
        }
      } else {
        console.error('Failed to fetch customers');
      }
    } catch (error) {
      console.error('Error fetching customers:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Load customers on mount
  useEffect(() => {
    fetchCustomers();
  }, [isAuthenticated, csrfToken]);

  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
    fetchCustomers(query);
  };

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
        await fetchCustomers(searchQuery);
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
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Generate sample CSV for download
  const downloadSampleCSV = () => {
    const sampleData = `Customer Name,Company Name,Email Address,Phone Number,Address
"Acme Corp","Acme Corporation LLC","contact@acme.com","(555) 123-4567","123 Main St, New York, NY 10001"
"TechStart Inc","","info@techstart.com","(555) 567-8901","456 Tech Ave, San Francisco, CA 94105"
"Marine Services","Marine Services LLC","admin@marineservices.com","(555) 999-0000","789 Harbor Dr, Miami, FL 33101"`;

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

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <Card>
        <CardHeader>
          <CardTitle>Contact Directory</CardTitle>
          <CardDescription>
            Manage your contact database with search, import, and CRUD operations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex justify-end mb-4">
            <div className="flex gap-2">
              <Button onClick={() => setShowImportModal(true)} variant="outline">
                Import
              </Button>
              <Button onClick={() => navigate('/customers/create')}>
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 5v14m-7-7h14" />
                </svg>
                Add Contact
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Customers Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Contacts ({totalCustomers})</CardTitle>
        </CardHeader>
        <CardContent>
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
                {searchQuery ? 'No contacts found matching your search' : 'No contacts found'}
              </div>
              <Button onClick={() => navigate('/customers/create')}>Add Your First Contact</Button>
            </div>
          ) : (
            <ContactsTable
              customers={customers}
              onEdit={(id) => navigate(`/customers/${id}/edit`)}
              onDelete={(id) => {
                // TODO: Implement delete functionality with API call
                console.log('Delete contact:', id);
                // For now, just refresh the list
                fetchCustomers();
              }}
            />
          )}
        </CardContent>
      </Card>

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Import Contacts from CSV</h3>

            {!importResult ? (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="csv-file">Select CSV File</Label>
                  <Input
                    id="csv-file"
                    type="file"
                    accept=".csv"
                    ref={fileInputRef}
                    onChange={handleFileSelect}
                    className="mt-1"
                  />
                </div>

                <div className="text-sm text-gray-600">
                  <p className="font-medium mb-2">CSV column headers:</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li><strong>Contact Name</strong> (required) - Contact display name</li>
                    <li><strong>Company Name</strong> (optional) - Legal business name</li>
                    <li><strong>Email Address</strong> (optional) - Email address</li>
                    <li><strong>Phone Number</strong> (optional) - Phone number</li>
                    <li><strong>Address</strong> (optional) - Complete address (e.g., "123 Main St, New York, NY 10001")</li>
                  </ul>
                  <p className="text-xs text-gray-500 mt-2">
                    Note: The Address field will automatically parse street, city, state, and ZIP code from the full address.
                  </p>
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
                  {importResult.success ? (
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
        </div>
      )}
    </div>
  );
};

export default Customers;