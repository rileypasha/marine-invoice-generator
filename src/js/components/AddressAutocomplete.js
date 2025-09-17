/**
 * AddressAutocomplete Component
 *
 * WCAG-compliant address autocomplete component using Geoapify API
 * Features:
 * - ARIA combobox + listbox implementation
 * - Keyboard navigation (↑/↓/Enter/Escape)
 * - Debounced queries with 300ms delay
 * - Progressive enhancement fallback
 * - Screen reader announcements
 */

export class AddressAutocomplete {
  constructor(options = {}) {
    this.options = {
      containerId: options.containerId || 'address-autocomplete',
      placeholder: options.placeholder || 'Start typing address...',
      minChars: options.minChars || 3,
      debounceMs: options.debounceMs || 300,
      maxResults: options.maxResults || 5,
      onSelect: options.onSelect || (() => {}),
      onError: options.onError || ((error) => console.error('Address autocomplete error:', error)),
      ...options
    };

    this.isInitialized = false;
    this.currentQuery = '';
    this.selectedIndex = -1;
    this.results = [];
    this.debounceTimer = null;
    this.controller = null; // AbortController for fetch requests

    this.init();
  }

  init() {
    this.container = document.getElementById(this.options.containerId);
    if (!this.container) {
      console.error(`AddressAutocomplete: Container with id "${this.options.containerId}" not found`);
      return;
    }

    this.render();
    this.attachEventListeners();
    this.isInitialized = true;
  }

  render() {
    this.container.innerHTML = `
      <div class="address-autocomplete">
        <div class="address-input-container" role="combobox" aria-expanded="false" aria-haspopup="listbox">
          <input
            type="text"
            id="${this.options.containerId}-input"
            class="form-input address-input"
            placeholder="${this.options.placeholder}"
            aria-label="Address line 1"
            aria-describedby="${this.options.containerId}-help ${this.options.containerId}-status"
            aria-autocomplete="list"
            aria-controls="${this.options.containerId}-listbox"
            autocomplete="address-line1"
          />
          <div class="address-input-icons">
            <div class="loading-spinner" id="${this.options.containerId}-loading" style="display: none;" aria-hidden="true">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 12a9 9 0 11-6.219-8.56"/>
              </svg>
            </div>
          </div>
        </div>


        <div
          class="address-suggestions"
          id="${this.options.containerId}-listbox"
          role="listbox"
          aria-label="Address suggestions"
          style="display: none;"
        ></div>

        <div
          class="sr-only"
          id="${this.options.containerId}-status"
          aria-live="polite"
          aria-atomic="true"
        ></div>
      </div>
    `;

    // Add CSS styles if not already present
    this.addStyles();

    // Cache DOM elements
    this.input = document.getElementById(`${this.options.containerId}-input`);
    this.listbox = document.getElementById(`${this.options.containerId}-listbox`);
    this.status = document.getElementById(`${this.options.containerId}-status`);
    this.loading = document.getElementById(`${this.options.containerId}-loading`);
    this.combobox = this.container.querySelector('[role="combobox"]');
  }

  addStyles() {
    const styleId = 'address-autocomplete-styles';
    if (document.getElementById(styleId)) return;

    const styles = document.createElement('style');
    styles.id = styleId;
    styles.textContent = `
      .address-autocomplete {
        position: relative;
        width: 100%;
      }

      .address-input-container {
        position: relative;
        display: flex;
        align-items: center;
      }

      .address-input {
        width: 100%;
        padding-right: 2.5rem;
      }

      .address-input-icons {
        position: absolute;
        right: 0.75rem;
        display: flex;
        align-items: center;
        pointer-events: none;
      }

      .loading-spinner svg {
        animation: spin 1s linear infinite;
        color: #6b7280;
      }

      @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }

      .address-help {
        font-size: 0.875rem;
        color: #6b7280;
        margin-top: 0.25rem;
      }

      .address-suggestions {
        position: absolute;
        top: 100%;
        left: 0;
        right: 0;
        background: white;
        border: 1px solid #d1d5db;
        border-radius: 0.375rem;
        box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
        max-height: 200px;
        overflow-y: auto;
        z-index: 50;
        margin-top: 0.25rem;
      }

      .address-suggestion {
        padding: 0.75rem;
        border-bottom: 1px solid #f3f4f6;
        cursor: pointer;
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
      }

      .address-suggestion:last-child {
        border-bottom: none;
      }

      .address-suggestion:hover,
      .address-suggestion.selected {
        background-color: #f3f4f6;
      }

      .address-suggestion.selected {
        background-color: #dbeafe;
      }

      .suggestion-label {
        font-weight: 500;
        color: #1f2937;
      }

      .suggestion-details {
        font-size: 0.875rem;
        color: #6b7280;
      }

      .address-no-results {
        padding: 0.75rem;
        text-align: center;
        color: #6b7280;
        font-style: italic;
      }

      .sr-only {
        position: absolute;
        width: 1px;
        height: 1px;
        padding: 0;
        margin: -1px;
        overflow: hidden;
        clip: rect(0, 0, 0, 0);
        white-space: nowrap;
        border: 0;
      }

      .suggestion-match {
        font-weight: 600;
        background-color: #fef3c7;
      }
    `;
    document.head.appendChild(styles);
  }

  attachEventListeners() {
    if (!this.input) return;

    // Input events
    this.input.addEventListener('input', (e) => this.handleInput(e));
    this.input.addEventListener('keydown', (e) => this.handleKeydown(e));
    this.input.addEventListener('focus', () => this.handleFocus());
    this.input.addEventListener('blur', (e) => this.handleBlur(e));

    // Listbox events
    this.listbox.addEventListener('click', (e) => this.handleListboxClick(e));

    // Close suggestions when clicking outside
    document.addEventListener('click', (e) => {
      if (!this.container.contains(e.target)) {
        this.hideSuggestions();
      }
    });
  }

  handleInput(e) {
    const value = e.target.value.trim();
    this.currentQuery = value;

    // Clear existing debounce timer
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    // Abort any pending request
    if (this.controller) {
      this.controller.abort();
    }

    if (value.length < this.options.minChars) {
      this.hideSuggestions();
      return;
    }

    // Debounce the search
    this.debounceTimer = setTimeout(() => {
      this.searchAddresses(value);
    }, this.options.debounceMs);
  }

  handleKeydown(e) {
    const isOpen = this.listbox.style.display !== 'none';

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        if (!isOpen && this.currentQuery.length >= this.options.minChars) {
          this.searchAddresses(this.currentQuery);
        } else if (isOpen) {
          this.selectNext();
        }
        break;

      case 'ArrowUp':
        e.preventDefault();
        if (isOpen) {
          this.selectPrevious();
        }
        break;

      case 'Enter':
        e.preventDefault();
        if (isOpen && this.selectedIndex >= 0) {
          this.selectResult(this.results[this.selectedIndex]);
        }
        break;

      case 'Escape':
        this.hideSuggestions();
        this.input.blur();
        break;

      case 'Tab':
        // Allow natural tab behavior
        this.hideSuggestions();
        break;
    }
  }

  handleFocus() {
    if (this.currentQuery.length >= this.options.minChars && this.results.length > 0) {
      this.showSuggestions();
    }
  }

  handleBlur(e) {
    // Delay hiding to allow for clicks on suggestions
    setTimeout(() => {
      if (!this.container.contains(document.activeElement)) {
        this.hideSuggestions();
      }
    }, 150);
  }

  handleListboxClick(e) {
    const suggestion = e.target.closest('.address-suggestion');
    if (suggestion) {
      const index = parseInt(suggestion.dataset.index, 10);
      if (index >= 0 && index < this.results.length) {
        this.selectResult(this.results[index]);
      }
    }
  }

  async searchAddresses(query) {
    if (!query || query.length < this.options.minChars) return;

    try {
      // Show loading state
      this.setLoading(true);
      this.updateStatus('Searching for addresses...');

      // Create new abort controller
      this.controller = new AbortController();

      const params = new URLSearchParams({
        query: query,
        limit: this.options.maxResults,
        lang: 'en'
      });

      const response = await fetch(`/api/geo/address-autocomplete?${params}`, {
        signal: this.controller.signal,
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }

      const results = await response.json();
      this.handleSearchResults(results, query);

    } catch (error) {
      if (error.name === 'AbortError') {
        // Request was aborted, ignore
        return;
      }

      console.error('Address search error:', error);
      this.options.onError(error);
      this.updateStatus('Address search failed. Please try again.');
      this.showNoResults();
    } finally {
      this.setLoading(false);
    }
  }

  handleSearchResults(results, query) {
    this.results = results || [];
    this.selectedIndex = -1;

    if (this.results.length === 0) {
      this.showNoResults();
      this.updateStatus('No addresses found. Try a different search.');
    } else {
      this.renderSuggestions(query);
      this.showSuggestions();
      this.updateStatus(`${this.results.length} address${this.results.length === 1 ? '' : 'es'} found. Use arrow keys to navigate.`);
    }
  }

  renderSuggestions(query) {
    const html = this.results.map((result, index) => {
      const label = this.highlightMatch(result.label, query);
      const details = [result.city, result.state, result.country].filter(Boolean).join(', ');

      return `
        <div class="address-suggestion" role="option" data-index="${index}" aria-selected="false">
          <div class="suggestion-label">${label}</div>
          ${details ? `<div class="suggestion-details">${details}</div>` : ''}
        </div>
      `;
    }).join('');

    this.listbox.innerHTML = html;
  }

  showNoResults() {
    this.listbox.innerHTML = '<div class="address-no-results">No addresses found</div>';
    this.showSuggestions();
  }

  highlightMatch(text, query) {
    if (!query) return text;

    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')})`, 'gi');
    return text.replace(regex, '<span class="suggestion-match">$1</span>');
  }

  showSuggestions() {
    this.listbox.style.display = 'block';
    this.combobox.setAttribute('aria-expanded', 'true');
  }

  hideSuggestions() {
    this.listbox.style.display = 'none';
    this.combobox.setAttribute('aria-expanded', 'false');
    this.selectedIndex = -1;
    this.updateSelectionAria();
  }

  selectNext() {
    if (this.selectedIndex < this.results.length - 1) {
      this.selectedIndex++;
      this.updateSelectionAria();
      this.scrollToSelected();
    }
  }

  selectPrevious() {
    if (this.selectedIndex > 0) {
      this.selectedIndex--;
      this.updateSelectionAria();
      this.scrollToSelected();
    }
  }

  updateSelectionAria() {
    const suggestions = this.listbox.querySelectorAll('.address-suggestion');
    suggestions.forEach((suggestion, index) => {
      suggestion.classList.remove('selected');
      suggestion.setAttribute('aria-selected', 'false');

      if (index === this.selectedIndex) {
        suggestion.classList.add('selected');
        suggestion.setAttribute('aria-selected', 'true');
        this.input.setAttribute('aria-activedescendant', `suggestion-${index}`);
        suggestion.id = `suggestion-${index}`;
      }
    });

    if (this.selectedIndex === -1) {
      this.input.removeAttribute('aria-activedescendant');
    }
  }

  scrollToSelected() {
    const selected = this.listbox.querySelector('.selected');
    if (selected) {
      selected.scrollIntoView({ block: 'nearest' });
    }
  }

  selectResult(result) {
    // Use the full formatted address instead of just line1
    this.input.value = result.label;
    this.hideSuggestions();
    this.updateStatus(`Selected: ${result.label}`);

    // Call the onSelect callback with the result
    this.options.onSelect(result);
  }

  setLoading(loading) {
    if (this.loading) {
      this.loading.style.display = loading ? 'block' : 'none';
    }
  }

  updateStatus(message) {
    if (this.status) {
      this.status.textContent = message;
    }
  }

  // Public API methods
  getValue() {
    return this.input ? this.input.value : '';
  }

  setValue(value) {
    if (this.input) {
      this.input.value = value;
    }
  }

  clear() {
    this.setValue('');
    this.hideSuggestions();
    this.results = [];
    this.currentQuery = '';
  }

  focus() {
    if (this.input) {
      this.input.focus();
    }
  }

  destroy() {
    // Clean up event listeners and timers
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    if (this.controller) {
      this.controller.abort();
    }

    // Remove styles if no other instances exist
    const otherInstances = document.querySelectorAll('.address-autocomplete');
    if (otherInstances.length <= 1) {
      const styles = document.getElementById('address-autocomplete-styles');
      if (styles) {
        styles.remove();
      }
    }

    // Clear container
    if (this.container) {
      this.container.innerHTML = '';
    }
  }
}