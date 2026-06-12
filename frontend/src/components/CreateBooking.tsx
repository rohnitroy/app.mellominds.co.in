import React, { useState, useEffect, useRef } from 'react';
import styles from './CreateBooking.module.css';
import SendBookingLinkModal from './SendBookingLinkModal';
import CustomDropdown from './CustomDropdown';
import { useToast } from '../context/ToastContext';
import API_BASE_URL from '../config/api';

interface CreateBookingProps {
    onBack?: () => void;
    prefillClient?: { name: string; email: string; phone: string };
    prefillCalendarId?: string;
}

interface Client {
    id: string;
    name: string;
    email: string;
    phone: string;
}

interface Calendar {
    id: string;
    title: string;
    duration: string;
    type: string;
    description: string;
    payment_enabled?: boolean;
    payment_gateway?: string | null;
    prices?: { amount: number; currency: string; label?: string }[];
    locations?: { type: string; address?: string }[];
}

const defaultForm = {
    clientName: '',
    clientWhatsApp: '',
    clientEmail: '',
    selectedDate: '',
    selectedCalendar: '',
    sessionType: { online: false, inPerson: false }
};

const CreateBooking: React.FC<CreateBookingProps> = ({ onBack, prefillClient, prefillCalendarId }) => {
    const toast = useToast();
    const [formData, setFormData] = useState({
        ...defaultForm,
        clientName: prefillClient?.name || '',
        clientWhatsApp: prefillClient?.phone || '',
        clientEmail: prefillClient?.email || '',
        selectedCalendar: prefillCalendarId || '',
    });
    const [calendars, setCalendars] = useState<Calendar[]>([]);
    const [selectedTimeSlot, setSelectedTimeSlot] = useState<string>('');
    const [availableSlots, setAvailableSlots] = useState<string[]>([]);
    const [loadingSlots, setLoadingSlots] = useState(false);
    const [showSendLinkModal, setShowSendLinkModal] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [showPaymentConfirm, setShowPaymentConfirm] = useState(false);

    // Client autocomplete
    const [clients, setClients] = useState<Client[]>([]);
    const [suggestions, setSuggestions] = useState<Client[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const nameInputRef = useRef<HTMLInputElement>(null);
    const suggestionsRef = useRef<HTMLDivElement>(null);

    // Fetch all clients on mount
    useEffect(() => {
        fetch(`${API_BASE_URL}/api/bookings/clients`, { credentials: 'include' })
            .then(r => r.ok ? r.json() : [])
            .then(data => setClients(data))
            .catch(() => {});
    }, []);

    // Close suggestions on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node)
                && nameInputRef.current && !nameInputRef.current.contains(e.target as Node)) {
                setShowSuggestions(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

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
                const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
                const res = await fetch(
                    `${API_BASE_URL}/api/availability/slots?calendar_id=${formData.selectedCalendar}&date=${formData.selectedDate}&timeZone=${timeZone}`,
                    { credentials: 'include' }
                );
                const data = await res.json();
                if (res.ok) {
                    setAvailableSlots(data.slots || data || []);
                } else {
                    console.error('Slots API error:', data);
                    setAvailableSlots([]);
                }
            } catch (err) {
                console.error('Slots fetch failed:', err);
                setAvailableSlots([]);
            } finally {
                setLoadingSlots(false);
            }
        };

        fetchSlots();

        // Re-fetch slots when user comes back to the tab (e.g., after cancelling a booking elsewhere)
        const handleVisibilityChange = () => {
            if (!document.hidden) fetchSlots();
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, [formData.selectedDate, formData.selectedCalendar]);

    // Reset session type when calendar changes, auto-select if only one mode available
    useEffect(() => {
        if (!formData.selectedCalendar) return;
        const cal = calendars.find(c => c.id.toString() === formData.selectedCalendar);
        if (!cal) return;
        const locs = cal.locations || [];
        const hasOnline = locs.length === 0 || locs.some((l: { type: string }) => l.type === 'google_meet' || l.type === 'zoom' || l.type === 'online');
        const hasInPerson = locs.some((l: { type: string }) => l.type === 'in_person');
        if (hasOnline && !hasInPerson) {
            setFormData(prev => ({ ...prev, sessionType: { online: true, inPerson: false } }));
        } else if (!hasOnline && hasInPerson) {
            setFormData(prev => ({ ...prev, sessionType: { online: false, inPerson: true } }));
        } else {
            setFormData(prev => ({ ...prev, sessionType: { online: false, inPerson: false } }));
        }
    }, [formData.selectedCalendar, calendars]);

    // Get selected calendar object
    const selectedCalendarObj = calendars.find(c => c.id.toString() === formData.selectedCalendar);

    // Derive available session modes from calendar locations
    const availableModes = {
        online: selectedCalendarObj?.locations?.some((l: { type: string }) => l.type === 'google_meet' || l.type === 'zoom' || l.type === 'online') ?? true,
        inPerson: selectedCalendarObj?.locations?.some((l: { type: string }) => l.type === 'in_person') ?? false,
    };
    const hasLocations = (selectedCalendarObj?.locations?.length ?? 0) > 0;
    const modesOnline = hasLocations ? availableModes.online : true;
    const modesInPerson = hasLocations ? availableModes.inPerson : false;

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

    const handleNameChange = (value: string) => {
        setFormData(prev => ({ ...prev, clientName: value }));
        if (value.trim().length >= 1) {
            const filtered = clients.filter(c =>
                c.name.toLowerCase().includes(value.toLowerCase())
            ).slice(0, 6);
            setSuggestions(filtered);
            setShowSuggestions(filtered.length > 0);
        } else {
            setSuggestions([]);
            setShowSuggestions(false);
        }
    };

    const handleSelectClient = (client: Client) => {
        setFormData(prev => ({
            ...prev,
            clientName: client.name,
            clientEmail: client.email || '',
            clientWhatsApp: client.phone || '',
        }));
        setSuggestions([]);
        setShowSuggestions(false);
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

    const handleCreateBooking = async (paymentStatus: 'Paid' | 'Pending') => {
        if (!formData.selectedCalendar || !formData.selectedDate || !selectedTimeSlot || !formData.clientName || !formData.clientEmail) {
            toast.warning('Please fill in client name, email, date, time and calendar');
            return;
        }
        if (!formData.sessionType.online && !formData.sessionType.inPerson) {
            toast.warning('Please select a session mode (Online or In-person)');
            return;
        }

        const parsed = parseTimeSlot(selectedTimeSlot);
        if (!parsed) { toast.error('Invalid time slot'); return; }

        // Build from local Y-M-D parts so the date can't roll to the previous/next
        // day on UTC parsing of the "YYYY-MM-DD" string
        const [yr, mo, dy] = formData.selectedDate.split('-').map(Number);
        const startTime = new Date(yr, mo - 1, dy, parsed.hours, parsed.minutes, 0, 0);

        setShowPaymentConfirm(false);
        setSubmitting(true);
        try {
            const payload: any = {
                calendar_id: formData.selectedCalendar,
                start_time: startTime.toISOString(),
                client_name: formData.clientName,
                client_email: formData.clientEmail || undefined,
                client_phone: formData.clientWhatsApp || undefined,
                payment_status: paymentStatus,
                location_type: formData.sessionType.inPerson ? 'in_person' : 'google_meet',
            };

            if (price) payload.payment_amount = price.amount;

            const response = await fetch(`${API_BASE_URL}/api/bookings`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                toast.success(paymentStatus === 'Paid' ? 'Booking created & payment recorded!' : 'Booking created successfully!');
                setFormData({ ...defaultForm, selectedCalendar: prefillCalendarId || '' });
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

    const handleBookClick = () => {
        if (!formData.selectedCalendar || !formData.selectedDate || !selectedTimeSlot || !formData.clientName || !formData.clientEmail) {
            toast.warning('Please fill in client name, email, date, time and calendar');
            return;
        }
        if (!formData.sessionType.online && !formData.sessionType.inPerson) {
            toast.warning('Please select a session mode (Online or In-person)');
            return;
        }
        setShowPaymentConfirm(true);
    };

    // PG is connected only if payment is enabled AND a gateway is set (not just offline)
    const hasPGConnected = !!(selectedCalendarObj?.payment_enabled && selectedCalendarObj?.payment_gateway && selectedCalendarObj.payment_gateway !== 'offline');

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
                        <div style={{ position: 'relative' }}>
                            <input
                                ref={nameInputRef}
                                type="text"
                                placeholder="Enter client name"
                                value={formData.clientName}
                                onChange={(e) => handleNameChange(e.target.value)}
                                onFocus={() => {
                                    if (suggestions.length > 0) setShowSuggestions(true);
                                }}
                                className={styles.input}
                                autoComplete="off"
                            />
                            {showSuggestions && (
                                <div ref={suggestionsRef} style={{
                                    position: 'absolute', top: '100%', left: 0, right: 0,
                                    background: '#fff', border: '1px solid #e0e0e0',
                                    borderRadius: '10px', boxShadow: '0 4px 16px rgba(0,0,0,0.10)',
                                    zIndex: 100, overflow: 'hidden', marginTop: '4px'
                                }}>
                                    {suggestions.map(client => (
                                        <div
                                            key={client.id}
                                            onMouseDown={() => handleSelectClient(client)}
                                            style={{
                                                padding: '10px 16px', cursor: 'pointer',
                                                fontFamily: 'Urbanist', fontSize: '14px',
                                                borderBottom: '1px solid #f5f5f5',
                                                display: 'flex', flexDirection: 'column', gap: '2px'
                                            }}
                                            onMouseEnter={e => (e.currentTarget.style.background = '#f0fdf4')}
                                            onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
                                        >
                                            <span style={{ fontWeight: 600, color: '#082421' }}>{client.name}</span>
                                            <span style={{ fontSize: '12px', color: '#6B7280' }}>
                                                {client.email}{client.phone ? ` · ${client.phone}` : ''}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
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
                        <label className={styles.label}>Client Email Address<span className={styles.required}>*</span></label>
                        <input type="email" placeholder="Enter client email address" value={formData.clientEmail}
                            onChange={(e) => handleInputChange('clientEmail', e.target.value)} className={styles.input} />
                    </div>

                    <div className={styles.formGroup}>
                        <label className={styles.label}>Select Date<span className={styles.required}>*</span></label>
                        <div className={styles.dateInputContainer}>
                            <input
                                type="date"
                                value={formData.selectedDate}
                                onChange={(e) => handleInputChange('selectedDate', e.target.value)}
                                className={styles.dateInput}
                                min={new Date().toISOString().split('T')[0]}
                            />
                            <img src="/Calendar.svg" alt="" className={styles.calendarIcon} />
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
                            className={styles.calendarDropdown}
                        />
                    </div>
                </div>

                <div className={styles.availableSlotsSection}>
                    <div className={styles.slotsHeader}>
                        <h3>Available Slots</h3>
                        <div className={styles.sessionTypeOptions}>
                            <span style={{ fontSize: '13px', fontFamily: 'Urbanist', fontWeight: 600, color: '#333', marginRight: '4px' }}>
                                Session Mode<span style={{ color: '#ff0000' }}>*</span>:
                            </span>
                            {modesOnline && (
                                <label className={styles.checkboxLabel}>
                                    <input type="checkbox" checked={formData.sessionType.online}
                                        onChange={() => handleSessionTypeChange('online')} className={styles.checkbox} />
                                    Online
                                </label>
                            )}
                            {modesInPerson && (
                                <label className={styles.checkboxLabel}>
                                    <input type="checkbox" checked={formData.sessionType.inPerson}
                                        onChange={() => handleSessionTypeChange('inPerson')} className={styles.checkbox} />
                                    In-person
                                </label>
                            )}
                            {!formData.selectedCalendar && (
                                <span style={{ fontSize: '12px', color: '#9CA3AF', fontFamily: 'Urbanist' }}>Select a calendar first</span>
                            )}
                        </div>
                    </div>

                    <div className={styles.timeSlots}>
                        {!formData.selectedDate || !formData.selectedCalendar ? (
                            <p style={{ color: '#9CA3AF', fontSize: '13px', fontFamily: 'Urbanist' }}>Select a date and calendar to see available slots</p>
                        ) : loadingSlots ? (
                            <p style={{ color: '#9CA3AF', fontSize: '13px', fontFamily: 'Urbanist' }}>Loading slots...</p>
                        ) : availableSlots.length === 0 ? (
                            <p style={{ color: '#9CA3AF', fontSize: '13px', fontFamily: 'Urbanist' }}>
                                No slots available for this date.
                            </p>
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
                    {selectedTimeSlot && (formData.sessionType.online || formData.sessionType.inPerson) && formData.selectedDate && (
                        <div className={styles.grandTotal}>
                            <span className={styles.totalLabel}>Grand Total:</span>
                            <span className={styles.totalAmount}>
                                {price ? `${price.currency} ${price.amount}` : 'Free / Pay Later'}
                            </span>
                        </div>
                    )}

                    <div className={styles.actionButtons}>
                        {hasPGConnected ? (
                            <>
                                <button className={styles.payLaterBtn} onClick={handleBookClick} disabled={submitting}>
                                    {submitting ? 'Creating...' : 'Pay Later / Cash'}
                                </button>
                                <button className={styles.sendPaymentBtn} onClick={() => {
                                    if (!formData.selectedCalendar || !formData.clientName || !formData.clientEmail) {
                                        toast.warning('Please fill in client name, email and calendar');
                                        return;
                                    }
                                    setShowSendLinkModal(true);
                                }} disabled={submitting}>
                                    Send Payment Link
                                </button>
                            </>
                        ) : (
                            <button className={styles.sendPaymentBtn} onClick={handleBookClick} disabled={submitting}>
                                {submitting ? 'Creating...' : 'Book'}
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Payment confirmation modal — shown when no PG connected */}
            {showPaymentConfirm && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    onClick={() => setShowPaymentConfirm(false)}>
                    <div style={{ background: '#fff', borderRadius: '16px', padding: '32px', width: '100%', maxWidth: '400px', fontFamily: 'Urbanist' }}
                        onClick={e => e.stopPropagation()}>
                        <h3 style={{ margin: '0 0 8px', fontSize: '18px', fontWeight: 700, color: '#082421' }}>Confirm Booking</h3>
                        <p style={{ margin: '0 0 24px', fontSize: '14px', color: '#6B7280' }}>
                            {price ? `Session fee: ${price.currency} ${price.amount}` : 'No fee configured for this calendar.'}
                            <br />Has the client already paid, or will they pay later?
                        </p>
                        <div style={{ display: 'flex', gap: '12px' }}>
                            <button
                                onClick={() => handleCreateBooking('Paid')}
                                disabled={submitting}
                                style={{ flex: 1, padding: '12px', borderRadius: '10px', border: 'none', background: '#082421', color: '#fff', fontFamily: 'Urbanist', fontWeight: 700, fontSize: '14px', cursor: 'pointer' }}>
                                ✓ Paid (Cash / UPI)
                            </button>
                            <button
                                onClick={() => handleCreateBooking('Pending')}
                                disabled={submitting}
                                style={{ flex: 1, padding: '12px', borderRadius: '10px', border: '1px solid #e0e0e0', background: '#fff', color: '#333', fontFamily: 'Urbanist', fontWeight: 600, fontSize: '14px', cursor: 'pointer' }}>
                                Pay Later
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <SendBookingLinkModal
                isOpen={showSendLinkModal}
                onClose={() => setShowSendLinkModal(false)}
                prefillName={formData.clientName}
                prefillEmail={formData.clientEmail}
                prefillPhone={formData.clientWhatsApp}
                prefillCalendarId={formData.selectedCalendar}
            />
        </div>
    );
};

export default CreateBooking;
