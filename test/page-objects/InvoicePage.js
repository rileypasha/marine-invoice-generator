/**
 * Page Object Model for Invoice Pages
 *
 * Provides stable selectors and common operations for invoice testing
 */

class InvoicePage {
  constructor(page) {
    this.page = page;
  }

  // Selectors using data-testid for stability
  get vesselNameInput() { return this.page.locator('[data-testid="vessel-name"]'); }
  get vesselWeightInput() { return this.page.locator('[data-testid="vessel-weight"]'); }
  get vesselBeamInput() { return this.page.locator('[data-testid="vessel-beam"]'); }

  get customerNameInput() { return this.page.locator('[data-testid="customer-name"]'); }
  get customerEmailInput() { return this.page.locator('[data-testid="customer-email"]'); }
  get customerPhoneInput() { return this.page.locator('[data-testid="customer-phone"]'); }

  get addLineItemBtn() { return this.page.locator('[data-testid="add-line-item"]'); }
  get saveInvoiceBtn() { return this.page.locator('[data-testid="save-invoice-btn"]'); }
  get newInvoiceBtn() { return this.page.locator('[data-testid="new-invoice-btn"]'); }

  // Dynamic selectors
  lineItemDescription(index) {
    return this.page.locator(`[data-testid="line-item-description-${index}"]`);
  }
  lineItemCost(index) {
    return this.page.locator(`[data-testid="manual-cost-${index}"]`);
  }
  removeLineItemBtn(index) {
    return this.page.locator(`[data-testid="remove-line-item-${index}"]`);
  }

  // Modal elements
  get invoiceTitleInput() { return this.page.locator('[data-testid="invoice-title-input"]'); }
  get confirmSaveBtn() { return this.page.locator('[data-testid="confirm-save-btn"]'); }
  get cancelSaveBtn() { return this.page.locator('[data-testid="cancel-save-btn"]'); }

  // Notifications
  get successNotification() { return this.page.locator('[data-testid="success-notification"]'); }
  get errorNotification() { return this.page.locator('[data-testid="error-notification"]'); }
  get warningNotification() { return this.page.locator('[data-testid="warning-notification"]'); }

  // Sidebar elements
  get savedInvoicesList() { return this.page.locator('[data-testid="saved-invoices"]'); }
  get savedInvoiceItems() { return this.page.locator('[data-testid="saved-invoice-item"]'); }

  // Authentication elements
  get emailInput() { return this.page.locator('#email'); }
  get passwordInput() { return this.page.locator('#password'); }
  get loginBtn() { return this.page.locator('#loginBtn'); }

  /**
   * Navigate to invoice app and ensure authentication
   */
  async navigateAndAuthenticate(credentials = null) {
    await this.page.goto('/');

    // Handle authentication if login form is visible
    if (await this.emailInput.isVisible()) {
      const creds = credentials || {
        email: 'test@marinegroup.com',
        password: 'test123'
      };

      await this.emailInput.fill(creds.email);
      await this.passwordInput.fill(creds.password);
      await this.loginBtn.click();

      // Wait for redirect
      await this.page.waitForFunction(() =>
        window.location.pathname === '/app' || window.location.pathname === '/'
      );
    }

    // Navigate to app if needed
    if (!this.page.url().includes('/app')) {
      await this.page.goto('/app');
    }

    // Wait for app to load
    await this.vesselNameInput.waitFor({ timeout: 10000 });
  }

  /**
   * Fill vessel information
   */
  async fillVesselInfo(vesselData) {
    if (vesselData.name) {
      await this.vesselNameInput.fill(vesselData.name);
    }
    if (vesselData.weight) {
      await this.vesselWeightInput.fill(vesselData.weight);
    }
    if (vesselData.beam) {
      await this.vesselBeamInput.fill(vesselData.beam);
    }
  }

  /**
   * Fill customer information
   */
  async fillCustomerInfo(customerData) {
    if (customerData.name) {
      await this.customerNameInput.fill(customerData.name);
    }
    if (customerData.email) {
      await this.customerEmailInput.fill(customerData.email);
    }
    if (customerData.phone) {
      await this.customerPhoneInput.fill(customerData.phone);
    }
  }

  /**
   * Add a line item with specified data
   */
  async addLineItem(itemData, index = null) {
    await this.addLineItemBtn.click();

    // Determine the index if not provided
    if (index === null) {
      const existingItems = await this.page.locator('[data-testid^="line-item-description-"]').count();
      index = existingItems - 1; // Most recently added
    }

    if (itemData.description) {
      await this.lineItemDescription(index).fill(itemData.description);
    }
    if (itemData.cost) {
      await this.lineItemCost(index).fill(itemData.cost.toString());
    }

    return index;
  }

  /**
   * Save invoice with title
   */
  async saveInvoice(title) {
    await this.saveInvoiceBtn.click();

    // Handle save dialog if it appears
    try {
      await this.invoiceTitleInput.waitFor({ timeout: 5000 });
      if (title) {
        await this.invoiceTitleInput.fill(title);
      }
      await this.confirmSaveBtn.click();
    } catch (error) {
      // If no dialog appears, that's fine (edit mode scenario)
      console.log('No save dialog appeared - likely in edit mode');
    }

    // Wait for save completion
    await this.successNotification.waitFor({ timeout: 10000 });
  }

  /**
   * Update existing invoice (should not show dialog)
   */
  async updateInvoice() {
    await this.saveInvoiceBtn.click();

    // Should NOT show save dialog in edit mode
    const dialogAppeared = await this.invoiceTitleInput.isVisible({ timeout: 2000 });
    if (dialogAppeared) {
      throw new Error('REGRESSION: Save dialog appeared when updating existing invoice');
    }

    // Wait for save completion
    await this.successNotification.waitFor({ timeout: 10000 });
  }

  /**
   * Check if currently in edit mode
   */
  async isInEditMode() {
    return await this.page.evaluate(() => {
      return window.app?.state?.getIsEditMode() === true;
    });
  }

  /**
   * Get current invoice ID
   */
  async getCurrentInvoiceId() {
    return await this.page.evaluate(() => {
      return window.app?.state?.getCurrentInvoiceId();
    });
  }

  /**
   * Wait for edit mode to be established
   */
  async waitForEditMode() {
    await this.page.waitForFunction(() => {
      return window.app?.state?.getIsEditMode() === true;
    }, { timeout: 5000 });
  }

  /**
   * Get count of saved invoices
   */
  async getSavedInvoiceCount() {
    return await this.page.evaluate(() => {
      return window.app?.storage?.getAllInvoices()?.length || 0;
    });
  }

  /**
   * Load an existing invoice from sidebar
   */
  async loadExistingInvoice(index = 0) {
    const invoiceItems = this.savedInvoiceItems;
    const count = await invoiceItems.count();

    if (count === 0) {
      throw new Error('No saved invoices available to load');
    }

    if (index >= count) {
      throw new Error(`Invoice index ${index} out of range (${count} invoices available)`);
    }

    await invoiceItems.nth(index).click();
    await this.vesselNameInput.waitFor(); // Wait for form to populate
  }

  /**
   * Create a complete test invoice
   */
  async createTestInvoice(options = {}) {
    const defaults = {
      vessel: {
        name: 'Test Vessel',
        weight: '1000',
        beam: '20'
      },
      customer: {
        name: 'Test Customer',
        email: 'test@example.com',
        phone: '555-0123'
      },
      lineItems: [
        { description: 'Test Service', cost: 100 }
      ],
      title: 'Test Invoice'
    };

    const data = { ...defaults, ...options };

    await this.fillVesselInfo(data.vessel);
    await this.fillCustomerInfo(data.customer);

    for (const item of data.lineItems) {
      await this.addLineItem(item);
    }

    await this.saveInvoice(data.title);
  }

  /**
   * Monitor network requests for API calls
   */
  async setupNetworkMonitoring() {
    const requests = [];

    this.page.on('request', request => {
      if (request.url().includes('/api/')) {
        requests.push({
          url: request.url(),
          method: request.method(),
          timestamp: Date.now()
        });
      }
    });

    return requests;
  }

  /**
   * Get API requests of specific types
   */
  getAPIRequests(requests, filter = {}) {
    return requests.filter(req => {
      if (filter.method && req.method !== filter.method) return false;
      if (filter.urlContains && !req.url.includes(filter.urlContains)) return false;
      return true;
    });
  }

  /**
   * Wait for specific notification type
   */
  async waitForNotification(type = 'success', timeout = 5000) {
    const selectors = {
      success: this.successNotification,
      error: this.errorNotification,
      warning: this.warningNotification
    };

    const notification = selectors[type];
    if (!notification) {
      throw new Error(`Unknown notification type: ${type}`);
    }

    await notification.waitFor({ timeout });
    return await notification.textContent();
  }

  /**
   * Verify invoice data persistence
   */
  async verifyInvoiceData(expectedData) {
    const actualData = {
      vessel: {
        name: await this.vesselNameInput.inputValue(),
        weight: await this.vesselWeightInput.inputValue(),
        beam: await this.vesselBeamInput.inputValue()
      },
      customer: {
        name: await this.customerNameInput.inputValue(),
        email: await this.customerEmailInput.inputValue(),
        phone: await this.customerPhoneInput.inputValue()
      }
    };

    return {
      actual: actualData,
      matches: {
        vesselName: actualData.vessel.name === expectedData.vessel?.name,
        vesselWeight: actualData.vessel.weight === expectedData.vessel?.weight,
        vesselBeam: actualData.vessel.beam === expectedData.vessel?.beam,
        customerName: actualData.customer.name === expectedData.customer?.name,
        customerEmail: actualData.customer.email === expectedData.customer?.email,
        customerPhone: actualData.customer.phone === expectedData.customer?.phone
      }
    };
  }

  /**
   * Handle dialog events (for testing navigation warnings)
   */
  async expectNavigationWarning(shouldWarn = true) {
    let dialogHandled = false;

    if (shouldWarn) {
      const dialogPromise = this.page.waitForEvent('dialog');

      return {
        trigger: async (action) => {
          const actionPromise = action();
          try {
            const dialog = await dialogPromise;
            expect(dialog.message()).toContain('unsaved');
            await dialog.accept();
            dialogHandled = true;
            await actionPromise;
          } catch (error) {
            if (!dialogHandled) {
              throw new Error('Expected navigation warning dialog but none appeared');
            }
          }
        }
      };
    } else {
      this.page.on('dialog', dialog => {
        throw new Error(`Unexpected navigation warning: ${dialog.message()}`);
      });

      return {
        trigger: async (action) => {
          await action();
          await this.page.waitForTimeout(1000); // Give time for dialog to appear
        }
      };
    }
  }
}

module.exports = { InvoicePage };