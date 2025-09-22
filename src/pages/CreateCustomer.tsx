import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Save, Eye, Plus, User, ArrowLeft } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
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
  estimatorName: string;
  contactName: string;
}

interface LinkedCustomer {
  id: string;
  company_name?: string;
  display_name?: string;
  email?: string;
  phone?: string;
}

const CreateCustomer: React.FC = () => {
  const navigate = useNavigate();
  const [customerData, setCustomerData] = useState<Customer>({
    customerName: '',
    customerEmail: '',
    customerPhone: '',
    customerAddress: '',
    estimatorName: '',
    contactName: '',
    id: null
  });

  const [showCustomerSelector, setShowCustomerSelector] = useState(false);
  const [linkedCustomer, setLinkedCustomer] = useState<LinkedCustomer | null>(null);
  const [availableCustomers, setAvailableCustomers] = useState<LinkedCustomer[]>([]);
  const [emailError, setEmailError] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Load available customers on component mount
  useEffect(() => {
    // In a real app, this would fetch from your API
    // For now, we'll use mock data
    setAvailableCustomers([
      { id: '1', company_name: 'Marine Services Inc', email: 'contact@marineservices.com', phone: '(555) 123-4567' },
      { id: '2', company_name: 'Harbor Logistics', email: 'info@harborlogistics.com', phone: '(555) 987-6543' },
      { id: '3', display_name: 'Captain John Smith', email: 'john@example.com', phone: '(555) 456-7890' }
    ]);
  }, []);

  const handleInputChange = (field: keyof Customer, value: string) => {
    setCustomerData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleCustomerLink = (customerId: string) => {
    const customer = availableCustomers.find(c => c.id === customerId);
    if (customer) {
      setLinkedCustomer(customer);
      // Auto-fill customer data from linked customer
      setCustomerData(prev => ({
        ...prev,
        customerName: customer.company_name || customer.display_name || '',
        customerEmail: customer.email || '',
        customerPhone: customer.phone || ''
      }));
    }
    setShowCustomerSelector(false);
  };

  const handleCustomerUnlink = () => {
    setLinkedCustomer(null);
    // Clear auto-filled data
    setCustomerData(prev => ({
      ...prev,
      customerName: '',
      customerEmail: '',
      customerPhone: ''
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

  const handlePreview = () => {
    console.log('Preview customer:', customerData);
  };

  const handleNew = () => {
    setCustomerData({
      customerName: '',
      customerEmail: '',
      customerPhone: '',
      customerAddress: '',
      estimatorName: '',
      contactName: '',
      id: null
    });
    setLinkedCustomer(null);
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
            <Button variant="outline" onClick={handlePreview} disabled={!isFormValid}>
              <Eye className="h-4 w-4 mr-2" />
              Preview
            </Button>
            <Button variant="outline" onClick={handleNew}>
              <Plus className="h-4 w-4 mr-2" />
              New
            </Button>
            <Button onClick={handleSave} disabled={!isFormValid || isLoading}>
              <Save className="h-4 w-4 mr-2" />
              {isLoading ? 'Saving...' : 'Save Customer'}
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
              {/* Customer Selector Section */}
              <div className="border rounded-lg p-4 bg-muted/50">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h4 className="text-sm font-medium">Link to Existing Customer</h4>
                    <p className="text-xs text-muted-foreground">
                      Auto-fill details from your customer database
                    </p>
                  </div>
                  {linkedCustomer ? (
                    <Badge variant="secondary" className="text-xs">
                      <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                      </svg>
                      Linked to {linkedCustomer.company_name || linkedCustomer.display_name}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-xs">
                      Not linked
                    </Badge>
                  )}
                </div>

                {linkedCustomer ? (
                  <div className="flex items-center justify-between">
                    <div className="text-sm">
                      <div className="font-medium">{linkedCustomer.company_name || linkedCustomer.display_name}</div>
                      <div className="text-xs text-muted-foreground">
                        {linkedCustomer.email && linkedCustomer.email}
                        {linkedCustomer.email && linkedCustomer.phone && ' • '}
                        {linkedCustomer.phone && linkedCustomer.phone}
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCustomerUnlink}
                    >
                      Unlink
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {showCustomerSelector ? (
                      <div className="space-y-2">
                        <Select onValueChange={handleCustomerLink}>
                          <SelectTrigger>
                            <SelectValue placeholder="Choose a customer to link..." />
                          </SelectTrigger>
                          <SelectContent>
                            {availableCustomers.map((customer) => (
                              <SelectItem key={customer.id} value={customer.id}>
                                <div className="flex flex-col">
                                  <span className="font-medium">
                                    {customer.company_name || customer.display_name}
                                  </span>
                                  <span className="text-xs text-muted-foreground">
                                    {customer.email}
                                  </span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowCustomerSelector(false)}
                        >
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowCustomerSelector(true)}
                        disabled={isLoading || availableCustomers.length === 0}
                      >
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                        </svg>
                        Link Existing Customer
                      </Button>
                    )}
                  </div>
                )}
              </div>

              {/* Customer Details Form */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Estimator Name */}
                <div className="space-y-2">
                  <Label htmlFor="estimator-name">Estimator Name</Label>
                  <Input
                    id="estimator-name"
                    type="text"
                    placeholder="Who is creating this estimate?"
                    value={customerData.estimatorName}
                    onChange={(e) => handleInputChange('estimatorName', e.target.value)}
                    disabled={isLoading}
                  />
                  <p className="text-xs text-muted-foreground">
                    The person preparing this invoice
                  </p>
                </div>

                {/* Contact Name */}
                <div className="space-y-2">
                  <Label htmlFor="contact-name">Contact Name</Label>
                  <Input
                    id="contact-name"
                    type="text"
                    placeholder="Primary contact person"
                    value={customerData.contactName}
                    onChange={(e) => handleInputChange('contactName', e.target.value)}
                    disabled={isLoading}
                  />
                </div>

                {/* Customer Name */}
                <div className="md:col-span-2 space-y-2">
                  <Label htmlFor="customer-name">Customer/Company Name *</Label>
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
                  <Textarea
                    id="customer-address"
                    placeholder="Enter customer address (street, city, state, zip)"
                    value={customerData.customerAddress}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => handleInputChange('customerAddress', e.target.value)}
                    disabled={isLoading}
                    rows={3}
                    className="resize-none"
                  />
                  <p className="text-xs text-muted-foreground">
                    Full mailing address for the customer
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