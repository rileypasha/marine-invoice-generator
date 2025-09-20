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
  Badge
} from '../index.js';

const VesselFormUI = ({
  vesselData = {},
  onVesselChange,
  onVesselSelect,
  linkedVessel = null,
  availableVessels = [],
  isLoading = false
}) => {
  const { name = '', weight = '', beam = '', id = null } = vesselData;
  const [showVesselSelector, setShowVesselSelector] = useState(false);

  const handleInputChange = (field, value) => {
    onVesselChange({
      ...vesselData,
      [field]: value
    });
  };

  const handleVesselLink = (vesselId) => {
    const vessel = availableVessels.find(v => v.id === vesselId);
    if (vessel && onVesselSelect) {
      onVesselSelect(vessel);
    }
    setShowVesselSelector(false);
  };

  const handleVesselUnlink = () => {
    if (onVesselSelect) {
      onVesselSelect(null);
    }
  };

  // Validate numeric inputs
  const handleNumericInput = (e, field) => {
    const value = e.target.value;
    // Allow only numbers and decimal point
    const numericValue = value.replace(/[^\d.]/g, '');

    // Ensure only one decimal point
    const parts = numericValue.split('.');
    const cleanValue = parts.length > 2 ? parts[0] + '.' + parts.slice(1).join('') : numericValue;

    handleInputChange(field, cleanValue);
  };

  return (
    <div className="space-y-6">

      {/* Vessel Selector Section */}
      <div className="border rounded-lg p-4 bg-muted/50">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h4 className="text-sm font-medium">Link to Existing Vessel</h4>
            <p className="text-xs text-muted-foreground">
              Auto-fill details from your vessel database
            </p>
          </div>
          {linkedVessel ? (
            <Badge variant="secondary" className="text-xs">
              <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
              Linked to {linkedVessel.name}
            </Badge>
          ) : (
            <Badge variant="outline" className="text-xs">
              Not linked
            </Badge>
          )}
        </div>

        {linkedVessel ? (
          <div className="flex items-center justify-between">
            <div className="text-sm">
              <div className="font-medium">{linkedVessel.name}</div>
              <div className="text-xs text-muted-foreground">
                {linkedVessel.weight_tons && `${linkedVessel.weight_tons} tons`}
                {linkedVessel.weight_tons && linkedVessel.beam_ft && ' • '}
                {linkedVessel.beam_ft && `${linkedVessel.beam_ft} ft beam`}
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleVesselUnlink}
            >
              Unlink
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {showVesselSelector ? (
              <div className="space-y-2">
                <Select onValueChange={handleVesselLink}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a vessel to link..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableVessels.map((vessel) => (
                      <SelectItem key={vessel.id} value={vessel.id}>
                        <div className="flex flex-col">
                          <span className="font-medium">{vessel.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {vessel.weight_tons && `${vessel.weight_tons} tons`}
                            {vessel.weight_tons && vessel.beam_ft && ' • '}
                            {vessel.beam_ft && `${vessel.beam_ft} ft`}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowVesselSelector(false)}
                >
                  Cancel
                </Button>
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowVesselSelector(true)}
                disabled={isLoading || availableVessels.length === 0}
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
                Link Existing Vessel
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Vessel Details Form */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

        {/* Vessel Name */}
        <div className="md:col-span-3 space-y-2">
          <Label htmlFor="vessel-name">Vessel Name *</Label>
          <Input
            id="vessel-name"
            type="text"
            placeholder="Enter vessel name"
            value={name}
            onChange={(e) => handleInputChange('name', e.target.value)}
            disabled={isLoading}
            className="w-full"
            required
          />
        </div>

        {/* Vessel Weight */}
        <div className="space-y-2">
          <Label htmlFor="vessel-weight">Weight (Tons)</Label>
          <div className="relative">
            <Input
              id="vessel-weight"
              type="text"
              placeholder="0.0"
              value={weight}
              onChange={(e) => handleNumericInput(e, 'weight')}
              disabled={isLoading}
              className="pr-12"
            />
            {weight && (
              <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
                <span className="text-sm text-muted-foreground">tons</span>
              </div>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Used for clearance fee calculation
          </p>
        </div>

        {/* Vessel Beam */}
        <div className="space-y-2">
          <Label htmlFor="vessel-beam">Beam (Feet)</Label>
          <div className="relative">
            <Input
              id="vessel-beam"
              type="text"
              placeholder="0.0"
              value={beam}
              onChange={(e) => handleNumericInput(e, 'beam')}
              disabled={isLoading}
              className="pr-8"
            />
            {beam && (
              <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
                <span className="text-sm text-muted-foreground">ft</span>
              </div>
            )}
          </div>
        </div>

        {/* Weight Category Indicator */}
        <div className="space-y-2">
          <Label>Clearance Category</Label>
          <div className="flex items-center space-x-2">
            {weight && parseFloat(weight) > 0 ? (
              <Badge
                variant={parseFloat(weight) > 500 ? "destructive" : "secondary"}
                className="text-xs"
              >
                {parseFloat(weight) > 500 ? 'Over 500 tons' : 'Under 500 tons'}
              </Badge>
            ) : (
              <Badge variant="outline" className="text-xs">
                No weight specified
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {weight && parseFloat(weight) > 500
              ? 'Higher clearance fee will apply'
              : 'Standard clearance fee will apply'
            }
          </p>
        </div>
      </div>

      {/* Validation Messages */}
      {!name && (
        <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
          <svg className="w-4 h-4 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Vessel name is required to proceed to the next step
        </div>
      )}
    </div>
  );
};

export default VesselFormUI;