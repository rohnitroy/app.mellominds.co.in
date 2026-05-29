import React, { useState } from 'react';


interface InlineCalendarProps {
    onDateSelect: (date: string) => void;
    selectedDate: string; // YYYY-MM-DD
    maxDate?: string; // YYYY-MM-DD — optional upper bound
}

const InlineCalendar: React.FC<InlineCalendarProps> = ({ onDateSelect, selectedDate, maxDate }) => {
    // Initialize with selected date or today
    const [currentMonth, setCurrentMonth] = useState(selectedDate ? new Date(selectedDate) : new Date());

    const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
    const firstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();

    const monthNames = ["January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"];

    const handlePrevMonth = () => {
        setCurrentMonth(new Date(year, month - 1, 1));
    };

    const handleNextMonth = () => {
        const next = new Date(year, month + 1, 1);
        if (maxDate) {
            const max = new Date(maxDate + 'T00:00:00');
            if (next.getFullYear() > max.getFullYear() ||
                (next.getFullYear() === max.getFullYear() && next.getMonth() > max.getMonth())) {
                return;
            }
        }
        setCurrentMonth(next);
    };

    const handleDayClick = (day: number) => {
        const clickedDate = new Date(year, month, day);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        clickedDate.setHours(0, 0, 0, 0);

        if (clickedDate < today) return;

        if (maxDate) {
            const max = new Date(maxDate + 'T00:00:00');
            max.setHours(0, 0, 0, 0);
            if (clickedDate > max) return;
        }

        const date = new Date(year, month, day);
        const offset = date.getTimezoneOffset();
        const localDate = new Date(date.getTime() - (offset * 60 * 1000));
        const dateString = localDate.toISOString().split('T')[0];
        onDateSelect(dateString);
    };

    const renderDays = () => {
        const totalDays = daysInMonth(year, month);
        const startDay = firstDayOfMonth(year, month);
        const days = [];

        // Empty slots for previous month
        for (let i = 0; i < startDay; i++) {
            days.push(<div key={`empty-${i}`} className="calendar-day empty"></div>);
        }

        // Days
        for (let day = 1; day <= totalDays; day++) {
            // Check if selected
            // Construct YYYY-MM-DD for comparison
            const d = new Date(year, month, day);
            const offset = d.getTimezoneOffset();
            const localD = new Date(d.getTime() - (offset * 60 * 1000));
            const isoDate = localD.toISOString().split('T')[0];

            const isSelected = selectedDate === isoDate;
            const isToday = isoDate === new Date().toISOString().split('T')[0];
            
            // Check if date is in the past
            const dateToCheck = new Date(year, month, day);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            dateToCheck.setHours(0, 0, 0, 0);
            const isPast = dateToCheck < today;

            const isBeyondMax = maxDate
                ? dateToCheck > new Date(new Date(maxDate + 'T00:00:00').setHours(0, 0, 0, 0))
                : false;
            const isDisabled = isPast || isBeyondMax;

            days.push(
                <div
                    key={day}
                    className={`calendar-day ${isSelected ? 'selected' : ''} ${isToday ? 'today' : ''} ${isDisabled ? 'disabled' : ''}`}
                    onClick={() => handleDayClick(day)}
                    style={{ 
                        cursor: isDisabled ? 'not-allowed' : 'pointer',
                        opacity: isDisabled ? 0.4 : 1
                    }}
                >
                    {day}
                </div>
            );
        }

        return days;
    };

    return (
        <div className="inline-calendar">
            <div className="calendar-header">
                <button onClick={handlePrevMonth} className="nav-btn">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="15 18 9 12 15 6"/>
                    </svg>
                </button>
                <div className="current-month">{monthNames[month]} {year}</div>
                <button onClick={handleNextMonth} className="nav-btn">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="9 18 15 12 9 6"/>
                    </svg>
                </button>
            </div>
            <div className="calendar-weekdays">
                <div>Su</div>
                <div>Mo</div>
                <div>Tu</div>
                <div>We</div>
                <div>Th</div>
                <div>Fr</div>
                <div>Sa</div>
            </div>
            <div className="calendar-grid-days">
                {renderDays()}
            </div>
        </div>
    );
};

export default InlineCalendar;
