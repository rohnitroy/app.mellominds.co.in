import React, { useState, useEffect } from 'react';
import styles from './CreateBooking.module.css';
import SendBookingLinkModal from './SendBookingLinkModal';
import DateInput from './DateInput';
import CustomDropdown from './CustomDropdown';
import { useToast } from '../context/ToastContext';
import API_BASE_URL from '../config/api';

interface CreateBookingProps {
    onBack?: () => void;
    prefillClient?: { name: string; email: string; phone: string };
}

interface Calendar {
    id: string;
    title: string;
    duration: string;
    payment_enabled?: boolean;
    prices?: { amount: number; currency: string; label?: string }[];
}

const defaultForm = {
    clientName: '',
    clientWhatsApp: '',
    clientEmail: '',
    selectedDate: '',
    selectedCalendar: '',
    sessionType: { online: false, inPerson: false }
};

const CreateBooking: React.FC<CreateBookingProps> = ({ onBack, prefillClient }) => {
    const toast = useToast();
    const [formData, setFormData] = useState({
        ...defaultForm,
        clientName: prefillClient?.name || '',
        clientWhatsApp: prefillClient?.phone || '',
        clientEmail: prefillClient?.email || '',
    });
    const [calendars, setCalendars] = useState<Calendar[]>([]);
    const [selectedTimeSlot, setSelectedTimeSlot] = useState<string>('');
    const [availableSlots, setAvailableSlots] = useState<string[]>([]);
    const [loadingSlots, setLoadingSlots] = useState(false);
    const [showSendLinkModal, setShowSendLinkModal] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    // Fetch calendars on mount
    useEffect(() => {
        const fetchCalendars = async () => {
            try {
                const response = await fetch(`${API_BASE_URL}/api/calendars`, { credentials: 'include' });
                if (response.ok) {
                    const data = await response.json();
                    setCalendars(data.filter((c: Calendar & { is_active: boolean }) => c.is_active));
                }
            } catch (error) {
                console.error('Failed to fetch calendars:', error);
            }
        };
        fetchCalendars();
    }, []);

    // Fetch available slots when date + calendar are selected
    useEffect(() => {
        if (!formData.selectedDate || !formData.selectedCalendar) {
            setAvailableSlots([]);
            setSelectedTimeSlot('');
            return;
        }

        const fetchSlots = async () => {
            setLoadingSlots(true);
            setSelectedTimeSlot('');
            try {
                const res = await fetch(
                    `${API_BASE_URL}/api/availability/slots?calendar_id=${formData.selectedCalendar}&date=${formData.selectedDate}`,
                    { credentials: 'include' }
                );
                if (res.ok) {
                    const data = await res.json();
                    setAvailableSlots(data.slots || []);
                } else {
                    // Fallback: generate slots from availability schedule
                    setAvailableSlots(generateFallbackSlots());
                }
            } catch {
                setAvailableSlots(generateFallbackSlots());
            } finally {
                setLoadingSlots(false);
            }
        };

        fetchSlots();
    }, [formData.selectedDate, formData.selectedCalendar]);

    // Generate generic slots as fallback (9AM-6PM hourly)
    const generateFallbackSlots = () => {
        const slots = [];
        for (let h = 9; h <= 17; h++) {
            const period = h < 12 ? 'AM' : 'PM';
            const displayH = h > 12 ? h - 12 : h;
            slots.push(`${displayH}:00${period}`);
        }
        return slots;
    };

    // Get selected calendar object
    const selectedCalendarObj = calendars.find(c => c.id.toString() === formData.selectedCalendar);

    // Derive price from selected calendar
    const getPrice = () => {
        if (!selectedCalendarObj?.payment_enabled) return null;
        const first = selectedCalendarObj?.prices?.[0];
        if (!first) return null;
        return { amount: first.amount, currency: first.currency || 'INR' };
    };

    const price = getPrice();

    const handleInputChange = (field: string, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleSessionTypeChange = (type: 'online' | 'inPerson') => {
        setFormData(prev => ({
            ...prev,
            sessionType: { online: type === 'online', inPerson: type === 'inPerson' }
        }));
    };

    const parseTimeSlot = (slot: string): { hours: number; minutes: number } | null => {
        const match = slot.match(/(\d+):(\d+)(AM|PM)/i);
        if (!match) return null;
        let hours = parseInt(match[1]);
        const minutes = parseInt(match[2]);
        const period = match[3].toUpperCase();
        if (period === 'PM' && hours !== 12) hours += 12;
        if (period === 'AM' && hours === 12) hours = 0;
        return { hours, minutes };
    };

    const handleCreateBooking = async () => {
        if (!formData.selectedCalendar || !formData.selectedDate || !selectedTimeSlot || !formData.clientName) {
            toast.warning('Please fill in all required fields');
            return;
        }

        const parsed = parseTimeSlot(selectedTimeSlot);
        if (!parsed) { toast.error('Invalid time slot'); return; }

        const startTime = new Date(formData.selectedDate);
        startTime.setHours(parsed.hours, parsed.minutes, 0, 0);

        setSubmitting(true);
        try {
            const payload: any = {
                calendar_id: formData.selectedCalendar,
                start_time: startTime.toISOString(),
                client_name: formData.clientName,
                client_email: formData.clientEmail || undefined,
                client_phone: formData.clientWhatsApp || undefined,
            };

            // Only send payment_amount if calendar has payment configured
            if (price) payload.payment_amount = price.amount;

            const response = await fetch(`${API_BASE_URL}/api/bookings`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                toast.success('Booking created successfully!');
                setFormData({ ...defaultForm });
                setSelectedTimeSlot('');
                if (onBack) onBack();
            } else {
                const error = await response.json();
                toast.error(error.error || 'Failed to create booking');
            }
        } catch (error) {
            console.error('Error creating booking:', error);
            toast.error('Failed to connect to server');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className={styles.createBookingContent}>
            <div className={styles.pageHeader}>
                <button className={styles.backButton} onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="15 18 9 12 15 6"/>
                    </svg>
                </button>
                <h1>Create a Booking</h1>
            </div>

            <div className={styles.formContainer}>
                <div className={styles.formRow}>
                    <div className={styles.formGroup}>
                        <label className={styles.label}>Client Name<span className={styles.required}>*</span></label>
                        <input type="text" placeholder="Enter client name" value={formData.clientName}
                            onChange={(e) => handleInputChange('clientName', e.target.value)} className={styles.input} />
                    </div>

                    <div className={styles.formGroup}>
                        <label className={styles.label}>Client WhatsApp No.</label>
                        <div className={styles.phoneInputContainer}>
                            <div className={styles.countryCode}>+91</div>
                            <input type="tel" placeholder="Enter whatsapp number" value={formData.clientWhatsApp}
                                onChange={(e) => handleInputChange('clientWhatsApp', e.target.value)} className={styles.phoneInput} />
                        </div>
                    </div>
                </div>

                <div className={styles.formRow}>
                    <div className={styles.formGroup}>
                        <label className={styles.label}>Client Email Address</label>
                        <input type="email" placeholder="Enter client email address" value={formData.clientEmail}
                            onChange={(e) => handleInputChange('clientEmail', e.target.value)} className={styles.input} />
                    </div>

                    <div className={styles.formGroup}>
                        <label className={styles.label}>Select Date<span className={styles.required}>*</span></label>
                        <div className={styles.dateInputContainer}>
                            <DateInput value={formData.selectedDate} onChange={(val) => handleInputChange('selectedDate', val)}
                                className={styles.dateInput} min={new Date().toISOString().split('T')[0]} />
                        </div>
                    </div>

                    <div className={styles.formGroup}>
                        <label className={styles.label}>Select Calendar<span className={styles.required}>*</span></label>
                        <CustomDropdown
                            options={[
                                { value: '', label: 'Select Calendar' },
                                ...calendars.map(cal => ({ value: cal.id.toString(), label: `${cal.title} (${cal.duration})` }))
                            ]}
                            value={formData.selectedCalendar}
                            onChange={(value) => handleInputChange('selectedCalendar', value)}
                            placeholder="Select Calendar"
                        />
                    </div>
                </div>

                <div className={styles.availableSlotsSection}>
                    <div className={styles.slotsHeader}>
                        <h3>Available Slots</h3>
                        <div className={styles.sessionTypeOptions}>
                            <label className={styles.checkboxLabel}>
                                <input type="checkbox" checked={formData.sessionType.online}
                                    onChange={() => handleSessionTypeChange('online')} className={styles.checkbox} />
                                Online
                            </label>
                            <label className={styles.checkboxLabel}>
                                <input type="checkbox" checked={formData.sessionType.inPerson}
                                    onChange={() => handleSessionTypeChange('inPerson')} className={styles.checkbox} />
                                In-person
                            </label>
                        </div>
                    </div>

                    <div className={styles.timeSlots}>
                        {!formData.selectedDate || !formData.selectedCalendar ? (
                            <p style={{ color: '#9CA3AF', fontSize: '13px', fontFamily: 'Urbanist' }}>Select a date and calendar to see available slots</p>
                        ) : loadingSlots ? (
                            <p style={{ color: '#9CA3AF', fontSize: '13px', fontFamily: 'Urbanist' }}>Loading slots...</p>
                        ) : availableSlots.length === 0 ? (
                            <p style={{ color: '#9CA3AF', fontSize: '13px', fontFamily: 'Urbanist' }}>No slots available for this date</p>
                        ) : (
                            availableSlots.map((slot) => (
                                <button key={slot}
                                    className={`${styles.timeSlot} ${selectedTimeSlot === slot ? styles.selectedSlot : ''}`}
                                    onClick={() => setSelectedTimeSlot(slot)}>
                                    {slot}
                                </button>
                            ))
                        )}
                    </div>
                </div>

                <div className={styles.footer}>
                    <div className={styles.grandTotal}>
                        <span className={styles.totalLabel}>Grand Total:</span>
                        <span className={styles.totalAmount}>
                            {price ? `${price.currency} ${price.amount}` : 'Free / Pay Later'}
                        </span>
                    </div>

                    <div className={styles.actionButtons}>
                        <button className={styles.payLaterBtn} onClick={handleCreateBooking} disabled={submitting}>
                            {submitting ? 'Creating...' : 'Pay Later/Cash'}
                        </button>
                        <button className={styles.sendPaymentBtn} onClick={() => setShowSendLinkModal(true)}>
                            Send Payment Link
                        </button>
                    </div>
                </div>
            </div>

            <SendBookingLinkModal isOpen={showSendLinkModal} onClose={() => setShowSendLinkModal(false)} />
        </div>
    );
};

export default CreateBooking;
