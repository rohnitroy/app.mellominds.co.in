import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import API_BASE_URL from '../config/api';
import Loader from './Loader';
import InlineCalendar from './InlineCalendar';
import TimeSlotList from './TimeSlotList';

const ManageBooking: React.FC = () => {
    const { token } = useParams<{ token: string }>();
    const [booking, setBooking] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [view, setView] = useState<'main' | 'reschedule' | 'done'>('main');
    const [doneMessage, setDoneMessage] = useState('');
    const [submitting, setSubmitting] = useState(false);

    // Reschedule state
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [selectedSlot, setSelectedSlot] = useState<string | null>(null);

    useEffect(() => {
        fetch(`${API_BASE_URL}/api/bookings/manage/${token}`)
            .then(r => r.ok ? r.json() : Promise.reject('not found'))
            .then(data => setBooking(data))
            .catch(() => setError('Booking not found or link has expired.'))
            .finally(() => setLoading(false));
    }, [token]);

    const handleCancel = async () => {
        if (!window.confirm('Are you sure you want to cancel this session?')) return;
        setSubmitting(true);
        try {
            const res = await fetch(`${API_BASE_URL}/api/bookings/manage/${token}/cancel`, { method: 'POST' });
            const data = await res.json();
            if (res.ok) {
                setDoneMessage('Your session has been cancelled. A confirmation email has been sent.');
                setView('done');
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
    if (error) return (
        <div style={containerStyle}>
            <div style={cardStyle}>
                <div style={{ fontSize: '48px', textAlign: 'center', marginBottom: '16px' }}>❌</div>
                <h2 style={{ textAlign: 'center', color: '#1a1a1a' }}>Link Not Found</h2>
                <p style={{ textAlign: 'center', color: '#6E6E6E' }}>{error}</p>
            </div>
        </div>
    );

    if (view === 'done') return (
        <div style={containerStyle}>
            <div style={cardStyle}>
                <div style={{ fontSize: '48px', textAlign: 'center', marginBottom: '16px' }}>✅</div>
                <h2 style={{ textAlign: 'center', color: '#1a1a1a' }}>Done!</h2>
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
                        <span style={{
                            padding: '3px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 600,
                            background: isCancelled ? '#fdecea' : '#e8f5e9',
                            color: isCancelled ? '#c62828' : '#2e7d32'
                        }}>
                            {booking.status || 'Scheduled'}
                        </span>
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
                        <button
                            onClick={() => setView('reschedule')}
                            style={{ padding: '14px', background: '#082421', color: '#fff', border: 'none', borderRadius: '10px', fontFamily: 'Urbanist', fontWeight: 700, fontSize: '15px', cursor: 'pointer' }}>
                            Reschedule Session
                        </button>
                        <button
                            onClick={handleCancel}
                            disabled={submitting}
                            style={{ padding: '14px', background: '#fff', color: '#c62828', border: '1px solid #fca5a5', borderRadius: '10px', fontFamily: 'Urbanist', fontWeight: 600, fontSize: '15px', cursor: submitting ? 'not-allowed' : 'pointer' }}>
                            {submitting ? 'Cancelling...' : 'Cancel Session'}
                        </button>
                    </div>
                )}

                <p style={{ textAlign: 'center', color: '#9CA3AF', fontSize: '12px', marginTop: '24px' }}>
                    Need help? Contact us at <a href="mailto:mellomindsventure@gmail.com" style={{ color: '#2D7579' }}>mellomindsventure@gmail.com</a>
                </p>
            </div>
        </div>
    );
};

export default ManageBooking;
