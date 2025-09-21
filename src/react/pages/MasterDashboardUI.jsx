import React, { useState } from 'react';
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
  Badge
} from '../components/index.js';

const MasterDashboardUI = ({
  stats = { totalSaved: 0, todayCount: 0, weekTotal: 0 },
  invoices = [],
  user = null,
  currentPage = 1,
  totalPages = 1,
  isLoading = false,
  onSearch,
  onDateFilter,
  onSort,
  onPageChange,
  onPreviewInvoice,
  onExportCsv,
  onLogout,
  searchQuery = '',
  dateFrom = '',
  dateTo = '',
  sortBy = 'savedAt',
  sortOrder = 'desc'
}) => {
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewInvoiceData, setPreviewInvoiceData] = useState(null);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount || 0);
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString();
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  };

  const handleSort = (column) => {
    const newOrder = sortBy === column && sortOrder === 'desc' ? 'asc' : 'desc';
    onSort?.(column, newOrder);
  };

  const getSortIcon = (column) => {
    if (sortBy !== column) return '↕';
    return sortOrder === 'desc' ? '↓' : '↑';
  };

  const handlePreview = async (invoice) => {
    try {
      const result = await onPreviewInvoice?.(invoice.id);
      if (result) {
        setPreviewInvoiceData(result);
        setShowPreviewModal(true);
      }
    } catch (error) {
      console.error('Error loading invoice preview:', error);
    }
  };

  const handleApplyFilters = () => {
    onDateFilter?.(dateFrom, dateTo);
  };

  const handleClearFilters = () => {
    onSearch?.('');
    onDateFilter?.('', '');
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Master Dashboard</h1>
              <p className="text-sm text-muted-foreground">Invoice Management System</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <div className="text-sm font-medium">{user?.email}</div>
                <Badge variant="default" className="text-xs">✓ MASTER ACCESS</Badge>
              </div>
              <Button variant="outline" onClick={onLogout}>
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Stats Bar */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-3xl font-bold">{stats.totalSaved}</div>
                <div className="text-sm text-muted-foreground">Total Invoices</div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-3xl font-bold">{stats.todayCount}</div>
                <div className="text-sm text-muted-foreground">Today Count</div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-3xl font-bold">{formatCurrency(stats.weekTotal)}</div>
                <div className="text-sm text-muted-foreground">Week Total</div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters Section */}
        <Card>
          <CardHeader>
            <CardTitle>Filters</CardTitle>
            <CardDescription>Search and filter invoices</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col md:flex-row gap-4 items-end">
              <div className="flex-1">
                <label className="text-sm font-medium mb-2 block">Search</label>
                <Input
                  placeholder="Search by customer, vessel, invoice #..."
                  value={searchQuery}
                  onChange={(e) => onSearch?.(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">From Date</label>
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => onDateFilter?.(e.target.value, dateTo)}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">To Date</label>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => onDateFilter?.(dateFrom, e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={handleApplyFilters}>Apply Filters</Button>
                <Button variant="outline" onClick={handleClearFilters}>Clear</Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Invoices Table */}
        <Card>
          <CardHeader>
            <CardTitle>Invoices</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="text-muted-foreground">Loading invoices...</div>
              </div>
            ) : invoices.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-muted-foreground">No invoices found matching your criteria.</div>
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => handleSort('savedAt')}
                      >
                        Saved At {getSortIcon('savedAt')}
                      </TableHead>
                      <TableHead
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => handleSort('userName')}
                      >
                        Submitter {getSortIcon('userName')}
                      </TableHead>
                      <TableHead
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => handleSort('vesselName')}
                      >
                        Vessel {getSortIcon('vesselName')}
                      </TableHead>
                      <TableHead
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => handleSort('customerName')}
                      >
                        Customer {getSortIcon('customerName')}
                      </TableHead>
                      <TableHead
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => handleSort('total')}
                      >
                        Total {getSortIcon('total')}
                      </TableHead>
                      <TableHead>Changes</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoices.map((invoice) => (
                      <TableRow key={invoice.id}>
                        <TableCell className="font-medium">
                          {formatDateTime(invoice.savedAt)}
                        </TableCell>
                        <TableCell>{invoice.userName || '-'}</TableCell>
                        <TableCell>{invoice.vesselName || '-'}</TableCell>
                        <TableCell>{invoice.customerName || '-'}</TableCell>
                        <TableCell className="font-medium">
                          {formatCurrency(invoice.total)}
                        </TableCell>
                        <TableCell>
                          {invoice.changeCount > 0 && (
                            <Badge variant="secondary">{invoice.changeCount} changes</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handlePreview(invoice)}
                            >
                              Preview
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {/* Pagination */}
                <div className="flex items-center justify-between mt-4">
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
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Invoice Preview Modal */}
      {showPreviewModal && previewInvoiceData && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background rounded-lg shadow-lg max-w-4xl max-h-[90vh] overflow-auto">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold">Invoice Preview</h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowPreviewModal(false)}
              >
                ×
              </Button>
            </div>
            <div className="p-4">
              {/* Invoice preview content would be rendered here */}
              <div className="text-center py-8">
                <div className="text-muted-foreground">Invoice preview content</div>
                <div className="text-sm text-muted-foreground mt-2">
                  Preview for Invoice ID: {previewInvoiceData.id}
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 p-4 border-t">
              <Button onClick={onExportCsv} variant="outline">
                Export CSV
              </Button>
              <Button onClick={() => setShowPreviewModal(false)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MasterDashboardUI;