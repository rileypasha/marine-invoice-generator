# Marine Group Invoice Management System
## Employee User Guide

---

## Table of Contents
1. [Getting Started](#getting-started)
2. [Logging In](#logging-in)
3. [Dashboard Overview](#dashboard-overview)
4. [Managing Requests (Invoices)](#managing-requests-invoices)
5. [Managing Contacts (Customers)](#managing-contacts-customers)
6. [Managing Vessels](#managing-vessels)
7. [Creating & Editing Requests](#creating--editing-requests)
8. [Understanding Request Status](#understanding-request-status)
9. [Working Offline](#working-offline)
10. [Settings & Notifications](#settings--notifications)
11. [Common Tasks](#common-tasks)
12. [Troubleshooting](#troubleshooting)

---

## Getting Started

### What is this system?
The Marine Group Invoice Management System is a web-based application designed to help you create, manage, and track service requests and invoices for marine services. It includes customer management, vessel tracking, and comprehensive invoice workflow capabilities.

### System Requirements
- Modern web browser (Chrome, Firefox, Safari, or Edge)
- Internet connection (the system has offline capabilities for drafts)
- Your employee login credentials

### First Time Setup
1. Open your web browser
2. Navigate to the application URL (provided by your administrator)
3. Log in with your employee credentials
4. Review your notification preferences in Settings

---

## Logging In

### Login Process
1. Go to the application homepage
2. Enter your **email address**
3. Enter your **password**
4. Click **"Sign In"**

### Session Management
- Your session will remain active for **30 minutes** of inactivity
- If your session expires, you'll see a banner notification
- Any unsaved work is automatically saved locally and can be synced after you log back in
- You can manually log out using the logout button in the navigation

### Forgot Password?
Contact your system administrator for password reset assistance.

---

## Dashboard Overview

After logging in, you'll see the main navigation menu with the following sections:

### Main Navigation
- **Requests** - View and manage all service requests/invoices
- **Contacts** - Manage customer information
- **Vessels** - Manage vessel/boat information
- **Settings** - Configure your user preferences and notifications

---

## Managing Requests (Invoices)

### Viewing Requests
1. Click **"Requests"** in the main navigation
2. You'll see a table with all requests showing:
   - Request number
   - Customer name
   - Vessel name
   - Status (Requested, In Progress, Change Requested, Approved, etc.)
   - Date created/modified
   - Total amount

### Request List Features

#### Search & Filter
- **Search Bar**: Type to search by customer name, vessel name, or request number
- **Status Filters**: Click status badges to filter by:
  - All requests
  - Requested (new)
  - In Progress
  - Change Requested
  - Approved
  - Completed

#### Sorting
- Click column headers to sort by that field
- Click again to reverse sort order

#### Actions Menu (Three Dots)
For each request, click the three-dot menu to:
- **Edit** - Modify the request details
- **View** - Open detailed view with printable format
- **Duplicate** - Create a copy of the request
- **Delete** - Remove the request (requires confirmation)

### Group & Organize
- **Group by Customer** - See all requests organized by customer
- **Group by Vessel** - See all requests organized by vessel
- **Group by Status** - See requests organized by their current status
- **Date Range Filter** - Filter requests by date created

### Bulk Actions
1. Select multiple requests using checkboxes
2. Use the toolbar to:
   - Delete selected requests
   - Export selected requests
   - Change status in bulk

---

## Managing Contacts (Customers)

### Viewing Contacts
1. Click **"Contacts"** in the main navigation
2. View all customers in a searchable table

### Contact Information Displayed
- Display name (how they appear in requests)
- Legal name (official business name)
- Email address
- Phone number
- Full address
- Number of invoices
- Total invoice value
- Activity status

### Creating a New Contact
1. Click **"New Contact"** button (top right)
2. Fill in the contact form:
   - **Display Name** (required) - How the customer appears in the system
   - **Legal Name** - Official business name
   - **Email** - Customer email address
   - **Phone** - Customer phone number (automatically formatted)
   - **Address** - Full street address
   - **City, State, ZIP** - Location details
   - **Tax ID** - Customer tax identification number
   - **Notes** - Any additional information
3. Click **"Save Contact"**

### Editing a Contact
1. Find the contact in the list
2. Click the three-dot menu → **"Edit"**
3. Update the information
4. Click **"Save Changes"**

### Contact Actions
- **Edit** - Modify contact information
- **View Invoices** - See all requests/invoices for this contact
- **Delete** - Remove contact (only if no associated invoices)
- **Activate/Deactivate** - Mark contact as active or inactive

### Importing Contacts
1. Click **"Import"** button
2. Select a CSV file with contact data
3. Review the import preview
4. Confirm import
5. Review import results (successful, skipped, failed)

### Filtering Contacts
- **Activity Filter**: Show All, Active Only, or Inactive
- **Group by**: Organize by different criteria
- **Search**: Type to find specific contacts quickly

---

## Managing Vessels

### Viewing Vessels
1. Click **"Vessels"** in the main navigation
2. View all vessels in a searchable table

### Vessel Information Displayed
- Vessel name
- Registration number
- Type (sailboat, motorboat, etc.)
- Dimensions (length, beam, draft, weight)
- Home port
- Owner information
- Number of invoices
- Total invoice value

### Creating a New Vessel
1. Click **"New Vessel"** button
2. Fill in the vessel form:
   - **Vessel Name** (required)
   - **Registration Number** - Official registration
   - **Type** - Vessel type/classification
   - **Dimensions** - Length (ft), Beam (ft), Draft (ft), Weight (tons)
   - **MMSI Number** - Maritime Mobile Service Identity
   - **IMO Number** - International Maritime Organization number
   - **Home Port** - Primary port location
   - **Owner Name** - Vessel owner
   - **Owner Contact** - Email and phone
   - **Notes** - Additional information
3. Click **"Save Vessel"**

### Editing a Vessel
1. Find the vessel in the list
2. Click the three-dot menu → **"Edit"**
3. Update the information
4. Click **"Save Changes"**

### Vessel Actions
- **Edit** - Modify vessel information
- **View Invoices** - See all requests for this vessel
- **Delete** - Remove vessel (only if no associated invoices)
- **Activate/Deactivate** - Mark vessel as active or inactive

### Importing Vessels
1. Click **"Import"** button
2. Select a CSV file with vessel data
3. Review the import preview
4. Confirm import
5. Review import results

---

## Creating & Editing Requests

### Creating a New Request
1. Click **"Requests"** in navigation
2. Click **"New Request"** button
3. Fill out the request form (see sections below)
4. Click **"Save"** or **"Submit"**

### Request Form Sections

#### 1. Customer Information
- **Select Existing Customer**: Choose from dropdown
  - OR -
- **Create New Customer**: Fill in customer details inline
  - Customer Name
  - Email
  - Phone
  - Address

#### 2. Vessel Information
- **Select Existing Vessel**: Choose from dropdown
  - OR -
- **Add Vessel Details**: Enter vessel information
  - Vessel Name
  - Weight (tons)
  - Beam (feet)

#### 3. Request Details
- **Request Title** - Brief description of work
- **Market** - Service market category
- **Notes** - Additional details or special instructions
- **Estimator Name** - Employee creating estimate
- **Contact Name** - Primary contact person

#### 4. Line Items (Services)
This is where you detail the actual work and charges:

**Adding a Line Item**:
1. Click **"Add Service"** or **"Add Material"**
2. For each line item, specify:
   - **Description** - What service/item is being provided
   - **Quantity** - How many units
   - **Item Type** - Service or Material
   - **Job Type** - Category of work

**For Services (Labor)**:
- **Labor Hours** - Regular hours worked
- **OT Hours** - Overtime hours
- **Rate** - Hourly rate (auto-calculated based on job type)

**For Materials**:
- **Manual Cost** - Cost of materials
- **Markup Type** - Select markup percentage (2.5%, 12.5%, custom, or exempt)
- **Markup Rate** - Custom markup if applicable

**Tax Settings**:
- **Tax Status** - Taxable, Non-taxable, or Exempt
- **Tax Rate** - Percentage (if taxable)

**Line Item Actions**:
- **Edit** - Click the edit icon to modify
- **Delete** - Click the trash icon to remove
- **Duplicate** - Copy an existing line item

#### 5. Totals Section
The system automatically calculates:
- **Subtotal** - Sum of all line items before tax
- **Tax Amount** - Calculated tax based on taxable items
- **Total** - Final amount
- **Gross Profit** - Profit after costs
- **Profit Margin** - Percentage profit

#### 6. Attachments
- Click **"Attach File"** to upload documents
- Supported formats: PDF, images, documents
- You can attach up to 2 files per request
- View or remove attachments using the file controls

### Saving Your Work

#### Auto-Save
- The system automatically saves your work every few seconds
- You'll see a "Saved" indicator when auto-save completes

#### Manual Save
- Click **"Save"** button at any time
- Changes are saved immediately

#### Working Offline
- If you lose internet connection, changes are saved locally
- When you reconnect, you'll be prompted to sync your changes
- See [Working Offline](#working-offline) section for details

### Submitting a Request
1. Complete all required fields
2. Review totals and calculations
3. Click **"Submit Request"**
4. Request status changes to "Requested"
5. Notifications are sent based on settings

---

## Understanding Request Status

Requests move through different statuses in the workflow:

### Status Types

#### **Requested** (Blue)
- Initial status when a new request is submitted
- Awaiting review or processing
- Can be edited by any employee

#### **In Progress** (Yellow)
- Request is actively being worked on
- May involve scheduling, quoting, or preparation
- Still editable

#### **Change Requested** (Orange)
- Customer or reviewer has requested modifications
- Red indicators show what changed
- Original values shown alongside new values
- Employee needs to review and address changes

#### **Approved** (Green)
- Request has been approved
- Ready to proceed with work
- May have limited editing

#### **Completed** (Gray)
- Work has been completed
- Invoice has been finalized
- Typically locked from editing

#### **On Hold** / **Cancelled** (Red)
- Request is paused or cancelled
- May require special permissions to reactivate

### Change Request Workflow

When a request has "Change Requested" status:

1. **View Changes**:
   - Changed fields are highlighted in red
   - Old values shown with strikethrough
   - New values shown in bold
   - Comments may explain why changes were requested

2. **Review Changes**:
   - Read any comments or notes
   - Understand what modifications are needed
   - Check impact on pricing/timeline

3. **Make Updates**:
   - Edit the request to address changes
   - Update line items, details, or pricing as needed
   - Add notes explaining your changes

4. **Resubmit**:
   - Click **"Submit"** when changes are complete
   - Status typically returns to "Requested"
   - Notifications sent to relevant parties

---

## Working Offline

The system has built-in offline capabilities to ensure you never lose work:

### How Offline Mode Works

#### When You're Offline
1. System detects loss of internet connection
2. You see a notification: **"Working Offline - Changes saved locally"**
3. All edits are saved to your browser's local storage
4. You can continue working normally
5. Save button shows **"Saved Locally"**

#### When Your Session Expires
1. After 30 minutes of inactivity, your session expires
2. You see a banner: **"Session expired - Please log in to save changes"**
3. Your work is saved locally and preserved
4. No data is lost

#### Syncing After Reconnection
1. Log back in to the system
2. You'll see a **"Pending Changes"** modal
3. Review the list of requests with local changes
4. Select which changes to sync (or select all)
5. Click **"Submit Selected"**
6. System uploads your changes
7. Confirmation shown for successful sync

### Best Practices for Offline Work
- Save frequently even though auto-save is active
- Log back in as soon as possible to sync changes
- Don't clear your browser cache while offline work is pending
- Review synced items to confirm all changes uploaded correctly

---

## Settings & Notifications

### Accessing Settings
1. Click **"Settings"** in the main navigation
2. View your user profile and preferences

### Profile Information
- **Name** - Your display name
- **Email** - Your login email (cannot be changed)
- **Role** - Your permission level (Standard, Manager, Admin)

### Email Notification Preferences

You can choose when to receive email notifications:

#### New Request Notifications
- **None** - No email notifications
- **Own** - Only for requests you created
- **All** - For all new requests in the system

#### Change Request Notifications
- **None** - No email notifications
- **Own** - Only when changes requested on your requests
- **All** - For all change requests in the system

#### Approval Notifications
- **None** - No email notifications
- **Own** - Only when your requests are approved
- **All** - For all approvals in the system

### Updating Preferences
1. Select your preference for each notification type
2. Click **"Save Settings"**
3. Changes take effect immediately

---

## Common Tasks

### Quick Reference Guide

#### Create a New Request for Existing Customer
1. Requests → New Request
2. Select customer from dropdown
3. Select or enter vessel info
4. Add line items
5. Save or Submit

#### Find All Requests for a Customer
1. Requests → Search customer name
2. Or: Contacts → Find customer → View Invoices

#### Duplicate an Existing Request
1. Find the request
2. Click three-dot menu → Duplicate
3. Modify as needed
4. Save new request

#### Export Request to PDF
1. Open the request
2. Click "View" to see printable format
3. Use browser's Print → Save as PDF

#### Bulk Delete Old Requests
1. Requests → Select checkboxes
2. Click Delete button in toolbar
3. Confirm deletion

#### Import Customer List
1. Contacts → Import button
2. Select CSV file
3. Review preview
4. Confirm import

#### Update Customer Information
1. Contacts → Find customer
2. Three-dot menu → Edit
3. Update fields
4. Save Changes

#### Check Request History
1. Open the request
2. View revision history section
3. See who made changes and when

#### Respond to Change Request
1. Requests → Filter by "Change Requested"
2. Open request to see highlighted changes
3. Make necessary updates
4. Add notes explaining changes
5. Resubmit request

---

## Troubleshooting

### Common Issues and Solutions

#### "Session Expired" Message
**Problem**: You see a banner saying your session expired
**Solution**:
- Your work is saved locally
- Log back in
- Review and sync pending changes from the modal
- Your data will be uploaded

#### Can't Save Changes
**Problem**: Save button is disabled or nothing happens
**Solution**:
- Check that you're logged in (look for session banner)
- Verify internet connection
- Check that all required fields are filled
- Try refreshing the page (work is auto-saved)

#### Customer/Vessel Not in Dropdown
**Problem**: Can't find a customer or vessel in the list
**Solution**:
- Check if they're marked as "Inactive" (toggle filter)
- Create new customer/vessel if they don't exist
- Check spelling when searching
- Verify the customer/vessel was saved properly

#### Changes Not Showing Up
**Problem**: Made changes but they don't appear
**Solution**:
- Wait a moment for auto-save to complete
- Check for error messages
- Verify you have permission to edit
- Try refreshing the page
- Check if you're in the correct status/view

#### Import Failed
**Problem**: CSV import shows errors
**Solution**:
- Check CSV file format matches template
- Verify all required fields are present
- Check for special characters or formatting issues
- Review error messages for specific row problems
- Try importing smaller batches

#### Numbers/Calculations Wrong
**Problem**: Totals don't look correct
**Solution**:
- Verify quantity and rate entries
- Check markup percentages are correct
- Verify tax settings (taxable vs exempt)
- Check for manual cost overrides
- Review each line item calculation

#### Can't Delete Request/Contact/Vessel
**Problem**: Delete option is disabled
**Solution**:
- Check if item has associated records (can't delete customer with invoices)
- Verify you have deletion permissions
- Check if item is referenced elsewhere in the system
- Contact administrator if you need to force deletion

#### Browser Running Slow
**Problem**: Application feels sluggish
**Solution**:
- Close other browser tabs
- Clear browser cache (be careful with pending offline changes)
- Try a different browser
- Check internet connection speed
- Reload the page

---

## Getting Help

### Support Resources

#### Contact Your Administrator
- For account issues or password resets
- Permission or access problems
- System-wide issues or bugs
- Questions about business processes

#### Technical Support
- For urgent system failures
- Data recovery needs
- Import/export problems
- Integration issues

### Tips for Effective Support Requests
1. **Describe the problem clearly**: What were you trying to do?
2. **Provide steps to reproduce**: How did the problem happen?
3. **Include screenshots**: Show what you're seeing
4. **Note any error messages**: Copy exact text of errors
5. **Mention browser and device**: What you're using to access the system

---

## Best Practices

### Data Entry
- Use consistent naming conventions for customers and vessels
- Fill in all available information (better data = better reports)
- Use the notes fields for important context
- Double-check numbers and calculations before submitting
- Attach relevant documentation when available

### Workflow Efficiency
- Use search and filters to find items quickly
- Duplicate similar requests to save time
- Group requests by customer or vessel for batch work
- Review pending changes regularly
- Set notification preferences to match your role

### Data Security
- Log out when leaving your workstation
- Don't share your login credentials
- Report suspicious activity immediately
- Be careful when bulk deleting records
- Regularly review your submitted requests for accuracy

### Performance
- Keep fewer than 10 browser tabs open
- Clear cache periodically (when no pending changes)
- Use Chrome or Firefox for best performance
- Close the application when not in use for extended periods

---

## Keyboard Shortcuts

- **Tab** - Move to next field
- **Shift + Tab** - Move to previous field
- **Enter** - Submit form (in some contexts)
- **Esc** - Close modal/dialog
- **Ctrl/Cmd + F** - Browser search (find text on page)

---

## Glossary

**Request** - A service request or invoice in the system (formerly called "Invoice")

**Contact** - A customer or client in the system

**Vessel** - A boat or ship associated with a request

**Line Item** - Individual service or material entry in a request

**Status** - The current stage of a request in the workflow

**Markup** - Percentage added to material costs for profit

**Tax Exempt** - Items not subject to sales tax

**Change Request** - When modifications are requested to an existing request

**Revision** - Historical version of a request showing changes over time

**Session** - Your logged-in period (expires after 30 minutes of inactivity)

**Offline Mode** - Working in the application without internet connection

**CSRF Token** - Security token to prevent unauthorized actions

**Idempotency** - System prevention of duplicate submissions

---

## Version Information

**System Version**: 1.0.0
**Last Updated**: 2025
**Guide Version**: 1.0

---

## Quick Start Checklist

On your first day:

- [ ] Log in with your credentials
- [ ] Review your profile in Settings
- [ ] Set your notification preferences
- [ ] Explore the Requests page
- [ ] Browse existing Contacts
- [ ] Review existing Vessels
- [ ] Create a test request (if permitted)
- [ ] Practice searching and filtering
- [ ] Try viewing a request in detail
- [ ] Review this guide's Common Tasks section

---

*For additional assistance, contact your system administrator or supervisor.*
