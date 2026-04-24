import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import API_BASE_URL from '../config/api';
import Loader from './Loader';
import InlineCalendar from './InlineCalendar';
import TimeSlotList from './TimeSlotList';
import ConfirmModal from './ConfirmModal';

const ManageBooking: React.FC = () => {
    const { token } = useParams<{ token: string }>();
    const [booking, setBooking] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [view, setView] = useState<'main' | 'reschedule' | 'done'>('main');
    const [doneMessage, setDoneMessage] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [showCancelConfirm, setShowCancelConfirm] = useState(false);

    // Reschedule state
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [selectedSlot, setSelectedSlot] = useState<string | null>(null);

    useEffect(() => {
        fetch(`${API_BASE_URL}/api/bookings/manage/${token}`)
            .then(async r => {
                const data = await r.json();
                if (r.status === 410) {
                    setError('expired');
                } else if (!r.ok) {
                    setError('not_found');
                } else {
                    setBooking(data);
                }
            })
            .catch(() => setError('not_found'))
            .finally(() => setLoading(false));
    }, [token]);

    const handleCancel = async () => {
        setSubmitting(true);
        try {
            const res = await fetch(`${API_BASE_URL}/api/bookings/manage/${token}/cancel`, { method: 'POST' });
            const data = await res.json();
            if (res.ok) {
                setDoneMessage('Your session has been cancelled. A confirmation email has been sent.');
                setView('done');
                setShowCancelConfirm(false);
            } else {
                alert(data.error || 'Failed to cancel.');
            }
        } catch {
            alert('Network error. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleReschedule = async () => {
        if (!selectedSlot) { alert('Please select a new time slot.'); return; }
        setSubmitting(true);
        try {
            const res = await fetch(`${API_BASE_URL}/api/bookings/manage/${token}/reschedule`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ new_start_time: selectedSlot })
            });
            const data = await res.json();
            if (res.ok) {
                setDoneMessage('Your session has been rescheduled. A confirmation email has been sent.');
                setView('done');
            } else {
                alert(data.error || 'Failed to reschedule.');
            }
        } catch {
            alert('Network error. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    const containerStyle: React.CSSProperties = {
        minHeight: '100vh', background: '#f8f9fa', display: 'flex',
        alignItems: 'center', justifyContent: 'center', padding: '24px', fontFamily: 'Urbanist, sans-serif'
    };
    const cardStyle: React.CSSProperties = {
        background: '#fff', borderRadius: '16px', padding: '40px',
        maxWidth: '520px', width: '100%', boxShadow: '0 4px 24px rgba(0,0,0,0.08)'
    };

    if (loading) return <Loader fullScreen />;
    if (error === 'expired') return (
        <div style={containerStyle}>
            <div style={cardStyle}>
                <div style={{ textAlign: 'center', marginBottom: '16px' }}>
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                    </svg>
                </div>
                <h2 style={{ textAlign: 'center', color: '#1a1a1a', marginBottom: '8px' }}>Link Expired</h2>
                <p style={{ textAlign: 'center', color: '#6E6E6E', fontSize: '14px' }}>
                    This booking link has expired. The session has already started or passed.
                </p>
            </div>
        </div>
    );
    if (error) return (
        <div style={containerStyle}>
            <div style={cardStyle}>
                <div style={{ textAlign: 'center', marginBottom: '16px' }}>
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
                    </svg>
                </div>
                <h2 style={{ textAlign: 'center', color: '#1a1a1a', marginBottom: '8px' }}>Booking Not Found</h2>
                <p style={{ textAlign: 'center', color: '#6E6E6E', fontSize: '14px' }}>This booking link is invalid or no longer exists.</p>
            </div>
        </div>
    );

    if (view === 'done') return (
        <div style={containerStyle}>
            <div style={cardStyle}>
                <div style={{ textAlign: 'center', marginBottom: '16px' }}>
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#2D7579" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
                    </svg>
                </div>
                <h2 style={{ textAlign: 'center', color: '#1a1a1a', marginBottom: '8px' }}>Done!</h2>
                <p style={{ textAlign: 'center', color: '#6E6E6E' }}>{doneMessage}</p>
            </div>
        </div>
    );

    const dateStr = new Date(booking.start_time).toLocaleString('en-IN', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
        hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata'
    });

    const isCancelled = booking.status === 'cancelled';
    const isPast = new Date(booking.start_time) < new Date();

    // Derive cancellation policy info
    const cancelPolicy = booking.cancellation_policy;
    const cancelEnabled = !cancelPolicy || cancelPolicy.enabled !== false; // default allow if no policy
    const cancelWindowText = cancelPolicy?.enabled && cancelPolicy?.window
        ? `${cancelPolicy.window} ${cancelPolicy.unit || 'hours'}`
        : null;
    const refundText = cancelPolicy?.enabled
        ? cancelPolicy.refundType === 'full' ? 'Full refund'
            : cancelPolicy.refundType === 'partial' ? `${cancelPolicy.refundPercentage || 50}% refund`
            : 'No refund'
        : null;

    // Check if still within cancellation window
    const timeUntilMs = new Date(booking.start_time).getTime() - Date.now();
    const windowMs = cancelPolicy?.enabled && cancelPolicy?.window
        ? parseInt(cancelPolicy.window) * (cancelPolicy.unit === 'days' ? 86400000 : cancelPolicy.unit === 'hours' ? 3600000 : 60000)
        : 0;
    const withinWindow = windowMs > 0 && timeUntilMs < windowMs;

    const cancelConfirmMessage = [
        'Are you sure you want to cancel this session?',
        refundText ? `Refund policy: ${refundText}.` : null,
        'A confirmation email will be sent to you.',
    ].filter(Boolean).join(' ');

    // Derive reschedule policy info
    const reschedulePolicy = booking.reschedule_policy;
    const rescheduleEnabled = !reschedulePolicy || reschedulePolicy.enabled !== false; // default allow if no policy
    const rescheduleWindowText = reschedulePolicy?.enabled && reschedulePolicy?.window
        ? `${reschedulePolicy.window} ${reschedulePolicy.unit || 'hours'}`
        : null;
    const rescheduleFeeText = reschedulePolicy?.enabled && reschedulePolicy?.type === 'paid' && reschedulePolicy?.fee
        ? `₹${reschedulePolicy.fee} fee`
        : reschedulePolicy?.enabled && reschedulePolicy?.type === 'paid'
            ? 'Paid rescheduling'
            : null;
    const rescheduleWindowMs = reschedulePolicy?.enabled && reschedulePolicy?.window
        ? parseInt(reschedulePolicy.window) * (reschedulePolicy.unit === 'days' ? 86400000 : reschedulePolicy.unit === 'hours' ? 3600000 : 60000)
        : 0;
    const withinRescheduleWindow = rescheduleWindowMs > 0 && timeUntilMs < rescheduleWindowMs;

    if (view === 'reschedule') return (
        <div style={{ ...containerStyle, alignItems: 'flex-start', paddingTop: '40px' }}>
            <div style={{ ...cardStyle, maxWidth: '800px' }}>
                <button onClick={() => setView('main')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', color: '#666', marginBottom: '20px', padding: 0 }}>← Back</button>
                <h2 style={{ margin: '0 0 8px', color: '#082421' }}>Reschedule Session</h2>
                <p style={{ color: '#6E6E6E', fontSize: '14px', marginBottom: '24px' }}>Select a new date and time for <strong>{booking.title}</strong></p>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                    <InlineCalendar selectedDate={selectedDate} onDateSelect={setSelectedDate} />
                    <TimeSlotList
                        calendarId={booking.calendar_id}
                        selectedDate={selectedDate}
                        selectedSlot={selectedSlot}
                        onSlotSelect={setSelectedSlot}
                    />
                </div>

                <button
                    onClick={handleReschedule}
                    disabled={!selectedSlot || submitting}
                    style={{ marginTop: '24px', width: '100%', padding: '14px', background: '#082421', color: '#fff', border: 'none', borderRadius: '10px', fontFamily: 'Urbanist', fontWeight: 700, fontSize: '15px', cursor: (!selectedSlot || submitting) ? 'not-allowed' : 'pointer', opacity: (!selectedSlot || submitting) ? 0.6 : 1 }}>
                    {submitting ? 'Rescheduling...' : 'Confirm Reschedule'}
                </button>
            </div>
        </div>
    );

    return (
        <div style={containerStyle}>
            <div style={cardStyle}>
                <div style={{ textAlign: 'center', marginBottom: '28px' }}>
                    <img src="/mellominds logo 2 1.png" alt="MelloMinds" style={{ height: '36px' }} />
                </div>

                <h2 style={{ margin: '0 0 6px', color: '#082421', fontSize: '22px' }}>Manage Your Booking</h2>
                <p style={{ color: '#6E6E6E', fontSize: '14px', marginBottom: '24px' }}>Hi <strong>{booking.client_name}</strong>, here are your session details.</p>

                <div style={{ background: '#f4fffe', border: '1px solid #b2dfdb', borderRadius: '10px', padding: '20px', marginBottom: '24px' }}>
                    <div style={{ fontWeight: 700, fontSize: '16px', color: '#082421', marginBottom: '8px' }}>{booking.title}</div>
                    <div style={{ fontSize: '14px', color: '#555', marginBottom: '4px' }}>📅 {dateStr}</div>
                    <div style={{ fontSize: '14px', color: '#555', marginBottom: '4px' }}>👨‍⚕️ {booking.therapist_name}</div>
                    {booking.meet_link && <div style={{ fontSize: '14px' }}><a href={booking.meet_link} style={{ color: '#2D7579' }}>🔗 Join Google Meet</a></div>}
                    <div style={{ marginTop: '10px' }}>
                        {(() => {
                            const isPendingNotes = !isCancelled && isPast;
                            const displayStatus = isCancelled ? 'cancelled' : isPendingNotes ? 'pending_notes' : (booking.status || 'scheduled');
                            const bgMap: Record<string, string> = {
                                scheduled:     '#e8f5e9',
                                cancelled:     '#fdecea',
                                completed:     '#e3f2fd',
                                noshow:        '#fff3e0',
                                pending_notes: '#fff8e1',
                            };
                            const colorMap: Record<string, string> = {
                                scheduled:     '#2e7d32',
                                cancelled:     '#c62828',
                                completed:     '#1565c0',
                                noshow:        '#e65100',
                                pending_notes: '#f57f17',
                            };
                            const labelMap: Record<string, string> = {
                                scheduled:     'Scheduled',
                                cancelled:     'Cancelled',
                                completed:     'Completed',
                                noshow:        'No Show',
                                pending_notes: 'Pending Notes',
                            };
                            return (
                                <span style={{
                                    padding: '3px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 600,
                                    background: bgMap[displayStatus] || bgMap.scheduled,
                                    color: colorMap[displayStatus] || colorMap.scheduled,
                                }}>
                                    {labelMap[displayStatus] || displayStatus}
                                </span>
                            );
                        })()}
                    </div>
                </div>

                {isCancelled && (
                    <p style={{ textAlign: 'center', color: '#c62828', fontWeight: 600 }}>This session has been cancelled.</p>
                )}

                {isPast && !isCancelled && (
                    <p style={{ textAlign: 'center', color: '#6E6E6E', fontSize: '14px' }}>This session has already passed.</p>
                )}

                {!isCancelled && !isPast && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {rescheduleEnabled ? (
                            <>
                                {(rescheduleWindowText || rescheduleFeeText) && (
                                    <div style={{ background: '#e8f4fd', border: '1px solid #90caf9', borderRadius: '8px', padding: '10px 14px', fontSize: '13px', color: '#0d47a1', fontFamily: 'Urbanist' }}>
                                        {rescheduleWindowText && <>🔄 Rescheduling must be done at least <strong>{rescheduleWindowText}</strong> before the session.</>}
                                        {rescheduleFeeText && <> A <strong>{rescheduleFeeText}</strong> applies.</>}
                                    </div>
                                )}
                                <button
                                    onClick={() => setView('reschedule')}
                                    style={{ padding: '14px', background: '#082421', color: '#fff', border: 'none', borderRadius: '10px', fontFamily: 'Urbanist', fontWeight: 700, fontSize: '15px', cursor: 'pointer' }}>
                                    Reschedule Session
                                </button>
                            </>
                        ) : (
                            <p style={{ textAlign: 'center', fontSize: '13px', color: '#6E6E6E', fontFamily: 'Urbanist' }}>
                                Rescheduling is not allowed for this session.
                            </p>
                        )}

                        {cancelEnabled ? (
                            <>
                                {/* Show policy info before cancel button */}
                                {cancelWindowText && (
                                    <div style={{ background: '#fff8e1', border: '1px solid #ffe082', borderRadius: '8px', padding: '10px 14px', fontSize: '13px', color: '#7c5c00', fontFamily: 'Urbanist' }}>
                                        ⏱ Cancellations must be made at least <strong>{cancelWindowText}</strong> before the session.
                                        {refundText && <> Refund: <strong>{refundText}</strong>.</>}
                                    </div>
                                )}
                                {withinWindow && (
                                    <div style={{ background: '#fdecea', border: '1px solid #ef9a9a', borderRadius: '8px', padding: '10px 14px', fontSize: '13px', color: '#c62828', fontFamily: 'Urbanist' }}>
                                        ⚠️ You are within the {cancelWindowText} cancellation window. Cancellation is no longer allowed.
                                    </div>
                                )}
                                <button
                                    onClick={() => setShowCancelConfirm(true)}
                                    disabled={submitting || withinWindow}
                                    style={{ padding: '14px', background: '#fff', color: withinWindow ? '#9CA3AF' : '#c62828', border: `1px solid ${withinWindow ? '#e5e7eb' : '#fca5a5'}`, borderRadius: '10px', fontFamily: 'Urbanist', fontWeight: 600, fontSize: '15px', cursor: (submitting || withinWindow) ? 'not-allowed' : 'pointer', opacity: withinWindow ? 0.6 : 1 }}>
                                    Cancel Session
                                </button>
                            </>
                        ) : (
                            <p style={{ textAlign: 'center', fontSize: '13px', color: '#6E6E6E', fontFamily: 'Urbanist' }}>
                                Cancellations are not allowed for this session.
                            </p>
                        )}
                    </div>
                )}

                <p style={{ textAlign: 'center', color: '#9CA3AF', fontSize: '12px', marginTop: '24px' }}>
                    Need help? Contact us at <a href="mailto:mellomindsventure@gmail.com" style={{ color: '#2D7579' }}>mellomindsventure@gmail.com</a>
                </p>
            </div>

            <ConfirmModal
                isOpen={showCancelConfirm}
                title="Cancel Session"
                message={cancelConfirmMessage}
                confirmLabel="Yes, Cancel Session"
                cancelLabel="Keep Session"
                danger
                onConfirm={handleCancel}
                onCancel={() => setShowCancelConfirm(false)}
            />
        </div>
    );
};

export default ManageBooking;
