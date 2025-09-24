import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Save, Plus, User, ArrowLeft } from 'lucide-react';
import { createApiUrl, API_ENDPOINTS } from '../config/api';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import AddressAutocomplete from '../components/AddressAutocomplete';
import { PhoneField } from '../components/phone/PhoneField';
import { isValidPhoneNumber, parsePhoneNumber } from 'libphonenumber-js';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';

interface Customer {
  id?: string | null;
  customerEmail: string;
  customerPhone: string;
  customerAddress: string;
  contactName: string;
}

const CreateCustomer: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { isAuthenticated, csrfToken } = useAuth();
  const isEditMode = Boolean(id);
  const [customerData, setCustomerData] = useState<Customer>({
    customerEmail: '',
    customerPhone: '',
    customerAddress: '',
    contactName: '',
    id: null
  });
  const [emailError, setEmailError] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(isEditMode);
  const [submitError, setSubmitError] = useState('');


  const handleInputChange = (field: keyof Customer, value: string) => {
    setCustomerData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Helper function to normalize phone numbers from database
  const normalizePhoneNumber = (phone: string | null | undefined): string => {
    if (!phone) return '';

    // If it's already in E.164 format, return as-is
    if (phone.startsWith('+')) {
      return phone;
    }

    // Try to parse US formatted numbers like "(555) 123-4567"
    try {
      const parsed = parsePhoneNumber(phone, 'US');
      return parsed ? parsed.format('E.164') : phone;
    } catch {
      // If parsing fails, return the original phone number
      return phone;
    }
  };


  // Email validation
  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleEmailChange = (value: string) => {
    handleInputChange('customerEmail', value);

    if (value && !validateEmail(value)) {
      setEmailError('Please enter a valid email address');
    } else {
      setEmailError('');
    }
  };

  // Phone validation with international support
  const handlePhoneChange = (value: string | undefined) => {
    handleInputChange('customerPhone', value || '');

    if (value && !isValidPhoneNumber(value)) {
      setPhoneError('Please enter a valid phone number');
    } else {
      setPhoneError('');
    }
  };

  const parseAddress = (address: string) => {
    // Simple address parsing - splits by commas
    const parts = address.split(',').map(part => part.trim());

    if (parts.length >= 3) {
      // Format: "Street, City, State ZIP" or "Street, City, State, ZIP"
      const street = parts[0];
      const city = parts[1];
      const stateZip = parts[2];

      // Extract state and ZIP from last part
      const stateZipMatch = stateZip.match(/^(.+?)\s+(\d{5}(-\d{4})?)$/);

      if (stateZipMatch) {
        return {
          address_line1: street,
          city: city,
          state: stateZipMatch[1],
          postal_code: stateZipMatch[2],
        };
      } else {
        return {
          address_line1: street,
          city: city,
          state: stateZip,
          postal_code: '',
        };
      }
    } else if (parts.length === 2) {
      return {
        address_line1: parts[0],
        city: parts[1],
        state: '',
        postal_code: '',
      };
    } else {
      return {
        address_line1: address,
        city: '',
        state: '',
        postal_code: '',
      };
    }
  };

  // Load customer data for editing
  useEffect(() => {
    const loadCustomerData = async () => {
      if (!isEditMode || !id || !isAuthenticated || !csrfToken) {
        console.log('Edit mode check:', { isEditMode, id, isAuthenticated, csrfToken: !!csrfToken });
        return;
      }

      try {
        setIsLoadingData(true);
        console.log('Loading customer data for ID:', id);

        const response = await fetch(`/api/v1/customers/${id}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': csrfToken
          },
          credentials: 'include',
        });

        console.log('Response status:', response.status);
        console.log('Response headers:', response.headers);

        if (response.ok) {
          const data = await response.json();
          const customer = data.customer;
          console.log('Customer data received:', customer);

          setCustomerData({
            contactName: customer.display_name || '',
            customerEmail: customer.email || '',
            customerPhone: normalizePhoneNumber(customer.phone),
            customerAddress: customer.address_line1 ?
              [customer.address_line1, customer.city, customer.state].filter(Boolean).join(', ') : '',
            id: customer.id
          });
        } else {
          const errorText = await response.text();
          console.error('Failed to load customer data:', response.status, errorText);
          setSubmitError(`Failed to load customer data: ${response.status} ${response.statusText}`);
        }
      } catch (error) {
        console.error('Error loading customer data:', error);
        setSubmitError('Network error: Unable to load customer data. Please check your connection and try again.');
      } finally {
        setIsLoadingData(false);
      }
    };

    loadCustomerData();
  }, [id, isEditMode, isAuthenticated, csrfToken]);

  const handleSave = async () => {
    if (!isAuthenticated || !csrfToken) {
      setSubmitError('Please log in to save contacts');
      return;
    }

    setIsLoading(true);
    setSubmitError('');

    try {
      // Parse address
      const addressParts = customerData.customerAddress ? parseAddress(customerData.customerAddress) : {
        address_line1: '',
        city: '',
        state: '',
        postal_code: ''
      };

      // Map frontend fields to backend schema
      const customerPayload = {
        display_name: customerData.contactName,
        legal_name: customerData.contactName || null,
        email: customerData.customerEmail || null,
        phone: customerData.customerPhone || null,
        ...addressParts,
        country: 'US'
      };

      // Add ID for create mode only
      if (!isEditMode) {
        customerPayload.id = `cust_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      }

      const url = isEditMode
        ? `/api/v1/customers/${id}`
        : createApiUrl(API_ENDPOINTS.CUSTOMERS);

      const response = await fetch(url, {
        method: isEditMode ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken
        },
        credentials: 'include',
        body: JSON.stringify(customerPayload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        if (response.status === 409) {
          setSubmitError('A contact with this name already exists.');
        } else if (errorData.errors) {
          setSubmitError(errorData.errors.map((err: any) => err.message).join(', '));
        } else {
          setSubmitError(errorData.message || `Failed to ${isEditMode ? 'update' : 'create'} contact`);
        }
        return;
      }

      // Success - navigate back to contacts list
      navigate('/clients');
    } catch (error) {
      console.error('Error saving customer:', error);
      setSubmitError('Network error. Please check your connection and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveAndNew = async () => {
    if (!isAuthenticated || !csrfToken) {
      setSubmitError('Please log in to save contacts');
      return;
    }

    setIsLoading(true);
    setSubmitError('');

    try {
      // Generate unique ID
      const customerId = `cust_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Parse address
      const addressParts = customerData.customerAddress ? parseAddress(customerData.customerAddress) : {
        address_line1: '',
        city: '',
        state: '',
        postal_code: ''
      };

      // Map frontend fields to backend schema
      const customerPayload = {
        id: customerId,
        display_name: customerData.contactName,
        legal_name: customerData.contactName || null,
        email: customerData.customerEmail || null,
        phone: customerData.customerPhone || null,
        ...addressParts,
        country: 'US'
      };

      const response = await fetch(createApiUrl(API_ENDPOINTS.CUSTOMERS), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken
        },
        credentials: 'include',
        body: JSON.stringify(customerPayload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        if (response.status === 409) {
          setSubmitError('A contact with this name already exists.');
        } else if (errorData.errors) {
          setSubmitError(errorData.errors.map((err: any) => err.message).join(', '));
        } else {
          setSubmitError(errorData.message || 'Failed to create contact');
        }
        return;
      }

      // Success - reset form for new contact
      setCustomerData({
        customerEmail: '',
        customerPhone: '',
        customerAddress: '',
        contactName: '',
        id: null
      });
      setEmailError('');
      setPhoneError('');
      setSubmitError('');
    } catch (error) {
      console.error('Error saving customer:', error);
      setSubmitError('Network error. Please check your connection and try again.');
    } finally {
      setIsLoading(false);
    }
  };


  const handleNew = () => {
    setCustomerData({
      customerEmail: '',
      customerPhone: '',
      customerAddress: '',
      contactName: '',
      id: null
    });
    setEmailError('');
    setPhoneError('');
  };

  const isFormValid = customerData.contactName && customerData.customerEmail && !emailError && !phoneError;

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/clients')}
              className="flex items-center"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Contacts
            </Button>
          </div>
          <div className="flex-1 flex justify-center">
            <h1 className="text-2xl font-bold text-gray-900">
              {isEditMode ? 'Edit Contact' : 'Create New Contact'}
            </h1>
          </div>
          <div className="flex items-center space-x-3">
            <Button onClick={handleSave} disabled={!isFormValid || isLoading || isLoadingData}>
              <Save className="h-4 w-4 mr-2" />
              {isLoading ? (isEditMode ? 'Updating...' : 'Saving...') : (isEditMode ? 'Update Contact' : 'Save Contact')}
            </Button>
            {!isEditMode && (
              <Button onClick={handleSaveAndNew} disabled={!isFormValid || isLoading}>
                <Save className="h-4 w-4 mr-2" />
                Save & New
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch">
        {/* Customer Form */}
        <div className="lg:col-span-2">
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="flex items-center">
                <User className="h-5 w-5 mr-2" />
                Contact Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Loading Message */}
              {isLoadingData && (
                <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded-md">
                  <div className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-blue-700" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Loading customer data...
                  </div>
                </div>
              )}
              {/* Error Message */}
              {submitError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
                  <div className="flex">
                    <svg className="w-5 h-5 mr-2 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                    <span>{submitError}</span>
                  </div>
                </div>
              )}

              {/* Customer Details Form */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                {/* Customer Name */}
                <div className="space-y-2">
                  <Label htmlFor="contact-name">Contact Name *</Label>
                  <Input
                    id="contact-name"
                    type="text"
                    placeholder="Primary contact person"
                    value={customerData.contactName}
                    onChange={(e) => handleInputChange('contactName', e.target.value)}
                    disabled={isLoading || isLoadingData}
                    required
                  />
                </div>


                {/* Customer Email */}
                <div className="space-y-2">
                  <Label htmlFor="customer-email">Email Address *</Label>
                  <Input
                    id="customer-email"
                    type="email"
                    placeholder="contact@example.com"
                    value={customerData.customerEmail}
                    onChange={(e) => handleEmailChange(e.target.value)}
                    disabled={isLoading || isLoadingData}
                    className={emailError ? 'border-red-500' : ''}
                    required
                  />
                  {emailError && (
                    <p className="text-xs text-red-600">{emailError}</p>
                  )}
                </div>

                {/* Customer Phone */}
                <PhoneField
                  name="customer-phone"
                  label="Phone Number"
                  value={customerData.customerPhone}
                  onChange={handlePhoneChange}
                  placeholder="Enter phone number"
                  disabled={isLoading || isLoadingData}
                  error={phoneError}
                  defaultCountry="US"
                />

                {/* Customer Address */}
                <div className="space-y-2">
                  <Label htmlFor="customer-address">Address</Label>
                  <AddressAutocomplete
                    value={customerData.customerAddress}
                    onChange={(value) => handleInputChange('customerAddress', value)}
                    placeholder="Enter contact address"
                    disabled={isLoading || isLoadingData}
                    className=""
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Form Status */}
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="text-lg">Form Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {!customerData.contactName && (
                <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
                  <svg className="w-4 h-4 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Customer name is required to proceed
                </div>
              )}

              {!customerData.customerEmail && (
                <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
                  <svg className="w-4 h-4 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Email address is required for sending invoices
                </div>
              )}

              {isFormValid && (
                <div className="text-sm text-green-600 bg-green-50 p-3 rounded-lg border border-green-200">
                  <svg className="w-4 h-4 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                  Contact information is complete
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default CreateCustomer;