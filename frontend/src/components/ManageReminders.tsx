import React, { useEffect, useState } from 'react';
import API_BASE_URL from '../config/api';
import styles from './ManageReminders.module.css';

interface EmailPreferences {
    booking_confirmation: boolean;
    booking_confirmation_therapist: boolean;
    cancellation: boolean;
    reschedule: boolean;
    session_reminder: boolean;
    activity_notification: boolean;
    booking_link: boolean;
    invoice: boolean;
    transfer_request: boolean;
    transfer_status: boolean;
}

const EMAIL_LABELS: { key: keyof EmailPreferences; label: string; description: string }[] = [
    { key: 'booking_confirmation', label: 'Booking Confirmation (Client)', description: 'Sent to client when a new session is booked' },
    { key: 'booking_confirmation_therapist', label: 'Booking Confirmation (You)', description: 'Sent to you when a client books a session' },
    { key: 'cancellation', label: 'Cancellation', description: 'Sent to client and you when a session is cancelled' },
    { key: 'reschedule', label: 'Reschedule', description: 'Sent to client and you when a session is rescheduled' },
    { key: 'session_reminder', label: 'Session Reminder', description: 'Sent to client 24 hours before their session' },
    { key: 'activity_notification', label: 'Activity Notification', description: 'Sent to client when you assign an activity or reminder' },
    { key: 'booking_link', label: 'Booking Link', description: 'Sent to client when you share a booking link' },
    { key: 'invoice', label: 'Invoice', description: 'Sent to client when you send a payment invoice' },
    { key: 'transfer_request', label: 'Transfer Request', description: 'Sent to receiving therapist when you initiate a client transfer' },
    { key: 'transfer_status', label: 'Transfer Status', description: 'Sent when a transfer is approved, rejected, or cancelled' },
];

interface ManageRemindersProps {
    onBack: () => void;
}

const ManageReminders: React.FC<ManageRemindersProps> = ({ onBack }) => {
    const [prefs, setPrefs] = useState<EmailPreferences | null>(null);
    const [saving, setSaving] = useState<keyof EmailPreferences | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetch(`${API_BASE_URL}/api/email-preferences`, { credentials: 'include' })
            .then(r => r.json())
            .then(data => setPrefs(data))
            .catch(() => setError('Failed to load preferences'));
    }, []);

    const toggle = async (key: keyof EmailPreferences) => {
        if (!prefs || saving) return;
        const newVal = !prefs[key];
        setSaving(key);
        setPrefs(p => p ? { ...p, [key]: newVal } : p);
        try {
            const res = await fetch(`${API_BASE_URL}/api/email-preferences`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ [key]: newVal }),
            });
            if (!res.ok) throw new Error();
        } catch {
            // Revert on failure
            setPrefs(p => p ? { ...p, [key]: !newVal } : p);
            setError('Failed to save. Please try again.');
        } finally {
            setSaving(null);
        }
    };

    return (
        <div className={styles.page}>
            <div className={styles.header}>
                <button className={styles.backBtn} onClick={onBack}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M19 12H5M12 5l-7 7 7 7" />
                    </svg>
                </button>
                <div>
                    <h1>Manage Reminders</h1>
                    <p>Control which email notifications are sent from your account</p>
                </div>
            </div>

            {error && <div className={styles.error}>{error}</div>}

            {!prefs ? (
                <div className={styles.loading}>Loading preferences...</div>
            ) : (
                <div className={styles.list}>
                    {EMAIL_LABELS.map(({ key, label, description }) => (
                        <div key={key} className={styles.row}>
                            <div className={styles.rowInfo}>
                                <span className={styles.rowLabel}>{label}</span>
                                <span className={styles.rowDesc}>{description}</span>
                            </div>
                            <button
                                className={`${styles.toggle} ${prefs[key] ? styles.on : styles.off}`}
                                onClick={() => toggle(key)}
                                disabled={saving === key}
                                aria-label={`${prefs[key] ? 'Disable' : 'Enable'} ${label}`}
                            >
                                <span className={styles.thumb} />
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default ManageReminders;
