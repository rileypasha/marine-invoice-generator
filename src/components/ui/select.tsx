import React, { useState, useEffect, useRef, createContext, useContext } from "react";
import { cn } from "../../lib/utils";

// Context to pass selected value info from Select to SelectValue
interface SelectContextValue {
  selectedLabel?: React.ReactNode;
  hasValue: boolean;
}

const SelectContext = createContext<SelectContextValue>({ hasValue: false });

interface SelectProps {
  children: React.ReactNode;
  onValueChange?: (value: string) => void;
  value?: string;
  disabled?: boolean;
}

interface SelectTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  isOpen?: boolean;
}

interface SelectValueProps {
  placeholder?: string;
  children?: React.ReactNode;
}

interface SelectContentProps {
  className?: string;
  children: React.ReactNode;
  isOpen?: boolean;
  onClose?: () => void;
  onValueChange?: (value: string) => void;
  value?: string;
}

interface SelectItemProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string;
  onSelect?: () => void;
  isSelected?: boolean;
}

function Select({ children, onValueChange, value, disabled }: SelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const selectRef = useRef<HTMLDivElement>(null);

  // Build a value-to-label map from SelectContent > SelectItem children
  const labelMap = new Map<string, React.ReactNode>();
  React.Children.forEach(children, child => {
    if (React.isValidElement(child) && child.type === SelectContent) {
      React.Children.forEach(child.props.children, item => {
        if (React.isValidElement(item) && item.type === SelectItem) {
          labelMap.set(item.props.value, item.props.children);
        }
      });
    }
  });

  const selectedLabel = value ? labelMap.get(value) : undefined;

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (selectRef.current && !selectRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [isOpen]);

  return (
    <SelectContext.Provider value={{ selectedLabel, hasValue: !!value }}>
      <div ref={selectRef} className="relative">
        {React.Children.map(children, child => {
          if (React.isValidElement(child)) {
            if (child.type === SelectTrigger) {
              return React.cloneElement(child, {
                onClick: disabled ? undefined : () => setIsOpen(!isOpen),
                isOpen,
                disabled,
              } as any);
            }
            if (child.type === SelectContent) {
              return React.cloneElement(child, {
                isOpen,
                onClose: () => setIsOpen(false),
                onValueChange,
                value
              } as any);
            }
          }
          return child;
        })}
      </div>
    </SelectContext.Provider>
  );
}

function SelectTrigger({ className, children, onClick, isOpen, ...props }: SelectTriggerProps) {
  return (
    <button
      type="button"
      className={cn(
        "flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      onClick={onClick}
      {...props}
    >
      {children}
      <svg
        className={cn("h-4 w-4 opacity-50 transition-transform", isOpen && "rotate-180")}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    </button>
  );
}

function SelectValue({ placeholder, children }: SelectValueProps) {
  const { selectedLabel, hasValue } = useContext(SelectContext);

  if (React.Children.count(children) > 0) {
    return <>{children}</>;
  }
  if (hasValue && selectedLabel != null) {
    return <span>{selectedLabel}</span>;
  }
  return <span className="text-muted-foreground">{placeholder}</span>;
}

function SelectContent({ className, children, isOpen, onClose, onValueChange, value }: SelectContentProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <div
      className={cn(
        "absolute top-full z-50 mt-1 w-full rounded-md border bg-popover text-popover-foreground shadow-md",
        className
      )}
    >
      <div className="p-1">
        {React.Children.map(children, child => {
          if (React.isValidElement(child) && child.type === SelectItem) {
            return React.cloneElement(child, {
              onSelect: () => {
                onValueChange?.(child.props.value);
                onClose?.();
              },
              isSelected: value === child.props.value
            } as any);
          }
          return child;
        })}
      </div>
    </div>
  );
}

function SelectItem({ className, children, onSelect, isSelected, ...props }: SelectItemProps) {
  return (
    <div
      className={cn(
        "relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground",
        isSelected && "bg-accent text-accent-foreground",
        className
      )}
      onClick={onSelect}
      {...props}
    >
      {isSelected && (
        <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </span>
      )}
      {children}
    </div>
  );
}

export { Select, SelectTrigger, SelectValue, SelectContent, SelectItem };
