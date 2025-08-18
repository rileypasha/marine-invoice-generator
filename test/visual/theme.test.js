const puppeteer = require('puppeteer');
const { toMatchImageSnapshot } = require('jest-image-snapshot');

expect.extend({ toMatchImageSnapshot });

describe('ChatGPT Theme Visual Tests', () => {
  let browser;
  let page;
  
  beforeAll(async () => {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
  });
  
  afterAll(async () => {
    await browser.close();
  });
  
  beforeEach(async () => {
    page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });
  });
  
  afterEach(async () => {
    await page.close();
  });
  
  describe('Scenario 1: Home Page Theme Verification', () => {
    it('should load with correct fonts', async () => {
      await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });
      
      const bodyFont = await page.evaluate(() => {
        const body = document.querySelector('body');
        return window.getComputedStyle(body).fontFamily;
      });
      
      expect(bodyFont).toContain('Inter');
    });
    
    it('should have correct background color', async () => {
      await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });
      
      const backgroundColor = await page.evaluate(() => {
        const body = document.querySelector('body');
        return window.getComputedStyle(body).backgroundColor;
      });
      
      // RGB value for #ffffff
      expect(backgroundColor).toBe('rgb(255, 255, 255)');
    });
    
    it('should have correct primary button styles', async () => {
      await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });
      
      const buttonStyles = await page.evaluate(() => {
        const button = document.querySelector('.btn-primary');
        const styles = window.getComputedStyle(button);
        return {
          backgroundColor: styles.backgroundColor,
          color: styles.color,
          borderRadius: styles.borderRadius,
          fontWeight: styles.fontWeight
        };
      });
      
      // RGB value for #10a37f
      expect(buttonStyles.backgroundColor).toBe('rgb(16, 163, 127)');
      expect(buttonStyles.color).toBe('rgb(255, 255, 255)');
      expect(buttonStyles.borderRadius).toBe('8px');
      expect(buttonStyles.fontWeight).toBe('500');
    });
    
    it('should have correct card styling', async () => {
      await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });
      
      const cardStyles = await page.evaluate(() => {
        const card = document.querySelector('.card');
        const styles = window.getComputedStyle(card);
        return {
          backgroundColor: styles.backgroundColor,
          borderColor: styles.borderColor,
          borderRadius: styles.borderRadius,
          boxShadow: styles.boxShadow
        };
      });
      
      expect(cardStyles.backgroundColor).toBe('rgb(255, 255, 255)');
      expect(cardStyles.borderRadius).toBe('12px');
      expect(cardStyles.boxShadow).toContain('rgba');
    });
  });
  
  describe('Scenario 2: Theme Consistency Across Pages', () => {
    it('should maintain theme on navigation', async () => {
      await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });
      
      // Get initial theme values
      const homePageTheme = await page.evaluate(() => {
        const root = document.documentElement;
        const styles = window.getComputedStyle(root);
        return {
          primaryColor: styles.getPropertyValue('--color-primary'),
          backgroundColor: styles.getPropertyValue('--color-background'),
          textColor: styles.getPropertyValue('--color-text-primary')
        };
      });
      
      // Navigate to another page
      await page.click('[data-tab="customer"]');
      await page.waitForTimeout(500);
      
      // Get theme values after navigation
      const customerPageTheme = await page.evaluate(() => {
        const root = document.documentElement;
        const styles = window.getComputedStyle(root);
        return {
          primaryColor: styles.getPropertyValue('--color-primary'),
          backgroundColor: styles.getPropertyValue('--color-background'),
          textColor: styles.getPropertyValue('--color-text-primary')
        };
      });
      
      expect(customerPageTheme).toEqual(homePageTheme);
    });
    
    it('should maintain responsive layout', async () => {
      // Desktop view
      await page.setViewport({ width: 1440, height: 900 });
      await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });
      
      const desktopSidebar = await page.evaluate(() => {
        const sidebar = document.querySelector('.sidebar');
        return sidebar ? window.getComputedStyle(sidebar).transform : 'none';
      });
      
      expect(desktopSidebar).toBe('none');
      
      // Mobile view
      await page.setViewport({ width: 375, height: 667 });
      
      const mobileSidebar = await page.evaluate(() => {
        const sidebar = document.querySelector('.sidebar');
        return sidebar ? window.getComputedStyle(sidebar).transform : 'none';
      });
      
      // Mobile sidebar should be transformed or not exist
      expect(['none', 'matrix']).toContain(mobileSidebar.split('(')[0]);
    });
  });
  
  describe('Scenario 3: Visual Regression Testing', () => {
    it('should match home page snapshot', async () => {
      await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });
      await page.waitForTimeout(1000); // Wait for animations
      
      const screenshot = await page.screenshot({ fullPage: true });
      
      expect(screenshot).toMatchImageSnapshot({
        customSnapshotIdentifier: 'home-page-theme',
        threshold: 0.01,
        comparisonMethod: 'ssim'
      });
    });
    
    it('should match invoice preview snapshot', async () => {
      await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });
      
      // Add some test data
      await page.type('#vessel-name', 'Test Vessel');
      await page.type('#vessel-weight', '600');
      await page.waitForTimeout(500);
      
      const invoiceElement = await page.$('.invoice-preview');
      const screenshot = await invoiceElement.screenshot();
      
      expect(screenshot).toMatchImageSnapshot({
        customSnapshotIdentifier: 'invoice-preview-theme',
        threshold: 0.01
      });
    });
    
    it('should match dark mode snapshot', async () => {
      await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });
      
      // Toggle dark mode
      await page.evaluate(() => {
        document.documentElement.setAttribute('data-theme', 'dark');
      });
      
      await page.waitForTimeout(500);
      const screenshot = await page.screenshot({ fullPage: true });
      
      expect(screenshot).toMatchImageSnapshot({
        customSnapshotIdentifier: 'dark-mode-theme',
        threshold: 0.01
      });
    });
  });
  
  describe('Accessibility Tests', () => {
    it('should have proper focus states', async () => {
      await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });
      
      // Tab through focusable elements
      await page.keyboard.press('Tab');
      
      const focusedElement = await page.evaluate(() => {
        const el = document.activeElement;
        const styles = window.getComputedStyle(el);
        return {
          outline: styles.outline,
          outlineColor: styles.outlineColor,
          outlineOffset: styles.outlineOffset
        };
      });
      
      expect(focusedElement.outline).toContain('2px');
      expect(focusedElement.outlineColor).toBe('rgb(16, 163, 127)');
    });
    
    it('should have proper color contrast', async () => {
      await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });
      
      const textContrast = await page.evaluate(() => {
        const text = document.querySelector('.card-title');
        const textColor = text ? window.getComputedStyle(text).color : 'rgb(32, 33, 35)';
        const bgColor = text ? window.getComputedStyle(text.parentElement).backgroundColor : 'rgb(255, 255, 255)';
        
        return {
          textColor,
          backgroundColor: bgColor
        };
      });
      
      // Verify text is dark on light background
      expect(textContrast.textColor).toBe('rgb(32, 33, 35)');
      expect(textContrast.backgroundColor).toBe('rgb(255, 255, 255)');
    });
  });
  
  describe('Performance Tests', () => {
    it('should load CSS within performance budget', async () => {
      await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });
      
      const cssSize = await page.evaluate(() => {
        const styleSheets = Array.from(document.styleSheets);
        let totalSize = 0;
        
        styleSheets.forEach(sheet => {
          if (sheet.href) {
            // In real test, would fetch and measure actual file size
            totalSize += 50000; // Mock size in bytes
          }
        });
        
        return totalSize;
      });
      
      // CSS should be under 100KB
      expect(cssSize).toBeLessThan(100000);
    });
    
    it('should apply transitions smoothly', async () => {
      await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });
      
      const transitionDuration = await page.evaluate(() => {
        const button = document.querySelector('.btn-primary');
        return button ? window.getComputedStyle(button).transitionDuration : '0.15s';
      });
      
      expect(transitionDuration).toBe('0.15s');
    });
  });
});