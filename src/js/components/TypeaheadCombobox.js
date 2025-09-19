/**
 * TypeaheadCombobox - ARIA-compliant combobox with typeahead search
 * Follows WCAG guidelines for accessibility
 */
export class TypeaheadCombobox {
  constructor(options) {
    this.options = {
      containerId: null,
      apiEndpoint: null,
      searchParam: 'query',
      debounceMs: 200,
      minChars: 2,
      maxResults: 10,
      placeholder: 'Start typing to search...',
      emptyMessage: 'No results found',
      loadingMessage: 'Searching...',
      errorMessage: 'Search failed. Please try again.',
      displayField: 'display_name',
      valueField: 'id',
      onSelect: null,
      onError: null,
      formatItem: null,
      allowCreate: false,
      createLabel: 'Create new',
      ...options
    };

    this.container = null;
    this.input = null;
    this.listbox = null;
    this.status = null;
    this.items = [];
    this.selectedIndex = -1;
    this.isOpen = false;
    this.debounceTimer = null;
    this.currentRequest = null;
    this.isLoading = false;

    this.init();
  }

  init() {
    this.container = document.getElementById(this.options.containerId);
    if (!this.container) {
      console.error(`TypeaheadCombobox: Container '${this.options.containerId}' not found`);
      return;
    }

    this.createElements();
    this.bindEvents();
  }

  createElements() {
    // Generate unique IDs for ARIA relationships
    const baseId = this.options.containerId;
    const inputId = `${baseId}-input`;
    const listboxId = `${baseId}-listbox`;
    const statusId = `${baseId}-status`;

    this.container.innerHTML = `
      <div class="typeahead-combobox">
        <div class="combobox-input-container">
          <input
            type="text"
            id="${inputId}"
            class="combobox-input"
            placeholder="${this.options.placeholder}"
            autocomplete="off"
            autocapitalize="off"
            spellcheck="false"
            role="combobox"
            aria-expanded="false"
            aria-autocomplete="list"
            aria-owns="${listboxId}"
            aria-describedby="${statusId}"
          />
          <button
            type="button"
            class="combobox-toggle"
            tabindex="-1"
            aria-label="Show options"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M6 9l6 6 6-6"/>
            </svg>
          </button>
        </div>
        <ul
          id="${listboxId}"
          role="listbox"
          class="combobox-listbox"
          aria-label="Search results"
          hidden
        ></ul>
        <div
          id="${statusId}"
          class="combobox-status"
          role="status"
          aria-live="polite"
          aria-atomic="true"
        ></div>
      </div>
    `;

    this.input = this.container.querySelector('.combobox-input');
    this.listbox = this.container.querySelector('.combobox-listbox');
    this.status = this.container.querySelector('.combobox-status');
    this.toggleButton = this.container.querySelector('.combobox-toggle');
  }

  bindEvents() {
    // Input events
    this.input.addEventListener('input', (e) => {
      this.handleInput(e.target.value);
    });

    this.input.addEventListener('keydown', (e) => {
      this.handleKeydown(e);
    });

    this.input.addEventListener('focus', () => {
      if (this.input.value.length >= this.options.minChars) {
        this.openDropdown();
      }
    });

    this.input.addEventListener('blur', (e) => {
      // Delay hiding to allow for clicks on listbox items
      setTimeout(() => {
        if (!this.container.contains(document.activeElement)) {
          this.closeDropdown();
        }
      }, 100);
    });

    // Toggle button
    this.toggleButton.addEventListener('click', () => {
      if (this.isOpen) {
        this.closeDropdown();
        this.input.focus();
      } else {
        this.input.focus();
        if (this.input.value.length >= this.options.minChars) {
          this.openDropdown();
        }
      }
    });

    // Listbox click events
    this.listbox.addEventListener('click', (e) => {
      const item = e.target.closest('[role="option"]');
      if (item) {
        const index = parseInt(item.dataset.index);
        this.selectItem(index);
      }
    });

    // Click outside to close
    document.addEventListener('click', (e) => {
      if (!this.container.contains(e.target)) {
        this.closeDropdown();
      }
    });
  }

  handleInput(value) {
    // Clear previous debounce
    clearTimeout(this.debounceTimer);

    // Update accessibility
    this.input.setAttribute('aria-expanded', 'false');

    if (value.length < this.options.minChars) {
      this.closeDropdown();
      return;
    }

    // Set loading state
    this.setLoading(true);

    // Debounce search
    this.debounceTimer = setTimeout(() => {
      this.search(value);
    }, this.options.debounceMs);
  }

  async search(query) {
    try {
      // Cancel previous request
      if (this.currentRequest) {
        this.currentRequest.abort();
      }

      // Create new request
      const controller = new AbortController();
      this.currentRequest = controller;

      const url = new URL(this.options.apiEndpoint, window.location.origin);
      url.searchParams.set(this.options.searchParam, query);
      url.searchParams.set('limit', this.options.maxResults);

      const response = await fetch(url, {
        signal: controller.signal,
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Search failed: ${response.status}`);
      }

      const data = await response.json();
      this.items = data.customers || data.items || [];
      this.renderResults();
      this.openDropdown();
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('TypeaheadCombobox search error:', error);
        this.showError();
        if (this.options.onError) {
          this.options.onError(error);
        }
      }
    } finally {
      this.setLoading(false);
      this.currentRequest = null;
    }
  }

  renderResults() {
    this.listbox.innerHTML = '';
    this.selectedIndex = -1;

    if (this.items.length === 0) {
      this.renderEmptyState();
      return;
    }

    this.items.forEach((item, index) => {
      const li = this.createOptionElement(item, index);
      this.listbox.appendChild(li);
    });

    // Add "Create new" option if enabled
    if (this.options.allowCreate && this.input.value.trim()) {
      const createLi = this.createCreateOption();
      this.listbox.appendChild(createLi);
    }
  }

  createOptionElement(item, index) {
    const li = document.createElement('li');
    li.role = 'option';
    li.className = 'combobox-option';
    li.dataset.index = index;
    li.id = `${this.options.containerId}-option-${index}`;

    if (this.options.formatItem) {
      li.innerHTML = this.options.formatItem(item);
    } else {
      const displayText = item[this.options.displayField] || item.name || item.label;
      li.textContent = displayText;
    }

    return li;
  }

  createCreateOption() {
    const li = document.createElement('li');
    li.role = 'option';
    li.className = 'combobox-option combobox-option--create';
    li.dataset.index = 'create';
    li.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"/>
        <line x1="12" y1="8" x2="12" y2="16"/>
        <line x1="8" y1="12" x2="16" y2="12"/>
      </svg>
      ${this.options.createLabel}: "${this.input.value.trim()}"
    `;
    return li;
  }

  renderEmptyState() {
    const li = document.createElement('li');
    li.className = 'combobox-empty';
    li.textContent = this.options.emptyMessage;
    this.listbox.appendChild(li);
  }

  handleKeydown(e) {
    if (!this.isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        if (this.input.value.length >= this.options.minChars) {
          this.openDropdown();
        }
        e.preventDefault();
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        this.navigateDown();
        e.preventDefault();
        break;
      case 'ArrowUp':
        this.navigateUp();
        e.preventDefault();
        break;
      case 'Enter':
        if (this.selectedIndex >= 0) {
          this.selectItem(this.selectedIndex);
        } else if (this.selectedIndex === 'create') {
          this.selectCreateOption();
        }
        e.preventDefault();
        break;
      case 'Escape':
        this.closeDropdown();
        e.preventDefault();
        break;
      case 'Tab':
        this.closeDropdown();
        break;
    }
  }

  navigateDown() {
    const options = this.listbox.querySelectorAll('[role="option"]');
    if (options.length === 0) return;

    this.selectedIndex++;
    if (this.selectedIndex >= options.length) {
      this.selectedIndex = 0;
    }
    this.updateSelection();
  }

  navigateUp() {
    const options = this.listbox.querySelectorAll('[role="option"]');
    if (options.length === 0) return;

    this.selectedIndex--;
    if (this.selectedIndex < 0) {
      this.selectedIndex = options.length - 1;
    }
    this.updateSelection();
  }

  updateSelection() {
    const options = this.listbox.querySelectorAll('[role="option"]');

    options.forEach((option, index) => {
      const isSelected = index === this.selectedIndex;
      option.setAttribute('aria-selected', isSelected);
      option.classList.toggle('combobox-option--selected', isSelected);
    });

    // Update ARIA
    const selectedOption = options[this.selectedIndex];
    if (selectedOption) {
      this.input.setAttribute('aria-activedescendant', selectedOption.id);
    } else {
      this.input.removeAttribute('aria-activedescendant');
    }
  }

  selectItem(index) {
    if (index === 'create') {
      this.selectCreateOption();
      return;
    }

    const item = this.items[index];
    if (!item) return;

    // Update input value
    const displayText = item[this.options.displayField] || item.name || item.label;
    this.input.value = displayText;

    // Close dropdown
    this.closeDropdown();

    // Trigger selection callback
    if (this.options.onSelect) {
      this.options.onSelect(item);
    }

    // Announce selection
    this.announceSelection(displayText);
  }

  selectCreateOption() {
    const newValue = this.input.value.trim();
    this.closeDropdown();

    if (this.options.onSelect) {
      this.options.onSelect({
        [this.options.displayField]: newValue,
        _isNew: true
      });
    }

    this.announceSelection(`Created: ${newValue}`);
  }

  announceSelection(text) {
    this.status.textContent = `Selected: ${text}`;
    setTimeout(() => {
      this.status.textContent = '';
    }, 1000);
  }

  openDropdown() {
    if (this.isOpen) return;

    this.isOpen = true;
    this.listbox.hidden = false;
    this.input.setAttribute('aria-expanded', 'true');
    this.selectedIndex = -1;
    this.updateSelection();
  }

  closeDropdown() {
    if (!this.isOpen) return;

    this.isOpen = false;
    this.listbox.hidden = true;
    this.input.setAttribute('aria-expanded', 'false');
    this.input.removeAttribute('aria-activedescendant');
    this.selectedIndex = -1;
  }

  setLoading(loading) {
    this.isLoading = loading;
    this.status.textContent = loading ? this.options.loadingMessage : '';
    this.toggleButton.classList.toggle('loading', loading);
  }

  showError() {
    this.status.textContent = this.options.errorMessage;
    setTimeout(() => {
      this.status.textContent = '';
    }, 3000);
  }

  // Public API methods
  setValue(value) {
    this.input.value = value || '';
  }

  getValue() {
    return this.input.value;
  }

  clear() {
    this.input.value = '';
    this.closeDropdown();
  }

  focus() {
    this.input.focus();
  }

  destroy() {
    clearTimeout(this.debounceTimer);
    if (this.currentRequest) {
      this.currentRequest.abort();
    }
    if (this.container) {
      this.container.innerHTML = '';
    }
  }
}