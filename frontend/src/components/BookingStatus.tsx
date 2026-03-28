import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import API_BASE_URL from '../config/api';
import Loader from './Loader';

// This page handles the Cashfree return_url redirect after payment
const BookingStatus: React.FC = () => {
    const [searchParams] = useSearchParams();
    const [status, setStatus] = useState<'loading' | 'success' | 'failed'>('loading');
    const [message, setMessage] = useState('');

    useEffect(() => {
        const orderId = searchParams.get('order_id');
        const calendarId = searchParams.get('calendar_id');
        const startTime = searchParams.get('start_time');
        const clientName = searchParams.get('client_name');
        const clientEmail = searchParams.get('client_email');
        const clientPhone = searchParams.get('client_phone');

        if (!orderId || !calendarId || !startTime || !clientName || !clientEmail) {
            setStatus('failed');
            setMessage('Missing booking information. Please try again.');
            return;
        }

        const confirmBooking = async () => {
            try {
                const response = await fetch(`${API_BASE_URL}/api/bookings/public`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        calendar_id: parseInt(calendarId),
                        start_time: startTime,
                        client_name: clientName,
                        client_email: clientEmail,
                        client_phone: clientPhone || '',
                        cashfree_order_id: orderId,
                    }),
                });

                if (response.ok) {
                    setStatus('success');
                } else {
                    const err = await response.json();
                    setStatus('failed');
                    setMessage(err.error || 'Booking confirmation failed.');
                }
            } catch {
                setStatus('failed');
                setMessage('Network error. Please contact support.');
            }
        };

        confirmBooking();
    }, [searchParams]);

    if (status === 'loading') return <Loader fullScreen />;

    return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f9f9f9' }}>
            <div style={{ background: '#fff', borderRadius: '16px', padding: '48px', textAlign: 'center', maxWidth: '480px', boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
                {status === 'success' ? (
                    <>
                        <div style={{ fontSize: '56px', marginBottom: '16px' }}>🎉</div>
                        <h2 style={{ fontFamily: 'Urbanist', fontWeight: 700, marginBottom: '12px' }}>Booking Confirmed!</h2>
                        <p style={{ color: '#666', fontSize: '15px' }}>Your payment was successful and your session has been booked. A confirmation email will be sent to you shortly.</p>
                    </>
                ) : (
                    <>
                        <div style={{ fontSize: '56px', marginBottom: '16px' }}>❌</div>
                        <h2 style={{ fontFamily: 'Urbanist', fontWeight: 700, marginBottom: '12px' }}>Booking Failed</h2>
                        <p style={{ color: '#666', fontSize: '15px' }}>{message}</p>
                        <button
                            onClick={() => window.history.back()}
                            style={{ marginTop: '24px', padding: '10px 24px', background: '#082421', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontFamily: 'Urbanist', fontWeight: 600 }}
                        >
                            Go Back
                        </button>
                    </>
                )}
            </div>
        </div>
    );
};

export default BookingStatus;
