import React from 'react';
import { ChevronDown } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';

export interface ToolbarSelectOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
  count?: number;
}

interface ToolbarSelectProps {
  label: string;
  value: string;
  options: ToolbarSelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  showCounts?: boolean;
  className?: string;
}

export function ToolbarSelect({
  label,
  value,
  options,
  onChange,
  placeholder = "Select...",
  showCounts = false,
  className = ''
}: ToolbarSelectProps) {
  const selectedOption = options.find(option => option.value === value);
  const displayLabel = selectedOption ? selectedOption.label : placeholder;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={`
            inline-flex items-center gap-1.5 h-8 px-3 text-sm
            rounded-md border border-gray-300 bg-white hover:bg-gray-50
            transition-colors duration-200 ease-in-out
            focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500
            ${className}
          `}
          aria-haspopup="menu"
          aria-expanded="false"
        >
          {selectedOption?.icon && (
            <span className="flex-shrink-0">{selectedOption.icon}</span>
          )}
          <span>{displayLabel}</span>
          {selectedOption && showCounts && selectedOption.count !== undefined && (
            <span className="ml-1 px-1.5 py-0.5 rounded-full text-xs font-medium bg-gray-200 text-gray-600">
              {selectedOption.count}
            </span>
          )}
          <ChevronDown className="h-3 w-3 text-gray-500" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[160px]">
        {options.map((option) => (
          <DropdownMenuItem
            key={option.value}
            onClick={() => onChange(option.value)}
            className={`
              flex items-center gap-2 px-3 py-2 text-sm cursor-pointer
              ${value === option.value ? 'bg-gray-100' : ''}
            `}
          >
            {option.icon && (
              <span className="flex-shrink-0">{option.icon}</span>
            )}
            <span className="flex-1">{option.label}</span>
            {showCounts && option.count !== undefined && (
              <span className="text-xs text-gray-500">
                {option.count}
              </span>
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}