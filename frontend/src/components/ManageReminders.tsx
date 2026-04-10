import React, { useEffect, useState } from 'react';
import API_BASE_URL from '../config/api';
import styles from './ManageReminders.module.css';
import Loader from './Loader';
import { useAuth } from '../context/AuthContext';

interface EmailPreferences {
    booking_confirmation: boolean;
    cancellation: boolean;
    reschedule: boolean;
    session_reminder: boolean;
    session_reminder_30min: boolean;
    activity_notification: boolean;
    booking_link: boolean;
    invoice: boolean;
    use_own_email: boolean;
}

const EMAIL_LABELS: { key: keyof Omit<EmailPreferences, 'use_own_email'>; label: string; description: string }[] = [
    { key: 'booking_confirmation', label: 'Booking Confirmation (Client)', description: 'Sent to client when a new session is booked' },
    { key: 'cancellation', label: 'Cancellation', description: 'Sent to client and you when a session is cancelled' },
    { key: 'reschedule', label: 'Reschedule', description: 'Sent to client and you when a session is rescheduled' },
    { key: 'session_reminder', label: 'Session Reminder (24 hours)', description: 'Sent to client 24 hours before their session' },
    { key: 'session_reminder_30min', label: 'Session Reminder (30 minutes)', description: 'Sent to client 30 minutes before their session' },
    { key: 'activity_notification', label: 'Activity Notification', description: 'Sent to client when you assign an activity or reminder' },
    { key: 'booking_link', label: 'Booking Link', description: 'Sent to client when you share a booking link' },
    { key: 'invoice', label: 'Invoice', description: 'Sent to client when you send a payment invoice' },
];

interface GmailStatus {
    connected: boolean;
    gmail_email: string | null;
}

interface ManageRemindersProps {
    onBack: () => void;
}

const ManageReminders: React.FC<ManageRemindersProps> = ({ onBack }) => {
    const { user } = useAuth();
    const isEnterprise = user?.plan_name === 'enterprise';

    const [prefs, setPrefs] = useState<EmailPreferences | null>(null);
    const [saving, setSaving] = useState<keyof EmailPreferences | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [gmailStatus, setGmailStatus] = useState<GmailStatus | null>(null);
    const [gmailLoading, setGmailLoading] = useState(false);

    useEffect(() => {
        fetch(`${API_BASE_URL}/api/email-preferences`, { credentials: 'include' })
            .then(r => r.json())
            .then(data => setPrefs({ use_own_email: false, ...data }))
            .catch(() => setError('Failed to load preferences'));

        if (isEnterprise) {
            fetch(`${API_BASE_URL}/api/gmail/status`, { credentials: 'include' })
                .then(r => r.json())
                .then(setGmailStatus)
                .catch(() => {});
        }
    }, [isEnterprise]);

    const toggle = async (key: keyof EmailPreferences) => {
        if (!prefs || saving) return;
        const newVal = !prefs[key];

        // If enabling use_own_email, Gmail must be connected
        if (key === 'use_own_email' && newVal && !gmailStatus?.connected) {
            setError('Connect your Gmail account first before enabling this option.');
            return;
        }

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
            setPrefs(p => p ? { ...p, [key]: !newVal } : p);
            setError('Failed to save. Please try again.');
        } finally {
            setSaving(null);
        }
    };

    const connectGmail = () => {
        window.location.href = `${API_BASE_URL}/api/gmail/start`;
    };

    const disconnectGmail = async () => {
        setGmailLoading(true);
        try {
            const res = await fetch(`${API_BASE_URL}/api/gmail/disconnect`, {
                method: 'DELETE',
                credentials: 'include',
            });
            if (!res.ok) throw new Error();
            setGmailStatus({ connected: false, gmail_email: null });
            setPrefs(p => p ? { ...p, use_own_email: false } : p);
        } catch {
            setError('Failed to disconnect Gmail.');
        } finally {
            setGmailLoading(false);
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

            {/* Email sender section — enterprise only */}
            {isEnterprise && (
                <div className={styles.senderCard}>
                    <div className={styles.senderHeader}>
                        <div>
                            <span className={styles.senderTitle}>Email Sender</span>
                            <span className={styles.senderDesc}>
                                Choose whether emails are sent from MelloMinds or your own Gmail address
                            </span>
                        </div>
                        <span className={styles.enterpriseBadge}>Enterprise</span>
                    </div>

                    <div className={styles.gmailRow}>
                        <div className={styles.gmailInfo}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className={styles.gmailIcon}>
                                <path d="M20 4H4C2.9 4 2 4.9 2 6v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2z" stroke="currentColor" strokeWidth="1.5"/>
                                <path d="M2 6l10 7 10-7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                            </svg>
                            {gmailStatus?.connected ? (
                                <span className={styles.gmailEmail}>{gmailStatus.gmail_email}</span>
                            ) : (
                                <span className={styles.gmailNotConnected}>No Gmail connected</span>
                            )}
                        </div>
                        {gmailStatus?.connected ? (
                            <button
                                className={styles.disconnectBtn}
                                onClick={disconnectGmail}
                                disabled={gmailLoading}
                            >
                                {gmailLoading ? 'Disconnecting...' : 'Disconnect'}
                            </button>
                        ) : (
                            <button className={styles.connectBtn} onClick={connectGmail}>
                                Connect Gmail
                            </button>
                        )}
                    </div>

                    {gmailStatus?.connected && prefs && (
                        <div className={styles.useOwnEmailRow}>
                            <div className={styles.rowInfo}>
                                <span className={styles.rowLabel}>Send from my Gmail</span>
                                <span className={styles.rowDesc}>
                                    When on, all emails to your clients go out from your Gmail address
                                </span>
                            </div>
                            <button
                                className={`${styles.toggle} ${prefs.use_own_email ? styles.on : styles.off}`}
                                onClick={() => toggle('use_own_email')}
                                disabled={saving === 'use_own_email'}
                                aria-label={`${prefs.use_own_email ? 'Disable' : 'Enable'} send from Gmail`}
                            >
                                <span className={styles.thumb} />
                            </button>
                        </div>
                    )}
                </div>
            )}

            {!prefs ? (
                <Loader />
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
