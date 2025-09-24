import * as React from "react";
import { getCountries, getCountryCallingCode } from "react-phone-number-input";
import en from "react-phone-number-input/locale/en.json";
import type { Country } from "react-phone-number-input";
import { ChevronDown, Search } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";

interface CountrySelectProps {
  value?: Country;
  onChange: (country?: Country) => void;
  labels?: { [key: string]: string };
  className?: string;
}

export function CountrySelect({ value, onChange, labels, className }: CountrySelectProps) {
  const [searchTerm, setSearchTerm] = React.useState("");
  const [open, setOpen] = React.useState(false);

  // Get all available countries
  const allCountries = React.useMemo(() => getCountries(), []);

  // Create labels with country names and calling codes
  const countryLabels = React.useMemo(() => {
    const customLabels: { [key: string]: string } = {};
    allCountries.forEach(countryCode => {
      try {
        const countryName = en[countryCode as keyof typeof en] || countryCode;
        const callingCode = getCountryCallingCode(countryCode);
        customLabels[countryCode] = `${countryName} (+${callingCode})`;
      } catch (e) {
        const countryName = en[countryCode as keyof typeof en] || countryCode;
        customLabels[countryCode] = countryName;
      }
    });
    return labels || customLabels;
  }, [labels, allCountries]);

  // Filter countries based on search term
  const filteredCountries = React.useMemo(() => {
    if (!searchTerm) return allCountries;
    return allCountries.filter(country => {
      const label = countryLabels[country]?.toLowerCase() || "";
      return label.includes(searchTerm.toLowerCase());
    });
  }, [allCountries, countryLabels, searchTerm]);

  // Get flag for country
  const getCountryFlag = (country: Country) => {
    try {
      // Convert country code to flag emoji using more reliable method
      if (!country || country.length !== 2) return '🏳️';

      // Ensure uppercase for proper calculation
      const countryUpper = country.toUpperCase();
      const firstLetter = countryUpper.charCodeAt(0) - 0x41 + 0x1F1E6;
      const secondLetter = countryUpper.charCodeAt(1) - 0x41 + 0x1F1E6;
      return String.fromCodePoint(firstLetter, secondLetter);
    } catch {
      return '🏳️';
    }
  };

  // Get selected country display
  const selectedCountryDisplay = value ? (
    <div className="flex items-center gap-2">
      <span className="text-base leading-none">{getCountryFlag(value)}</span>
      <span className="text-sm">
        +{getCountryCallingCode(value)}
      </span>
    </div>
  ) : (
    <span className="text-sm text-muted-foreground">Select country</span>
  );

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={`
            flex items-center justify-between gap-2 px-3 py-2 text-left
            bg-transparent border-none outline-none cursor-pointer
            hover:bg-accent hover:text-accent-foreground
            focus:bg-accent focus:text-accent-foreground
            transition-colors rounded-md min-w-0
            ${className}
          `}
        >
          {selectedCountryDisplay}
          <ChevronDown className="h-4 w-4 opacity-50 flex-shrink-0" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="w-80 max-h-80 overflow-hidden p-0"
        align="start"
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        {/* Search input */}
        <div className="p-2 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search countries..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 h-8"
              autoFocus
            />
          </div>
        </div>

        {/* Countries list */}
        <div className="max-h-60 overflow-y-auto p-1">
          {filteredCountries.length > 0 ? (
            filteredCountries.map((country) => (
              <DropdownMenuItem
                key={country}
                onSelect={() => {
                  onChange(country);
                  setOpen(false);
                  setSearchTerm("");
                }}
                className="flex items-center gap-3 cursor-pointer px-3 py-2"
              >
                <span className="text-base leading-none flex-shrink-0">
                  {getCountryFlag(country)}
                </span>
                <span className="text-sm flex-1 truncate">
                  {countryLabels[country]}
                </span>
                {value === country && (
                  <div className="w-2 h-2 bg-primary rounded-full flex-shrink-0" />
                )}
              </DropdownMenuItem>
            ))
          ) : (
            <div className="px-3 py-2 text-sm text-muted-foreground text-center">
              No countries found
            </div>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}