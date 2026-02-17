import React, { useState, useRef, useEffect } from 'react';

interface SelectProps {
  value?: string | number;
  onValueChange?: (value: string) => void;
  disabled?: boolean;
  children: React.ReactNode;
}

interface SelectTriggerProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  id?: string;
  style?: React.CSSProperties;
  disabled?: boolean;
}

interface SelectValueProps {
  placeholder?: string;
}

interface SelectContentProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

interface SelectItemProps {
  value: string | number;
  children: React.ReactNode;
  onSelect?: (value: string) => void;
}

const SelectContext = React.createContext<{
  value?: string | number;
  onValueChange?: (value: string) => void;
  open: boolean;
  setOpen: (open: boolean) => void;
  selectedText: string;
  setSelectedText: (text: string) => void;
}>({
  open: false,
  setOpen: () => {},
  selectedText: '',
  setSelectedText: () => {}
});

export const Select: React.FC<SelectProps> = ({ value, onValueChange, children }) => {
  const [open, setOpen] = useState(false);
  const [selectedText, setSelectedText] = useState('');

  return (
    <SelectContext.Provider value={{
      value,
      onValueChange,
      open,
      setOpen,
      selectedText,
      setSelectedText
    }}>
      <div className="relative">
        {children}
      </div>
    </SelectContext.Provider>
  );
};

export const SelectTrigger: React.FC<SelectTriggerProps> = ({ children, className = '', onClick, id, style, disabled }) => {
  const { open, setOpen } = React.useContext(SelectContext);

  return (
    <button
      id={id}
      type="button"
      style={style}
      disabled={disabled}
      className={`flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      onClick={() => {
        if (disabled) return;
        setOpen(!open);
        onClick?.();
      }}
    >
      {children}
      <svg
        className={`h-4 w-4 opacity-50 transition-transform ${open ? 'rotate-180' : ''}`}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m6 9 6 6 6-6" />
      </svg>
    </button>
  );
};

export const SelectValue: React.FC<SelectValueProps> = ({ placeholder = 'Select...' }) => {
  const { value, selectedText } = React.useContext(SelectContext);

  return (
    <span className={!value ? 'text-muted-foreground' : ''}>
      {selectedText || value || placeholder}
    </span>
  );
};

export const SelectContent: React.FC<SelectContentProps> = ({ children, className = '', style }) => {
  const { open, setOpen } = React.useContext(SelectContext);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      const handleClickOutside = (event: MouseEvent) => {
        if (contentRef.current && !contentRef.current.contains(event.target as Node)) {
          setOpen(false);
        }
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [open, setOpen]);

  if (!open) return null;

  return (
    <div
      ref={contentRef}
      className={`absolute top-full left-0 right-0 z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md ${className}`}
      style={style}
    >
      <div className="p-1">
        {children}
      </div>
    </div>
  );
};

export const SelectItem: React.FC<SelectItemProps> = ({ value, children, onSelect }) => {
  const { onValueChange, setOpen, setSelectedText } = React.useContext(SelectContext);

  const handleSelect = () => {
    onValueChange?.(String(value));
    setSelectedText(typeof children === 'string' ? children : String(value));
    setOpen(false);
    onSelect?.(String(value));
  };

  return (
    <div
      className="relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
      onClick={handleSelect}
    >
      {children}
    </div>
  );
};
