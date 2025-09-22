import React, { useRef, useEffect } from 'react';
import { MapPin, Loader2 } from 'lucide-react';
import { Input } from './ui/input';
import { useAddressAutocomplete } from '../hooks/useAddressAutocomplete';

interface AddressResult {
  formatted: string;
  name?: string;
  street?: string;
  city?: string;
  state?: string;
  postcode?: string;
  country?: string;
  lat?: number;
  lon?: number;
}

interface AddressAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSelect?: (address: AddressResult) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export const AddressAutocomplete: React.FC<AddressAutocompleteProps> = ({
  value,
  onChange,
  onSelect,
  placeholder = "Enter address",
  disabled = false,
  className = ""
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const {
    query,
    results,
    isLoading,
    isOpen,
    selectedIndex,
    status,
    handleInputChange,
    handleSelectAddress,
    handleKeyDown,
    clearResults,
    setQuery
  } = useAddressAutocomplete({
    onSelect: (address) => {
      onChange(address.formatted);
      onSelect?.(address);
    },
    onError: (error) => {
      console.error('Address autocomplete error:', error);
    }
  });

  // Sync external value with internal query
  useEffect(() => {
    if (value !== query) {
      setQuery(value);
    }
  }, [value, query, setQuery]);

  // Handle input change
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    onChange(newValue);
    handleInputChange(newValue);
  };

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        clearResults();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [clearResults]);

  return (
    <div className="relative">
      <div className="relative">
        <Input
          ref={inputRef}
          type="text"
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          className={`pl-10 ${className}`}
          autoComplete="off"
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          aria-label="Address input with autocomplete"
        />
        <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
        {isLoading && (
          <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 animate-spin text-gray-400" />
        )}
      </div>

      {/* Screen reader status */}
      {status && (
        <div className="sr-only" aria-live="polite" aria-atomic="true">
          {status}
        </div>
      )}

      {/* Dropdown */}
      {isOpen && (
        <div
          ref={dropdownRef}
          className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-auto"
          role="listbox"
          aria-label="Address suggestions"
        >
          {results.length > 0 ? (
            results.map((address, index) => (
              <div
                key={`${address.formatted}-${index}`}
                className={`px-4 py-3 cursor-pointer hover:bg-gray-50 border-b border-gray-100 last:border-b-0 ${
                  index === selectedIndex ? 'bg-blue-50 border-blue-200' : ''
                }`}
                onClick={() => handleSelectAddress(address)}
                role="option"
                aria-selected={index === selectedIndex}
                tabIndex={-1}
              >
                <div className="flex items-start space-x-3">
                  <MapPin className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {address.formatted}
                    </p>
                    {(address.city || address.state || address.country) && (
                      <p className="text-xs text-gray-500 mt-0.5">
                        {[address.city, address.state, address.country]
                          .filter(Boolean)
                          .join(', ')}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="px-4 py-3 text-sm text-gray-500 text-center">
              {isLoading ? 'Searching for addresses...' : 'No addresses found'}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AddressAutocomplete;