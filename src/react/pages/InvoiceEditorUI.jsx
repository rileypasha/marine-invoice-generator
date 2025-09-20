import React from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Button,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Badge
} from '../components/index.js';

const InvoiceEditorUI = ({
  invoiceData = {},
  onVesselChange,
  onCustomerChange,
  onServicesChange,
  onNotesChange,
  onSave,
  onPreview,
  onPrint,
  onExportPDF,
  onEmail,
  onNewInvoice,
  isEditMode = false,
  hasUnsavedChanges = false,
  isLoading = false,
  user = null
}) => {
  const { vessel = {}, customer = {}, services = [], notes = '', metadata = {} } = invoiceData;

  // Calculate totals
  const subtotal = services.reduce((sum, service) => sum + (service.total || 0), 0);
  const taxAmount = metadata.taxRate ? (subtotal * metadata.taxRate / 100) : 0;
  const total = subtotal + taxAmount;

  return (
    <div className="min-h-screen bg-background">
      {/* Header Bar */}
      <div className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-semibold">
              {isEditMode ? 'Edit Invoice' : 'New Invoice'}
            </h1>
            {hasUnsavedChanges && (
              <Badge variant="secondary" className="text-xs">
                Unsaved Changes
              </Badge>
            )}
            {metadata.title && (
              <span className="text-sm text-muted-foreground">
                {metadata.title}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onNewInvoice}
              disabled={isLoading}
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 5v14m-7-7h14" />
              </svg>
              New
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={onPreview}
              disabled={isLoading}
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              Preview
            </Button>

            <Button
              onClick={onSave}
              disabled={isLoading}
              className={hasUnsavedChanges ? "bg-blue-600 hover:bg-blue-700" : ""}
            >
              {isLoading ? (
                <svg className="w-4 h-4 mr-2 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              ) : (
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                </svg>
              )}
              {isEditMode ? 'Update' : 'Save'} Invoice
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Main Form Area */}
          <div className="lg:col-span-2 space-y-6">
            <Tabs defaultValue="vessel" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="vessel">Vessel</TabsTrigger>
                <TabsTrigger value="customer">Customer</TabsTrigger>
                <TabsTrigger value="services">Services</TabsTrigger>
                <TabsTrigger value="notes">Notes</TabsTrigger>
              </TabsList>

              <TabsContent value="vessel" className="space-y-4 mt-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Vessel Information</CardTitle>
                    <CardDescription>
                      Enter details about the vessel for this invoice
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div id="vessel-form-container">
                      {/* VesselFormUI will be mounted here */}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="customer" className="space-y-4 mt-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Customer Information</CardTitle>
                    <CardDescription>
                      Enter customer and contact details
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div id="customer-form-container">
                      {/* CustomerFormUI will be mounted here */}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="services" className="space-y-4 mt-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Services & Line Items</CardTitle>
                    <CardDescription>
                      Add services, labor, and materials for this invoice
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div id="services-form-container">
                      {/* ServicesFormUI will be mounted here */}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="notes" className="space-y-4 mt-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Notes & Comments</CardTitle>
                    <CardDescription>
                      Add additional notes or special instructions
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div id="notes-form-container">
                      {/* NotesFormUI will be mounted here */}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          {/* Sidebar - Invoice Summary & Actions */}
          <div className="space-y-6">

            {/* Invoice Summary */}
            <Card>
              <CardHeader>
                <CardTitle>Invoice Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">

                {/* Vessel Summary */}
                {vessel.name && (
                  <div className="pb-3 border-b">
                    <div className="text-sm font-medium">Vessel</div>
                    <div className="text-sm text-muted-foreground">{vessel.name}</div>
                    {vessel.weight && (
                      <div className="text-xs text-muted-foreground">
                        Weight: {vessel.weight}
                      </div>
                    )}
                    {vessel.beam && (
                      <div className="text-xs text-muted-foreground">
                        Beam: {vessel.beam}
                      </div>
                    )}
                  </div>
                )}

                {/* Customer Summary */}
                {customer.customerName && (
                  <div className="pb-3 border-b">
                    <div className="text-sm font-medium">Customer</div>
                    <div className="text-sm text-muted-foreground">{customer.customerName}</div>
                    {customer.customerEmail && (
                      <div className="text-xs text-muted-foreground">
                        {customer.customerEmail}
                      </div>
                    )}
                  </div>
                )}

                {/* Financial Summary */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Subtotal:</span>
                    <span>${subtotal.toFixed(2)}</span>
                  </div>
                  {taxAmount > 0 && (
                    <div className="flex justify-between text-sm">
                      <span>Tax ({metadata.taxRate}%):</span>
                      <span>${taxAmount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-semibold border-t pt-2">
                    <span>Total:</span>
                    <span>${total.toFixed(2)}</span>
                  </div>
                </div>

                {/* Service Count */}
                <div className="text-xs text-muted-foreground">
                  {services.length} service{services.length !== 1 ? 's' : ''} added
                </div>
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start"
                  onClick={onPrint}
                  disabled={isLoading || !services.length}
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                  </svg>
                  Print Invoice
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start"
                  onClick={onExportPDF}
                  disabled={isLoading || !services.length}
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Export PDF
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start"
                  onClick={onEmail}
                  disabled={isLoading || !services.length || !customer.customerEmail}
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  Email Invoice
                </Button>
              </CardContent>
            </Card>

            {/* Live Preview Container */}
            <Card>
              <CardHeader>
                <CardTitle>Live Preview</CardTitle>
                <CardDescription>
                  Real-time preview of your invoice
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div id="invoice-preview-container" className="border rounded-lg p-4 bg-white min-h-[200px]">
                  {/* InvoicePreviewUI will be mounted here */}
                  <div className="text-center text-muted-foreground">
                    Preview will appear here as you add content
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InvoiceEditorUI;