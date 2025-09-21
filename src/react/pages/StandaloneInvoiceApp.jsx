/**
 * StandaloneInvoiceApp - React component for standalone invoice editing
 * Self-contained invoice editor without authentication requirements
 */
import React, { useEffect, useState, useCallback } from 'react';
import { useInvoice } from '../context/InvoiceContext.jsx';
import useUnsavedChanges from '../hooks/useUnsavedChanges';
import useNavigationProtection from '../hooks/useNavigationProtection';
import useTheme from '../hooks/useTheme';

// Import Magic UI components
import { Button } from '../components/ui/button.jsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card.jsx';
import { Alert, AlertDescription } from '../components/ui/alert.jsx';
import { Input } from '../components/ui/input.jsx';
import { Label } from '../components/ui/label.jsx';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select.jsx';
import { Textarea } from '../components/ui/textarea.jsx';
import { Separator } from '../components/ui/separator.jsx';
import { Badge } from '../components/ui/badge.jsx';
import { motion, AnimatePresence } from 'framer-motion';

// Import pure utility functions
import { formatCurrency, formatDate, formatPhoneNumber, calculateClearanceFee } from '../../utils/pure/formatters';
import { TaxCalculator } from '../../utils/pure/taxCalculator';

const StandaloneInvoiceApp = ({ isStandaloneMode = true }) => {
  const { state: invoiceState, setState, addLineItem, updateLineItem, removeLineItem, calculateTotals, validateState } = useInvoice();
  const { currentTheme } = useTheme();

  // Unsaved changes management
  const {
    hasUnsavedChanges,
    checkState,
    establishBaseline,
    reset: resetUnsavedChanges
  } = useUnsavedChanges();

  // Navigation protection
  const { confirmNavigation } = useNavigationProtection(hasUnsavedChanges);

  // Component state
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('vessel');

  /**
   * Initialize the standalone app
   */
  useEffect(() => {
    try {
      console.log('🚀 Initializing Standalone Invoice App...');

      // Establish baseline with empty state
      establishBaseline(invoiceState);
      setIsInitialized(true);

      console.log('✅ Standalone Invoice App initialized');

    } catch (error) {
      console.error('❌ Error initializing standalone app:', error);
      setError('Failed to initialize standalone invoice editor');
    }
  }, [establishBaseline, invoiceState]);

  /**
   * Handle state changes for unsaved changes detection
   */
  useEffect(() => {
    if (isInitialized) {
      checkState(invoiceState);
    }
  }, [invoiceState, isInitialized, checkState]);

  /**
   * Handle save as local draft
   */
  const handleSaveLocal = useCallback(() => {
    try {
      const invoiceData = {
        ...invoiceState,
        id: 'standalone_' + Date.now(),
        lastModified: new Date().toISOString(),
        isStandalone: true
      };

      // Save to localStorage
      const existingDrafts = JSON.parse(localStorage.getItem('standalone_invoice_drafts') || '[]');
      existingDrafts.push(invoiceData);
      localStorage.setItem('standalone_invoice_drafts', JSON.stringify(existingDrafts));

      establishBaseline(invoiceData);
      alert('Invoice saved as local draft successfully!');

    } catch (error) {
      console.error('❌ Error saving local draft:', error);
      alert('Failed to save invoice. Please try again.');
    }
  }, [invoiceState, establishBaseline]);

  /**
   * Handle PDF export
   */
  const handleExportPDF = useCallback(() => {
    try {
      const totals = calculateTotals();
      console.log('📄 Exporting PDF with totals:', totals);

      // Simple PDF export using browser print
      window.print();

    } catch (error) {
      console.error('❌ PDF export failed:', error);
      alert('Failed to export PDF. Please try again.');
    }
  }, [calculateTotals]);

  /**
   * Handle email composition
   */
  const handleComposeEmail = useCallback(() => {
    try {
      const totals = calculateTotals();
      const subject = encodeURIComponent(`Invoice Request - ${invoiceState.vessel.name || 'Marine Services'}`);
      const body = encodeURIComponent(`
Dear ${invoiceState.customer.customerName || 'Customer'},

Please find below the details for your marine invoice request:

Vessel: ${invoiceState.vessel.name || 'N/A'}
Total Amount: ${formatCurrency(totals.total)}
Date: ${formatDate()}

Best regards,
${invoiceState.customer.estimatorName || 'Marine Services Team'}
      `);

      const email = invoiceState.customer.customerEmail || '';
      window.open(`mailto:${email}?subject=${subject}&body=${body}`);

    } catch (error) {
      console.error('❌ Email composition failed:', error);
      alert('Failed to compose email. Please try again.');
    }
  }, [invoiceState, calculateTotals]);

  /**
   * Handle adding line item
   */
  const handleAddLineItem = useCallback(() => {
    const newItem = addLineItem({
      jobType: '',
      itemType: '',
      description: '',
      manualCost: '',
      laborHours: '',
      otHours: '',
      tax: false
    });
    console.log('➕ Added line item:', newItem);
  }, [addLineItem]);

  /**
   * Show error state
   */
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="text-red-600">Error</CardTitle>
            <CardDescription>Something went wrong</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
            <div className="flex gap-2">
              <Button
                onClick={() => window.location.reload()}
                variant="outline"
                className="flex-1"
              >
                Reload Page
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  /**
   * Show loading state
   */
  if (!isInitialized) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Initializing standalone invoice editor...</p>
        </motion.div>
      </div>
    );
  }

  const totals = calculateTotals();
  const validation = validateState();

  return (
    <div className={`min-h-screen ${currentTheme === 'dark' ? 'dark' : ''}`}>
      {/* Unsaved changes indicator */}
      {hasUnsavedChanges && (
        <div className="fixed top-0 left-0 right-0 bg-amber-500 text-white text-center py-1 text-sm z-50">
          ● You have unsaved changes
        </div>
      )}

      {/* Standalone mode indicator */}
      <div className="fixed top-2 right-2 z-40">
        <Badge variant="secondary" className="bg-blue-100 text-blue-800">
          Standalone Mode
        </Badge>
      </div>

      <div className="container mx-auto p-4 pt-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-6xl mx-auto"
        >
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              Standalone Invoice Editor
            </h1>
            <p className="text-gray-600 dark:text-gray-300">
              Create and edit marine invoices without requiring authentication
            </p>
          </div>

          {/* Tab Navigation */}
          <div className="flex space-x-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1 mb-6">
            {[
              { id: 'vessel', label: 'Vessel Details' },
              { id: 'customer', label: 'Customer Info' },
              { id: 'scope', label: 'Scope & Items' },
              { id: 'preview', label: 'Preview' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
                    : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              {/* Vessel Details Tab */}
              {activeTab === 'vessel' && (
                <Card>
                  <CardHeader>
                    <CardTitle>Vessel Information</CardTitle>
                    <CardDescription>Enter the vessel details for this invoice</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="vessel-name">Vessel Name *</Label>
                        <Input
                          id="vessel-name"
                          value={invoiceState.vessel.name || ''}
                          onChange={(e) => setState({
                            ...invoiceState,
                            vessel: { ...invoiceState.vessel, name: e.target.value }
                          })}
                          placeholder="Enter vessel name"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="vessel-weight">Weight (tons)</Label>
                        <Input
                          id="vessel-weight"
                          value={invoiceState.vessel.weight || ''}
                          onChange={(e) => setState({
                            ...invoiceState,
                            vessel: { ...invoiceState.vessel, weight: e.target.value }
                          })}
                          placeholder="Enter weight"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="vessel-beam">Beam (ft)</Label>
                        <Input
                          id="vessel-beam"
                          value={invoiceState.vessel.beam || ''}
                          onChange={(e) => setState({
                            ...invoiceState,
                            vessel: { ...invoiceState.vessel, beam: e.target.value }
                          })}
                          placeholder="Enter beam"
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Customer Info Tab */}
              {activeTab === 'customer' && (
                <Card>
                  <CardHeader>
                    <CardTitle>Customer Information</CardTitle>
                    <CardDescription>Enter customer and estimator details</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="customer-name">Customer Name *</Label>
                        <Input
                          id="customer-name"
                          value={invoiceState.customer.customerName || ''}
                          onChange={(e) => setState({
                            ...invoiceState,
                            customer: { ...invoiceState.customer, customerName: e.target.value }
                          })}
                          placeholder="Enter customer name"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="customer-email">Customer Email</Label>
                        <Input
                          id="customer-email"
                          type="email"
                          value={invoiceState.customer.customerEmail || ''}
                          onChange={(e) => setState({
                            ...invoiceState,
                            customer: { ...invoiceState.customer, customerEmail: e.target.value }
                          })}
                          placeholder="Enter customer email"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="customer-phone">Customer Phone</Label>
                        <Input
                          id="customer-phone"
                          value={invoiceState.customer.customerPhone || ''}
                          onChange={(e) => setState({
                            ...invoiceState,
                            customer: { ...invoiceState.customer, customerPhone: e.target.value }
                          })}
                          placeholder="Enter customer phone"
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Scope & Items Tab */}
              {activeTab === 'scope' && (
                <div className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>Invoice Settings</CardTitle>
                      <CardDescription>Configure markup and tax settings</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="markup-rate">Markup Rate (%)</Label>
                          <Select
                            value={invoiceState.scope.markupRate?.toString()}
                            onValueChange={(value) => setState({
                              ...invoiceState,
                              scope: { ...invoiceState.scope, markupRate: value }
                            })}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select markup rate" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="2.5">2.5%</SelectItem>
                              <SelectItem value="5">5%</SelectItem>
                              <SelectItem value="10">10%</SelectItem>
                              <SelectItem value="15">15%</SelectItem>
                              <SelectItem value="20">20%</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="taxable">Taxable</Label>
                          <Select
                            value={invoiceState.scope.isTaxable ? 'yes' : 'no'}
                            onValueChange={(value) => setState({
                              ...invoiceState,
                              scope: { ...invoiceState.scope, isTaxable: value === 'yes' }
                            })}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select tax status" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="no">No</SelectItem>
                              <SelectItem value="yes">Yes</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Line Items</CardTitle>
                      <CardDescription>Add services and costs for this invoice</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <Button onClick={handleAddLineItem} className="w-full">
                        Add Line Item
                      </Button>

                      {invoiceState.scope.lineItems?.length > 0 && (
                        <div className="space-y-2">
                          {invoiceState.scope.lineItems.map((item, index) => (
                            <div key={item.id} className="p-4 border rounded-lg space-y-2">
                              <div className="flex justify-between items-center">
                                <h4 className="font-medium">Item {index + 1}</h4>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => removeLineItem(item.id)}
                                >
                                  Remove
                                </Button>
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                <Input
                                  placeholder="Description"
                                  value={item.description || ''}
                                  onChange={(e) => updateLineItem(item.id, { description: e.target.value })}
                                />
                                <Input
                                  placeholder="Amount"
                                  type="number"
                                  value={item.amount || ''}
                                  onChange={(e) => updateLineItem(item.id, { amount: parseFloat(e.target.value) || 0 })}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Preview Tab */}
              {activeTab === 'preview' && (
                <Card>
                  <CardHeader>
                    <CardTitle>Invoice Preview</CardTitle>
                    <CardDescription>Review your invoice before exporting</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Invoice Header */}
                    <div className="text-center border-b pb-4">
                      <h2 className="text-2xl font-bold">Marine Invoice</h2>
                      <p className="text-gray-600">{formatDate()}</p>
                    </div>

                    {/* Vessel & Customer Info */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <h3 className="font-semibold mb-2">Vessel Information</h3>
                        <p><strong>Name:</strong> {invoiceState.vessel.name || 'N/A'}</p>
                        <p><strong>Weight:</strong> {invoiceState.vessel.weight || 'N/A'} tons</p>
                        <p><strong>Beam:</strong> {invoiceState.vessel.beam || 'N/A'} ft</p>
                      </div>
                      <div>
                        <h3 className="font-semibold mb-2">Customer Information</h3>
                        <p><strong>Name:</strong> {invoiceState.customer.customerName || 'N/A'}</p>
                        <p><strong>Email:</strong> {invoiceState.customer.customerEmail || 'N/A'}</p>
                        <p><strong>Phone:</strong> {invoiceState.customer.customerPhone || 'N/A'}</p>
                      </div>
                    </div>

                    {/* Line Items */}
                    <div>
                      <h3 className="font-semibold mb-2">Services</h3>
                      {invoiceState.scope.lineItems?.length > 0 ? (
                        <div className="space-y-2">
                          {invoiceState.scope.lineItems.map((item, index) => (
                            <div key={item.id} className="flex justify-between p-2 border rounded">
                              <span>{item.description || `Item ${index + 1}`}</span>
                              <span>{formatCurrency(item.amount || 0)}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-gray-500">No line items added</p>
                      )}
                    </div>

                    {/* Totals */}
                    <div className="border-t pt-4">
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span>Subtotal:</span>
                          <span>{formatCurrency(totals.subtotal)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Markup ({invoiceState.scope.markupRate || 0}%):</span>
                          <span>{formatCurrency(totals.markup)}</span>
                        </div>
                        {invoiceState.scope.isTaxable && (
                          <div className="flex justify-between">
                            <span>Tax:</span>
                            <span>{formatCurrency(totals.taxAmount)}</span>
                          </div>
                        )}
                        <Separator />
                        <div className="flex justify-between font-bold text-lg">
                          <span>Total:</span>
                          <span>{formatCurrency(totals.total)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Validation Errors */}
                    {!validation.isValid && (
                      <Alert variant="destructive">
                        <AlertDescription>
                          <div>Please fix the following errors:</div>
                          <ul className="list-disc list-inside mt-2">
                            {validation.errors.map((error, index) => (
                              <li key={index}>{error}</li>
                            ))}
                          </ul>
                        </AlertDescription>
                      </Alert>
                    )}
                  </CardContent>
                </Card>
              )}
            </motion.div>
          </AnimatePresence>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-3 mt-6 pt-6 border-t">
            <Button onClick={handleSaveLocal} variant="outline">
              Save Draft Locally
            </Button>
            <Button onClick={handleExportPDF}>
              Export PDF
            </Button>
            <Button onClick={handleComposeEmail} variant="outline">
              Compose Email
            </Button>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default StandaloneInvoiceApp;