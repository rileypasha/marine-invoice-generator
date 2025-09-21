import { useState, useEffect, useRef, useCallback } from 'react';

export const useAddressAutocomplete = ({
  minChars = 3,
  debounceMs = 300,
  maxResults = 5,
  onSelect,
  onError,
  apiEndpoint = '/api/geo/address-autocomplete'
} = {}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [status, setStatus] = useState('');

  const debounceTimerRef = useRef(null);
  const controllerRef = useRef(null);

  const searchAddresses = useCallback(async (searchQuery) => {
    if (!searchQuery || searchQuery.length < minChars) return;

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
        limit: maxResults,
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

      const searchResults = await response.json();
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
      if (error.name === 'AbortError') {
        return;
      }

      console.error('Address search error:', error);
      onError?.(error);
      setStatus('Address search failed. Please try again.');
      setResults([]);
      setIsOpen(false);
    } finally {
      setIsLoading(false);
    }
  }, [minChars, maxResults, apiEndpoint, onError]);

  const handleInputChange = useCallback((value) => {
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

    // Debounce the search
    debounceTimerRef.current = setTimeout(() => {
      searchAddresses(value);
    }, debounceMs);
  }, [minChars, debounceMs, searchAddresses]);

  const handleKeyDown = useCallback((e) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        if (!isOpen && query.length >= minChars) {
          searchAddresses(query);
        } else if (isOpen && results.length > 0) {
          setSelectedIndex(prev => Math.min(prev + 1, results.length - 1));
        }
        break;

      case 'ArrowUp':
        e.preventDefault();
        if (isOpen && results.length > 0) {
          setSelectedIndex(prev => Math.max(prev - 1, -1));
        }
        break;

      case 'Enter':
        e.preventDefault();
        if (isOpen && selectedIndex >= 0 && results[selectedIndex]) {
          selectAddress(results[selectedIndex]);
        }
        break;

      case 'Escape':
        setIsOpen(false);
        setSelectedIndex(-1);
        break;

      case 'Tab':
        setIsOpen(false);
        break;
    }
  }, [isOpen, query, minChars, selectedIndex, results, searchAddresses]);

  const selectAddress = useCallback((address) => {
    setQuery(address.label);
    setIsOpen(false);
    setSelectedIndex(-1);
    setStatus(`Selected: ${address.label}`);
    onSelect?.(address);
  }, [onSelect]);

  const highlightMatch = useCallback((text, searchQuery) => {
    if (!searchQuery) return text;

    const regex = new RegExp(`(${searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return text.replace(regex, '<mark>$1</mark>');
  }, []);

  const clear = useCallback(() => {
    setQuery('');
    setResults([]);
    setIsOpen(false);
    setSelectedIndex(-1);
    setStatus('');
    setIsLoading(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      if (controllerRef.current) {
        controllerRef.current.abort();
      }
    };
  }, []);

  return {
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
    clear,
    setIsOpen,
    searchAddresses: () => searchAddresses(query)
  };
};