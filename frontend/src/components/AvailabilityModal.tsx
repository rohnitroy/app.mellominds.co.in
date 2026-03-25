import React, { useState, useEffect, useRef } from 'react';
import { useToast } from '../context/ToastContext';
import API_BASE_URL from '../config/api';

interface AvailabilitySlot {
    day_of_week: number;
    start_time: string;
    end_time: string;
    is_enabled: boolean;
}

interface AvailabilityModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Helper to generate time options (30 min intervals)
const generateTimeOptions = () => {
    const options = [];
    for (let i = 0; i < 24 * 2; i++) {
        const h = Math.floor(i / 2);
        const m = (i % 2) * 30;
        const hh = h.toString().padStart(2, '0');
        const mm = m.toString().padStart(2, '0');

        // Format for display (12h)
        const date = new Date();
        date.setHours(h, m);
        const display = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });

        options.push({ value: `${hh}:${mm}`, label: display });
    }
    return options;
};

const timeOptions = generateTimeOptions();

const CustomTimeSelect: React.FC<{ value: string, onChange: (val: string) => void }> = ({ value, onChange }) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    // Find label for current value
    const normalizedValue = value.slice(0, 5);
    const currentLabel = timeOptions.find(opt => opt.value === normalizedValue)?.label || normalizedValue;

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const scrollToSelected = () => {
        // Simple scroll logic could be added here if needed
    };

    return (
        <div ref={containerRef} style={{ position: 'relative', width: '130px' }}>
            <div
                onClick={() => { setIsOpen(!isOpen); scrollToSelected(); }}
                style={{
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid #e5e5e5',
                    backgroundColor: 'white',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: 500,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontFamily: 'inherit',
                    color: '#333'
                }}
            >
                <span>{currentLabel}</span>
                <span style={{ fontSize: '10px', color: '#666', marginLeft: '6px' }}>▼</span>
            </div>

            {isOpen && (
                <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    width: '100%',
                    maxHeight: '200px',
                    overflowY: 'auto',
                    backgroundColor: 'white',
                    border: '1px solid #e5e5e5',
                    borderRadius: '8px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                    zIndex: 1000,
                    marginTop: '4px'
                }}>
                    {timeOptions.map((option) => (
                        <div
                            key={option.value}
                            onClick={() => { onChange(option.value); setIsOpen(false); }}
                            style={{
                                padding: '8px 12px',
                                cursor: 'pointer',
                                fontSize: '14px',
                                backgroundColor: option.value === normalizedValue ? '#f5f5f5' : 'white',
                                color: option.value === normalizedValue ? '#082421' : '#333',
                                fontWeight: option.value === normalizedValue ? 600 : 400,
                                fontFamily: 'inherit',
                                borderBottom: '1px solid #f9f9f9'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f9f9f9'}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = option.value === normalizedValue ? '#f5f5f5' : 'white'}
                        >
                            {option.label}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

const AvailabilityModal: React.FC<AvailabilityModalProps> = ({ isOpen, onClose }) => {
    const toast = useToast();
    const [schedule, setSchedule] = useState<AvailabilitySlot[]>([]);
    const [loading, setLoading] = useState(true);

    // Default schedule generator (one slot per weekday)
    const getDefaultSchedule = (): AvailabilitySlot[] => {
        return days.flatMap((_, index) => {
            if (index === 0 || index === 6) return []; // Skip weekends
            return [{
                day_of_week: index,
                start_time: '09:00',
                end_time: '17:00',
                is_enabled: true
            }];
        });
    };

    useEffect(() => {
        if (isOpen) {
            setLoading(true);
            fetchAvailability();
        }
    }, [isOpen]);

    const fetchAvailability = async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/api/availability`, {
                credentials: 'include'
            });

            if (response.status === 401) {
                toast.error('Your session has expired. Please log in again.');
                window.location.href = '/login';
                return;
            }

            if (response.ok) {
                const data = await response.json();
                if (data.length > 0) {
                    // Normalize time strings to HH:MM
                    const normalized = data.map((s: any) => ({
                        ...s,
                        start_time: s.start_time.slice(0, 5),
                        end_time: s.end_time.slice(0, 5)
                    }));
                    setSchedule(normalized);
                } else {
                    setSchedule(getDefaultSchedule());
                }
            } else {
                console.warn('Failed to fetch availability, using defaults.');
                setSchedule(getDefaultSchedule());
            }
        } catch (error) {
            console.error('Error fetching availability:', error);
            setSchedule(getDefaultSchedule());
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/api/availability`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ schedule })
            });

            if (response.status === 401) {
                toast.error('Your session has expired. Please log in again.');
                window.location.href = '/login';
                return;
            }

            if (response.ok) {
                toast.success('Availability updated successfully!');
                onClose();
            } else {
                toast.error('Failed to update availability.');
            }
        } catch (error) {
            console.error('Error saving availability:', error);
            toast.error('Error saving availability.');
        }
    };

    // Helper to find slots for a day with their original index
    const getDaySlots = (dayIndex: number) => {
        return schedule
            .map((slot, index) => ({ ...slot, originalIndex: index }))
            .filter(slot => slot.day_of_week === dayIndex);
    };

    const isDayActive = (dayIndex: number) => {
        const slots = getDaySlots(dayIndex);
        return slots.length > 0 && slots.some(s => s.is_enabled);
    };

    const toggleDay = (dayIndex: number, currentState: boolean) => {
        const newSchedule = [...schedule];
        const daySlots = newSchedule
            .map((slot, index) => ({ ...slot, index }))
            .filter(slot => slot.day_of_week === dayIndex);

        if (currentState) {
            daySlots.forEach(s => {
                newSchedule[s.index].is_enabled = false;
            });
        } else {
            if (daySlots.length === 0) {
                newSchedule.push({
                    day_of_week: dayIndex,
                    start_time: '09:00',
                    end_time: '17:00',
                    is_enabled: true
                });
            } else {
                daySlots.forEach(s => {
                    newSchedule[s.index].is_enabled = true;
                });
            }
        }
        setSchedule(newSchedule);
    };

    const addShift = (dayIndex: number) => {
        setSchedule([
            ...schedule,
            {
                day_of_week: dayIndex,
                start_time: '09:00',
                end_time: '17:00',
                is_enabled: true
            }
        ]);
    };

    const removeShift = (originalIndex: number) => {
        const newSchedule = schedule.filter((_, i) => i !== originalIndex);
        setSchedule(newSchedule);
    };

    const updateSlot = (originalIndex: number, field: keyof AvailabilitySlot, value: any) => {
        const newSchedule = [...schedule];
        newSchedule[originalIndex] = { ...newSchedule[originalIndex], [field]: value };
        setSchedule(newSchedule);
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay" style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000
        }}>
            <div className="modal-content" style={{
                backgroundColor: 'white', padding: '24px', borderRadius: '12px', width: '700px', maxWidth: '95%', maxHeight: '90vh', overflowY: 'auto'
            }}>
                <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                    <h2>Manage Availability</h2>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer' }}>&times;</button>
                </div>

                {loading ? (
                    <div>Loading...</div>
                ) : (
                    <div className="schedule-list">
                        <div style={{ display: 'grid', gridTemplateColumns: '100px 60px 1fr', gap: '10px', padding: '0 10px 10px', borderBottom: '1px solid #eee', marginBottom: '10px', fontWeight: 'bold', color: '#555' }}>
                            <div>Day</div>
                            <div>Active</div>
                            <div>Working Hours</div>
                        </div>

                        {days.map((dayName, dayIndex) => {
                            const isActive = isDayActive(dayIndex);
                            const daySlots = getDaySlots(dayIndex).filter(s => s.is_enabled);

                            return (
                                <div key={dayIndex} style={{
                                    display: 'grid',
                                    gridTemplateColumns: '100px 60px 1fr',
                                    gap: '10px',
                                    alignItems: 'start',
                                    marginBottom: '12px',
                                    padding: '10px',
                                    borderBottom: '1px solid #f0f0f0'
                                }}>
                                    <div style={{ fontWeight: 600, paddingTop: '10px' }}>{dayName}</div>

                                    {/* Day Toggle Switch */}
                                    <div style={{ paddingTop: '8px' }}>
                                        <label style={{ position: 'relative', display: 'inline-block', width: '40px', height: '22px' }}>
                                            <input
                                                type="checkbox"
                                                checked={isActive}
                                                onChange={() => toggleDay(dayIndex, isActive)}
                                                style={{ opacity: 0, width: 0, height: 0 }}
                                            />
                                            <span style={{
                                                position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0,
                                                backgroundColor: isActive ? '#082421' : '#ccc',
                                                transition: '.4s', borderRadius: '22px'
                                            }}>
                                                <span style={{
                                                    position: 'absolute', content: '""', height: '16px', width: '16px',
                                                    left: isActive ? '20px' : '4px', bottom: '3px',
                                                    backgroundColor: 'white', transition: '.4s', borderRadius: '50%'
                                                }}></span>
                                            </span>
                                        </label>
                                    </div>

                                    {/* Slots Column */}
                                    <div>
                                        {isActive ? (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                {daySlots.map((slot) => (
                                                    <div key={slot.originalIndex} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                        <CustomTimeSelect
                                                            value={slot.start_time}
                                                            onChange={(val) => updateSlot(slot.originalIndex, 'start_time', val)}
                                                        />
                                                        <span style={{ color: '#666' }}>—</span>
                                                        <CustomTimeSelect
                                                            value={slot.end_time}
                                                            onChange={(val) => updateSlot(slot.originalIndex, 'end_time', val)}
                                                        />

                                                        <button
                                                            onClick={() => removeShift(slot.originalIndex)}
                                                            title="Remove Shift"
                                                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc3545', fontSize: '18px', display: 'flex', alignItems: 'center', padding: '0 8px' }}
                                                        >
                                                            &times;
                                                        </button>
                                                    </div>
                                                ))}
                                                <button
                                                    onClick={() => addShift(dayIndex)}
                                                    style={{
                                                        background: 'none', border: 'none', color: '#082421',
                                                        cursor: 'pointer', fontSize: '13px', fontWeight: 600,
                                                        display: 'flex', alignItems: 'center', gap: '4px', alignSelf: 'flex-start',
                                                        marginTop: '4px'
                                                    }}
                                                >
                                                    + Add Shift
                                                </button>
                                            </div>
                                        ) : (
                                            <div style={{ paddingTop: '10px', color: '#999', fontSize: '14px', fontStyle: 'italic' }}>
                                                Unavailable
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                <div className="modal-footer" style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                    <button onClick={onClose} style={{ padding: '10px 20px', border: '1px solid #ddd', borderRadius: '6px', background: 'white', cursor: 'pointer' }}>Cancel</button>
                    <button onClick={handleSave} style={{ padding: '10px 20px', border: 'none', borderRadius: '6px', background: '#082421', color: 'white', cursor: 'pointer' }}>Save Availability</button>
                </div>
            </div>
        </div>
    );
};

export default AvailabilityModal;
