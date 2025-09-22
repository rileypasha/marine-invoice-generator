import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
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
  Textarea,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem
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
  jobType?: string;
  itemType?: string;
  laborHours?: number;
  otHours?: number;
  manualCost?: number;
  taxStatus?: 'taxable' | 'non-taxable' | 'exempt';
  taxRate?: number;
  markupType?: 'preset-2.5' | 'preset-12.5' | 'custom' | 'exempt';
  markupRate?: number;
  isMarkupExempt?: boolean;
  isTaxExempt?: boolean;
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
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAuthenticated, csrfToken } = useAuth();

  const isEditMode = !!id;

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
  const [isFetchingData, setIsFetchingData] = useState(isEditMode);
  const [activeTab, setActiveTab] = useState('vessel');
  const [error, setError] = useState<string | null>(null);

  // Fetch existing invoice data when in edit mode
  useEffect(() => {
    if (!isEditMode || !isAuthenticated || !csrfToken || !id) {
      setIsFetchingData(false);
      return;
    }

    const fetchInvoiceData = async () => {
      try {
        const response = await fetch(`/api/v1/invoice/${id}`, {
          headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': csrfToken
          },
          credentials: 'include'
        });

        if (!response.ok) {
          if (response.status === 404) {
            setError('Invoice not found');
          } else if (response.status === 403) {
            setError('You do not have access to this invoice');
          } else {
            setError('Failed to load invoice data');
          }
          return;
        }

        const data = await response.json();
        const invoice = data.invoice || data;

        // Convert invoice data to form structure
        const parsedData = invoice.parsedData || {};
        const vessel = parsedData.vessel || {};
        const customer = parsedData.customer || {};
        const scope = parsedData.scope || {};

        setInvoiceData({
          vessel: {
            name: vessel.name || invoice.vesselName || '',
            weight: vessel.weight?.toString() || invoice.vesselWeight?.toString() || '',
            beam: vessel.beam?.toString() || invoice.vesselBeam?.toString() || ''
          },
          customer: {
            customerName: customer.customerName || invoice.customerName || '',
            customerEmail: customer.customerEmail || invoice.customerEmail || '',
            customerPhone: customer.customerPhone || invoice.customerPhone || '',
            customerAddress: customer.customerAddress || '',
            estimatorName: invoice.userName || '',
            contactName: customer.contactName || ''
          },
          services: scope.lineItems?.map((item: any, index: number) => ({
            id: `service-${index}`,
            description: item.description || '',
            quantity: item.quantity || 1,
            rate: item.rate || item.cost || 0,
            total: item.total || item.cost || 0
          })) || [],
          notes: invoice.notes || '',
          metadata: {
            title: invoice.title || '',
            taxRate: scope.taxRate || 0
          }
        });

        setHasUnsavedChanges(false);
      } catch (error: any) {
        console.error('Error fetching invoice data:', error);
        setError('Failed to load invoice data');
      } finally {
        setIsFetchingData(false);
      }
    };

    fetchInvoiceData();
  }, [isEditMode, isAuthenticated, csrfToken, id]);

  // Automatically add/update Clearance Fee based on vessel weight
  useEffect(() => {
    const weight = parseFloat(invoiceData.vessel.weight) || 0;

    if (weight > 0) {
      const clearanceFeeIndex = invoiceData.services.findIndex(s => s.jobType === 'Clearance Fee');
      const clearanceFeeAmount = weight >= 500 ? 1250 : 950;

      if (clearanceFeeIndex === -1) {
        // Add new Clearance Fee service
        const newClearanceFee: Service = {
          id: `clearance-${Date.now()}`,
          jobType: 'Clearance Fee',
          description: 'Clearance Fee',
          quantity: 1,
          rate: clearanceFeeAmount,
          total: clearanceFeeAmount,
          taxStatus: 'non-taxable',
          taxRate: 0,
          markupType: 'exempt',
          markupRate: 0,
          isMarkupExempt: true,
          isTaxExempt: true
        };

        setInvoiceData(prev => ({
          ...prev,
          services: [...prev.services, newClearanceFee]
        }));
        setHasUnsavedChanges(true);
      } else {
        // Update existing Clearance Fee amount if weight changed
        const existingService = invoiceData.services[clearanceFeeIndex];
        if (existingService.rate !== clearanceFeeAmount) {
          const updatedServices = [...invoiceData.services];
          updatedServices[clearanceFeeIndex] = {
            ...existingService,
            rate: clearanceFeeAmount,
            total: clearanceFeeAmount
          };

          setInvoiceData(prev => ({
            ...prev,
            services: updatedServices
          }));
          setHasUnsavedChanges(true);
        }
      }
    } else {
      // Remove Clearance Fee if weight is 0 or empty
      const clearanceFeeExists = invoiceData.services.some(s => s.jobType === 'Clearance Fee');
      if (clearanceFeeExists) {
        setInvoiceData(prev => ({
          ...prev,
          services: prev.services.filter(s => s.jobType !== 'Clearance Fee')
        }));
        setHasUnsavedChanges(true);
      }
    }
  }, [invoiceData.vessel.weight]);

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

  // Calculation functions based on legacy business logic
  const calculateLineItemCost = (service: Service): number => {
    // Priority: manualCost > cost > calculated from hours
    if (service.manualCost != null && service.manualCost !== 0) {
      return parseFloat(String(service.manualCost)) || 0;
    }
    if (service.rate != null && service.rate !== 0) {
      return parseFloat(String(service.rate)) * (service.quantity || 1);
    }

    // Calculate from labor hours for labor items
    if (service.jobType === 'Manual Entry' && service.itemType === 'Labor') {
      const laborHours = parseFloat(String(service.laborHours)) || 0;
      const otHours = parseFloat(String(service.otHours)) || 0;
      return (laborHours * 80) + (otHours * 120);
    }

    // Agent Services calculation
    if (service.jobType === 'Agent Services') {
      const laborHours = parseFloat(String(service.laborHours)) || 0;
      const otHours = parseFloat(String(service.otHours)) || 0;
      return (laborHours * 80) + (otHours * 120);
    }

    // Clearance Fee calculation based on vessel weight
    if (service.jobType === 'Clearance Fee') {
      const vesselWeight = parseFloat(invoiceData.vessel.weight) || 0;
      return vesselWeight >= 500 ? 1250 : 950;
    }

    // Other labor types
    if (service.itemType === 'Labor') {
      const laborHours = parseFloat(String(service.laborHours)) || 0;
      const otHours = parseFloat(String(service.otHours)) || 0;
      return (laborHours * 85) + (otHours * 127.5);
    }

    return service.rate * service.quantity;
  };

  const applyMarkup = (cost: number, service: Service): number => {
    // Check if item is markup exempt
    if (service.isMarkupExempt ||
        service.markupType === 'exempt' ||
        service.jobType === 'Clearance Fee' ||
        service.jobType === 'Agent Services' ||
        (service.jobType === 'Manual Entry' && service.itemType === 'Labor')) {
      return cost;
    }

    // For items with markupType set to exempt, no markup
    if (service.markupType === 'exempt') {
      return cost;
    }

    // Get markup rate based on type
    if (!service.markupType) {
      return cost; // No markup if type not selected
    }

    let markupRate = 0;
    if (service.markupType === 'preset-2.5') {
      markupRate = 2.5;
    } else if (service.markupType === 'preset-12.5') {
      markupRate = 12.5;
    } else if (service.markupType === 'custom' && service.markupRate) {
      markupRate = service.markupRate;
    }

    // Convert percentage to decimal
    return cost * (1 + markupRate / 100);
  };

  const calculateTax = (service: Service, totalWithMarkup: number): number => {
    // Clearance Fee is always non-taxable
    if (service.jobType === 'Clearance Fee') {
      return 0;
    }

    // Check tax status
    if (!service.taxStatus ||
        service.taxStatus === 'non-taxable' ||
        service.taxStatus === 'exempt' ||
        service.isTaxExempt === true) {
      return 0;
    }

    const taxRate = service.taxRate || 0.0875; // default 8.75%
    return totalWithMarkup * taxRate;
  };

  const addService = () => {
    const newService: Service = {
      id: Date.now().toString(),
      description: '',
      quantity: 1,
      rate: 0,
      total: 0,
      jobType: '',
      itemType: '',
      laborHours: 0,
      otHours: 0,
      manualCost: 0,
      taxStatus: undefined,
      taxRate: 0.0875,
      markupType: undefined,
      markupRate: undefined,
      isMarkupExempt: false,
      isTaxExempt: false
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

          // Apply business rules based on job type
          if (field === 'jobType') {
            // Reset dependent fields when job type changes
            updated.itemType = '';
            updated.laborHours = 0;
            updated.otHours = 0;
            updated.manualCost = 0;

            // Set exemptions based on job type
            if (value === 'Agent Services') {
              updated.isMarkupExempt = true;
              // Don't set markupType, leave it as undefined to show placeholder
            } else if (value === 'Clearance Fee') {
              updated.isMarkupExempt = true;
              updated.isTaxExempt = true;
              updated.markupType = 'exempt';
              updated.taxStatus = 'non-taxable';
            } else if (value === 'Manual Entry') {
              updated.isMarkupExempt = false;
              updated.isTaxExempt = false;
            } else {
              updated.isMarkupExempt = false;
              updated.isTaxExempt = false;
            }
          }

          // Set exemptions for Manual Entry + Labor
          if (field === 'itemType' && updated.jobType === 'Manual Entry' && value === 'Labor') {
            updated.isMarkupExempt = true;
            // Don't set markupType, leave it as undefined to show placeholder
          } else if (field === 'itemType' && updated.jobType === 'Manual Entry' && value !== 'Labor') {
            updated.isMarkupExempt = false;
            // Don't set markupType, leave it as undefined
          }

          // Recalculate cost and total based on all inputs
          const baseCost = calculateLineItemCost(updated);
          const costWithMarkup = applyMarkup(baseCost, updated);
          const taxAmount = calculateTax(updated, costWithMarkup);
          updated.total = costWithMarkup + taxAmount;

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
    if (!isAuthenticated || !csrfToken) {
      setError('Please log in to save invoices');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const url = isEditMode ? `/api/v1/invoice/${id}` : '/api/v1/invoice/save';
      const method = isEditMode ? 'PUT' : 'POST';

      const payload = {
        title: invoiceData.metadata.title || `Invoice for ${invoiceData.vessel.name}`,
        vesselName: invoiceData.vessel.name,
        vesselWeight: parseFloat(invoiceData.vessel.weight) || 0,
        vesselBeam: parseFloat(invoiceData.vessel.beam) || 0,
        customerName: invoiceData.customer.customerName,
        customerEmail: invoiceData.customer.customerEmail,
        customerPhone: invoiceData.customer.customerPhone,
        notes: invoiceData.notes,
        // Calculate totals
        subtotal: invoiceData.services.reduce((sum, service) => sum + service.total, 0),
        total: invoiceData.services.reduce((sum, service) => sum + service.total, 0) +
               (invoiceData.metadata.taxRate ?
                (invoiceData.services.reduce((sum, service) => sum + service.total, 0) * invoiceData.metadata.taxRate / 100) : 0),
        parsedData: {
          vessel: {
            name: invoiceData.vessel.name,
            weight: parseFloat(invoiceData.vessel.weight) || 0,
            beam: parseFloat(invoiceData.vessel.beam) || 0
          },
          customer: {
            customerName: invoiceData.customer.customerName,
            customerEmail: invoiceData.customer.customerEmail,
            customerPhone: invoiceData.customer.customerPhone,
            customerAddress: invoiceData.customer.customerAddress
          },
          scope: {
            lineItems: invoiceData.services.map(service => ({
              description: service.description,
              quantity: service.quantity,
              rate: service.rate,
              cost: service.total
            })),
            taxRate: invoiceData.metadata.taxRate,
            subtotal: invoiceData.services.reduce((sum, service) => sum + service.total, 0),
            total: invoiceData.services.reduce((sum, service) => sum + service.total, 0) +
                   (invoiceData.metadata.taxRate ?
                    (invoiceData.services.reduce((sum, service) => sum + service.total, 0) * invoiceData.metadata.taxRate / 100) : 0)
          }
        }
      };

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken
        },
        credentials: 'include',
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Failed to ${isEditMode ? 'update' : 'save'} invoice`);
      }

      const result = await response.json();
      setHasUnsavedChanges(false);

      // Navigate to invoice view on success
      navigate(`/invoices/${result.id || result.invoice?.id}`);

    } catch (error: any) {
      console.error('Error saving invoice:', error);
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
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

  // Loading state for edit mode
  if (isFetchingData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-sm text-muted-foreground">Loading invoice data...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 mb-4">
            <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold mb-2">Error</h2>
          <p className="text-sm text-muted-foreground mb-4">{error}</p>
          <Button onClick={() => navigate('/invoices')}>
            Back to Invoices
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header Bar */}
      <div className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur">
        <div className="container flex h-14 items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-semibold">{isEditMode ? 'Edit Invoice' : 'New Invoice'}</h1>
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
              {isEditMode ? 'Update Invoice' : 'Save Invoice'}
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
                <CardContent className="space-y-6">
                  {invoiceData.services.map((service) => (
                    <div key={service.id} className="border rounded-lg p-4 space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-medium">Service Item</h4>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => removeService(service.id)}
                          className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                        >
                          ×
                        </Button>
                      </div>

                      {/* Service Type Dropdown */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Service Type *</Label>
                          <Select
                            value={service.jobType}
                            onValueChange={(value) => updateService(service.id, 'jobType', value)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select service type..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Manual Entry">Manual Entry</SelectItem>
                              <SelectItem value="Clearance Fee">Clearance Fee</SelectItem>
                              <SelectItem value="Pilotage">Pilotage</SelectItem>
                              <SelectItem value="Car Rental">Car Rental</SelectItem>
                              <SelectItem value="Trash Removal">Trash Removal</SelectItem>
                              <SelectItem value="Good Stew">Good Stew</SelectItem>
                              <SelectItem value="Crew Placement">Crew Placement</SelectItem>
                              <SelectItem value="Agent Services">Agent Services</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Item Type Dropdown - Only show for Manual Entry */}
                        {service.jobType === 'Manual Entry' && (
                          <div className="space-y-2">
                            <Label>Item Type *</Label>
                            <Select
                              value={service.itemType}
                              onValueChange={(value) => updateService(service.id, 'itemType', value)}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select item type..." />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Labor">Labor</SelectItem>
                                <SelectItem value="Material">Material</SelectItem>
                                <SelectItem value="Subcontractor">Subcontractor</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                      </div>

                      {/* Labor Hours Fields - Show for Labor items */}
                      {((service.jobType === 'Manual Entry' && service.itemType === 'Labor') ||
                        service.jobType === 'Agent Services') && (
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Labor Hours</Label>
                            <Input
                              type="number"
                              step="0.5"
                              value={service.laborHours || 0}
                              onChange={(e) => updateService(service.id, 'laborHours', parseFloat(e.target.value) || 0)}
                              placeholder="0.0"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>OT Hours</Label>
                            <Input
                              type="number"
                              step="0.5"
                              value={service.otHours || 0}
                              onChange={(e) => updateService(service.id, 'otHours', parseFloat(e.target.value) || 0)}
                              placeholder="0.0"
                            />
                          </div>
                        </div>
                      )}

                      {/* Manual Cost Field - Show for Material/Subcontractor */}
                      {((service.jobType === 'Manual Entry' && service.itemType && service.itemType !== 'Labor') ||
                        (service.jobType && service.jobType !== 'Manual Entry' && service.jobType !== 'Agent Services' && service.jobType !== 'Clearance Fee')) && (
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Cost</Label>
                            <Input
                              type="number"
                              step="0.01"
                              value={service.manualCost || 0}
                              onChange={(e) => updateService(service.id, 'manualCost', parseFloat(e.target.value) || 0)}
                              placeholder="0.00"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Quantity</Label>
                            <Input
                              type="number"
                              value={service.quantity}
                              onChange={(e) => updateService(service.id, 'quantity', parseFloat(e.target.value) || 1)}
                              placeholder="1"
                            />
                          </div>
                        </div>
                      )}

                      {/* Description */}
                      <div className="space-y-2">
                        <Label>Description *</Label>
                        <Input
                          value={service.description}
                          onChange={(e) => updateService(service.id, 'description', e.target.value)}
                          placeholder="Enter service description..."
                        />
                      </div>

                      {/* Tax and Markup Configuration */}
                      <div className="grid grid-cols-2 gap-4">
                        {/* Tax Status */}
                        <div className="space-y-2">
                          <Label>Tax Status</Label>
                          {service.jobType === 'Clearance Fee' ? (
                            <div className="flex h-9 w-full items-center rounded-md border border-input bg-muted px-3 py-2 text-sm text-muted-foreground">
                              Non-Taxable (Fixed)
                            </div>
                          ) : (
                            <Select
                              value={service.taxStatus}
                              onValueChange={(value) => updateService(service.id, 'taxStatus', value)}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select Tax Status" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="taxable">Taxable (8.75%)</SelectItem>
                                <SelectItem value="non-taxable">Non-Taxable</SelectItem>
                                <SelectItem value="exempt">Tax Exempt</SelectItem>
                              </SelectContent>
                            </Select>
                          )}
                        </div>

                        {/* Markup */}
                        <div className="space-y-2">
                          <Label>Markup</Label>
                          {service.jobType === 'Clearance Fee' ? (
                            <div className="flex h-9 w-full items-center rounded-md border border-input bg-muted px-3 py-2 text-sm text-muted-foreground">
                              No Markup (Fixed)
                            </div>
                          ) : (
                            <Select
                              value={service.markupType}
                              onValueChange={(value) => updateService(service.id, 'markupType', value)}
                              disabled={service.isMarkupExempt}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select Markup" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="preset-2.5">2.5%</SelectItem>
                                <SelectItem value="preset-12.5">12.5%</SelectItem>
                                <SelectItem value="custom">Custom %</SelectItem>
                                <SelectItem value="exempt">No Markup</SelectItem>
                              </SelectContent>
                            </Select>
                          )}
                        </div>
                      </div>

                      {/* Custom Markup Input */}
                      {service.markupType === 'custom' && !service.isMarkupExempt && service.jobType !== 'Clearance Fee' && (
                        <div className="space-y-2">
                          <Label>Custom Markup (%)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={service.markupRate || 0}
                            onChange={(e) => updateService(service.id, 'markupRate', parseFloat(e.target.value) || 0)}
                            placeholder="0.00"
                          />
                        </div>
                      )}

                      {/* Total Display */}
                      <div className="pt-2 border-t">
                        <div className="flex justify-between items-center text-sm font-medium">
                          <span>Line Total:</span>
                          <span className="text-lg">${service.total.toFixed(2)}</span>
                        </div>

                        {/* Show exemption badges */}
                        <div className="flex gap-2 mt-2">
                          {service.isMarkupExempt && (
                            <Badge variant="secondary" className="text-xs">No Markup</Badge>
                          )}
                          {service.isTaxExempt && (
                            <Badge variant="secondary" className="text-xs">Tax Exempt</Badge>
                          )}
                          {service.jobType === 'Clearance Fee' && (
                            <Badge variant="outline" className="text-xs">Auto-calculated</Badge>
                          )}
                        </div>
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