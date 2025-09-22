import { useState, useRef, useCallback } from 'react';

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

interface UseAddressAutocompleteOptions {
  minChars?: number;
  debounceMs?: number;
  maxResults?: number;
  onSelect?: (address: AddressResult) => void;
  onError?: (error: Error) => void;
  apiEndpoint?: string;
}

export const useAddressAutocomplete = ({
  minChars = 3,
  debounceMs = 300,
  maxResults = 5,
  onSelect,
  onError,
  apiEndpoint = '/api/geo/address-autocomplete'
}: UseAddressAutocompleteOptions = {}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<AddressResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [status, setStatus] = useState('');

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  const searchAddresses = useCallback(async (searchQuery: string) => {
    if (!searchQuery || searchQuery.length < minChars) {
      return;
    }

    try {
      setIsLoading(true);
      setStatus('Searching for addresses...');

      // Abort previous request
      if (controllerRef.current) {
        controllerRef.current.abort();
      }

      // Create new abort controller
      controllerRef.current = new AbortController();

      const params = new URLSearchParams({
        query: searchQuery,
        limit: maxResults.toString(),
        lang: 'en'
      });

      const response = await fetch(`${apiEndpoint}?${params}`, {
        signal: controllerRef.current.signal,
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }

      const searchResults: AddressResult[] = await response.json();
      setResults(searchResults || []);
      setSelectedIndex(-1);

      if (searchResults.length === 0) {
        setStatus('No addresses found. Try a different search.');
        setIsOpen(true);
      } else {
        setStatus(`${searchResults.length} address${searchResults.length === 1 ? '' : 'es'} found. Use arrow keys to navigate.`);
        setIsOpen(true);
      }

    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return;
      }

      console.error('Address search error:', error);
      onError?.(error as Error);
      setStatus('Address search failed. Please try again.');
      setResults([]);
      setIsOpen(false);
    } finally {
      setIsLoading(false);
    }
  }, [minChars, maxResults, apiEndpoint, onError]);

  const handleInputChange = useCallback((value: string) => {
    setQuery(value);

    // Clear existing debounce timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Abort any pending request
    if (controllerRef.current) {
      controllerRef.current.abort();
    }

    if (value.length < minChars) {
      setIsOpen(false);
      setResults([]);
      setStatus('');
      return;
    }

    // Set up new debounce timer
    debounceTimerRef.current = setTimeout(() => {
      searchAddresses(value);
    }, debounceMs);
  }, [minChars, debounceMs, searchAddresses]);

  const handleSelectAddress = useCallback((address: AddressResult) => {
    setQuery(address.formatted);
    setIsOpen(false);
    setResults([]);
    setSelectedIndex(-1);
    setStatus('');
    onSelect?.(address);
  }, [onSelect]);

  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (!isOpen || results.length === 0) return;

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        setSelectedIndex(prev =>
          prev < results.length - 1 ? prev + 1 : 0
        );
        break;

      case 'ArrowUp':
        event.preventDefault();
        setSelectedIndex(prev =>
          prev > 0 ? prev - 1 : results.length - 1
        );
        break;

      case 'Enter':
        event.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < results.length) {
          handleSelectAddress(results[selectedIndex]);
        }
        break;

      case 'Escape':
        setIsOpen(false);
        setSelectedIndex(-1);
        break;
    }
  }, [isOpen, results, selectedIndex, handleSelectAddress]);

  const clearResults = useCallback(() => {
    setIsOpen(false);
    setResults([]);
    setSelectedIndex(-1);
    setStatus('');

    // Abort any pending request
    if (controllerRef.current) {
      controllerRef.current.abort();
    }

    // Clear debounce timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
  }, []);

  return {
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
  };
};