/**
 * DateRangePicker - Custom dark-themed date range selector
 * Replaces browser-native date inputs with a fully-featured calendar modal
 */
class DateRangePicker {
    constructor(options = {}) {
        this.options = {
            onConfirm: options.onConfirm || (() => {}),
            onCancel: options.onCancel || (() => {}),
            startDate: options.startDate || null,
            endDate: options.endDate || null,
            minDate: options.minDate || null,
            maxDate: options.maxDate || new Date(),
            locale: options.locale || 'en-US',
            firstDayOfWeek: options.firstDayOfWeek || 0, // 0 = Sunday, 1 = Monday
            ...options
        };
        
        this.currentStartDate = this.options.startDate;
        this.currentEndDate = this.options.endDate;
        this.viewMonth = new Date();
        this.selectingEndDate = false;
        this.isOpen = false;
        
        // Focus management
        this.focusedDate = null;
        this.lastFocusedElement = null;
        
        this.init();
    }
    
    init() {
        this.createModal();
        this.attachEventListeners();
    }
    
    createModal() {
        // Create modal container
        const modal = document.createElement('div');
        modal.className = 'date-range-picker-modal';
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');
        modal.setAttribute('aria-label', 'Select date range');
        modal.innerHTML = `
            <div class="date-range-overlay"></div>
            <div class="date-range-panel">
                <div class="date-range-header">
                    <h3>Select Date Range</h3>
                    <button class="date-range-close" aria-label="Close date picker">&times;</button>
                </div>
                
                <div class="date-range-content">
                    <div class="date-range-inputs">
                        <div class="date-input-group">
                            <label for="drp-start-date">Start Date</label>
                            <input type="text" 
                                   id="drp-start-date" 
                                   class="date-display-input" 
                                   readonly 
                                   placeholder="Select start date"
                                   aria-label="Start date">
                        </div>
                        <div class="date-input-group">
                            <label for="drp-end-date">End Date</label>
                            <input type="text" 
                                   id="drp-end-date" 
                                   class="date-display-input" 
                                   readonly 
                                   placeholder="Select end date"
                                   aria-label="End date">
                        </div>
                    </div>
                    
                    <div class="date-range-calendars">
                        <div class="calendar-container">
                            <div class="calendar-nav">
                                <button class="cal-nav-btn prev-month" aria-label="Previous month">
                                    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                                        <path d="M10 12L6 8l4-4"/>
                                    </svg>
                                </button>
                                <div class="cal-nav-center">
                                    <select class="month-select" aria-label="Select month"></select>
                                    <select class="year-select" aria-label="Select year"></select>
                                </div>
                                <button class="cal-nav-btn next-month" aria-label="Next month">
                                    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                                        <path d="M6 12l4-4-4-4"/>
                                    </svg>
                                </button>
                            </div>
                            
                            <div class="calendar-grid" role="grid" aria-label="Calendar">
                                <div class="weekday-header" role="row"></div>
                                <div class="date-grid" role="rowgroup"></div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="date-range-shortcuts">
                        <button class="shortcut-btn" data-range="today">Today</button>
                        <button class="shortcut-btn" data-range="yesterday">Yesterday</button>
                        <button class="shortcut-btn" data-range="last7days">Last 7 Days</button>
                        <button class="shortcut-btn" data-range="last30days">Last 30 Days</button>
                        <button class="shortcut-btn" data-range="thisMonth">This Month</button>
                        <button class="shortcut-btn" data-range="lastMonth">Last Month</button>
                        <button class="shortcut-btn" data-range="custom">Custom Range</button>
                    </div>
                </div>
                
                <div class="date-range-footer">
                    <button class="btn-cancel" id="drp-cancel">Cancel</button>
                    <button class="btn-confirm" id="drp-confirm">Confirm</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        this.modal = modal;
        this.panel = modal.querySelector('.date-range-panel');
        
        // Cache DOM references
        this.elements = {
            startInput: modal.querySelector('#drp-start-date'),
            endInput: modal.querySelector('#drp-end-date'),
            monthSelect: modal.querySelector('.month-select'),
            yearSelect: modal.querySelector('.year-select'),
            weekdayHeader: modal.querySelector('.weekday-header'),
            dateGrid: modal.querySelector('.date-grid'),
            prevMonthBtn: modal.querySelector('.prev-month'),
            nextMonthBtn: modal.querySelector('.next-month'),
            confirmBtn: modal.querySelector('#drp-confirm'),
            cancelBtn: modal.querySelector('#drp-cancel'),
            closeBtn: modal.querySelector('.date-range-close'),
            overlay: modal.querySelector('.date-range-overlay')
        };
        
        this.populateSelects();
        this.renderCalendar();
    }
    
    populateSelects() {
        const months = [
            'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'
        ];
        
        // Populate month select
        months.forEach((month, index) => {
            const option = document.createElement('option');
            option.value = index;
            option.textContent = month;
            this.elements.monthSelect.appendChild(option);
        });
        
        // Populate year select (last 10 years to current year)
        const currentYear = new Date().getFullYear();
        for (let year = currentYear; year >= currentYear - 10; year--) {
            const option = document.createElement('option');
            option.value = year;
            option.textContent = year;
            this.elements.yearSelect.appendChild(option);
        }
    }
    
    renderCalendar() {
        const year = this.viewMonth.getFullYear();
        const month = this.viewMonth.getMonth();
        
        // Update selects
        this.elements.monthSelect.value = month;
        this.elements.yearSelect.value = year;
        
        // Render weekday headers
        const weekdays = this.getWeekdayNames();
        this.elements.weekdayHeader.innerHTML = weekdays.map(day => 
            `<div class="weekday-cell" role="columnheader">${day}</div>`
        ).join('');
        
        // Get calendar days
        const days = this.getCalendarDays(year, month);
        
        // Render date grid
        this.elements.dateGrid.innerHTML = days.map(day => {
            const classes = ['date-cell'];
            const isDisabled = this.isDateDisabled(day.date);
            const isSelected = this.isDateSelected(day.date);
            const isInRange = this.isDateInRange(day.date);
            const isStart = this.isStartDate(day.date);
            const isEnd = this.isEndDate(day.date);
            const isToday = this.isToday(day.date);
            
            if (!day.currentMonth) classes.push('other-month');
            if (isDisabled) classes.push('disabled');
            if (isSelected) classes.push('selected');
            if (isInRange) classes.push('in-range');
            if (isStart) classes.push('range-start');
            if (isEnd) classes.push('range-end');
            if (isToday) classes.push('today');
            
            return `
                <button class="${classes.join(' ')}" 
                        role="gridcell"
                        aria-label="${this.formatDateAria(day.date)}"
                        aria-selected="${isSelected}"
                        aria-disabled="${isDisabled}"
                        data-date="${day.date.toISOString()}"
                        ${isDisabled ? 'disabled' : ''}
                        tabindex="-1">
                    ${day.date.getDate()}
                </button>
            `;
        }).join('');
        
        this.updateDateInputs();
    }
    
    getWeekdayNames() {
        const baseDate = new Date(2024, 0, 1); // Monday, Jan 1, 2024
        const weekdays = [];
        
        for (let i = 0; i < 7; i++) {
            const date = new Date(baseDate);
            date.setDate(date.getDate() + ((this.options.firstDayOfWeek + i) % 7));
            weekdays.push(date.toLocaleDateString(this.options.locale, { weekday: 'short' }));
        }
        
        return weekdays;
    }
    
    getCalendarDays(year, month) {
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const startDate = new Date(firstDay);
        const endDate = new Date(lastDay);
        
        // Adjust to show previous month's trailing days
        const startDayOfWeek = startDate.getDay();
        const daysToSubtract = (startDayOfWeek - this.options.firstDayOfWeek + 7) % 7;
        startDate.setDate(startDate.getDate() - daysToSubtract);
        
        // Adjust to show next month's leading days (always show 42 days = 6 weeks)
        const days = [];
        const current = new Date(startDate);
        
        for (let i = 0; i < 42; i++) {
            days.push({
                date: new Date(current),
                currentMonth: current.getMonth() === month
            });
            current.setDate(current.getDate() + 1);
        }
        
        return days;
    }
    
    isDateDisabled(date) {
        if (this.options.minDate && date < this.options.minDate) return true;
        if (this.options.maxDate && date > this.options.maxDate) return true;
        return false;
    }
    
    isDateSelected(date) {
        return this.isSameDay(date, this.currentStartDate) || 
               this.isSameDay(date, this.currentEndDate);
    }
    
    isDateInRange(date) {
        if (!this.currentStartDate || !this.currentEndDate) return false;
        return date >= this.currentStartDate && date <= this.currentEndDate;
    }
    
    isStartDate(date) {
        return this.isSameDay(date, this.currentStartDate);
    }
    
    isEndDate(date) {
        return this.isSameDay(date, this.currentEndDate);
    }
    
    isToday(date) {
        return this.isSameDay(date, new Date());
    }
    
    isSameDay(date1, date2) {
        if (!date1 || !date2) return false;
        return date1.getFullYear() === date2.getFullYear() &&
               date1.getMonth() === date2.getMonth() &&
               date1.getDate() === date2.getDate();
    }
    
    formatDateAria(date) {
        return date.toLocaleDateString(this.options.locale, {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }
    
    formatDateDisplay(date) {
        if (!date) return '';
        return date.toLocaleDateString(this.options.locale, {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    }
    
    updateDateInputs() {
        this.elements.startInput.value = this.formatDateDisplay(this.currentStartDate);
        this.elements.endInput.value = this.formatDateDisplay(this.currentEndDate);
        
        // Update visual state
        if (this.currentStartDate && !this.currentEndDate) {
            this.elements.startInput.classList.add('active');
            this.elements.endInput.classList.remove('active');
        } else if (this.currentStartDate && this.currentEndDate) {
            this.elements.startInput.classList.add('active');
            this.elements.endInput.classList.add('active');
        } else {
            this.elements.startInput.classList.remove('active');
            this.elements.endInput.classList.remove('active');
        }
    }
    
    attachEventListeners() {
        // Date cell clicks
        this.elements.dateGrid.addEventListener('click', (e) => {
            const cell = e.target.closest('.date-cell');
            if (cell && !cell.classList.contains('disabled')) {
                this.handleDateClick(new Date(cell.dataset.date));
            }
        });
        
        // Navigation
        this.elements.prevMonthBtn.addEventListener('click', () => this.navigateMonth(-1));
        this.elements.nextMonthBtn.addEventListener('click', () => this.navigateMonth(1));
        
        // Select changes
        this.elements.monthSelect.addEventListener('change', () => {
            this.viewMonth.setMonth(parseInt(this.elements.monthSelect.value));
            this.renderCalendar();
        });
        
        this.elements.yearSelect.addEventListener('change', () => {
            this.viewMonth.setFullYear(parseInt(this.elements.yearSelect.value));
            this.renderCalendar();
        });
        
        // Shortcuts
        this.modal.querySelectorAll('.shortcut-btn').forEach(btn => {
            btn.addEventListener('click', () => this.applyShortcut(btn.dataset.range));
        });
        
        // Footer buttons
        this.elements.confirmBtn.addEventListener('click', () => this.confirm());
        this.elements.cancelBtn.addEventListener('click', () => this.cancel());
        this.elements.closeBtn.addEventListener('click', () => this.cancel());
        this.elements.overlay.addEventListener('click', () => this.cancel());
        
        // Keyboard navigation
        this.modal.addEventListener('keydown', (e) => this.handleKeyDown(e));
        
        // Prevent panel clicks from closing
        this.panel.addEventListener('click', (e) => e.stopPropagation());
    }
    
    handleDateClick(date) {
        if (!this.currentStartDate || (this.currentStartDate && this.currentEndDate)) {
            // Start new selection
            this.currentStartDate = date;
            this.currentEndDate = null;
            this.selectingEndDate = true;
        } else if (this.selectingEndDate) {
            // Select end date
            if (date < this.currentStartDate) {
                // Swap if end is before start
                this.currentEndDate = this.currentStartDate;
                this.currentStartDate = date;
            } else {
                this.currentEndDate = date;
            }
            this.selectingEndDate = false;
        }
        
        this.renderCalendar();
    }
    
    navigateMonth(direction) {
        this.viewMonth.setMonth(this.viewMonth.getMonth() + direction);
        this.renderCalendar();
    }
    
    applyShortcut(range) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        switch (range) {
            case 'today':
                this.currentStartDate = new Date(today);
                this.currentEndDate = new Date(today);
                break;
                
            case 'yesterday':
                const yesterday = new Date(today);
                yesterday.setDate(yesterday.getDate() - 1);
                this.currentStartDate = yesterday;
                this.currentEndDate = yesterday;
                break;
                
            case 'last7days':
                const week = new Date(today);
                week.setDate(week.getDate() - 6);
                this.currentStartDate = week;
                this.currentEndDate = today;
                break;
                
            case 'last30days':
                const month = new Date(today);
                month.setDate(month.getDate() - 29);
                this.currentStartDate = month;
                this.currentEndDate = today;
                break;
                
            case 'thisMonth':
                this.currentStartDate = new Date(today.getFullYear(), today.getMonth(), 1);
                this.currentEndDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
                break;
                
            case 'lastMonth':
                const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
                this.currentStartDate = new Date(lastMonth);
                this.currentEndDate = new Date(today.getFullYear(), today.getMonth(), 0);
                break;
                
            case 'custom':
                this.currentStartDate = null;
                this.currentEndDate = null;
                break;
        }
        
        // Update view month to show the selected range
        if (this.currentStartDate) {
            this.viewMonth = new Date(this.currentStartDate);
        }
        
        this.renderCalendar();
    }
    
    handleKeyDown(e) {
        switch (e.key) {
            case 'Escape':
                e.preventDefault();
                this.cancel();
                break;
                
            case 'Enter':
                if (e.target.classList.contains('date-cell') && !e.target.disabled) {
                    e.preventDefault();
                    this.handleDateClick(new Date(e.target.dataset.date));
                }
                break;
                
            case 'Tab':
                // Trap focus within modal
                const focusableElements = this.modal.querySelectorAll(
                    'button:not([disabled]), select, input'
                );
                const firstElement = focusableElements[0];
                const lastElement = focusableElements[focusableElements.length - 1];
                
                if (e.shiftKey && document.activeElement === firstElement) {
                    e.preventDefault();
                    lastElement.focus();
                } else if (!e.shiftKey && document.activeElement === lastElement) {
                    e.preventDefault();
                    firstElement.focus();
                }
                break;
                
            case 'ArrowLeft':
            case 'ArrowRight':
            case 'ArrowUp':
            case 'ArrowDown':
                if (e.target.classList.contains('date-cell')) {
                    e.preventDefault();
                    this.navigateCalendarGrid(e.key);
                }
                break;
        }
    }
    
    navigateCalendarGrid(key) {
        const cells = Array.from(this.elements.dateGrid.querySelectorAll('.date-cell:not([disabled])'));
        const currentIndex = cells.indexOf(document.activeElement);
        
        if (currentIndex === -1) {
            cells[0]?.focus();
            return;
        }
        
        let newIndex = currentIndex;
        
        switch (key) {
            case 'ArrowLeft':
                newIndex = Math.max(0, currentIndex - 1);
                break;
            case 'ArrowRight':
                newIndex = Math.min(cells.length - 1, currentIndex + 1);
                break;
            case 'ArrowUp':
                newIndex = Math.max(0, currentIndex - 7);
                break;
            case 'ArrowDown':
                newIndex = Math.min(cells.length - 1, currentIndex + 7);
                break;
        }
        
        cells[newIndex]?.focus();
    }
    
    open(triggerElement) {
        if (this.isOpen) return;
        
        this.lastFocusedElement = triggerElement || document.activeElement;
        this.modal.style.display = 'block';
        document.body.classList.add('date-picker-open');
        
        // Force reflow for animation
        this.modal.offsetHeight;
        this.modal.classList.add('active');
        
        this.isOpen = true;
        
        // Focus first date or today
        setTimeout(() => {
            const todayCell = this.modal.querySelector('.date-cell.today:not([disabled])');
            const firstCell = this.modal.querySelector('.date-cell:not([disabled])');
            (todayCell || firstCell)?.focus();
        }, 100);
    }
    
    close() {
        if (!this.isOpen) return;
        
        this.modal.classList.remove('active');
        
        setTimeout(() => {
            this.modal.style.display = 'none';
            document.body.classList.remove('date-picker-open');
            
            // Restore focus
            if (this.lastFocusedElement) {
                this.lastFocusedElement.focus();
            }
            
            this.isOpen = false;
        }, 300);
    }
    
    confirm() {
        if (this.currentStartDate && this.currentEndDate) {
            this.options.onConfirm({
                startDate: this.currentStartDate,
                endDate: this.currentEndDate
            });
            this.close();
        }
    }
    
    cancel() {
        // Restore original dates
        this.currentStartDate = this.options.startDate;
        this.currentEndDate = this.options.endDate;
        this.options.onCancel();
        this.close();
    }
    
    destroy() {
        if (this.modal) {
            this.modal.remove();
        }
    }
    
    // Public API
    setDates(startDate, endDate) {
        this.currentStartDate = startDate;
        this.currentEndDate = endDate;
        this.options.startDate = startDate;
        this.options.endDate = endDate;
        
        if (startDate) {
            this.viewMonth = new Date(startDate);
        }
        
        if (this.isOpen) {
            this.renderCalendar();
        }
    }
    
    getDates() {
        return {
            startDate: this.currentStartDate,
            endDate: this.currentEndDate
        };
    }
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DateRangePicker;
}