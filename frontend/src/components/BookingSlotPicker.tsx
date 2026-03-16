import React, { useState, useEffect } from 'react';
import DateInput from './DateInput';

interface BookingSlotPickerProps {
    calendarId: number;
    initialDate?: string;
    onSlotSelect: (isoString: string) => void;
}

const BookingSlotPicker: React.FC<BookingSlotPickerProps> = ({ calendarId, initialDate, onSlotSelect }) => {
    // Default to today's date in YYYY-MM-DD
    const today = new Date().toISOString().split('T')[0];
    const [selectedDate, setSelectedDate] = useState(initialDate || today);
    const [slots, setSlots] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [activeSlot, setActiveSlot] = useState<string | null>(null);

    useEffect(() => {
        if (calendarId && selectedDate) {
            fetchSlots();
        }
    }, [calendarId, selectedDate]);

    const fetchSlots = async () => {
        setLoading(true);
        setError(null);
        setSlots([]);
        setActiveSlot(null);

        try {
            // Get user's time zone
            const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

            const response = await fetch(`http://localhost:3001/api/availability/slots?date=${selectedDate}&calendarId=${calendarId}&timeZone=${timeZone}`, {
                credentials: 'include'
            });

            if (response.ok) {
                const data = await response.json();
                setSlots(data); // Array of ISO strings
            } else {
                const err = await response.json();
                setError(err.error || 'Failed to load slots');
            }
        } catch (err) {
            console.error('Error fetching slots:', err);
            setError('Error loading availability');
        } finally {
            setLoading(false);
        }
    };

    const handleSlotClick = (isoString: string) => {
        setActiveSlot(isoString);
        onSlotSelect(isoString);
    };

    // Format time for display (e.g., 9:00 AM)
    const formatTime = (isoString: string) => {
        return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
    };

    return (
        <div className="slot-picker">
            <div style={{ marginBottom: '15px' }}>
                <label className="form-label" style={{ display: 'block', marginBottom: '5px', fontWeight: 500 }}>Select Date</label>
                <DateInput
                    value={selectedDate}
                    min={today}
                    onChange={(val) => val && setSelectedDate(val)}
                    style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd', boxSizing: 'border-box' }}
                />
            </div>

            <div style={{ marginBottom: '10px' }}>
                <label className="form-label" style={{ display: 'block', marginBottom: '5px', fontWeight: 500 }}>Available Times</label>

                {loading && <div style={{ fontSize: '14px', color: '#666' }}>Checking availability...</div>}

                {error && <div style={{ fontSize: '14px', color: '#dc3545' }}>{error}</div>}

                {!loading && !error && slots.length === 0 && (
                    <div style={{ fontSize: '14px', color: '#666', fontStyle: 'italic' }}>
                        No available slots for this date.
                    </div>
                )}

                {!loading && slots.length > 0 && (
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))',
                        gap: '10px',
                        maxHeight: '200px',
                        overflowY: 'auto',
                        padding: '2px'
                    }}>
                        {slots.map((slot) => (
                            <button
                                key={slot}
                                type="button"
                                onClick={() => handleSlotClick(slot)}
                                style={{
                                    padding: '8px 4px',
                                    borderRadius: '6px',
                                    border: activeSlot === slot ? '2px solid #082421' : '1px solid #ddd',
                                    backgroundColor: activeSlot === slot ? '#e6f0ee' : 'white',
                                    color: activeSlot === slot ? '#082421' : '#333',
                                    cursor: 'pointer',
                                    fontSize: '13px',
                                    fontWeight: activeSlot === slot ? 600 : 400,
                                    width: '100%'
                                }}
                            >
                                {formatTime(slot)}
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default BookingSlotPicker;
