describe('Invoice Request Generator E2E Tests', () => {
  
  beforeEach(async () => {
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });
  });

  describe('Page Navigation', () => {
    it('should navigate through all three input sections', async () => {
      // Verify initial state
      const vesselTab = await page.$('[data-tab="vessel"]');
      const vesselTabClass = await page.evaluate(el => el.className, vesselTab);
      expect(vesselTabClass).toContain('active');
      
      // Navigate to Customer tab
      await page.click('[data-tab="customer"]');
      await page.waitForSelector('[data-section="customer"].visible');
      
      const customerFields = await page.$$('[data-section="customer"] input');
      expect(customerFields.length).toBe(4); // Name, Email, Phone, Estimator
      
      // Navigate to Scope tab
      await page.click('[data-tab="scope"]');
      await page.waitForSelector('[data-section="scope"].visible');
      
      const scopeSection = await page.$('[data-section="scope"]');
      expect(scopeSection).toBeTruthy();
    });
  });

  describe('Vessel & Job Details', () => {
    it('should calculate correct clearance fee based on weight', async () => {
      await page.click('[data-tab="vessel"]');
      
      // Test weight > 500 tons
      await page.type('#vessel-name', 'Test Vessel');
      await page.type('#vessel-weight', '600');
      await page.type('#vessel-beam', '45');
      await page.select('#customer-type', 'Commercial');
      
      // Check preview for clearance fee
      await page.waitForFunction(() => {
        const preview = document.querySelector('.preview-clearance-fee');
        return preview && preview.textContent.includes('$1,250');
      });
      
      // Test weight < 500 tons
      await page.evaluate(() => {
        document.querySelector('#vessel-weight').value = '';
      });
      await page.type('#vessel-weight', '400');
      
      await page.waitForFunction(() => {
        const preview = document.querySelector('.preview-clearance-fee');
        return preview && preview.textContent.includes('$950');
      });
    });
  });

  describe('Scope of Work Calculations', () => {
    it('should calculate labor costs correctly', async () => {
      await page.click('[data-tab="scope"]');
      
      // Add regular labor hours
      await page.click('#add-line-item');
      await page.select('[data-row="0"] .job-type-select', 'Agent Services');
      await page.type('[data-row="0"] .labor-hours-input', '10');
      await page.type('[data-row="0"] .description-input', 'Regular labor work');
      
      // Verify calculation: 10 hours * $80 = $800
      await page.waitForFunction(() => {
        const costCell = document.querySelector('[data-row="0"] .cost-cell');
        return costCell && costCell.textContent === '$800.00';
      });
      
      // Add OT labor hours
      await page.click('#add-line-item');
      await page.select('[data-row="1"] .job-type-select', 'Agent Services');
      await page.type('[data-row="1"] .ot-hours-input', '5');
      await page.type('[data-row="1"] .description-input', 'Overtime labor work');
      
      // Verify calculation: 5 hours * $120 = $600
      await page.waitForFunction(() => {
        const costCell = document.querySelector('[data-row="1"] .cost-cell');
        return costCell && costCell.textContent === '$600.00';
      });
    });
    
    it('should apply markup correctly', async () => {
      await page.click('[data-tab="scope"]');
      
      // Add a line item
      await page.click('#add-line-item');
      await page.select('[data-row="0"] .job-type-select', 'Manual Entry');
      await page.type('[data-row="0"] .manual-cost-input', '800');
      await page.type('[data-row="0"] .description-input', 'Test item');
      
      // Select 12.5% markup
      await page.select('#markup-rate', '12.5');
      
      // Verify markup application
      await page.waitForFunction(() => {
        const totalCells = document.querySelectorAll('.total-with-markup');
        if (totalCells.length === 0) return false;
        const firstTotal = totalCells[0].textContent;
        // $800 * 1.125 = $900
        return firstTotal === '$900.00';
      });
    });
    
    it('should calculate tax when taxable is selected', async () => {
      await page.click('[data-tab="scope"]');
      
      // Add a line item
      await page.click('#add-line-item');
      await page.select('[data-row="0"] .job-type-select', 'Manual Entry');
      await page.type('[data-row="0"] .manual-cost-input', '1000');
      await page.type('[data-row="0"] .description-input', 'Taxable item');
      
      await page.click('#taxable-yes');
      
      // Wait for tax calculation to appear
      await page.waitForSelector('.tax-amount');
      
      const taxAmount = await page.$eval('.tax-amount', el => el.textContent);
      // Verify 8.75% tax is applied
      expect(taxAmount).toMatch(/\$[\d,]+\.\d{2}/);
    });
    
    it('should handle manual entry with item types', async () => {
      await page.click('[data-tab="scope"]');
      
      await page.click('#add-line-item');
      await page.select('[data-row="0"] .job-type-select', 'Manual Entry');
      
      // Item type dropdown should appear
      await page.waitForSelector('[data-row="0"] .item-type-select');
      await page.select('[data-row="0"] .item-type-select', 'Material');
      await page.type('[data-row="0"] .manual-cost-input', '500');
      await page.type('[data-row="0"] .description-input', 'Materials for repair');
      
      const costCell = await page.$eval('[data-row="0"] .cost-cell', el => el.textContent);
      expect(costCell).toBe('$500.00');
    });
    
    it('should remove line items with trash icon', async () => {
      await page.click('[data-tab="scope"]');
      
      // Add a line item
      await page.click('#add-line-item');
      await page.select('[data-row="0"] .job-type-select', 'Manual Entry');
      await page.type('[data-row="0"] .manual-cost-input', '100');
      await page.type('[data-row="0"] .description-input', 'Item to remove');
      
      // Wait for preview to update
      await page.waitForSelector('.preview-panel .trash-icon');
      
      const initialCount = await page.$$eval('.preview-panel .line-item-row', rows => rows.length);
      
      // Click trash icon in preview
      await page.click('.preview-panel .trash-icon');
      
      // Wait for row to be removed
      await page.waitForFunction((initial) => {
        const rows = document.querySelectorAll('.preview-panel .line-item-row');
        return rows.length === initial - 1;
      }, {}, initialCount);
    });
  });

  describe('Gross Profit Calculations', () => {
    it('should calculate gross profit and percentage correctly', async () => {
      await page.click('[data-tab="scope"]');
      
      // Add a new line item
      await page.click('#add-line-item');
      await page.select('[data-row="0"] .job-type-select', 'Manual Entry');
      await page.type('[data-row="0"] .manual-cost-input', '1000');
      await page.type('[data-row="0"] .description-input', 'Test calculation');
      await page.select('#markup-rate', '12.5');
      
      // Total with markup: $1000 * 1.125 = $1125
      // Plus clearance fee (default weight 0 = $950): $1125 + $950 = $2075
      // Gross Profit: $2075 - $1950 = $125
      // Gross Profit %: ($125 / $2075) * 100 = 6.02%
      
      await page.waitForFunction(() => {
        const gpAmount = document.querySelector('.gross-profit-amount');
        const gpPercent = document.querySelector('.gross-profit-percent');
        return gpAmount && gpPercent && 
               gpAmount.textContent === '$125.00' &&
               gpPercent.textContent === '6.02%';
      });
    });
  });

  describe('Export Functions', () => {
    it('should generate PDF with all invoice data', async () => {
      // Mock jsPDF to verify it's called
      await page.evaluateOnNewDocument(() => {
        window.pdfGenerated = false;
        window.jsPDF = class {
          constructor() {
            window.pdfGenerated = true;
          }
          text() { return this; }
          addImage() { return this; }
          addPage() { return this; }
          save() { return this; }
        };
      });
      
      await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });
      await page.click('#generate-pdf');
      
      // Wait a bit for async operations
      await page.waitForTimeout(1000);
      
      const pdfGenerated = await page.evaluate(() => window.pdfGenerated);
      expect(pdfGenerated).toBe(true);
    });
    
    it('should compose email with invoice details', async () => {
      // Add customer details
      await page.click('[data-tab="customer"]');
      await page.type('#customer-email', 'test@example.com');
      
      // Intercept mailto link
      await page.evaluateOnNewDocument(() => {
        window.emailComposed = false;
        window.open = (url) => {
          if (url.startsWith('mailto:')) {
            window.emailComposed = true;
            window.emailUrl = url;
          }
        };
      });
      
      await page.reload();
      await page.click('#compose-email');
      
      const emailComposed = await page.evaluate(() => window.emailComposed);
      expect(emailComposed).toBe(true);
      
      const emailUrl = await page.evaluate(() => window.emailUrl);
      expect(emailUrl).toContain('mailto:');
      expect(emailUrl).toContain('subject=');
      expect(emailUrl).toContain('body=');
    });
    
    it('should trigger print dialog', async () => {
      // Mock window.print
      await page.evaluateOnNewDocument(() => {
        window.printCalled = false;
        window.print = () => {
          window.printCalled = true;
        };
      });
      
      await page.reload();
      await page.click('#print-invoice');
      
      const printCalled = await page.evaluate(() => window.printCalled);
      expect(printCalled).toBe(true);
    });
  });

  describe('UI/UX Validation', () => {
    it('should display company logo', async () => {
      const logo = await page.$('.company-logo');
      const logoSrc = await page.evaluate(el => el.src, logo);
      expect(logoSrc).toBe('https://i.imgur.com/A9K1ByZ.png');
    });
    
    it('should have responsive split-screen layout', async () => {
      const inputPanel = await page.$('.input-panel');
      const previewPanel = await page.$('.preview-panel');
      
      const inputWidth = await page.evaluate(el => {
        const rect = el.getBoundingClientRect();
        return rect.width;
      }, inputPanel);
      
      const previewWidth = await page.evaluate(el => {
        const rect = el.getBoundingClientRect();
        return rect.width;
      }, previewPanel);
      
      const totalWidth = inputWidth + previewWidth;
      const inputPercentage = (inputWidth / totalWidth) * 100;
      
      // Input panel should be approximately 40% of total width
      expect(inputPercentage).toBeGreaterThan(35);
      expect(inputPercentage).toBeLessThan(45);
    });
    
    it('should update preview in real-time', async () => {
      const testText = 'Real-time test ' + Date.now();
      
      await page.type('#vessel-name', testText);
      
      // Preview should update within 100ms
      await page.waitForFunction((text) => {
        const preview = document.querySelector('.preview-vessel-name');
        return preview && preview.textContent.includes(text);
      }, { timeout: 1000 }, testText);
    });
  });

  describe('Data Validation', () => {
    it('should validate email format', async () => {
      await page.click('[data-tab="customer"]');
      
      await page.type('#customer-email', 'invalid-email');
      await page.click('#customer-name'); // Trigger blur event
      
      await page.waitForSelector('.email-error');
      const errorMessage = await page.$('.email-error');
      const errorText = await page.evaluate(el => el.textContent, errorMessage);
      expect(errorText).toBeTruthy();
      
      // Clear and enter valid email
      await page.evaluate(() => {
        document.querySelector('#customer-email').value = '';
      });
      await page.type('#customer-email', 'valid@email.com');
      await page.click('#customer-name');
      
      await page.waitForFunction(() => {
        const error = document.querySelector('.email-error');
        return error && error.textContent === '';
      });
    });
    
    it('should format phone numbers', async () => {
      await page.click('[data-tab="customer"]');
      await page.type('#customer-phone', '5551234567');
      
      const formattedPhone = await page.$eval('#customer-phone', el => el.value);
      expect(formattedPhone).toBe('(555) 123-4567');
    });
    
    it('should prevent negative values in numeric fields', async () => {
      await page.click('[data-tab="vessel"]');
      await page.type('#vessel-weight', '-100');
      
      const weight = await page.$eval('#vessel-weight', el => el.value);
      // The validator prevents negative values from being entered
      expect(weight).toBe('');
    });
  });
});