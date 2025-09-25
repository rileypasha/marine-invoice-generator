import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { Upload, MoreHorizontal, Printer, FileDown, Ship, ArrowUpDown } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Checkbox } from '../components/ui/checkbox';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { DataTable } from '../components/ui/data-table';
import { ColumnDef } from '@tanstack/react-table';
import { Checkbox as TableCheckbox } from '../components/ui/checkbox';
import { SimpleButton as TableButton } from '../components/ui/simple-button';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '../components/ui/dropdown-menu';
import { PaginatedPrintTable } from '../components/ui/paginated-print-table';

interface Vessel {
  id: string;
  name?: string;
  length_ft?: number;
  weight_tons?: number;
  type?: string;
  imo_number?: string;
  flag?: string;
  owner?: string;
}

interface ImportResult {
  success: boolean;
  imported: number;
  skipped: number;
  failed: number;
  errors: Array<{ row: number; error: string }>;
}

interface VesselsProps {
  vessels?: Vessel[];
  onEdit?: (vessel: Vessel) => void;
  onDelete?: (vessel: Vessel) => void;
  onAddNew?: () => void;
  onSearch?: (query: string) => void;
  searchQuery?: string;
  isLoading?: boolean;
  onImport?: () => void;
}

const Vessels: React.FC<VesselsProps> = ({
  vessels: passedVessels = [],
  onEdit,
  onDelete,
  onAddNew,
  onSearch,
  searchQuery = '',
  isLoading: passedIsLoading = false,
  onImport
}) => {
  const navigate = useNavigate();
  const { isAuthenticated, csrfToken, currentUser } = useAuth();

  // Vessel data management
  const [vessels, setVessels] = useState<Vessel[]>(passedVessels);
  const [isLoading, setIsLoading] = useState(passedIsLoading);

  // Import state management
  const [showImportModal, setShowImportModal] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);



  // Pagination state management
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  // Filter vessels based on search
  const filteredVessels = vessels.filter(vessel =>
    vessel.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    vessel.type?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    vessel.imo_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    vessel.flag?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    vessel.owner?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalPages = Math.ceil(filteredVessels.length / rowsPerPage);

  // Fetch vessels from API
  const fetchVessels = async () => {
    if (!isAuthenticated || !csrfToken) return;

    setIsLoading(true);
    try {
      const response = await fetch('/api/v1/vessels', {
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
    if (passedVessels.length === 0) {
      fetchVessels();
    }
  }, [isAuthenticated, csrfToken]);

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
        if (onImport) {
          onImport();
        }
        // Always refresh our local vessel list
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
    const sampleData = `Vessel Name,Length,Weight
"MV Ocean Explorer","180","25000"
"SS Baltic Wave","150","18500"
"MV Atlantic Star","220","35000"`;

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

    const headers = ['Name', 'Length (ft)', 'Weight (tons)'];
    const csvContent = [
      headers.join(','),
      ...vessels.map(vessel => [
        vessel.name || '',
        vessel.length_ft || '',
        vessel.weight_tons || ''
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

  // Bulk delete function
  const handleBulkDelete = async (selectedRows: Vessel[]) => {
    if (selectedRows.length === 0) {
      alert('Please select vessels to delete');
      return;
    }

    const confirmed = confirm(
      `Are you sure you want to delete ${selectedRows.length} vessel${selectedRows.length > 1 ? 's' : ''}? This action cannot be undone.`
    );

    if (!confirmed) return;

    if (!isAuthenticated || !csrfToken) {
      alert('Authentication required');
      return;
    }

    let deleted = 0;
    let failed = 0;

    for (const vessel of selectedRows) {
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

    if (deleted > 0) {
      alert(`Successfully deleted ${deleted} vessel${deleted > 1 ? 's' : ''}${failed > 0 ? `. Failed to delete ${failed} vessel${failed > 1 ? 's' : ''}.` : '.'}`);
      // Refresh the vessels list
      fetchVessels();
    } else {
      alert('Failed to delete vessels. Please try again.');
    }
  };

  // Bulk export function
  const handleBulkExport = (selectedRows: Vessel[]) => {
    if (selectedRows.length === 0) {
      alert('Please select vessels to export');
      return;
    }

    const headers = ['Name', 'Length (ft)', 'Weight (tons)'];
    const csvContent = [
      headers.join(','),
      ...selectedRows.map(vessel => [
        vessel.name || '',
        vessel.length_ft || '',
        vessel.weight_tons || ''
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
  };

  // Pagination logic
  const getPaginatedVessels = () => {
    const startIndex = (currentPage - 1) * rowsPerPage;
    const endIndex = startIndex + rowsPerPage;
    return filteredVessels.slice(startIndex, endIndex);
  };

  // Handle search change
  const handleSearchChange = (value: string) => {
    onSearch?.(value);
    setCurrentPage(1); // Reset to first page when searching
  };

  // Handle rows per page change
  const handleRowsPerPageChange = (newRowsPerPage: string) => {
    setRowsPerPage(Number(newRowsPerPage));
    setCurrentPage(1); // Reset to first page when changing rows per page
  };

  // Handle page change
  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const paginatedVessels = getPaginatedVessels();

  // Print columns definition - includes ALL columns
  const printColumns = [
    { key: 'name' as keyof Vessel, header: 'Vessel Name' },
    {
      key: 'length_ft' as keyof Vessel,
      header: 'Height',
      render: (value: any) => value ? `${value} ft` : '-'
    },
    {
      key: 'weight_tons' as keyof Vessel,
      header: 'Weight',
      render: (value: any) => value ? `${value} tons` : '-'
    }
  ] as const;

  // Define columns for DataTable
  const columns: ColumnDef<Vessel>[] = [
    {
      id: "select",
      header: ({ table }) => (
        <TableCheckbox
          checked={
            table.getIsAllPageRowsSelected() ||
            (table.getIsSomePageRowsSelected() && "indeterminate")
          }
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all"
        />
      ),
      cell: ({ row }) => (
        <TableCheckbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Select row"
        />
      ),
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: "name",
      header: ({ column }) => (
        <TableButton
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Vessel Name
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </TableButton>
      ),
      cell: ({ row }) => (
        <div className="font-medium">{row.getValue("name") || '-'}</div>
      ),
    },
    {
      accessorKey: "length_ft",
      header: "Height",
      cell: ({ row }) => {
        const length = row.getValue("length_ft") as number
        return <div>{length ? `${length} ft` : '-'}</div>
      },
    },
    {
      accessorKey: "weight_tons",
      header: "Weight",
      cell: ({ row }) => {
        const weight = row.getValue("weight_tons") as number
        return <div>{weight ? `${weight} tons` : '-'}</div>
      },
    },
    {
      id: "actions",
      enableHiding: false,
      cell: ({ row }) => {
        const vessel = row.original

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <TableButton variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only">Open menu</span>
                <MoreHorizontal className="h-4 w-4" />
              </TableButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onSelect={() => onEdit?.(vessel)}
              >
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => onDelete?.(vessel)}
                className="text-red-600"
              >
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )
      },
    },
  ];

  return (
    <div className="space-y-6">
      {/* Vessels Table */}
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
              <Button onClick={() => navigate('/vessels/create')}>Add Your First Vessel</Button>
            </div>
          ) : (
            <>
              <div className="mb-4">
                <h2 className="flex items-center gap-2 text-3xl font-semibold mb-4">
                  <Ship className="h-6 w-6" />
                  Vessels
                </h2>
              </div>

              {/* Screen-only interactive table */}
              <div className="screen-only">
                <DataTable
                  columns={columns}
                  data={filteredVessels}
                  searchPlaceholder="Search vessels..."
                  searchColumn="name"
                  showAddButton={true}
                  addButtonText="Add Vessel"
                  onAddClick={() => navigate('/vessels/create')}
                  onPrint={handlePrint}
                  onImport={() => setShowImportModal(true)}
                  onExport={handleExportCSV}
                  onBulkDelete={handleBulkDelete}
                  onBulkExport={handleBulkExport}
                />
              </div>

              {/* Print-only paginated table */}
              <PaginatedPrintTable
                columns={printColumns}
                rows={filteredVessels}
                approxRowsPerPage={30}
              />
            </>
          )}

      {/* Import Modal */}
      {showImportModal && createPortal(
        <div className="fixed inset-0 bg-black bg-opacity-25 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Import Vessels from CSV</h3>

            {!importResult ? (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="csv-file">Select CSV File</Label>
                  <input
                    id="csv-file"
                    type="file"
                    accept=".csv"
                    className="mt-2 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
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
    </div>
  );
};

export default Vessels;