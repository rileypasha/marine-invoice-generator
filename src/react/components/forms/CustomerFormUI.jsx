import React, { useState, useEffect } from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Input,
  Label,
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Badge,
  Textarea
} from '../index.js';

const CustomerFormUI = ({
  customerData = {},
  onCustomerChange,
  onCustomerSelect,
  linkedCustomer = null,
  availableCustomers = [],
  isLoading = false
}) => {
  const {
    customerName = '',
    customerEmail = '',
    customerPhone = '',
    customerAddress = '',
    estimatorName = '',
    contactName = '',
    id = null
  } = customerData;

  const [showCustomerSelector, setShowCustomerSelector] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [phoneError, setPhoneError] = useState('');

  const handleInputChange = (field, value) => {
    onCustomerChange({
      ...customerData,
      [field]: value
    });
  };

  const handleCustomerLink = (customerId) => {
    const customer = availableCustomers.find(c => c.id === customerId);
    if (customer && onCustomerSelect) {
      onCustomerSelect(customer);
    }
    setShowCustomerSelector(false);
  };

  const handleCustomerUnlink = () => {
    if (onCustomerSelect) {
      onCustomerSelect(null);
    }
  };

  // Email validation
  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleEmailChange = (value) => {
    handleInputChange('customerEmail', value);

    if (value && !validateEmail(value)) {
      setEmailError('Please enter a valid email address');
    } else {
      setEmailError('');
    }
  };

  // Phone formatting
  const formatPhoneNumber = (phoneStr) => {
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

  const handlePhoneChange = (value) => {
    const formatted = formatPhoneNumber(value);
    handleInputChange('customerPhone', formatted);

    const cleaned = value.replace(/\D/g, '');
    if (cleaned.length > 0 && cleaned.length < 10) {
      setPhoneError('Phone number must be 10 digits');
    } else {
      setPhoneError('');
    }
  };

  return (
    <div className="space-y-6">

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
            value={estimatorName}
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
            value={contactName}
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
            value={customerName}
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
            value={customerEmail}
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
            value={customerPhone}
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
            value={customerAddress}
            onChange={(e) => handleInputChange('customerAddress', e.target.value)}
            disabled={isLoading}
            rows={3}
            className="resize-none"
          />
          <p className="text-xs text-muted-foreground">
            Full mailing address for the customer
          </p>
        </div>
      </div>

      {/* Form Validation Status */}
      <div className="space-y-2">
        {!customerName && (
          <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
            <svg className="w-4 h-4 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Customer name is required to proceed
          </div>
        )}

        {!customerEmail && (
          <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
            <svg className="w-4 h-4 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Email address is required for sending invoices
          </div>
        )}

        {customerName && customerEmail && !emailError && !phoneError && (
          <div className="text-sm text-green-600 bg-green-50 p-3 rounded-lg border border-green-200">
            <svg className="w-4 h-4 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
            </svg>
            Customer information is complete
          </div>
        )}
      </div>
    </div>
  );
};

export default CustomerFormUI;