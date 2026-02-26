// API Configuration for Marine Group Invoice System

/**
 * Get the base API URL based on the current environment
 */
export function getApiBaseUrl(): string {
  // In production, use the same domain as the frontend
  if (import.meta.env.PROD) {
    return window.location.origin;
  }

  // In development, use the Vite proxy (empty string = relative URLs)
  return '';
}

/**
 * API endpoints configuration
 */
export const API_ENDPOINTS = {
  // Authentication
  AUTH: {
    LOGIN: '/api/v1/auth/login',
    LOGOUT: '/api/v1/auth/logout',
    CHECK: '/api/v1/auth/check',
    KEEP_ALIVE: '/api/v1/auth/keep-alive',
    REGISTER: '/api/v1/auth/register',
  },

  // CSRF
  CSRF_TOKEN: '/api/v1/csrf-token',

  // Invoices
  INVOICES: '/api/v1/invoice',

  // Customers
  CUSTOMERS: '/api/v1/customers',

  // Vessels
  VESSELS: '/api/v1/vessels',

  // Geo/Address Autocomplete
  GEO: {
    ADDRESS_AUTOCOMPLETE: '/api/geo/address-autocomplete',
  },
} as const;

/**
 * Create a full API URL from an endpoint
 */
export function createApiUrl(endpoint: string): string {
  const baseUrl = getApiBaseUrl();
  return `${baseUrl}${endpoint}`;
}

/**
 * Default fetch options with credentials
 */
export const defaultFetchOptions: RequestInit = {
  credentials: 'include',
  headers: {
    'Content-Type': 'application/json',
  },
};

/**
 * Enhanced fetch wrapper with default options
 */
export async function apiRequest(endpoint: string, options: RequestInit = {}): Promise<Response> {
  const url = createApiUrl(endpoint);

  const mergedOptions: RequestInit = {
    ...defaultFetchOptions,
    ...options,
    headers: {
      ...defaultFetchOptions.headers,
      ...options.headers,
    },
  };

  return fetch(url, mergedOptions);
}