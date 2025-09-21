import React, { useState, useEffect, useCallback } from 'react';
import { useInvoice } from '../../context/InvoiceContext.jsx';
import { validateNumber } from '../../../js/state/validators.js';
import { formatCurrencyInput, parseCurrencyInput } from '../../../js/utils/formatters.js';
import { MarkupValidator } from '../../../js/utils/markupValidator.js';
import { safeString, isEmpty } from '../../../js/utils/safeString.js';
import { CONSTANTS } from '../../../js/utils/constants.js';

// Import Magic UI components
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card.jsx';
import { Button } from '../ui/button.jsx';
import { Input } from '../ui/input.jsx';
import { Label } from '../ui/label.jsx';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select.jsx';
import { Alert, AlertDescription } from '../ui/alert.jsx';
import { Badge } from '../ui/badge.jsx';
import { Separator } from '../ui/separator.jsx';
import { Textarea } from '../ui/textarea.jsx';
import { Plus, Trash2, AlertCircle, CheckCircle2, DollarSign, Clock, Calculator } from 'lucide-react';

const ServiceTypeField = ({ value, onChange, error }) => {
  return (
    <div className="space-y-2">
      <Label htmlFor="service-type" className="text-sm font-medium">
        Service Type *
      </Label>
      <Select onValueChange={onChange} value={value || ''}>
        <SelectTrigger
          id="service-type"
          className={`w-full ${error ? 'border-destructive' : ''}`}
          aria-describedby={error ? 'service-type-error' : undefined}
          aria-invalid={!!error}
        >
          <SelectValue placeholder="Select service type..." />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={CONSTANTS.JOB_TYPES.MANUAL_ENTRY}>
            <div className="flex items-center gap-2">
              <Calculator className="h-4 w-4" />
              Manual Entry
            </div>
          </SelectItem>
          <SelectItem value={CONSTANTS.JOB_TYPES.PILOTAGE}>
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Pilotage
            </div>
          </SelectItem>
          <SelectItem value={CONSTANTS.JOB_TYPES.CAR_RENTAL}>
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Car Rental
            </div>
          </SelectItem>
          <SelectItem value={CONSTANTS.JOB_TYPES.TRASH_REMOVAL}>
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Trash Removal
            </div>
          </SelectItem>
          <SelectItem value={CONSTANTS.JOB_TYPES.GOOD_STEW}>
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Good Stew
            </div>
          </SelectItem>
          <SelectItem value={CONSTANTS.JOB_TYPES.CREW_PLACEMENT}>
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Crew Placement
            </div>
          </SelectItem>
          <SelectItem value={CONSTANTS.JOB_TYPES.AGENT_SERVICES}>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Agent Services
            </div>
          </SelectItem>
        </SelectContent>
      </Select>
      {error && (
        <p id="service-type-error" className="text-xs text-destructive flex items-center gap-1">
          <AlertCircle className="h-3 w-3" />
          {error}
        </p>
      )}
    </div>
  );
};

const ItemTypeField = ({ value, onChange, error, visible }) => {
  if (!visible) return null;

  return (
    <div className="space-y-2">
      <Label htmlFor="item-type" className="text-sm font-medium">
        Item Type *
      </Label>
      <Select onValueChange={onChange} value={value || ''}>
        <SelectTrigger
          id="item-type"
          className={`w-full ${error ? 'border-destructive' : ''}`}
          aria-describedby={error ? 'item-type-error' : undefined}
          aria-invalid={!!error}
        >
          <SelectValue placeholder="Select item type..." />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={CONSTANTS.ITEM_TYPES.LABOR}>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Labor
            </div>
          </SelectItem>
          <SelectItem value={CONSTANTS.ITEM_TYPES.MATERIAL}>
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Material
            </div>
          </SelectItem>
          <SelectItem value={CONSTANTS.ITEM_TYPES.SUBCONTRACTOR}>
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Subcontractor
            </div>
          </SelectItem>
        </SelectContent>
      </Select>
      {error && (
        <p id="item-type-error" className="text-xs text-destructive flex items-center gap-1">
          <AlertCircle className="h-3 w-3" />
          {error}
        </p>
      )}
    </div>
  );
};

const DescriptionField = ({ value, onChange, error, visible }) => {
  if (!visible) return null;

  return (
    <div className="space-y-2">
      <Label htmlFor="description" className="text-sm font-medium">
        Description *
      </Label>
      <Textarea
        id="description"
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Enter service description..."
        className={error ? 'border-destructive' : ''}
        aria-describedby={error ? 'description-error' : undefined}
        aria-invalid={!!error}
        rows={2}
      />
      {error && (
        <p id="description-error" className="text-xs text-destructive flex items-center gap-1">
          <AlertCircle className="h-3 w-3" />
          {error}
        </p>
      )}
    </div>
  );
};

const CostField = ({ value, onChange, error, visible }) => {
  if (!visible) return null;

  const handleChange = (e) => {
    const rawValue = e.target.value;
    const cleanValue = parseCurrencyInput(rawValue);

    if (cleanValue === '' || validateNumber(cleanValue, 0)) {
      const formattedValue = cleanValue ? formatCurrencyInput(cleanValue) : '';
      onChange(cleanValue);

      // Update display with formatted value
      setTimeout(() => {
        if (e.target.value !== formattedValue) {
          e.target.value = formattedValue;
        }
      }, 0);
    }
  };

  const handleKeyDown = (e) => {
    // Allow: backspace, delete, tab, escape, enter, decimal point
    if ([8, 9, 27, 13, 46, 110, 190].indexOf(e.keyCode) !== -1 ||
        // Allow: Ctrl+A, Ctrl+C, Ctrl+V, Ctrl+X
        (e.keyCode === 65 && e.ctrlKey === true) ||
        (e.keyCode === 67 && e.ctrlKey === true) ||
        (e.keyCode === 86 && e.ctrlKey === true) ||
        (e.keyCode === 88 && e.ctrlKey === true) ||
        // Allow: home, end, left, right, down, up
        (e.keyCode >= 35 && e.keyCode <= 40)) {
      return;
    }
    // Ensure it's a number and stop the keypress if not
    if ((e.shiftKey || (e.keyCode < 48 || e.keyCode > 57)) && (e.keyCode < 96 || e.keyCode > 105)) {
      e.preventDefault();
    }
  };

  return (
    <div className="space-y-2">
      <Label htmlFor="cost" className="text-sm font-medium">
        Cost *
      </Label>
      <div className="relative">
        <Input
          id="cost"
          type="text"
          value={value ? formatCurrencyInput(value) : ''}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="$0.00"
          className={error ? 'border-destructive pl-8' : 'pl-8'}
          aria-describedby={error ? 'cost-error' : undefined}
          aria-invalid={!!error}
        />
        <DollarSign className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      </div>
      {error && (
        <p id="cost-error" className="text-xs text-destructive flex items-center gap-1">
          <AlertCircle className="h-3 w-3" />
          {error}
        </p>
      )}
    </div>
  );
};

const LaborHoursFields = ({ regularHours, otHours, onRegularChange, onOtChange, errors, visible }) => {
  if (!visible) return null;

  const handleHoursChange = (value, onChange) => {
    if (value === '' || validateNumber(value, 0)) {
      onChange(value);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="regular-hours" className="text-sm font-medium">
            Regular Hours
          </Label>
          <div className="relative">
            <Input
              id="regular-hours"
              type="text"
              value={regularHours || ''}
              onChange={(e) => handleHoursChange(e.target.value, onRegularChange)}
              placeholder="0"
              className={errors.laborHours ? 'border-destructive pr-12' : 'pr-12'}
              aria-describedby={errors.laborHours ? 'regular-hours-error' : 'regular-hours-help'}
              aria-invalid={!!errors.laborHours}
            />
            {regularHours && <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-sm text-muted-foreground">hrs</span>}
          </div>
          {errors.laborHours ? (
            <p id="regular-hours-error" className="text-xs text-destructive flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              {errors.laborHours}
            </p>
          ) : (
            <p id="regular-hours-help" className="text-xs text-muted-foreground">
              ${CONSTANTS.LABOR_RATE}/hour
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="ot-hours" className="text-sm font-medium">
            Overtime Hours
          </Label>
          <div className="relative">
            <Input
              id="ot-hours"
              type="text"
              value={otHours || ''}
              onChange={(e) => handleHoursChange(e.target.value, onOtChange)}
              placeholder="0"
              className={errors.otHours ? 'border-destructive pr-12' : 'pr-12'}
              aria-describedby={errors.otHours ? 'ot-hours-error' : 'ot-hours-help'}
              aria-invalid={!!errors.otHours}
            />
            {otHours && <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-sm text-muted-foreground">hrs</span>}
          </div>
          {errors.otHours ? (
            <p id="ot-hours-error" className="text-xs text-destructive flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              {errors.otHours}
            </p>
          ) : (
            <p id="ot-hours-help" className="text-xs text-muted-foreground">
              ${CONSTANTS.OT_LABOR_RATE}/hour
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

const TaxConfigField = ({ taxStatus, taxRate, onTaxStatusChange, onTaxRateChange }) => {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="tax-status" className="text-sm font-medium">
            Tax Status
          </Label>
          <Select onValueChange={onTaxStatusChange} value={taxStatus || 'taxable'}>
            <SelectTrigger id="tax-status" className="w-full">
              <SelectValue placeholder="Select tax status..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="taxable">Taxable</SelectItem>
              <SelectItem value="non-taxable">Non-Taxable</SelectItem>
              <SelectItem value="exempt">Exempt</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="tax-rate" className="text-sm font-medium">
            Tax Rate (%)
          </Label>
          <div className="relative">
            <Input
              id="tax-rate"
              type="text"
              value={((taxRate || 0.0875) * 100).toFixed(2)}
              onChange={(e) => {
                const percent = parseFloat(e.target.value) || 0;
                onTaxRateChange(percent / 100);
              }}
              placeholder="8.75"
              className="pr-8"
              disabled={taxStatus === 'non-taxable' || taxStatus === 'exempt'}
            />
            <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-sm text-muted-foreground">%</span>
          </div>
        </div>
      </div>
    </div>
  );
};

const MarkupConfigField = ({ markupType, markupRate, onMarkupTypeChange, onMarkupRateChange }) => {
  const getMarkupSelectValue = () => {
    if (!markupType || markupType === 'exempt') return 'exempt';
    if (markupType === 'low') return 'low';
    if (markupType === 'high') return 'high';
    return 'custom';
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="markup-type" className="text-sm font-medium">
            Markup Type
          </Label>
          <Select onValueChange={onMarkupTypeChange} value={getMarkupSelectValue()}>
            <SelectTrigger id="markup-type" className="w-full">
              <SelectValue placeholder="Select markup..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="exempt">No Markup (0%)</SelectItem>
              <SelectItem value="low">Low Markup (2.5%)</SelectItem>
              <SelectItem value="high">High Markup (12.5%)</SelectItem>
              <SelectItem value="custom">Custom Markup</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {getMarkupSelectValue() === 'custom' && (
          <div className="space-y-2">
            <Label htmlFor="markup-rate" className="text-sm font-medium">
              Custom Markup (%)
            </Label>
            <div className="relative">
              <Input
                id="markup-rate"
                type="text"
                value={markupRate ? parseFloat(markupRate).toFixed(2) : '0.00'}
                onChange={(e) => onMarkupRateChange(e.target.value)}
                placeholder="0.00"
                className="pr-8"
              />
              <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-sm text-muted-foreground">%</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const LineItemCard = ({ item, index, onUpdate, onRemove, validationErrors }) => {
  const [localItem, setLocalItem] = useState(item);

  useEffect(() => {
    setLocalItem(item);
  }, [item]);

  const updateField = useCallback((field, value) => {
    const updatedItem = { ...localItem, [field]: value };
    setLocalItem(updatedItem);
    onUpdate(item.id, { [field]: value });
  }, [localItem, item.id, onUpdate]);

  const calculateLaborCost = useCallback(() => {
    if (localItem.itemType === 'Labor') {
      const regularHours = parseFloat(localItem.laborHours) || 0;
      const otHours = parseFloat(localItem.otHours) || 0;
      const laborCost = (regularHours * CONSTANTS.LABOR_RATE) + (otHours * CONSTANTS.OT_LABOR_RATE);

      if (laborCost > 0) {
        updateField('manualCost', laborCost.toString());
      }
    }
  }, [localItem, updateField]);

  useEffect(() => {
    calculateLaborCost();
  }, [localItem.laborHours, localItem.otHours, calculateLaborCost]);

  // Progressive disclosure logic
  const showItemType = localItem.jobType === 'Manual Entry';
  const showDescription = localItem.jobType && (localItem.jobType !== 'Manual Entry' || localItem.itemType);
  const showCost = localItem.jobType && localItem.jobType !== 'Agent Services' &&
                  (localItem.jobType !== 'Manual Entry' || (localItem.itemType && localItem.itemType !== 'Labor'));
  const showLaborFields = (localItem.jobType === 'Agent Services') ||
                         (localItem.jobType === 'Manual Entry' && localItem.itemType === 'Labor');

  const handleTaxStatusChange = (taxStatus) => {
    let taxRate = 0.0875; // default
    if (taxStatus === 'non-taxable' || taxStatus === 'exempt') {
      taxRate = 0;
    }
    updateField('taxStatus', taxStatus);
    updateField('taxRate', taxRate);
  };

  const handleMarkupTypeChange = (markupValue) => {
    const markupConfig = MarkupValidator.parseMarkupType(markupValue);
    Object.keys(markupConfig).forEach(key => {
      updateField(key, markupConfig[key]);
    });
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">
            Item {index + 1}
            {localItem.description && <span className="text-muted-foreground">: {localItem.description}</span>}
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onRemove(item.id)}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <ServiceTypeField
          value={localItem.jobType}
          onChange={(value) => updateField('jobType', value)}
          error={validationErrors.jobType}
        />

        <ItemTypeField
          value={localItem.itemType}
          onChange={(value) => updateField('itemType', value)}
          error={validationErrors.itemType}
          visible={showItemType}
        />

        <DescriptionField
          value={localItem.description}
          onChange={(value) => updateField('description', value)}
          error={validationErrors.description}
          visible={showDescription}
        />

        <CostField
          value={localItem.manualCost}
          onChange={(value) => updateField('manualCost', value)}
          error={validationErrors.manualCost}
          visible={showCost}
        />

        <LaborHoursFields
          regularHours={localItem.laborHours}
          otHours={localItem.otHours}
          onRegularChange={(value) => updateField('laborHours', value)}
          onOtChange={(value) => updateField('otHours', value)}
          errors={validationErrors}
          visible={showLaborFields}
        />

        <Separator />

        <div className="space-y-4">
          <h4 className="text-sm font-medium">Tax Configuration</h4>
          <TaxConfigField
            taxStatus={localItem.taxStatus}
            taxRate={localItem.taxRate}
            onTaxStatusChange={handleTaxStatusChange}
            onTaxRateChange={(rate) => updateField('taxRate', rate)}
          />
        </div>

        <div className="space-y-4">
          <h4 className="text-sm font-medium">Markup Configuration</h4>
          <MarkupConfigField
            markupType={localItem.markupType}
            markupRate={localItem.markupRate}
            onMarkupTypeChange={handleMarkupTypeChange}
            onMarkupRateChange={(rate) => updateField('markupRate', rate)}
          />
        </div>
      </CardContent>
    </Card>
  );
};

export const ServicesFormReact = () => {
  const { state, actions } = useInvoice();
  const [validationErrors, setValidationErrors] = useState({});

  // Get current line items from context
  const lineItems = state.scope?.lineItems || state.services?.lineItems || [];

  // Validation function for line items
  const validateLineItem = useCallback((lineItem) => {
    const errors = {};

    // Service Type is always required
    if (isEmpty(lineItem.jobType)) {
      errors.jobType = 'Service Type is required';
    }

    // For Manual Entry, validate based on progressive disclosure
    if (lineItem.jobType === 'Manual Entry') {
      if (!lineItem.itemType) {
        errors.itemType = 'Item Type is required for Manual Entry';
      } else {
        if (!lineItem.description) {
          errors.description = 'Description is required';
        }

        if (lineItem.itemType === 'Labor') {
          // Labor requires at least regular hours or OT hours
          if (!lineItem.laborHours && !lineItem.otHours) {
            errors.laborHours = 'Hours are required for Labor items';
          }
        } else {
          // Other item types require cost
          if (!lineItem.manualCost) {
            errors.manualCost = 'Cost is required';
          }
        }
      }
    } else if (lineItem.jobType) {
      // For non-Manual Entry services, description is required immediately when service type is selected
      if (!lineItem.description) {
        errors.description = 'Description is required';
      }

      if (lineItem.jobType !== 'Agent Services') {
        // Non-Manual Entry services need cost (except Agent Services which uses hours)
        if (!lineItem.manualCost) {
          errors.manualCost = 'Cost is required';
        }
      }
    }

    return errors;
  }, []);

  const validateAllLineItems = useCallback(() => {
    const errors = {};
    lineItems.forEach((item) => {
      const itemErrors = validateLineItem(item);
      if (Object.keys(itemErrors).length > 0) {
        errors[item.id] = itemErrors;
      }
    });
    return errors;
  }, [lineItems, validateLineItem]);

  // Check if we can add new line items
  const canAddLineItem = () => {
    if (lineItems.length === 0) return true;

    const errors = validateAllLineItems();
    return Object.keys(errors).length === 0;
  };

  const handleAddLineItem = () => {
    if (canAddLineItem()) {
      actions.addLineItem();
    }
  };

  const handleUpdateLineItem = useCallback((id, updates) => {
    actions.updateLineItem(id, updates);

    // Update validation errors for this item
    const updatedItem = lineItems.find(item => item.id === id);
    if (updatedItem) {
      const mergedItem = { ...updatedItem, ...updates };
      const itemErrors = validateLineItem(mergedItem);
      setValidationErrors(prev => ({
        ...prev,
        [id]: Object.keys(itemErrors).length > 0 ? itemErrors : undefined
      }));
    }
  }, [actions, lineItems, validateLineItem]);

  const handleRemoveLineItem = useCallback((id) => {
    actions.removeLineItem(id);
    setValidationErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[id];
      return newErrors;
    });
  }, [actions]);

  // Update validation errors when line items change
  useEffect(() => {
    const errors = validateAllLineItems();
    setValidationErrors(errors);
  }, [validateAllLineItems]);

  const incompleteItemsCount = Object.keys(validationErrors).length;
  const hasIncompleteItems = incompleteItemsCount > 0;

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calculator className="h-5 w-5" />
          Services & Line Items
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {lineItems.length === 0 && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              No services added yet. Click "Add Line Item" to get started.
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-4">
          {lineItems.map((item, index) => (
            <LineItemCard
              key={item.id}
              item={item}
              index={index}
              onUpdate={handleUpdateLineItem}
              onRemove={handleRemoveLineItem}
              validationErrors={validationErrors[item.id] || {}}
            />
          ))}
        </div>

        <div className="flex flex-col gap-4">
          <Button
            onClick={handleAddLineItem}
            disabled={hasIncompleteItems}
            className="w-full"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Line Item
          </Button>

          {hasIncompleteItems && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Complete all line items before adding new ones. {incompleteItemsCount} item{incompleteItemsCount > 1 ? 's' : ''} need{incompleteItemsCount === 1 ? 's' : ''} attention.
              </AlertDescription>
            </Alert>
          )}

          {lineItems.length > 0 && !hasIncompleteItems && (
            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription>
                All line items are complete and valid.
              </AlertDescription>
            </Alert>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default ServicesFormReact;