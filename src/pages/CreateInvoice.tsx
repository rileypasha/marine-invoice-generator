import React, { useState } from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Button,
  Badge,
  Input,
  Label,
  Textarea
} from '../components/magic/index';

interface Vessel {
  name: string;
  weight: string;
  beam: string;
  id?: string;
}

interface Customer {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  customerAddress: string;
  estimatorName: string;
  contactName: string;
  id?: string;
}

interface Service {
  id: string;
  description: string;
  quantity: number;
  rate: number;
  total: number;
}

interface InvoiceData {
  vessel: Vessel;
  customer: Customer;
  services: Service[];
  notes: string;
  metadata: {
    title?: string;
    taxRate?: number;
  };
}

const CreateInvoice: React.FC = () => {
  const [invoiceData, setInvoiceData] = useState<InvoiceData>({
    vessel: { name: '', weight: '', beam: '' },
    customer: {
      customerName: '',
      customerEmail: '',
      customerPhone: '',
      customerAddress: '',
      estimatorName: '',
      contactName: ''
    },
    services: [],
    notes: '',
    metadata: { taxRate: 0 }
  });

  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('vessel');

  const handleVesselChange = (field: keyof Vessel, value: string) => {
    setInvoiceData(prev => ({
      ...prev,
      vessel: { ...prev.vessel, [field]: value }
    }));
    setHasUnsavedChanges(true);
  };

  const handleCustomerChange = (field: keyof Customer, value: string) => {
    setInvoiceData(prev => ({
      ...prev,
      customer: { ...prev.customer, [field]: value }
    }));
    setHasUnsavedChanges(true);
  };

  const handleNotesChange = (value: string) => {
    setInvoiceData(prev => ({ ...prev, notes: value }));
    setHasUnsavedChanges(true);
  };

  const addService = () => {
    const newService: Service = {
      id: Date.now().toString(),
      description: '',
      quantity: 1,
      rate: 0,
      total: 0
    };
    setInvoiceData(prev => ({
      ...prev,
      services: [...prev.services, newService]
    }));
    setHasUnsavedChanges(true);
  };

  const updateService = (id: string, field: keyof Omit<Service, 'id'>, value: string | number) => {
    setInvoiceData(prev => ({
      ...prev,
      services: prev.services.map(service => {
        if (service.id === id) {
          const updated = { ...service, [field]: value };
          // Recalculate total if quantity or rate changed
          if (field === 'quantity' || field === 'rate') {
            updated.total = updated.quantity * updated.rate;
          }
          return updated;
        }
        return service;
      })
    }));
    setHasUnsavedChanges(true);
  };

  const removeService = (id: string) => {
    setInvoiceData(prev => ({
      ...prev,
      services: prev.services.filter(service => service.id !== id)
    }));
    setHasUnsavedChanges(true);
  };

  const handleSave = async () => {
    setIsLoading(true);
    // TODO: Implement save functionality
    console.log('Saving invoice:', invoiceData);
    setTimeout(() => {
      setIsLoading(false);
      setHasUnsavedChanges(false);
    }, 1000);
  };

  const handlePreview = () => {
    console.log('Preview invoice:', invoiceData);
  };

  const handleNewInvoice = () => {
    setInvoiceData({
      vessel: { name: '', weight: '', beam: '' },
      customer: {
        customerName: '',
        customerEmail: '',
        customerPhone: '',
        customerAddress: '',
        estimatorName: '',
        contactName: ''
      },
      services: [],
      notes: '',
      metadata: { taxRate: 0 }
    });
    setHasUnsavedChanges(false);
  };

  const handlePrint = () => {
    console.log('Print invoice');
  };

  const handleExportPDF = () => {
    console.log('Export PDF');
  };

  const handleEmail = () => {
    console.log('Email invoice');
  };

  // Calculate totals
  const subtotal = invoiceData.services.reduce((sum, service) => sum + service.total, 0);
  const taxAmount = invoiceData.metadata.taxRate ? (subtotal * invoiceData.metadata.taxRate / 100) : 0;
  const total = subtotal + taxAmount;

  const TabButton = ({ id, label, isActive, onClick }: {
    id: string;
    label: string;
    isActive: boolean;
    onClick: () => void;
  }) => (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
        isActive
          ? 'bg-primary text-primary-foreground'
          : 'bg-muted text-muted-foreground hover:bg-muted/80'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Header Bar */}
      <div className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur">
        <div className="container flex h-14 items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-semibold">New Invoice</h1>
            {hasUnsavedChanges && (
              <Badge variant="secondary" className="text-xs">
                Unsaved Changes
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleNewInvoice}
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
              onClick={handlePreview}
              disabled={isLoading}
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              Preview
            </Button>

            <Button
              onClick={handleSave}
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
              Save Invoice
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Main Form Area */}
          <div className="lg:col-span-2 space-y-6">
            {/* Tabs */}
            <div className="flex gap-1 p-1 bg-muted rounded-lg">
              <TabButton
                id="vessel"
                label="Vessel"
                isActive={activeTab === 'vessel'}
                onClick={() => setActiveTab('vessel')}
              />
              <TabButton
                id="customer"
                label="Customer"
                isActive={activeTab === 'customer'}
                onClick={() => setActiveTab('customer')}
              />
              <TabButton
                id="services"
                label="Services"
                isActive={activeTab === 'services'}
                onClick={() => setActiveTab('services')}
              />
              <TabButton
                id="notes"
                label="Notes"
                isActive={activeTab === 'notes'}
                onClick={() => setActiveTab('notes')}
              />
            </div>

            {/* Vessel Tab */}
            {activeTab === 'vessel' && (
              <Card>
                <CardHeader>
                  <CardTitle>Vessel Information</CardTitle>
                  <CardDescription>
                    Enter details about the vessel for this invoice
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="vessel-name">Vessel Name</Label>
                    <Input
                      id="vessel-name"
                      value={invoiceData.vessel.name}
                      onChange={(e) => handleVesselChange('name', e.target.value)}
                      placeholder="Enter vessel name"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="vessel-weight">Weight (tons)</Label>
                      <Input
                        id="vessel-weight"
                        value={invoiceData.vessel.weight}
                        onChange={(e) => handleVesselChange('weight', e.target.value)}
                        placeholder="0.0"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="vessel-beam">Beam (ft)</Label>
                      <Input
                        id="vessel-beam"
                        value={invoiceData.vessel.beam}
                        onChange={(e) => handleVesselChange('beam', e.target.value)}
                        placeholder="0.0"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Customer Tab */}
            {activeTab === 'customer' && (
              <Card>
                <CardHeader>
                  <CardTitle>Customer Information</CardTitle>
                  <CardDescription>
                    Enter customer and contact details
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="customer-name">Company Name</Label>
                      <Input
                        id="customer-name"
                        value={invoiceData.customer.customerName}
                        onChange={(e) => handleCustomerChange('customerName', e.target.value)}
                        placeholder="Company name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="contact-name">Contact Name</Label>
                      <Input
                        id="contact-name"
                        value={invoiceData.customer.contactName}
                        onChange={(e) => handleCustomerChange('contactName', e.target.value)}
                        placeholder="Contact person"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="customer-email">Email</Label>
                      <Input
                        id="customer-email"
                        type="email"
                        value={invoiceData.customer.customerEmail}
                        onChange={(e) => handleCustomerChange('customerEmail', e.target.value)}
                        placeholder="email@company.com"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="customer-phone">Phone</Label>
                      <Input
                        id="customer-phone"
                        value={invoiceData.customer.customerPhone}
                        onChange={(e) => handleCustomerChange('customerPhone', e.target.value)}
                        placeholder="(555) 123-4567"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="customer-address">Address</Label>
                    <Textarea
                      id="customer-address"
                      value={invoiceData.customer.customerAddress}
                      onChange={(e) => handleCustomerChange('customerAddress', e.target.value)}
                      placeholder="Customer address"
                    />
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Services Tab */}
            {activeTab === 'services' && (
              <Card>
                <CardHeader>
                  <CardTitle>Services & Line Items</CardTitle>
                  <CardDescription>
                    Add services, labor, and materials for this invoice
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {invoiceData.services.map((service) => (
                    <div key={service.id} className="grid grid-cols-12 gap-4 items-end">
                      <div className="col-span-6">
                        <Label htmlFor={`desc-${service.id}`}>Description</Label>
                        <Input
                          id={`desc-${service.id}`}
                          value={service.description}
                          onChange={(e) => updateService(service.id, 'description', e.target.value)}
                          placeholder="Service description"
                        />
                      </div>
                      <div className="col-span-2">
                        <Label htmlFor={`qty-${service.id}`}>Qty</Label>
                        <Input
                          id={`qty-${service.id}`}
                          type="number"
                          value={service.quantity}
                          onChange={(e) => updateService(service.id, 'quantity', parseFloat(e.target.value) || 0)}
                          placeholder="1"
                        />
                      </div>
                      <div className="col-span-2">
                        <Label htmlFor={`rate-${service.id}`}>Rate</Label>
                        <Input
                          id={`rate-${service.id}`}
                          type="number"
                          step="0.01"
                          value={service.rate}
                          onChange={(e) => updateService(service.id, 'rate', parseFloat(e.target.value) || 0)}
                          placeholder="0.00"
                        />
                      </div>
                      <div className="col-span-1">
                        <Label>Total</Label>
                        <div className="h-10 flex items-center text-sm font-medium">
                          ${service.total.toFixed(2)}
                        </div>
                      </div>
                      <div className="col-span-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => removeService(service.id)}
                          className="h-10 w-10 p-0"
                        >
                          ×
                        </Button>
                      </div>
                    </div>
                  ))}
                  <Button onClick={addService} variant="outline" className="w-full">
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 5v14m-7-7h14" />
                    </svg>
                    Add Service
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Notes Tab */}
            {activeTab === 'notes' && (
              <Card>
                <CardHeader>
                  <CardTitle>Notes & Comments</CardTitle>
                  <CardDescription>
                    Add additional notes or special instructions
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Textarea
                    value={invoiceData.notes}
                    onChange={(e) => handleNotesChange(e.target.value)}
                    placeholder="Additional notes, terms, or special instructions..."
                    className="min-h-[150px]"
                  />
                </CardContent>
              </Card>
            )}
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
                {invoiceData.vessel.name && (
                  <div className="pb-3 border-b">
                    <div className="text-sm font-medium">Vessel</div>
                    <div className="text-sm text-muted-foreground">{invoiceData.vessel.name}</div>
                    {invoiceData.vessel.weight && (
                      <div className="text-xs text-muted-foreground">
                        Weight: {invoiceData.vessel.weight} tons
                      </div>
                    )}
                    {invoiceData.vessel.beam && (
                      <div className="text-xs text-muted-foreground">
                        Beam: {invoiceData.vessel.beam} ft
                      </div>
                    )}
                  </div>
                )}

                {/* Customer Summary */}
                {invoiceData.customer.customerName && (
                  <div className="pb-3 border-b">
                    <div className="text-sm font-medium">Customer</div>
                    <div className="text-sm text-muted-foreground">{invoiceData.customer.customerName}</div>
                    {invoiceData.customer.customerEmail && (
                      <div className="text-xs text-muted-foreground">
                        {invoiceData.customer.customerEmail}
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
                      <span>Tax ({invoiceData.metadata.taxRate}%):</span>
                      <span>${taxAmount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-semibold border-t pt-2">
                    <span>Total:</span>
                    <span>${total.toFixed(2)}</span>
                  </div>
                </div>

                <div className="text-xs text-muted-foreground">
                  {invoiceData.services.length} service{invoiceData.services.length !== 1 ? 's' : ''} added
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
                  onClick={handlePrint}
                  disabled={isLoading || !invoiceData.services.length}
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
                  onClick={handleExportPDF}
                  disabled={isLoading || !invoiceData.services.length}
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
                  onClick={handleEmail}
                  disabled={isLoading || !invoiceData.services.length || !invoiceData.customer.customerEmail}
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  Email Invoice
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreateInvoice;