import React, { useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import API_BASE_URL from '../config/api';
import Loader from './Loader';

interface BookingDetails {
    id: number;
    title: string;
    therapist_name?: string;
    start_time: string;
    duration: number;
    payment_amount: number;
    razorpay_payment_id?: string;
    cashfree_order_id?: string;
}

// This page handles the Cashfree return_url redirect after payment
const BookingStatus: React.FC = () => {
    const [searchParams] = useSearchParams();
    const [status, setStatus] = useState<'loading' | 'success' | 'failed'>('loading');
    const [message, setMessage] = useState('');
    const [booking, setBooking] = useState<BookingDetails | null>(null);
    const hasFired = useRef(false);

    useEffect(() => {
        // Prevent double-fire on StrictMode / re-render
        if (hasFired.current) return;
        hasFired.current = true;

        const orderId = searchParams.get('order_id');
        const calendarId = searchParams.get('calendar_id');
        const startTime = searchParams.get('start_time');
        const clientName = searchParams.get('client_name');
        const clientEmail = searchParams.get('client_email');
        const clientPhone = searchParams.get('client_phone');
        const formResponsesRaw = searchParams.get('form_responses');

        if (!orderId || !calendarId || !startTime || !clientName || !clientEmail) {
            setStatus('failed');
            setMessage('Missing booking information. Please try again.');
            return;
        }

        // Idempotency: if we already confirmed this order in this browser session, show success
        const sessionKey = `booking_confirmed_${orderId}`;
        if (sessionStorage.getItem(sessionKey) === 'true') {
            setStatus('success');
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
                        ...(formResponsesRaw ? (() => { try { return { form_responses: JSON.parse(formResponsesRaw) }; } catch { return {}; } })() : {}),
                    }),
                });

                if (response.ok) {
                    const bookingData = await response.json();
                    setBooking(bookingData);
                    // Mark as confirmed so page refresh doesn't re-create
                    sessionStorage.setItem(sessionKey, 'true');
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
                        <div style={{ fontSize: '56px', marginBottom: '16px' }}>✅</div>
                        <h2 style={{ fontFamily: 'Urbanist', fontWeight: 700, marginBottom: '24px' }}>Payment Successful!</h2>

                        {booking && (
                            <div style={{ textAlign: 'left', background: '#f9f9f9', borderRadius: '12px', padding: '20px', marginBottom: '24px' }}>
                                <div style={{ marginBottom: '16px', borderBottom: '1px solid #e0e0e0', paddingBottom: '16px' }}>
                                    <div style={{ fontSize: '12px', color: '#999', marginBottom: '4px' }}>Session</div>
                                    <div style={{ fontWeight: 600, marginBottom: '8px' }}>{booking.title}</div>
                                    <div style={{ fontSize: '13px', color: '#666' }}>
                                        {new Date(booking.start_time).toLocaleDateString('en-IN', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })}
                                        <br />
                                        {new Date(booking.start_time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })} ({booking.duration} min)
                                    </div>
                                </div>

                                <div style={{ marginBottom: '16px', borderBottom: '1px solid #e0e0e0', paddingBottom: '16px' }}>
                                    <div style={{ fontSize: '12px', color: '#999', marginBottom: '4px' }}>Therapist</div>
                                    <div style={{ fontWeight: 600 }}>{booking.therapist_name || 'Professional'}</div>
                                </div>

                                <div style={{ marginBottom: booking.payment_status === 'Refunded' || booking.payment_status === 'Partial Refund' ? '16px' : '0px' }}>
                                    <div style={{ fontSize: '12px', color: '#999', marginBottom: '4px' }}>Amount Paid</div>
                                    <div style={{ fontSize: '24px', fontWeight: 700, color: '#2e7d32' }}>₹{booking.payment_amount.toFixed(2)}</div>
                                    <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                                        Transaction ID: {booking.razorpay_payment_id || booking.cashfree_order_id || 'N/A'}
                                    </div>
                                </div>

                                {(booking.payment_status === 'Refunded' || booking.payment_status === 'Partial Refund') && (
                                    <div style={{ background: '#fce4ec', border: '1px solid #f8bbd0', borderRadius: '8px', padding: '12px', marginTop: '16px' }}>
                                        <div style={{ fontSize: '12px', color: '#880e4f', fontWeight: 600, marginBottom: '4px' }}>
                                            {booking.payment_status === 'Refunded' ? '💰 Full Refund Processed' : '💰 Partial Refund Processed'}
                                        </div>
                                        <div style={{ fontSize: '12px', color: '#666' }}>
                                            {booking.refund_amount && `₹${parseFloat(booking.refund_amount).toFixed(2)} refunded`}
                                        </div>
                                        <div style={{ fontSize: '11px', color: '#999', marginTop: '4px' }}>
                                            You should see the refund in your account within 3-5 business days.
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        <p style={{ color: '#666', fontSize: '14px', marginBottom: '20px' }}>
                            Confirmation email with receipt has been sent to you. Save this page for your records.
                        </p>
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
