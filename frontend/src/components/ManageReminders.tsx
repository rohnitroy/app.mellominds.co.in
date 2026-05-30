import React, { useEffect, useState, useCallback } from 'react';
import API_BASE_URL from '../config/api';
import Loader from './Loader';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { useToast } from '../context/ToastContext';
import { ChevronLeft } from 'react-iconly';
import settingsStyles from '../MySettings.module.css';

interface EmailPreferences {
    booking_confirmation: boolean;
    booking_confirmation_therapist: boolean;
    cancellation: boolean;
    reschedule: boolean;
    session_reminder: boolean;
    session_reminder_60min: boolean;
    session_reminder_30min: boolean;
    activity_notification: boolean;
    booking_link: boolean;
    invoice: boolean;
    transfer_request: boolean;
    transfer_status: boolean;
    use_own_email: boolean;
}

const EMAIL_LABELS: { key: keyof Omit<EmailPreferences, 'use_own_email'>; label: string }[] = [
    { key: 'booking_confirmation', label: 'Send booking confirmations to clients' },
    { key: 'booking_confirmation_therapist', label: 'Receive new booking notifications' },
    { key: 'cancellation', label: 'Send cancellation notifications' },
    { key: 'reschedule', label: 'Send reschedule confirmations' },
    { key: 'session_reminder', label: 'Send 24-hour session reminders' },
    { key: 'session_reminder_60min', label: 'Send 1-hour session reminders' },
    { key: 'session_reminder_30min', label: 'Send 30-minute session reminders' },
    { key: 'activity_notification', label: 'Send activity suggestions to clients' },
    { key: 'booking_link', label: 'Send booking links to clients' },
    { key: 'invoice', label: 'Send invoices to clients' },
    { key: 'transfer_request', label: 'Receive transfer requests from other therapists' },
    { key: 'transfer_status', label: 'Receive transfer status updates' },
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
    const { socket } = useSocket();
    const toast = useToast();
    const isEnterprise = user?.plan_name === 'enterprise';

    const [prefs, setPrefs] = useState<EmailPreferences | null>(null);
    const [saving, setSaving] = useState<keyof EmailPreferences | null>(null);
    const [gmailStatus, setGmailStatus] = useState<GmailStatus | null>(null);
    const [gmailLoading, setGmailLoading] = useState(false);

    const fetchPreferences = useCallback(async () => {
        try {
            const r = await fetch(`${API_BASE_URL}/api/email-preferences`, { credentials: 'include' });
            const data = await r.json();
            setPrefs({ use_own_email: false, ...data });
        } catch {
            toast.error('Failed to load preferences');
        }
    }, [toast]);

    const fetchGmailStatus = useCallback(async () => {
        if (!isEnterprise) return;
        try {
            const r = await fetch(`${API_BASE_URL}/api/gmail/status`, { credentials: 'include' });
            const data = await r.json();
            setGmailStatus(data);
        } catch (err) {
            console.error('Failed to load Gmail status:', err);
        }
    }, [isEnterprise, toast]);

    useEffect(() => {
        fetchPreferences();
        fetchGmailStatus();
    }, [fetchPreferences, fetchGmailStatus]);

    useEffect(() => {
        if (!socket) return;
        socket.on('email_preferences_updated', fetchPreferences);
        socket.on('gmail_status_updated', fetchGmailStatus);
        return () => {
            socket.off('email_preferences_updated', fetchPreferences);
            socket.off('gmail_status_updated', fetchGmailStatus);
        };
    }, [socket, fetchPreferences, fetchGmailStatus]);

    const toggle = useCallback(async (key: keyof EmailPreferences) => {
        if (!prefs || saving) return;
        const newVal = !prefs[key];

        if (key === 'use_own_email' && newVal && !gmailStatus?.connected) {
            toast.error('Connect your Gmail account first before enabling this option.');
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
            toast.success('Preference updated');
        } catch {
            setPrefs(p => p ? { ...p, [key]: !newVal } : p);
            toast.error('Failed to save. Please try again.');
        } finally {
            setSaving(null);
        }
    }, [prefs, saving, gmailStatus?.connected, toast]);

    const connectGmail = useCallback(() => {
        window.location.href = `${API_BASE_URL}/api/gmail/start`;
    }, []);

    const disconnectGmail = useCallback(async () => {
        setGmailLoading(true);
        try {
            const res = await fetch(`${API_BASE_URL}/api/gmail/disconnect`, {
                method: 'DELETE',
                credentials: 'include',
            });
            if (!res.ok) throw new Error();
            setGmailStatus({ connected: false, gmail_email: null });
            setPrefs(p => p ? { ...p, use_own_email: false } : p);
            toast.success('Gmail disconnected successfully');
        } catch {
            toast.error('Failed to disconnect Gmail.');
        } finally {
            setGmailLoading(false);
        }
    }, [toast]);

    if (!prefs) {
        return (
            <div className={settingsStyles.settingsPage}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '32px' }}>
                    <button onClick={onBack} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                        <ChevronLeft size={24} primaryColor="#082421" />
                    </button>
                    <div>
                        <h1 className={settingsStyles.settingsHeader}>Manage Reminders</h1>
                        <p style={{ fontSize: '16px', fontWeight: '500', color: '#6E6E6E', margin: '8px 0 0 0' }}>Control which email notifications are sent</p>
                    </div>
                </div>
                <div style={{ textAlign: 'center', padding: '40px' }}><Loader /></div>
            </div>
        );
    }

    return (
        <div className={settingsStyles.settingsPage}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '32px' }}>
                <button onClick={onBack} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                    <ChevronLeft size={24} primaryColor="#082421" />
                </button>
                <div>
                    <h1 className={settingsStyles.settingsHeader}>Manage Reminders</h1>
                    <p style={{ fontSize: '16px', fontWeight: '500', color: '#6E6E6E', margin: '8px 0 0 0' }}>Control which email notifications are sent</p>
                </div>
            </div>

            {/* Gmail Section */}
            {isEnterprise && (
                <div style={{ marginBottom: '32px' }}>
                    <h2 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px', color: '#082421' }}>Email Sender</h2>
                    <div className={settingsStyles.settingCardColumn}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontSize: '14px', fontWeight: '600', color: '#333', marginBottom: '4px' }}>Gmail Integration</div>
                                <div style={{ fontSize: '13px', color: '#888' }}>
                                    {gmailStatus?.connected ? `Connected: ${gmailStatus.gmail_email}` : 'Choose whether emails are sent from MelloMinds or your own Gmail'}
                                </div>
                            </div>
                            {gmailStatus?.connected ? (
                                <button
                                    onClick={disconnectGmail}
                                    disabled={gmailLoading}
                                    style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #dc3545', background: '#fff', color: '#dc3545', fontFamily: 'Urbanist', fontWeight: '600', fontSize: '13px', cursor: gmailLoading ? 'not-allowed' : 'pointer', opacity: gmailLoading ? 0.6 : 1 }}
                                >
                                    {gmailLoading ? 'Disconnecting...' : 'Disconnect'}
                                </button>
                            ) : (
                                <button
                                    onClick={connectGmail}
                                    style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', background: '#082421', color: '#fff', fontFamily: 'Urbanist', fontWeight: '600', fontSize: '13px', cursor: 'pointer' }}
                                >
                                    Connect Gmail
                                </button>
                            )}
                        </div>
                    </div>

                    {gmailStatus?.connected && (
                        <div className={settingsStyles.settingCardColumn} style={{ marginTop: '12px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <label style={{ fontFamily: 'Urbanist', fontWeight: '500', fontSize: '14px', color: '#555', cursor: 'pointer', flex: 1 }}>
                                    Send from my Gmail account
                                </label>
                                <div style={{
                                    width: '44px', height: '24px', borderRadius: '12px', cursor: 'pointer',
                                    background: prefs.use_own_email ? '#2D7579' : '#ccc',
                                    position: 'relative', transition: 'background 0.2s', flexShrink: 0, marginLeft: '16px'
                                }}
                                    onClick={() => toggle('use_own_email')}
                                    role="switch"
                                    aria-checked={prefs.use_own_email}
                                >
                                    <div style={{
                                        position: 'absolute', top: '3px',
                                        left: prefs.use_own_email ? '23px' : '3px',
                                        width: '18px', height: '18px', borderRadius: '50%',
                                        background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                                    }} />
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Notification Reminders */}
            <div>
                <h2 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px', color: '#082421' }}>Notification Reminders</h2>
                {EMAIL_LABELS.map(({ key, label }) => (
                    <div key={key} className={settingsStyles.settingCardColumn}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <label style={{ fontFamily: 'Urbanist', fontWeight: '500', fontSize: '14px', color: '#555', cursor: 'pointer', flex: 1 }}>
                                {label}
                            </label>
                            <div style={{
                                width: '44px', height: '24px', borderRadius: '12px', cursor: 'pointer',
                                background: prefs[key] ? '#2D7579' : '#ccc',
                                position: 'relative', transition: 'background 0.2s', flexShrink: 0, marginLeft: '16px'
                            }}
                                onClick={() => toggle(key)}
                                role="switch"
                                aria-checked={prefs[key]}
                            >
                                <div style={{
                                    position: 'absolute', top: '3px',
                                    left: prefs[key] ? '23px' : '3px',
                                    width: '18px', height: '18px', borderRadius: '50%',
                                    background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                                }} />
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default ManageReminders;
