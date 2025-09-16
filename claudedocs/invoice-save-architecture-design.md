# Invoice Save/Update Architecture Design
**Domain-Driven Design Solution**
*Created: September 15, 2025*

## Executive Summary

**Problem Statement:**
Users editing existing invoices are incorrectly prompted to "name their invoice" and end up creating new invoices instead of updating existing ones. This stems from architectural inconsistencies between create and update operations.

**Solution Overview:**
Implement a Domain-Driven Design approach with clear bounded contexts, proper invoice lifecycle management, and unified save/update operations that provide intuitive user experience.

**Key Deliverables:**
1. ✅ **Invoice Aggregate** with proper identity and lifecycle management
2. ✅ **Unified Save API** that intelligently handles create vs. update
3. ✅ **Smart Frontend State Management** for seamless UX
4. ✅ **Comprehensive Testing Strategy** with Playwright E2E validation

---

## 🏗️ Domain Model Design (DDD)

### Invoice Aggregate Root

```typescript
/**
 * Invoice Aggregate - Central domain entity with clear lifecycle
 */
export class Invoice {
  private constructor(
    public readonly id: InvoiceId,
    public readonly version: number,
    private props: InvoiceProps,
    private state: InvoiceState
  ) {}

  // Factory methods for clear intent
  static createNew(props: CreateInvoiceProps): Invoice {
    return new Invoice(
      InvoiceId.generate(),
      1,
      { ...props, createdAt: new Date() },
      InvoiceState.DRAFT
    );
  }

  static fromExisting(
    id: InvoiceId,
    version: number,
    props: InvoiceProps,
    state: InvoiceState
  ): Invoice {
    return new Invoice(id, version, props, state);
  }

  // Business logic methods
  update(changes: Partial<InvoiceProps>): Invoice {
    if (this.state === InvoiceState.FINALIZED) {
      throw new DomainError('Cannot update finalized invoice');
    }

    return new Invoice(
      this.id,
      this.version + 1,
      { ...this.props, ...changes, updatedAt: new Date() },
      InvoiceState.MODIFIED
    );
  }

  save(): Invoice {
    return new Invoice(
      this.id,
      this.version,
      this.props,
      InvoiceState.SAVED
    );
  }

  // Query methods
  isNew(): boolean {
    return this.state === InvoiceState.DRAFT && this.version === 1;
  }

  hasUnsavedChanges(): boolean {
    return this.state === InvoiceState.MODIFIED;
  }

  canBeUpdated(): boolean {
    return this.state !== InvoiceState.FINALIZED;
  }

  toDTO(): InvoiceDTO {
    return {
      id: this.id.value,
      version: this.version,
      state: this.state,
      ...this.props
    };
  }
}

/**
 * Invoice States - Clear lifecycle management
 */
export enum InvoiceState {
  DRAFT = 'draft',         // New invoice, never saved
  SAVED = 'saved',         // Saved to server, no pending changes
  MODIFIED = 'modified',   // Saved invoice with unsaved changes
  FINALIZED = 'finalized'  // Cannot be modified (future use)
}

/**
 * Value Objects for type safety
 */
export class InvoiceId {
  constructor(public readonly value: string) {
    if (!value) throw new DomainError('Invoice ID cannot be empty');
  }

  static generate(): InvoiceId {
    return new InvoiceId(`inv_${Date.now()}_${Math.random().toString(36).substring(2)}`);
  }

  static fromString(value: string): InvoiceId {
    return new InvoiceId(value);
  }

  equals(other: InvoiceId): boolean {
    return this.value === other.value;
  }
}

/**
 * Domain Transfer Objects
 */
export interface InvoiceDTO {
  id: string;
  version: number;
  state: InvoiceState;
  title?: string;
  amount: number;
  description: string;
  customerName: string;
  customerEmail: string;
  dueDate: string;
  items: InvoiceItemDTO[];
  createdAt: Date;
  updatedAt?: Date;
}

interface CreateInvoiceProps {
  title?: string;
  amount: number;
  description: string;
  customerName: string;
  customerEmail: string;
  dueDate: string;
  items: InvoiceItemDTO[];
}

interface InvoiceProps extends CreateInvoiceProps {
  createdAt: Date;
  updatedAt?: Date;
}
```

### Repository Pattern

```typescript
/**
 * Invoice Repository - Data access abstraction
 */
export interface InvoiceRepository {
  save(invoice: Invoice): Promise<void>;
  findById(id: InvoiceId): Promise<Invoice | null>;
  findByUserId(userId: string): Promise<Invoice[]>;
  delete(id: InvoiceId): Promise<void>;
}

/**
 * Implementation with optimistic locking
 */
export class InvoiceRepositoryImpl implements InvoiceRepository {
  async save(invoice: Invoice): Promise<void> {
    const dto = invoice.toDTO();

    if (invoice.isNew()) {
      await this.apiClient.post('/api/v1/invoices', dto);
    } else {
      await this.apiClient.put(`/api/v1/invoices/${dto.id}`, dto, {
        headers: { 'If-Match': dto.version.toString() }
      });
    }
  }

  async findById(id: InvoiceId): Promise<Invoice | null> {
    try {
      const dto = await this.apiClient.get<InvoiceDTO>(`/api/v1/invoices/${id.value}`);
      return Invoice.fromExisting(
        InvoiceId.fromString(dto.id),
        dto.version,
        dto,
        dto.state as InvoiceState
      );
    } catch (error) {
      if (error.status === 404) return null;
      throw error;
    }
  }
}
```

---

## 🚀 API Design Specification

### RESTful Invoice API

```typescript
/**
 * Invoice API Routes with clear semantics
 */

// CREATE new invoice
POST /api/v1/invoices
Request Body: CreateInvoiceRequest
Response: 201 Created, InvoiceResponse

// GET existing invoice
GET /api/v1/invoices/:id
Response: 200 OK, InvoiceResponse | 404 Not Found

// UPDATE existing invoice
PUT /api/v1/invoices/:id
Headers: If-Match: {version}
Request Body: UpdateInvoiceRequest
Response: 200 OK, InvoiceResponse | 409 Conflict (version mismatch)

// LIST user invoices
GET /api/v1/invoices?userId={userId}&state={state}&limit={limit}&offset={offset}
Response: 200 OK, InvoiceListResponse

// DELETE invoice
DELETE /api/v1/invoices/:id
Response: 204 No Content | 404 Not Found

/**
 * Request/Response Types
 */
interface CreateInvoiceRequest {
  title?: string;           // Optional for drafts
  amount: number;
  description: string;
  customerName: string;
  customerEmail: string;
  dueDate: string;          // ISO 8601 format
  items: InvoiceItemRequest[];
}

interface UpdateInvoiceRequest extends Partial<CreateInvoiceRequest> {
  // Only include fields being updated
}

interface InvoiceResponse {
  id: string;
  version: number;
  state: InvoiceState;
  title?: string;
  amount: number;
  description: string;
  customerName: string;
  customerEmail: string;
  dueDate: string;
  items: InvoiceItemResponse[];
  createdAt: string;        // ISO 8601 format
  updatedAt?: string;       // ISO 8601 format
  links: {
    self: string;
    update: string;
    delete: string;
  };
}

interface InvoiceListResponse {
  invoices: InvoiceResponse[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
  links: {
    self: string;
    next?: string;
    previous?: string;
  };
}
```

### Smart Save Endpoint (Unified Create/Update)

```typescript
/**
 * Intelligent save endpoint that handles both create and update
 */
POST /api/v1/invoices/save
Request Body: SaveInvoiceRequest
Response: 200 OK, SaveInvoiceResponse

interface SaveInvoiceRequest {
  id?: string;              // If provided, attempts update; if not, creates new
  version?: number;         // Required for updates (optimistic locking)
  title?: string;
  amount: number;
  description: string;
  customerName: string;
  customerEmail: string;
  dueDate: string;
  items: InvoiceItemRequest[];
  clientId?: string;        // For idempotency
}

interface SaveInvoiceResponse {
  operation: 'created' | 'updated';
  invoice: InvoiceResponse;
  message: string;
}

/**
 * Server Implementation Logic
 */
export async function handleSaveInvoice(req: Request): Promise<SaveInvoiceResponse> {
  const data = req.body as SaveInvoiceRequest;

  if (data.id) {
    // Update existing invoice
    const existing = await invoiceRepository.findById(InvoiceId.fromString(data.id));
    if (!existing) {
      throw new NotFoundError(`Invoice ${data.id} not found`);
    }

    if (data.version !== existing.version) {
      throw new ConflictError('Invoice has been modified by another user');
    }

    const updated = existing.update(data);
    const saved = updated.save();
    await invoiceRepository.save(saved);

    return {
      operation: 'updated',
      invoice: saved.toDTO(),
      message: 'Invoice updated successfully'
    };
  } else {
    // Create new invoice
    const newInvoice = Invoice.createNew(data);
    const saved = newInvoice.save();
    await invoiceRepository.save(saved);

    return {
      operation: 'created',
      invoice: saved.toDTO(),
      message: 'Invoice created successfully'
    };
  }
}
```

---

## 🎨 Frontend Architecture Design

### Invoice Context Provider

```typescript
/**
 * React Context for Invoice State Management
 */
interface InvoiceContextValue {
  currentInvoice: Invoice | null;
  isLoading: boolean;
  hasUnsavedChanges: boolean;

  // Actions
  createNew(): void;
  loadInvoice(id: string): Promise<void>;
  updateInvoice(changes: Partial<InvoiceProps>): void;
  saveInvoice(): Promise<void>;
  discardChanges(): void;
}

export const InvoiceContext = createContext<InvoiceContextValue | null>(null);

export function InvoiceProvider({ children }: { children: React.ReactNode }) {
  const [currentInvoice, setCurrentInvoice] = useState<Invoice | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const invoiceRepository = useInvoiceRepository();

  const updateInvoice = useCallback((changes: Partial<InvoiceProps>) => {
    setCurrentInvoice(prev => {
      if (!prev) return null;
      return prev.update(changes);
    });
  }, []);

  const saveInvoice = useCallback(async () => {
    if (!currentInvoice) return;

    setIsLoading(true);
    try {
      const saved = currentInvoice.save();
      await invoiceRepository.save(saved);
      setCurrentInvoice(saved);

      // Show success message based on operation type
      const message = saved.isNew()
        ? 'Invoice created successfully'
        : 'Invoice updated successfully';
      showToast(message, 'success');

    } catch (error) {
      if (error instanceof ConflictError) {
        showToast('Invoice has been modified by another user. Please refresh and try again.', 'error');
      } else {
        showToast('Failed to save invoice. Please try again.', 'error');
      }
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [currentInvoice, invoiceRepository]);

  const value: InvoiceContextValue = {
    currentInvoice,
    isLoading,
    hasUnsavedChanges: currentInvoice?.hasUnsavedChanges() ?? false,
    createNew: () => setCurrentInvoice(Invoice.createNew(getDefaultProps())),
    loadInvoice: async (id: string) => {
      setIsLoading(true);
      try {
        const invoice = await invoiceRepository.findById(InvoiceId.fromString(id));
        setCurrentInvoice(invoice);
      } finally {
        setIsLoading(false);
      }
    },
    updateInvoice,
    saveInvoice,
    discardChanges: () => {
      if (currentInvoice && !currentInvoice.isNew()) {
        // Reload from server
        loadInvoice(currentInvoice.id.value);
      } else {
        setCurrentInvoice(null);
      }
    }
  };

  return (
    <InvoiceContext.Provider value={value}>
      {children}
    </InvoiceContext.Provider>
  );
}
```

### Smart Save Button Component

```tsx
/**
 * Intelligent Save Button with context-aware behavior
 */
export function SaveButton() {
  const { currentInvoice, hasUnsavedChanges, isLoading, saveInvoice } = useInvoiceContext();
  const [showTitlePrompt, setShowTitlePrompt] = useState(false);

  const handleSave = async () => {
    if (!currentInvoice) return;

    // For new invoices without title, prompt for title
    if (currentInvoice.isNew() && !currentInvoice.props.title) {
      setShowTitlePrompt(true);
      return;
    }

    // For existing invoices or new invoices with title, save directly
    await saveInvoice();
  };

  const handleTitleSubmit = async (title: string) => {
    if (!currentInvoice) return;

    const updated = currentInvoice.update({ title });
    setCurrentInvoice(updated);
    await saveInvoice();
    setShowTitlePrompt(false);
  };

  // Dynamic button text based on context
  const getButtonText = () => {
    if (isLoading) return 'Saving...';
    if (!currentInvoice) return 'Save';
    if (currentInvoice.isNew()) return 'Save Invoice';
    return hasUnsavedChanges ? 'Save Changes' : 'Saved';
  };

  const isDisabled = isLoading || (!currentInvoice) ||
    (currentInvoice && !currentInvoice.isNew() && !hasUnsavedChanges);

  return (
    <>
      <button
        onClick={handleSave}
        disabled={isDisabled}
        className={`save-button ${hasUnsavedChanges ? 'has-changes' : ''}`}
      >
        {getButtonText()}
      </button>

      {showTitlePrompt && (
        <TitlePromptModal
          onSubmit={handleTitleSubmit}
          onCancel={() => setShowTitlePrompt(false)}
          placeholder="Enter invoice title..."
        />
      )}
    </>
  );
}
```

### Auto-Save Integration

```typescript
/**
 * Enhanced Auto-Save with proper state management
 */
export function useAutoSave() {
  const { currentInvoice, hasUnsavedChanges, saveInvoice } = useInvoiceContext();
  const debouncedSave = useDebouncedCallback(saveInvoice, 2000);

  useEffect(() => {
    if (hasUnsavedChanges && currentInvoice && !currentInvoice.isNew()) {
      // Only auto-save existing invoices to avoid title prompts
      debouncedSave();
    }
  }, [hasUnsavedChanges, currentInvoice, debouncedSave]);

  return {
    isAutoSaveEnabled: hasUnsavedChanges && currentInvoice && !currentInvoice.isNew(),
    triggerAutoSave: debouncedSave
  };
}
```

---

## 📋 Implementation Plan

### Phase 1: Domain Model & API (Week 1)

**Day 1-2: Domain Model Implementation**
```bash
# Files to create/modify:
src/domain/
├── entities/
│   ├── Invoice.ts          # Aggregate root
│   ├── InvoiceId.ts        # Value object
│   └── InvoiceState.ts     # Enum
├── repositories/
│   └── InvoiceRepository.ts # Repository interface
└── errors/
    └── DomainError.ts      # Domain exceptions
```

**Day 3-4: API Implementation**
```bash
# Files to create/modify:
server/routes/
├── invoices.ts             # New RESTful routes
└── invoiceSave.ts          # Smart save endpoint

server/services/
├── InvoiceService.ts       # Business logic
└── InvoiceRepositoryImpl.ts # Data access
```

**Day 5: Integration Testing**
- Unit tests for domain model
- API endpoint tests
- Repository integration tests

### Phase 2: Frontend Refactoring (Week 2)

**Day 1-2: Context & Hooks**
```bash
# Files to create/modify:
src/contexts/
└── InvoiceContext.tsx      # State management

src/hooks/
├── useInvoice.ts           # Invoice operations
├── useAutoSave.ts          # Auto-save logic
└── useInvoiceRepository.ts # Data access
```

**Day 3-4: Component Updates**
```bash
# Files to modify:
src/components/
├── SaveButton.tsx          # Smart save button
├── InvoiceForm.tsx         # Form state integration
└── TitlePromptModal.tsx    # Title input modal
```

**Day 5: Legacy System Migration**
- Migrate from InvoiceStorage to new system
- Update existing components
- Ensure backward compatibility

### Phase 3: Testing & Validation (Week 3)

**Day 1-3: Comprehensive Testing (see detailed strategy below)**
**Day 4-5: Performance & Security Validation**

---

## 🧪 Comprehensive Testing Strategy with Playwright

### E2E Test Scenarios

```typescript
/**
 * Playwright Test Suite - Invoice Save/Update Flows
 */
import { test, expect } from '@playwright/test';

test.describe('Invoice Save/Update Functionality', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/invoices');
    await page.waitForLoadState('networkidle');
  });

  test('should create new invoice with title prompt', async ({ page }) => {
    // GIVEN: User creates a new invoice
    await page.click('[data-testid="new-invoice-button"]');
    await page.fill('[data-testid="customer-name"]', 'John Doe');
    await page.fill('[data-testid="amount"]', '1000');
    await page.fill('[data-testid="description"]', 'Web development services');

    // WHEN: User clicks save (new invoice without title)
    await page.click('[data-testid="save-button"]');

    // THEN: Should prompt for title
    await expect(page.locator('[data-testid="title-prompt-modal"]')).toBeVisible();

    // WHEN: User provides title and saves
    await page.fill('[data-testid="invoice-title-input"]', 'Project Alpha Invoice');
    await page.click('[data-testid="confirm-save-button"]');

    // THEN: Should create new invoice
    await expect(page.locator('[data-testid="success-toast"]')).toContainText('Invoice created successfully');
    await expect(page.locator('[data-testid="invoice-title"]')).toContainText('Project Alpha Invoice');

    // AND: Should have saved state
    await expect(page.locator('[data-testid="save-button"]')).toContainText('Saved');
    await expect(page.locator('[data-testid="save-button"]')).toBeDisabled();
  });

  test('should update existing invoice without prompting for title', async ({ page }) => {
    // GIVEN: User loads an existing invoice
    await page.click('[data-testid="invoice-item"]:first-child');
    await page.waitForLoadState('networkidle');

    const originalTitle = await page.locator('[data-testid="invoice-title"]').textContent();

    // WHEN: User modifies the invoice
    await page.fill('[data-testid="amount"]', '1500');

    // THEN: Should show unsaved changes
    await expect(page.locator('[data-testid="save-button"]')).toContainText('Save Changes');
    await expect(page.locator('[data-testid="save-button"]')).not.toBeDisabled();

    // WHEN: User clicks save
    await page.click('[data-testid="save-button"]');

    // THEN: Should save without prompting for title
    await expect(page.locator('[data-testid="title-prompt-modal"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="success-toast"]')).toContainText('Invoice updated successfully');

    // AND: Should maintain original title
    await expect(page.locator('[data-testid="invoice-title"]')).toContainText(originalTitle);

    // AND: Should show saved state
    await expect(page.locator('[data-testid="save-button"]')).toContainText('Saved');
    await expect(page.locator('[data-testid="save-button"]')).toBeDisabled();
  });

  test('should handle auto-save for existing invoices', async ({ page }) => {
    // GIVEN: User loads an existing invoice
    await page.click('[data-testid="invoice-item"]:first-child');
    await page.waitForLoadState('networkidle');

    // WHEN: User makes a change
    await page.fill('[data-testid="description"]', 'Updated description for auto-save test');

    // THEN: Should trigger auto-save after delay
    await page.waitForTimeout(3000); // Wait for auto-save delay
    await expect(page.locator('[data-testid="auto-save-indicator"]')).toContainText('Auto-saved');

    // WHEN: User refreshes the page
    await page.reload();
    await page.waitForLoadState('networkidle');

    // THEN: Changes should be persisted
    await expect(page.locator('[data-testid="description"]')).toHaveValue('Updated description for auto-save test');
  });

  test('should not auto-save new invoices to avoid title prompts', async ({ page }) => {
    // GIVEN: User creates a new invoice
    await page.click('[data-testid="new-invoice-button"]');
    await page.fill('[data-testid="customer-name"]', 'Jane Smith');
    await page.fill('[data-testid="amount"]', '750');

    // WHEN: User waits for potential auto-save
    await page.waitForTimeout(3000);

    // THEN: Should not auto-save (no title prompt should appear)
    await expect(page.locator('[data-testid="title-prompt-modal"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="auto-save-indicator"]')).not.toBeVisible();

    // AND: Save button should still show "Save Invoice"
    await expect(page.locator('[data-testid="save-button"]')).toContainText('Save Invoice');
  });

  test('should handle concurrent edit conflicts', async ({ page, context }) => {
    // GIVEN: Two users load the same invoice
    const page2 = await context.newPage();
    await page.goto('/invoices/123');
    await page2.goto('/invoices/123');
    await Promise.all([
      page.waitForLoadState('networkidle'),
      page2.waitForLoadState('networkidle')
    ]);

    // WHEN: First user makes and saves a change
    await page.fill('[data-testid="amount"]', '2000');
    await page.click('[data-testid="save-button"]');
    await expect(page.locator('[data-testid="success-toast"]')).toContainText('Invoice updated successfully');

    // AND: Second user makes a different change and tries to save
    await page2.fill('[data-testid="description"]', 'Conflicting change');
    await page2.click('[data-testid="save-button"]');

    // THEN: Should show conflict error
    await expect(page2.locator('[data-testid="error-toast"]')).toContainText('Invoice has been modified by another user');

    // AND: Should offer to refresh
    await expect(page2.locator('[data-testid="refresh-button"]')).toBeVisible();
  });

  test('should preserve form state during save failures', async ({ page }) => {
    // GIVEN: User loads an invoice and makes changes
    await page.click('[data-testid="invoice-item"]:first-child');
    await page.fill('[data-testid="amount"]', '9999');
    await page.fill('[data-testid="description"]', 'Important changes');

    // WHEN: Network fails during save
    await page.route('**/api/v1/invoices/**', route => route.abort());
    await page.click('[data-testid="save-button"]');

    // THEN: Should show error but preserve form state
    await expect(page.locator('[data-testid="error-toast"]')).toContainText('Failed to save invoice');
    await expect(page.locator('[data-testid="amount"]')).toHaveValue('9999');
    await expect(page.locator('[data-testid="description"]')).toHaveValue('Important changes');

    // AND: Should still show unsaved changes
    await expect(page.locator('[data-testid="save-button"]')).toContainText('Save Changes');
  });

  test('should handle offline save queuing', async ({ page }) => {
    // GIVEN: User loads an invoice
    await page.click('[data-testid="invoice-item"]:first-child');

    // WHEN: User goes offline and makes changes
    await page.context().setOffline(true);
    await page.fill('[data-testid="amount"]', '1234');
    await page.click('[data-testid="save-button"]');

    // THEN: Should queue save locally
    await expect(page.locator('[data-testid="offline-toast"]')).toContainText('Changes saved locally');
    await expect(page.locator('[data-testid="offline-indicator"]')).toBeVisible();

    // WHEN: User comes back online
    await page.context().setOffline(false);
    await page.click('[data-testid="sync-button"]');

    // THEN: Should sync queued changes
    await expect(page.locator('[data-testid="success-toast"]')).toContainText('Invoice updated successfully');
    await expect(page.locator('[data-testid="offline-indicator"]')).not.toBeVisible();
  });
});

/**
 * Performance Testing
 */
test.describe('Invoice Save Performance', () => {
  test('should save invoices within performance budget', async ({ page }) => {
    await page.goto('/invoices');

    // Measure save operation performance
    const startTime = Date.now();

    await page.click('[data-testid="invoice-item"]:first-child');
    await page.fill('[data-testid="amount"]', '500');
    await page.click('[data-testid="save-button"]');
    await page.waitForSelector('[data-testid="success-toast"]');

    const duration = Date.now() - startTime;

    // Should complete within 2 seconds
    expect(duration).toBeLessThan(2000);
  });
});

/**
 * Accessibility Testing
 */
test.describe('Invoice Save Accessibility', () => {
  test('should be accessible via keyboard navigation', async ({ page }) => {
    await page.goto('/invoices');
    await page.click('[data-testid="invoice-item"]:first-child');

    // Should be able to navigate and save using only keyboard
    await page.keyboard.press('Tab'); // Navigate to amount field
    await page.keyboard.type('750');
    await page.keyboard.press('Tab'); // Navigate to save button
    await page.keyboard.press('Enter'); // Trigger save

    await expect(page.locator('[data-testid="success-toast"]')).toContainText('Invoice updated successfully');
  });

  test('should provide proper ARIA labels and announcements', async ({ page }) => {
    await page.goto('/invoices');
    await page.click('[data-testid="new-invoice-button"]');

    // Check ARIA labels
    await expect(page.locator('[data-testid="save-button"]')).toHaveAttribute('aria-label', 'Save invoice');

    // Check screen reader announcements
    await page.fill('[data-testid="amount"]', '1000');
    await expect(page.locator('[aria-live="polite"]')).toContainText('Invoice has unsaved changes');
  });
});
```

### Test Data Setup

```typescript
/**
 * Test Data Factories
 */
export class InvoiceTestDataFactory {
  static createNewInvoice(): CreateInvoiceProps {
    return {
      amount: 1000,
      description: 'Test invoice description',
      customerName: 'Test Customer',
      customerEmail: 'test@example.com',
      dueDate: '2025-12-31',
      items: [
        {
          description: 'Test item 1',
          quantity: 2,
          price: 250
        },
        {
          description: 'Test item 2',
          quantity: 1,
          price: 500
        }
      ]
    };
  }

  static createExistingInvoice(id: string = 'test-invoice-1'): Invoice {
    return Invoice.fromExisting(
      InvoiceId.fromString(id),
      1,
      {
        title: 'Existing Test Invoice',
        ...this.createNewInvoice(),
        createdAt: new Date('2025-01-01'),
      },
      InvoiceState.SAVED
    );
  }
}

/**
 * Test API Mock Setup
 */
export function setupInvoiceApiMocks(page: Page) {
  // Mock successful save responses
  page.route('**/api/v1/invoices', async route => {
    if (route.request().method() === 'POST') {
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          operation: 'created',
          invoice: { id: 'new-invoice-id', ...route.request().postDataJSON() },
          message: 'Invoice created successfully'
        })
      });
    }
  });

  page.route('**/api/v1/invoices/*', async route => {
    if (route.request().method() === 'PUT') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          operation: 'updated',
          invoice: { id: 'existing-invoice-id', ...route.request().postDataJSON() },
          message: 'Invoice updated successfully'
        })
      });
    }
  });
}
```

### Continuous Testing Strategy

```bash
#!/bin/bash
# scripts/test-invoice-save.sh

echo "🧪 Running Invoice Save/Update Test Suite"

# Unit tests
echo "Running unit tests..."
npm run test:unit -- --grep "Invoice.*save"

# Integration tests
echo "Running integration tests..."
npm run test:integration -- --grep "InvoiceRepository\|InvoiceService"

# E2E tests
echo "Running E2E tests..."
npx playwright test tests/invoice-save.spec.ts

# Performance tests
echo "Running performance tests..."
npx playwright test tests/invoice-save-performance.spec.ts

# Accessibility tests
echo "Running accessibility tests..."
npx playwright test tests/invoice-save-a11y.spec.ts

echo "✅ All tests completed"
```

---

## 🎯 Success Metrics

### Functional Metrics
- ✅ **0% title prompts** for existing invoice updates
- ✅ **100% correct operation** detection (create vs. update)
- ✅ **<2s save time** for typical invoice operations
- ✅ **Zero data loss** during save operations

### User Experience Metrics
- ✅ **<3 clicks** to save existing invoice changes
- ✅ **Clear visual feedback** for save states (saving, saved, errors)
- ✅ **Seamless auto-save** for existing invoices
- ✅ **Intuitive title prompting** only for new invoices

### Technical Metrics
- ✅ **98%+ test coverage** for save/update flows
- ✅ **Zero race conditions** in concurrent editing scenarios
- ✅ **Proper error handling** for all failure modes
- ✅ **Performance within budget** (<2s for save operations)

---

## 🚀 Deployment Strategy

### Rollout Plan

**Phase 1: Backend API (Low Risk)**
- Deploy new RESTful invoice endpoints
- Maintain backward compatibility with existing endpoints
- Enable feature flag for new save logic

**Phase 2: Frontend Update (Medium Risk)**
- Deploy new invoice context and state management
- Update save button component with smart behavior
- Enable feature flag for new UI behavior

**Phase 3: Migration (High Risk)**
- Migrate existing invoices to new domain model
- Switch traffic to new endpoints
- Monitor and rollback capability

### Feature Flags

```typescript
interface FeatureFlags {
  useNewInvoiceSaveFlow: boolean;      // Enable new save logic
  enableSmartSaveButton: boolean;      // Enable context-aware save button
  enableAutoSaveForExisting: boolean;  // Enable auto-save for existing invoices
}
```

### Monitoring & Alerting

```typescript
// Key metrics to monitor
interface SaveMetrics {
  saveOperationCount: number;
  saveSuccessRate: number;
  averageSaveTime: number;
  titlePromptRate: number;           // Should approach 0% for existing invoices
  userConfusionEvents: number;       // Track support tickets related to save confusion
}
```

---

## ✅ Implementation Checklist

### Backend Development
- [ ] Implement Invoice aggregate with proper lifecycle
- [ ] Create InvoiceRepository with optimistic locking
- [ ] Build RESTful API endpoints with proper semantics
- [ ] Add smart save endpoint for unified create/update
- [ ] Implement comprehensive error handling
- [ ] Add API documentation and OpenAPI specs

### Frontend Development
- [ ] Create InvoiceContext for state management
- [ ] Build smart SaveButton component
- [ ] Implement auto-save with proper state detection
- [ ] Add loading states and error handling
- [ ] Create title prompt modal for new invoices
- [ ] Integrate with existing invoice forms

### Testing & Quality
- [ ] Write comprehensive unit tests for domain model
- [ ] Create integration tests for repository and API
- [ ] Implement full E2E test suite with Playwright
- [ ] Add performance testing for save operations
- [ ] Include accessibility testing for all components
- [ ] Set up continuous testing in CI/CD pipeline

### Documentation & Training
- [ ] Update API documentation
- [ ] Create user guide for new save behavior
- [ ] Document troubleshooting procedures
- [ ] Train support team on new functionality

This comprehensive design addresses the root cause of the invoice save confusion while providing a robust, testable, and maintainable solution that significantly improves the user experience.