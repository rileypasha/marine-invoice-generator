/**
 * Deep Diff Computation Utility
 *
 * Computes field-level differences between baseline and current invoice states
 * for change request tracking and visual diff display.
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
      changed: Array<{ key: string; deltas: FieldDelta[] }>
    };

export type DiffResult = FieldDelta[];

/**
 * Configuration for diff computation
 */
export interface DiffConfig {
  /** Identity keys for array matching (e.g., ['id', 'description']) */
  arrayIdentityKeys?: string[];
  /** Whether to normalize strings (trim, collapse whitespace) */
  normalizeStrings?: boolean;
  /** Whether to normalize case for string comparisons */
  ignoreCase?: boolean;
  /** Numeric tolerance for floating point comparisons */
  numericTolerance?: number;
}

const DEFAULT_CONFIG: Required<DiffConfig> = {
  arrayIdentityKeys: ['id', 'tempId', 'description'],
  normalizeStrings: true,
  ignoreCase: false,
  numericTolerance: 0.001,
};

/**
 * Normalize a string value for comparison
 */
function normalizeString(value: string, config: Required<DiffConfig>): string {
  if (!config.normalizeStrings) return value;

  let normalized = value.trim().replace(/\s+/g, ' ');
  if (config.ignoreCase) {
    normalized = normalized.toLowerCase();
  }
  return normalized;
}

/**
 * Compare two values for equality with normalization
 */
function areValuesEqual(
  oldVal: any,
  newVal: any,
  config: Required<DiffConfig>
): boolean {
  // Exact equality check
  if (oldVal === newVal) return true;

  // Null/undefined are treated as equal
  if ((oldVal === null || oldVal === undefined) &&
      (newVal === null || newVal === undefined)) {
    return true;
  }

  // Type mismatch
  if (typeof oldVal !== typeof newVal) return false;

  // String comparison with normalization
  if (typeof oldVal === 'string' && typeof newVal === 'string') {
    return normalizeString(oldVal, config) === normalizeString(newVal, config);
  }

  // Numeric comparison with tolerance
  if (typeof oldVal === 'number' && typeof newVal === 'number') {
    return Math.abs(oldVal - newVal) <= config.numericTolerance;
  }

  // Date comparison via ISO strings
  if (oldVal instanceof Date && newVal instanceof Date) {
    return oldVal.toISOString() === newVal.toISOString();
  }

  // Arrays and objects require deep comparison
  if (Array.isArray(oldVal) && Array.isArray(newVal)) {
    return false; // Handled by array diffing logic
  }

  if (typeof oldVal === 'object' && typeof newVal === 'object') {
    return false; // Handled by object diffing logic
  }

  return false;
}

/**
 * Get stable identity for an array item
 */
function getItemIdentity(
  item: any,
  identityKeys: string[]
): string | null {
  if (!item || typeof item !== 'object') return null;

  for (const key of identityKeys) {
    if (item[key] !== undefined && item[key] !== null) {
      return `${key}:${String(item[key])}`;
    }
  }

  // Fallback: create normalized key from all string/number properties
  const keys = Object.keys(item)
    .filter(k => typeof item[k] === 'string' || typeof item[k] === 'number')
    .sort();

  if (keys.length > 0) {
    return keys.map(k => `${k}:${item[k]}`).join('|');
  }

  return null;
}

/**
 * Compute diff for arrays with stable identity matching
 */
function computeArrayDiff(
  oldArray: any[],
  newArray: any[],
  path: string,
  config: Required<DiffConfig>
): FieldDelta | null {
  // Build identity maps
  const oldMap = new Map<string, any>();
  const newMap = new Map<string, any>();
  const oldUnmatched: any[] = [];
  const newUnmatched: any[] = [];

  // Map old items by identity
  for (const item of oldArray) {
    const identity = getItemIdentity(item, config.arrayIdentityKeys);
    if (identity) {
      oldMap.set(identity, item);
    } else {
      oldUnmatched.push(item);
    }
  }

  // Map new items by identity
  for (const item of newArray) {
    const identity = getItemIdentity(item, config.arrayIdentityKeys);
    if (identity) {
      newMap.set(identity, item);
    } else {
      newUnmatched.push(item);
    }
  }

  // Find added, removed, and changed items
  const added: any[] = [];
  const removed: any[] = [];
  const changed: Array<{ key: string; deltas: FieldDelta[] }> = [];

  // Find added items (in new but not old)
  newMap.forEach((newItem, identity) => {
    if (!oldMap.has(identity)) {
      added.push(newItem);
    }
  });

  // Find removed items (in old but not new)
  oldMap.forEach((oldItem, identity) => {
    if (!newMap.has(identity)) {
      removed.push(oldItem);
    }
  });

  // Find changed items (in both but different)
  oldMap.forEach((oldItem, identity) => {
    if (newMap.has(identity)) {
      const newItem = newMap.get(identity)!;
      const itemPath = `${path}[${identity}]`;
      const itemDeltas = computeDiffRecursive(oldItem, newItem, itemPath, config);

      if (itemDeltas.length > 0) {
        changed.push({ key: identity, deltas: itemDeltas });
      }
    }
  });

  // Add unmatched items to added/removed
  added.push(...newUnmatched);
  removed.push(...oldUnmatched);

  // If no changes, return null
  if (added.length === 0 && removed.length === 0 && changed.length === 0) {
    return null;
  }

  return {
    kind: 'array',
    path,
    added,
    removed,
    changed,
  };
}

/**
 * Recursive diff computation
 */
function computeDiffRecursive(
  oldValue: any,
  newValue: any,
  path: string,
  config: Required<DiffConfig>
): FieldDelta[] {
  const deltas: FieldDelta[] = [];

  // Handle null/undefined
  if ((oldValue === null || oldValue === undefined) &&
      (newValue === null || newValue === undefined)) {
    return deltas;
  }

  if ((oldValue === null || oldValue === undefined) &&
      newValue !== null && newValue !== undefined) {
    deltas.push({ kind: 'added', path, newValue });
    return deltas;
  }

  if ((newValue === null || newValue === undefined) &&
      oldValue !== null && oldValue !== undefined) {
    deltas.push({ kind: 'removed', path, oldValue });
    return deltas;
  }

  // Handle arrays
  if (Array.isArray(oldValue) && Array.isArray(newValue)) {
    const arrayDiff = computeArrayDiff(oldValue, newValue, path, config);
    if (arrayDiff) {
      deltas.push(arrayDiff);
    }
    return deltas;
  }

  // Type change
  if (typeof oldValue !== typeof newValue ||
      Array.isArray(oldValue) !== Array.isArray(newValue)) {
    deltas.push({ kind: 'changed', path, oldValue, newValue });
    return deltas;
  }

  // Handle objects
  if (typeof oldValue === 'object' && typeof newValue === 'object' &&
      !Array.isArray(oldValue) && !Array.isArray(newValue)) {
    const oldKeys = Object.keys(oldValue);
    const newKeys = Object.keys(newValue);
    const allKeys = Array.from(new Set([...oldKeys, ...newKeys]));

    allKeys.forEach(key => {
      const fieldPath = path ? `${path}.${key}` : key;
      const oldFieldValue = oldValue[key];
      const newFieldValue = newValue[key];

      const fieldDeltas = computeDiffRecursive(
        oldFieldValue,
        newFieldValue,
        fieldPath,
        config
      );

      deltas.push(...fieldDeltas);
    });

    return deltas;
  }

  // Handle primitives
  if (!areValuesEqual(oldValue, newValue, config)) {
    deltas.push({ kind: 'changed', path, oldValue, newValue });
  }

  return deltas;
}

/**
 * Compute diff between baseline and current state
 *
 * @param baseline - Baseline state (changeRequestSnapshot)
 * @param current - Current state
 * @param config - Diff configuration options
 * @returns Array of field deltas
 */
export function computeDiff(
  baseline: any,
  current: any,
  config: Partial<DiffConfig> = {}
): DiffResult {
  const mergedConfig: Required<DiffConfig> = {
    ...DEFAULT_CONFIG,
    ...config,
  };

  return computeDiffRecursive(baseline, current, '', mergedConfig);
}

/**
 * Check if diff result has any changes
 */
export function hasDifferences(diff: DiffResult): boolean {
  return diff.length > 0;
}

/**
 * Count total number of changes in diff result
 */
export function countChanges(diff: DiffResult): number {
  let count = 0;

  for (const delta of diff) {
    if (delta.kind === 'array') {
      count += delta.added.length + delta.removed.length + delta.changed.length;
    } else {
      count += 1;
    }
  }

  return count;
}