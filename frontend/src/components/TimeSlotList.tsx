import React, { useState, useEffect, useCallback } from 'react';
import API_BASE_URL from '../config/api';
import Loader from './Loader';

interface TimeSlotListProps {
    calendarId: number;
    selectedDate: string; // YYYY-MM-DD
    onSlotSelect: (slot: string) => void;
    selectedSlot: string | null;
}

const TimeSlotList: React.FC<TimeSlotListProps> = ({ calendarId, selectedDate, onSlotSelect, selectedSlot }) => {
    const [slots, setSlots] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);

    const fetchSlots = useCallback(async () => {
        setLoading(true);
        setSlots([]);

        try {
            const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
            const response = await fetch(`${API_BASE_URL}/api/availability/slots?date=${selectedDate}&calendarId=${calendarId}&timeZone=${timeZone}`);

            if (response.ok) {
                const data = await response.json();
                setSlots(data.slots || data || []);
            } else {
                console.error('Failed to load slots');
            }
        } catch (err) {
            console.error('Error fetching slots:', err);
        } finally {
            setLoading(false);
        }
    }, [calendarId, selectedDate]);

    useEffect(() => {
        if (calendarId && selectedDate) {
            fetchSlots();
        }
    }, [calendarId, selectedDate, fetchSlots]);

    // Slots come back as "9:00AM", "10:30PM" etc.
    // Convert to ISO datetime for the backend by combining with selectedDate
    const slotToISO = (slot: string): string => {
        const match = slot.match(/^(\d+):(\d+)(AM|PM)$/i);
        if (!match) return '';
        let h = parseInt(match[1]);
        const m = parseInt(match[2]);
        const period = match[3].toUpperCase();
        if (period === 'PM' && h !== 12) h += 12;
        if (period === 'AM' && h === 12) h = 0;
        // Build as IST (UTC+5:30) — same convention as the rest of the system
        const [y, mo, d] = selectedDate.split('-').map(Number);
        const istMidnightUTC = Date.UTC(y, mo - 1, d) - 5.5 * 60 * 60 * 1000;
        const slotUTC = istMidnightUTC + (h * 60 + m) * 60000;
        return new Date(slotUTC).toISOString();
    };

    // Display the slot label as-is (already formatted like "9:00AM")
    const formatHeader = (dateStr: string) => {
        const [y, m, d] = dateStr.split('-').map(Number);
        return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    };

    return (
        <div className="time-slot-list">
            <h3 className="slot-header">
                {formatHeader(selectedDate)}
            </h3>

            <div className="slots-scroll-container">
                {loading && <Loader />}

                {!loading && slots.length === 0 && (
                    <div className="no-slots">No slots available for this date.</div>
                )}

                {!loading && slots.map((slot) => (
                    <button
                        key={slot}
                        className={`time-slot-btn ${selectedSlot === slotToISO(slot) ? 'selected' : ''}`}
                        onClick={() => onSlotSelect(slotToISO(slot))}
                    >
                        <span className="status-dot available"></span>
                        {slot}
                    </button>
                ))}
            </div>
        </div>
    );
};

export default TimeSlotList;
