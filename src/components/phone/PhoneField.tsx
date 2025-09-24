import * as React from "react";
import PhoneInput, { isValidPhoneNumber, getCountryCallingCode, getCountries } from "react-phone-number-input";
import en from "react-phone-number-input/locale/en.json";
import "react-phone-number-input/style.css";
import { Label } from "@/components/ui/label";
import { CountrySelect } from "./CountrySelect";
import type { Country } from "react-phone-number-input";

type Props = {
  label?: string;
  name: string;
  value?: string | null;
  onChange: (val: string | undefined) => void;
  placeholder?: string;
  required?: boolean;
  defaultCountry?: Country;
  disabled?: boolean;
  className?: string;
  error?: string;
};

export function PhoneField({
  label = "Phone Number",
  name,
  value,
  onChange,
  placeholder = "Enter phone number",
  required,
  defaultCountry = "US",
  disabled,
  className = "",
  error,
}: Props) {
  const isValid = !value || isValidPhoneNumber(value);

  // Custom labels to show country name with calling code for ALL countries
  const customLabels = React.useMemo(() => {
    const labels: { [key: string]: string } = {};

    // Get all available countries from the library
    const allCountries = getCountries();

    allCountries.forEach(countryCode => {
      try {
        // Get country name from English locale
        const countryName = en[countryCode as keyof typeof en] || countryCode;
        // Get calling code for this country
        const callingCode = getCountryCallingCode(countryCode);
        // Create label with country name and calling code
        labels[countryCode] = `${countryName} (+${callingCode})`;
      } catch (e) {
        // Fallback to just the country name if calling code fails
        const countryName = en[countryCode as keyof typeof en] || countryCode;
        labels[countryCode] = countryName;
      }
    });

    return labels;
  }, []);

  return (
    <div className={`space-y-2 ${className}`}>
      <Label htmlFor={name}>
        {label} {required ? "*" : null}
      </Label>
      <div
        className={`
          relative rounded-md border transition-colors
          ${isValid && !error ? "border-input" : "border-red-500"}
          ${disabled ? "opacity-50 cursor-not-allowed" : ""}
          focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2
          bg-background
        `}
      >
        <PhoneInput
          id={name}
          name={name}
          international={false}
          countryCallingCodeEditable={false}
          defaultCountry={defaultCountry}
          value={value ?? undefined}
          onChange={onChange}
          placeholder={placeholder}
          disabled={disabled}
          labels={customLabels}
          countrySelectComponent={CountrySelect}
          formatPhoneNumber={(value) => {
            // Format national numbers with parentheses and dashes for display
            if (!value) return value;
            // Clean up the number - remove any non-digits
            const digits = value.replace(/\D/g, '');
            // Apply US-style formatting with parentheses and dashes
            if (digits.length <= 3) return digits;
            if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
            return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
          }}
          numberInputProps={{
            className: "bg-transparent border-none outline-none flex-1 pl-1 pr-3 py-2 text-sm placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50",
          }}
          className="flex items-center w-full"
        />
      </div>
      {error && (
        <p className="text-xs text-red-600">{error}</p>
      )}
    </div>
  );
}