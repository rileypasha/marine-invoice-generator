export function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
}

export function formatPercentage(value) {
  return `${value.toFixed(2)}%`;
}

export function formatPhoneNumber(phone) {
  // Ensure phone is a string
  const phoneString = phone != null ? String(phone) : '';
  const cleaned = phoneString.replace(/\D/g, '');
  
  if (cleaned.length === 0) {
    return '';
  } else if (cleaned.length <= 3) {
    return `(${cleaned}`;
  } else if (cleaned.length <= 6) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3)}`;
  } else if (cleaned.length <= 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  
  // If more than 10 digits, truncate
  return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6, 10)}`;
}

export function formatDate(date = new Date()) {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }).format(date);
}

export function parseNumber(value) {
  const parsed = parseFloat(value);
  return isNaN(parsed) ? 0 : parsed;
}

export function formatCurrencyInput(value) {
  // Ensure value is a string
  const stringValue = value != null ? String(value) : '';
  
  // Remove any non-digit characters except decimal point
  const cleanedValue = stringValue.replace(/[^\d.]/g, '');
  
  // Handle empty or invalid input
  if (!cleanedValue || cleanedValue === '.') {
    return '';
  }
  
  // Ensure only one decimal point
  const parts = cleanedValue.split('.');
  if (parts.length > 2) {
    return parts[0] + '.' + parts.slice(1).join('');
  }
  
  // Parse the number
  const num = parseFloat(cleanedValue);
  if (isNaN(num)) {
    return '';
  }
  
  // Format with commas for thousands separator
  const formatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format(num);
  
  // Add dollar sign
  return '$' + formatted;
}

export function parseCurrencyInput(formattedValue) {
  // Remove dollar sign and commas, keep only digits and decimal point
  return formattedValue.replace(/[$,]/g, '');
}