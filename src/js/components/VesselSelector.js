/**
 * VesselSelector - Typeahead combobox for vessel selection with autofill functionality
 * Provides vessel search, selection, and form autofill for invoice integration
 */
export class VesselSelector {
  constructor(options) {
    this.options = {
      containerId: null,
      apiEndpoint: '/api/vessels/search',
      debounceMs: 200,
      minChars: 2,
      maxResults: 10,
      placeholder: 'Type vessel name or registration...',
      emptyMessage: 'No vessels found',
      loadingMessage: 'Searching vessels...',
      errorMessage: 'Search failed. Please try again.',
      onSelect: null,
      onUnlink: null,
      allowUnlink: true,
      ...options
    };

    this.container = null;
    this.input = null;
    this.listbox = null;
    this.status = null;
    this.unlinkButton = null;
    this.items = [];
    this.selectedIndex = -1;
    this.isOpen = false;
    this.debounceTimer = null;
    this.currentRequest = null;
    this.isLoading = false;
    this.linkedVessel = null;

    this.init();
  }

  init() {
    this.container = document.getElementById(this.options.containerId);
    if (!this.container) {
      console.error(`VesselSelector: Container '${this.options.containerId}' not found`);
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
      <div class="vessel-selector">
        <div class="vessel-selector-header">
          <label for="${inputId}" class="vessel-selector-label">
            Select Vessel
          </label>
          <div class="vessel-selector-badge hidden" id="${baseId}-badge">
            <svg class="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"></path>
            </svg>
            <span class="vessel-badge-text">Linked to saved vessel</span>
            <button type="button" class="vessel-unlink-btn" id="${baseId}-unlink" title="Unlink vessel">
              <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            </button>
          </div>
        </div>

        <div class="vessel-input-container">
          <input
            type="text"
            id="${inputId}"
            class="vessel-input"
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
            class="vessel-toggle"
            tabindex="-1"
            aria-label="Show vessel options"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M6 9l6 6 6-6"/>
            </svg>
          </button>
        </div>

        <ul
          id="${listboxId}"
          role="listbox"
          class="vessel-listbox"
          aria-label="Vessel search results"
          hidden
        ></ul>

        <div
          id="${statusId}"
          class="vessel-status"
          role="status"
          aria-live="polite"
          aria-atomic="true"
        ></div>
      </div>
    `;

    // Get references to created elements
    this.input = document.getElementById(inputId);
    this.listbox = document.getElementById(listboxId);
    this.status = document.getElementById(statusId);
    this.badge = document.getElementById(`${baseId}-badge`);
    this.unlinkButton = document.getElementById(`${baseId}-unlink`);
  }

  bindEvents() {
    if (!this.input || !this.listbox) return;

    // Input events
    this.input.addEventListener('input', (e) => this.handleInput(e));
    this.input.addEventListener('keydown', (e) => this.handleKeydown(e));
    this.input.addEventListener('focus', () => this.handleFocus());
    this.input.addEventListener('blur', () => this.handleBlur());

    // Toggle button
    const toggleButton = this.container.querySelector('.vessel-toggle');
    if (toggleButton) {
      toggleButton.addEventListener('click', () => this.handleToggle());
    }

    // Unlink button
    if (this.unlinkButton) {
      this.unlinkButton.addEventListener('click', () => this.handleUnlink());
    }

    // Listbox events
    this.listbox.addEventListener('click', (e) => this.handleListboxClick(e));

    // Close on outside click
    document.addEventListener('click', (e) => {
      if (!this.container.contains(e.target)) {
        this.close();
      }
    });
  }

  async handleInput(e) {
    const query = e.target.value.trim();

    // Clear linked vessel if user is typing
    if (this.linkedVessel && query !== this.linkedVessel.name) {
      this.clearLinkedVessel();
    }

    if (query.length < this.options.minChars) {
      this.close();
      return;
    }

    // Debounce search
    clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      this.search(query);
    }, this.options.debounceMs);
  }

  handleKeydown(e) {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        if (this.isOpen) {
          this.selectNext();
        } else {
          this.open();
        }
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (this.isOpen) {
          this.selectPrevious();
        }
        break;
      case 'Enter':
        e.preventDefault();
        if (this.isOpen && this.selectedIndex >= 0) {
          this.selectItem(this.items[this.selectedIndex]);
        }
        break;
      case 'Escape':
        this.close();
        break;
      case 'Tab':
        this.close();
        break;
    }
  }

  handleFocus() {
    if (this.input.value.trim().length >= this.options.minChars) {
      this.search(this.input.value.trim());
    }
  }

  handleBlur() {
    // Delay close to allow for click events
    setTimeout(() => this.close(), 150);
  }

  handleToggle() {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
      if (this.input.value.trim().length >= this.options.minChars) {
        this.search(this.input.value.trim());
      }
    }
  }

  handleUnlink() {
    this.clearLinkedVessel();
    this.input.value = '';
    this.input.focus();

    if (this.options.onUnlink) {
      this.options.onUnlink();
    }
  }

  handleListboxClick(e) {
    const option = e.target.closest('[role="option"]');
    if (option) {
      const itemId = option.dataset.itemId;
      const item = this.items.find(i => i.id === itemId);
      if (item) {
        this.selectItem(item);
      }
    }
  }

  async search(query) {
    // Cancel previous request
    if (this.currentRequest) {
      this.currentRequest.abort();
    }

    this.setLoading(true);

    try {
      this.currentRequest = new AbortController();

      const params = new URLSearchParams({
        query: query,
        limit: this.options.maxResults
      });

      const response = await fetch(`${this.options.apiEndpoint}?${params}`, {
        signal: this.currentRequest.signal
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      this.items = data.vessels || [];
      this.renderItems();
      this.open();

    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('VesselSelector search error:', error);
        this.setStatus(this.options.errorMessage);
        if (this.options.onError) {
          this.options.onError(error);
        }
      }
    } finally {
      this.setLoading(false);
      this.currentRequest = null;
    }
  }

  selectItem(vessel) {
    if (!vessel) return;

    // Update input value
    this.input.value = vessel.name;

    // Set linked vessel
    this.linkedVessel = vessel;
    this.showLinkedBadge();

    // Close dropdown
    this.close();

    // Trigger selection callback
    if (this.options.onSelect) {
      this.options.onSelect(vessel);
    }
  }

  renderItems() {
    if (!this.listbox) return;

    if (this.items.length === 0) {
      this.listbox.innerHTML = `
        <li role="option" class="vessel-option vessel-option-empty">
          ${this.options.emptyMessage}
        </li>
      `;
      return;
    }

    this.listbox.innerHTML = this.items.map((vessel, index) => `
      <li
        role="option"
        class="vessel-option"
        data-item-id="${vessel.id}"
        id="vessel-option-${vessel.id}"
        ${index === this.selectedIndex ? 'aria-selected="true"' : ''}
      >
        <div class="vessel-option-content">
          <div class="vessel-option-primary">
            <span class="vessel-name">${this.escapeHtml(vessel.name)}</span>
            ${vessel.registration_number ? `<span class="vessel-registration">${this.escapeHtml(vessel.registration_number)}</span>` : ''}
          </div>
          <div class="vessel-option-secondary">
            ${vessel.home_port ? `<span class="vessel-port">${this.escapeHtml(vessel.home_port)}</span>` : ''}
            ${vessel.length_ft ? `<span class="vessel-length">${vessel.length_ft} ft</span>` : ''}
          </div>
        </div>
      </li>
    `).join('');
  }

  selectNext() {
    if (this.items.length === 0) return;

    this.selectedIndex = Math.min(this.selectedIndex + 1, this.items.length - 1);
    this.updateSelection();
  }

  selectPrevious() {
    if (this.items.length === 0) return;

    this.selectedIndex = Math.max(this.selectedIndex - 1, -1);
    this.updateSelection();
  }

  updateSelection() {
    if (!this.listbox) return;

    // Clear previous selection
    const prevSelected = this.listbox.querySelector('[aria-selected="true"]');
    if (prevSelected) {
      prevSelected.removeAttribute('aria-selected');
      prevSelected.classList.remove('selected');
    }

    // Set new selection
    if (this.selectedIndex >= 0) {
      const currentOption = this.listbox.children[this.selectedIndex];
      if (currentOption) {
        currentOption.setAttribute('aria-selected', 'true');
        currentOption.classList.add('selected');

        // Update ARIA
        this.input.setAttribute('aria-activedescendant', currentOption.id);

        // Scroll into view
        currentOption.scrollIntoView({ block: 'nearest' });
      }
    } else {
      this.input.removeAttribute('aria-activedescendant');
    }
  }

  open() {
    if (this.isOpen) return;

    this.isOpen = true;
    this.listbox.hidden = false;
    this.input.setAttribute('aria-expanded', 'true');
    this.selectedIndex = -1;
    this.updateSelection();
  }

  close() {
    if (!this.isOpen) return;

    this.isOpen = false;
    this.listbox.hidden = true;
    this.input.setAttribute('aria-expanded', 'false');
    this.input.removeAttribute('aria-activedescendant');
    this.selectedIndex = -1;
  }

  setLoading(loading) {
    this.isLoading = loading;
    if (loading) {
      this.setStatus(this.options.loadingMessage);
    } else {
      this.setStatus('');
    }
  }

  setStatus(message) {
    if (this.status) {
      this.status.textContent = message;
    }
  }

  showLinkedBadge() {
    if (this.badge && this.options.allowUnlink) {
      this.badge.classList.remove('hidden');
    }
  }

  clearLinkedVessel() {
    this.linkedVessel = null;
    if (this.badge) {
      this.badge.classList.add('hidden');
    }
  }

  // Public methods for external control
  getLinkedVessel() {
    return this.linkedVessel;
  }

  setLinkedVessel(vessel) {
    this.linkedVessel = vessel;
    if (vessel) {
      this.input.value = vessel.name;
      this.showLinkedBadge();
    } else {
      this.clearLinkedVessel();
      this.input.value = '';
    }
  }

  getValue() {
    return this.input.value;
  }

  setValue(value) {
    this.input.value = value;
    if (!value) {
      this.clearLinkedVessel();
    }
  }

  focus() {
    if (this.input) {
      this.input.focus();
    }
  }

  // Utility methods
  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  destroy() {
    // Clear timers
    clearTimeout(this.debounceTimer);

    // Abort current request
    if (this.currentRequest) {
      this.currentRequest.abort();
    }

    // Clear container
    if (this.container) {
      this.container.innerHTML = '';
    }
  }
}