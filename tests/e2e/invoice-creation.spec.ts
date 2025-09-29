import { test, expect, Page } from '@playwright/test';

test.describe('Invoice Creation Form', () => {
  let page: Page;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    // Log in before each test
    await page.goto('http://localhost:3000/login');
    await page.fill('#username', 'test');
    await page.fill('#password', 'password123');
    await page.click('#login-button');
    await page.goto('http://localhost:3000/invoice/new');
  });

  test.afterEach(async () => {
    await page.close();
  });

  test('should automatically import contact address when a contact is selected', async () => {
    // Click on the customer select to open the dropdown
    await page.click('#customer-link');

    // Type in the search box to find a customer
    await page.fill('#customer-search', 'test');

    // Wait for the search results to appear
    await page.waitForSelector('.customer-search-result');

    // Click on the first search result
    await page.click('.customer-search-result:first-child');

    // Get the value of the address field
    const addressValue = await page.inputValue('#customerAddress');

    // Assert that the address field is not empty
    expect(addressValue).not.toBe('');
  });
});
