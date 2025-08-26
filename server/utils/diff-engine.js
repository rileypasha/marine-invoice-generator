/**
 * Diff Engine for Invoice Change Tracking
 * Computes differences between invoice versions
 */

const DiffMatchPatch = require('diff-match-patch');
const { normalizeInvoice, normalizeLineItems } = require('./invoice-normalizer');

// Initialize text diff library
const dmp = new DiffMatchPatch();
dmp.Diff_Timeout = 1; // 1 second timeout for diff computation

/**
 * Compare two invoice versions and generate diff
 * @param {Object} baseline - Original submitted invoice
 * @param {Object} current - Current invoice version
 * @returns {Object} Diff result with changes array
 */
function computeInvoiceDiff(baseline, current) {
  // Normalize both versions
  const normalizedBaseline = normalizeInvoice(baseline);
  const normalizedCurrent = normalizeInvoice(current);
  
  const changes = [];
  const summary = {
    additions: 0,
    removals: 0,
    modifications: 0
  };
  
  // Deep diff the normalized objects
  diffObjects(normalizedBaseline, normalizedCurrent, '', changes, summary);
  
  return {
    summary,
    changes: changes.sort((a, b) => {
      // Sort by path for consistent display
      return a.path.localeCompare(b.path);
    })
  };
}

/**
 * Recursively diff two objects
 */
function diffObjects(baseline, current, path, changes, summary) {
  // Handle null/undefined
  if (baseline === null || baseline === undefined) {
    if (current !== null && current !== undefined && current !== '') {
      changes.push({
        type: 'added',
        path: path || 'root',
        new: current
      });
      summary.additions++;
    }
    return;
  }
  
  if (current === null || current === undefined || current === '') {
    if (baseline !== null && baseline !== undefined && baseline !== '') {
      changes.push({
        type: 'removed',
        path: path || 'root',
        old: baseline
      });
      summary.removals++;
    }
    return;
  }
  
  // Handle different types
  const baselineType = getType(baseline);
  const currentType = getType(current);
  
  if (baselineType !== currentType) {
    changes.push({
      type: 'changed',
      path: path || 'root',
      old: baseline,
      new: current
    });
    summary.modifications++;
    return;
  }
  
  // Handle primitives
  if (baselineType === 'primitive') {
    if (baseline !== current) {
      // Special handling for long text
      if (typeof baseline === 'string' && typeof current === 'string' && 
          (baseline.length > 100 || current.length > 100)) {
        const textDiff = computeTextDiff(baseline, current);
        changes.push({
          type: 'changed',
          path: path || 'root',
          old: baseline,
          new: current,
          textDiff
        });
      } else {
        changes.push({
          type: 'changed',
          path: path || 'root',
          old: baseline,
          new: current
        });
      }
      summary.modifications++;
    }
    return;
  }
  
  // Handle arrays (special logic for line items)
  if (baselineType === 'array') {
    if (path.includes('lineItems') || path.includes('items')) {
      diffLineItems(baseline, current, path, changes, summary);
    } else {
      diffArrays(baseline, current, path, changes, summary);
    }
    return;
  }
  
  // Handle objects
  if (baselineType === 'object') {
    const allKeys = new Set([...Object.keys(baseline), ...Object.keys(current)]);
    
    for (const key of allKeys) {
      const newPath = path ? `${path}.${key}` : key;
      
      if (!(key in baseline)) {
        // Field added
        if (current[key] !== null && current[key] !== undefined && current[key] !== '') {
          changes.push({
            type: 'added',
            path: newPath,
            new: current[key]
          });
          summary.additions++;
        }
      } else if (!(key in current)) {
        // Field removed
        if (baseline[key] !== null && baseline[key] !== undefined && baseline[key] !== '') {
          changes.push({
            type: 'removed',
            path: newPath,
            old: baseline[key]
          });
          summary.removals++;
        }
      } else {
        // Field exists in both - recurse
        diffObjects(baseline[key], current[key], newPath, changes, summary);
      }
    }
  }
}

/**
 * Special diff logic for line items
 */
function diffLineItems(baselineItems, currentItems, path, changes, summary) {
  // Normalize and index by lineId
  const normalizedBaseline = normalizeLineItems(baselineItems);
  const normalizedCurrent = normalizeLineItems(currentItems);
  
  const baselineMap = new Map();
  const currentMap = new Map();
  
  normalizedBaseline.forEach((item, index) => {
    baselineMap.set(item.lineId, { item, index });
  });
  
  normalizedCurrent.forEach((item, index) => {
    currentMap.set(item.lineId, { item, index });
  });
  
  // Find removed items
  for (const [lineId, { item, index }] of baselineMap) {
    if (!currentMap.has(lineId)) {
      changes.push({
        type: 'removed',
        path: `${path}[${index}]`,
        old: item,
        lineId
      });
      summary.removals++;
    }
  }
  
  // Find added and modified items
  for (const [lineId, { item: currentItem, index }] of currentMap) {
    if (!baselineMap.has(lineId)) {
      // Added
      changes.push({
        type: 'added',
        path: `${path}[${index}]`,
        new: currentItem,
        lineId
      });
      summary.additions++;
    } else {
      // Check for modifications
      const baselineItem = baselineMap.get(lineId).item;
      const itemChanges = [];
      const itemSummary = { additions: 0, removals: 0, modifications: 0 };
      
      diffObjects(baselineItem, currentItem, `${path}[${index}]`, itemChanges, itemSummary);
      
      if (itemChanges.length > 0) {
        // Item was modified
        changes.push({
          type: 'modified',
          path: `${path}[${index}]`,
          lineId,
          fieldChanges: itemChanges
        });
        summary.modifications++;
      }
    }
  }
}

/**
 * Simple array diff (for non-line-item arrays)
 */
function diffArrays(baseline, current, path, changes, summary) {
  const maxLength = Math.max(baseline.length, current.length);
  
  for (let i = 0; i < maxLength; i++) {
    const newPath = `${path}[${i}]`;
    
    if (i >= baseline.length) {
      // Item added
      changes.push({
        type: 'added',
        path: newPath,
        new: current[i]
      });
      summary.additions++;
    } else if (i >= current.length) {
      // Item removed
      changes.push({
        type: 'removed',
        path: newPath,
        old: baseline[i]
      });
      summary.removals++;
    } else {
      // Compare items
      diffObjects(baseline[i], current[i], newPath, changes, summary);
    }
  }
}

/**
 * Compute word-level text diff for long strings
 */
function computeTextDiff(baseline, current) {
  // Convert to word arrays for cleaner diffs
  const baselineWords = baseline.split(/\s+/);
  const currentWords = current.split(/\s+/);
  
  const diffs = dmp.diff_main(baselineWords.join(' '), currentWords.join(' '));
  dmp.diff_cleanupSemantic(diffs);
  
  return diffs.map(([operation, text]) => ({
    operation: operation === -1 ? 'delete' : operation === 1 ? 'insert' : 'equal',
    text
  }));
}

/**
 * Get the type of a value for comparison
 */
function getType(value) {
  if (value === null || value === undefined) return 'null';
  if (Array.isArray(value)) return 'array';
  if (typeof value === 'object') return 'object';
  return 'primitive';
}

/**
 * Format diff for display
 */
function formatDiffForDisplay(diff) {
  const formatted = {
    summary: diff.summary,
    sections: {
      customerDetails: [],
      vesselDetails: [],
      lineItems: [],
      financial: [],
      other: []
    }
  };
  
  // Categorize changes by section
  for (const change of diff.changes) {
    const section = categorizeChange(change.path);
    formatted.sections[section].push(change);
  }
  
  return formatted;
}

/**
 * Categorize a change based on its path
 */
function categorizeChange(path) {
  if (path.includes('customer') || path.includes('billing')) {
    return 'customerDetails';
  }
  if (path.includes('vessel') || path.includes('ship')) {
    return 'vesselDetails';
  }
  if (path.includes('lineItems') || path.includes('items')) {
    return 'lineItems';
  }
  if (path.includes('total') || path.includes('tax') || path.includes('amount') || 
      path.includes('price') || path.includes('cost') || path.includes('profit')) {
    return 'financial';
  }
  return 'other';
}

module.exports = {
  computeInvoiceDiff,
  formatDiffForDisplay,
  computeTextDiff
};