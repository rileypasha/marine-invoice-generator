/**
 * Master Dashboard - Invoice Changes View
 */

class ChangesViewer {
    constructor() {
        this.invoiceId = this.getInvoiceIdFromUrl();
        this.diffData = null;
        this.init();
    }
    
    getInvoiceIdFromUrl() {
        const params = new URLSearchParams(window.location.search);
        return params.get('id');
    }
    
    async init() {
        if (!this.invoiceId) {
            window.location.href = '/master';
            return;
        }
        
        // Set up event listeners
        this.setupEventListeners();
        
        // Load user info
        await this.loadUserInfo();
        
        // Load diff data
        await this.loadDiff();
    }
    
    setupEventListeners() {
        // Back button
        document.getElementById('backBtn')?.addEventListener('click', () => {
            window.location.href = '/master';
        });
        
        document.getElementById('backBtnEmpty')?.addEventListener('click', () => {
            window.location.href = '/master';
        });
        
        // Mark as seen button
        document.getElementById('markSeenBtn')?.addEventListener('click', () => {
            this.markChangesSeen();
        });
        
        // Logout
        document.getElementById('logoutBtn')?.addEventListener('click', () => {
            this.logout();
        });
    }
    
    async loadUserInfo() {
        try {
            const response = await fetch('/api/auth/check-master', {
                credentials: 'include'
            });
            
            if (!response.ok) {
                window.location.href = '/';
                return;
            }
            
            const data = await response.json();
            document.getElementById('userInfo').textContent = data.user?.name || data.user?.email || 'Master User';
        } catch (error) {
            console.error('Error loading user info:', error);
        }
    }
    
    async loadDiff() {
        try {
            // Show loading state
            document.getElementById('loadingState').style.display = 'block';
            document.getElementById('changesContent').style.display = 'none';
            document.getElementById('emptyState').style.display = 'none';
            
            const response = await fetch(`/api/master/invoices/${this.invoiceId}/diff`, {
                credentials: 'include'
            });
            
            if (!response.ok) {
                throw new Error('Failed to load diff');
            }
            
            this.diffData = await response.json();
            
            // Hide loading
            document.getElementById('loadingState').style.display = 'none';
            
            // Check if there are changes
            if (!this.diffData.diff || this.diffData.diff.summary.additions === 0 && 
                this.diffData.diff.summary.removals === 0 && 
                this.diffData.diff.summary.modifications === 0) {
                document.getElementById('emptyState').style.display = 'block';
                return;
            }
            
            // Display the diff
            this.displayDiff();
            document.getElementById('changesContent').style.display = 'block';
            
        } catch (error) {
            console.error('Error loading diff:', error);
            alert('Failed to load invoice changes. Please try again.');
            window.location.href = '/master';
        }
    }
    
    displayDiff() {
        // Update header info
        document.getElementById('invoiceNumber').textContent = 
            this.diffData.invoice.invoiceNumber || 'N/A';
        document.getElementById('customerName').textContent = 
            this.diffData.invoice.customerName || 'Unknown';
        document.getElementById('submittedAt').textContent = 
            this.formatDate(this.diffData.baseline.submittedAt);
        document.getElementById('lastModified').textContent = 
            this.diffData.latestRevision ? 
            this.formatDate(this.diffData.latestRevision.createdAt) : 
            'No changes';
        
        // Create sections
        const sectionsContainer = document.getElementById('changesSections');
        sectionsContainer.innerHTML = '';
        
        // Process sections
        const sections = this.diffData.diff.sections;
        
        // Customer Details
        if (sections.customerDetails && sections.customerDetails.length > 0) {
            this.createSection('Customer Details', sections.customerDetails, sectionsContainer);
        }
        
        // Vessel Details
        if (sections.vesselDetails && sections.vesselDetails.length > 0) {
            this.createSection('Vessel Details', sections.vesselDetails, sectionsContainer);
        }
        
        // Line Items
        if (sections.lineItems && sections.lineItems.length > 0) {
            this.createLineItemsSection(sections.lineItems, sectionsContainer);
        }
        
        // Financial
        if (sections.financial && sections.financial.length > 0) {
            this.createSection('Financial Details', sections.financial, sectionsContainer);
        }
        
        // Other
        if (sections.other && sections.other.length > 0) {
            this.createSection('Other Changes', sections.other, sectionsContainer);
        }
    }
    
    createSection(title, changes, container) {
        const section = document.createElement('div');
        section.className = 'changes-section';
        
        const header = document.createElement('div');
        header.className = 'section-header';
        header.innerHTML = `
            <span>${title}</span>
            <span class="change-count">${changes.length} change${changes.length !== 1 ? 's' : ''}</span>
        `;
        section.appendChild(header);
        
        const list = document.createElement('div');
        list.className = 'changes-list';
        
        changes.forEach(change => {
            const item = document.createElement('div');
            item.className = 'change-item';
            
            const field = document.createElement('div');
            field.className = 'change-field';
            field.textContent = this.formatFieldName(change.path);
            
            const values = document.createElement('div');
            values.className = 'change-values';
            
            if (change.type === 'added') {
                values.innerHTML = `<span class="value-added">${this.formatValue(change.new)}</span>`;
            } else if (change.type === 'removed') {
                values.innerHTML = `<span class="value-removed">${this.formatValue(change.old)}</span>`;
            } else if (change.type === 'changed') {
                values.innerHTML = `
                    <span class="value-old">${this.formatValue(change.old)}</span>
                    <span class="arrow">→</span>
                    <span class="value-new">${this.formatValue(change.new)}</span>
                `;
            }
            
            item.appendChild(field);
            item.appendChild(values);
            list.appendChild(item);
        });
        
        section.appendChild(list);
        container.appendChild(section);
    }
    
    createLineItemsSection(lineChanges, container) {
        const section = document.createElement('div');
        section.className = 'changes-section';
        
        const header = document.createElement('div');
        header.className = 'section-header';
        header.innerHTML = `
            <span>Line Items</span>
            <span class="change-count">${lineChanges.length} change${lineChanges.length !== 1 ? 's' : ''}</span>
        `;
        section.appendChild(header);
        
        const itemsContainer = document.createElement('div');
        itemsContainer.className = 'line-items-section';
        
        lineChanges.forEach(change => {
            const lineItem = document.createElement('div');
            lineItem.className = 'line-item';
            
            const itemHeader = document.createElement('div');
            itemHeader.className = 'line-item-header';
            
            const title = document.createElement('span');
            title.className = 'line-item-title';
            title.textContent = this.extractLineItemTitle(change);
            
            const badge = document.createElement('span');
            badge.className = `line-item-badge badge-${change.type}`;
            badge.textContent = change.type;
            
            itemHeader.appendChild(title);
            itemHeader.appendChild(badge);
            lineItem.appendChild(itemHeader);
            
            if (change.type === 'modified' && change.fieldChanges) {
                const changesDiv = document.createElement('div');
                changesDiv.className = 'line-item-changes';
                
                change.fieldChanges.forEach(fieldChange => {
                    const changeDiv = document.createElement('div');
                    changeDiv.className = 'change-item';
                    changeDiv.innerHTML = `
                        <strong>${this.formatFieldName(fieldChange.path.split('.').pop())}:</strong>
                        ${this.formatFieldChange(fieldChange)}
                    `;
                    changesDiv.appendChild(changeDiv);
                });
                
                lineItem.appendChild(changesDiv);
            }
            
            itemsContainer.appendChild(lineItem);
        });
        
        section.appendChild(itemsContainer);
        container.appendChild(section);
    }
    
    extractLineItemTitle(change) {
        if (change.type === 'added' && change.new) {
            return change.new.description || change.new.name || 'New Item';
        }
        if (change.type === 'removed' && change.old) {
            return change.old.description || change.old.name || 'Removed Item';
        }
        if (change.type === 'modified') {
            const match = change.path.match(/\[(\d+)\]/);
            return `Line Item ${match ? parseInt(match[1]) + 1 : ''}`;
        }
        return 'Line Item';
    }
    
    formatFieldChange(change) {
        if (change.type === 'added') {
            return `<span class="value-added">${this.formatValue(change.new)}</span>`;
        }
        if (change.type === 'removed') {
            return `<span class="value-removed">${this.formatValue(change.old)}</span>`;
        }
        if (change.type === 'changed') {
            return `<span class="value-old">${this.formatValue(change.old)}</span> → <span class="value-new">${this.formatValue(change.new)}</span>`;
        }
        return '';
    }
    
    formatFieldName(path) {
        // Convert path to human-readable name
        const parts = path.split('.');
        const lastPart = parts[parts.length - 1];
        
        // Remove array indices
        const cleaned = lastPart.replace(/\[\d+\]/, '');
        
        // Convert camelCase to Title Case
        return cleaned
            .replace(/([A-Z])/g, ' $1')
            .replace(/^./, str => str.toUpperCase())
            .trim();
    }
    
    formatValue(value) {
        if (value === null || value === undefined) return 'Empty';
        if (typeof value === 'boolean') return value ? 'Yes' : 'No';
        if (typeof value === 'number') {
            // Format currency if it looks like a price
            if (value > 100 || value.toString().includes('.')) {
                return `$${value.toFixed(2)}`;
            }
            return value.toString();
        }
        if (typeof value === 'object') {
            return JSON.stringify(value, null, 2);
        }
        return value.toString();
    }
    
    formatDate(dateString) {
        if (!dateString) return 'N/A';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }
    
    async markChangesSeen() {
        try {
            const response = await fetch(`/api/master/invoices/${this.invoiceId}/mark-changes-seen`, {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                throw new Error('Failed to mark changes as seen');
            }
            
            // Show success message
            const btn = document.getElementById('markSeenBtn');
            const originalText = btn.textContent;
            btn.textContent = '✓ Marked as Reviewed';
            btn.disabled = true;
            
            // Redirect back to dashboard after a short delay
            setTimeout(() => {
                window.location.href = '/master';
            }, 1500);
            
        } catch (error) {
            console.error('Error marking changes as seen:', error);
            alert('Failed to mark changes as reviewed. Please try again.');
        }
    }
    
    async logout() {
        try {
            await fetch('/api/auth/logout', {
                method: 'POST',
                credentials: 'include'
            });
            window.location.href = '/';
        } catch (error) {
            console.error('Logout error:', error);
        }
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new ChangesViewer();
});