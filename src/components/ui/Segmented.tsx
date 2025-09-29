import React from 'react';

interface SegmentedOption {
  id: string;
  label: string;
  icon?: React.ReactElement;
}

interface SegmentedProps {
  options: SegmentedOption[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export default function Segmented({ options, value, onChange, className = '' }: SegmentedProps) {
  return (
    <div
      role="tablist"
      className={`inline-flex rounded-md border bg-white overflow-hidden ${className}`}
    >
      {options.map(option => (
        <button
          key={option.id}
          role="tab"
          aria-selected={value === option.id}
          onClick={() => onChange(option.id)}
          className={`h-8 px-3 text-sm flex items-center gap-1 transition-colors ${
            value === option.id
              ? 'bg-neutral-100 font-medium'
              : 'hover:bg-neutral-50'
          }`}
        >
          {option.icon}
          {option.label}
        </button>
      ))}
    </div>
  );
}