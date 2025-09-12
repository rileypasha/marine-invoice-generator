#!/usr/bin/env node

/**
 * Test script to verify invoice visibility for standard users
 * This tests that invoices are properly associated with users by email
 * even when user IDs change between local and server authentication
 */

const { chromium } = require('playwright');
const path = require('path');

// Test configuration
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const TEST_USER_EMAIL = 'test@marinegroup.com';
const TEST_USER_NAME = 'Test User';

async function testInvoiceVisibility() {
  console.log('🧪 Starting invoice visibility test...');
  console.log(`📍 Testing at: ${BASE_URL}`);
  
  const browser = await chromium.launch({ 
    headless: false,
    slowMo: 100 
  });
  
  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    
    // Step 1: Create an invoice without logging in (will use local test user)
    console.log('\n📝 Step 1: Creating invoice with local test user...');
    await page.goto(BASE_URL);
    await page.waitForTimeout(1000);
    
    // Fill in some invoice data
    await page.fill('input[placeholder="Enter vessel name"]', 'Test Vessel');
    await page.fill('input[placeholder="Enter customer name"]', 'Test Customer');
    
    // Add a line item
    const addItemBtn = await page.$('button:has-text("Add Item")');
    if (addItemBtn) {
      await addItemBtn.click();
      await page.waitForTimeout(500);
    }
    
    // Save the invoice
    console.log('💾 Saving invoice...');
    const saveBtn = await page.$('button:has-text("Save")');
    if (saveBtn) {
      await saveBtn.click();
      await page.waitForTimeout(1000);
      
      // Enter title in save dialog
      const titleInput = await page.$('input[placeholder*="title"]');
      if (titleInput) {
        await titleInput.fill('Test Invoice for Visibility');
        const confirmSaveBtn = await page.$('button:has-text("Save Invoice")');
        if (confirmSaveBtn) {
          await confirmSaveBtn.click();
          await page.waitForTimeout(1000);
        }
      }
    }
    
    // Check if invoice appears in sidebar
    console.log('🔍 Checking if invoice appears in sidebar...');
    const sidebarInvoice = await page.$('.invoice-item:has-text("Test Invoice for Visibility")');
    if (sidebarInvoice) {
      console.log('✅ Invoice visible in sidebar (local user)');
    } else {
      console.log('⚠️ Invoice not visible in sidebar (local user)');
    }
    
    // Step 2: Log out and log back in with server authentication
    console.log('\n🔄 Step 2: Logging out and logging back in...');
    
    // Try to log out first
    const userSection = await page.$('#user-section');
    if (userSection && await userSection.isVisible()) {
      await userSection.click();
      await page.waitForTimeout(500);
      
      const logoutBtn = await page.$('button:has-text("Sign Out")');
      if (logoutBtn) {
        await logoutBtn.click();
        await page.waitForTimeout(1000);
      }
    }
    
    // Now log in
    console.log('🔐 Logging in with server authentication...');
    const signInBtn = await page.$('#sign-in-btn');
    if (signInBtn) {
      await signInBtn.click();
      await page.waitForTimeout(500);
      
      // Fill in login form
      await page.fill('input[type="email"]', TEST_USER_EMAIL);
      await page.fill('input[placeholder="Enter your name"]', TEST_USER_NAME);
      
      const submitBtn = await page.$('button[type="submit"]:has-text("Sign In")');
      if (submitBtn) {
        await submitBtn.click();
        await page.waitForTimeout(2000);
      }
    }
    
    // Step 3: Check if invoice is still visible after re-authentication
    console.log('\n🔍 Step 3: Checking invoice visibility after re-authentication...');
    
    // Wait for sidebar to update
    await page.waitForTimeout(1000);
    
    // Check if the invoice is visible
    const invoiceAfterLogin = await page.$('.invoice-item:has-text("Test Invoice for Visibility")');
    if (invoiceAfterLogin) {
      console.log('✅ SUCCESS: Invoice is visible after re-authentication!');
      console.log('   The email-based matching is working correctly.');
    } else {
      // Check if any invoices are visible
      const anyInvoices = await page.$$('.invoice-item');
      if (anyInvoices.length > 0) {
        console.log(`⚠️ Found ${anyInvoices.length} invoice(s) but not the test invoice`);
        
        // List the visible invoices
        for (let i = 0; i < anyInvoices.length; i++) {
          const title = await anyInvoices[i].$eval('.invoice-title', el => el.textContent);
          console.log(`   - ${title}`);
        }
      } else {
        console.log('❌ FAILURE: No invoices visible after re-authentication');
        console.log('   The invoice visibility issue persists.');
      }
    }
    
    // Step 4: Try to create a new invoice and verify it appears
    console.log('\n📝 Step 4: Creating new invoice after authentication...');
    
    // Click new invoice button
    const newInvoiceBtn = await page.$('.new-invoice-btn');
    if (newInvoiceBtn) {
      await newInvoiceBtn.click();
      await page.waitForTimeout(500);
    }
    
    // Fill in new invoice data
    await page.fill('input[placeholder="Enter vessel name"]', 'Test Vessel 2');
    await page.fill('input[placeholder="Enter customer name"]', 'Test Customer 2');
    
    // Save the new invoice
    const saveBtn2 = await page.$('button:has-text("Save")');
    if (saveBtn2) {
      await saveBtn2.click();
      await page.waitForTimeout(1000);
      
      const titleInput2 = await page.$('input[placeholder*="title"]');
      if (titleInput2) {
        await titleInput2.fill('Test Invoice After Auth');
        const confirmSaveBtn2 = await page.$('button:has-text("Save Invoice")');
        if (confirmSaveBtn2) {
          await confirmSaveBtn2.click();
          await page.waitForTimeout(1000);
        }
      }
    }
    
    // Check if new invoice appears
    const newInvoice = await page.$('.invoice-item:has-text("Test Invoice After Auth")');
    if (newInvoice) {
      console.log('✅ New invoice is visible after authentication');
    } else {
      console.log('❌ New invoice not visible after authentication');
    }
    
    console.log('\n📊 Test Summary:');
    console.log('================');
    
    // Final check for all invoices
    const finalInvoices = await page.$$('.invoice-item');
    console.log(`Total invoices visible: ${finalInvoices.length}`);
    
    if (invoiceAfterLogin && newInvoice) {
      console.log('✅ All tests passed! Invoice visibility is working correctly.');
    } else if (newInvoice && !invoiceAfterLogin) {
      console.log('⚠️ Partial success: New invoices work but old ones are not migrated.');
    } else {
      console.log('❌ Tests failed: Invoice visibility issue needs further investigation.');
    }
    
  } catch (error) {
    console.error('❌ Test failed with error:', error);
  } finally {
    await browser.close();
    console.log('\n🏁 Test completed');
  }
}

// Run the test
testInvoiceVisibility().catch(console.error);