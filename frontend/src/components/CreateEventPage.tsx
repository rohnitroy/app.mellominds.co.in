import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import styles from './CreateEventPage.module.css';
import { useAuth } from '../context/AuthContext';
import AddLocationModal from './AddLocationModal';
import QuestionModal from './QuestionModal';
import AvailabilityModal from './AvailabilityModal';
import { useToast } from '../context/ToastContext';
import API_BASE_URL from '../config/api';

const CreateEventPage: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { user } = useAuth();
    const toast = useToast();
    
    // Check if we're in edit mode
    const isEditMode = location.state?.isEditing || false;
    const existingCalendar = location.state?.calendar;
    
    // Retrieve type passed from previous screen if available
    const initialType = existingCalendar?.type || location.state?.type || 'one_on_one';

    const [activeTab, setActiveTab] = useState('basic');
    // In edit mode, slug is already set so allow editing immediately
    const [isSlugEdited, setIsSlugEdited] = useState(isEditMode);
    const [showAddLocationModal, setShowAddLocationModal] = useState(false);
    const [showAvailabilityModal, setShowAvailabilityModal] = useState(false);
    const [isGoogleConnected, setIsGoogleConnected] = useState(false);
    // Group calendar capacity
    const [maxAttendees, setMaxAttendees] = useState<string>(
        existingCalendar?.max_attendees ? String(existingCalendar.max_attendees) : '10'
    );

    useEffect(() => {
        fetch(`${API_BASE_URL}/api/connect-calendar/status`, { credentials: 'include' })
            .then(r => r.ok ? r.json() : { connected: false })
            .then(data => setIsGoogleConnected(data.connected))
            .catch(() => setIsGoogleConnected(false));
    }, []);
    const descriptionRef = React.useRef<HTMLTextAreaElement>(null);

    const applyFormat = (format: 'bold' | 'italic' | 'bullet' | 'link') => {
        const el = descriptionRef.current;
        if (!el) return;
        const start = el.selectionStart;
        const end = el.selectionEnd;
        const selected = el.value.substring(start, end);
        let before = el.value.substring(0, start);
        let after = el.value.substring(end);
        let insert = '';

        if (format === 'bold') {
            insert = `**${selected || 'bold text'}**`;
        } else if (format === 'italic') {
            insert = `_${selected || 'italic text'}_`;
        } else if (format === 'bullet') {
            insert = `\n- ${selected || 'item'}`;
        } else if (format === 'link') {
            const url = prompt('Enter URL:');
            if (!url) return;
            insert = `[${selected || 'link text'}](${url})`;
        }

        const newValue = before + insert + after;
        setEventData(prev => ({ ...prev, description: newValue }));

        // Restore focus and cursor position after state update
        setTimeout(() => {
            el.focus();
            const newCursor = before.length + insert.length;
            el.setSelectionRange(newCursor, newCursor);
        }, 0);
    };

    interface LocationItem {
        type: string;
        address?: string;
        details?: Record<string, string>;
    }

    const [eventData, setEventData] = useState<{
        name: string;
        description: string;
        url: string;
        color: string;
        locations: LocationItem[];
        duration: string;
        owner: string;
    }>({
        name: existingCalendar?.title || '',
        description: existingCalendar?.description || '',
        // Strip leading slash — the UI renders "/" prefix separately
        url: existingCalendar?.slug ? existingCalendar.slug.replace(/^\//, '') : '',
        color: '#3787F8',
        locations: existingCalendar?.locations || [{ type: 'google_meet' }],
        duration: existingCalendar?.duration?.replace(' m', '') || '60',
        owner: user?.user_name || 'Therapist',
    });

    // Parse existing duration "60 m" -> { duration: '60', durationUnit: 'Minutes' }
    const parsedDuration = (() => {
        const raw = existingCalendar?.duration || '';
        const match = raw.match(/^(\d+)\s*m$/i);
        return match ? { duration: match[1], durationUnit: 'Minutes' } : { duration: '30', durationUnit: 'Minutes' };
    })();

    const [scheduleData, setScheduleData] = useState({
        duration: parsedDuration.duration,
        durationUnit: parsedDuration.durationUnit,
        dateRangeType: existingCalendar?.schedule_settings?.dateRangeType || 'calendar_days',
        dateRangeValue: existingCalendar?.schedule_settings?.dateRangeValue || '60',
        dateRangeStart: existingCalendar?.schedule_settings?.dateRangeStart || '',
        dateRangeEnd: existingCalendar?.schedule_settings?.dateRangeEnd || '',
        selectedSchedule: 'default',
        slotInterval: '30',
        bufferType: existingCalendar?.schedule_settings?.bufferType || 'after_event',
        bufferTime: existingCalendar?.schedule_settings?.bufferTime || '0',
        minNotice: existingCalendar?.schedule_settings?.minNotice || '0',
        minNoticeUnit: existingCalendar?.schedule_settings?.minNoticeUnit || 'Minutes'
    });

    interface FormQuestion {
        id: number;
        label: string;
        type: string;
        key: string;
        required: boolean;
        persistent: boolean;
    }

    interface FormDataType {
        heading: string;
        questions: FormQuestion[];
    }

    const defaultFormData: FormDataType = {
        heading: 'Registration',
        questions: [
            { id: 1, label: 'Name', type: 'text', key: 'name', required: true, persistent: true },
            { id: 2, label: 'Email address', type: 'email', key: 'email', required: true, persistent: true }
        ]
    };

    const [formData, setFormData] = useState<FormDataType>(
        existingCalendar?.form_data || defaultFormData
    );

    const [paymentData, setPaymentData] = useState({
        acceptPayment: existingCalendar?.payment_enabled || false,
        paymentGateways: existingCalendar?.payment_gateway ? [existingCalendar.payment_gateway] : [] as string[],
        prices: existingCalendar?.prices || [] as any[],
        cancellation: existingCalendar?.cancellation_policy || {
            enabled: false,
            window: '24',
            unit: 'hours',
            refundType: 'full',
            refundPercentage: '50'
        },
        reschedule: existingCalendar?.reschedule_policy || {
            enabled: false,
            window: '24',
            unit: 'hours',
            type: 'free',
            fee: ''
        }
    });

    const [paymentGateways, setPaymentGateways] = useState<{ value: string; label: string }[]>([]);

    useEffect(() => {
        fetch(`${API_BASE_URL}/api/calendars/payment-gateways`, { credentials: 'include' })
            .then(r => r.ok ? r.json() : [{ value: 'offline', label: 'Cash / UPI / Offline Payment' }])
            .then(data => setPaymentGateways(data))
            .catch(() => setPaymentGateways([{ value: 'offline', label: 'Cash / UPI / Offline Payment' }]));
    }, []);

    const [isGatewayDropdownOpen, setIsGatewayDropdownOpen] = useState(false);
    const gatewayDropdownRef = React.useRef<HTMLDivElement>(null);

    // Close gateway dropdown on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (gatewayDropdownRef.current && !gatewayDropdownRef.current.contains(e.target as Node)) {
                setIsGatewayDropdownOpen(false);
            }
        };
        if (isGatewayDropdownOpen) document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [isGatewayDropdownOpen]);
    const [showPriceInput, setShowPriceInput] = useState(false);
    const [newPrice, setNewPrice] = useState({
        amount: '',
        currency: 'INR',
        label: ''
    });

    const handleGatewayChange = (gateway: string) => {
        setPaymentData(prev => {
            const gateways = prev.paymentGateways.includes(gateway)
                ? prev.paymentGateways.filter(g => g !== gateway)
                : [...prev.paymentGateways, gateway];
            return { ...prev, paymentGateways: gateways };
        });
    };

    const handleAddPrice = () => {
        if (!newPrice.amount || !newPrice.currency) return;
        setPaymentData(prev => ({
            ...prev,
            prices: [...prev.prices, { ...newPrice, id: Date.now() }]
        }));
        setNewPrice({ amount: '', currency: 'INR', label: '' });
        setShowPriceInput(false);
    };

    const removePrice = (id: number) => {
        setPaymentData(prev => ({
            ...prev,
            prices: prev.prices.filter((p: any) => p.id !== id)
        }));
    };

    const navIcons: Record<string, React.ReactNode> = {
        basic: (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
        ),
        schedule: (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
        ),
        form: (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
            </svg>
        ),
        payment: (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/>
            </svg>
        ),
    };

    const navItems = [
        { id: 'basic', label: 'Basic' },
        { id: 'schedule', label: 'Schedule' },
        { id: 'form', label: 'Form' },
        { id: 'payment', label: 'Payment' },
    ];

    // Simplified schedule management: fetch the user's single availability schedule
    const [displayAvailability, setDisplayAvailability] = useState<{ day: string; time: string }[]>([
        { day: 'SUN', time: 'Loading...' },
        { day: 'MON', time: 'Loading...' },
        { day: 'TUE', time: 'Loading...' },
        { day: 'WED', time: 'Loading...' },
        { day: 'THU', time: 'Loading...' },
        { day: 'FRI', time: 'Loading...' },
        { day: 'SAT', time: 'Loading...' },
    ]);

    // Format time helper (HH:MM -> 12h format)
    const formatTime12h = (time24: string) => {
        const [h, m] = time24.split(':').map(Number);
        const date = new Date();
        date.setHours(h, m);
        return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
    };

    const fetchAvailability = async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/api/availability`, {
                credentials: 'include'
            });

            if (response.ok) {
                const data = await response.json();

                // Days mapping
                const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

                // Initialize default unavailable structure
                const newAvailability = dayNames.map((day, index) => ({
                    day,
                    time: 'Unavailable',
                    dayIndex: index
                }));

                // Process fetched slots
                data.forEach((slot: any) => {
                    if (slot.is_enabled) {
                        const dayIndex = slot.day_of_week;
                        const timeStr = `${formatTime12h(slot.start_time)} - ${formatTime12h(slot.end_time)}`;

                        // Append if multiple slots exist for the same day
                        if (newAvailability[dayIndex].time === 'Unavailable') {
                            newAvailability[dayIndex].time = timeStr;
                        } else {
                            newAvailability[dayIndex].time += `, ${timeStr}`;
                        }
                    }
                });

                setDisplayAvailability(newAvailability);
            } else {
                console.error('Failed to fetch availability');
                setDisplayAvailability(prev => prev.map(d => ({ ...d, time: 'Unavailable' })));
            }
        } catch (error) {
            console.error('Error fetching availability:', error);
            setDisplayAvailability(prev => prev.map(d => ({ ...d, time: 'Unavailable' })));
        }
    };

    useEffect(() => {
        fetchAvailability();
    }, []);

    // Currently supported backend only allows one schedule per user
    const availableSchedules = [
        { id: 'default', name: 'My Current Availability' }
    ];

    const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const name = e.target.value;
        const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
        setEventData(prev => ({
            ...prev,
            name,
            url: isSlugEdited ? prev.url : slug
        }));
    };

    const handleLocationFromModal = (locationData: any) => {
        if (locationData.type === 'google_meet') {
            const hasGoogleMeet = eventData.locations.some(loc => loc.type === 'google_meet');
            if (hasGoogleMeet) {
                toast.warning('Google Meet is already selected as a session mode.');
                return;
            }
        }

        const newLocation: any = { type: locationData.type };

        if (locationData.type === 'in_person' && locationData.details) {
            const { name, address, city, state, country } = locationData.details;
            newLocation.details = locationData.details;
            newLocation.address = `${name}: ${address}, ${city}, ${state}, ${country}`;
        }

        setEventData(prev => ({
            ...prev,
            locations: [...prev.locations, newLocation]
        }));
        setShowAddLocationModal(false);
    };

    const removeLocation = (index: number) => {
        setEventData(prev => ({
            ...prev,
            locations: prev.locations.filter((_, i) => i !== index)
        }));
    };

    const handleConnectGoogle = () => {
        window.location.href = `${API_BASE_URL}/api/connect-calendar/start`;
    };

    // Derive the public booking URL for this calendar
    const getBookingUrl = () => {
        if (!user || !eventData.url.trim()) return '';
        const slug = eventData.url.replace(/^\//, '');
        const identifier = user.profile_slug || user.id;
        return `${window.location.origin}/book/${identifier}/${slug}`;
    };

    const handleCopyLink = () => {
        const url = getBookingUrl();
        if (!url) { toast.error('Enter a slug / save the calendar first to get a link.'); return; }
        navigator.clipboard.writeText(url);
        toast.success('Booking link copied!');
    };

    const handlePreview = () => {
        const url = getBookingUrl();
        if (!url) { toast.error('Enter a slug / save the calendar first to preview.'); return; }
        window.open(url, '_blank');
    };

    const handleSave = async () => {
        if (!isGoogleConnected) {
            toast.error('Please connect your Google Calendar in Settings before creating a calendar.');
            return;
        }

        if (!eventData.name.trim()) {
            toast.error('Event Name is required.');
            setActiveTab('basic');
            return;
        }

        if (!scheduleData.duration) {
            toast.error('Duration is required.');
            setActiveTab('schedule');
            return;
        }

        try {
            // Build the payload
            const rawSlug = eventData.url.trim();
            const normalizedSlug = rawSlug
                ? (rawSlug.startsWith('/') ? rawSlug : `/${rawSlug}`)
                : `/${eventData.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '')}-${Date.now()}`;

            const payload = {
                title: eventData.name,
                duration: scheduleData.durationUnit === 'Hours'
                    ? `${parseInt(scheduleData.duration) * 60} m`
                    : `${scheduleData.duration} m`,
                type: initialType,
                description: eventData.description,
                slug: normalizedSlug,
                is_active: true,
                locations: eventData.locations,
                ...(initialType === 'group' && maxAttendees ? { max_attendees: parseInt(maxAttendees) } : {}),
                schedule_settings: {
                    dateRangeType: scheduleData.dateRangeType,
                    dateRangeValue: scheduleData.dateRangeValue,
                    dateRangeStart: scheduleData.dateRangeStart,
                    dateRangeEnd: scheduleData.dateRangeEnd,
                    slotInterval: scheduleData.slotInterval,
                    bufferType: scheduleData.bufferType,
                    bufferTime: scheduleData.bufferTime,
                    minNotice: scheduleData.minNotice,
                    minNoticeUnit: scheduleData.minNoticeUnit,
                },
                form_data: formData,
                payment_data: paymentData
            };

            const url = isEditMode 
                ? `${API_BASE_URL}/api/calendars/${existingCalendar.id}`
                : `${API_BASE_URL}/api/calendars`;

            const response = await fetch(url, {
                method: isEditMode ? 'PUT' : 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                toast.success(isEditMode ? 'Calendar updated successfully!' : 'Calendar created successfully!');
                // Success: Redirect back to My Calendars
                navigate('/my-calendar');
            } else {
                const errorData = await response.json();
                if (response.status === 409) {
                    toast.error('This slug is already used by one of your calendars. Please choose a different one.');
                    setActiveTab('basic');
                    setIsSlugEdited(true);
                } else {
                    toast.error(`Failed to save calendar: ${errorData.error}`);
                }
            }
        } catch (error) {
            console.error('Error saving event:', error);
            toast.error('An error occurred while saving.');
        }
    };

    const renderBasicTab = () => (
        <>
            <div className={styles.card}>
                <div className={styles.formGroup}>
                    <label className={styles.label}>Calendar Name</label>
                    <input
                        type="text"
                        className={styles.input}
                        placeholder="Enter calendar name"
                        value={eventData.name}
                        onChange={handleNameChange}
                    />
                </div>

                <div className={styles.formGroup}>
                    <label className={styles.label}>Description</label>
                    <div className={styles.editor}>
                        <div className={styles.editorToolbar}>
                            <button className={styles.editorBtn} onClick={() => applyFormat('bold')} title="Bold" type="button"><strong>B</strong></button>
                            <button className={styles.editorBtn} onClick={() => applyFormat('italic')} title="Italic" type="button"><em>I</em></button>
                            <button className={styles.editorBtn} onClick={() => applyFormat('bullet')} title="Bullet List" type="button">≡</button>
                            <button className={styles.editorBtn} onClick={() => applyFormat('link')} title="Link" type="button">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                                </svg>
                            </button>
                        </div>
                        <textarea
                            ref={descriptionRef}
                            className={styles.editorContent}
                            placeholder="Describe your event..."
                            value={eventData.description}
                            onChange={(e) => setEventData(prev => ({ ...prev, description: e.target.value }))}
                            rows={5}
                        />
                    </div>
                </div>

                <div className={styles.row}>
                    <div className={`${styles.formGroup} ${styles.col}`}>
                        <label className={styles.label}>Slug</label>
                        <div className={styles.input} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: isSlugEdited ? 'white' : '#f8f9fa' }}>
                            <span style={{ color: '#666' }}>/</span>
                            <input
                                type="text"
                                style={{ border: 'none', outline: 'none', flex: 1, background: 'transparent' }}
                                value={eventData.url}
                                readOnly={!isSlugEdited}
                                placeholder="your-event-slug"
                                onChange={e => {
                                    // sanitize: lowercase, only alphanumeric and hyphens
                                    const sanitized = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-');
                                    setIsSlugEdited(true);
                                    setEventData(prev => ({ ...prev, url: sanitized }));
                                }}
                            />
                            <button
                                className={styles.actionBtn}
                                style={{ padding: '4px 8px', fontSize: '12px', border: '1px solid #ccc' }}
                                onClick={() => setIsSlugEdited((v: boolean) => !v)}
                                type="button"
                            >
                                {isSlugEdited ? 'Lock' : 'Edit'}
                            </button>
                        </div>
                    </div>
                    <div className={`${styles.formGroup} ${styles.col}`}>
                        <label className={styles.label}>Therapist</label>
                        <div className={styles.input} style={{ background: '#f8f9fa', color: '#666' }}>
                            {eventData.owner}
                        </div>
                    </div>
                </div>

                {/* Group capacity field */}
                {initialType === 'group' && (
                    <div className={styles.formGroup}>
                        <label className={styles.label}>Max Attendees</label>
                        <input
                            type="number"
                            className={styles.input}
                            min="2"
                            placeholder="e.g. 10"
                            value={maxAttendees}
                            onChange={e => setMaxAttendees(e.target.value)}
                        />
                        <p style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>Maximum number of people who can book this group session.</p>
                    </div>
                )}
            </div>

            <div className={styles.card}>
                <div className={styles.formGroup}>
                    <label className={styles.label}>Session Mode</label>
                    {eventData.locations.map((loc, index) => (
                        <div key={index} className={styles.locationChip} style={{ marginBottom: '8px' }}>
                            {loc.type === 'google_meet' && (
                                <>
                                    <img src="/google-meet-logo.svg" alt="Google Meet" width="20" height="20" />
                                    Google Meet
                                </>
                            )}
                            {loc.type === 'in_person' && (
                                <>
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
                                    </svg>
                                    In-Person: {loc.address}
                                </>
                            )}
                            <span style={{ marginLeft: 'auto', cursor: 'pointer', color: '#666' }} onClick={() => removeLocation(index)}>×</span>
                        </div>
                    ))}
                    <div>
                        <button className={styles.actionBtn} style={{ maxWidth: '200px', marginBottom: '8px' }} onClick={() => setShowAddLocationModal(true)}>
                            + Select a Session Mode
                        </button>
                    </div>
                    <p style={{ fontSize: '12px', color: '#666', marginTop: '8px' }}>
                        Connect with Video conferencing apps to auto create the meeting link when booked: <a href="/settings" style={{ color: '#3787F8' }}>Go to Connections →</a>
                    </p>
                </div>
            </div>
        </>
    );

    const renderScheduleTab = () => (
        <>
            {/* Durations */}
            <div className={styles.scheduleSection}>
                <h3>Durations</h3>
                <p>Set custom duration options for this event</p>
                <div className={styles.rowInputs}>
                    <input
                        type="number"
                        className={styles.smallInput}
                        value={scheduleData.duration}
                        onChange={(e) => setScheduleData({ ...scheduleData, duration: e.target.value })}
                    />
                    <select
                        className={styles.selectInput}
                        value={scheduleData.durationUnit}
                        onChange={(e) => setScheduleData({ ...scheduleData, durationUnit: e.target.value })}
                    >
                        <option value="Minutes">Minutes</option>
                        <option value="Hours">Hours</option>
                    </select>
                </div>

            </div>

            {/* Date Ranges */}
            <div className={styles.scheduleSection}>
                <h3>Date Ranges</h3>
                <p>Set how far in advance people can book this event</p>

                <div className={styles.radioGroup}>
                    <label className={styles.radioOption}>
                        <input
                            type="radio"
                            name="dateRange"
                            checked={scheduleData.dateRangeType === 'calendar_days'}
                            onChange={() => setScheduleData({ ...scheduleData, dateRangeType: 'calendar_days' })}
                        />
                        <span>Calendar days into the future</span>
                    </label>
                    {scheduleData.dateRangeType === 'calendar_days' && (
                        <div className={styles.subInputContainer}>
                            <input
                                type="number"
                                className={styles.smallInput}
                                value={scheduleData.dateRangeValue}
                                onChange={(e) => setScheduleData({ ...scheduleData, dateRangeValue: e.target.value })}
                            />
                            <span style={{ fontSize: '13px', color: '#666', marginLeft: '8px' }}>days</span>
                        </div>
                    )}

                    <label className={styles.radioOption}>
                        <input
                            type="radio"
                            name="dateRange"
                            checked={scheduleData.dateRangeType === 'business_days'}
                            onChange={() => setScheduleData({ ...scheduleData, dateRangeType: 'business_days' })}
                        />
                        <span>Business days into the future</span>
                    </label>
                    {scheduleData.dateRangeType === 'business_days' && (
                        <div className={styles.subInputContainer}>
                            <input
                                type="number"
                                className={styles.smallInput}
                                value={scheduleData.dateRangeValue}
                                onChange={(e) => setScheduleData({ ...scheduleData, dateRangeValue: e.target.value })}
                            />
                            <span style={{ fontSize: '13px', color: '#666', marginLeft: '8px' }}>business days (Mon–Fri)</span>
                        </div>
                    )}

                    <label className={styles.radioOption}>
                        <input
                            type="radio"
                            name="dateRange"
                            checked={scheduleData.dateRangeType === 'indefinitely'}
                            onChange={() => setScheduleData({ ...scheduleData, dateRangeType: 'indefinitely' })}
                        />
                        <span>None (no restriction)</span>
                    </label>

                    <label className={styles.radioOption}>
                        <input
                            type="radio"
                            name="dateRange"
                            checked={scheduleData.dateRangeType === 'range'}
                            onChange={() => setScheduleData({ ...scheduleData, dateRangeType: 'range' })}
                        />
                        <span>Within a date range</span>
                    </label>
                    {scheduleData.dateRangeType === 'range' && (
                        <div className={styles.subInputContainer} style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                            <div>
                                <label style={{ fontSize: '12px', color: '#666', display: 'block', marginBottom: '4px' }}>From</label>
                                <input
                                    type="date"
                                    className={styles.smallInput}
                                    style={{ width: 'auto' }}
                                    value={scheduleData.dateRangeStart}
                                    min={new Date().toISOString().split('T')[0]}
                                    onChange={(e) => setScheduleData({ ...scheduleData, dateRangeStart: e.target.value })}
                                />
                            </div>
                            <div>
                                <label style={{ fontSize: '12px', color: '#666', display: 'block', marginBottom: '4px' }}>To</label>
                                <input
                                    type="date"
                                    className={styles.smallInput}
                                    style={{ width: 'auto' }}
                                    value={scheduleData.dateRangeEnd}
                                    min={scheduleData.dateRangeStart || new Date().toISOString().split('T')[0]}
                                    onChange={(e) => setScheduleData({ ...scheduleData, dateRangeEnd: e.target.value })}
                                />
                            </div>
                        </div>
                    )}

                </div>
            </div>

            {/* Schedule */}
            <div className={styles.scheduleSection}>
                <h3>Schedule</h3>
                <p>Select the schedule to determine your availability</p>
                <div className={styles.scheduleActions}>
                    <select
                        className={styles.input}
                        value={scheduleData.selectedSchedule}
                        onChange={(e) => setScheduleData({ ...scheduleData, selectedSchedule: e.target.value })}
                        style={{ flex: 1 }}
                    >
                        {availableSchedules.map(sch => (
                            <option key={sch.id} value={sch.id}>{sch.name}</option>
                        ))}
                    </select>
                    <button className={styles.actionBtn} onClick={() => setShowAvailabilityModal(true)} type="button">Edit Schedule</button>
                </div>

                <p className={styles.sectionLabel}>Available Times</p>
                <div className={styles.scheduleGrid}>
                    {displayAvailability.map((slot, index) => (
                        <div key={index} className={`${styles.scheduleDay} ${slot.time === 'Unavailable' ? styles.unavailable : ''}`}>
                            <span>{slot.day}</span>
                            <span>{slot.time}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Break Time */}
            <div className={styles.scheduleSection}>
                <h3>Break Time</h3>
                <p>Add buffer time before and after events</p>
                <div className={styles.radioGroup} style={{ flexDirection: 'row', gap: '24px', marginBottom: '24px' }}>
                    <label className={styles.radioOption}>
                        <input
                            type="radio"
                            name="bufferTime"
                            checked={scheduleData.bufferType === 'before_event'}
                            onChange={() => setScheduleData({ ...scheduleData, bufferType: 'before_event' })}
                        />
                        <span>Before Event</span>
                    </label>
                    <label className={styles.radioOption}>
                        <input
                            type="radio"
                            name="bufferTime"
                            checked={scheduleData.bufferType === 'after_event'}
                            onChange={() => setScheduleData({ ...scheduleData, bufferType: 'after_event' })}
                        />
                        <span>After Event</span>
                    </label>
                </div>

                <p className={styles.sectionLabel} style={{ marginTop: 0 }}>
                    {scheduleData.bufferType === 'before_event' ? 'Before Event' : 'After Event'} (minutes)
                </p>
                <input
                    type="number"
                    className={styles.smallInput}
                    style={{ width: '100px' }}
                    value={scheduleData.bufferTime}
                    onChange={(e) => setScheduleData({ ...scheduleData, bufferTime: e.target.value })}
                />
            </div>

            {/* Minimum Notice */}
            <div className={styles.scheduleSection}>
                <h3>Minimum Notice</h3>
                <p>Set minimum advance notice required for bookings</p>
                <div className={styles.rowInputs}>
                    <input
                        type="number"
                        className={styles.smallInput}
                        style={{ width: '100px' }}
                        value={scheduleData.minNotice}
                        onChange={(e) => setScheduleData({ ...scheduleData, minNotice: e.target.value })}
                    />
                    <select className={styles.selectInput} value={scheduleData.minNoticeUnit} onChange={(e) => setScheduleData({ ...scheduleData, minNoticeUnit: e.target.value })}>
                        <option value="Minutes">Minutes</option>
                        <option value="Hours">Hours</option>
                        <option value="Days">Days</option>
                    </select>
                </div>
            </div>
        </>
    );

    const handleTemplateSelect = (template: string) => {
        let newQuestions = [...formData.questions];
        const baseQuestions = [
            { id: 1, label: 'Name', type: 'text', key: 'name', required: true, persistent: true },
            { id: 2, label: 'Email address', type: 'email', key: 'email', required: true, persistent: true }
        ];

        switch (template) {
            case 'name_email_phone':
                newQuestions = [
                    ...baseQuestions,
                    { id: Date.now(), label: 'Mobile number', type: 'tel', key: 'phone', required: true, persistent: false }
                ];
                break;
            case 'name_phone':
                newQuestions = [
                    { id: 1, label: 'Name', type: 'text', key: 'name', required: true, persistent: true },
                    { id: Date.now(), label: 'Mobile number', type: 'tel', key: 'phone', required: true, persistent: false }
                ];
                break;
            case 'name_email':
                newQuestions = [...baseQuestions];
                break;
            // Add more templates as needed
            default:
                break;
        }
        setFormData({ ...formData, questions: newQuestions });
    };

    const removeQuestion = (id: number) => {
        setFormData({
            ...formData,
            questions: formData.questions.filter(q => q.id !== id)
        });
    };

    const [showQuestionModal, setShowQuestionModal] = useState(false);
    const [editingQuestion, setEditingQuestion] = useState<any>(null);

    const handleAddQuestion = () => {
        setEditingQuestion(null);
        setShowQuestionModal(true);
    };

    const handleEditQuestion = (question: any) => {
        setEditingQuestion(question);
        setShowQuestionModal(true);
    };

    const handleSaveQuestion = (question: any) => {
        if (editingQuestion) {
            setFormData({
                ...formData,
                questions: formData.questions.map(q => q.id === editingQuestion.id ? question : q)
            });
        } else {
            setFormData({
                ...formData,
                questions: [...formData.questions, { ...question, id: Date.now(), persistent: false }]
            });
        }
        setShowQuestionModal(false);
    };

    // Renamed to avoid conflict if any, but logically it replaces the old render function
    const renderQuestionModalComponent = () => (
        <QuestionModal
            isOpen={showQuestionModal}
            onClose={() => setShowQuestionModal(false)}
            onSave={handleSaveQuestion}
            editingQuestion={editingQuestion}
        />
    );

    const renderFormTab = () => (
        <>
            <div className={styles.scheduleSection}>
                <h3>Registration Form</h3>
                <p>Customize the registration form to add and configure fields to collect specific information from invitees.</p>

                <div className={styles.formGroup}>
                    <label className={styles.label}>Form Heading</label>
                    <input
                        type="text"
                        className={styles.input}
                        value={formData.heading}
                        onChange={(e) => setFormData({ ...formData, heading: e.target.value })}
                    />
                </div>

                <div className={styles.formGroup}>
                    <label className={styles.label}>Quick Form Templates</label>
                    <p style={{ fontSize: '13px', color: '#666', marginBottom: '12px' }}>Choose from pre-configured form templates or create your own custom questions below.</p>
                    <div className={styles.templatesContainer}>
                        <button className={styles.templateBtn} onClick={() => handleTemplateSelect('name_email_phone')}>
                            ↻ Name, Email & Phone
                        </button>
                        <button className={styles.templateBtn} onClick={() => handleTemplateSelect('name_email')}>
                            ↻ Name & Email
                        </button>
                        <button className={styles.templateBtn} onClick={() => handleTemplateSelect('name_phone')}>
                            ↻ Name & Phone
                        </button>
                    </div>
                </div>

                <div className={styles.questionsHeader}>
                    <label className={styles.label} style={{ marginBottom: 0 }}>Questions</label>
                    <button className={styles.addQuestionBtn} onClick={handleAddQuestion}>+ Add Question</button>
                </div>

                <div className={styles.questionsList}>
                    {formData.questions.map((q, index) => (
                        <div
                            key={q.id}
                            className={styles.questionItem}
                            draggable
                            onDragStart={(e) => {
                                e.dataTransfer.setData('text/plain', index.toString());
                                e.dataTransfer.effectAllowed = 'move';
                            }}
                            onDragOver={(e) => {
                                e.preventDefault(); // Necessary to allow dropping
                                e.dataTransfer.dropEffect = 'move';
                            }}
                            onDrop={(e) => {
                                e.preventDefault();
                                const draggedIndexStr = e.dataTransfer.getData('text/plain');
                                if (draggedIndexStr) {
                                    const draggedIndex = parseInt(draggedIndexStr, 10);
                                    if (draggedIndex !== index) {
                                        const newQuestions = [...formData.questions];
                                        const [removed] = newQuestions.splice(draggedIndex, 1);
                                        newQuestions.splice(index, 0, removed);
                                        setFormData({ ...formData, questions: newQuestions });
                                    }
                                }
                            }}
                            style={{ cursor: 'grab' }}
                        >
                            <div className={styles.questionLeft}>
                                <span className={styles.dragHandle} style={{ cursor: 'grab', display: 'flex', alignItems: 'center' }}>
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M4 6H20M4 12H20M4 18H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                </span>
                                <div className={styles.questionContent}>
                                    <span className={styles.questionLabel}>{q.label}</span>
                                    <span style={{ fontSize: '12px', color: '#888' }}>{q.key}</span>
                                </div>
                                {q.required && <span className={styles.requiredBadge}>Required</span>}
                            </div>
                            <div className={styles.questionActions}>
                                <button className={styles.iconBtn} onClick={() => handleEditQuestion(q)}>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                                    </svg>
                                </button>
                                {!q.persistent && (
                                    <button className={styles.iconBtn} onClick={() => removeQuestion(q.id)}>
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                                        </svg>
                                    </button>
                                )}
                                <button className={styles.iconBtn}>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                                        <circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/>
                                    </svg>
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
            {renderQuestionModalComponent()}
        </>
    );

    const renderPaymentTab = () => (
        <div className={styles.paymentSection}>
            <div className={styles.paymentHeader}>
                <div>
                    <h3>Accept Payment</h3>
                    <p className={styles.paymentDescription}>
                        Collect payment when someone books an appointment
                    </p>
                </div>
                <label className={styles.toggleSwitch}>
                    <input
                        type="checkbox"
                        className={styles.toggleInput}
                        checked={paymentData.acceptPayment}
                        onChange={(e) => setPaymentData({ ...paymentData, acceptPayment: e.target.checked })}
                    />
                    <span className={styles.toggleSlider}></span>
                </label>
            </div>

            {paymentData.acceptPayment && (
            <>
            <div style={{ marginTop: '24px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#1a1a1a', marginBottom: '8px', fontFamily: '"Urbanist", sans-serif' }}>Payment Mode</h3>
                <select
                    className={styles.selectInput}
                    style={{ width: '100%' }}
                    value={paymentData.paymentGateways[0] || ''}
                    onChange={(e) => setPaymentData(prev => ({ ...prev, paymentGateways: e.target.value ? [e.target.value] : [] }))}
                >
                    <option value="">Select a payment gateway...</option>
                    {paymentGateways.map(gw => (
                        <option key={gw.value} value={gw.value}>{gw.label}</option>
                    ))}
                </select>
            </div>

            <div style={{ marginTop: '24px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#1a1a1a', marginBottom: '8px', fontFamily: '"Urbanist", sans-serif' }}>Pricing</h3>
                <div className={styles.pricingContainer}>
                    {paymentData.prices.length === 0 && !showPriceInput && (
                        <p className={styles.noPricesText}>No prices configured</p>
                    )}

                    {paymentData.prices.length > 0 && (
                        <div className={styles.pricingList}>
                            {paymentData.prices.map((price: any) => (
                                <div key={price.id} className={styles.priceItem}>
                                    <div className={styles.priceDetails}>
                                        <span className={styles.priceAmount}>{price.currency} {price.amount}</span>
                                        {price.label && <span className={styles.priceLabel}>{price.label}</span>}
                                    </div>
                                    <button className={styles.iconBtn} onClick={() => removePrice(price.id)}>
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                                        </svg>
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    {showPriceInput ? (
                        <div className={styles.priceInputForm}>
                            <div className={styles.priceInputRow}>
                                <select
                                    className={`${styles.selectInput} ${styles.currencySelect}`}
                                    value={newPrice.currency}
                                    onChange={(e) => setNewPrice({ ...newPrice, currency: e.target.value })}
                                >
                                    <option value="INR">INR</option>
                                    <option value="USD">USD</option>
                                    <option value="EUR">EUR</option>
                                </select>
                                <input
                                    type="number"
                                    className={`${styles.input} ${styles.priceAmountInput}`}
                                    placeholder="Amount"
                                    value={newPrice.amount}
                                    onChange={(e) => setNewPrice({ ...newPrice, amount: e.target.value })}
                                />
                            </div>
                            <input
                                type="text"
                                className={styles.input}
                                placeholder="Label (e.g. Consultation Fee)"
                                value={newPrice.label}
                                onChange={(e) => setNewPrice({ ...newPrice, label: e.target.value })}
                            />
                            <div className={styles.actionButtons}>
                                <button className={styles.cancelBtn} onClick={() => setShowPriceInput(false)}>Cancel</button>
                                <button className={styles.savePriceBtn} onClick={handleAddPrice}>Save Price</button>
                            </div>
                        </div>
                    ) : (
                        <button className={styles.addPriceBtn} onClick={() => setShowPriceInput(true)}>
                            + Add Price
                        </button>
                    )}
                </div>
            </div>

            {/* Cancellation Policy */}
            <div style={{ marginTop: '32px', borderTop: '1px solid #e0e0e0', paddingTop: '24px' }}>
                <div className={styles.paymentHeader}>
                    <div>
                        <h3>Cancellation Policy</h3>
                        <p className={styles.paymentDescription}>
                            Allow invitees to cancel their booking.
                        </p>
                    </div>
                    <label className={styles.toggleSwitch}>
                        <input
                            type="checkbox"
                            className={styles.toggleInput}
                            checked={paymentData.cancellation.enabled}
                            onChange={(e) => setPaymentData({
                                ...paymentData,
                                cancellation: { ...paymentData.cancellation, enabled: e.target.checked }
                            })}
                        />
                        <span className={styles.toggleSlider}></span>
                    </label>
                </div>

                {paymentData.cancellation.enabled && (
                    <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        <div>
                            <label className={styles.label} style={{ marginBottom: 0 }}>Minimum Cancellation Notice</label>
                            <p style={{ fontSize: '13px', color: '#666', marginBottom: '8px' }}>
                                Invitees can cancel until this much time before the event start time.
                            </p>
                            <div className={styles.rowInputs}>
                                <input
                                    type="number"
                                    className={styles.smallInput}
                                    value={paymentData.cancellation.window}
                                    onChange={(e) => setPaymentData({
                                        ...paymentData,
                                        cancellation: { ...paymentData.cancellation, window: e.target.value }
                                    })}
                                />
                                <select
                                    className={styles.selectInput}
                                    style={{ width: '120px' }}
                                    value={paymentData.cancellation.unit}
                                    onChange={(e) => setPaymentData({
                                        ...paymentData,
                                        cancellation: { ...paymentData.cancellation, unit: e.target.value }
                                    })}
                                >
                                    <option value="minutes">Minutes</option>
                                    <option value="hours">Hours</option>
                                    <option value="days">Days</option>
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className={styles.label}>Refund Policy</label>
                            <div className={styles.radioGroup}>
                                <label className={styles.radioOption}>
                                    <input
                                        type="radio"
                                        name="refundType"
                                        checked={paymentData.cancellation.refundType === 'full'}
                                        onChange={() => setPaymentData({
                                            ...paymentData,
                                            cancellation: { ...paymentData.cancellation, refundType: 'full' }
                                        })}
                                    />
                                    <span>Full Refund</span>
                                </label>
                                <label className={styles.radioOption}>
                                    <input
                                        type="radio"
                                        name="refundType"
                                        checked={paymentData.cancellation.refundType === 'partial'}
                                        onChange={() => setPaymentData({
                                            ...paymentData,
                                            cancellation: { ...paymentData.cancellation, refundType: 'partial' }
                                        })}
                                    />
                                    <span>Partial Refund</span>
                                </label>
                                {paymentData.cancellation.refundType === 'partial' && (
                                    <div className={styles.subInputContainer}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <input
                                                type="number"
                                                className={styles.smallInput}
                                                style={{ width: '80px' }}
                                                value={paymentData.cancellation.refundPercentage}
                                                onChange={(e) => setPaymentData({
                                                    ...paymentData,
                                                    cancellation: { ...paymentData.cancellation, refundPercentage: e.target.value }
                                                })}
                                            />
                                            <span style={{ fontSize: '14px', color: '#333' }}>%</span>
                                        </div>
                                    </div>
                                )}
                                <label className={styles.radioOption}>
                                    <input
                                        type="radio"
                                        name="refundType"
                                        checked={paymentData.cancellation.refundType === 'none'}
                                        onChange={() => setPaymentData({
                                            ...paymentData,
                                            cancellation: { ...paymentData.cancellation, refundType: 'none' }
                                        })}
                                    />
                                    <span>No Refund</span>
                                </label>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Reschedule Policy */}
            <div style={{ marginTop: '32px', borderTop: '1px solid #e0e0e0', paddingTop: '24px' }}>
                <div className={styles.paymentHeader}>
                    <div>
                        <h3>Reschedule Policy</h3>
                        <p className={styles.paymentDescription}>
                            Allow invitees to reschedule their booking.
                        </p>
                    </div>
                    <label className={styles.toggleSwitch}>
                        <input
                            type="checkbox"
                            className={styles.toggleInput}
                            checked={paymentData.reschedule.enabled}
                            onChange={(e) => setPaymentData({
                                ...paymentData,
                                reschedule: { ...paymentData.reschedule, enabled: e.target.checked }
                            })}
                        />
                        <span className={styles.toggleSlider}></span>
                    </label>
                </div>

                {paymentData.reschedule.enabled && (
                    <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        <div>
                            <label className={styles.label} style={{ marginBottom: 0 }}>Minimum Reschedule Notice</label>
                            <p style={{ fontSize: '13px', color: '#666', marginBottom: '8px' }}>
                                Invitees can reschedule until this much time before the event start time.
                            </p>
                            <div className={styles.rowInputs}>
                                <input
                                    type="number"
                                    className={styles.smallInput}
                                    value={paymentData.reschedule.window}
                                    onChange={(e) => setPaymentData({
                                        ...paymentData,
                                        reschedule: { ...paymentData.reschedule, window: e.target.value }
                                    })}
                                />
                                <select
                                    className={styles.selectInput}
                                    style={{ width: '120px' }}
                                    value={paymentData.reschedule.unit}
                                    onChange={(e) => setPaymentData({
                                        ...paymentData,
                                        reschedule: { ...paymentData.reschedule, unit: e.target.value }
                                    })}
                                >
                                    <option value="minutes">Minutes</option>
                                    <option value="hours">Hours</option>
                                    <option value="days">Days</option>
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className={styles.label}>Reschedule Fee</label>
                            <div className={styles.radioGroup}>
                                <label className={styles.radioOption}>
                                    <input
                                        type="radio"
                                        name="rescheduleType"
                                        checked={paymentData.reschedule.type === 'free'}
                                        onChange={() => setPaymentData({
                                            ...paymentData,
                                            reschedule: { ...paymentData.reschedule, type: 'free' }
                                        })}
                                    />
                                    <span>Free Rescheduling</span>
                                </label>
                                <label className={styles.radioOption}>
                                    <input
                                        type="radio"
                                        name="rescheduleType"
                                        checked={paymentData.reschedule.type === 'paid'}
                                        onChange={() => setPaymentData({
                                            ...paymentData,
                                            reschedule: { ...paymentData.reschedule, type: 'paid' }
                                        })}
                                    />
                                    <span>Paid Rescheduling</span>
                                </label>
                                {paymentData.reschedule.type === 'paid' && (
                                    <div className={styles.subInputContainer}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <input
                                                type="number"
                                                className={styles.smallInput}
                                                placeholder="Fee Amount"
                                                value={paymentData.reschedule.fee}
                                                onChange={(e) => setPaymentData({
                                                    ...paymentData,
                                                    reschedule: { ...paymentData.reschedule, fee: e.target.value }
                                                })}
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <p className={styles.connectionsLink}>
                Connect with Payment apps to accept payment for bookings : <a href="/settings" className={styles.link}>Go to Connections →</a>
            </p>
            </> /* end acceptPayment */
            )}
        </div>
    );

    return (
        <div className={styles.pageContainer} >
            {/* Header */}
            < header className={styles.header} >
                <div className={styles.headerLeft}>
                    <button className={styles.backButton} onClick={() => navigate('/my-calendar')}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="15 18 9 12 15 6"/>
                        </svg>
                    </button>
                    <div className={styles.titleSection}>
                        <h1>{isEditMode ? 'Edit Calendar' : 'Create Calendar'}</h1>
                        <p>{isEditMode ? 'Update your calendar settings' : 'Configure your new calendar'}</p>
                    </div>
                </div>
                <div className={styles.headerActions}>
                    <button className={styles.actionBtn} onClick={handleCopyLink}>
                        Copy Link
                    </button>
                    <button className={styles.actionBtn} onClick={handlePreview}>
                        Preview
                    </button>
                    <button className={`${styles.actionBtn} ${styles.saveBtn}`} onClick={handleSave}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>
                        </svg>
                        Save Changes
                    </button>
                </div>
            </header >

            <div className={styles.content}>
                {/* Sidebar */}
                <aside className={styles.sidebar}>
                    {navItems.map(item => (
                        <div
                            key={item.id}
                            className={`${styles.navItem} ${activeTab === item.id ? styles.activeNav : ''}`}
                            onClick={() => setActiveTab(item.id)}
                        >
                            <span>{navIcons[item.id]}</span>
                            {item.label}
                        </div>
                    ))}
                </aside>

                {/* Main Content */}
                <main className={styles.mainForm}>
                    {activeTab === 'basic' && renderBasicTab()}
                    {activeTab === 'schedule' && renderScheduleTab()}
                    {activeTab === 'form' && renderFormTab()}
                    {activeTab === 'payment' && renderPaymentTab()}
                </main>
            </div>

            <AddLocationModal
                isOpen={showAddLocationModal}
                onClose={() => setShowAddLocationModal(false)}
                onSelectLocation={handleLocationFromModal}
                isGoogleConnected={isGoogleConnected}
                onConnectGoogle={handleConnectGoogle}
            />
            <AvailabilityModal
                isOpen={showAvailabilityModal}
                onClose={() => { setShowAvailabilityModal(false); fetchAvailability(); }}
            />

        </div >
    );
};

export default CreateEventPage;
