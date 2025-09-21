import React, { useRef } from 'react';
import { useAddressAutocomplete } from '../../hooks/useAddressAutocomplete.js';
import { Input } from '../ui/input.jsx';
import { Label } from '../ui/label.jsx';

export const AddressAutocomplete = ({
  label = 'Address',
  placeholder = 'Start typing address...',
  value = '',
  onChange,
  onSelect,
  onError,
  minChars = 3,
  debounceMs = 300,
  maxResults = 5,
  required = false,
  className,
  ...props
}) => {
  const inputRef = useRef(null);
  const listboxRef = useRef(null);

  const {
    query,
    results,
    isLoading,
    isOpen,
    selectedIndex,
    status,
    handleInputChange,
    handleKeyDown,
    selectAddress,
    highlightMatch,
    setIsOpen
  } = useAddressAutocomplete({
    minChars,
    debounceMs,
    maxResults,
    onSelect,
    onError
  });

  const handleChange = (e) => {
    const newValue = e.target.value;
    handleInputChange(newValue);
    onChange?.(newValue);
  };

  const handleFocus = () => {
    if (query.length >= minChars && results.length > 0) {
      setIsOpen(true);
    }
  };

  const handleBlur = (e) => {
    // Delay hiding to allow for clicks on suggestions
    setTimeout(() => {
      if (!listboxRef.current?.contains(document.activeElement)) {
        setIsOpen(false);
      }
    }, 150);
  };

  const handleSuggestionClick = (address) => {
    selectAddress(address);
    inputRef.current?.focus();
  };

  return (
    <div className={`relative ${className}`} {...props}>
      {label && (
        <Label htmlFor="address-input" className="mb-2">
          {label} {required && <span className="text-destructive">*</span>}
        </Label>
      )}

      <div className="relative">
        <Input
          ref={inputRef}
          id="address-input"
          type="text"
          placeholder={placeholder}
          value={value || query}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          onBlur={handleBlur}
          autoComplete="address-line1"
          role="combobox"
          aria-expanded={isOpen}
          aria-autocomplete="list"
          aria-controls="address-listbox"
          aria-describedby="address-status"
          aria-label="Address line 1"
          required={required}
          className={isLoading ? 'pr-10' : ''}
        />

        {isLoading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <svg
              className="h-4 w-4 animate-spin text-muted-foreground"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M21 12a9 9 0 11-6.219-8.56"/>
            </svg>
          </div>
        )}
      </div>

      {/* Suggestions Dropdown */}
      {isOpen && (
        <div
          ref={listboxRef}
          id="address-listbox"
          role="listbox"
          aria-label="Address suggestions"
          className="absolute top-full left-0 right-0 z-50 mt-1 max-h-60 overflow-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
        >
          {results.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              No addresses found
            </div>
          ) : (
            results.map((result, index) => {
              const isSelected = index === selectedIndex;
              const addressDetails = [result.city, result.state, result.country]
                .filter(Boolean)
                .join(', ');

              return (
                <div
                  key={`${result.label}-${index}`}
                  role="option"
                  aria-selected={isSelected}
                  className={`
                    relative flex cursor-pointer select-none flex-col rounded-sm px-2 py-1.5 text-sm outline-none
                    ${isSelected
                      ? 'bg-accent text-accent-foreground'
                      : 'hover:bg-accent hover:text-accent-foreground'
                    }
                  `}
                  onClick={() => handleSuggestionClick(result)}
                  onMouseEnter={() => {
                    // Optional: update selectedIndex on mouse hover for keyboard users
                  }}
                >
                  <div
                    className="font-medium"
                    dangerouslySetInnerHTML={{
                      __html: highlightMatch(result.label, query)
                    }}
                  />
                  {addressDetails && (
                    <div className="text-xs text-muted-foreground">
                      {addressDetails}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Screen reader status */}
      <div
        id="address-status"
        className="sr-only"
        aria-live="polite"
        aria-atomic="true"
      >
        {status}
      </div>
    </div>
  );
};

export default AddressAutocomplete;