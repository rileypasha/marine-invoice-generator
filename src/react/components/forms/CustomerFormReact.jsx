import React, { useState, useEffect, useCallback } from 'react';
import { useInvoice } from '../../context/InvoiceContext.jsx';

// Import Magic UI components
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card.jsx';
import { Button } from '../ui/button.jsx';
import { Input } from '../ui/input.jsx';
import { Label } from '../ui/label.jsx';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select.jsx';
import { Alert, AlertDescription } from '../ui/alert.jsx';
import { Badge } from '../ui/badge.jsx';
import { Separator } from '../ui/separator.jsx';
import { Users, CheckCircle2, AlertCircle, Link, Unlink } from 'lucide-react';

// Mock customer database (in production, this would come from an API)
const customerDatabase = [
  {
    id: '1',
    customerName: 'Marine Industries LLC',
    customerEmail: 'contact@marineindustries.com',
    customerPhone: '(555) 123-4567',
    customerAddress: '123 Harbor St, Miami, FL 33101',
    estimatorName: 'John Smith',
    contactName: 'Sarah Johnson',
    type: 'Commercial'
  },
  {
    id: '2',
    customerName: 'Atlantic Shipping Co',
    customerEmail: 'billing@atlanticshipping.com',
    customerPhone: '(555) 234-5678',
    customerAddress: '456 Port Ave, Charleston, SC 29401',
    estimatorName: 'Mike Davis',
    contactName: 'Lisa Chen',
    type: 'Commercial'
  },
  {
    id: '3',
    customerName: 'Bay Area Yacht Club',
    customerEmail: 'office@bayareayacht.com',
    customerPhone: '(555) 345-6789',
    customerAddress: '789 Marina Blvd, San Francisco, CA 94123',
    estimatorName: 'Alex Rodriguez',
    contactName: 'Tom Wilson',
    type: 'Club'
  },
  {
    id: '4',
    customerName: 'Harbor Master Services',
    customerEmail: 'admin@harbormaster.net',
    customerPhone: '(555) 456-7890',
    customerAddress: '321 Dock Rd, Seattle, WA 98101',
    estimatorName: 'Jennifer Lee',
    contactName: 'Bob Martinez',
    type: 'Government'
  }
];

const CustomerSelector = ({ onCustomerSelect, linkedCustomer }) => {
  const handleCustomerSelect = (customerId) => {
    const selectedCustomer = customerDatabase.find(c => c.id === customerId);
    if (selectedCustomer && onCustomerSelect) {
      onCustomerSelect(selectedCustomer);
    }
  };

  return (
    <div className="space-y-2">
      <Label htmlFor="customer-select" className="text-sm font-medium">
        Select Customer from Database
      </Label>
      <Select onValueChange={handleCustomerSelect} value={linkedCustomer?.id || ''}>
        <SelectTrigger
          id="customer-select"
          className="w-full"
          aria-describedby="customer-select-description"
        >
          <SelectValue placeholder="Choose a customer..." />
        </SelectTrigger>
        <SelectContent>
          {customerDatabase.map((customer) => (
            <SelectItem key={customer.id} value={customer.id}>
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                <div>
                  <div className="font-medium">{customer.customerName}</div>
                  <div className="text-xs text-muted-foreground">{customer.type}</div>
                </div>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p id="customer-select-description" className="text-xs text-muted-foreground">
        Select a customer from the database or enter custom details below
      </p>
    </div>
  );
};

const CustomerField = ({ id, label, value, onChange, error, placeholder, type = "text", required = false }) => {
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-sm font-medium">
        {label} {required && '*'}
      </Label>
      <Input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={error ? 'border-destructive' : ''}
        aria-describedby={error ? `${id}-error` : undefined}
        aria-invalid={!!error}
      />
      {error && (
        <p id={`${id}-error`} className="text-xs text-destructive flex items-center gap-1">
          <AlertCircle className="h-3 w-3" />
          {error}
        </p>
      )}
    </div>
  );
};

export const CustomerFormReact = () => {
  const { state, actions } = useInvoice();
  const [validationErrors, setValidationErrors] = useState({});
  const [linkedCustomer, setLinkedCustomer] = useState(null);

  // Get current customer data from context
  const customerData = state.customer || {
    customerName: '',
    customerEmail: '',
    customerPhone: '',
    customerAddress: '',
    estimatorName: '',
    contactName: ''
  };

  // Validation functions
  const validateEmail = useCallback((email) => {
    if (!email) return null;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return 'Please enter a valid email address';
    }
    return null;
  }, []);

  const validatePhone = useCallback((phone) => {
    if (!phone) return null;
    const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      return 'Phone number must be at least 10 digits';
    }
    return null;
  }, []);

  const validateCustomerName = useCallback((name) => {
    if (!name.trim()) {
      return 'Customer name is required';
    } else if (name.length < 2) {
      return 'Customer name must be at least 2 characters';
    }
    return null;
  }, []);

  // Handle customer selection from database
  const handleCustomerSelect = useCallback((customer) => {
    console.log('👤 Customer selected:', customer);
    setLinkedCustomer(customer);

    // Update customer data in context
    actions.updateCustomer({
      id: customer.id,
      customerName: customer.customerName,
      customerEmail: customer.customerEmail,
      customerPhone: customer.customerPhone,
      customerAddress: customer.customerAddress || '',
      estimatorName: customer.estimatorName || '',
      contactName: customer.contactName || ''
    });

    // Clear validation errors
    setValidationErrors({});
  }, [actions]);

  const handleCustomerUnlink = useCallback(() => {
    console.log('🔗 Customer unlinked');
    setLinkedCustomer(null);
    actions.updateCustomer({ id: null });
  }, [actions]);

  // Handle form field changes
  const handleFieldChange = useCallback((field, value) => {
    actions.updateCustomer({ [field]: value });

    // Validate specific fields
    let error = null;
    switch (field) {
      case 'customerName':
        error = validateCustomerName(value);
        break;
      case 'customerEmail':
        error = validateEmail(value);
        break;
      case 'customerPhone':
        error = validatePhone(value);
        break;
    }

    setValidationErrors(prev => ({ ...prev, [field]: error }));
  }, [actions, validateCustomerName, validateEmail, validatePhone]);

  // Format phone number as user types
  const handlePhoneChange = useCallback((value) => {
    // Remove all non-digits
    const digits = value.replace(/\D/g, '');

    // Format as (XXX) XXX-XXXX
    let formatted = digits;
    if (digits.length >= 6) {
      formatted = `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
    } else if (digits.length >= 3) {
      formatted = `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    }

    handleFieldChange('customerPhone', formatted);
  }, [handleFieldChange]);

  // Check if form is valid
  const isValid = !Object.values(validationErrors).some(error => error) &&
                  customerData.customerName &&
                  (!customerData.customerEmail || !validationErrors.customerEmail) &&
                  (!customerData.customerPhone || !validationErrors.customerPhone);

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Customer Information
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <CustomerSelector
          onCustomerSelect={handleCustomerSelect}
          linkedCustomer={linkedCustomer}
        />

        {linkedCustomer && (
          <Alert>
            <CheckCircle2 className="h-4 w-4" />
            <AlertDescription className="flex items-center justify-between">
              <span>Linked to customer: <strong>{linkedCustomer.customerName}</strong></span>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCustomerUnlink}
              >
                <Unlink className="h-4 w-4 mr-1" />
                Unlink
              </Button>
            </AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <CustomerField
            id="customer-name"
            label="Customer Name"
            value={customerData.customerName || ''}
            onChange={(value) => handleFieldChange('customerName', value)}
            error={validationErrors.customerName}
            placeholder="Enter customer name"
            required
          />

          <CustomerField
            id="customer-email"
            label="Customer Email"
            value={customerData.customerEmail || ''}
            onChange={(value) => handleFieldChange('customerEmail', value)}
            error={validationErrors.customerEmail}
            placeholder="customer@example.com"
            type="email"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <CustomerField
            id="customer-phone"
            label="Customer Phone"
            value={customerData.customerPhone || ''}
            onChange={handlePhoneChange}
            error={validationErrors.customerPhone}
            placeholder="(555) 123-4567"
            type="tel"
          />

          <CustomerField
            id="contact-name"
            label="Contact Name"
            value={customerData.contactName || ''}
            onChange={(value) => handleFieldChange('contactName', value)}
            placeholder="Primary contact person"
          />
        </div>

        <CustomerField
          id="customer-address"
          label="Customer Address"
          value={customerData.customerAddress || ''}
          onChange={(value) => handleFieldChange('customerAddress', value)}
          placeholder="Enter customer address"
        />

        <CustomerField
          id="estimator-name"
          label="Estimator Name"
          value={customerData.estimatorName || ''}
          onChange={(value) => handleFieldChange('estimatorName', value)}
          placeholder="Estimator or sales person"
        />

        {isValid && (
          <Alert>
            <CheckCircle2 className="h-4 w-4" />
            <AlertDescription>
              Customer information is complete and valid.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};

export default CustomerFormReact;