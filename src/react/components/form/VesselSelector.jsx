import React, { useState, useCallback } from 'react';
import { TypeaheadCombobox } from './TypeaheadCombobox.jsx';
import { Label } from '../ui/label.jsx';
import { Button } from '../ui/button.jsx';
import { Badge } from '../ui/badge.jsx';

export const VesselSelector = ({
  apiEndpoint = '/api/vessels/search',
  placeholder = 'Type vessel name or registration...',
  emptyMessage = 'No vessels found',
  loadingMessage = 'Searching vessels...',
  errorMessage = 'Search failed. Please try again.',
  onSelect,
  onUnlink,
  allowUnlink = true,
  value = '',
  onChange,
  linkedVessel = null,
  className,
  ...props
}) => {
  const [currentLinkedVessel, setCurrentLinkedVessel] = useState(linkedVessel);

  const handleSelect = useCallback((vessel) => {
    setCurrentLinkedVessel(vessel);
    onSelect?.(vessel);
  }, [onSelect]);

  const handleUnlink = useCallback(() => {
    setCurrentLinkedVessel(null);
    onChange?.('');
    onUnlink?.();
  }, [onChange, onUnlink]);

  const formatVesselItem = (vessel) => {
    return (
      <div className="vessel-option-content">
        <div className="flex items-center justify-between">
          <div className="vessel-option-primary">
            <span className="font-medium text-foreground">{vessel.name}</span>
            {vessel.registration_number && (
              <span className="ml-2 text-sm text-muted-foreground">
                {vessel.registration_number}
              </span>
            )}
          </div>
        </div>
        <div className="vessel-option-secondary flex items-center gap-3 mt-1 text-xs text-muted-foreground">
          {vessel.home_port && (
            <span className="vessel-port">{vessel.home_port}</span>
          )}
          {vessel.length_ft && (
            <span className="vessel-length">{vessel.length_ft} ft</span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className={`space-y-2 ${className}`} {...props}>
      <div className="flex items-center justify-between">
        <Label>Select Vessel</Label>
        {currentLinkedVessel && allowUnlink && (
          <Badge variant="secondary" className="flex items-center gap-1">
            <svg
              className="w-3 h-3 text-green-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
              />
            </svg>
            <span className="text-xs">Linked to saved vessel</span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-auto p-0 ml-1"
              onClick={handleUnlink}
              title="Unlink vessel"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </Button>
          </Badge>
        )}
      </div>

      <TypeaheadCombobox
        apiEndpoint={apiEndpoint}
        searchParam="query"
        displayField="name"
        valueField="id"
        placeholder={placeholder}
        emptyMessage={emptyMessage}
        loadingMessage={loadingMessage}
        errorMessage={errorMessage}
        formatItem={formatVesselItem}
        onSelect={handleSelect}
        value={currentLinkedVessel?.name || value}
        onChange={onChange}
        debounceMs={200}
        minChars={2}
        maxResults={10}
      />
    </div>
  );
};

// Hook for using vessel selector functionality
export const useVesselSelector = (initialVessel = null) => {
  const [linkedVessel, setLinkedVessel] = useState(initialVessel);
  const [inputValue, setInputValue] = useState(initialVessel?.name || '');

  const handleSelect = useCallback((vessel) => {
    setLinkedVessel(vessel);
    setInputValue(vessel.name);
  }, []);

  const handleUnlink = useCallback(() => {
    setLinkedVessel(null);
    setInputValue('');
  }, []);

  const handleInputChange = useCallback((value) => {
    setInputValue(value);
    // Clear linked vessel if user is typing and it doesn't match
    if (linkedVessel && value !== linkedVessel.name) {
      setLinkedVessel(null);
    }
  }, [linkedVessel]);

  return {
    linkedVessel,
    inputValue,
    setLinkedVessel,
    setInputValue,
    handleSelect,
    handleUnlink,
    handleInputChange,
    getLinkedVessel: () => linkedVessel,
    getValue: () => inputValue,
    setValue: (value) => setInputValue(value || ''),
    clear: () => {
      setLinkedVessel(null);
      setInputValue('');
    }
  };
};

export default VesselSelector;