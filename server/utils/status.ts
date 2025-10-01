/**
 * Status Normalization Utilities
 *
 * Handles variations in status string formats for change request tracking.
 * Supports both "Change Requested" and "Changes Requested" variants.
 */

/**
 * Check if a status indicates a change request state
 *
 * Normalizes and checks for both singular and plural forms:
 * - "change_requested"
 * - "Change Requested"
 * - "Changes Requested"
 * - "CHANGE_REQUESTED"
 * - etc.
 *
 * @param status - Status string to check
 * @returns True if status indicates change requested state
 */
export function isChangeRequested(status?: string | null): boolean {
  if (!status) return false;

  // Normalize: trim, lowercase, convert spaces/hyphens to underscores
  const normalized = status
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');

  return (
    normalized === 'change_requested' ||
    normalized === 'changes_requested'
  );
}

/**
 * Normalize status string to canonical database format
 *
 * @param status - Status string to normalize
 * @returns Normalized status string or original if not change request
 */
export function normalizeStatus(status: string): string {
  if (isChangeRequested(status)) {
    return 'change_requested';
  }
  return status;
}