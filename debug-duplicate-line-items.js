/**
 * Phase 1: Reproduce & Instrument - Services Tab Duplicate Line Items Bug
 *
 * This test file helps reproduce and diagnose the bug where clicking "Add Line Item"
 * creates multiple line items instead of just one.
 */

// Event tracking instrumentation
const EventTracker = {
  events: [],

  track(source, event, details = {}) {
    const timestamp = Date.now();
    const eventRecord = {
      timestamp,
      source,
      event,
      details: JSON.stringify(details),
      stackTrace: new Error().stack.split('\n').slice(2, 8).join('\n')
    };

    this.events.push(eventRecord);
    console.log(`🔍 [${timestamp}] ${source}: ${event}`, details);

    // Check for rapid duplicates (same event within 50ms)
    const recentEvents = this.events.filter(e =>
      e.source === source &&
      e.event === event &&
      timestamp - e.timestamp < 50
    );

    if (recentEvents.length > 1) {
      console.warn(`⚠️ DUPLICATE EVENT DETECTED: ${source}:${event} fired ${recentEvents.length} times within 50ms`);
      console.table(recentEvents);
    }
  },

  getReport() {
    console.log('\n📊 EVENT TRACKING REPORT');
    console.log('========================');

    // Group events by source and event type
    const groupedEvents = {};
    this.events.forEach(event => {
      const key = `${event.source}:${event.event}`;
      if (!groupedEvents[key]) {
        groupedEvents[key] = [];
      }
      groupedEvents[key].push(event);
    });

    // Report duplicates and timings
    Object.entries(groupedEvents).forEach(([key, events]) => {
      if (events.length > 1) {
        console.log(`\n🔍 ${key}: ${events.length} occurrences`);
        events.forEach((event, index) => {
          const timeDiff = index > 0 ? event.timestamp - events[index-1].timestamp : 0;
          console.log(`  ${index + 1}. ${new Date(event.timestamp).toISOString()} (+${timeDiff}ms)`);
        });
      }
    });

    return groupedEvents;
  },

  clear() {
    this.events = [];
    console.log('🗑️ Event tracker cleared');
  }
};

// State monitoring instrumentation
const StateMonitor = {
  lineItemCounts: [],

  trackLineItemCount(source, count, details = {}) {
    const timestamp = Date.now();
    const record = {
      timestamp,
      source,
      count,
      details
    };

    this.lineItemCounts.push(record);

    // Check for unexpected increases
    if (this.lineItemCounts.length > 1) {
      const previous = this.lineItemCounts[this.lineItemCounts.length - 2];
      const increase = count - previous.count;

      if (increase > 1) {
        console.warn(`⚠️ UNEXPECTED LINE ITEM INCREASE: ${previous.count} → ${count} (+${increase}) from ${source}`);
        console.log('Previous:', previous);
        console.log('Current:', record);
      }
    }

    console.log(`📊 [${source}] Line items count: ${count}`);
  },

  getReport() {
    console.log('\n📈 STATE MONITORING REPORT');
    console.log('===========================');
    this.lineItemCounts.forEach((record, index) => {
      const change = index > 0 ? record.count - this.lineItemCounts[index - 1].count : 0;
      console.log(`${index + 1}. [${record.source}] Count: ${record.count} (${change >= 0 ? '+' : ''}${change})`);
    });
  }
};

// DOM Event instrumentation
function instrumentAddLineItemButton() {
  const addButton = document.getElementById('add-line-item');
  if (!addButton) {
    console.error('❌ Add Line Item button not found');
    return;
  }

  console.log('🔧 Instrumenting Add Line Item button...');

  // Track all existing event listeners (if possible)
  const existingListeners = getEventListeners ? getEventListeners(addButton) : 'N/A';
  console.log('🎯 Existing listeners on Add Line Item button:', existingListeners);

  // Wrap the button in a click interceptor
  const originalAddEventListener = addButton.addEventListener;
  addButton.addEventListener = function(type, listener, options) {
    if (type === 'click') {
      EventTracker.track('DOM', 'addEventListener-click', {
        listenerCount: (this._clickListeners || 0) + 1
      });
      this._clickListeners = (this._clickListeners || 0) + 1;

      // Wrap the listener to track when it's called
      const wrappedListener = function(event) {
        EventTracker.track('Button', 'click-listener-fired', {
          type: event.type,
          isTrusted: event.isTrusted,
          timeStamp: event.timeStamp
        });
        return listener.call(this, event);
      };

      return originalAddEventListener.call(this, type, wrappedListener, options);
    }
    return originalAddEventListener.call(this, type, listener, options);
  };

  // Monitor actual clicks
  addButton.addEventListener('click', function(event) {
    EventTracker.track('Button', 'actual-click', {
      type: event.type,
      isTrusted: event.isTrusted,
      timeStamp: event.timeStamp,
      target: event.target.id,
      currentTarget: event.currentTarget.id
    });
  }, true); // Use capture phase to detect early

  console.log('✅ Add Line Item button instrumented');
}

// State subscription instrumentation
function instrumentInvoiceState() {
  if (typeof window.invoiceState === 'undefined') {
    console.error('❌ invoiceState not found on window');
    return;
  }

  console.log('🔧 Instrumenting InvoiceState...');

  // Wrap addLineItem method
  const originalAddLineItem = window.invoiceState.addLineItem;
  window.invoiceState.addLineItem = function(lineItem = {}) {
    EventTracker.track('State', 'addLineItem-called', { lineItem });

    const beforeCount = this.state.scope.lineItems.length;
    StateMonitor.trackLineItemCount('Before-addLineItem', beforeCount);

    const result = originalAddLineItem.call(this, lineItem);

    const afterCount = this.state.scope.lineItems.length;
    StateMonitor.trackLineItemCount('After-addLineItem', afterCount, { newItemId: result });

    return result;
  };

  // Wrap notify method to track state changes
  const originalNotify = window.invoiceState.notify;
  window.invoiceState.notify = function() {
    const count = this.state.scope.lineItems.length;
    EventTracker.track('State', 'notify-called', { lineItemCount: count });
    StateMonitor.trackLineItemCount('notify', count);

    return originalNotify.call(this);
  };

  console.log('✅ InvoiceState instrumented');
}

// ScopeForm instrumentation
function instrumentScopeForm() {
  // Monitor line item rendering
  const lineItemsList = document.getElementById('line-items-list');
  if (lineItemsList) {
    const observer = new MutationObserver(function(mutations) {
      mutations.forEach(function(mutation) {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach(function(node) {
            if (node.nodeType === Node.ELEMENT_NODE && node.classList.contains('line-item-card')) {
              const count = lineItemsList.children.length;
              EventTracker.track('DOM', 'line-item-added', { totalCount: count });
              StateMonitor.trackLineItemCount('DOM-line-item-added', count);
            }
          });
        }
      });
    });

    observer.observe(lineItemsList, { childList: true, subtree: true });
    console.log('✅ Line items list DOM observer attached');
  }
}

// Test scenarios
const TestScenarios = {
  singleClick() {
    console.log('\n🧪 TEST: Single Click');
    console.log('===================');
    EventTracker.clear();

    const button = document.getElementById('add-line-item');
    if (button && !button.disabled) {
      button.click();

      setTimeout(() => {
        console.log('\n📊 Single Click Test Results:');
        EventTracker.getReport();
        StateMonitor.getReport();
      }, 100);
    } else {
      console.log('❌ Button not available or disabled');
    }
  },

  rapidClicks() {
    console.log('\n🧪 TEST: Rapid Clicks (3 clicks within 100ms)');
    console.log('=============================================');
    EventTracker.clear();

    const button = document.getElementById('add-line-item');
    if (button && !button.disabled) {
      button.click();
      setTimeout(() => button.click(), 30);
      setTimeout(() => button.click(), 60);

      setTimeout(() => {
        console.log('\n📊 Rapid Clicks Test Results:');
        EventTracker.getReport();
        StateMonitor.getReport();
      }, 200);
    } else {
      console.log('❌ Button not available or disabled');
    }
  },

  keyboardTrigger() {
    console.log('\n🧪 TEST: Keyboard Trigger (Enter key)');
    console.log('====================================');
    EventTracker.clear();

    const button = document.getElementById('add-line-item');
    if (button) {
      button.focus();

      // Simulate Enter key
      const enterEvent = new KeyboardEvent('keydown', {
        key: 'Enter',
        code: 'Enter',
        keyCode: 13,
        which: 13,
        bubbles: true
      });

      button.dispatchEvent(enterEvent);

      setTimeout(() => {
        console.log('\n📊 Keyboard Trigger Test Results:');
        EventTracker.getReport();
        StateMonitor.getReport();
      }, 100);
    } else {
      console.log('❌ Button not found');
    }
  }
};

// Auto-initialize when page loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Initializing Services Tab Duplicate Bug Instrumentation...');
    setTimeout(() => {
      instrumentAddLineItemButton();
      instrumentInvoiceState();
      instrumentScopeForm();

      // Add test functions to global scope for manual testing
      window.TestDuplicateBug = TestScenarios;

      console.log('✅ Instrumentation complete. Use window.TestDuplicateBug.singleClick() to test');
    }, 1000); // Wait for app initialization
  });
} else {
  // Page already loaded
  setTimeout(() => {
    instrumentAddLineItemButton();
    instrumentInvoiceState();
    instrumentScopeForm();
    window.TestDuplicateBug = TestScenarios;
    console.log('✅ Instrumentation complete. Use window.TestDuplicateBug.singleClick() to test');
  }, 100);
}

// Export for manual testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { EventTracker, StateMonitor, TestScenarios };
}