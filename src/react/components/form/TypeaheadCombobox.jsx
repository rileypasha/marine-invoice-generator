import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Combobox,
  ComboboxInput,
  ComboboxContent,
  ComboboxList,
  ComboboxItem,
  ComboboxEmpty,
  ComboboxLoading
} from '../ui/combobox.jsx';

export const TypeaheadCombobox = ({
  apiEndpoint,
  searchParam = 'query',
  debounceMs = 200,
  minChars = 2,
  maxResults = 10,
  placeholder = 'Start typing to search...',
  emptyMessage = 'No results found',
  loadingMessage = 'Searching...',
  errorMessage = 'Search failed. Please try again.',
  displayField = 'display_name',
  valueField = 'id',
  onSelect,
  onError,
  formatItem,
  allowCreate = false,
  createLabel = 'Create new',
  value = '',
  onChange,
  className,
  ...props
}) => {
  const [inputValue, setInputValue] = useState(value);
  const [items, setItems] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [error, setError] = useState(null);

  const inputRef = useRef(null);
  const debounceTimerRef = useRef(null);
  const currentRequestRef = useRef(null);

  const search = useCallback(async (query) => {
    try {
      setError(null);

      // Cancel previous request
      if (currentRequestRef.current) {
        currentRequestRef.current.abort();
      }

      // Create new request
      const controller = new AbortController();
      currentRequestRef.current = controller;

      const url = new URL(apiEndpoint, window.location.origin);
      url.searchParams.set(searchParam, query);
      url.searchParams.set('limit', maxResults);

      const response = await fetch(url, {
        signal: controller.signal,
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Search failed: ${response.status}`);
      }

      const data = await response.json();
      const results = data.customers || data.items || [];
      setItems(results);
      setIsOpen(true);
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('TypeaheadCombobox search error:', err);
        setError(errorMessage);
        onError?.(err);
      }
    } finally {
      setIsLoading(false);
      currentRequestRef.current = null;
    }
  }, [apiEndpoint, searchParam, maxResults, errorMessage, onError]);

  const handleInputChange = (e) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    onChange?.(newValue);

    // Clear previous debounce
    clearTimeout(debounceTimerRef.current);

    if (newValue.length < minChars) {
      setIsOpen(false);
      return;
    }

    // Set loading state
    setIsLoading(true);
    setSelectedIndex(-1);

    // Debounce search
    debounceTimerRef.current = setTimeout(() => {
      search(newValue);
    }, debounceMs);
  };

  const handleKeyDown = (e) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        if (inputValue.length >= minChars) {
          setIsOpen(true);
        }
        e.preventDefault();
      }
      return;
    }

    const totalItems = items.length + (allowCreate && inputValue.trim() ? 1 : 0);

    switch (e.key) {
      case 'ArrowDown':
        setSelectedIndex(prev => (prev + 1) % totalItems);
        e.preventDefault();
        break;
      case 'ArrowUp':
        setSelectedIndex(prev => prev <= 0 ? totalItems - 1 : prev - 1);
        e.preventDefault();
        break;
      case 'Enter':
        if (selectedIndex >= 0) {
          if (selectedIndex < items.length) {
            selectItem(items[selectedIndex]);
          } else if (allowCreate && inputValue.trim()) {
            selectCreateOption();
          }
        }
        e.preventDefault();
        break;
      case 'Escape':
        setIsOpen(false);
        setSelectedIndex(-1);
        e.preventDefault();
        break;
      case 'Tab':
        setIsOpen(false);
        break;
    }
  };

  const selectItem = (item) => {
    const displayText = item[displayField] || item.name || item.label;
    setInputValue(displayText);
    setIsOpen(false);
    setSelectedIndex(-1);
    onSelect?.(item);
  };

  const selectCreateOption = () => {
    const newValue = inputValue.trim();
    setIsOpen(false);
    setSelectedIndex(-1);
    onSelect?.({
      [displayField]: newValue,
      _isNew: true
    });
  };

  const handleFocus = () => {
    if (inputValue.length >= minChars && items.length > 0) {
      setIsOpen(true);
    }
  };

  const handleBlur = (e) => {
    // Delay hiding to allow for clicks on listbox items
    setTimeout(() => {
      if (!e.currentTarget.contains(document.activeElement)) {
        setIsOpen(false);
        setSelectedIndex(-1);
      }
    }, 100);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearTimeout(debounceTimerRef.current);
      if (currentRequestRef.current) {
        currentRequestRef.current.abort();
      }
    };
  }, []);

  // Update input value when external value changes
  useEffect(() => {
    setInputValue(value);
  }, [value]);

  const showCreateOption = allowCreate && inputValue.trim() && isOpen;
  const totalItems = items.length + (showCreateOption ? 1 : 0);

  return (
    <Combobox
      open={isOpen}
      onOpenChange={setIsOpen}
      className={className}
      {...props}
    >
      <ComboboxInput
        ref={inputRef}
        placeholder={placeholder}
        value={inputValue}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        onFocus={handleFocus}
        onBlur={handleBlur}
        autoComplete="off"
        autoCapitalize="off"
        spellCheck="false"
        role="combobox"
        aria-expanded={isOpen}
        aria-autocomplete="list"
        aria-describedby={error ? 'combobox-error' : undefined}
      />

      <ComboboxContent open={isOpen}>
        {isLoading ? (
          <ComboboxLoading>{loadingMessage}</ComboboxLoading>
        ) : error ? (
          <ComboboxEmpty id="combobox-error">{error}</ComboboxEmpty>
        ) : items.length === 0 && !showCreateOption ? (
          <ComboboxEmpty>{emptyMessage}</ComboboxEmpty>
        ) : (
          <ComboboxList>
            {items.map((item, index) => {
              const displayText = item[displayField] || item.name || item.label;
              return (
                <ComboboxItem
                  key={item[valueField] || index}
                  selected={selectedIndex === index}
                  onClick={() => selectItem(item)}
                >
                  {formatItem ? formatItem(item) : displayText}
                </ComboboxItem>
              );
            })}

            {showCreateOption && (
              <ComboboxItem
                selected={selectedIndex === items.length}
                onClick={selectCreateOption}
                className="border-t"
              >
                <div className="flex items-center">
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="mr-2 h-4 w-4"
                  >
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="12" y1="8" x2="12" y2="16"/>
                    <line x1="8" y1="12" x2="16" y2="12"/>
                  </svg>
                  {createLabel}: "{inputValue.trim()}"
                </div>
              </ComboboxItem>
            )}
          </ComboboxList>
        )}
      </ComboboxContent>
    </Combobox>
  );
};

export default TypeaheadCombobox;