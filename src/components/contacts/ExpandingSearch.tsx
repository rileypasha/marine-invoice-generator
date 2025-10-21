import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, X } from 'lucide-react';

interface ExpandingSearchProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  debounceMs?: number;
  autoFocus?: boolean;
}

export function ExpandingSearch({
  value,
  onChange,
  placeholder = 'Search contacts...',
  className = '',
  debounceMs = 250,
  autoFocus = false
}: ExpandingSearchProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [localValue, setLocalValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout>();

  // Debounced onChange
  useEffect(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      onChange(localValue);
    }, debounceMs);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [localValue, onChange, debounceMs]);

  // Sync external value changes
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  // Global keyboard shortcut (Cmd/Ctrl + K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsExpanded(true);
        setTimeout(() => {
          inputRef.current?.focus();
        }, 100);
      }

      // Escape to close
      if (e.key === 'Escape' && isExpanded) {
        setIsExpanded(false);
        inputRef.current?.blur();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isExpanded]);

  // Auto-focus when expanded
  useEffect(() => {
    if (isExpanded && autoFocus) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 150); // Wait for animation
    }
  }, [isExpanded, autoFocus]);

  const handleExpand = () => {
    setIsExpanded(true);
    setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
  };

  const handleCollapse = () => {
    setIsExpanded(false);
    // Don't clear the value on collapse - let it persist
    // Value only clears when user explicitly clicks the X button
    inputRef.current?.blur();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalValue(e.target.value);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      handleCollapse();
    }
  };

  const handleClear = () => {
    setLocalValue('');
    inputRef.current?.focus();
  };

  return (
    <div className={`flex items-center ${className}`}>
      <div
        className={`
          flex items-center rounded-md transition-all duration-300 ease-in-out overflow-hidden
          ${isExpanded
            ? 'w-56 bg-white'
            : 'w-8 bg-white hover:bg-gray-100 cursor-pointer'
          }
        `}
        onClick={!isExpanded ? handleExpand : undefined}
      >
        <input
          ref={inputRef}
          type="text"
          value={localValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder={isExpanded ? placeholder : ''}
          disabled={!isExpanded}
          className={`
            flex-1 h-8 outline-none transition-all duration-300 bg-transparent text-gray-900 text-sm
            ${isExpanded ? 'opacity-100 px-3' : 'opacity-0 w-0 px-0'}
          `}
        />

        {/* Search/Clear button */}
        <div className="flex items-center">
          {isExpanded && localValue && (
            <button
              onClick={handleClear}
              className="h-8 w-8 flex items-center justify-center flex-shrink-0 hover:bg-gray-100 transition-colors"
              type="button"
              aria-label="Clear search"
            >
              <X className="h-3 w-3 text-gray-500" />
            </button>
          )}

          <button
            onClick={isExpanded ? handleCollapse : handleExpand}
            className="h-8 w-8 flex items-center justify-center flex-shrink-0 hover:bg-gray-100 transition-colors"
            type="button"
            aria-label={isExpanded ? 'Close search' : 'Open search'}
            title={isExpanded ? 'Close search (Esc)' : 'Search contacts (⌘K)'}
          >
            <Search className="h-3 w-3 text-gray-600" />
          </button>
        </div>
      </div>

    </div>
  );
}