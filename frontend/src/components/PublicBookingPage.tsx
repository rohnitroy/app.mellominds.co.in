import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import './PublicBookingPage.css';
import InlineCalendar from './InlineCalendar';
import TimeSlotList from './TimeSlotList';
import { useToast } from '../context/ToastContext';
import API_BASE_URL from '../config/api';
import Loader from './Loader';

interface Calendar {
    id: number;
    title: string;
    duration: string;
    description: string;
    slug: string;
    therapist_name: string;
    profile_picture?: string;
    price?: number;
    payment_enabled?: boolean;
    payment_gateway?: string;
    prices?: { amount: number; currency: string; label?: string }[];
    locations?: { type: string; address?: string }[];
    form_data?: { heading?: string; questions: any[] };
}

// Detect user timezone
const userTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

// Format a UTC ISO string into the user's local timezone
function formatInUserTZ(isoString: string, opts: Intl.DateTimeFormatOptions): string {
    return new Intl.DateTimeFormat('en-US', { ...opts, timeZone: userTimeZone }).format(new Date(isoString));
}

// Get a short timezone label like "IST" or "GMT+5:30"
function getTimezoneLabel(): string {
    try {
        const parts = new Intl.DateTimeFormat('en-US', { timeZoneName: 'short', timeZone: userTimeZone })
            .formatToParts(new Date());
        return parts.find(p => p.type === 'timeZoneName')?.value || userTimeZone;
    } catch {
        return userTimeZone;
    }
}

const PublicBookingPage: React.FC = () => {
    const { userId, slug } = useParams<{ userId: string; slug: string }>();
    const toast = useToast();

    // Allow the page to scroll — App.css sets overflow:hidden on html/body for the dashboard
    useEffect(() => {
        document.body.classList.add('pbp-page');
        document.documentElement.classList.add('pbp-page');
        return () => {
            document.body.classList.remove('pbp-page');
            document.documentElement.classList.remove('pbp-page');
        };
    }, []);

    const [calendar, setCalendar] = useState<Calendar | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
    const [step, setStep] = useState<'calendar' | 'details' | 'success'>('calendar');

    const [formData, setFormData] = useState({
        client_name: '',
        client_email: '',
        whatsapp_number: '',
        location: 'google_meet',
    });

    const [formResponses, setFormResponses] = useState<Record<string, any>>({});
    const [termsAccepted, setTermsAccepted] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    // Stored after successful booking to power the confirmation screen
    const [confirmedBooking, setConfirmedBooking] = useState<{
        cancel_token: string;
        start_time: string;
        end_time: string;
        meet_link: string | null;
        location_type: string;
    } | null>(null);

    const tzLabel = getTimezoneLabel();

    useEffect(() => {
        const fetchCalendar = async () => {
            try {
                const response = await fetch(`${API_BASE_URL}/api/calendars/public/${userId}/${slug}`);
                if (response.ok) {
                    const data = await response.json();
                    if (data.form_data?.questions) {
                        const initialResponses: Record<string, any> = {};
                        data.form_data.questions.forEach((q: any) => {
                            initialResponses[q.id] = q.type === 'checkbox' ? [] : '';
                        });
                        setFormResponses(initialResponses);
                    }
                    // Auto-select location based on calendar config
                    if (data.locations?.length > 0) {
                        const hasOnline = data.locations.some((l: any) =>
                            l.type === 'google_meet' || l.type === 'zoom' || l.type === 'online');
                        setFormData(prev => ({ ...prev, location: hasOnline ? 'google_meet' : 'in_person' }));
                    }
                    setCalendar(data);
                } else {
                    setError('Calendar event not found.');
                }
            } catch {
                setError('Failed to load calendar.');
            } finally {
                setLoading(false);
            }
        };
        if (userId && slug) fetchCalendar();
    }, [userId, slug]);

    const handleNext = () => {
        if (selectedDate && selectedSlot) {
            setStep('details');
            window.scrollTo(0, 0);
        }
    };

    const handleDynamicResponseChange = (questionId: string, value: any) => {
        setFormResponses(prev => ({ ...prev, [questionId]: value }));
    };

    const handleCheckboxChange = (questionId: string, option: string, checked: boolean) => {
        setFormResponses(prev => {
            const current = prev[questionId] || [];
            return {
                ...prev,
                [questionId]: checked ? [...current, option] : current.filter((o: string) => o !== option)
            };
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!calendar || !selectedSlot) return;
        if (!termsAccepted) { toast.warning('Please accept the Terms & Conditions.'); return; }

        // Validate required questions
        if (calendar.form_data?.questions) {
            for (const q of calendar.form_data.questions) {
                if (!q.required) continue;
                if (q.key === 'name' && !formData.client_name.trim()) {
                    toast.warning(`Please fill out: ${q.label || 'Name'}`); return;
                }
                if (q.key === 'email' && !formData.client_email.trim()) {
                    toast.warning(`Please fill out: ${q.label || 'Email address'}`); return;
                }
                if ((q.key === 'phone' || q.key === 'whatsapp_number') && !formData.whatsapp_number.trim()) {
                    toast.warning(`Please fill out: ${q.label || 'Phone number'}`); return;
                }
                // Custom questions
                if (!['name', 'email', 'phone', 'whatsapp_number'].includes(q.key)) {
                    const ans = formResponses[String(q.id)];
                    if (ans === undefined || ans === null || ans === '' || (Array.isArray(ans) && ans.length === 0)) {
                        toast.warning(`Please fill out: ${q.label || q.text || 'required field'}`); return;
                    }
                }
            }
        } else {
            // Fallback validation for default fields
            if (!formData.client_name.trim()) { toast.warning('Please enter your name'); return; }
            if (!formData.client_email.trim()) { toast.warning('Please enter your email'); return; }
        }

        setSubmitting(true);
        try {
            // Build form_responses: include all questions keyed by id
            const allFormResponses: Record<string, any> = { ...formResponses };
            // Also include base fields in form_responses so they're stored
            if (calendar.form_data?.questions) {
                calendar.form_data.questions.forEach((q: any) => {
                    if (q.key === 'name') allFormResponses[String(q.id)] = formData.client_name;
                    if (q.key === 'email') allFormResponses[String(q.id)] = formData.client_email;
                    if (q.key === 'whatsapp_number' || q.key === 'phone') allFormResponses[String(q.id)] = formData.whatsapp_number;
                });
            }

            const payload = {
                calendar_id: calendar.id,
                start_time: selectedSlot,
                client_name: formData.client_name,
                client_email: formData.client_email,
                client_phone: formData.whatsapp_number,
                location_type: formData.location,
                form_responses: allFormResponses,
            };

            if (calendar.payment_enabled && calendar.payment_gateway === 'cashfree') {
                const orderRes = await fetch(`${API_BASE_URL}/api/cashfree/create-order`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        calendar_id: calendar.id,
                        client_name: formData.client_name,
                        client_email: formData.client_email,
                        client_phone: formData.whatsapp_number,
                        start_time: selectedSlot,
                    }),
                });
                if (!orderRes.ok) {
                    const err = await orderRes.json();
                    toast.error(`Payment setup failed: ${err.error}`);
                    setSubmitting(false);
                    return;
                }
                const { payment_session_id, environment } = await orderRes.json();
                if (!(window as any).Cashfree) {
                    await new Promise<void>((resolve, reject) => {
                        const script = document.createElement('script');
                        script.src = 'https://sdk.cashfree.com/js/v3/cashfree.js';
                        script.onload = () => resolve();
                        script.onerror = () => reject(new Error('Failed to load Cashfree SDK'));
                        document.head.appendChild(script);
                    });
                }
                const cashfree = (window as any).Cashfree({ mode: environment === 'production' ? 'production' : 'sandbox' });
                cashfree.checkout({ paymentSessionId: payment_session_id, redirectTarget: '_self' });
                return;
            }

            const response = await fetch(`${API_BASE_URL}/api/bookings/public`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (response.ok) {
                const bookingData = await response.json();
                setConfirmedBooking({
                    cancel_token: bookingData.cancel_token,
                    start_time: bookingData.start_time,
                    end_time: bookingData.end_time,
                    meet_link: bookingData.meet_link || null,
                    location_type: bookingData.location_type || formData.location,
                });
                setStep('success');
                window.scrollTo(0, 0);
            } else {
                const err = await response.json();
                toast.error(`Booking failed: ${err.error}`);
            }
        } catch {
            toast.error('Network error. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) return <Loader fullScreen />;
    if (error || !calendar) return <div className="pbp-error">{error || 'Not found'}</div>;

    // Derive available location modes from calendar
    const calLocs = calendar.locations || [];
    const hasOnline = calLocs.length === 0 || calLocs.some((l: any) => l.type === 'google_meet' || l.type === 'zoom' || l.type === 'online');
    const hasInPerson = calLocs.some((l: any) => l.type === 'in_person');
    const inPersonAddress = calLocs.find((l: any) => l.type === 'in_person')?.address || '';
    const showLocationPicker = hasOnline && hasInPerson;

    // Icons (inline SVG, no emojis)
    const ClockIcon = () => (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
        </svg>
    );
    const VideoIcon = () => (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
        </svg>
    );
    const MapPinIcon = () => (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
        </svg>
    );
    const CalendarIcon = () => (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
    );
    const GlobeIcon = () => (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
        </svg>
    );
    const CheckIcon = () => (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"/>
        </svg>
    );
    const ChevronLeftIcon = () => (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
        </svg>
    );

    // Service info panel — shared between calendar and details step
    const ServicePanel = ({ showBack }: { showBack?: boolean }) => (
        <div className="pbp-col-service">
            {showBack && (
                <button className="pbp-back-btn" onClick={() => setStep('calendar')}>
                    <ChevronLeftIcon /> Back
                </button>
            )}
            <div className="pbp-logo">
                <img src="/mellominds logo 2 1.png" alt="MelloMinds" height="32" />
            </div>
            <h1 className="pbp-service-title">{calendar.title}</h1>
            <div className="pbp-therapist">{calendar.therapist_name}</div>
            {calendar.description && <p className="pbp-service-desc">{calendar.description}</p>}
            <div className="pbp-meta">
                <div className="pbp-meta-row"><ClockIcon /><span>{calendar.duration}</span></div>
                {hasOnline && <div className="pbp-meta-row"><VideoIcon /><span>Google Meet</span></div>}
                {hasInPerson && inPersonAddress && <div className="pbp-meta-row"><MapPinIcon /><span>{inPersonAddress}</span></div>}
                {calendar.payment_enabled && calendar.prices?.[0] && (
                    <div className="pbp-meta-row">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
                        </svg>
                        <span>{calendar.prices[0].currency} {calendar.prices[0].amount}</span>
                    </div>
                )}
            </div>
        </div>
    );

    // ── Success screen ──────────────────────────────────────────────────────────
    if (step === 'success') {
        const startISO = confirmedBooking?.start_time || selectedSlot!;
        const endISO = confirmedBooking?.end_time || (() => {
            const dMins = parseInt(calendar.duration) || 60;
            return new Date(new Date(startISO).getTime() + dMins * 60000).toISOString();
        })();
        const meetLink = confirmedBooking?.meet_link;
        const cancelToken = confirmedBooking?.cancel_token;
        const manageUrl = cancelToken ? `/manage-booking/${cancelToken}` : null;
        const locType = confirmedBooking?.location_type || formData.location;

        const dateStr = formatInUserTZ(startISO, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
        const timeStr = formatInUserTZ(startISO, { hour: '2-digit', minute: '2-digit', hour12: true });
        const endTimeStr = formatInUserTZ(endISO, { hour: '2-digit', minute: '2-digit', hour12: true });
        const monthStr = formatInUserTZ(startISO, { month: 'short' }).toUpperCase();
        const dayNum = formatInUserTZ(startISO, { day: 'numeric' });

        // Build Google Calendar "Add to Calendar" URL
        const gcalStart = new Date(startISO).toISOString().replace(/[-:]/g, '').replace('.000', '');
        const gcalEnd = new Date(endISO).toISOString().replace(/[-:]/g, '').replace('.000', '');
        const gcalTitle = encodeURIComponent(`${calendar.title} with ${calendar.therapist_name}`);
        const gcalDetails = encodeURIComponent(meetLink ? `Join Google Meet: ${meetLink}` : (locType === 'in_person' ? `In-person session` : ''));
        const gcalLocation = encodeURIComponent(meetLink || '');
        const gcalUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${gcalTitle}&dates=${gcalStart}/${gcalEnd}&details=${gcalDetails}&location=${gcalLocation}`;

        return (
            <div className="pbp-container">
                <div className="pbp-confirm-card">
                    {/* Header */}
                    <div className="pbp-confirm-header">
                        <div className="pbp-confirm-check">
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="20 6 9 17 4 12"/>
                            </svg>
                        </div>
                        <h2 className="pbp-confirm-title">Booking Confirmed</h2>
                        <p className="pbp-confirm-subtitle">
                            A confirmation email has been sent to <strong>{formData.client_email}</strong>
                        </p>
                    </div>

                    {/* Booking details */}
                    <div className="pbp-confirm-body">
                        <div className="pbp-confirm-detail-row">
                            <div className="pbp-confirm-date-badge">
                                <div className="pbp-slot-month">{monthStr}</div>
                                <div className="pbp-slot-day">{dayNum}</div>
                            </div>
                            <div className="pbp-confirm-info">
                                <div className="pbp-confirm-service">{calendar.title}</div>
                                <div className="pbp-confirm-therapist">with {calendar.therapist_name}</div>
                                <div className="pbp-confirm-time">{timeStr} – {endTimeStr}</div>
                                <div className="pbp-confirm-tz"><GlobeIcon />{tzLabel}</div>
                            </div>
                        </div>

                        <div className="pbp-confirm-meta">
                            <div className="pbp-confirm-meta-item">
                                <ClockIcon />
                                <span>{calendar.duration}</span>
                            </div>
                            {locType === 'in_person' ? (
                                <div className="pbp-confirm-meta-item">
                                    <MapPinIcon />
                                    <span>In-person{inPersonAddress ? ` — ${inPersonAddress}` : ''}</span>
                                </div>
                            ) : (
                                <div className="pbp-confirm-meta-item">
                                    <VideoIcon />
                                    <span>Google Meet</span>
                                </div>
                            )}
                        </div>

                        {/* Meet link */}
                        {meetLink && (
                            <a href={meetLink} target="_blank" rel="noopener noreferrer" className="pbp-meet-btn">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
                                </svg>
                                Join Google Meet
                            </a>
                        )}

                        {/* Add to Calendar */}
                        <a href={gcalUrl} target="_blank" rel="noopener noreferrer" className="pbp-gcal-btn">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                            </svg>
                            Add to Google Calendar
                        </a>

                        {/* Manage actions */}
                        {manageUrl && (
                            <div className="pbp-confirm-manage">
                                <p className="pbp-confirm-manage-label">Need to make changes?</p>
                                <div className="pbp-confirm-manage-btns">
                                    <a href={manageUrl} className="pbp-manage-btn pbp-manage-cancel">
                                        Cancel Booking
                                    </a>
                                    <a href={manageUrl} className="pbp-manage-btn pbp-manage-reschedule">
                                        Reschedule
                                    </a>
                                </div>
                                <p className="pbp-confirm-manage-note">
                                    These options are available until your session starts.
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    // ── Details step ───────────────────────────────────────────────────────────
    if (step === 'details') {
        const slotDate = new Date(selectedSlot!);
        const dateStr = formatInUserTZ(selectedSlot!, { weekday: 'long', day: 'numeric', month: 'long' });
        const timeStr = formatInUserTZ(selectedSlot!, { hour: '2-digit', minute: '2-digit', hour12: true });
        const durationMins = parseInt(calendar.duration) || 60;
        const endISO = new Date(slotDate.getTime() + durationMins * 60000).toISOString();
        const endTimeStr = formatInUserTZ(endISO, { hour: '2-digit', minute: '2-digit', hour12: true });
        const monthStr = formatInUserTZ(selectedSlot!, { month: 'short' }).toUpperCase();
        const dayNum = formatInUserTZ(selectedSlot!, { day: 'numeric' });

        // Keys that map to fixed formData fields (not formResponses)
        const BASE_KEYS = ['name', 'email', 'phone', 'whatsapp_number'];

        // Helper: render a single question field
        const renderQuestion = (q: any) => {
            const label = q.label || q.text || '';
            const qId = String(q.id);
            // Normalize QuestionModal type names
            const qType = q.type === 'textarea' ? 'long_text'
                : q.type === 'tel' ? 'phone'
                : q.type === 'select' ? 'dropdown'
                : q.type;

            // Base fields — bound to formData
            if (q.key === 'name') return (
                <div key={qId} className="pbp-form-group">
                    <label>{label} {q.required && <span className="pbp-required">*</span>}</label>
                    <input type="text" className="pbp-input" required={q.required}
                        value={formData.client_name}
                        onChange={e => setFormData(p => ({ ...p, client_name: e.target.value }))} />
                </div>
            );
            if (q.key === 'email') return (
                <div key={qId} className="pbp-form-group">
                    <label>{label} {q.required && <span className="pbp-required">*</span>}</label>
                    <input type="email" className="pbp-input" required={q.required}
                        value={formData.client_email}
                        onChange={e => setFormData(p => ({ ...p, client_email: e.target.value }))} />
                </div>
            );
            if (q.key === 'phone' || q.key === 'whatsapp_number') return (
                <div key={qId} className="pbp-form-group">
                    <label>{label} {q.required && <span className="pbp-required">*</span>}</label>
                    <div className="pbp-phone-group">
                        <span className="pbp-country-code">+91</span>
                        <input type="tel" className="pbp-input" required={q.required}
                            value={formData.whatsapp_number}
                            onChange={e => setFormData(p => ({ ...p, whatsapp_number: e.target.value }))} />
                    </div>
                </div>
            );

            // Custom questions — bound to formResponses
            return (
                <div key={qId} className="pbp-form-group">
                    <label>{label} {q.required && <span className="pbp-required">*</span>}</label>
                    {(qType === 'text' || qType === 'email' || qType === 'number' || qType === 'date') && (
                        <input type={qType} className="pbp-input" required={q.required}
                            value={formResponses[qId] || ''}
                            onChange={e => handleDynamicResponseChange(qId, e.target.value)} />
                    )}
                    {qType === 'long_text' && (
                        <textarea className="pbp-textarea" rows={3} required={q.required}
                            value={formResponses[qId] || ''}
                            onChange={e => handleDynamicResponseChange(qId, e.target.value)} />
                    )}
                    {qType === 'phone' && (
                        <div className="pbp-phone-group">
                            <span className="pbp-country-code">+91</span>
                            <input type="tel" className="pbp-input" required={q.required}
                                value={formResponses[qId] || ''}
                                onChange={e => handleDynamicResponseChange(qId, e.target.value)} />
                        </div>
                    )}
                    {qType === 'dropdown' && q.options?.length > 0 && (
                        <select className="pbp-input pbp-select" required={q.required}
                            value={formResponses[qId] || ''}
                            onChange={e => handleDynamicResponseChange(qId, e.target.value)}>
                            <option value="">Select an option...</option>
                            {q.options.map((opt: string, i: number) => <option key={i} value={opt}>{opt}</option>)}
                        </select>
                    )}
                    {qType === 'radio' && q.options?.length > 0 && (
                        <div className="pbp-radio-group">
                            {q.options.map((opt: string, i: number) => (
                                <label key={i} className="pbp-radio-label">
                                    <input type="radio" name={`radio-${qId}`} value={opt}
                                        checked={formResponses[qId] === opt} required={q.required}
                                        onChange={e => handleDynamicResponseChange(qId, e.target.value)} />
                                    {opt}
                                </label>
                            ))}
                        </div>
                    )}
                    {qType === 'checkbox' && q.options?.length > 0 && (
                        <div className="pbp-checkbox-group">
                            {q.options.map((opt: string, i: number) => (
                                <label key={i} className="pbp-checkbox-label">
                                    <input type="checkbox"
                                        checked={(formResponses[qId] || []).includes(opt)}
                                        onChange={e => handleCheckboxChange(qId, opt, e.target.checked)} />
                                    {opt}
                                </label>
                            ))}
                        </div>
                    )}
                </div>
            );
        };

        // Fallback questions if calendar has no form_data configured
        const defaultQuestions = [
            { id: 'default_name', key: 'name', type: 'text', label: 'Name', required: true },
            { id: 'default_email', key: 'email', type: 'email', label: 'Email address', required: true },
            { id: 'default_phone', key: 'whatsapp_number', type: 'tel', label: 'WhatsApp Number', required: true },
        ];
        const questions = calendar.form_data?.questions?.length
            ? calendar.form_data.questions
            : defaultQuestions;

        return (
            <div className="pbp-container">
                <div className="pbp-grid pbp-grid-details">
                    <ServicePanel showBack />
                    <div className="pbp-col-details">
                        <form onSubmit={handleSubmit} className="pbp-details-form">
                            <h2 className="pbp-details-heading">{calendar.form_data?.heading || 'Enter Your Details'}</h2>

                            <div className="pbp-slot-summary">
                                <div className="pbp-slot-badge">
                                    <div className="pbp-slot-month">{monthStr}</div>
                                    <div className="pbp-slot-day">{dayNum}</div>
                                </div>
                                <div className="pbp-slot-info">
                                    <div className="pbp-slot-date">{dateStr}</div>
                                    <div className="pbp-slot-time">
                                        {timeStr} – {endTimeStr}
                                        <span className="pbp-tz-badge"><GlobeIcon />{tzLabel}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Render all questions from calendar form_data in order */}
                            {questions.map((q: any) => renderQuestion(q))}

                            {/* Session mode — always show, picker only if multiple modes */}
                            <div className="pbp-form-group">
                                <label>Session Mode {showLocationPicker && <span className="pbp-required">*</span>}</label>
                                {showLocationPicker ? (
                                    <div className="pbp-selection-cards">
                                        <div className={`pbp-selection-card ${formData.location === 'google_meet' ? 'selected' : ''}`}
                                            onClick={() => setFormData(p => ({ ...p, location: 'google_meet' }))}>
                                            <div className="pbp-card-radio">{formData.location === 'google_meet' && <div className="pbp-radio-inner" />}</div>
                                            <div>
                                                <div className="pbp-card-title"><VideoIcon /> Google Meet</div>
                                                <div className="pbp-card-desc">Video call via Google Meet</div>
                                            </div>
                                        </div>
                                        <div className={`pbp-selection-card ${formData.location === 'in_person' ? 'selected' : ''}`}
                                            onClick={() => setFormData(p => ({ ...p, location: 'in_person' }))}>
                                            <div className="pbp-card-radio">{formData.location === 'in_person' && <div className="pbp-radio-inner" />}</div>
                                            <div>
                                                <div className="pbp-card-title"><MapPinIcon /> In-person</div>
                                                {inPersonAddress && <div className="pbp-card-desc">{inPersonAddress}</div>}
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    // Single mode — show as read-only info
                                    <div className="pbp-session-mode-info">
                                        {hasInPerson ? (
                                            <><MapPinIcon /> In-person{inPersonAddress ? ` — ${inPersonAddress}` : ''}</>
                                        ) : (
                                            <><VideoIcon /> Google Meet — Video call</>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Price */}
                            {calendar.payment_enabled && calendar.prices && calendar.prices.length > 0 && (
                                <div className="pbp-form-group">
                                    <label>Session Fee</label>
                                    <div className="pbp-price-row">
                                        {calendar.prices[0].currency} {calendar.prices[0].amount}
                                        {calendar.prices[0].label && <span className="pbp-price-label"> — {calendar.prices[0].label}</span>}
                                    </div>
                                </div>
                            )}

                            {/* Terms */}
                            <div className="pbp-terms-group">
                                <label className="pbp-checkbox-label">
                                    <div className={`pbp-custom-checkbox ${termsAccepted ? 'checked' : ''}`}
                                        onClick={() => setTermsAccepted(!termsAccepted)}>
                                        {termsAccepted && <CheckIcon />}
                                    </div>
                                    <span>I have read and agree to the <a href="/terms-of-service" target="_blank" className="pbp-link">Terms & Conditions</a></span>
                                </label>
                            </div>

                            <div className="pbp-form-actions">
                                <button type="submit" className="pbp-confirm-btn" disabled={submitting}>
                                    <CalendarIcon />
                                    {submitting ? 'Confirming...' : calendar.payment_enabled && calendar.payment_gateway === 'cashfree' ? 'Pay & Confirm' : 'Confirm Booking'}
                                </button>
                                <button type="button" onClick={() => setStep('calendar')} className="pbp-cancel-btn">Cancel</button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        );
    }

    // ── Calendar step (default) ─────────────────────────────────────────────────
    return (
        <div className="pbp-container">
            <div className="pbp-grid">
                <ServicePanel />

                <div className="pbp-col-calendar">
                    <div className="pbp-col-header">
                        <h2>Select a Date & Time</h2>
                        <div className="pbp-tz-pill"><GlobeIcon />{tzLabel}</div>
                    </div>
                    <InlineCalendar selectedDate={selectedDate} onDateSelect={setSelectedDate} />
                </div>

                <div className="pbp-col-slots">
                    <TimeSlotList
                        calendarId={calendar.id}
                        selectedDate={selectedDate}
                        selectedSlot={selectedSlot}
                        onSlotSelect={setSelectedSlot}
                    />
                    {selectedSlot && (
                        <div className="pbp-next-container">
                            <button onClick={handleNext} className="pbp-next-btn">Next</button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default PublicBookingPage;
