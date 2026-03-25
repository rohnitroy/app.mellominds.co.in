import React, { useState, useEffect, useCallback } from 'react';
import API_BASE_URL from '../config/api';

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
                setSlots(data);
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

    const formatTime = (isoString: string) => {
        return new Date(isoString).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
    };

    return (
        <div className="time-slot-list">
            <h3 className="slot-header">
                {new Date(selectedDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                <span className="time-format-toggle">
                    <button className="active">12h</button>
                    <button>24h</button>
                </span>
            </h3>

            <div className="slots-scroll-container">
                {loading && <div className="loading-slots">Loading availability...</div>}

                {!loading && slots.length === 0 && (
                    <div className="no-slots">No slots available for this date.</div>
                )}

                {!loading && slots.map((slot) => (
                    <button
                        key={slot}
                        className={`time-slot-btn ${selectedSlot === slot ? 'selected' : ''}`}
                        onClick={() => onSlotSelect(slot)}
                    >
                        <span className="status-dot available"></span>
                        {formatTime(slot)}
                    </button>
                ))}
            </div>
        </div>
    );
};

export default TimeSlotList;
