import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { gatherInvoiceData } from '../utils/invoiceData';
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
import jsPDF from 'jspdf';

interface Vessel {
  name: string;
  weight: string;
  beam: string;
  id?: string;
}

interface DatabaseVessel {
  id: string;
  name: string;
  registration_number?: string;
  length_ft?: number;
  beam_ft?: number;
  weight_tons?: number;
  home_port?: string;
  owner_name?: string;
}

interface DatabaseCustomer {
  id: string;
  display_name: string;
  legal_name?: string;
  email?: string;
  phone?: string;
  address_line1?: string;
  city?: string;
  state?: string;
  postal_code?: string;
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

interface ServiceSnapshot {
  id: string;
  description: string;
  jobType?: string;
  itemType?: string;
  quantity: number;
  rate: number;
  laborHours: number;
  otHours: number;
  manualCost: number | null;
  taxStatus?: Service['taxStatus'];
  taxRate?: number;
  markupType?: Service['markupType'];
  markupRate?: number;
  isMarkupExempt: boolean;
  isTaxExempt: boolean;
  baseCost: number;
  markupAmount: number;
  totalBeforeTax: number;
  taxAmount: number;
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

const toNumber = (value: any, fallback: number): number => {
  if (value === null || value === undefined || value === '') {
    return fallback;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : fallback;
  }
  const parsed = parseFloat(String(value));
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toOptionalNumber = (value: any): number | undefined => {
  if (value === null || value === undefined || value === '') {
    return undefined;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined;
  }
  const parsed = parseFloat(String(value));
  return Number.isFinite(parsed) ? parsed : undefined;
};

const normalizeBoolean = (value: any): boolean | undefined => {
  if (value === null || value === undefined) {
    return undefined;
  }
  if (typeof value === 'boolean') {
    return value;
  }
  const normalized = String(value).toLowerCase();
  if (['true', '1', 'yes', 'y'].includes(normalized)) {
    return true;
  }
  if (['false', '0', 'no', 'n'].includes(normalized)) {
    return false;
  }
  return undefined;
};

const normalizeTaxStatus = (value: any): Service['taxStatus'] | undefined => {
  if (!value) {
    return undefined;
  }
  const normalized = String(value).toLowerCase().replace(/[_ –-]/g, '');
  if (normalized === 'taxable') {
    return 'taxable';
  }
  if (normalized === 'nontaxable') {
    return 'non-taxable';
  }
  if (normalized === 'exempt') {
    return 'exempt';
  }
  return undefined;
};

const normalizeMarkupType = (value: any): Service['markupType'] | undefined => {
  if (!value) {
    return undefined;
  }
  const normalized = String(value).toLowerCase().replace(/[_ ]/g, '-');
  if (normalized === 'preset-2.5' || normalized === 'preset-25' || normalized === 'preset2.5') {
    return 'preset-2.5';
  }
  if (normalized === 'preset-12.5' || normalized === 'preset-125' || normalized === 'preset12.5') {
    return 'preset-12.5';
  }
  if (normalized === 'custom') {
    return 'custom';
  }
  if (normalized === 'exempt') {
    return 'exempt';
  }
  return undefined;
};





const formatAddress = (customer: Partial<DatabaseCustomer>) => {
  if (!customer) return '';
  const { address_line1, city, state, postal_code } = customer;
  return [address_line1, city, state, postal_code].filter(Boolean).join(', ');
};

const CreateInvoice: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
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
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [emailRecipient, setEmailRecipient] = useState('');
  const [emailMessage, setEmailMessage] = useState('');
  const [isEmailSending, setIsEmailSending] = useState(false);
  const [isWeightFocused, setIsWeightFocused] = useState(false);
  const [isBeamFocused, setIsBeamFocused] = useState(false);

  const roundCurrency = (value: number): number => {
    if (!Number.isFinite(value)) {
      return 0;
    }
    return Math.round((value + Number.EPSILON) * 100) / 100;
  };

  const roundRate = (value: number): number => {
    if (!Number.isFinite(value)) {
      return 0;
    }
    return Math.round((value + Number.EPSILON) * 10000) / 10000;
  };

  const toNullableNumber = (value: number | undefined): number | null => {
    if (value === undefined || value === null) {
      return null;
    }
    return Number.isFinite(value) ? roundCurrency(value) : null;
  };

  // Vessel linking state
  const [availableVessels, setAvailableVessels] = useState<DatabaseVessel[]>([]);
  const [isLoadingVessels, setIsLoadingVessels] = useState(false);
  const [selectedVesselId, setSelectedVesselId] = useState<string>('');
  const [vesselSearchQuery, setVesselSearchQuery] = useState('');

  // Customer linking state
  const [availableCustomers, setAvailableCustomers] = useState<DatabaseCustomer[]>([]);
  const [isLoadingCustomers, setIsLoadingCustomers] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');

  // Address autocomplete state
  const [addressSuggestions, setAddressSuggestions] = useState<any[]>([]);
  const [isLoadingAddress, setIsLoadingAddress] = useState(false);
  const [showAddressSuggestions, setShowAddressSuggestions] = useState(false);
  const addressTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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

        const { primaryData, scope, lineItems } = gatherInvoiceData<Record<string, any>>(invoice);

        const vesselData = primaryData?.vessel || invoice.vessel || {};
        const customerData = primaryData?.customer || invoice.customer || {};

        const services: Service[] = lineItems.map((item: Record<string, any>, index: number) => {
          const quantity = toNumber(item.quantity ?? item.qty ?? 1, 1) || 1;
          const rate = toNumber(item.rate ?? item.cost ?? item.price ?? 0, 0);
          const manualCost = toOptionalNumber(item.manualCost ?? item.manual_cost);
          const total = toNumber(
            item.total ?? item.cost ?? (quantity * rate),
            quantity * rate
          );
          const laborHours = toOptionalNumber(item.laborHours ?? item.labor_hours ?? item.hours);
          const otHours = toOptionalNumber(item.otHours ?? item.ot_hours ?? item.overtimeHours);
          const taxRate = toOptionalNumber(item.taxRate ?? item.tax_rate ?? scope?.taxRate ?? scope?.tax_rate);
          const markupRate = toOptionalNumber(item.markupRate ?? item.markup_rate ?? scope?.markupRate ?? scope?.markup_rate);
          const taxStatus = normalizeTaxStatus(item.taxStatus ?? item.tax_status);
          const markupType = normalizeMarkupType(item.markupType ?? item.markup_type);
          const isMarkupExempt = normalizeBoolean(item.isMarkupExempt ?? item.markup_exempt);
          const isTaxExempt = normalizeBoolean(item.isTaxExempt ?? item.tax_exempt);

          const service: Service = {
            id: item.id ? String(item.id) : `service-${index}`,
            description: item.description || item.name || '',
            quantity,
            rate,
            total,
          };

          const jobType = item.jobType ?? item.job_type ?? item.type;
          if (jobType) {
            service.jobType = jobType;
          }

          const itemType = item.itemType ?? item.item_type;
          if (itemType) {
            service.itemType = itemType;
          }

          if (laborHours !== undefined) {
            service.laborHours = laborHours;
          }

          if (otHours !== undefined) {
            service.otHours = otHours;
          }

          if (manualCost !== undefined) {
            service.manualCost = manualCost;
          }

          if (taxStatus) {
            service.taxStatus = taxStatus;
          }

          if (taxRate !== undefined) {
            service.taxRate = taxRate;
          }

          if (markupType) {
            service.markupType = markupType;
          }

          if (markupRate !== undefined) {
            service.markupRate = markupRate;
          }

          if (isMarkupExempt !== undefined) {
            service.isMarkupExempt = isMarkupExempt;
          }

          if (isTaxExempt !== undefined) {
            service.isTaxExempt = isTaxExempt;
          }

          return service;
        });

        const vesselWeightSource =
          vesselData.weight ?? invoice.vesselWeight ?? invoice.vessel?.weight_tons ?? '';
        const vesselBeamSource =
          vesselData.beam ?? invoice.vesselBeam ?? invoice.vessel?.beam_ft ?? '';

        const resolvedCustomerName =
          customerData.customerName ||
          customerData.display_name ||
          customerData.legal_name ||
          invoice.customer?.display_name ||
          invoice.customer?.legal_name ||
          invoice.customerName ||
          '';

        const resolvedCustomerEmail =
          customerData.customerEmail ||
          customerData.email ||
          invoice.customer?.email ||
          invoice.customerEmail ||
          '';

        const resolvedCustomerPhone =
          customerData.customerPhone ||
          customerData.phone ||
          invoice.customer?.phone ||
          invoice.customerPhone ||
          '';

        const resolvedCustomerAddress = formatAddress(customerData);

        const resolvedContactName =
          customerData.contactName ||
          customerData.contact_name ||
          invoice.customer?.contact_name ||
          invoice.customerName ||
          '';

        setInvoiceData({
          vessel: {
            name: vesselData.name || invoice.vessel?.name || invoice.vesselName || '',
            weight: vesselWeightSource === '' ? '' : vesselWeightSource.toString(),
            beam: vesselBeamSource === '' ? '' : vesselBeamSource.toString()
          },
          customer: {
            customerName: resolvedCustomerName,
            customerEmail: resolvedCustomerEmail,
            customerPhone: resolvedCustomerPhone,
            customerAddress: resolvedCustomerAddress,
            estimatorName: invoice.userName || '',
            contactName: resolvedContactName
          },
          services,
          notes: invoice.notes || '',
          metadata: {
            title: invoice.title || '',
            taxRate: toNumber(
              scope?.taxRate ?? scope?.tax_rate ?? invoice.metadata?.taxRate ?? invoice.metadata?.tax_rate ?? 0,
              0
            )
          }
        });

        const resolvedCustomerId = customerData.id ?? customerData.customerId ?? invoice.customer?.id ?? '';
        const resolvedVesselId = vesselData.id ?? invoice.vessel?.id ?? '';

        setSelectedCustomerId(resolvedCustomerId ? String(resolvedCustomerId) : '');
        setSelectedVesselId(resolvedVesselId ? String(resolvedVesselId) : '');

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

  // Handle query parameters for pre-filling customer data
  useEffect(() => {
    // Only process query params if we're NOT in edit mode (creating a new invoice)
    if (isEditMode || !searchParams.has('customerId')) {
      return;
    }

    const customerId = searchParams.get('customerId');
    const customerName = searchParams.get('customerName');
    const legalName = searchParams.get('legalName');
    const email = searchParams.get('email');
    const phone = searchParams.get('phone');
    const address_line1 = searchParams.get('address_line1');
    const city = searchParams.get('city');
    const state = searchParams.get('state');
    const postal_code = searchParams.get('postal_code');

    if (customerId) {
      // Set the selected customer ID to auto-select in the dropdown
      setSelectedCustomerId(customerId);

      // Pre-fill the customer data
      setInvoiceData(prev => ({
        ...prev,
        customer: {
          ...prev.customer,
          id: customerId,
          contactName: customerName || '',
          customerName: legalName || customerName || '',
          customerEmail: email || '',
          customerPhone: phone || '',
          customerAddress: formatAddress({ address_line1, city, state, postal_code }) || ''
        }
      }));
    }
  }, [isEditMode, searchParams]);

  // Handle query parameters for pre-filling vessel data
  useEffect(() => {
    // Only process query params if we're NOT in edit mode (creating a new invoice)
    if (isEditMode || !searchParams.has('vesselId')) {
      return;
    }

    const vesselId = searchParams.get('vesselId');
    const vesselName = searchParams.get('vesselName');
    const vesselWeight = searchParams.get('vesselWeight');
    const vesselLength = searchParams.get('vesselLength');

    if (vesselId) {
      // Set the selected vessel ID to auto-select in the dropdown
      setSelectedVesselId(vesselId);

      // Pre-fill the vessel data
      setInvoiceData(prev => ({
        ...prev,
        vessel: {
          ...prev.vessel,
          id: vesselId,
          name: vesselName || '',
          weight: vesselWeight || '',
          beam: vesselLength || ''
        }
      }));
    }
  }, [isEditMode, searchParams]);

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

  // Cleanup address timeout on unmount
  useEffect(() => {
    return () => {
      if (addressTimeoutRef.current) {
        clearTimeout(addressTimeoutRef.current);
      }
    };
  }, []);

  // Format phone number as (XXX) XXX-XXXX
  const formatPhoneNumber = (value: string): string => {
    const numbers = value.replace(/\D/g, '').slice(0, 10);
    if (numbers.length <= 3) return numbers;
    if (numbers.length <= 6) return `(${numbers.slice(0, 3)}) ${numbers.slice(3)}`;
    return `(${numbers.slice(0, 3)}) ${numbers.slice(3, 6)}-${numbers.slice(6)}`;
  };

  const handleVesselChange = (field: keyof Vessel, value: string) => {
    // Strip suffixes before storing the value
    let cleanValue = value;
    if (field === 'weight') {
      cleanValue = value.replace(' tons', '').trim();
    } else if (field === 'beam') {
      cleanValue = value.replace(' ft', '').trim();
    }

    setInvoiceData(prev => ({
      ...prev,
      vessel: { ...prev.vessel, [field]: cleanValue }
    }));
    setHasUnsavedChanges(true);

    // Clear vessel link when manually editing fields
    if (selectedVesselId) {
      setSelectedVesselId('');
    }
  };

  // Helper function to format value with suffix for display
  const formatWithSuffix = (value: string, suffix: string) => {
    if (!value || value.trim() === '') return '';
    const cleanValue = value.replace(suffix, '').trim();
    return cleanValue ? cleanValue + suffix : '';
  };

  // Helper function to remove suffix for editing
  const stripSuffix = (value: string, suffix: string) => {
    if (!value) return '';
    return value.replace(suffix, '').trim();
  };

  // Function to search vessels
  const searchVessels = async (query: string) => {
    if (!isAuthenticated || !csrfToken || query.length < 2) {
      setAvailableVessels([]);
      return;
    }

    setIsLoadingVessels(true);
    try {
      const response = await fetch(`/api/v1/vessels/search?query=${encodeURIComponent(query)}&limit=10`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken
        },
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        setAvailableVessels(data.vessels || []);
      } else {
        console.error('Failed to search vessels:', response.statusText);
        setAvailableVessels([]);
      }
    } catch (error) {
      console.error('Error searching vessels:', error);
      setAvailableVessels([]);
    } finally {
      setIsLoadingVessels(false);
    }
  };

  const searchCustomers = async (query: string) => {
    if (!isAuthenticated || !csrfToken || query.length < 2) {
      setAvailableCustomers([]);
      return;
    }

    setIsLoadingCustomers(true);
    try {
      const response = await fetch(`/api/v1/customers/search?query=${encodeURIComponent(query)}&limit=10`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken
        },
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        setAvailableCustomers(data.customers || []);
      } else {
        console.error('Failed to search customers:', response.statusText);
        setAvailableCustomers([]);
      }
    } catch (error) {
      console.error('Error searching customers:', error);
      setAvailableCustomers([]);
    } finally {
      setIsLoadingCustomers(false);
    }
  };

  const searchAddresses = async (query: string) => {
    if (!query || query.length < 3) {
      setAddressSuggestions([]);
      setShowAddressSuggestions(false);
      return;
    }

    setIsLoadingAddress(true);
    try {
      const response = await fetch(`/api/geo/address-autocomplete?query=${encodeURIComponent(query)}&limit=5`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include'
      });

      if (response.ok) {
        const suggestions = await response.json();
        setAddressSuggestions(suggestions || []);
        setShowAddressSuggestions(true);
      } else {
        console.error('Failed to search addresses:', response.statusText);
        setAddressSuggestions([]);
        setShowAddressSuggestions(false);
      }
    } catch (error) {
      console.error('Error searching addresses:', error);
      setAddressSuggestions([]);
      setShowAddressSuggestions(false);
    } finally {
      setIsLoadingAddress(false);
    }
  };

  const handleCustomerChange = (field: keyof Customer, value: string) => {
    let processedValue = value;

    // Format phone number automatically
    if (field === 'customerPhone') {
      processedValue = formatPhoneNumber(value);
    }

    setInvoiceData(prev => ({
      ...prev,
      customer: { ...prev.customer, [field]: processedValue }
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

    const defaultTaxRate =
      invoiceData.metadata.taxRate != null ? invoiceData.metadata.taxRate / 100 : 0.0875;
    const taxRate = typeof service.taxRate === 'number' ? service.taxRate : defaultTaxRate;
    return totalWithMarkup * taxRate;
  };

  const buildServiceSnapshot = (service: Service): ServiceSnapshot => {
    const quantity = Number.isFinite(service.quantity) ? Number(service.quantity) : 1;
    const rate = Number.isFinite(service.rate) ? Number(service.rate) : 0;
    const normalizedService: Service = {
      ...service,
      quantity,
      rate,
    };

    const baseCostRaw = calculateLineItemCost(normalizedService);
    const baseCost = roundCurrency(baseCostRaw);

    const manualCostValue =
      normalizedService.manualCost != null && normalizedService.manualCost > 0
        ? roundCurrency(normalizedService.manualCost)
        : null;

    const effectiveBaseCost = manualCostValue !== null ? manualCostValue : baseCost;
    const costWithMarkup = roundCurrency(applyMarkup(effectiveBaseCost, normalizedService));
    const taxAmountValue = roundCurrency(calculateTax(normalizedService, costWithMarkup));

    return {
      id: normalizedService.id,
      description: normalizedService.description?.trim() || '',
      jobType: normalizedService.jobType || '',
      itemType: normalizedService.itemType || '',
      quantity,
      rate,
      laborHours: Number.isFinite(normalizedService.laborHours) ? Number(normalizedService.laborHours) : 0,
      otHours: Number.isFinite(normalizedService.otHours) ? Number(normalizedService.otHours) : 0,
      manualCost: manualCostValue,
      taxStatus: normalizedService.taxStatus,
      taxRate: typeof normalizedService.taxRate === 'number' ? normalizedService.taxRate : undefined,
      markupType: normalizedService.markupType,
      markupRate: typeof normalizedService.markupRate === 'number' ? normalizedService.markupRate : undefined,
      isMarkupExempt: !!normalizedService.isMarkupExempt,
      isTaxExempt: !!normalizedService.isTaxExempt,
      baseCost: roundCurrency(effectiveBaseCost),
      markupAmount: roundCurrency(costWithMarkup - effectiveBaseCost),
      totalBeforeTax: costWithMarkup,
      taxAmount: normalizedService.isTaxExempt ? 0 : taxAmountValue,
      total: roundCurrency(costWithMarkup + (normalizedService.isTaxExempt ? 0 : taxAmountValue)),
    };
  };

  const buildInvoiceSubmissionPayload = () => {
    const serviceSnapshots = invoiceData.services.map(buildServiceSnapshot);

    const baseCostSumRaw = serviceSnapshots.reduce((sum, snapshot) => sum + snapshot.baseCost, 0);
    const subtotalBeforeTaxRaw = serviceSnapshots.reduce((sum, snapshot) => sum + snapshot.totalBeforeTax, 0);
    const totalTaxRaw = serviceSnapshots.reduce((sum, snapshot) => sum + snapshot.taxAmount, 0);

    const baseCostSum = roundCurrency(baseCostSumRaw);
    const subtotalBeforeTax = roundCurrency(subtotalBeforeTaxRaw);
    const totalTax = roundCurrency(totalTaxRaw);
    const finalTotal = roundCurrency(subtotalBeforeTax + totalTax);
    const grossProfit = roundCurrency(subtotalBeforeTax - baseCostSum);
    const profitPercent = baseCostSum > 0
      ? roundCurrency((grossProfit / baseCostSum) * 100)
      : 0;
    const markupRateValue = baseCostSum > 0
      ? roundRate((subtotalBeforeTax - baseCostSum) / baseCostSum)
      : 0;

    const vesselWeightRaw = toOptionalNumber(invoiceData.vessel.weight);
    const vesselBeamRaw = toOptionalNumber(invoiceData.vessel.beam);

    const structuredData = {
      scope: {
        markupRate: markupRateValue,
        isTaxable: totalTax > 0,
        lineItems: serviceSnapshots.map((snapshot) => ({
          id: snapshot.id,
          jobType: snapshot.jobType || '',
          itemType: snapshot.itemType || '',
          description: snapshot.description,
          manualCost: snapshot.manualCost,
          laborHours: snapshot.laborHours || null,
          otHours: snapshot.otHours || null,
          cost: snapshot.baseCost,
          laborCost: snapshot.itemType === 'Labor' ? snapshot.baseCost : null,
          materialCost: snapshot.itemType === 'Material' ? snapshot.baseCost : null,
          subcontractorCost: snapshot.itemType === 'Subcontractor' ? snapshot.baseCost : null
        }))
      },
      laborRate: 85,
      otRate: 127.5
    };

    const metadataPayload = {
      ...invoiceData.metadata,
      taxRate: invoiceData.metadata.taxRate || 0
    };

    const parsedData = {
      ...structuredData,
      scope: {
        ...structuredData.scope,
        lineItems: serviceSnapshots.map((snapshot) => ({
          id: snapshot.id,
          description: snapshot.description,
          jobType: snapshot.jobType,
          itemType: snapshot.itemType,
          quantity: snapshot.quantity,
          rate: snapshot.rate,
          laborHours: snapshot.laborHours,
          otHours: snapshot.otHours,
          manualCost: snapshot.manualCost,
          baseCost: snapshot.baseCost,
          markupAmount: snapshot.markupAmount,
          totalBeforeTax: snapshot.totalBeforeTax,
          taxAmount: snapshot.taxAmount,
          total: snapshot.total,
          isMarkupExempt: snapshot.isMarkupExempt,
          isTaxExempt: snapshot.isTaxExempt,
          taxStatus: snapshot.taxStatus,
          markupType: snapshot.markupType,
          markupRate: snapshot.markupRate
        })),
        subtotal: subtotalBeforeTax,
        taxAmount: totalTax,
        total: finalTotal
      },
      totals: {
        baseCost: baseCostSum,
        grossProfit,
        profitPercent
      }
    };

    return {
      serviceSnapshots,
      structuredData,
      metadataPayload,
      parsedData,
      totals: {
        subtotalBeforeTax,
        totalTax,
        finalTotal,
        baseCost: baseCostSum,
        grossProfit,
        profitPercent
      }
    };
  };

  const addService = () => {
    const newService: Service = {
      id: `new_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
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

  const updateService = (id: string, field: keyof Omit<Service, 'id'>, value: string | number | boolean) => {
    setInvoiceData(prev => ({
      ...prev,
      services: prev.services.map(service => {
        if (service.id === id) {
          let processedValue = value;
          if (field === 'isMarkupExempt' || field === 'isTaxExempt') {
            processedValue = value === true || value === 'true';
          }
          const updated = { ...service, [field]: processedValue };

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

  // Form validation function to check required fields
  const getFormValidation = () => {
    const missingFields = [];

    // Check vessel fields
    if (!invoiceData.vessel.name?.trim()) {
      missingFields.push("Vessel Name");
    }
    if (!invoiceData.vessel.weight?.trim() || parseFloat(invoiceData.vessel.weight) <= 0) {
      missingFields.push("Vessel Weight");
    }

    // Check customer fields
    if (!invoiceData.customer.customerName?.trim()) {
      missingFields.push("Contact Name");
    }

    // Check services - at least one service with description and cost/rate
    const hasValidService = invoiceData.services.some(service => {
      const hasDescription = service.description?.trim();
      const hasCost = service.total > 0 || service.rate > 0 ||
                     (service.manualCost && service.manualCost > 0) ||
                     ((service.laborHours || 0) > 0 || (service.otHours || 0) > 0);
      return hasDescription && hasCost;
    });

    if (!hasValidService) {
      missingFields.push("At least one service");
    }

    return {
      isComplete: missingFields.length === 0,
      missingFields,
      completedCount: 4 - missingFields.length,
      totalRequired: 4
    };
  };

  const formValidation = getFormValidation();

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

      const {
        structuredData,
        metadataPayload,
        parsedData,
        totals
      } = buildInvoiceSubmissionPayload();

      const titleBase = invoiceData.metadata.title?.trim();
      const defaultTitle = invoiceData.vessel.name
        ? `Invoice for ${invoiceData.vessel.name}`
        : 'Invoice Request';

      const payload = {
        title: titleBase || defaultTitle,
        data: JSON.stringify(structuredData),
        metadata: JSON.stringify(metadataPayload),
        notes: invoiceData.notes,
        customerId: invoiceData.customer.id || null,
        vesselId: invoiceData.vessel.id || null,
        customerName: invoiceData.customer.customerName,
        customerEmail: invoiceData.customer.customerEmail,
        customerPhone: invoiceData.customer.customerPhone,
        vesselName: invoiceData.vessel.name,
        vesselWeight: toOptionalNumber(invoiceData.vessel.weight),
        vesselBeam: toOptionalNumber(invoiceData.vessel.beam),
        subtotal: totals.subtotalBeforeTax,
        taxAmount: totals.totalTax,
        total: totals.finalTotal,
        grossProfit: totals.grossProfit,
        profitPercent: totals.profitPercent,
        parsedData
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
        const errorText = await response.text();
        console.error('Invoice save failed:', errorText);
        let errorMessage = `Failed to ${isEditMode ? 'update' : 'save'} invoice`;
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData?.message || errorMessage;
        } catch (parseError) {
          if (errorText?.trim()) {
            errorMessage = `${errorMessage}: ${errorText}`;
          }
        }
        throw new Error(errorMessage);
      }

      const result = await response.json();
      setHasUnsavedChanges(false);

      // Navigate to invoice requests table on success
      navigate('/requests');

    } catch (error: any) {
      console.error('Error saving invoice:', error);
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePreview = () => {
    // Calculate totals for preview
    const calculatedServices = invoiceData.services.map(service => {
      const baseCost = calculateLineItemCost(service);
      const costWithMarkup = applyMarkup(baseCost, service);
      const taxAmount = calculateTax(service, costWithMarkup);
      return {
        ...service,
        cost: baseCost,
        markupAmount: costWithMarkup - baseCost,
        taxAmount,
        total: costWithMarkup + taxAmount
      };
    });

    const subtotal = calculatedServices.reduce((sum, service) => sum + (service.total - service.taxAmount), 0);
    const totalTax = calculatedServices.reduce((sum, service) => sum + service.taxAmount, 0);
    const finalTotal = subtotal + totalTax;
    const baseCost = calculatedServices.reduce((sum, service) => sum + service.cost, 0);
    const grossProfit = subtotal - baseCost;
    const profitPercent = baseCost > 0 ? (grossProfit / baseCost) * 100 : 0;

    // Create preview data structure matching the invoice format
    const previewData = {
      previewMode: true,
      id: 'preview',
      invoiceNumber: `PREVIEW-${Date.now().toString().slice(-6)}`,
      title: invoiceData.metadata.title || `Invoice for ${invoiceData.vessel.name}`,
      status: 'draft',
      total: finalTotal,
      subtotal,
      taxAmount: totalTax,
      grossProfit,
      profitPercent,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      savedAt: new Date().toISOString(),
      userName: invoiceData.customer.estimatorName || 'Current User',
      vesselId: invoiceData.vessel.id || null,
      vesselName: invoiceData.vessel.name,
      vesselWeight: parseFloat(invoiceData.vessel.weight) || 0,
      vesselBeam: parseFloat(invoiceData.vessel.beam) || 0,
      customerName: invoiceData.customer.customerName,
      customerEmail: invoiceData.customer.customerEmail,
      customerPhone: invoiceData.customer.customerPhone,
      notes: invoiceData.notes,
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
          lineItems: calculatedServices,
          subtotal,
          taxAmount: totalTax,
          total: finalTotal
        }
      }
    };

    // Navigate to preview with the calculated data
    navigate('/requests/preview', {
      state: { previewData }
    });
  };

  const handleSaveAndNew = async () => {
    // Check if form is valid before saving
    if (!formValidation.isComplete) {
      setError(`Please complete required fields: ${formValidation.missingFields.join(", ")}`);
      return;
    }

    if (!isAuthenticated || !csrfToken) {
      setError('Please log in to save invoices');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const url = isEditMode ? `/api/v1/invoice/${id}` : '/api/v1/invoice/save';
      const method = isEditMode ? 'PUT' : 'POST';

      const {
        structuredData,
        metadataPayload,
        parsedData,
        totals
      } = buildInvoiceSubmissionPayload();

      const titleBase = invoiceData.metadata.title?.trim();
      const defaultTitle = invoiceData.vessel.name
        ? `Invoice for ${invoiceData.vessel.name}`
        : 'Invoice Request';

      const payload = {
        title: titleBase || defaultTitle,
        data: JSON.stringify(structuredData),
        metadata: JSON.stringify(metadataPayload),
        notes: invoiceData.notes,
        customerId: invoiceData.customer.id || null,
        vesselId: invoiceData.vessel.id || null,
        customerName: invoiceData.customer.customerName,
        customerEmail: invoiceData.customer.customerEmail,
        customerPhone: invoiceData.customer.customerPhone,
        vesselName: invoiceData.vessel.name,
        vesselWeight: toOptionalNumber(invoiceData.vessel.weight),
        vesselBeam: toOptionalNumber(invoiceData.vessel.beam),
        subtotal: totals.subtotalBeforeTax,
        taxAmount: totals.totalTax,
        total: totals.finalTotal,
        grossProfit: totals.grossProfit,
        profitPercent: totals.profitPercent,
        parsedData
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
        const errorText = await response.text();
        console.error('Invoice save & new failed:', errorText);
        let errorMessage = `Failed to ${isEditMode ? 'update' : 'save'} invoice`;
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData?.message || errorMessage;
        } catch (parseError) {
          if (errorText?.trim()) {
            errorMessage = `${errorMessage}: ${errorText}`;
          }
        }
        throw new Error(errorMessage);
      }

      const result = await response.json();

      // Instead of navigating, clear the form for new invoice
      handleNewInvoice();

      // Clear any errors
      setError(null);

    } catch (error: any) {
      console.error('Error saving invoice:', error);
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
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
    // Calculate totals for print preview
    const calculatedServices = invoiceData.services.map(service => {
      const baseCost = calculateLineItemCost(service);
      const costWithMarkup = applyMarkup(baseCost, service);
      const taxAmount = calculateTax(service, costWithMarkup);
      return {
        ...service,
        cost: baseCost,
        markupAmount: costWithMarkup - baseCost,
        taxAmount,
        total: costWithMarkup + taxAmount
      };
    });

    const subtotal = calculatedServices.reduce((sum, service) => sum + (service.total - service.taxAmount), 0);
    const totalTax = calculatedServices.reduce((sum, service) => sum + service.taxAmount, 0);
    const finalTotal = subtotal + totalTax;
    const baseCost = calculatedServices.reduce((sum, service) => sum + service.cost, 0);
    const grossProfit = subtotal - baseCost;
    const profitPercent = baseCost > 0 ? (grossProfit / baseCost) * 100 : 0;

    // Create print data structure
    const printData = {
      previewMode: true,
      id: 'print',
      invoiceNumber: `PRINT-${Date.now().toString().slice(-6)}`,
      title: invoiceData.metadata.title || `Invoice for ${invoiceData.vessel.name}`,
      status: 'draft',
      total: finalTotal,
      subtotal,
      taxAmount: totalTax,
      grossProfit,
      profitPercent,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      savedAt: new Date().toISOString(),
      userName: invoiceData.customer.estimatorName || 'Current User',
      vesselId: invoiceData.vessel.id || null,
      vesselName: invoiceData.vessel.name,
      vesselWeight: parseFloat(invoiceData.vessel.weight) || 0,
      vesselBeam: parseFloat(invoiceData.vessel.beam) || 0,
      customerName: invoiceData.customer.customerName,
      customerEmail: invoiceData.customer.customerEmail,
      customerPhone: invoiceData.customer.customerPhone,
      notes: invoiceData.notes,
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
          lineItems: calculatedServices,
          subtotal,
          taxAmount: totalTax,
          total: finalTotal
        }
      }
    };

    // Navigate to preview with print parameter
    navigate('/requests/preview?print=true', {
      state: { previewData: printData }
    });
  };

  const handleExportPDF = () => {
    // Calculate totals for PDF export
    const calculatedServices = invoiceData.services.map(service => {
      const baseCost = calculateLineItemCost(service);
      const costWithMarkup = applyMarkup(baseCost, service);
      const taxAmount = calculateTax(service, costWithMarkup);
      return {
        ...service,
        cost: baseCost,
        markupAmount: costWithMarkup - baseCost,
        taxAmount,
        total: costWithMarkup + taxAmount
      };
    });

    const subtotal = calculatedServices.reduce((sum, service) => sum + (service.total - service.taxAmount), 0);
    const totalTax = calculatedServices.reduce((sum, service) => sum + service.taxAmount, 0);
    const finalTotal = subtotal + totalTax;
    const baseCost = calculatedServices.reduce((sum, service) => sum + service.cost, 0);
    const grossProfit = subtotal - baseCost;
    const profitPercent = baseCost > 0 ? (grossProfit / baseCost) * 100 : 0;

    // Create PDF
    const pdf = new jsPDF();

    // Set font
    pdf.setFont('helvetica');

    // Header
    pdf.setFontSize(20);
    pdf.setTextColor(0, 0, 0);
    pdf.text('Marine Group', 20, 30);

    pdf.setFontSize(16);
    pdf.text('Invoice Request Form', 20, 45);

    pdf.setFontSize(12);
    pdf.text(`Date: ${new Date().toLocaleDateString()}`, 20, 60);
    pdf.text(`Invoice #: INV-${Date.now().toString().slice(-6)}`, 20, 70);

    // Vessel Information
    pdf.setFontSize(14);
    pdf.setTextColor(0, 0, 0);
    pdf.text('Vessel Details', 20, 90);

    pdf.setFontSize(11);
    pdf.text(`Vessel: ${invoiceData.vessel.name || 'N/A'}`, 20, 105);
    pdf.text(`Weight: ${invoiceData.vessel.weight || 'N/A'} tons`, 20, 115);
    pdf.text(`Length: ${invoiceData.vessel.beam || 'N/A'} ft`, 20, 125);

    // Contact Information
    pdf.setFontSize(14);
    pdf.text('Contact Information', 20, 145);

    pdf.setFontSize(11);
    pdf.text(`Contact: ${invoiceData.customer.customerName || 'N/A'}`, 20, 160);
    pdf.text(`Email: ${invoiceData.customer.customerEmail || 'N/A'}`, 20, 170);
    pdf.text(`Phone: ${invoiceData.customer.customerPhone || 'N/A'}`, 20, 180);

    // Services Table
    let yPos = 200;
    pdf.setFontSize(14);
    pdf.text('Services', 20, yPos);
    yPos += 15;

    // Table headers
    pdf.setFontSize(10);
    pdf.setTextColor(100, 100, 100);
    pdf.text('Description', 20, yPos);
    pdf.text('Type', 80, yPos);
    pdf.text('Cost', 120, yPos);
    pdf.text('Markup', 140, yPos);
    pdf.text('Tax', 160, yPos);
    pdf.text('Total', 175, yPos);

    // Draw header line
    pdf.setDrawColor(200, 200, 200);
    pdf.line(20, yPos + 2, 190, yPos + 2);
    yPos += 10;

    // Service rows
    pdf.setTextColor(0, 0, 0);
    calculatedServices.forEach((service, index) => {
      const description = (service.description || '').substring(0, 25);
      const type = (service.jobType || service.itemType || '').substring(0, 15);

      pdf.text(description, 20, yPos);
      pdf.text(type, 80, yPos);
      pdf.text(`$${service.cost.toFixed(2)}`, 120, yPos);
      pdf.text(`$${service.markupAmount.toFixed(2)}`, 140, yPos);
      pdf.text(`$${service.taxAmount.toFixed(2)}`, 160, yPos);
      pdf.text(`$${service.total.toFixed(2)}`, 175, yPos);

      yPos += 10;

      // Check if we need a new page
      if (yPos > 270) {
        pdf.addPage();
        yPos = 30;
      }
    });

    // Totals section
    yPos += 10;
    pdf.setDrawColor(200, 200, 200);
    pdf.line(120, yPos, 190, yPos);
    yPos += 10;

    pdf.setFontSize(11);
    pdf.text(`Subtotal: $${subtotal.toFixed(2)}`, 140, yPos);
    yPos += 10;
    pdf.text(`Tax: $${totalTax.toFixed(2)}`, 140, yPos);
    yPos += 10;
    pdf.setFont('helvetica', 'bold');
    pdf.text(`Total: $${finalTotal.toFixed(2)}`, 140, yPos);
    yPos += 15;
    pdf.setFont('helvetica', 'normal');
    pdf.text(`Gross Profit: $${grossProfit.toFixed(2)}`, 140, yPos);
    yPos += 10;
    pdf.text(`Profit %: ${profitPercent.toFixed(2)}%`, 140, yPos);

    // Notes section
    if (invoiceData.notes && invoiceData.notes.trim()) {
      yPos += 20;
      pdf.setFontSize(12);
      pdf.text('Notes:', 20, yPos);
      yPos += 10;
      pdf.setFontSize(10);

      // Split notes into lines
      const noteLines = pdf.splitTextToSize(invoiceData.notes, 170);
      noteLines.forEach((line: string) => {
        pdf.text(line, 20, yPos);
        yPos += 6;
      });
    }

    // Save the PDF
    const fileName = `Invoice_${invoiceData.vessel.name || 'Unknown'}_${new Date().toISOString().split('T')[0]}.pdf`;
    pdf.save(fileName);
  };

  const handleEmail = () => {
    // Set default email recipient to customer's email
    setEmailRecipient(invoiceData.customer.customerEmail || '');
    setEmailMessage('');
    setShowEmailDialog(true);
  };

  const handleSendEmail = async () => {
    if (!emailRecipient.trim()) {
      alert('Please enter an email recipient');
      return;
    }

    setIsEmailSending(true);

    try {
      // Calculate totals for email
      const calculatedServices = invoiceData.services.map(service => {
        const baseCost = calculateLineItemCost(service);
        const costWithMarkup = applyMarkup(baseCost, service);
        const taxAmount = calculateTax(service, costWithMarkup);
        return {
          ...service,
          cost: baseCost,
          markupAmount: costWithMarkup - baseCost,
          taxAmount,
          total: costWithMarkup + taxAmount
        };
      });

      const subtotal = calculatedServices.reduce((sum, service) => sum + (service.total - service.taxAmount), 0);
      const totalTax = calculatedServices.reduce((sum, service) => sum + service.taxAmount, 0);
      const finalTotal = subtotal + totalTax;

      // Prepare email data
      const emailData = {
        invoiceData: {
          ...invoiceData,
          services: calculatedServices,
          total: finalTotal,
          subtotal,
          taxAmount: totalTax
        },
        emailTo: emailRecipient,
        emailMessage: emailMessage
      };

      const response = await fetch('/api/v1/invoice/email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken!
        },
        credentials: 'include',
        body: JSON.stringify(emailData)
      });

      if (!response.ok) {
        throw new Error('Failed to send email');
      }

      const result = await response.json();
      alert('Invoice email sent successfully!');
      setShowEmailDialog(false);

    } catch (error) {
      console.error('Error sending email:', error);
      alert('Failed to send email. Please try again.');
    } finally {
      setIsEmailSending(false);
    }
  };

  const handleExportCSV = () => {
    // Calculate totals for CSV export
    const calculatedServices = invoiceData.services.map(service => {
      const baseCost = calculateLineItemCost(service);
      const costWithMarkup = applyMarkup(baseCost, service);
      const taxAmount = calculateTax(service, costWithMarkup);
      return {
        ...service,
        cost: baseCost,
        markupAmount: costWithMarkup - baseCost,
        taxAmount,
        total: costWithMarkup + taxAmount
      };
    });

    // Create CSV content
    const csvHeaders = [
      'Description',
      'Type',
      'Labor Hours',
      'OT Hours',
      'Base Cost',
      'Markup',
      'Tax',
      'Total'
    ];

    const csvRows = calculatedServices.map(service => [
      `"${service.description || ''}"`, 
      `"${service.jobType || service.itemType || ''}"`, 
      service.laborHours || 0,
      service.otHours || 0,
      service.cost.toFixed(2),
      service.markupAmount.toFixed(2),
      service.taxAmount.toFixed(2),
      service.total.toFixed(2)
    ]);

    // Add summary rows
    const subtotal = calculatedServices.reduce((sum, service) => sum + (service.total - service.taxAmount), 0);
    const totalTax = calculatedServices.reduce((sum, service) => sum + service.taxAmount, 0);
    const finalTotal = subtotal + totalTax;
    const baseCost = calculatedServices.reduce((sum, service) => sum + service.cost, 0);
    const grossProfit = subtotal - baseCost;

    csvRows.push(
      ['', '', '', '', '', '', '', ''],
      ['', '', '', '', 'SUBTOTAL', '', '', subtotal.toFixed(2)],
      ['', '', '', '', 'TOTAL TAX', '', '', totalTax.toFixed(2)],
      ['', '', '', '', 'FINAL TOTAL', '', '', finalTotal.toFixed(2)],
      ['', '', '', '', 'GROSS PROFIT', '', '', grossProfit.toFixed(2)]
    );

    // Create CSV content
    const csvContent = [
      // Invoice header info
      `"Invoice for ${invoiceData.vessel.name}"`, 
      `"Contact: ${invoiceData.customer.customerName}"`, 
      `"Date: ${new Date().toLocaleDateString()}"`, 
      '',
      csvHeaders.join(','),
      ...csvRows.map(row => row.join(','))
    ].join('\n');

    // Create and download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);

    const fileName = `Invoice_${invoiceData.vessel.name || 'Unknown'}_${new Date().toISOString().split('T')[0]}.csv`;
    link.setAttribute('download', fileName);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
          <Button onClick={() => navigate('/requests')}> 
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
            <Badge
              variant="outline"
              className={`text-xs ${ 
                formValidation.isComplete
                  ? "bg-green-50 text-green-700 border-green-200 hover:bg-green-100"
                  : "bg-yellow-50 text-yellow-700 border-yellow-200 hover:bg-yellow-100"
              }`}
            >
              {formValidation.isComplete ? (
                <span className="flex items-center gap-1">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  Invoice information is complete
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  Missing: {formValidation.missingFields.slice(0, 2).join(", ")}
                  {formValidation.missingFields.length > 2 &&
                    ` +${formValidation.missingFields.length - 2} more`}
                </span>
              )}
            </Badge>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleSaveAndNew}
              disabled={isLoading || !formValidation.isComplete}
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
              </svg>
              Save & New
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
                label="Contact"
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
                  {/* Link to Existing Vessel */}
                  <div className="space-y-2">
                    <Label htmlFor="vessel-link">Link to Existing Vessel</Label>
                    <Select
                      value={selectedVesselId}
                      onValueChange={(value) => {
                        setSelectedVesselId(value);
                        if (value && value !== '') {
                          const selectedVessel = availableVessels.find(v => v.id === value);
                          if (selectedVessel) {
                            setInvoiceData(prev => ({
                              ...prev,
                              vessel: {
                                ...prev.vessel,
                                id: selectedVessel.id,
                                name: selectedVessel.name,
                                weight: selectedVessel.weight_tons?.toString() || '',
                                beam: selectedVessel.length_ft?.toString() || ''
                              }
                            }));
                          }
                        }
                      }}
                    >
                      <SelectTrigger>
                        {selectedVesselId ? (
                          <div className="flex items-center">
                            <span>{availableVessels.find(v => v.id === selectedVesselId)?.name}</span>
                            <svg className="w-4 h-4 ml-2 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                        ) : (
                          <SelectValue placeholder="Search for a vessel..." />
                        )}
                      </SelectTrigger>
                      <SelectContent>
                        <div className="p-2">
                          <Input
                            placeholder="Type to search vessels..."
                            value={vesselSearchQuery}
                            onChange={(e) => {
                              setVesselSearchQuery(e.target.value);
                              searchVessels(e.target.value);
                            }}
                          />
                        </div>
                        {isLoadingVessels ? (
                          <div className="p-2 text-center">Loading...</div>
                        ) : (
                          availableVessels.map(vessel => (
                            <SelectItem key={vessel.id} value={vessel.id}>
                              {vessel.name}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="vessel-name">Vessel Name</Label>
                      <Input
                        id="vessel-name"
                        value={invoiceData.vessel.name}
                        onChange={(e) => handleVesselChange('name', e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="vessel-weight">Vessel Weight (tons)</Label>
                      <Input
                        id="vessel-weight"
                        value={isWeightFocused ? stripSuffix(invoiceData.vessel.weight, ' tons') : formatWithSuffix(invoiceData.vessel.weight, ' tons')}
                        onFocus={() => setIsWeightFocused(true)}
                        onBlur={() => setIsWeightFocused(false)}
                        onChange={(e) => handleVesselChange('weight', e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="vessel-beam">Vessel Length (ft)</Label>
                      <Input
                        id="vessel-beam"
                        value={isBeamFocused ? stripSuffix(invoiceData.vessel.beam, ' ft') : formatWithSuffix(invoiceData.vessel.beam, ' ft')}
                        onFocus={() => setIsBeamFocused(true)}
                        onBlur={() => setIsBeamFocused(false)}
                        onChange={(e) => handleVesselChange('beam', e.target.value)}
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
                  <CardTitle>Contact Information</CardTitle>
                  <CardDescription>
                    Enter contact details for this invoice
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Link to Existing Customer */}
                  <div className="space-y-2">
                    <Label htmlFor="customer-link">Link to an existing contact</Label>
                    <Select
                      value={selectedCustomerId}
                      onValueChange={(value) => {
                        setSelectedCustomerId(value);
                        if (value) {
                          const selectedCustomer = availableCustomers.find(c => c.id === value);
                          if (selectedCustomer) {
                            console.log('Selected Customer:', selectedCustomer);
                            setInvoiceData(prev => ({
                              ...prev,
                              customer: {
                                ...prev.customer,
                                id: selectedCustomer.id,
                                contactName: selectedCustomer.display_name,
                                customerName: selectedCustomer.legal_name || selectedCustomer.display_name,
                                customerEmail: selectedCustomer.email || '',
                                customerPhone: selectedCustomer.phone || '',
                                customerAddress: formatAddress(selectedCustomer)
                              }
                            }));
                          }
                        }
                      }}
                    >
                      <SelectTrigger>
                        {selectedCustomerId ? (
                          <div className="flex items-center">
                            <span>{availableCustomers.find(c => c.id === selectedCustomerId)?.display_name}</span>
                            <svg className="w-4 h-4 ml-2 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                        ) : (
                          <SelectValue placeholder="Search for a contact..." />
                        )}
                      </SelectTrigger>
                      <SelectContent>
                        <div className="p-2">
                          <Input
                            placeholder="Type to search contacts..."
                            value={customerSearchQuery}
                            onChange={(e) => {
                              setCustomerSearchQuery(e.target.value);
                              searchCustomers(e.target.value);
                            }}
                          />
                        </div>
                        {isLoadingCustomers ? (
                          <div className="p-2 text-center">Loading...</div>
                        ) : (
                          availableCustomers.map(customer => (
                            <SelectItem key={customer.id} value={customer.id}>
                              {customer.display_name}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="contact-name">Contact Name</Label>
                      <Input
                        id="contact-name"
                        value={invoiceData.customer.contactName}
                        onChange={(e) => handleCustomerChange('contactName', e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="customer-email">Email Address</Label>
                      <Input
                        id="customer-email"
                        type="email"
                        value={invoiceData.customer.customerEmail}
                        onChange={(e) => handleCustomerChange('customerEmail', e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="customer-phone">Phone Number</Label>
                      <Input
                        id="customer-phone"
                        value={invoiceData.customer.customerPhone}
                        onChange={(e) => handleCustomerChange('customerPhone', e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="customer-address">Address</Label>
                      <div className="relative">
                        <Input
                          id="customer-address"
                          value={invoiceData.customer.customerAddress}
                          onChange={(e) => {
                            handleCustomerChange('customerAddress', e.target.value);
                            if (addressTimeoutRef.current) {
                              clearTimeout(addressTimeoutRef.current);
                            }
                            addressTimeoutRef.current = setTimeout(() => {
                              searchAddresses(e.target.value);
                            }, 300);
                          }}
                          onFocus={() => setShowAddressSuggestions(true)}
                          onBlur={() => setTimeout(() => setShowAddressSuggestions(false), 150)}
                        />
                        {showAddressSuggestions && addressSuggestions.length > 0 && (
                          <div className="absolute z-10 w-full bg-background border border-input rounded-md shadow-lg mt-1">
                            {addressSuggestions.map((suggestion, index) => (
                              <div
                                key={index}
                                className="px-3 py-2 text-sm cursor-pointer hover:bg-muted"
                                onMouseDown={() => {
                                  handleCustomerChange('customerAddress', suggestion.formatted);
                                  setAddressSuggestions([]);
                                  setShowAddressSuggestions(false);
                                }}
                              >
                                {suggestion.formatted}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Services Tab */}
            {activeTab === 'services' && (
              <Card>
                <CardHeader>
                  <CardTitle>Services</CardTitle>
                  <CardDescription>
                    Add services or line items for this invoice
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {invoiceData.services.map((service, index) => (
                      <div key={service.id} className="p-4 border rounded-lg relative">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="space-y-2 md:col-span-2">
                            <Label htmlFor={`service-desc-${index}`}>Description</Label>
                            <Textarea
                              id={`service-desc-${index}`}
                              value={service.description}
                              onChange={(e) => updateService(service.id, 'description', e.target.value)}
                              rows={2}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor={`service-total-${index}`}>Total</Label>
                            <Input
                              id={`service-total-${index}`}
                              type="number"
                              value={service.total}
                              onChange={(e) => updateService(service.id, 'total', parseFloat(e.target.value) || 0)}
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                          <div className="space-y-2">
                            <Label htmlFor={`service-job-type-${index}`}>Job Type</Label>
                            <Select
                              value={service.jobType || ''}
                              onValueChange={(value) => updateService(service.id, 'jobType', value)}
                            >
                              <SelectTrigger> <SelectValue placeholder="Select..." /> </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Agent Services">Agent Services</SelectItem>
                                <SelectItem value="Clearance Fee">Clearance Fee</SelectItem>
                                <SelectItem value="Manual Entry">Manual Entry</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          {service.jobType === 'Manual Entry' && (
                            <div className="space-y-2">
                              <Label htmlFor={`service-item-type-${index}`}>Item Type</Label>
                              <Select
                                value={service.itemType || ''}
                                onValueChange={(value) => updateService(service.id, 'itemType', value)}
                              >
                                <SelectTrigger> <SelectValue placeholder="Select..." /> </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="Labor">Labor</SelectItem>
                                  <SelectItem value="Material">Material</SelectItem>
                                  <SelectItem value="Subcontractor">Subcontractor</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          )}

                          {(service.itemType === 'Labor' || service.jobType === 'Agent Services') && (
                            <>
                              <div className="space-y-2">
                                <Label htmlFor={`service-labor-hours-${index}`}>Labor Hours</Label>
                                <Input
                                  id={`service-labor-hours-${index}`}
                                  type="number"
                                  value={service.laborHours || ''}
                                  onChange={(e) => updateService(service.id, 'laborHours', parseFloat(e.target.value) || 0)}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor={`service-ot-hours-${index}`}>OT Hours</Label>
                                <Input
                                  id={`service-ot-hours-${index}`}
                                  type="number"
                                  value={service.otHours || ''}
                                  onChange={(e) => updateService(service.id, 'otHours', parseFloat(e.target.value) || 0)}
                                />
                              </div>
                            </>
                          )}

                          {service.jobType === 'Manual Entry' && service.itemType !== 'Labor' && (
                            <div className="space-y-2">
                              <Label htmlFor={`service-manual-cost-${index}`}>Manual Cost</Label>
                              <Input
                                id={`service-manual-cost-${index}`}
                                type="number"
                                value={service.manualCost || ''}
                                onChange={(e) => updateService(service.id, 'manualCost', parseFloat(e.target.value) || 0)}
                              />
                            </div>
                          )}
                        </div>

                        <div className="flex items-center justify-end mt-4">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeService(service.id)}
                          >
                            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                            Remove
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-6">
                    <Button onClick={addService} variant="outline">
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                      Add Service
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Notes Tab */}
            {activeTab === 'notes' && (
              <Card>
                <CardHeader>
                  <CardTitle>Notes</CardTitle>
                  <CardDescription>
                    Add any additional notes for this invoice
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Textarea
                    value={invoiceData.notes}
                    onChange={(e) => handleNotesChange(e.target.value)}
                    rows={6}
                  />
                </CardContent>
              </Card>
            )}
          </div>

          {/* Summary Sidebar */}
          <div className="lg:col-span-1 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>${subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Tax</span>
                  <span>${taxAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-semibold text-lg">
                  <span>Total</span>
                  <span>${total.toFixed(2)}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Actions</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-2">
                <Button onClick={handlePrint} variant="outline">Print</Button>
                <Button onClick={handleExportPDF} variant="outline">Export PDF</Button>
                <Button onClick={handleEmail} variant="outline">Email</Button>
                <Button onClick={handleExportCSV} variant="outline">Export CSV</Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {showEmailDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background rounded-lg shadow-lg p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold mb-4">Send Invoice Email</h2>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email-recipient">Recipient</Label>
                <Input
                  id="email-recipient"
                  type="email"
                  value={emailRecipient}
                  onChange={(e) => setEmailRecipient(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email-message">Message</Label>
                <Textarea
                  id="email-message"
                  value={emailMessage}
                  onChange={(e) => setEmailMessage(e.target.value)}
                  rows={4}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <Button variant="outline" onClick={() => setShowEmailDialog(false)}>Cancel</Button>
              <Button onClick={handleSendEmail} disabled={isEmailSending}>
                {isEmailSending ? 'Sending...' : 'Send Email'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CreateInvoice;
