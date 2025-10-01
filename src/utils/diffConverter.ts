/**
 * Diff Format Converter
 *
 * Converts FieldDelta format (from computeDiff.ts) to RFC-6902 PatchOperation format
 * (expected by ChangedValue component).
 */

import { PatchOperation } from '../types/diff.types';

/**
 * FieldDelta type from backend computeDiff utility
 */
export type FieldDelta =
  | { kind: 'added'; path: string; newValue: any }
  | { kind: 'removed'; path: string; oldValue: any }
  | { kind: 'changed'; path: string; oldValue: any; newValue: any }
  | {
      kind: 'array';
      path: string;
      added: any[];
      removed: any[];
      changed: Array<{ key: string; deltas: FieldDelta[] }>;
    };

/**
 * Convert FieldDelta array to RFC-6902 PatchOperation array
 *
 * @param deltas - Array of FieldDelta objects from backend
 * @returns Array of PatchOperation objects for frontend consumption
 */
export function convertFieldDeltaToPatch(
  deltas: FieldDelta[] | null | undefined
): PatchOperation[] {
  if (!deltas || !Array.isArray(deltas)) {
    return [];
  }

  const patches: PatchOperation[] = [];

  for (const delta of deltas) {
    if (delta.kind === 'added') {
      patches.push({
        op: 'add',
        path: ensureLeadingSlash(delta.path),
        value: delta.newValue,
      });
    } else if (delta.kind === 'removed') {
      patches.push({
        op: 'remove',
        path: ensureLeadingSlash(delta.path),
        value: delta.oldValue,
      });
    } else if (delta.kind === 'changed') {
      patches.push({
        op: 'replace',
        path: ensureLeadingSlash(delta.path),
        value: delta.oldValue, // Store old value for display
      });
    } else if (delta.kind === 'array') {
      // Handle array deltas
      const basePath = ensureLeadingSlash(delta.path);

      // Add items - mark each added item
      for (let i = 0; i < delta.added.length; i++) {
        const addedItem = delta.added[i];
        // Try to find the item's ID to create a more specific path
        const itemId = addedItem?.id || addedItem?.tempId;
        patches.push({
          op: 'add',
          path: `${basePath}/-`,
          value: addedItem,
        });

        // Also add patches for each field in the added item
        if (addedItem && typeof addedItem === 'object') {
          Object.keys(addedItem).forEach((key) => {
            patches.push({
              op: 'add',
              path: `${basePath}/-/${key}`,
              value: addedItem[key],
            });
          });
        }
      }

      // Remove items
      for (const removedItem of delta.removed) {
        patches.push({
          op: 'remove',
          path: `${basePath}/-`,
          value: removedItem,
        });
      }

      // Changed items - recursively convert nested deltas
      for (const changedItem of delta.changed) {
        const nestedPatches = convertFieldDeltaToPatch(changedItem.deltas);
        patches.push(...nestedPatches);
      }
    }
  }

  return patches;
}

/**
 * Normalize path from backend FieldDelta format to JSON Pointer format
 *
 * Handles:
 * - Dot notation → slash notation (scope.lineItems → /scope/lineItems)
 * - Identity keys → numeric indices ([id:xyz] → /0, /1, etc)
 * - Data structure mapping (scope.lineItems → /services)
 *
 * @param path - Path from backend FieldDelta (e.g., "scope.lineItems[id:xyz].description")
 * @param invoiceData - Current invoice data for resolving array indices
 * @returns JSON Pointer path (e.g., "/services/0/description")
 */
function normalizePath(path: string, invoiceData?: any): string {
  if (!path) return '/';

  // If already in JSON Pointer format, return as-is
  if (path.startsWith('/')) return path;

  // Convert dot notation to slash notation
  let normalizedPath = path.replace(/\./g, '/');

  // Map backend field names to frontend field names
  normalizedPath = normalizedPath.replace(/^scope\/lineItems/, 'services');

  // Handle identity-based array indices like [id:xyz]
  // For now, we'll strip them and let the frontend handle by position
  // TODO: Implement proper identity-to-index resolution using invoiceData
  normalizedPath = normalizedPath.replace(/\[id:[^\]]+\]/g, '/-');
  normalizedPath = normalizedPath.replace(/\[tempId:[^\]]+\]/g, '/-');
  normalizedPath = normalizedPath.replace(/\[description:[^\]]+\]/g, '/-');

  // Ensure leading slash
  if (!normalizedPath.startsWith('/')) {
    normalizedPath = '/' + normalizedPath;
  }

  return normalizedPath;
}

/**
 * Ensure path has leading slash for RFC-6902 compliance
 */
function ensureLeadingSlash(path: string): string {
  return normalizePath(path);
}

/**
 * Helper to check if a value is a FieldDelta array
 */
export function isFieldDeltaFormat(data: any): data is FieldDelta[] {
  if (!Array.isArray(data)) return false;
  if (data.length === 0) return true; // Empty array is valid

  // Check if first item has FieldDelta shape
  const firstItem = data[0];
  return (
    firstItem &&
    typeof firstItem === 'object' &&
    'kind' in firstItem &&
    'path' in firstItem &&
    (firstItem.kind === 'added' ||
      firstItem.kind === 'removed' ||
      firstItem.kind === 'changed' ||
      firstItem.kind === 'array')
  );
}

/**
 * Helper to check if a value is a PatchOperation array
 */
export function isPatchOperationFormat(data: any): data is PatchOperation[] {
  if (!Array.isArray(data)) return false;
  if (data.length === 0) return true; // Empty array is valid

  // Check if first item has PatchOperation shape
  const firstItem = data[0];
  return (
    firstItem &&
    typeof firstItem === 'object' &&
    'op' in firstItem &&
    'path' in firstItem &&
    (firstItem.op === 'add' ||
      firstItem.op === 'remove' ||
      firstItem.op === 'replace' ||
      firstItem.op === 'copy' ||
      firstItem.op === 'move' ||
      firstItem.op === 'test')
  );
}