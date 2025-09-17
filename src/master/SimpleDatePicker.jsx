/**
 * SimpleDatePicker - Minimal dark-themed date picker dropdown
 * Mimics native browser date input but with dark theme
 */
class SimpleDatePicker {
    constructor(inputElement, options = {}) {
        this.input = inputElement;
        this.options = {
            onChange: options.onChange || (() => {}),
            minDate: options.minDate || null,
            maxDate: options.maxDate || new Date(),
            theme: options.theme || 'dark',
            ...options
        };
        
        this.selectedDate = null;
        this.viewDate = new Date();
        this.isOpen = false;
        this.dropdown = null;
        
        this.init();
    }
    
    init() {
        // Hide the original input
        this.input.type = 'text';
        this.input.readOnly = true;
        this.input.classList.add('date-input-trigger');
        
        // Parse existing value
        if (this.input.value) {
            this.selectedDate = new Date(this.input.value);
            this.viewDate = new Date(this.selectedDate);
            this.updateInputDisplay();
        }
        
        this.createDropdown();
        this.attachEventListeners();
    }
    
    createDropdown() {
        // Create dropdown container
        const dropdown = document.createElement('div');
        dropdown.className = 'simple-date-dropdown';
        dropdown.style.display = 'none';
        dropdown.innerHTML = `
            <div class="date-dropdown-header">
                <button class="date-nav-btn prev" aria-label="Previous month">‹</button>
                <div class="date-month-year">
                    <select class="date-month-select"></select>
                    <select class="date-year-select"></select>
                </div>
                <button class="date-nav-btn next" aria-label="Next month">›</button>
            </div>
            <div class="date-weekdays"></div>
            <div class="date-days"></div>
        `;
        
        // Position after input
        this.input.parentNode.insertBefore(dropdown, this.input.nextSibling);
        this.dropdown = dropdown;
        
        // Cache elements
        this.elements = {
            monthSelect: dropdown.querySelector('.date-month-select'),
            yearSelect: dropdown.querySelector('.date-year-select'),
            weekdays: dropdown.querySelector('.date-weekdays'),
            days: dropdown.querySelector('.date-days'),
            prevBtn: dropdown.querySelector('.prev'),
            nextBtn: dropdown.querySelector('.next')
        };
        
        this.populateSelects();
        this.render();
    }
    
    populateSelects() {
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                       'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        
        months.forEach((month, i) => {
            const option = document.createElement('option');
            option.value = i;
            option.textContent = month;
            this.elements.monthSelect.appendChild(option);
        });
        
        const currentYear = new Date().getFullYear();
        for (let year = currentYear; year >= currentYear - 10; year--) {
            const option = document.createElement('option');
            option.value = year;
            option.textContent = year;
            this.elements.yearSelect.appendChild(option);
        }
    }
    
    render() {
        const year = this.viewDate.getFullYear();
        const month = this.viewDate.getMonth();
        
        // Update selects
        this.elements.monthSelect.value = month;
        this.elements.yearSelect.value = year;
        
        // Render weekdays
        const weekdays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
        this.elements.weekdays.innerHTML = weekdays
            .map(day => `<div class="date-weekday">${day}</div>`)
            .join('');
        
        // Get days
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const startPadding = firstDay.getDay();
        
        let html = '';
        
        // Previous month padding
        for (let i = 0; i < startPadding; i++) {
            html += '<div class="date-day other-month"></div>';
        }
        
        // Current month days
        for (let day = 1; day <= lastDay.getDate(); day++) {
            const date = new Date(year, month, day);
            const isToday = this.isToday(date);
            const isSelected = this.isSelected(date);
            const isDisabled = this.isDisabled(date);
            
            const classes = ['date-day'];
            if (isToday) classes.push('today');
            if (isSelected) classes.push('selected');
            if (isDisabled) classes.push('disabled');
            
            html += `<div class="${classes.join(' ')}" data-date="${date.toISOString()}">${day}</div>`;
        }
        
        this.elements.days.innerHTML = html;
    }
    
    isToday(date) {
        const today = new Date();
        return date.getDate() === today.getDate() &&
               date.getMonth() === today.getMonth() &&
               date.getFullYear() === today.getFullYear();
    }
    
    isSelected(date) {
        if (!this.selectedDate) return false;
        return date.getDate() === this.selectedDate.getDate() &&
               date.getMonth() === this.selectedDate.getMonth() &&
               date.getFullYear() === this.selectedDate.getFullYear();
    }
    
    isDisabled(date) {
        if (this.options.minDate && date < this.options.minDate) return true;
        if (this.options.maxDate && date > this.options.maxDate) return true;
        return false;
    }
    
    attachEventListeners() {
        // Input click
        this.input.addEventListener('click', () => this.toggle());
        
        // Day selection
        this.elements.days.addEventListener('click', (e) => {
            if (e.target.classList.contains('date-day') && 
                !e.target.classList.contains('disabled') &&
                !e.target.classList.contains('other-month')) {
                this.selectDate(new Date(e.target.dataset.date));
            }
        });
        
        // Navigation
        this.elements.prevBtn.addEventListener('click', () => {
            this.viewDate.setMonth(this.viewDate.getMonth() - 1);
            this.render();
        });
        
        this.elements.nextBtn.addEventListener('click', () => {
            this.viewDate.setMonth(this.viewDate.getMonth() + 1);
            this.render();
        });
        
        // Select changes
        this.elements.monthSelect.addEventListener('change', () => {
            this.viewDate.setMonth(parseInt(this.elements.monthSelect.value));
            this.render();
        });
        
        this.elements.yearSelect.addEventListener('change', () => {
            this.viewDate.setFullYear(parseInt(this.elements.yearSelect.value));
            this.render();
        });
        
        // Click outside to close
        document.addEventListener('click', (e) => {
            if (!this.input.contains(e.target) && !this.dropdown.contains(e.target)) {
                this.close();
            }
        });
        
        // Escape to close
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isOpen) {
                this.close();
            }
        });
    }
    
    selectDate(date) {
        this.selectedDate = date;
        this.updateInputDisplay();
        
        // Update hidden input value
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const formattedDate = `${year}-${month}-${day}`;
        
        // Update the actual input value
        this.input.value = formattedDate;
        
        // Trigger change event
        this.input.dispatchEvent(new Event('change', { bubbles: true }));
        this.options.onChange(date, formattedDate);
        
        this.close();
    }
    
    updateInputDisplay() {
        if (!this.selectedDate) {
            this.input.placeholder = 'Select date';
            return;
        }
        
        // Display format: MM/DD/YYYY
        const month = String(this.selectedDate.getMonth() + 1).padStart(2, '0');
        const day = String(this.selectedDate.getDate()).padStart(2, '0');
        const year = this.selectedDate.getFullYear();
        this.input.placeholder = `${month}/${day}/${year}`;
    }
    
    toggle() {
        if (this.isOpen) {
            this.close();
        } else {
            this.open();
        }
    }
    
    open() {
        if (this.isOpen) return;
        
        // Position dropdown
        const rect = this.input.getBoundingClientRect();
        this.dropdown.style.position = 'absolute';
        this.dropdown.style.top = `${rect.height + 4}px`;
        this.dropdown.style.left = '0';
        this.dropdown.style.display = 'block';
        
        this.isOpen = true;
        this.input.classList.add('active');
    }
    
    close() {
        if (!this.isOpen) return;
        
        this.dropdown.style.display = 'none';
        this.isOpen = false;
        this.input.classList.remove('active');
    }
    
    getValue() {
        return this.input.value;
    }
    
    setValue(dateString) {
        if (!dateString) {
            this.selectedDate = null;
            this.input.value = '';
            this.updateInputDisplay();
            return;
        }
        
        this.selectedDate = new Date(dateString);
        this.viewDate = new Date(this.selectedDate);
        this.input.value = dateString;
        this.updateInputDisplay();
        this.render();
    }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SimpleDatePicker;
}