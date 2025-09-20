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
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
  Textarea
} from '../index.js';

const ServicesFormUI = ({
  servicesData = [],
  onServicesChange,
  onAddService,
  onRemoveService,
  isLoading = false
}) => {
  const [newService, setNewService] = useState({
    jobType: '',
    itemType: '',
    description: '',
    hours: '',
    rate: '',
    quantity: '',
    cost: '',
    taxStatus: 'taxable',
    markupRate: ''
  });

  // Job types from constants
  const jobTypes = [
    'Manual Entry',
    'Pilotage',
    'Car Rental',
    'Trash Removal',
    'Good Stew',
    'Crew Placement',
    'Agent Services'
  ];

  const itemTypes = ['Labor', 'Material', 'Subcontractor'];
  const taxStatuses = [
    { value: 'taxable', label: 'Taxable' },
    { value: 'non-taxable', label: 'Non-Taxable' }
  ];

  const handleNewServiceChange = (field, value) => {
    const updated = { ...newService, [field]: value };

    // Auto-calculate costs based on service type
    if (field === 'jobType' || field === 'itemType' || field === 'hours' || field === 'rate' || field === 'quantity') {
      updated.cost = calculateServiceCost(updated);
    }

    // Set default rates for labor
    if (field === 'itemType' && value === 'Labor') {
      updated.rate = updated.rate || '80'; // Standard rate
    }

    setNewService(updated);
  };

  const calculateServiceCost = (service) => {
    if (service.itemType === 'Labor' && service.hours && service.rate) {
      return (parseFloat(service.hours) * parseFloat(service.rate)).toFixed(2);
    }
    if (service.itemType === 'Material' && service.quantity && service.cost) {
      return (parseFloat(service.quantity) * parseFloat(service.cost)).toFixed(2);
    }
    return service.cost || '0.00';
  };

  const handleAddService = () => {
    if (!newService.jobType) {
      return;
    }

    const serviceToAdd = {
      id: Date.now(),
      ...newService,
      total: parseFloat(newService.cost || 0)
    };

    if (onAddService) {
      onAddService(serviceToAdd);
    }

    // Reset form
    setNewService({
      jobType: '',
      itemType: '',
      description: '',
      hours: '',
      rate: '',
      quantity: '',
      cost: '',
      taxStatus: 'taxable',
      markupRate: ''
    });
  };

  const handleServiceUpdate = (serviceId, field, value) => {
    const updatedServices = servicesData.map(service => {
      if (service.id === serviceId) {
        const updated = { ...service, [field]: value };
        // Recalculate total if cost-related fields change
        if (['hours', 'rate', 'quantity', 'cost'].includes(field)) {
          updated.total = parseFloat(calculateServiceCost(updated));
        }
        return updated;
      }
      return service;
    });

    if (onServicesChange) {
      onServicesChange(updatedServices);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount || 0);
  };

  const subtotal = servicesData.reduce((sum, service) => sum + (service.total || 0), 0);

  return (
    <div className="space-y-6">

      {/* Add New Service Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Add Service</CardTitle>
          <CardDescription>
            Add a new service, labor, or material to this invoice
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">

          {/* Service Type Selection */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Service Type *</Label>
              <Select value={newService.jobType} onValueChange={(value) => handleNewServiceChange('jobType', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select service type" />
                </SelectTrigger>
                <SelectContent>
                  {jobTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {newService.jobType === 'Manual Entry' && (
              <div className="space-y-2">
                <Label>Item Type *</Label>
                <Select value={newService.itemType} onValueChange={(value) => handleNewServiceChange('itemType', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select item type" />
                  </SelectTrigger>
                  <SelectContent>
                    {itemTypes.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* Description (shown after job type is selected) */}
          {newService.jobType && (
            <div className="space-y-2">
              <Label>Description *</Label>
              <Textarea
                placeholder="Describe the service or work performed"
                value={newService.description}
                onChange={(e) => handleNewServiceChange('description', e.target.value)}
                rows={2}
                className="resize-none"
              />
            </div>
          )}

          {/* Labor Fields (for Labor items) */}
          {newService.itemType === 'Labor' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Hours</Label>
                <Input
                  type="number"
                  step="0.25"
                  placeholder="0.00"
                  value={newService.hours}
                  onChange={(e) => handleNewServiceChange('hours', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Rate ($/hour)</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="80.00"
                  value={newService.rate}
                  onChange={(e) => handleNewServiceChange('rate', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Total</Label>
                <Input
                  type="text"
                  value={formatCurrency(newService.cost)}
                  disabled
                  className="bg-muted"
                />
              </div>
            </div>
          )}

          {/* Material/Subcontractor Fields */}
          {(newService.itemType === 'Material' || newService.itemType === 'Subcontractor') && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Quantity</Label>
                <Input
                  type="number"
                  step="1"
                  placeholder="1"
                  value={newService.quantity}
                  onChange={(e) => handleNewServiceChange('quantity', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Unit Cost</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={newService.cost}
                  onChange={(e) => handleNewServiceChange('cost', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Total</Label>
                <Input
                  type="text"
                  value={formatCurrency(calculateServiceCost(newService))}
                  disabled
                  className="bg-muted"
                />
              </div>
            </div>
          )}

          {/* Fixed Price for other job types */}
          {newService.jobType && newService.jobType !== 'Manual Entry' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Cost</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={newService.cost}
                  onChange={(e) => handleNewServiceChange('cost', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Tax Status</Label>
                <Select value={newService.taxStatus} onValueChange={(value) => handleNewServiceChange('taxStatus', value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {taxStatuses.map((status) => (
                      <SelectItem key={status.value} value={status.value}>
                        {status.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* Add Button */}
          <div className="flex justify-end">
            <Button
              onClick={handleAddService}
              disabled={!newService.jobType || !newService.description || isLoading}
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 5v14m-7-7h14" />
              </svg>
              Add Service
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Services List */}
      {servicesData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Services & Line Items</CardTitle>
            <CardDescription>
              {servicesData.length} service{servicesData.length !== 1 ? 's' : ''} added
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Service</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Details</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {servicesData.map((service) => (
                  <TableRow key={service.id}>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="font-medium">{service.jobType}</div>
                        {service.itemType && (
                          <Badge variant="secondary" className="text-xs">
                            {service.itemType}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="max-w-xs">
                        <p className="text-sm line-clamp-2">{service.description}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-xs text-muted-foreground space-y-1">
                        {service.hours && (
                          <div>{service.hours} hrs @ {formatCurrency(service.rate)}/hr</div>
                        )}
                        {service.quantity && (
                          <div>Qty: {service.quantity}</div>
                        )}
                        {service.taxStatus && (
                          <Badge variant={service.taxStatus === 'taxable' ? 'default' : 'outline'} className="text-xs">
                            {service.taxStatus === 'taxable' ? 'Taxable' : 'Non-Taxable'}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(service.total)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onRemoveService?.(service.id)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {/* Subtotal */}
            <div className="mt-4 pt-4 border-t">
              <div className="flex justify-between items-center">
                <span className="font-medium">Subtotal:</span>
                <span className="text-lg font-semibold">{formatCurrency(subtotal)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {servicesData.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <svg className="mx-auto h-12 w-12 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
          </svg>
          <h3 className="text-lg font-medium mb-2">No services added</h3>
          <p className="text-sm">Add your first service using the form above</p>
        </div>
      )}
    </div>
  );
};

export default ServicesFormUI;