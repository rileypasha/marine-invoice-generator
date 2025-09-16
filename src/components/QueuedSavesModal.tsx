import React, { useState, useEffect } from 'react';
import { QueuedSave } from '../lib/saveQueue';
import saveQueue from '../lib/saveQueue';
import './QueuedSavesModal.css';

interface QueuedSavesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (selectedIds: string[]) => Promise<void>;
}

export const QueuedSavesModal: React.FC<QueuedSavesModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
}) => {
  const [items, setItems] = useState<QueuedSave[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<{ success: number; failed: number } | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadQueuedItems();
    }
  }, [isOpen]);

  const loadQueuedItems = async () => {
    const queued = await saveQueue.getAll();
    setItems(queued);
    // Select all by default
    setSelectedIds(new Set(queued.map(item => item.id)));
  };

  const handleToggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedIds.size === items.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(items.map(item => item.id)));
    }
  };

  const handleSubmit = async () => {
    if (selectedIds.size === 0) return;

    setIsSubmitting(true);
    try {
      await onSubmit(Array.from(selectedIds));
      const result = await saveQueue.flush(Array.from(selectedIds));
      setSubmitResult(result);
      
      // Reload items after submission
      await loadQueuedItems();
      
      if (result.failed === 0) {
        setTimeout(() => {
          onClose();
        }, 1500);
      }
    } catch (error) {
      console.error('Failed to submit queued saves:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemove = async (id: string) => {
    await saveQueue.remove(id);
    await loadQueuedItems();
  };

  const formatDate = (date: Date) => {
    return new Intl.RelativeTimeFormat('en', { numeric: 'auto' }).format(
      Math.ceil((date.getTime() - Date.now()) / (1000 * 60)),
      'minute'
    );
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Review Pending Changes</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close modal">
            ×
          </button>
        </div>

        <div className="modal-body">
          {items.length === 0 ? (
            <div className="empty-state">
              <p>No pending changes to review</p>
            </div>
          ) : (
            <>
              <div className="modal-toolbar">
                <button 
                  className="btn-select-all"
                  onClick={handleSelectAll}
                >
                  {selectedIds.size === items.length ? 'Deselect All' : 'Select All'}
                </button>
                <span className="selection-count">
                  {selectedIds.size} of {items.length} selected
                </span>
              </div>

              <div className="queue-items">
                {items.map(item => (
                  <div key={item.id} className="queue-item">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(item.id)}
                      onChange={() => handleToggleSelect(item.id)}
                      disabled={isSubmitting}
                    />
                    
                    <div className="item-details">
                      <div className="item-header">
                        <span className="item-invoice">
                          Invoice {item.payload.invoiceNumber || item.invoiceId}
                        </span>
                        <span className="item-timestamp">
                          {formatDate(item.timestamp)}
                        </span>
                      </div>
                      
                      <div className="item-info">
                        <span className="item-customer">
                          {item.payload.customerName}
                        </span>
                        <span className="item-amount">
                          ${item.payload.amount.toFixed(2)}
                        </span>
                      </div>
                      
                      {item.attempts > 0 && (
                        <div className="item-error">
                          Failed {item.attempts} time{item.attempts !== 1 ? 's' : ''}
                          {item.error && `: ${item.error}`}
                        </div>
                      )}
                    </div>

                    <button
                      className="btn-remove"
                      onClick={() => handleRemove(item.id)}
                      disabled={isSubmitting}
                      aria-label={`Remove invoice ${item.invoiceId}`}
                    >
                      🗑️
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}

          {submitResult && (
            <div className={`submit-result ${submitResult.failed > 0 ? 'has-errors' : 'success'}`}>
              {submitResult.success > 0 && (
                <p>✅ Successfully synced {submitResult.success} invoice{submitResult.success !== 1 ? 's' : ''}</p>
              )}
              {submitResult.failed > 0 && (
                <p>❌ Failed to sync {submitResult.failed} invoice{submitResult.failed !== 1 ? 's' : ''}</p>
              )}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button 
            className="btn-cancel"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button 
            className="btn-submit"
            onClick={handleSubmit}
            disabled={isSubmitting || selectedIds.size === 0}
          >
            {isSubmitting ? 'Submitting...' : `Submit ${selectedIds.size} Change${selectedIds.size !== 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </div>
  );
};