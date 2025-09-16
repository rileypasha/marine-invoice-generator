import { Page, Locator, expect } from '@playwright/test';

/**
 * Page Object Model for Invoice Form
 * Provides reusable methods for interacting with invoice forms in tests
 */
export class InvoicePage {
  readonly page: Page;

  // Form elements
  readonly titleInput: Locator;
  readonly customerNameInput: Locator;
  readonly customerEmailInput: Locator;
  readonly customerPhoneInput: Locator;
  readonly vesselNameInput: Locator;
  readonly vesselWeightInput: Locator;
  readonly vesselBeamInput: Locator;
  readonly laborRateInput: Locator;
  readonly otRateInput: Locator;
  readonly markupRateInput: Locator;
  readonly isTaxableCheckbox: Locator;
  readonly notesTextarea: Locator;

  // Line items
  readonly addLineItemButton: Locator;
  readonly lineItemsContainer: Locator;

  // Actions
  readonly saveButton: Locator;
  readonly finalizeButton: Locator;
  readonly cloneButton: Locator;
  readonly deleteButton: Locator;

  // Status indicators
  readonly invoiceIdDisplay: Locator;
  readonly invoiceStateDisplay: Locator;
  readonly unsavedChangesIndicator: Locator;
  readonly saveSuccessMessage: Locator;
  readonly saveErrorMessage: Locator;
  readonly saveSuccessTooltip: Locator;

  // Loading states
  readonly loadingSpinner: Locator;
  readonly saveSpinner: Locator;

  constructor(page: Page) {
    this.page = page;

    // Form elements
    this.titleInput = page.locator('[data-testid="invoice-title"]');
    this.customerNameInput = page.locator('[data-testid="customer-name"]');
    this.customerEmailInput = page.locator('[data-testid="customer-email"]');
    this.customerPhoneInput = page.locator('[data-testid="customer-phone"]');
    this.vesselNameInput = page.locator('[data-testid="vessel-name"]');
    this.vesselWeightInput = page.locator('[data-testid="vessel-weight"]');
    this.vesselBeamInput = page.locator('[data-testid="vessel-beam"]');
    this.laborRateInput = page.locator('[data-testid="labor-rate"]');
    this.otRateInput = page.locator('[data-testid="ot-rate"]');
    this.markupRateInput = page.locator('[data-testid="markup-rate"]');
    this.isTaxableCheckbox = page.locator('[data-testid="is-taxable"]');
    this.notesTextarea = page.locator('[data-testid="notes"]');

    // Line items
    this.addLineItemButton = page.locator('[data-testid="add-line-item"]');
    this.lineItemsContainer = page.locator('[data-testid="line-items-container"]');

    // Actions
    this.saveButton = page.locator('[data-testid="save-button"]');
    this.finalizeButton = page.locator('[data-testid="finalize-button"]');
    this.cloneButton = page.locator('[data-testid="clone-button"]');
    this.deleteButton = page.locator('[data-testid="delete-button"]');

    // Status indicators
    this.invoiceIdDisplay = page.locator('[data-testid="invoice-id"]');
    this.invoiceStateDisplay = page.locator('[data-testid="invoice-state"]');
    this.unsavedChangesIndicator = page.locator('[data-testid="unsaved-changes-indicator"]');
    this.saveSuccessMessage = page.locator('[data-testid="save-success"]');
    this.saveErrorMessage = page.locator('[data-testid="save-error"]');
    this.saveSuccessTooltip = page.locator('[data-testid="save-success-tooltip"]');

    // Loading states
    this.loadingSpinner = page.locator('[data-testid="loading-spinner"]');
    this.saveSpinner = page.locator('.save-button__spinner');
  }

  // Navigation methods
  async goToNewInvoice() {
    await this.page.goto('http://localhost:3000/invoice/new');
    await this.page.waitForLoadState('networkidle');
  }

  async goToEditInvoice(invoiceId: string) {
    await this.page.goto(`http://localhost:3000/invoice/${invoiceId}/edit`);
    await this.page.waitForLoadState('networkidle');
  }

  async goToInvoiceList() {
    await this.page.goto('http://localhost:3000/invoices');
    await this.page.waitForLoadState('networkidle');
  }

  // Form filling methods
  async fillBasicInvoiceInfo(data: {
    title?: string;
    customerName?: string;
    customerEmail?: string;
    customerPhone?: string;
    vesselName?: string;
    vesselWeight?: number;
    vesselBeam?: number;
  }) {
    if (data.title) {
      await this.titleInput.fill(data.title);
    }
    if (data.customerName) {
      await this.customerNameInput.fill(data.customerName);
    }
    if (data.customerEmail) {
      await this.customerEmailInput.fill(data.customerEmail);
    }
    if (data.customerPhone) {
      await this.customerPhoneInput.fill(data.customerPhone);
    }
    if (data.vesselName) {
      await this.vesselNameInput.fill(data.vesselName);
    }
    if (data.vesselWeight) {
      await this.vesselWeightInput.fill(String(data.vesselWeight));
    }
    if (data.vesselBeam) {
      await this.vesselBeamInput.fill(String(data.vesselBeam));
    }
  }

  async addLineItem(data: {
    description: string;
    quantity: number;
    rate: number;
    laborHours?: number;
    overtimeHours?: number;
  }) {
    await this.addLineItemButton.click();

    // Get the newly added line item (last one)
    const lineItems = this.page.locator('[data-testid^="line-item-"]');
    const lineItemCount = await lineItems.count();
    const lineItemIndex = lineItemCount - 1;

    await this.page.locator(`[data-testid="line-item-${lineItemIndex}-description"]`).fill(data.description);
    await this.page.locator(`[data-testid="line-item-${lineItemIndex}-quantity"]`).fill(String(data.quantity));
    await this.page.locator(`[data-testid="line-item-${lineItemIndex}-rate"]`).fill(String(data.rate));

    if (data.laborHours) {
      await this.page.locator(`[data-testid="line-item-${lineItemIndex}-labor-hours"]`).fill(String(data.laborHours));
    }
    if (data.overtimeHours) {
      await this.page.locator(`[data-testid="line-item-${lineItemIndex}-overtime-hours"]`).fill(String(data.overtimeHours));
    }
  }

  async fillCompleteInvoice(data: {
    title: string;
    customerName: string;
    customerEmail?: string;
    vesselName: string;
    lineItems: Array<{
      description: string;
      quantity: number;
      rate: number;
    }>;
    laborRate?: number;
    markupRate?: number;
    isTaxable?: boolean;
  }) {
    await this.fillBasicInvoiceInfo({
      title: data.title,
      customerName: data.customerName,
      customerEmail: data.customerEmail,
      vesselName: data.vesselName
    });

    // Add line items
    for (const lineItem of data.lineItems) {
      await this.addLineItem(lineItem);
    }

    // Set rates if provided
    if (data.laborRate) {
      await this.laborRateInput.fill(String(data.laborRate));
    }
    if (data.markupRate) {
      await this.markupRateInput.fill(String(data.markupRate));
    }
    if (data.isTaxable !== undefined) {
      if (data.isTaxable) {
        await this.isTaxableCheckbox.check();
      } else {
        await this.isTaxableCheckbox.uncheck();
      }
    }
  }

  // Action methods
  async saveInvoice() {
    await this.saveButton.click();
    await this.page.waitForLoadState('networkidle');
  }

  async finalizeInvoice() {
    await this.finalizeButton.click();
    await this.page.waitForLoadState('networkidle');
  }

  async cloneInvoice(newTitle?: string) {
    await this.cloneButton.click();
    if (newTitle) {
      const cloneTitleInput = this.page.locator('[data-testid="clone-title-input"]');
      await cloneTitleInput.fill(newTitle);
    }
    await this.page.locator('[data-testid="confirm-clone"]').click();
    await this.page.waitForLoadState('networkidle');
  }

  // Verification methods
  async expectSaveButtonState(expectedText: string, shouldBeEnabled: boolean = true) {
    await expect(this.saveButton).toContainText(expectedText);
    if (shouldBeEnabled) {
      await expect(this.saveButton).toBeEnabled();
    } else {
      await expect(this.saveButton).toBeDisabled();
    }
  }

  async expectInvoiceState(expectedState: string) {
    await expect(this.invoiceStateDisplay).toContainText(expectedState);
  }

  async expectUnsavedChanges(shouldBeVisible: boolean = true) {
    if (shouldBeVisible) {
      await expect(this.unsavedChangesIndicator).toBeVisible();
    } else {
      await expect(this.unsavedChangesIndicator).not.toBeVisible();
    }
  }

  async expectSaveSuccess(message?: string) {
    await expect(this.saveSuccessMessage).toBeVisible();
    if (message) {
      await expect(this.saveSuccessMessage).toContainText(message);
    }
  }

  async expectSaveError(message?: string) {
    await expect(this.saveErrorMessage).toBeVisible();
    if (message) {
      await expect(this.saveErrorMessage).toContainText(message);
    }
  }

  async expectFormData(data: {
    title?: string;
    customerName?: string;
    customerEmail?: string;
    vesselName?: string;
  }) {
    if (data.title) {
      await expect(this.titleInput).toHaveValue(data.title);
    }
    if (data.customerName) {
      await expect(this.customerNameInput).toHaveValue(data.customerName);
    }
    if (data.customerEmail) {
      await expect(this.customerEmailInput).toHaveValue(data.customerEmail);
    }
    if (data.vesselName) {
      await expect(this.vesselNameInput).toHaveValue(data.vesselName);
    }
  }

  // Utility methods
  async getInvoiceId(): Promise<string | null> {
    return await this.invoiceIdDisplay.textContent();
  }

  async getInvoiceState(): Promise<string | null> {
    return await this.invoiceStateDisplay.textContent();
  }

  async waitForSaveCompletion() {
    await expect(this.saveSpinner).not.toBeVisible();
    await this.page.waitForLoadState('networkidle');
  }

  async waitForLoadingComplete() {
    await expect(this.loadingSpinner).not.toBeVisible();
    await this.page.waitForLoadState('networkidle');
  }

  // API monitoring methods
  setupSmartSaveMonitoring(): Array<{ url: string; method: string; body: any }> {
    const apiRequests: Array<{ url: string; method: string; body: any }> = [];

    this.page.on('request', async request => {
      if (request.url().includes('/api/v3/invoices/smart-save')) {
        const body = request.postData() ? JSON.parse(request.postData()!) : {};
        apiRequests.push({
          url: request.url(),
          method: request.method(),
          body
        });
      }
    });

    return apiRequests;
  }

  setupNetworkFailure(endpoint: string = '/api/v3/invoices/smart-save', errorMessage: string = 'Server error') {
    return this.page.route(endpoint, route => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: { message: errorMessage }
        })
      });
    });
  }
}

/**
 * Authentication helper for tests
 */
export class AuthHelper {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async loginAsTestUser() {
    await this.page.goto('http://localhost:3000/login');
    await this.page.fill('#username', 'test@marinegroupbw.com');
    await this.page.fill('#password', 'test123');
    await this.page.click('#login-button');
    await this.page.waitForLoadState('networkidle');
  }

  async logout() {
    await this.page.goto('http://localhost:3000/logout');
    await this.page.waitForLoadState('networkidle');
  }

  async clearSession() {
    await this.page.context().clearCookies();
  }
}

/**
 * Test data factories
 */
export const TestDataFactory = {
  basicInvoice: (overrides: any = {}) => ({
    title: 'Test Invoice',
    customerName: 'Test Customer',
    customerEmail: 'test@example.com',
    vesselName: 'Test Vessel',
    lineItems: [
      {
        description: 'Marine Service',
        quantity: 1,
        rate: 100
      }
    ],
    ...overrides
  }),

  complexInvoice: (overrides: any = {}) => ({
    title: 'Complex Test Invoice',
    customerName: 'Complex Customer',
    customerEmail: 'complex@example.com',
    vesselName: 'Complex Vessel',
    lineItems: [
      { description: 'Hull Cleaning', quantity: 2, rate: 150 },
      { description: 'Engine Maintenance', quantity: 1, rate: 300 },
      { description: 'Electrical Work', quantity: 3, rate: 100 }
    ],
    laborRate: 85,
    markupRate: 0.15,
    isTaxable: true,
    ...overrides
  })
};