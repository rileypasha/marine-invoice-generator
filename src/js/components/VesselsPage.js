/**
 * VesselsPage - Complete vessel directory management interface
 * Provides CRUD operations, search, pagination for vessel management
 */
export class VesselsPage {
  constructor(options = {}) {
    this.options = {
      containerId: 'vessels-page',
      pageSize: 25,
      maxRetries: 3,
      retryDelay: 1000,
      ...options
    };

    this.vessels = [];
    this.currentPage = 1;
    this.totalPages = 1;
    this.totalVessels = 0;
    this.searchQuery = '';
    this.sortField = 'name';
    this.sortDirection = 'asc';
    this.isLoading = false;

    this.container = null;
    this.editingVessel = null;

    // State management
    this.isMounted = false;
    this.isDestroyed = false;
    this.eventListeners = new Map();
    this.timers = new Set();
    this.retryCount = 0;
    this.lastError = null;

    // Initialize
    this.init();
  }

  /**
   * Initialize the vessels page
   */
  async init() {
    try {
      if (this.isDestroyed) return;

      // Check DOM readiness
      if (document.readyState === 'loading') {
        await new Promise(resolve => {
          document.addEventListener('DOMContentLoaded', resolve, { once: true });
        });
      }

      this.container = document.getElementById(this.options.containerId);
      if (!this.container) {
        throw new Error(`Container ${this.options.containerId} not found`);
      }

      this.isMounted = true;
      this.render();
      this.loadVessels();

      console.log('✅ VesselsPage initialized successfully');
    } catch (error) {
      console.error('❌ VesselsPage initialization failed:', error);
      this.handleError(error);
    }
  }

  /**
   * Render the vessels page HTML
   */
  render() {
    if (!this.container || this.isDestroyed) return;

    this.container.innerHTML = `
      <div class="vessels-page">
        <!-- Header -->
        <div class="flex justify-between items-center mb-6">
          <div>
            <h1 class="text-2xl font-bold text-gray-900">Vessel Directory</h1>
            <p class="text-gray-600">Manage your vessel database</p>
          </div>
          <button id="add-vessel-btn" class="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 flex items-center gap-2">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
            </svg>
            Add Vessel
          </button>
        </div>

        <!-- Search and filters -->
        <div class="bg-white rounded-lg shadow mb-6 p-4">
          <div class="flex flex-col md:flex-row gap-4 items-center">
            <div class="flex-1">
              <input
                type="text"
                id="search-input"
                placeholder="Search vessels by name, registration, or home port..."
                class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                value="${this.searchQuery}"
              >
            </div>
            <div class="flex gap-2">
              <button id="search-btn" class="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200">
                Search
              </button>
              <button id="clear-search-btn" class="text-gray-600 px-4 py-2 rounded-lg hover:bg-gray-100">
                Clear
              </button>
            </div>
          </div>
        </div>

        <!-- Loading indicator -->
        <div id="loading-indicator" class="hidden text-center py-8">
          <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          <p class="text-gray-600 mt-2">Loading vessels...</p>
        </div>

        <!-- Vessels table -->
        <div class="bg-white rounded-lg shadow overflow-hidden">
          <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-gray-200">
              <thead class="bg-gray-50">
                <tr>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" data-sort="name">
                    Name
                    <span class="sort-indicator ml-1"></span>
                  </th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" data-sort="registration_number">
                    Registration
                    <span class="sort-indicator ml-1"></span>
                  </th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" data-sort="length_ft">
                    Length (ft)
                    <span class="sort-indicator ml-1"></span>
                  </th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" data-sort="weight_tons">
                    Weight (tons)
                    <span class="sort-indicator ml-1"></span>
                  </th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" data-sort="home_port">
                    Home Port
                    <span class="sort-indicator ml-1"></span>
                  </th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Invoices
                  </th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" data-sort="is_active">
                    Status
                    <span class="sort-indicator ml-1"></span>
                  </th>
                  <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody id="vessels-tbody" class="bg-white divide-y divide-gray-200">
                <!-- Vessels will be populated here -->
              </tbody>
            </table>
          </div>

          <!-- Empty state -->
          <div id="empty-state" class="hidden text-center py-12">
            <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path>
            </svg>
            <h3 class="mt-2 text-sm font-medium text-gray-900">No vessels found</h3>
            <p class="mt-1 text-sm text-gray-500">Get started by adding your first vessel.</p>
            <div class="mt-6">
              <button id="add-vessel-empty-btn" class="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700">
                Add Vessel
              </button>
            </div>
          </div>
        </div>

        <!-- Pagination -->
        <div id="pagination" class="hidden flex items-center justify-between mt-6">
          <div class="text-sm text-gray-700">
            Showing <span id="showing-start">1</span> to <span id="showing-end">25</span> of <span id="total-count">0</span> vessels
          </div>
          <div class="flex gap-2">
            <button id="prev-page" class="px-3 py-1 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50" disabled>
              Previous
            </button>
            <div id="page-numbers" class="flex gap-1">
              <!-- Page numbers will be generated here -->
            </div>
            <button id="next-page" class="px-3 py-1 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50" disabled>
              Next
            </button>
          </div>
        </div>
      </div>

      <!-- Vessel Modal -->
      <div id="vessel-modal" class="hidden fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div class="bg-white rounded-lg max-w-2xl w-full mx-4 max-h-screen overflow-y-auto">
          <div class="flex justify-between items-center p-6 border-b">
            <h2 id="modal-title" class="text-xl font-semibold">Add Vessel</h2>
            <button id="close-modal" class="text-gray-400 hover:text-gray-600">
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            </button>
          </div>

          <form id="vessel-form" class="p-6">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <!-- Basic Info -->
              <div class="md:col-span-2">
                <h3 class="text-lg font-medium text-gray-900 mb-4">Basic Information</h3>
              </div>

              <div>
                <label for="vessel-name" class="block text-sm font-medium text-gray-700 mb-1">Vessel Name *</label>
                <input type="text" id="vessel-name" name="name" required
                       class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500">
              </div>

              <div>
                <label for="vessel-registration" class="block text-sm font-medium text-gray-700 mb-1">Registration Number</label>
                <input type="text" id="vessel-registration" name="registration_number"
                       class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500">
              </div>

              <div>
                <label for="vessel-mmsi" class="block text-sm font-medium text-gray-700 mb-1">MMSI</label>
                <input type="text" id="vessel-mmsi" name="mmsi" pattern="[0-9]{9}" maxlength="9"
                       class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                       placeholder="9 digits">
              </div>

              <div>
                <label for="vessel-imo" class="block text-sm font-medium text-gray-700 mb-1">IMO</label>
                <input type="text" id="vessel-imo" name="imo" pattern="[0-9]{7}" maxlength="7"
                       class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                       placeholder="7 digits">
              </div>

              <!-- Dimensions -->
              <div class="md:col-span-2">
                <h3 class="text-lg font-medium text-gray-900 mb-4 mt-6">Dimensions</h3>
              </div>

              <div>
                <label for="vessel-length" class="block text-sm font-medium text-gray-700 mb-1">Length (ft)</label>
                <input type="number" id="vessel-length" name="length_ft" min="0" step="0.1"
                       class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500">
              </div>

              <div>
                <label for="vessel-beam" class="block text-sm font-medium text-gray-700 mb-1">Beam (ft)</label>
                <input type="number" id="vessel-beam" name="beam_ft" min="0" step="0.1"
                       class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500">
              </div>

              <div>
                <label for="vessel-draft" class="block text-sm font-medium text-gray-700 mb-1">Draft (ft)</label>
                <input type="number" id="vessel-draft" name="draft_ft" min="0" step="0.1"
                       class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500">
              </div>

              <div>
                <label for="vessel-weight" class="block text-sm font-medium text-gray-700 mb-1">Weight (tons)</label>
                <input type="number" id="vessel-weight" name="weight_tons" min="0" step="0.1"
                       class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500">
              </div>

              <!-- Location & Owner -->
              <div class="md:col-span-2">
                <h3 class="text-lg font-medium text-gray-900 mb-4 mt-6">Location & Owner</h3>
              </div>

              <div>
                <label for="vessel-home-port" class="block text-sm font-medium text-gray-700 mb-1">Home Port</label>
                <input type="text" id="vessel-home-port" name="home_port"
                       class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500">
              </div>

              <div>
                <label for="vessel-owner-name" class="block text-sm font-medium text-gray-700 mb-1">Owner Name</label>
                <input type="text" id="vessel-owner-name" name="owner_name"
                       class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500">
              </div>

              <div>
                <label for="vessel-owner-email" class="block text-sm font-medium text-gray-700 mb-1">Owner Email</label>
                <input type="email" id="vessel-owner-email" name="owner_email"
                       class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500">
              </div>

              <div>
                <label for="vessel-owner-phone" class="block text-sm font-medium text-gray-700 mb-1">Owner Phone</label>
                <input type="tel" id="vessel-owner-phone" name="owner_phone"
                       class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500">
              </div>

              <div class="md:col-span-2">
                <label for="vessel-notes" class="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea id="vessel-notes" name="notes" rows="3"
                          class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"></textarea>
              </div>
            </div>

            <div class="flex justify-end gap-3 mt-6 pt-6 border-t">
              <button type="button" id="cancel-vessel" class="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">
                Cancel
              </button>
              <button type="submit" id="save-vessel" class="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
                Save Vessel
              </button>
            </div>
          </form>
        </div>
      </div>
    `;

    this.attachEventListeners();
  }

  /**
   * Attach event listeners
   */
  attachEventListeners() {
    if (!this.container || this.isDestroyed) return;

    // Add vessel buttons
    this.addEventListeners([
      ['#add-vessel-btn', 'click', () => this.openVesselModal()],
      ['#add-vessel-empty-btn', 'click', () => this.openVesselModal()],

      // Search
      ['#search-input', 'input', this.debounce((e) => this.handleSearch(e.target.value), 300)],
      ['#search-btn', 'click', () => this.handleSearch(document.getElementById('search-input').value)],
      ['#clear-search-btn', 'click', () => this.clearSearch()],

      // Modal
      ['#close-modal', 'click', () => this.closeVesselModal()],
      ['#cancel-vessel', 'click', () => this.closeVesselModal()],
      ['#vessel-modal', 'click', (e) => {
        if (e.target.id === 'vessel-modal') this.closeVesselModal();
      }],

      // Form
      ['#vessel-form', 'submit', (e) => this.handleVesselSubmit(e)],

      // Pagination
      ['#prev-page', 'click', () => this.goToPage(this.currentPage - 1)],
      ['#next-page', 'click', () => this.goToPage(this.currentPage + 1)],

      // Sorting
      ['thead th[data-sort]', 'click', (e) => this.handleSort(e.target.dataset.sort)]
    ]);

    // ESC key to close modal
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.closeVesselModal();
    });
  }

  /**
   * Add event listeners with cleanup tracking
   */
  addEventListeners(listeners) {
    listeners.forEach(([selector, event, handler]) => {
      const elements = this.container.querySelectorAll(selector);
      elements.forEach(element => {
        element.addEventListener(event, handler);
        this.eventListeners.set(element, { event, handler });
      });
    });
  }

  /**
   * Load vessels from API
   */
  async loadVessels() {
    if (this.isLoading || this.isDestroyed) return;

    try {
      this.setLoading(true);

      const params = new URLSearchParams({
        page: this.currentPage,
        limit: this.options.pageSize,
        active: true
      });

      if (this.searchQuery) {
        params.append('search', this.searchQuery);
      }

      const response = await fetch(`/api/vessels?${params}`);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      this.vessels = data.vessels || [];
      this.totalVessels = data.pagination?.total || 0;
      this.totalPages = data.pagination?.pages || 1;

      this.renderVesselsTable();
      this.renderPagination();
      this.retryCount = 0;

    } catch (error) {
      console.error('❌ Error loading vessels:', error);
      this.handleError(error);
    } finally {
      this.setLoading(false);
    }
  }

  /**
   * Render vessels table
   */
  renderVesselsTable() {
    const tbody = this.container.querySelector('#vessels-tbody');
    const emptyState = this.container.querySelector('#empty-state');

    if (!tbody) return;

    if (this.vessels.length === 0) {
      tbody.innerHTML = '';
      emptyState?.classList.remove('hidden');
      return;
    }

    emptyState?.classList.add('hidden');

    tbody.innerHTML = this.vessels.map(vessel => `
      <tr class="hover:bg-gray-50">
        <td class="px-6 py-4 whitespace-nowrap">
          <div class="text-sm font-medium text-gray-900">${this.escapeHtml(vessel.name)}</div>
          ${vessel.registration_number ? `<div class="text-sm text-gray-500">${this.escapeHtml(vessel.registration_number)}</div>` : ''}
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
          ${vessel.registration_number ? this.escapeHtml(vessel.registration_number) : '-'}
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
          ${vessel.length_ft ? `${vessel.length_ft} ft` : '-'}
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
          ${vessel.weight_tons ? `${vessel.weight_tons} tons` : '-'}
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
          ${vessel.home_port ? this.escapeHtml(vessel.home_port) : '-'}
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
          ${vessel._count?.invoices || 0} invoices
        </td>
        <td class="px-6 py-4 whitespace-nowrap">
          <span class="inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
            vessel.is_active
              ? 'bg-green-100 text-green-800'
              : 'bg-red-100 text-red-800'
          }">
            ${vessel.is_active ? 'Active' : 'Inactive'}
          </span>
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
          <div class="flex justify-end gap-2">
            <button onclick="window.vesselsPage.editVessel('${vessel.id}')"
                    class="text-indigo-600 hover:text-indigo-900">Edit</button>
            <button onclick="window.vesselsPage.toggleVesselStatus('${vessel.id}', ${vessel.is_active})"
                    class="text-${vessel.is_active ? 'red' : 'green'}-600 hover:text-${vessel.is_active ? 'red' : 'green'}-900">
              ${vessel.is_active ? 'Deactivate' : 'Activate'}
            </button>
          </div>
        </td>
      </tr>
    `).join('');
  }

  /**
   * Render pagination
   */
  renderPagination() {
    const pagination = this.container.querySelector('#pagination');
    const prevBtn = this.container.querySelector('#prev-page');
    const nextBtn = this.container.querySelector('#next-page');
    const showingStart = this.container.querySelector('#showing-start');
    const showingEnd = this.container.querySelector('#showing-end');
    const totalCount = this.container.querySelector('#total-count');

    if (!pagination) return;

    if (this.totalVessels === 0) {
      pagination.classList.add('hidden');
      return;
    }

    pagination.classList.remove('hidden');

    // Update showing counts
    const start = (this.currentPage - 1) * this.options.pageSize + 1;
    const end = Math.min(this.currentPage * this.options.pageSize, this.totalVessels);

    if (showingStart) showingStart.textContent = start;
    if (showingEnd) showingEnd.textContent = end;
    if (totalCount) totalCount.textContent = this.totalVessels;

    // Update buttons
    if (prevBtn) prevBtn.disabled = this.currentPage <= 1;
    if (nextBtn) nextBtn.disabled = this.currentPage >= this.totalPages;
  }

  /**
   * Open vessel modal for add/edit
   */
  openVesselModal(vessel = null) {
    const modal = this.container.querySelector('#vessel-modal');
    const title = this.container.querySelector('#modal-title');
    const form = this.container.querySelector('#vessel-form');

    if (!modal || !form) return;

    this.editingVessel = vessel;
    title.textContent = vessel ? 'Edit Vessel' : 'Add Vessel';

    // Reset form
    form.reset();

    // Fill form if editing
    if (vessel) {
      Object.keys(vessel).forEach(key => {
        const input = form.querySelector(`[name="${key}"]`);
        if (input && vessel[key] !== null) {
          input.value = vessel[key];
        }
      });
    }

    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';

    // Focus first input
    const firstInput = form.querySelector('input');
    if (firstInput) firstInput.focus();
  }

  /**
   * Close vessel modal
   */
  closeVesselModal() {
    const modal = this.container.querySelector('#vessel-modal');
    if (!modal) return;

    modal.classList.add('hidden');
    document.body.style.overflow = '';
    this.editingVessel = null;
  }

  /**
   * Handle vessel form submission
   */
  async handleVesselSubmit(e) {
    e.preventDefault();

    const form = e.target;
    const formData = new FormData(form);
    const vesselData = Object.fromEntries(formData.entries());

    // Clean up empty values
    Object.keys(vesselData).forEach(key => {
      if (vesselData[key] === '') {
        vesselData[key] = null;
      }
    });

    try {
      const url = this.editingVessel
        ? `/api/vessels/${this.editingVessel.id}`
        : '/api/vessels';

      const method = this.editingVessel ? 'PATCH' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(vesselData)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save vessel');
      }

      this.closeVesselModal();
      this.loadVessels();

      // Show success message
      this.showMessage(
        this.editingVessel ? 'Vessel updated successfully!' : 'Vessel added successfully!',
        'success'
      );

    } catch (error) {
      console.error('❌ Error saving vessel:', error);
      this.showMessage(error.message, 'error');
    }
  }

  /**
   * Edit vessel
   */
  async editVessel(vesselId) {
    try {
      const response = await fetch(`/api/vessels/${vesselId}`);
      if (!response.ok) throw new Error('Failed to fetch vessel');

      const vessel = await response.json();
      this.openVesselModal(vessel);
    } catch (error) {
      console.error('❌ Error loading vessel:', error);
      this.showMessage('Failed to load vessel details', 'error');
    }
  }

  /**
   * Toggle vessel active status
   */
  async toggleVesselStatus(vesselId, currentStatus) {
    try {
      const action = currentStatus ? 'deactivate' : 'activate';
      const url = currentStatus
        ? `/api/vessels/${vesselId}`
        : `/api/vessels/${vesselId}/activate`;

      const method = currentStatus ? 'DELETE' : 'PATCH';

      const response = await fetch(url, { method });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `Failed to ${action} vessel`);
      }

      this.loadVessels();
      this.showMessage(
        `Vessel ${currentStatus ? 'deactivated' : 'activated'} successfully!`,
        'success'
      );

    } catch (error) {
      console.error(`❌ Error toggling vessel status:`, error);
      this.showMessage(error.message, 'error');
    }
  }

  /**
   * Handle search
   */
  handleSearch(query) {
    this.searchQuery = query;
    this.currentPage = 1;
    this.loadVessels();
  }

  /**
   * Clear search
   */
  clearSearch() {
    const searchInput = this.container.querySelector('#search-input');
    if (searchInput) searchInput.value = '';
    this.searchQuery = '';
    this.currentPage = 1;
    this.loadVessels();
  }

  /**
   * Handle sorting
   */
  handleSort(field) {
    if (this.sortField === field) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortField = field;
      this.sortDirection = 'asc';
    }
    this.loadVessels();
  }

  /**
   * Go to specific page
   */
  goToPage(page) {
    if (page < 1 || page > this.totalPages) return;
    this.currentPage = page;
    this.loadVessels();
  }

  /**
   * Set loading state
   */
  setLoading(loading) {
    this.isLoading = loading;
    const indicator = this.container.querySelector('#loading-indicator');
    const table = this.container.querySelector('.bg-white.rounded-lg.shadow.overflow-hidden');

    if (indicator && table) {
      if (loading) {
        indicator.classList.remove('hidden');
        table.classList.add('opacity-50');
      } else {
        indicator.classList.add('hidden');
        table.classList.remove('opacity-50');
      }
    }
  }

  /**
   * Show message to user
   */
  showMessage(message, type = 'info') {
    // Simple alert for now - could be enhanced with toast notifications
    if (type === 'error') {
      alert(`Error: ${message}`);
    } else {
      alert(message);
    }
  }

  /**
   * Handle errors
   */
  handleError(error) {
    this.lastError = error;
    console.error('❌ VesselsPage error:', error);

    if (this.retryCount < this.options.maxRetries) {
      this.retryCount++;
      setTimeout(() => this.loadVessels(), this.options.retryDelay);
    } else {
      this.showMessage('Failed to load vessels. Please refresh the page.', 'error');
    }
  }

  /**
   * Utility: Escape HTML
   */
  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Utility: Debounce function
   */
  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  /**
   * Cleanup
   */
  destroy() {
    this.isDestroyed = true;

    // Clear event listeners
    this.eventListeners.forEach((listener, element) => {
      element.removeEventListener(listener.event, listener.handler);
    });
    this.eventListeners.clear();

    // Clear timers
    this.timers.forEach(timer => clearTimeout(timer));
    this.timers.clear();

    // Clear DOM
    if (this.container) {
      this.container.innerHTML = '';
    }

    console.log('✅ VesselsPage destroyed');
  }
}

// Global instance for inline handlers
window.vesselsPage = null;