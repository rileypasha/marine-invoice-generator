import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Utility function to merge CSS classes using clsx and tailwind-merge
 * This ensures that Tailwind classes are properly merged and duplicates are resolved
 * @param {...import("clsx").ClassValue} inputs - Class values to merge
 * @returns {string} Merged class names
 */
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

/**
 * Utility function to get the current active navigation item based on pathname
 * @param {string} pathname - Current pathname
 * @returns {string} Active navigation key
 */
export function getActiveNavFromPath(pathname) {
  if (pathname.includes('/customers')) return 'customers';
  if (pathname.includes('/vessels')) return 'vessels';
  if (pathname.includes('/settings')) return 'settings';
  return 'invoices'; // Default to invoices
}

/**
 * Utility function to check if device is mobile based on window width
 * @returns {boolean} True if mobile device
 */
export function isMobileDevice() {
  return typeof window !== 'undefined' && window.innerWidth < 768;
}