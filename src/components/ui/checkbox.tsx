"use client"

import * as React from "react"
import { Check, Minus } from "lucide-react"
import { cn } from "@/lib/utils"

interface CheckboxProps {
  checked?: boolean | "indeterminate"
  onCheckedChange?: (checked: boolean) => void
  className?: string
  disabled?: boolean
  "aria-label"?: string
}

// Simple Checkbox component compatible with TanStack Table
const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, checked, onCheckedChange, disabled, "aria-label": ariaLabel, ...props }, ref) => {
    const isIndeterminate = checked === "indeterminate"
    const isChecked = checked === true

    return (
      <div className="relative">
        <input
          type="checkbox"
          ref={ref}
          className="sr-only"
          checked={isChecked}
          disabled={disabled}
          onChange={(e) => onCheckedChange?.(e.target.checked)}
          aria-label={ariaLabel}
          {...props}
        />
        <div
          className={cn(
            "h-4 w-4 shrink-0 rounded-sm border border-gray-300 bg-white shadow-sm cursor-pointer",
            "flex items-center justify-center transition-colors",
            "hover:border-gray-400",
            isChecked && "bg-blue-600 border-blue-600 text-white",
            isIndeterminate && "bg-blue-600 border-blue-600 text-white",
            disabled && "opacity-50 cursor-not-allowed",
            className
          )}
          onClick={() => !disabled && onCheckedChange?.(!isChecked)}
        >
          {isIndeterminate ? (
            <Minus className="h-3 w-3" />
          ) : isChecked ? (
            <Check className="h-3 w-3" />
          ) : null}
        </div>
      </div>
    )
  }
)
Checkbox.displayName = "Checkbox"

export { Checkbox }