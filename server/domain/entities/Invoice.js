const { v4: uuidv4 } = require('uuid');

/**
 * Invoice Lifecycle States
 * DRAFT: New invoice being created, not yet saved
 * SAVED: Invoice saved to persistent storage
 * MODIFIED: Saved invoice that has been edited
 * FINALIZED: Invoice marked as complete, no further edits allowed
 */
const InvoiceState = {
  DRAFT: 'DRAFT',
  SAVED: 'SAVED',
  MODIFIED: 'MODIFIED',
  FINALIZED: 'FINALIZED'
};

/**
 * Invoice Aggregate Root
 * Encapsulates business rules and state transitions for invoice lifecycle
 */
class Invoice {
  constructor({
    id = null,
    title = 'Untitled Invoice',
    data = {},
    metadata = {},
    state = InvoiceState.DRAFT,
    version = 1,
    userId,
    userName,
    userEmail,
    // Denormalized fields for performance
    vesselName = null,
    vesselWeight = null,
    vesselBeam = null,
    customerName = null,
    customerEmail = null,
    customerPhone = null,
    // Calculated fields
    subtotal = 0,
    taxAmount = 0,
    total = 0,
    grossProfit = 0,
    profitPercent = 0,
    // Timestamps
    createdAt = new Date(),
    updatedAt = new Date(),
    savedAt = null,
    finalizedAt = null
  } = {}) {
    // Generate ID if not provided
    this.id = id || uuidv4();

    // Core fields
    this.title = title;
    this.data = data;
    this.metadata = metadata;
    this.state = state;
    this.version = version;

    // User association
    this.userId = userId;
    this.userName = userName;
    this.userEmail = userEmail;

    // Denormalized fields
    this.vesselName = vesselName;
    this.vesselWeight = vesselWeight;
    this.vesselBeam = vesselBeam;
    this.customerName = customerName;
    this.customerEmail = customerEmail;
    this.customerPhone = customerPhone;

    // Calculated fields
    this.subtotal = subtotal;
    this.taxAmount = taxAmount;
    this.total = total;
    this.grossProfit = grossProfit;
    this.profitPercent = profitPercent;

    // Timestamps
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
    this.savedAt = savedAt;
    this.finalizedAt = finalizedAt;

    // Validate initial state
    this._validateState();
  }

  /**
   * Business Rules and State Transitions
   */

  /**
   * Save a draft invoice for the first time
   * DRAFT → SAVED
   */
  save() {
    this._assertState([InvoiceState.DRAFT], 'save');

    this.state = InvoiceState.SAVED;
    this.savedAt = new Date();
    this.updatedAt = new Date();

    return this;
  }

  /**
   * Update an existing saved invoice
   * SAVED → MODIFIED or MODIFIED → MODIFIED
   */
  update(changes = {}) {
    this._assertState([InvoiceState.SAVED, InvoiceState.MODIFIED], 'update');

    // Apply changes
    if (changes.title !== undefined) this.title = changes.title;
    if (changes.data !== undefined) this.data = { ...this.data, ...changes.data };
    if (changes.metadata !== undefined) this.metadata = { ...this.metadata, ...changes.metadata };

    // Update denormalized fields if vessel data changed
    if (changes.data?.vessel) {
      this.vesselName = changes.data.vessel.name || this.vesselName;
      this.vesselWeight = changes.data.vessel.weight || this.vesselWeight;
      this.vesselBeam = changes.data.vessel.beam || this.vesselBeam;
    }

    // Update customer fields if customer data changed
    if (changes.data?.customer) {
      this.customerName = changes.data.customer.customerName || this.customerName;
      this.customerEmail = changes.data.customer.customerEmail || this.customerEmail;
      this.customerPhone = changes.data.customer.customerPhone || this.customerPhone;
    }

    // Update calculated fields if provided
    if (changes.subtotal !== undefined) this.subtotal = changes.subtotal;
    if (changes.taxAmount !== undefined) this.taxAmount = changes.taxAmount;
    if (changes.total !== undefined) this.total = changes.total;
    if (changes.grossProfit !== undefined) this.grossProfit = changes.grossProfit;
    if (changes.profitPercent !== undefined) this.profitPercent = changes.profitPercent;

    // Transition state
    this.state = InvoiceState.MODIFIED;
    this.updatedAt = new Date();
    this.version += 1;

    return this;
  }

  /**
   * Persist modifications to storage
   * MODIFIED → SAVED
   */
  persistChanges() {
    this._assertState([InvoiceState.MODIFIED], 'persistChanges');

    this.state = InvoiceState.SAVED;
    this.savedAt = new Date();
    this.updatedAt = new Date();

    return this;
  }

  /**
   * Finalize invoice (no more changes allowed)
   * SAVED → FINALIZED
   */
  finalize() {
    this._assertState([InvoiceState.SAVED], 'finalize');

    this.state = InvoiceState.FINALIZED;
    this.finalizedAt = new Date();
    this.updatedAt = new Date();

    return this;
  }

  /**
   * Create a copy/clone of this invoice as a new draft
   * Any state → new DRAFT invoice
   */
  clone(newTitle = null) {
    return new Invoice({
      // New identity
      id: null, // Will generate new ID
      title: newTitle || `Copy of ${this.title}`,
      state: InvoiceState.DRAFT,
      version: 1,

      // Copy data
      data: JSON.parse(JSON.stringify(this.data)),
      metadata: { ...this.metadata, clonedFrom: this.id },

      // Copy user association
      userId: this.userId,
      userName: this.userName,
      userEmail: this.userEmail,

      // Reset timestamps
      createdAt: new Date(),
      updatedAt: new Date(),
      savedAt: null,
      finalizedAt: null
    });
  }

  /**
   * Query Methods
   */

  isDraft() {
    return this.state === InvoiceState.DRAFT;
  }

  isSaved() {
    return this.state === InvoiceState.SAVED;
  }

  isModified() {
    return this.state === InvoiceState.MODIFIED;
  }

  isFinalized() {
    return this.state === InvoiceState.FINALIZED;
  }

  hasUnsavedChanges() {
    return this.state === InvoiceState.MODIFIED;
  }

  canUpdate() {
    return [InvoiceState.SAVED, InvoiceState.MODIFIED].includes(this.state);
  }

  canFinalize() {
    return this.state === InvoiceState.SAVED;
  }

  /**
   * Smart Save Logic
   * Determines whether to create new or update existing based on state
   */
  determineSaveAction() {
    switch (this.state) {
      case InvoiceState.DRAFT:
        return 'CREATE';
      case InvoiceState.MODIFIED:
        return 'UPDATE';
      case InvoiceState.SAVED:
        return 'NO_ACTION'; // Already saved
      case InvoiceState.FINALIZED:
        return 'CANNOT_SAVE'; // Finalized invoices cannot be saved
      default:
        throw new Error(`Unknown state: ${this.state}`);
    }
  }

  /**
   * Serialization for API responses
   */
  toJSON() {
    return {
      id: this.id,
      title: this.title,
      data: this.data,
      metadata: this.metadata,
      state: this.state,
      version: this.version,
      userId: this.userId,
      userName: this.userName,
      userEmail: this.userEmail,
      vesselName: this.vesselName,
      vesselWeight: this.vesselWeight,
      vesselBeam: this.vesselBeam,
      customerName: this.customerName,
      customerEmail: this.customerEmail,
      customerPhone: this.customerPhone,
      subtotal: this.subtotal,
      taxAmount: this.taxAmount,
      total: this.total,
      grossProfit: this.grossProfit,
      profitPercent: this.profitPercent,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      savedAt: this.savedAt,
      finalizedAt: this.finalizedAt
    };
  }

  /**
   * Create from database record
   */
  static fromDatabase(dbRecord) {
    return new Invoice({
      id: dbRecord.id,
      title: dbRecord.title,
      data: typeof dbRecord.data === 'string' ? JSON.parse(dbRecord.data) : dbRecord.data,
      metadata: typeof dbRecord.metadata === 'string' ? JSON.parse(dbRecord.metadata) : dbRecord.metadata,
      state: dbRecord.state || InvoiceState.SAVED, // Default legacy records to SAVED
      version: dbRecord.version || 1,
      userId: dbRecord.userId,
      userName: dbRecord.userName,
      userEmail: dbRecord.userEmail,
      vesselName: dbRecord.vesselName,
      vesselWeight: dbRecord.vesselWeight,
      vesselBeam: dbRecord.vesselBeam,
      customerName: dbRecord.customerName,
      customerEmail: dbRecord.customerEmail,
      customerPhone: dbRecord.customerPhone,
      subtotal: dbRecord.subtotal,
      taxAmount: dbRecord.taxAmount,
      total: dbRecord.total,
      grossProfit: dbRecord.grossProfit,
      profitPercent: dbRecord.profitPercent,
      createdAt: dbRecord.createdAt,
      updatedAt: dbRecord.updatedAt,
      savedAt: dbRecord.savedAt,
      finalizedAt: dbRecord.finalizedAt
    });
  }

  /**
   * Private Validation Methods
   */

  _validateState() {
    if (!Object.values(InvoiceState).includes(this.state)) {
      throw new Error(`Invalid invoice state: ${this.state}`);
    }

    if (!this.userId) {
      throw new Error('Invoice must have associated userId');
    }
  }

  _assertState(allowedStates, operation) {
    if (!allowedStates.includes(this.state)) {
      throw new Error(
        `Cannot ${operation} invoice in state ${this.state}. ` +
        `Allowed states: ${allowedStates.join(', ')}`
      );
    }
  }
}

module.exports = {
  Invoice,
  InvoiceState
};