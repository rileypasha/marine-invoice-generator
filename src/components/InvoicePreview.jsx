import React, { useState, useRef } from 'react';

/**
 * InvoicePreview Component
 *
 * A mobile PWA component that displays a simple invoice with custom long-press
 * gesture detection. When user long-presses (500ms), it triggers haptic feedback
 * and opens a comment modal. Suppresses native iOS context menus.
 */
export function InvoicePreview() {
  // State to control modal visibility
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Ref to store the long-press timer
  const longPressTimer = useRef(null);

  /**
   * onTouchStart Handler
   * Initiates the long-press timer when user touches the invoice.
   * Prevents default to suppress native iOS context menu.
   */
  const handleTouchStart = (e) => {
    e.preventDefault(); // Prevent native iOS pop-up menu

    // Set timer for 500ms long-press duration
    longPressTimer.current = setTimeout(() => {
      handleLongPressComplete();
    }, 500);
  };

  /**
   * onTouchEnd Handler
   * Clears the long-press timer when user lifts finger.
   * Prevents false positives from quick taps.
   */
  const handleTouchEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  /**
   * onTouchMove Handler
   * Clears the long-press timer when user moves finger.
   * Prevents triggering on scroll/swipe gestures.
   */
  const handleTouchMove = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  /**
   * Long-Press Complete Handler
   * Triggered when long-press timer completes (500ms elapsed).
   * Provides haptic feedback and opens comment modal.
   */
  const handleLongPressComplete = () => {
    // Trigger haptic feedback (50ms vibration)
    if ('vibrate' in navigator) {
      navigator.vibrate([50]);
    }

    // Open comment modal
    setIsModalOpen(true);
  };

  /**
   * Close Modal Handler
   * Closes the comment modal when user cancels.
   */
  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  /**
   * Add Comment Handler
   * Placeholder for comment submission logic.
   */
  const handleAddComment = () => {
    // Add your comment submission logic here
    console.log('Comment added');
    setIsModalOpen(false);
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      {/* Invoice Container */}
      <div
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onTouchMove={handleTouchMove}
        className="bg-white rounded-lg shadow-md p-6 select-none [-webkit-touch-callout:none]"
      >
        <h2 className="text-2xl font-bold mb-6 text-gray-800">Invoice Preview</h2>

        {/* Invoice Content */}
        <div className="space-y-4">
          <div className="flex justify-between py-2 border-b border-gray-200">
            <span className="text-gray-600">Subtotal</span>
            <span className="font-semibold text-gray-800">$1,250.00</span>
          </div>

          <div className="flex justify-between py-2 border-b border-gray-200">
            <span className="text-gray-600">Tax (8.5%)</span>
            <span className="font-semibold text-gray-800">$106.25</span>
          </div>

          <div className="flex justify-between py-3 border-t-2 border-gray-300">
            <span className="text-lg font-bold text-gray-900">Total</span>
            <span className="text-lg font-bold text-gray-900">$1,356.25</span>
          </div>
        </div>

        <p className="mt-6 text-sm text-gray-500 text-center">
          Long-press anywhere on this invoice to add a comment
        </p>
      </div>

      {/* Comment Modal */}
      <div
        className={`fixed inset-x-0 bottom-0 bg-white rounded-t-2xl shadow-2xl transition-transform duration-300 ease-out ${
          isModalOpen ? 'translate-y-0' : 'translate-y-full'
        }`}
        style={{ maxHeight: '80vh' }}
      >
        <div className="p-6">
          {/* Modal Header */}
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold text-gray-900">Add a Comment</h3>
            <button
              onClick={handleCloseModal}
              className="text-gray-400 hover:text-gray-600 transition-colors"
              aria-label="Close modal"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Comment Textarea */}
          <textarea
            placeholder="Enter your comment here..."
            className="w-full h-32 p-3 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            autoFocus
          />

          {/* Modal Actions */}
          <div className="flex gap-3 mt-4">
            <button
              onClick={handleCloseModal}
              className="flex-1 px-4 py-3 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleAddComment}
              className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
            >
              Add Comment
            </button>
          </div>
        </div>
      </div>

      {/* Modal Backdrop */}
      {isModalOpen && (
        <div
          onClick={handleCloseModal}
          className="fixed inset-0 bg-black bg-opacity-50 transition-opacity duration-300"
          style={{ zIndex: -1 }}
        />
      )}
    </div>
  );
}

export default InvoicePreview;
