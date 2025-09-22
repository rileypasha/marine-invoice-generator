/**
 * Invoice Changes Viewer Component
 * Displays invoice changes with diff highlighting for master users
 */

import React, { useState, useEffect } from 'react';
import { renderDiff, createChangesFlag } from '../utils/diffRenderer.js';

const InvoiceChangesViewer = ({
  invoiceId,
  hasUnreadChanges = false,
  onAcknowledge = null,
  autoAcknowledge = false
}) => {
  const [invoice, setInvoice] = useState(null);
  const [diff, setDiff] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [acknowledging, setAcknowledging] = useState(false);

  // Load invoice with optional diff
  const loadInvoice = async (includeDiff = false) => {
    if (!invoiceId) return;

    setLoading(true);
    setError(null);

    try {
      const url = `/api/change-tracking/${invoiceId}${includeDiff ? '?include=diff' : ''}`;
      const response = await fetch(url, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const data = await response.json();
      setInvoice(data.invoice);

      if (data.diff) {
        setDiff(data.diff);
      }

      // Auto-acknowledge if enabled and invoice has unread changes
      if (autoAcknowledge && data.invoice?.hasUnreadChanges && onAcknowledge) {
        acknowledgeChanges();
      }

    } catch (err) {
      console.error('Failed to load invoice:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Acknowledge changes
  const acknowledgeChanges = async () => {
    if (!invoiceId || acknowledging) return;

    setAcknowledging(true);

    try {
      const response = await fetch(`/api/change-tracking/${invoiceId}/acknowledge`, {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const data = await response.json();

      // Update invoice state to reflect acknowledgment
      setInvoice(prev => ({
        ...prev,
        hasUnreadChanges: false,
        lastMasterViewAt: data.acknowledgedAt
      }));

      // Clear diff since changes are now acknowledged
      setDiff(null);

      // Notify parent component
      if (onAcknowledge) {
        onAcknowledge(data);
      }

    } catch (err) {
      console.error('Failed to acknowledge changes:', err);
      setError(`Failed to acknowledge changes: ${err.message}`);
    } finally {
      setAcknowledging(false);
    }
  };

  // Load invoice data on mount and when invoiceId changes
  useEffect(() => {
    if (invoiceId) {
      loadInvoice(hasUnreadChanges);
    }
  }, [invoiceId, hasUnreadChanges]);

  if (!invoiceId) {
    return (
      <div className="invoice-changes-viewer">
        <p className="text-gray-500">Select an invoice to view details</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="invoice-changes-viewer">
        <div className="flex items-center justify-center p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-2">Loading invoice...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="invoice-changes-viewer">
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">
                Error loading invoice
              </h3>
              <div className="mt-2 text-sm text-red-700">
                {error}
              </div>
              <div className="mt-4">
                <button
                  onClick={() => loadInvoice(hasUnreadChanges)}
                  className="bg-red-100 hover:bg-red-200 text-red-800 px-3 py-1 rounded text-sm font-medium"
                >
                  Retry
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="invoice-changes-viewer">
        <p className="text-gray-500">Invoice not found</p>
      </div>
    );
  }

  return (
    <div className="invoice-changes-viewer">
      {/* Invoice Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-medium text-gray-900">
              {invoice.title || 'Untitled Invoice'}
            </h2>
            <div className="mt-1 flex items-center gap-4 text-sm text-gray-500">
              <span>ID: {invoice.id}</span>
              {invoice.invoiceNumber && (
                <span>Number: {invoice.invoiceNumber}</span>
              )}
              {invoice.customerName && (
                <span>Customer: {invoice.customerName}</span>
              )}
              {invoice.hasUnreadChanges && (
                <div dangerouslySetInnerHTML={{
                  __html: createChangesFlag(true, diff?.summary?.additions + diff?.summary?.modifications + diff?.summary?.removals || null)
                }} />
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {invoice.hasUnreadChanges && (
              <button
                onClick={acknowledgeChanges}
                disabled={acknowledging}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-4 py-2 rounded-md text-sm font-medium inline-flex items-center gap-2"
              >
                {acknowledging ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Acknowledging...
                  </>
                ) : (
                  <>
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Acknowledge Changes
                  </>
                )}
              </button>
            )}
            {!invoice.hasUnreadChanges && diff && (
              <button
                onClick={() => loadInvoice(true)}
                className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-md text-sm font-medium"
              >
                Refresh
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Changes Display */}
      <div className="p-6">
        {invoice.hasUnreadChanges && diff ? (
          <div>
            <h3 className="text-md font-medium text-gray-900 mb-4">Changes Since Last Review</h3>
            <div dangerouslySetInnerHTML={{ __html: renderDiff(diff.diff) }} />

            {diff.baseline && (
              <div className="mt-6 p-4 bg-gray-50 rounded-md">
                <h4 className="text-sm font-medium text-gray-700 mb-2">Comparison Details</h4>
                <div className="text-sm text-gray-600">
                  <p>
                    <strong>Baseline:</strong> {diff.baseline.type === 'revision' ? 'Previous revision' : 'Current version'}
                    {diff.baseline.timestamp && (
                      <span> from {new Date(diff.baseline.timestamp).toLocaleString()}</span>
                    )}
                  </p>
                  <p>
                    <strong>Current:</strong> Latest version
                    {diff.current.timestamp && (
                      <span> from {new Date(diff.current.timestamp).toLocaleString()}</span>
                    )}
                  </p>
                </div>
              </div>
            )}
          </div>
        ) : invoice.hasUnreadChanges && !diff ? (
          <div className="text-center py-8">
            <p className="text-gray-500 mb-4">This invoice has unread changes, but diff could not be computed.</p>
            <button
              onClick={() => loadInvoice(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium"
            >
              Try Loading Changes
            </button>
          </div>
        ) : (
          <div className="text-center py-8">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No Unread Changes</h3>
            <p className="mt-1 text-sm text-gray-500">
              This invoice has been reviewed and all changes have been acknowledged.
            </p>
            {invoice.lastMasterViewAt && (
              <p className="mt-2 text-xs text-gray-400">
                Last reviewed: {new Date(invoice.lastMasterViewAt).toLocaleString()}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default InvoiceChangesViewer;