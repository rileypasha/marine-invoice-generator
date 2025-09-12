#!/usr/bin/env node

/**
 * Debug script to inspect localStorage and understand invoice visibility issues
 */

const { chromium } = require('playwright');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

async function debugInvoiceStorage() {
  console.log('🔍 Starting invoice storage debug...');
  console.log(`📍 URL: ${BASE_URL}`);
  
  const browser = await chromium.launch({ 
    headless: false,
    devtools: true 
  });
  
  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    
    // Navigate to the app
    await page.goto(BASE_URL);
    await page.waitForTimeout(2000);
    
    // Execute debug code in the browser context
    const debugInfo = await page.evaluate(() => {
      const info = {
        currentUser: null,
        invoices: [],
        drafts: [],
        localStorage: {},
        userManager: null,
        invoiceStorage: null
      };
      
      // Get all localStorage data
      for (let key in localStorage) {
        if (key.startsWith('marine_')) {
          try {
            info.localStorage[key] = JSON.parse(localStorage.getItem(key));
          } catch {
            info.localStorage[key] = localStorage.getItem(key);
          }
        }
      }
      
      // Get current user from UserManager if available
      if (window.app && window.app.userManager) {
        const user = window.app.userManager.getCurrentUser();
        info.currentUser = user ? {
          id: user.id,
          email: user.email,
          name: user.name
        } : null;
        
        // Check if UserManager is properly initialized
        info.userManager = {
          isInitialized: !!window.app.userManager,
          hasCurrentUser: !!user,
          authStatus: window.app.userManager.isAuthenticated()
        };
      }
      
      // Get invoices from InvoiceStorage
      if (window.app && window.app.invoiceStorage) {
        try {
          // Get raw invoices from localStorage
          const rawInvoices = localStorage.getItem('marine_invoices');
          const rawDrafts = localStorage.getItem('marine_drafts');
          
          info.invoices = rawInvoices ? JSON.parse(rawInvoices) : [];
          info.drafts = rawDrafts ? JSON.parse(rawDrafts) : [];
          
          // Get filtered invoices through the storage class
          const userInvoices = window.app.invoiceStorage.getUserInvoices();
          const userDrafts = window.app.invoiceStorage.getUserDrafts();
          const savedItems = window.app.invoiceStorage.getSavedItems(10);
          
          info.invoiceStorage = {
            isInitialized: !!window.app.invoiceStorage,
            totalInvoices: info.invoices.length,
            totalDrafts: info.drafts.length,
            userInvoices: userInvoices.length,
            userDrafts: userDrafts.length,
            savedItems: savedItems.length,
            savedItemTitles: savedItems.map(item => ({
              title: item.title,
              userId: item.userId,
              userEmail: item.userEmail || 'NOT SET'
            }))
          };
        } catch (error) {
          info.invoiceStorage = { error: error.message };
        }
      }
      
      return info;
    });
    
    // Print debug information
    console.log('\n📊 DEBUG INFORMATION:');
    console.log('====================\n');
    
    console.log('👤 CURRENT USER:');
    if (debugInfo.currentUser) {
      console.log(`  ID: ${debugInfo.currentUser.id}`);
      console.log(`  Email: ${debugInfo.currentUser.email}`);
      console.log(`  Name: ${debugInfo.currentUser.name}`);
    } else {
      console.log('  No user logged in');
    }
    
    console.log('\n🔐 USER MANAGER:');
    console.log(`  Initialized: ${debugInfo.userManager?.isInitialized || false}`);
    console.log(`  Has Current User: ${debugInfo.userManager?.hasCurrentUser || false}`);
    console.log(`  Auth Status: ${debugInfo.userManager?.authStatus || false}`);
    
    console.log('\n📦 INVOICE STORAGE:');
    if (debugInfo.invoiceStorage) {
      console.log(`  Initialized: ${debugInfo.invoiceStorage.isInitialized}`);
      console.log(`  Total Invoices in Storage: ${debugInfo.invoiceStorage.totalInvoices}`);
      console.log(`  Total Drafts in Storage: ${debugInfo.invoiceStorage.totalDrafts}`);
      console.log(`  User's Invoices (filtered): ${debugInfo.invoiceStorage.userInvoices}`);
      console.log(`  User's Drafts (filtered): ${debugInfo.invoiceStorage.userDrafts}`);
      console.log(`  Saved Items (sidebar): ${debugInfo.invoiceStorage.savedItems}`);
      
      if (debugInfo.invoiceStorage.savedItemTitles?.length > 0) {
        console.log('\n  Saved Items Details:');
        debugInfo.invoiceStorage.savedItemTitles.forEach((item, i) => {
          console.log(`    ${i + 1}. "${item.title}"`);
          console.log(`       userId: ${item.userId}`);
          console.log(`       userEmail: ${item.userEmail}`);
        });
      }
    }
    
    console.log('\n📝 RAW INVOICES:');
    if (debugInfo.invoices.length > 0) {
      console.log(`  Found ${debugInfo.invoices.length} invoice(s):`);
      debugInfo.invoices.forEach((inv, i) => {
        console.log(`\n  Invoice ${i + 1}:`);
        console.log(`    ID: ${inv.id}`);
        console.log(`    Title: ${inv.title}`);
        console.log(`    User ID: ${inv.userId}`);
        console.log(`    User Email: ${inv.userEmail || 'NOT SET'}`);
        console.log(`    Status: ${inv.status}`);
        console.log(`    Updated: ${inv.updatedAt}`);
      });
    } else {
      console.log('  No invoices found in localStorage');
    }
    
    console.log('\n📄 RAW DRAFTS:');
    if (debugInfo.drafts.length > 0) {
      console.log(`  Found ${debugInfo.drafts.length} draft(s):`);
      debugInfo.drafts.forEach((draft, i) => {
        console.log(`\n  Draft ${i + 1}:`);
        console.log(`    ID: ${draft.id}`);
        console.log(`    Title: ${draft.title}`);
        console.log(`    User ID: ${draft.userId}`);
        console.log(`    User Email: ${draft.userEmail || 'NOT SET'}`);
        console.log(`    Updated: ${draft.updatedAt}`);
      });
    } else {
      console.log('  No drafts found in localStorage');
    }
    
    // Check for migration issues
    console.log('\n🔄 MIGRATION CHECK:');
    
    // Run migration manually to see what happens
    const migrationResult = await page.evaluate(() => {
      if (window.app && window.app.invoiceStorage) {
        const beforeCount = window.app.invoiceStorage.getUserInvoices().length;
        
        // Try to run migration
        try {
          window.app.invoiceStorage.migrateUserEmails();
        } catch (error) {
          return { error: error.message };
        }
        
        const afterCount = window.app.invoiceStorage.getUserInvoices().length;
        
        return {
          beforeCount,
          afterCount,
          migrated: afterCount > beforeCount
        };
      }
      return { error: 'InvoiceStorage not available' };
    });
    
    if (migrationResult.error) {
      console.log(`  Migration Error: ${migrationResult.error}`);
    } else {
      console.log(`  Invoices before migration: ${migrationResult.beforeCount}`);
      console.log(`  Invoices after migration: ${migrationResult.afterCount}`);
      console.log(`  Migration successful: ${migrationResult.migrated}`);
    }
    
    // Check sidebar update
    console.log('\n🎯 SIDEBAR CHECK:');
    const sidebarItems = await page.$$eval('.invoice-item', items => 
      items.map(el => ({
        title: el.querySelector('.invoice-title')?.textContent,
        id: el.dataset.id
      }))
    );
    
    if (sidebarItems.length > 0) {
      console.log(`  Found ${sidebarItems.length} item(s) in sidebar:`);
      sidebarItems.forEach((item, i) => {
        console.log(`    ${i + 1}. "${item.title}" (${item.id})`);
      });
    } else {
      console.log('  No items visible in sidebar');
    }
    
    // Try to manually refresh the sidebar
    console.log('\n🔧 MANUAL REFRESH:');
    const refreshResult = await page.evaluate(() => {
      if (window.app && window.app.sidebar) {
        try {
          window.app.sidebar.refreshInvoiceList();
          return 'Sidebar refreshed successfully';
        } catch (error) {
          return `Error: ${error.message}`;
        }
      }
      return 'Sidebar not available';
    });
    console.log(`  ${refreshResult}`);
    
    // Wait and check again
    await page.waitForTimeout(1000);
    
    const sidebarItemsAfter = await page.$$eval('.invoice-item', items => items.length);
    console.log(`  Items in sidebar after refresh: ${sidebarItemsAfter}`);
    
    console.log('\n💡 RECOMMENDATIONS:');
    if (!debugInfo.currentUser) {
      console.log('  ❌ No user is logged in. Please log in first.');
    } else if (debugInfo.invoices.length === 0 && debugInfo.drafts.length === 0) {
      console.log('  ❌ No invoices or drafts exist. Create some invoices first.');
    } else if (debugInfo.invoiceStorage?.userInvoices === 0) {
      console.log('  ⚠️ Invoices exist but are not associated with current user.');
      console.log('     The migration may not be working correctly.');
      console.log('     Check that userEmail is being set and matched properly.');
    } else if (sidebarItems.length === 0 && debugInfo.invoiceStorage?.savedItems > 0) {
      console.log('  ⚠️ Invoices are filtered correctly but not showing in sidebar.');
      console.log('     The sidebar may not be updating properly.');
    }
    
    // Keep browser open for manual inspection
    console.log('\n⏸️ Browser will stay open for 30 seconds for manual inspection...');
    console.log('   Open DevTools console to run: window.app.invoiceStorage.getUserInvoices()');
    await page.waitForTimeout(30000);
    
  } catch (error) {
    console.error('❌ Debug failed:', error);
  } finally {
    await browser.close();
    console.log('\n✅ Debug session completed');
  }
}

// Run the debug
debugInvoiceStorage().catch(console.error);