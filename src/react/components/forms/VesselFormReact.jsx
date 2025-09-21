import React, { useState, useEffect, useCallback } from 'react';
import { useInvoice } from '../../context/InvoiceContext.jsx';
import { validateNumber } from '../../../js/state/validators.js';
import { CONSTANTS } from '../../../js/utils/constants.js';
import { safeString } from '../../../js/utils/safeString.js';

// Import Magic UI components
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card.jsx';
import { Button } from '../ui/button.jsx';
import { Input } from '../ui/input.jsx';
import { Label } from '../ui/label.jsx';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select.jsx';
import { Alert, AlertDescription } from '../ui/alert.jsx';
import { Badge } from '../ui/badge.jsx';
import { Separator } from '../ui/separator.jsx';
import { Ship, Calculator, AlertCircle, CheckCircle2 } from 'lucide-react';

// Mock vessel database (in production, this would come from an API)
const vesselDatabase = [
  { id: '1', name: 'Atlantic Voyager', type: 'Container Ship', weight_tons: 50000, beam_ft: 120 },
  { id: '2', name: 'Pacific Explorer', type: 'Bulk Carrier', weight_tons: 75000, beam_ft: 140 },
  { id: '3', name: 'Mediterranean Star', type: 'Tanker', weight_tons: 100000, beam_ft: 160 },
  { id: '4', name: 'Arctic Pioneer', type: 'Cargo Ship', weight_tons: 30000, beam_ft: 100 },
  { id: '5', name: 'Tropical Breeze', type: 'Ferry', weight_tons: 15000, beam_ft: 80 },
];

const VesselSelector = ({ onVesselSelect, linkedVessel }) => {
  const handleVesselSelect = (vesselId) => {
    const selectedVessel = vesselDatabase.find(v => v.id === vesselId);
    if (selectedVessel && onVesselSelect) {
      onVesselSelect(selectedVessel);
    }
  };

  return (
    <div className="space-y-2">
      <Label htmlFor="vessel-select" className="text-sm font-medium">
        Select Vessel from Database
      </Label>
      <Select onValueChange={handleVesselSelect} value={linkedVessel?.id || ''}>
        <SelectTrigger
          id="vessel-select"
          className="w-full"
          aria-describedby="vessel-select-description"
        >
          <SelectValue placeholder="Choose a vessel..." />
        </SelectTrigger>
        <SelectContent>
          {vesselDatabase.map((vessel) => (
            <SelectItem key={vessel.id} value={vessel.id}>
              <div className="flex items-center gap-2">
                <Ship className="h-4 w-4" />
                <div>
                  <div className="font-medium">{vessel.name}</div>
                  <div className="text-xs text-muted-foreground">{vessel.type}</div>
                </div>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p id="vessel-select-description" className="text-xs text-muted-foreground">
        Select a vessel from the database or enter custom details below
      </p>
    </div>
  );
};

const VesselNameField = ({ value, onChange, error }) => {
  const handleChange = (e) => {
    const newValue = e.target.value;
    onChange(newValue);
  };

  return (
    <div className="space-y-2">
      <Label htmlFor="vessel-name" className="text-sm font-medium">
        Vessel Name *
      </Label>
      <Input
        id="vessel-name"
        type="text"
        value={value}
        onChange={handleChange}
        placeholder="Enter vessel name"
        className={error ? 'border-destructive' : ''}
        aria-describedby={error ? 'vessel-name-error' : undefined}
        aria-invalid={!!error}
      />
      {error && (
        <p id="vessel-name-error" className="text-xs text-destructive flex items-center gap-1">
          <AlertCircle className="h-3 w-3" />
          {error}
        </p>
      )}
    </div>
  );
};

const WeightField = ({ value, onChange, error }) => {
  const handleChange = (e) => {
    const numericValue = e.target.value.replace(/[^\d.]/g, '');
    const parts = numericValue.split('.');
    const cleanValue = parts.length > 2 ? parts[0] + '.' + parts.slice(1).join('') : numericValue;
    onChange(cleanValue);
  };

  const handleKeyDown = (e) => {
    // Allow: backspace, delete, tab, escape, enter
    if ([8, 9, 27, 13, 46].indexOf(e.keyCode) !== -1 ||
        // Allow: Ctrl+A, Ctrl+C, Ctrl+V, Ctrl+X, Ctrl+Z
        (e.keyCode === 65 && e.ctrlKey === true) ||
        (e.keyCode === 67 && e.ctrlKey === true) ||
        (e.keyCode === 86 && e.ctrlKey === true) ||
        (e.keyCode === 88 && e.ctrlKey === true) ||
        (e.keyCode === 90 && e.ctrlKey === true) ||
        // Allow: home, end, left, right, down, up
        (e.keyCode >= 35 && e.keyCode <= 40)) {
      return;
    }
    // Allow: decimal point, but only one
    if (e.keyCode === 190 || e.keyCode === 110) {
      if (e.target.value.indexOf('.') !== -1) {
        e.preventDefault();
        return;
      }
      return;
    }
    // Ensure that it's a number
    if ((e.shiftKey || (e.keyCode < 48 || e.keyCode > 57)) && (e.keyCode < 96 || e.keyCode > 105)) {
      e.preventDefault();
    }
  };

  return (
    <div className="space-y-2">
      <Label htmlFor="vessel-weight" className="text-sm font-medium">
        Weight (tons) *
      </Label>
      <div className="relative">
        <Input
          id="vessel-weight"
          type="text"
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="Enter weight in tons"
          className={error ? 'border-destructive pr-12' : 'pr-12'}
          aria-describedby={error ? 'vessel-weight-error' : 'vessel-weight-help'}
          aria-invalid={!!error}
        />
        {value && <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-sm text-muted-foreground">tons</span>}
      </div>
      {error ? (
        <p id="vessel-weight-error" className="text-xs text-destructive flex items-center gap-1">
          <AlertCircle className="h-3 w-3" />
          {error}
        </p>
      ) : (
        <p id="vessel-weight-help" className="text-xs text-muted-foreground">
          Enter the vessel's weight in tons for clearance fee calculation
        </p>
      )}
    </div>
  );
};

const BeamField = ({ value, onChange, error }) => {
  const handleChange = (e) => {
    const numericValue = e.target.value.replace(/[^\d.]/g, '');
    const parts = numericValue.split('.');
    const cleanValue = parts.length > 2 ? parts[0] + '.' + parts.slice(1).join('') : numericValue;
    onChange(cleanValue);
  };

  const handleKeyDown = (e) => {
    // Same validation as weight field
    if ([8, 9, 27, 13, 46].indexOf(e.keyCode) !== -1 ||
        (e.keyCode === 65 && e.ctrlKey === true) ||
        (e.keyCode === 67 && e.ctrlKey === true) ||
        (e.keyCode === 86 && e.ctrlKey === true) ||
        (e.keyCode === 88 && e.ctrlKey === true) ||
        (e.keyCode === 90 && e.ctrlKey === true) ||
        (e.keyCode >= 35 && e.keyCode <= 40)) {
      return;
    }
    if (e.keyCode === 190 || e.keyCode === 110) {
      if (e.target.value.indexOf('.') !== -1) {
        e.preventDefault();
        return;
      }
      return;
    }
    if ((e.shiftKey || (e.keyCode < 48 || e.keyCode > 57)) && (e.keyCode < 96 || e.keyCode > 105)) {
      e.preventDefault();
    }
  };

  return (
    <div className="space-y-2">
      <Label htmlFor="vessel-beam" className="text-sm font-medium">
        Beam (feet) *
      </Label>
      <div className="relative">
        <Input
          id="vessel-beam"
          type="text"
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="Enter beam in feet"
          className={error ? 'border-destructive pr-12' : 'pr-12'}
          aria-describedby={error ? 'vessel-beam-error' : 'vessel-beam-help'}
          aria-invalid={!!error}
        />
        {value && <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-sm text-muted-foreground">ft</span>}
      </div>
      {error ? (
        <p id="vessel-beam-error" className="text-xs text-destructive flex items-center gap-1">
          <AlertCircle className="h-3 w-3" />
          {error}
        </p>
      ) : (
        <p id="vessel-beam-help" className="text-xs text-muted-foreground">
          Enter the vessel's beam measurement in feet
        </p>
      )}
    </div>
  );
};

const ClearanceFeeDisplay = ({ weight }) => {
  const weightNum = parseFloat(weight) || 0;
  const clearanceFeeAmount = weightNum > CONSTANTS.WEIGHT_THRESHOLD
    ? CONSTANTS.CLEARANCE_FEE_HIGH
    : CONSTANTS.CLEARANCE_FEE_LOW;

  const getFeeCategory = (weight) => {
    if (weight <= 0) return { category: 'No Weight', color: 'bg-gray-100 text-gray-800' };
    if (weight <= CONSTANTS.WEIGHT_THRESHOLD) return { category: 'Under 500 tons', color: 'bg-green-100 text-green-800' };
    return { category: 'Over 500 tons', color: 'bg-blue-100 text-blue-800' };
  };

  const feeInfo = getFeeCategory(weightNum);

  if (weightNum <= 0) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Calculator className="h-4 w-4 text-muted-foreground" />
          <Label className="text-sm font-medium">Clearance Fee Calculation</Label>
        </div>
        <div className="bg-muted/50 rounded-lg p-4">
          <p className="text-sm text-muted-foreground">Enter vessel weight to calculate clearance fee</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Calculator className="h-4 w-4 text-muted-foreground" />
        <Label className="text-sm font-medium">Clearance Fee Calculation</Label>
      </div>

      <div className="bg-muted/50 rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Weight Category:</span>
          <Badge className={feeInfo.color}>{feeInfo.category}</Badge>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Clearance Fee:</span>
          <span className="text-lg font-semibold">
            ${clearanceFeeAmount.toLocaleString()}
          </span>
        </div>

        <Separator />

        <div className="text-xs text-muted-foreground space-y-1">
          <div>Fee Structure:</div>
          <div>• Under {CONSTANTS.WEIGHT_THRESHOLD} tons: ${CONSTANTS.CLEARANCE_FEE_LOW}</div>
          <div>• Over {CONSTANTS.WEIGHT_THRESHOLD} tons: ${CONSTANTS.CLEARANCE_FEE_HIGH}</div>
        </div>
      </div>
    </div>
  );
};

export const VesselFormReact = () => {
  const { state, actions } = useInvoice();
  const [validationErrors, setValidationErrors] = useState({});
  const [linkedVessel, setLinkedVessel] = useState(null);

  // Get current vessel data from context
  const vesselData = state.vessel || { name: '', weight: '', beam: '' };

  // Hide loading placeholder when component mounts
  useEffect(() => {
    const placeholder = document.querySelector('.vessel-loading-placeholder');
    if (placeholder) {
      placeholder.style.display = 'none';
    }
  }, []);

  // Validation functions
  const validateVesselName = useCallback((name) => {
    if (!name.trim()) {
      return 'Vessel name is required';
    } else if (name.length < 3) {
      return 'Vessel name must be at least 3 characters';
    }
    return null;
  }, []);

  const validateWeight = useCallback((weight) => {
    const weightNum = parseFloat(weight);
    if (!weight || isNaN(weightNum) || weightNum <= 0) {
      return 'Weight must be greater than 0';
    } else if (weightNum > 200000) {
      return 'Weight cannot exceed 200,000 tons';
    }
    return null;
  }, []);

  const validateBeam = useCallback((beam) => {
    const beamNum = parseFloat(beam);
    if (!beam || isNaN(beamNum) || beamNum <= 0) {
      return 'Beam must be greater than 0';
    } else if (beamNum > 500) {
      return 'Beam cannot exceed 500 feet';
    }
    return null;
  }, []);

  // Handle vessel selection from database
  const handleVesselSelect = useCallback((vessel) => {
    console.log('🚢 Vessel selected:', vessel);
    setLinkedVessel(vessel);

    // Update vessel data in context
    actions.updateVessel({
      id: vessel.id,
      name: vessel.name,
      weight: vessel.weight_tons ? vessel.weight_tons.toString() : '',
      beam: vessel.beam_ft ? vessel.beam_ft.toString() : ''
    });

    // Clear validation errors
    setValidationErrors(prev => ({ ...prev, name: undefined }));
  }, [actions]);

  const handleVesselUnlink = useCallback(() => {
    console.log('🔗 Vessel unlinked');
    setLinkedVessel(null);
    actions.updateVessel({ id: null });
  }, [actions]);

  // Handle form field changes
  const handleNameChange = useCallback((name) => {
    actions.updateVessel({ name });
    const error = validateVesselName(name);
    setValidationErrors(prev => ({ ...prev, name: error }));
  }, [actions, validateVesselName]);

  const handleWeightChange = useCallback((weight) => {
    actions.updateVessel({ weight });
    const error = validateWeight(weight);
    setValidationErrors(prev => ({ ...prev, weight: error }));

    // Auto-manage clearance fee
    manageClearanceFee(weight);
  }, [actions, validateWeight]);

  const handleBeamChange = useCallback((beam) => {
    actions.updateVessel({ beam });
    const error = validateBeam(beam);
    setValidationErrors(prev => ({ ...prev, beam: error }));
  }, [actions, validateBeam]);

  // Clearance fee management
  const manageClearanceFee = useCallback((weight) => {
    const lineItems = state.scope.lineItems || [];

    // Find existing clearance fee line item
    const existingClearanceIndex = lineItems.findIndex(item =>
      item.jobType === 'Clearance Fee' || item.description === 'Clearance Fee'
    );

    const weightNum = parseFloat(weight) || 0;

    if (weightNum > 0) {
      // Calculate appropriate clearance fee
      const clearanceFeeAmount = weightNum > CONSTANTS.WEIGHT_THRESHOLD
        ? CONSTANTS.CLEARANCE_FEE_HIGH
        : CONSTANTS.CLEARANCE_FEE_LOW;

      const clearanceFeeItem = {
        jobType: 'Clearance Fee',
        description: `Clearance Fee (${weightNum > CONSTANTS.WEIGHT_THRESHOLD ? 'Over' : 'Under'} ${CONSTANTS.WEIGHT_THRESHOLD} tons)`,
        itemType: 'Administrative',
        manualCost: clearanceFeeAmount.toString(),
        cost: clearanceFeeAmount,
        taxStatus: 'non-taxable',
        taxRate: 0,
        taxAmount: 0,
        isMarkupExempt: true,
        markupType: 'exempt',
        markupRate: '0'
      };

      if (existingClearanceIndex >= 0) {
        // Update existing clearance fee
        const existingItem = lineItems[existingClearanceIndex];
        actions.updateLineItem(existingItem.id, clearanceFeeItem);
      } else {
        // Add new clearance fee
        actions.addLineItem(clearanceFeeItem);
      }
    } else if (existingClearanceIndex >= 0) {
      // Remove clearance fee if weight is 0 or empty
      const existingItem = lineItems[existingClearanceIndex];
      actions.removeLineItem(existingItem.id);
    }
  }, [state.scope.lineItems, actions]);

  // Check if form is valid
  const isValid = !validationErrors.name && !validationErrors.weight && !validationErrors.beam &&
                  vesselData.name && vesselData.weight && vesselData.beam;

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Ship className="h-5 w-5" />
          Vessel Information
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <VesselSelector
          onVesselSelect={handleVesselSelect}
          linkedVessel={linkedVessel}
        />

        {linkedVessel && (
          <Alert>
            <CheckCircle2 className="h-4 w-4" />
            <AlertDescription className="flex items-center justify-between">
              <span>Linked to vessel: <strong>{linkedVessel.name}</strong></span>
              <Button
                variant="outline"
                size="sm"
                onClick={handleVesselUnlink}
              >
                Unlink
              </Button>
            </AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <VesselNameField
            value={vesselData.name || ''}
            onChange={handleNameChange}
            error={validationErrors.name}
          />
          <WeightField
            value={vesselData.weight || ''}
            onChange={handleWeightChange}
            error={validationErrors.weight}
          />
        </div>

        <BeamField
          value={vesselData.beam || ''}
          onChange={handleBeamChange}
          error={validationErrors.beam}
        />

        <ClearanceFeeDisplay weight={vesselData.weight || '0'} />

        {isValid && (
          <Alert>
            <CheckCircle2 className="h-4 w-4" />
            <AlertDescription>
              Vessel information is complete and valid.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};

export default VesselFormReact;