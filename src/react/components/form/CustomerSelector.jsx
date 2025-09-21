import React, { useState, useCallback, useEffect } from 'react';
import { TypeaheadCombobox } from './TypeaheadCombobox.jsx';
import { Label } from '../ui/label.jsx';
import { Input } from '../ui/input.jsx';
import { Textarea } from '../ui/textarea.jsx';
import { Button } from '../ui/button.jsx';
import { Alert } from '../ui/alert.jsx';

export const CustomerSelector = ({
  onSelect,
  onError,
  allowCreate = true,
  value = null,
  className,
  ...props
}) => {
  const [selectedCustomer, setSelectedCustomer] = useState(value);
  const [formData, setFormData] = useState({
    display_name: '',
    email: '',
    phone: '',
    address: '',
    notes: ''
  });
  const [showCreateButton, setShowCreateButton] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [message, setMessage] = useState(null);

  // Update form data when selected customer changes
  useEffect(() => {
    if (selectedCustomer) {
      setFormData({
        display_name: selectedCustomer.display_name || '',
        email: selectedCustomer.email || '',
        phone: selectedCustomer.phone || '',
        address: formatAddress(selectedCustomer),
        notes: selectedCustomer.notes || ''
      });
      setShowCreateButton(false);
    }
  }, [selectedCustomer]);

  const formatAddress = (customer) => {
    const addressParts = [
      customer.address_line1,
      customer.address_line2,
      customer.city,
      customer.state,
      customer.postal_code
    ].filter(Boolean);
    return addressParts.join(', ');
  };

  const formatCustomerItem = (customer) => {
    return (
      <div className="customer-info space-y-1">
        <div className="font-medium text-foreground">{customer.display_name}</div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {customer.email && (
            <span className="customer-email">{customer.email}</span>
          )}
          {customer.phone && (
            <span className="customer-phone">{customer.phone}</span>
          )}
        </div>
        {customer.address_line1 && (
          <div className="text-xs text-muted-foreground">
            {formatAddress(customer)}
          </div>
        )}
      </div>
    );
  };

  const handleCustomerSelect = useCallback((customer) => {
    if (customer._isNew) {
      // Handle "create new" selection
      setSelectedCustomer(null);
      setFormData(prev => ({
        ...prev,
        display_name: customer.display_name || ''
      }));
      setShowCreateButton(true);
    } else {
      // Handle existing customer selection
      setSelectedCustomer(customer);
      setShowCreateButton(false);
    }
    onSelect?.(customer);
  }, [onSelect]);

  const handleFieldChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));

    // Show create button if we have a name but no selected customer
    if (field === 'display_name') {
      const hasName = value.trim();
      const noSelection = !selectedCustomer;
      setShowCreateButton(hasName && noSelection && allowCreate);
    }
  };

  const formatPhoneNumber = (phoneNumber) => {
    const cleaned = phoneNumber.replace(/\D/g, '');
    const limited = cleaned.slice(0, 10);

    if (limited.length <= 3) return limited;
    if (limited.length <= 6) return `(${limited.slice(0, 3)}) ${limited.slice(3)}`;
    return `(${limited.slice(0, 3)}) ${limited.slice(3, 6)}-${limited.slice(6)}`;
  };

  const handlePhoneChange = (value) => {
    const formatted = formatPhoneNumber(value);
    handleFieldChange('phone', formatted);
  };

  const createCustomer = async () => {
    try {
      setIsCreating(true);
      setMessage(null);

      // Validate required fields
      if (!formData.display_name?.trim()) {
        throw new Error('Customer name is required');
      }

      const customerData = {
        display_name: formData.display_name.trim(),
        email: formData.email.trim() || null,
        phone: formData.phone.trim() || null,
        notes: formData.notes.trim() || null,
        address_line1: formData.address.trim() || null
      };

      // Call API to create customer
      const response = await fetch('/api/customers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(customerData)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create customer');
      }

      const newCustomer = await response.json();

      // Update selection state
      setSelectedCustomer(newCustomer);
      setShowCreateButton(false);
      setMessage({ text: 'Customer created successfully', type: 'success' });

      onSelect?.(newCustomer);

    } catch (error) {
      console.error('Failed to create customer:', error);
      setMessage({ text: error.message, type: 'error' });
      onError?.(error);
    } finally {
      setIsCreating(false);
    }
  };

  const clearSelection = () => {
    setSelectedCustomer(null);
    setFormData({
      display_name: '',
      email: '',
      phone: '',
      address: '',
      notes: ''
    });
    setShowCreateButton(false);
    setMessage(null);
    onSelect?.(null);
  };

  // Auto-hide message after 3 seconds
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => {
        setMessage(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  return (
    <div className={`space-y-6 ${className}`} {...props}>
      {/* Search Section */}
      <div className="space-y-2">
        <div>
          <Label>Customer</Label>
          <p className="text-sm text-muted-foreground">
            Search existing customers or create new
          </p>
        </div>
        <TypeaheadCombobox
          apiEndpoint="/api/customers/search"
          placeholder="Search customers by name, email, or phone..."
          allowCreate={allowCreate}
          createLabel="Create customer"
          formatItem={formatCustomerItem}
          onSelect={handleCustomerSelect}
          value={selectedCustomer?.display_name || formData.display_name}
          displayField="display_name"
          debounceMs={200}
          minChars={2}
          maxResults={10}
        />
      </div>

      {/* Customer Fields */}
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="customer-name">Customer Name *</Label>
            <Input
              id="customer-name"
              type="text"
              placeholder="Enter customer name"
              value={formData.display_name}
              onChange={(e) => handleFieldChange('display_name', e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="customer-email">Email</Label>
            <Input
              id="customer-email"
              type="email"
              placeholder="customer@example.com"
              value={formData.email}
              onChange={(e) => handleFieldChange('email', e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="customer-phone">Phone</Label>
            <Input
              id="customer-phone"
              type="tel"
              placeholder="(555) 123-4567"
              value={formData.phone}
              onChange={(e) => handlePhoneChange(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="customer-address">Address</Label>
            <Input
              id="customer-address"
              type="text"
              placeholder="123 Main St, City, State"
              value={formData.address}
              onChange={(e) => handleFieldChange('address', e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="customer-notes">Notes</Label>
          <Textarea
            id="customer-notes"
            placeholder="Additional customer notes..."
            rows={2}
            value={formData.notes}
            onChange={(e) => handleFieldChange('notes', e.target.value)}
          />
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={clearSelection}
          >
            Clear Selection
          </Button>

          {showCreateButton && (
            <Button
              type="button"
              size="sm"
              onClick={createCustomer}
              disabled={isCreating}
            >
              {isCreating ? 'Creating...' : 'Create Customer'}
            </Button>
          )}
        </div>

        {/* Message Display */}
        {message && (
          <Alert variant={message.type === 'error' ? 'destructive' : 'default'}>
            {message.text}
          </Alert>
        )}
      </div>
    </div>
  );
};

// Hook for using customer selector functionality
export const useCustomerSelector = (initialCustomer = null) => {
  const [selectedCustomer, setSelectedCustomer] = useState(initialCustomer);
  const [formData, setFormData] = useState({
    display_name: '',
    email: '',
    phone: '',
    address: '',
    notes: ''
  });

  const updateFormData = useCallback((customer) => {
    if (customer) {
      const addressParts = [
        customer.address_line1,
        customer.address_line2,
        customer.city,
        customer.state,
        customer.postal_code
      ].filter(Boolean);

      setFormData({
        display_name: customer.display_name || '',
        email: customer.email || '',
        phone: customer.phone || '',
        address: addressParts.join(', '),
        notes: customer.notes || ''
      });
    } else {
      setFormData({
        display_name: '',
        email: '',
        phone: '',
        address: '',
        notes: ''
      });
    }
  }, []);

  const setCustomer = useCallback((customer) => {
    setSelectedCustomer(customer);
    updateFormData(customer);
  }, [updateFormData]);

  const clearCustomer = useCallback(() => {
    setSelectedCustomer(null);
    updateFormData(null);
  }, [updateFormData]);

  return {
    selectedCustomer,
    formData,
    setFormData,
    setCustomer,
    clearCustomer,
    getCustomerData: () => ({
      display_name: formData.display_name?.trim() || '',
      email: formData.email?.trim() || null,
      phone: formData.phone?.trim() || null,
      notes: formData.notes?.trim() || null,
      address_line1: formData.address?.trim() || null
    })
  };
};

export default CustomerSelector;