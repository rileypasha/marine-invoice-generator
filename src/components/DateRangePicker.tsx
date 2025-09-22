import React, { useState, useRef, useEffect } from 'react';
import { Button, Input } from './magic/index';
import './DateRangePicker.css';

interface DateRange {
  start?: Date;
  end?: Date;
}

interface DateRangePickerProps {
  value?: DateRange;
  onChange?: (range: DateRange) => void;
  placeholder?: string;
  className?: string;
}

const DateRangePicker: React.FC<DateRangePickerProps> = ({
  value = {},
  onChange,
  placeholder = "Select date range",
  className = ""
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectingEndDate, setSelectingEndDate] = useState(false);
  const [tempStartDate, setTempStartDate] = useState<Date | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const formatDate = (date?: Date) => {
    if (!date) return '';
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getDisplayValue = () => {
    if (value.start && value.end) {
      return `${formatDate(value.start)} - ${formatDate(value.end)}`;
    }
    if (value.start) {
      return `${formatDate(value.start)} - Select end date`;
    }
    return placeholder;
  };

  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const isSameDay = (date1?: Date, date2?: Date) => {
    if (!date1 || !date2) return false;
    return date1.toDateString() === date2.toDateString();
  };

  const isInRange = (date: Date) => {
    if (!value.start || !value.end) return false;
    return date >= value.start && date <= value.end;
  };

  const isToday = (date: Date) => {
    return isSameDay(date, new Date());
  };

  const handleDateClick = (day: number) => {
    const clickedDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);

    if (!value.start || (value.start && value.end)) {
      // Start new selection
      onChange?.({ start: clickedDate });
      setTempStartDate(clickedDate);
      setSelectingEndDate(true);
    } else if (value.start && !value.end) {
      // Set end date
      if (clickedDate >= value.start) {
        onChange?.({ start: value.start, end: clickedDate });
        setSelectingEndDate(false);
        setIsOpen(false);
      } else {
        // If end date is before start date, swap them
        onChange?.({ start: clickedDate, end: value.start });
        setSelectingEndDate(false);
        setIsOpen(false);
      }
    }
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentMonth(prev => {
      const newMonth = new Date(prev);
      if (direction === 'prev') {
        newMonth.setMonth(prev.getMonth() - 1);
      } else {
        newMonth.setMonth(prev.getMonth() + 1);
      }
      return newMonth;
    });
  };

  const handlePreset = (days: number) => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - days);

    onChange?.({ start, end });
    setIsOpen(false);
  };

  const clearSelection = () => {
    onChange?.({});
    setTempStartDate(null);
    setSelectingEndDate(false);
  };

  const renderCalendar = () => {
    const daysInMonth = getDaysInMonth(currentMonth);
    const firstDay = getFirstDayOfMonth(currentMonth);
    const days = [];

    // Empty cells for days before the first day of the month
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="calendar-day empty"></div>);
    }

    // Days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
      const isStart = isSameDay(date, value.start);
      const isEnd = isSameDay(date, value.end);
      const inRange = isInRange(date);
      const today = isToday(date);

      days.push(
        <button
          key={day}
          className={`calendar-day ${isStart ? 'start' : ''} ${isEnd ? 'end' : ''} ${inRange ? 'in-range' : ''} ${today ? 'today' : ''}`}
          onClick={() => handleDateClick(day)}
        >
          {day}
        </button>
      );
    }

    return days;
  };

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className={`date-range-picker ${className}`}>
      <div className="date-range-trigger" onClick={() => setIsOpen(!isOpen)}>
        <Input
          value={getDisplayValue()}
          placeholder={placeholder}
          readOnly
          className="date-range-input"
        />
        <svg className="date-range-icon" width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <path d="M3.5 0a.5.5 0 0 1 .5.5V1h8V.5a.5.5 0 0 1 1 0V1h1a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V3a2 2 0 0 1 2-2h1V.5a.5.5 0 0 1 .5-.5zM2 2a1 1 0 0 0-1 1v1h14V3a1 1 0 0 0-1-1H2zm13 3H1v9a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V5z"/>
        </svg>
      </div>

      {isOpen && (
        <div className="date-range-dropdown">
          <div className="date-range-header">
            <h4>Select Date Range</h4>
            <button
              className="close-button"
              onClick={() => setIsOpen(false)}
            >
              ×
            </button>
          </div>

          <div className="date-range-presets">
            <Button variant="outline" size="sm" onClick={() => handlePreset(7)}>
              Last 7 days
            </Button>
            <Button variant="outline" size="sm" onClick={() => handlePreset(30)}>
              Last 30 days
            </Button>
            <Button variant="outline" size="sm" onClick={() => handlePreset(90)}>
              Last 90 days
            </Button>
            <Button variant="outline" size="sm" onClick={clearSelection}>
              Clear
            </Button>
          </div>

          <div className="calendar-container">
            <div className="calendar-nav">
              <button
                className="nav-button"
                onClick={() => navigateMonth('prev')}
              >
                ‹
              </button>
              <div className="nav-title">
                {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
              </div>
              <button
                className="nav-button"
                onClick={() => navigateMonth('next')}
              >
                ›
              </button>
            </div>

            <div className="calendar-weekdays">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <div key={day} className="weekday">{day}</div>
              ))}
            </div>

            <div className="calendar-grid">
              {renderCalendar()}
            </div>
          </div>

          <div className="date-range-footer">
            {value.start && (
              <div className="selected-range">
                <span>Start: {formatDate(value.start)}</span>
                {value.end && <span>End: {formatDate(value.end)}</span>}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default DateRangePicker;