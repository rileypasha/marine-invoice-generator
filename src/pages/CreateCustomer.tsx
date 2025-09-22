import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Save, Plus, User, ArrowLeft } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import AddressAutocomplete from '../components/AddressAutocomplete';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';

interface Customer {
  id?: string | null;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  customerAddress: string;
  contactName: string;
}

const CreateCustomer: React.FC = () => {
  const navigate = useNavigate();
  const [customerData, setCustomerData] = useState<Customer>({
    customerName: '',
    customerEmail: '',
    customerPhone: '',
    customerAddress: '',
    contactName: '',
    id: null
  });
  const [emailError, setEmailError] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [isLoading, setIsLoading] = useState(false);


  const handleInputChange = (field: keyof Customer, value: string) => {
    setCustomerData(prev => ({
      ...prev,
      [field]: value
    }));
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

  // Phone formatting
  const formatPhoneNumber = (phoneStr: string): string => {
    const cleaned = phoneStr.replace(/\D/g, '');
    const limited = cleaned.slice(0, 10);

    if (limited.length === 10) {
      return limited.replace(/(\d{3})(\d{3})(\d{4})/, '($1) $2-$3');
    } else if (limited.length === 7) {
      return limited.replace(/(\d{3})(\d{4})/, '$1-$2');
    } else if (limited.length > 3) {
      return limited.replace(/(\d{3})(\d+)/, '($1) $2');
    }
    return limited;
  };

  const handlePhoneChange = (value: string) => {
    const formatted = formatPhoneNumber(value);
    handleInputChange('customerPhone', formatted);

    const cleaned = value.replace(/\D/g, '');
    if (cleaned.length > 0 && cleaned.length < 10) {
      setPhoneError('Phone number must be 10 digits');
    } else {
      setPhoneError('');
    }
  };

  const handleSave = async () => {
    setIsLoading(true);
    try {
      // In a real app, this would save to your API
      console.log('Saving customer:', customerData);
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      navigate('/customers');
    } catch (error) {
      console.error('Error saving customer:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveAndNew = async () => {
    setIsLoading(true);
    try {
      // In a real app, this would save to your API
      console.log('Saving customer:', customerData);
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      // Reset form for new customer
      setCustomerData({
        customerName: '',
        customerEmail: '',
        customerPhone: '',
        customerAddress: '',
        contactName: '',
        id: null
      });
      setEmailError('');
      setPhoneError('');
    } catch (error) {
      console.error('Error saving customer:', error);
    } finally {
      setIsLoading(false);
    }
  };


  const handleNew = () => {
    setCustomerData({
      customerName: '',
      customerEmail: '',
      customerPhone: '',
      customerAddress: '',
      contactName: '',
      id: null
    });
    setEmailError('');
    setPhoneError('');
  };

  const isFormValid = customerData.customerName && customerData.customerEmail && !emailError && !phoneError;

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/customers')}
              className="flex items-center"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Customers
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Create New Customer</h1>
              <p className="text-gray-600">Add a new customer to your database</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <Button variant="outline" onClick={handleNew}>
              <Plus className="h-4 w-4 mr-2" />
              New
            </Button>
            <Button onClick={handleSave} disabled={!isFormValid || isLoading}>
              <Save className="h-4 w-4 mr-2" />
              {isLoading ? 'Saving...' : 'Save Customer'}
            </Button>
            <Button onClick={handleSaveAndNew} disabled={!isFormValid || isLoading}>
              <Save className="h-4 w-4 mr-2" />
              Save & New
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Customer Form */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <User className="h-5 w-5 mr-2" />
                Customer Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">

              {/* Customer Details Form */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                {/* Customer Name */}
                <div className="space-y-2">
                  <Label htmlFor="contact-name">Customer Name</Label>
                  <Input
                    id="contact-name"
                    type="text"
                    placeholder="Primary contact person"
                    value={customerData.contactName}
                    onChange={(e) => handleInputChange('contactName', e.target.value)}
                    disabled={isLoading}
                  />
                </div>

                {/* Company Name */}
                <div className="md:col-span-2 space-y-2">
                  <Label htmlFor="customer-name">Company Name *</Label>
                  <Input
                    id="customer-name"
                    type="text"
                    placeholder="Enter customer or company name"
                    value={customerData.customerName}
                    onChange={(e) => handleInputChange('customerName', e.target.value)}
                    disabled={isLoading}
                    required
                  />
                </div>

                {/* Customer Email */}
                <div className="space-y-2">
                  <Label htmlFor="customer-email">Email Address *</Label>
                  <Input
                    id="customer-email"
                    type="email"
                    placeholder="customer@example.com"
                    value={customerData.customerEmail}
                    onChange={(e) => handleEmailChange(e.target.value)}
                    disabled={isLoading}
                    className={emailError ? 'border-red-500' : ''}
                    required
                  />
                  {emailError && (
                    <p className="text-xs text-red-600">{emailError}</p>
                  )}
                </div>

                {/* Customer Phone */}
                <div className="space-y-2">
                  <Label htmlFor="customer-phone">Phone Number</Label>
                  <Input
                    id="customer-phone"
                    type="tel"
                    placeholder="(555) 123-4567"
                    value={customerData.customerPhone}
                    onChange={(e) => handlePhoneChange(e.target.value)}
                    disabled={isLoading}
                    className={phoneError ? 'border-red-500' : ''}
                  />
                  {phoneError && (
                    <p className="text-xs text-red-600">{phoneError}</p>
                  )}
                </div>

                {/* Customer Address */}
                <div className="md:col-span-2 space-y-2">
                  <Label htmlFor="customer-address">Address</Label>
                  <AddressAutocomplete
                    value={customerData.customerAddress}
                    onChange={(value) => handleInputChange('customerAddress', value)}
                    placeholder="Enter customer address (street, city, state, zip)"
                    disabled={isLoading}
                    className="min-h-[80px] resize-none"
                  />
                  <p className="text-xs text-muted-foreground">
                    Full mailing address for the customer. Start typing to see address suggestions.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Form Status */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Form Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {!customerData.customerName && (
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
                  Customer information is complete
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button variant="outline" className="w-full" onClick={() => navigate('/customers')}>
                View All Customers
              </Button>
              <Button variant="outline" className="w-full" onClick={() => navigate('/invoices/create')}>
                Create Invoice for Customer
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default CreateCustomer;