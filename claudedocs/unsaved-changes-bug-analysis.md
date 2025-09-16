# Unsaved Changes Bug Analysis

## Current Issues Identified

### Issue 1: False Positive on Invoice Load
**Problem**: Opening a saved invoice immediately shows 'unsaved changes' warning
**Root Cause**: `UnsavedChangesManager.init()` calls `markAsSaved()` before invoice data is loaded, so when data populates the forms, it appears as "changes"

### Issue 2: Tab Switch Warning
**Problem**: Switching tabs within SAME invoice triggers warning
**Root Cause**: `NavigationProtection.handleTabClick()` doesn't differentiate between same-invoice tab switches and real navigation

## Key Files & Current Flow

### UnsavedChangesManager.js
- `init()` → `markAsSaved()` (line 54) - happens BEFORE invoice load
- `handleStateChange()` → detects form population as "changes"
- `calculateStateHash()` - compares current vs lastSavedState

### NavigationProtection.js
- `handleTabClick()` - blocks ALL tab clicks when `isProtectionActive`
- No logic to check if navigation is within same invoice

### app.js
- `initUnsavedChangesSystem()` - creates managers (line 696-707)
- `restoreEditSession()` - loads invoice AFTER unsaved changes system init
- Invoice loading: `populate()` calls trigger state changes

## Timing Issues
1. UnsavedChangesManager.init() → markAsSaved() (with empty state)
2. Invoice loads → forms populate → state changes detected
3. `hasUnsavedChanges = true` incorrectly set

## Navigation Logic Issues
1. Tab clicks always blocked when `isProtectionActive = true`
2. No concept of "same invoice" vs "different invoice" navigation
3. No route analysis to detect intra-invoice navigation

## Fix Strategy
- Fix timing: markAsSaved() AFTER invoice load completes
- Add route analysis: distinguish same vs different invoice navigation
- Implement proper baseline snapshotting on invoice load
- Add navigation context awareness