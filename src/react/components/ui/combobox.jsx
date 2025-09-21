import React, { useState, useRef, useEffect } from 'react';
import { cn } from './utils.js';

export const Combobox = ({
  children,
  open,
  onOpenChange,
  className,
  ...props
}) => {
  return (
    <div className={cn('relative', className)} {...props}>
      {children}
    </div>
  );
};

export const ComboboxTrigger = React.forwardRef(({
  children,
  className,
  asChild = false,
  ...props
}, ref) => {
  if (asChild) {
    return React.cloneElement(children, {
      ref,
      className: cn(children.props.className, className),
      ...props
    });
  }

  return (
    <button
      ref={ref}
      className={cn(
        "flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    >
      {children}
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className="h-4 w-4 opacity-50"
      >
        <path d="M6 9l6 6 6-6"/>
      </svg>
    </button>
  );
});

export const ComboboxInput = React.forwardRef(({
  className,
  ...props
}, ref) => {
  return (
    <input
      ref={ref}
      className={cn(
        "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  );
});

export const ComboboxContent = ({
  children,
  className,
  open,
  ...props
}) => {
  if (!open) return null;

  return (
    <div
      className={cn(
        "absolute top-full z-50 w-full rounded-md border bg-popover p-0 text-popover-foreground shadow-md outline-none animate-in fade-in-0 zoom-in-95",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};

export const ComboboxList = ({
  children,
  className,
  ...props
}) => {
  return (
    <ul
      className={cn(
        "max-h-60 overflow-auto p-1",
        className
      )}
      role="listbox"
      {...props}
    >
      {children}
    </ul>
  );
};

export const ComboboxItem = React.forwardRef(({
  children,
  className,
  selected = false,
  ...props
}, ref) => {
  return (
    <li
      ref={ref}
      className={cn(
        "relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        selected && "bg-accent text-accent-foreground",
        className
      )}
      role="option"
      aria-selected={selected}
      {...props}
    >
      {children}
    </li>
  );
});

export const ComboboxEmpty = ({
  children,
  className,
  ...props
}) => {
  return (
    <div
      className={cn(
        "py-6 text-center text-sm text-muted-foreground",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};

export const ComboboxLoading = ({
  children,
  className,
  ...props
}) => {
  return (
    <div
      className={cn(
        "flex items-center justify-center py-6 text-sm text-muted-foreground",
        className
      )}
      {...props}
    >
      <svg className="mr-2 h-4 w-4 animate-spin" viewBox="0 0 24 24">
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
          fill="none"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
      {children}
    </div>
  );
};