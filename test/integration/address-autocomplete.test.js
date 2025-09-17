/**
 * Integration tests for AddressAutocomplete component
 *
 * Tests:
 * - Component initialization and rendering
 * - User interaction (typing, keyboard navigation)
 * - API integration with backend proxy
 * - Accessibility features (ARIA, screen reader support)
 * - Progressive enhancement and error handling
 */

const { JSDOM } = require('jsdom');
const path = require('path');
const fs = require('fs');

// Mock fetch for testing
global.fetch = jest.fn();

describe('AddressAutocomplete Integration', () => {
  let dom;
  let document;
  let window;
  let AddressAutocomplete;

  beforeEach(async () => {
    // Create DOM environment
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Test</title>
        </head>
        <body>
          <div id="test-container"></div>
        </body>
      </html>
    `;

    dom = new JSDOM(html, {
      url: 'http://localhost',
      runScripts: 'dangerously',
      resources: 'usable'
    });

    window = dom.window;
    document = window.document;
    global.window = window;
    global.document = document;
    global.HTMLElement = window.HTMLElement;

    // Mock timer functions
    global.setTimeout = window.setTimeout;
    global.clearTimeout = window.clearTimeout;

    // Load the component
    const componentPath = path.resolve(__dirname, '../../src/js/components/AddressAutocomplete.js');
    const componentCode = fs.readFileSync(componentPath, 'utf8');

    // Create a simple module loader since we can't use ES modules in Jest/JSDOM easily
    const moduleExports = {};
    const moduleFunction = new Function('exports', 'module', 'require', componentCode);
    moduleFunction(moduleExports, { exports: moduleExports }, require);

    AddressAutocomplete = moduleExports.AddressAutocomplete;

    jest.clearAllMocks();
  });

  afterEach(() => {
    if (dom) {
      dom.window.close();
    }
    jest.clearAllTimers();
  });

  describe('Component Initialization', () => {
    test('should create component with default options', () => {
      const component = new AddressAutocomplete({
        containerId: 'test-container'
      });

      expect(component.isInitialized).toBe(true);
      expect(component.options.minChars).toBe(3);
      expect(component.options.debounceMs).toBe(300);
      expect(component.options.maxResults).toBe(5);
    });

    test('should render HTML structure correctly', () => {
      new AddressAutocomplete({
        containerId: 'test-container'
      });

      const container = document.getElementById('test-container');
      expect(container.querySelector('.address-autocomplete')).toBeTruthy();
      expect(container.querySelector('[role="combobox"]')).toBeTruthy();
      expect(container.querySelector('[role="listbox"]')).toBeTruthy();

      const input = container.querySelector('input');
      expect(input).toBeTruthy();
      expect(input.getAttribute('aria-autocomplete')).toBe('list');
      expect(input.getAttribute('aria-controls')).toBe('test-container-listbox');
    });

    test('should handle missing container gracefully', () => {
      const component = new AddressAutocomplete({
        containerId: 'non-existent'
      });

      expect(component.isInitialized).toBe(false);
    });

    test('should add CSS styles to document head', () => {
      new AddressAutocomplete({
        containerId: 'test-container'
      });

      const styles = document.getElementById('address-autocomplete-styles');
      expect(styles).toBeTruthy();
      expect(styles.textContent).toContain('.address-autocomplete');
    });
  });

  describe('User Interaction', () => {
    let component;
    let input;

    beforeEach(() => {
      component = new AddressAutocomplete({
        containerId: 'test-container'
      });
      input = document.querySelector('#test-container-input');
    });

    test('should trigger search after minimum characters', (done) => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([])
      });

      component.options.onSelect = jest.fn();

      // Type minimum characters
      input.value = 'abc';
      input.dispatchEvent(new window.Event('input'));

      // Wait for debounce
      setTimeout(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/geo/address-autocomplete'),
          expect.any(Object)
        );
        done();
      }, 350);
    });

    test('should not search for queries too short', () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([])
      });

      input.value = 'ab';
      input.dispatchEvent(new window.Event('input'));

      // Wait longer than debounce
      setTimeout(() => {
        expect(global.fetch).not.toHaveBeenCalled();
      }, 350);
    });

    test('should handle keyboard navigation', () => {
      // Mock results
      component.results = [
        { label: 'Option 1', line1: '123 Main St' },
        { label: 'Option 2', line1: '456 Oak Ave' }
      ];
      component.showSuggestions();

      // Arrow down should select first item
      const downEvent = new window.KeyboardEvent('keydown', { key: 'ArrowDown' });
      input.dispatchEvent(downEvent);

      expect(component.selectedIndex).toBe(0);

      // Arrow down again should select second item
      input.dispatchEvent(downEvent);
      expect(component.selectedIndex).toBe(1);

      // Arrow up should go back to first item
      const upEvent = new window.KeyboardEvent('keydown', { key: 'ArrowUp' });
      input.dispatchEvent(upEvent);
      expect(component.selectedIndex).toBe(0);
    });

    test('should select result on Enter key', () => {
      const mockResult = {
        label: 'Test Address',
        line1: '123 Main St',
        city: 'Test City'
      };

      component.results = [mockResult];
      component.selectedIndex = 0;
      component.options.onSelect = jest.fn();

      const enterEvent = new window.KeyboardEvent('keydown', { key: 'Enter' });
      enterEvent.preventDefault = jest.fn();
      input.dispatchEvent(enterEvent);

      expect(enterEvent.preventDefault).toHaveBeenCalled();
      expect(component.options.onSelect).toHaveBeenCalledWith(mockResult);
    });

    test('should close suggestions on Escape key', () => {
      component.showSuggestions();
      expect(component.listbox.style.display).toBe('block');

      const escapeEvent = new window.KeyboardEvent('keydown', { key: 'Escape' });
      input.dispatchEvent(escapeEvent);

      expect(component.listbox.style.display).toBe('none');
    });
  });

  describe('API Integration', () => {
    let component;

    beforeEach(() => {
      component = new AddressAutocomplete({
        containerId: 'test-container'
      });
    });

    test('should make correct API request', async () => {
      const mockResponse = [
        {
          label: '123 Main Street, New York, NY',
          line1: '123 Main Street',
          city: 'New York',
          state: 'NY',
          postal_code: '10001',
          country: 'USA'
        }
      ];

      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      await component.searchAddresses('123 Main');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/geo/address-autocomplete?query=123%20Main&limit=5&lang=en'),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          })
        })
      );

      expect(component.results).toEqual(mockResponse);
    });

    test('should handle API errors gracefully', async () => {
      global.fetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error'
      });

      component.options.onError = jest.fn();

      await component.searchAddresses('123 Main');

      expect(component.options.onError).toHaveBeenCalled();
      expect(component.status.textContent).toContain('search failed');
    });

    test('should show loading state during request', () => {
      global.fetch.mockImplementation(() =>
        new Promise(resolve => setTimeout(() => resolve({
          ok: true,
          json: () => Promise.resolve([])
        }), 100))
      );

      component.searchAddresses('123 Main');

      expect(component.loading.style.display).toBe('block');
    });

    test('should abort previous requests when new one starts', async () => {
      const abortSpy = jest.fn();
      const mockController = { abort: abortSpy };

      // Mock AbortController
      global.AbortController = jest.fn(() => mockController);

      global.fetch.mockImplementation(() =>
        new Promise(resolve => setTimeout(() => resolve({
          ok: true,
          json: () => Promise.resolve([])
        }), 100))
      );

      // Start first request
      component.searchAddresses('123');

      // Start second request before first completes
      component.searchAddresses('456');

      expect(abortSpy).toHaveBeenCalled();
    });
  });

  describe('Accessibility Features', () => {
    let component;
    let input;
    let listbox;

    beforeEach(() => {
      component = new AddressAutocomplete({
        containerId: 'test-container'
      });
      input = document.querySelector('#test-container-input');
      listbox = document.querySelector('#test-container-listbox');
    });

    test('should have proper ARIA attributes', () => {
      expect(input.getAttribute('role')).toBe(null); // Input doesn't need role
      expect(input.getAttribute('aria-autocomplete')).toBe('list');
      expect(input.getAttribute('aria-controls')).toBe('test-container-listbox');

      expect(listbox.getAttribute('role')).toBe('listbox');
      expect(listbox.getAttribute('aria-label')).toBe('Address suggestions');
    });

    test('should update aria-expanded correctly', () => {
      const combobox = document.querySelector('[role="combobox"]');

      expect(combobox.getAttribute('aria-expanded')).toBe('false');

      component.showSuggestions();
      expect(combobox.getAttribute('aria-expanded')).toBe('true');

      component.hideSuggestions();
      expect(combobox.getAttribute('aria-expanded')).toBe('false');
    });

    test('should update aria-activedescendant for keyboard navigation', () => {
      component.results = [
        { label: 'Option 1' },
        { label: 'Option 2' }
      ];
      component.renderSuggestions('test');
      component.showSuggestions();

      // Select first item
      component.selectedIndex = 0;
      component.updateSelectionAria();

      expect(input.getAttribute('aria-activedescendant')).toBe('suggestion-0');

      // Clear selection
      component.selectedIndex = -1;
      component.updateSelectionAria();

      expect(input.hasAttribute('aria-activedescendant')).toBe(false);
    });

    test('should provide screen reader announcements', () => {
      const status = document.querySelector('#test-container-status');

      component.updateStatus('Test message');
      expect(status.textContent).toBe('Test message');

      // Status should have proper ARIA live region attributes
      expect(status.getAttribute('aria-live')).toBe('polite');
      expect(status.getAttribute('aria-atomic')).toBe('true');
    });

    test('should have screen reader only helper text', () => {
      const help = document.querySelector('#test-container-help');
      expect(help.textContent).toContain('powered by Geoapify');
    });
  });

  describe('Progressive Enhancement', () => {
    test('should work without JavaScript API', () => {
      global.fetch = undefined;

      const component = new AddressAutocomplete({
        containerId: 'test-container'
      });

      const input = document.querySelector('#test-container-input');
      expect(input).toBeTruthy();
      expect(input.type).toBe('text');
      expect(input.placeholder).toContain('Start typing');
    });

    test('should handle network failures gracefully', async () => {
      global.fetch.mockRejectedValue(new Error('Network error'));

      const component = new AddressAutocomplete({
        containerId: 'test-container',
        onError: jest.fn()
      });

      await component.searchAddresses('123 Main');

      expect(component.options.onError).toHaveBeenCalled();
      expect(component.status.textContent).toContain('search failed');
    });

    test('should provide fallback when suggestions are empty', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([])
      });

      const component = new AddressAutocomplete({
        containerId: 'test-container'
      });

      await component.searchAddresses('nonexistent address');

      expect(component.listbox.innerHTML).toContain('No addresses found');
    });
  });

  describe('Component Lifecycle', () => {
    test('should clean up resources on destroy', () => {
      const component = new AddressAutocomplete({
        containerId: 'test-container'
      });

      // Start a debounced operation
      const input = document.querySelector('#test-container-input');
      input.value = 'test';
      input.dispatchEvent(new window.Event('input'));

      component.destroy();

      // Container should be cleared
      const container = document.getElementById('test-container');
      expect(container.innerHTML).toBe('');

      // Timers should be cleared (no easy way to test this directly)
      // But at least verify destroy doesn't throw
      expect(() => component.destroy()).not.toThrow();
    });

    test('should handle multiple instances correctly', () => {
      // Create first container
      const container2 = document.createElement('div');
      container2.id = 'test-container-2';
      document.body.appendChild(container2);

      const component1 = new AddressAutocomplete({
        containerId: 'test-container'
      });

      const component2 = new AddressAutocomplete({
        containerId: 'test-container-2'
      });

      expect(component1.isInitialized).toBe(true);
      expect(component2.isInitialized).toBe(true);

      // Both should have their own input elements
      expect(document.querySelector('#test-container-input')).toBeTruthy();
      expect(document.querySelector('#test-container-2-input')).toBeTruthy();

      // Destroy first component
      component1.destroy();

      // Second component should still work
      expect(document.querySelector('#test-container-2-input')).toBeTruthy();
      expect(document.getElementById('address-autocomplete-styles')).toBeTruthy();

      // Clean up
      component2.destroy();
    });
  });
});