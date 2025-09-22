/**
 * Diff Rendering Utilities for Master Dashboard
 * Handles display of invoice changes with proper styling
 */

/**
 * CSS classes for diff styling (to be included in main CSS)
 */
export const DIFF_STYLES = `
.diff-container {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  line-height: 1.4;
}

.diff-section {
  margin-bottom: 1.5rem;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  overflow: hidden;
}

.diff-section-header {
  background-color: #f8f9fa;
  padding: 0.75rem 1rem;
  font-weight: 600;
  font-size: 0.9rem;
  border-bottom: 1px solid #e0e0e0;
  color: #495057;
}

.diff-changes {
  padding: 1rem;
}

.diff-change {
  margin-bottom: 0.75rem;
  padding: 0.5rem;
  border-radius: 4px;
  font-size: 0.85rem;
}

.diff-change-added {
  background-color: #f0fff4;
  border-left: 3px solid #16a34a;
}

.diff-change-removed {
  background-color: #fef2f2;
  border-left: 3px solid #dc2626;
}

.diff-change-modified {
  background-color: #fffbeb;
  border-left: 3px solid #f59e0b;
}

.diff-path {
  font-weight: 600;
  color: #374151;
  margin-bottom: 0.25rem;
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.diff-value {
  font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace;
  margin: 0.25rem 0;
  padding: 0.25rem 0.5rem;
  border-radius: 3px;
  font-size: 0.8rem;
}

.diff-value-old {
  background-color: #fee2e2;
  color: #991b1b;
  text-decoration: line-through;
}

.diff-value-new {
  background-color: #dcfce7;
  color: #166534;
  font-weight: 600;
}

.diff-summary {
  background-color: #f1f5f9;
  padding: 1rem;
  border-radius: 6px;
  margin-bottom: 1rem;
  display: flex;
  gap: 1.5rem;
  font-size: 0.85rem;
}

.diff-stat {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.diff-stat-icon {
  width: 1rem;
  height: 1rem;
  border-radius: 50%;
}

.diff-stat-added .diff-stat-icon {
  background-color: #16a34a;
}

.diff-stat-removed .diff-stat-icon {
  background-color: #dc2626;
}

.diff-stat-modified .diff-stat-icon {
  background-color: #f59e0b;
}

.diff-empty {
  text-align: center;
  color: #6b7280;
  font-style: italic;
  padding: 2rem;
}

.diff-line-item {
  border: 1px solid #e5e7eb;
  border-radius: 4px;
  margin-bottom: 0.5rem;
  overflow: hidden;
}

.diff-line-item-header {
  background-color: #f9fafb;
  padding: 0.5rem;
  font-weight: 500;
  font-size: 0.8rem;
  border-bottom: 1px solid #e5e7eb;
}

.diff-line-item-changes {
  padding: 0.5rem;
}

.diff-field-change {
  margin-bottom: 0.25rem;
  font-size: 0.75rem;
}

.diff-field-change:last-child {
  margin-bottom: 0;
}
`;

/**
 * Format a field path for display
 */
export function formatFieldPath(path) {
  return path
    .split('.')
    .map(segment => {
      // Handle array indices
      if (segment.includes('[') && segment.includes(']')) {
        const [field, index] = segment.split('[');
        const indexNum = index.replace(']', '');
        return `${formatFieldName(field)} #${parseInt(indexNum) + 1}`;
      }
      return formatFieldName(segment);
    })
    .join(' → ');
}

/**
 * Format a field name for display
 */
function formatFieldName(field) {
  // Convert camelCase to readable text
  const formatted = field
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, str => str.toUpperCase())
    .trim();

  // Handle specific field names
  const fieldMappings = {
    'customerName': 'Customer Name',
    'customerEmail': 'Customer Email',
    'customerPhone': 'Customer Phone',
    'vesselName': 'Vessel Name',
    'vesselWeight': 'Vessel Weight',
    'vesselBeam': 'Vessel Beam',
    'lineItems': 'Line Items',
    'itemId': 'Item ID',
    'itemName': 'Item Name',
    'itemDescription': 'Description',
    'itemQuantity': 'Quantity',
    'itemPrice': 'Price',
    'itemCost': 'Cost',
    'laborHours': 'Labor Hours',
    'overtimeHours': 'Overtime Hours',
    'markupRate': 'Markup Rate',
    'isTaxable': 'Taxable',
    'subtotal': 'Subtotal',
    'taxAmount': 'Tax Amount',
    'total': 'Total'
  };

  return fieldMappings[field] || formatted;
}

/**
 * Format a value for display
 */
export function formatValue(value, path = '') {
  if (value === null || value === undefined) {
    return '<empty>';
  }

  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }

  if (typeof value === 'number') {
    // Format currency for financial fields
    if (path.includes('price') || path.includes('cost') || path.includes('total') ||
        path.includes('amount') || path.includes('subtotal')) {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
      }).format(value);
    }

    // Format percentages
    if (path.includes('rate') || path.includes('percent')) {
      return `${(value * 100).toFixed(1)}%`;
    }

    return value.toString();
  }

  if (typeof value === 'string') {
    // Truncate very long strings
    if (value.length > 100) {
      return value.substring(0, 97) + '...';
    }
    return value;
  }

  if (typeof value === 'object') {
    return JSON.stringify(value, null, 2);
  }

  return String(value);
}

/**
 * Render a diff summary
 */
export function renderDiffSummary(summary) {
  const { additions, removals, modifications } = summary;

  if (additions === 0 && removals === 0 && modifications === 0) {
    return '<div class="diff-empty">No changes detected</div>';
  }

  return `
    <div class="diff-summary">
      <div class="diff-stat diff-stat-added">
        <div class="diff-stat-icon"></div>
        <span>${additions} added</span>
      </div>
      <div class="diff-stat diff-stat-removed">
        <div class="diff-stat-icon"></div>
        <span>${removals} removed</span>
      </div>
      <div class="diff-stat diff-stat-modified">
        <div class="diff-stat-icon"></div>
        <span>${modifications} modified</span>
      </div>
    </div>
  `;
}

/**
 * Render a single diff change
 */
export function renderDiffChange(change) {
  const path = formatFieldPath(change.path);
  let content = '';

  switch (change.type) {
    case 'added':
      content = `
        <div class="diff-change diff-change-added">
          <div class="diff-path">${path}</div>
          <div class="diff-value diff-value-new">
            ${formatValue(change.new, change.path)}
          </div>
        </div>
      `;
      break;

    case 'removed':
      content = `
        <div class="diff-change diff-change-removed">
          <div class="diff-path">${path}</div>
          <div class="diff-value diff-value-old">
            ${formatValue(change.old, change.path)}
          </div>
        </div>
      `;
      break;

    case 'changed':
    case 'modified':
      content = `
        <div class="diff-change diff-change-modified">
          <div class="diff-path">${path}</div>
          <div class="diff-value diff-value-old">
            ${formatValue(change.old, change.path)}
          </div>
          <div class="diff-value diff-value-new">
            ${formatValue(change.new, change.path)}
          </div>
        </div>
      `;
      break;

    default:
      content = `
        <div class="diff-change">
          <div class="diff-path">${path}</div>
          <div>Unknown change type: ${change.type}</div>
        </div>
      `;
  }

  return content;
}

/**
 * Render line item changes
 */
export function renderLineItemChanges(change) {
  if (change.type === 'modified' && change.fieldChanges) {
    const fieldChangesHtml = change.fieldChanges
      .map(fieldChange => renderDiffChange(fieldChange))
      .join('');

    return `
      <div class="diff-line-item">
        <div class="diff-line-item-header">
          Line Item ${change.lineId ? `(${change.lineId})` : ''}
        </div>
        <div class="diff-line-item-changes">
          ${fieldChangesHtml}
        </div>
      </div>
    `;
  }

  // For added/removed line items, show the full item
  return renderDiffChange(change);
}

/**
 * Render a complete diff
 */
export function renderDiff(formattedDiff) {
  if (!formattedDiff || !formattedDiff.sections) {
    return '<div class="diff-empty">No changes available</div>';
  }

  const { summary, sections } = formattedDiff;

  let html = renderDiffSummary(summary);

  // Section order for better UX
  const sectionOrder = ['customerDetails', 'vesselDetails', 'lineItems', 'financial', 'other'];
  const sectionTitles = {
    customerDetails: 'Customer Details',
    vesselDetails: 'Vessel Details',
    lineItems: 'Line Items',
    financial: 'Financial Information',
    other: 'Other Changes'
  };

  for (const sectionKey of sectionOrder) {
    const sectionChanges = sections[sectionKey];

    if (sectionChanges && sectionChanges.length > 0) {
      const sectionTitle = sectionTitles[sectionKey];
      let sectionHtml = '';

      if (sectionKey === 'lineItems') {
        // Special handling for line items
        sectionHtml = sectionChanges
          .map(change => renderLineItemChanges(change))
          .join('');
      } else {
        // Regular field changes
        sectionHtml = sectionChanges
          .map(change => renderDiffChange(change))
          .join('');
      }

      html += `
        <div class="diff-section">
          <div class="diff-section-header">${sectionTitle}</div>
          <div class="diff-changes">
            ${sectionHtml}
          </div>
        </div>
      `;
    }
  }

  return `<div class="diff-container">${html}</div>`;
}

/**
 * Create a changes flag icon for dashboard display
 */
export function createChangesFlag(hasUnreadChanges, changeCount = null) {
  if (!hasUnreadChanges) {
    return '';
  }

  const countDisplay = changeCount !== null ? ` (${changeCount})` : '';

  return `
    <span class="changes-flag" title="Has unread changes${countDisplay}">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
        <path d="M8 2a.5.5 0 0 1 .5.5v5h5a.5.5 0 0 1 0 1h-5v5a.5.5 0 0 1-1 0v-5h-5a.5.5 0 0 1 0-1h5v-5A.5.5 0 0 1 8 2Z"/>
      </svg>
      ${countDisplay}
    </span>
  `;
}

/**
 * Styles for the changes flag
 */
export const CHANGES_FLAG_STYLES = `
.changes-flag {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  color: #dc2626;
  font-weight: 600;
  font-size: 0.75rem;
  padding: 0.25rem 0.5rem;
  background-color: #fee2e2;
  border-radius: 12px;
  border: 1px solid #fecaca;
}

.changes-flag svg {
  width: 12px;
  height: 12px;
}
`;