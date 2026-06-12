import React, { useState, useEffect, useCallback } from 'react';
import { useToast } from '../context/ToastContext';
import API_BASE_URL from '../config/api';
import settingsStyles from '../MySettings.module.css';

interface EmailPreferencesProps {
  onBack: () => void;
}

interface PreferencesState {
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
  payment_confirmation: boolean;
  transfer_request: boolean;
  transfer_status: boolean;
  use_own_email: boolean;
}

const DEFAULT_PREFERENCES: PreferencesState = {
  booking_confirmation: true,
  booking_confirmation_therapist: true,
  cancellation: true,
  reschedule: true,
  session_reminder: true,
  session_reminder_60min: true,
  session_reminder_30min: true,
  activity_notification: true,
  booking_link: true,
  invoice: true,
  payment_confirmation: true,
  transfer_request: true,
  transfer_status: true,
  use_own_email: false,
};

const PREFERENCE_GROUPS = [
  {
    title: 'Booking Notifications',
    preferences: [
      { key: 'booking_confirmation', label: 'Send booking confirmations to clients' },
      { key: 'booking_confirmation_therapist', label: 'Receive new booking notifications' },
    ]
  },
  {
    title: 'Session Management',
    preferences: [
      { key: 'cancellation', label: 'Send cancellation notifications' },
      { key: 'reschedule', label: 'Send reschedule confirmations' },
      { key: 'session_reminder', label: 'Send 24-hour session reminders' },
      { key: 'session_reminder_60min', label: 'Send 1-hour session reminders' },
      { key: 'session_reminder_30min', label: 'Send 30-minute session reminders' },
    ]
  },
  {
    title: 'Activities & Engagement',
    preferences: [
      { key: 'activity_notification', label: 'Send activity suggestions to clients' },
      { key: 'booking_link', label: 'Send booking links to clients' },
    ]
  },
  {
    title: 'Payment & Admin',
    preferences: [
      { key: 'invoice', label: 'Send invoices to clients' },
      { key: 'payment_confirmation', label: 'Send payment confirmations' },
    ]
  },
  {
    title: 'Client Transfers',
    preferences: [
      { key: 'transfer_request', label: 'Receive transfer requests from other therapists' },
      { key: 'transfer_status', label: 'Receive transfer status updates' },
    ]
  },
  {
    title: 'Email Integration',
    preferences: [
      { key: 'use_own_email', label: 'Use my Gmail account to send emails (Team plan only)' },
    ]
  },
];

const EmailPreferences: React.FC<EmailPreferencesProps> = ({ onBack }) => {
  const toast = useToast();
  const [preferences, setPreferences] = useState<PreferencesState>(DEFAULT_PREFERENCES);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchPreferences();
  }, []);

  const fetchPreferences = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE_URL}/api/email-preferences`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setPreferences(prev => ({ ...prev, ...data }));
      } else {
        toast.error('Failed to load email preferences');
      }
    } catch (error) {
      console.error('Error fetching email preferences:', error);
      toast.error('Failed to load preferences. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const handleToggle = useCallback((key: keyof PreferencesState) => {
    setPreferences(prev => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const handleSave = useCallback(async () => {
    try {
      setSaving(true);
      const res = await fetch(`${API_BASE_URL}/api/email-preferences`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(preferences),
      });

      if (res.ok) {
        toast.success('Email preferences saved successfully');
        onBack();
      } else {
        toast.error('Failed to save preferences. Please try again.');
      }
    } catch (error) {
      console.error('Error saving preferences:', error);
      toast.error('Network error. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [preferences, toast, onBack]);

  if (loading) {
    return (
      <div className={settingsStyles.settingsPage}>
        <div className={settingsStyles.pageHeader}>
          <button onClick={onBack} className={settingsStyles.backBtn}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 5l-7 7 7 7" />
            </svg>
          </button>
          <div>
            <h1 className={settingsStyles.pageTitle}>Email Preferences</h1>
            <p className={settingsStyles.pageSubtitle}>Manage which emails you and your clients receive</p>
          </div>
        </div>
        <div style={{ textAlign: 'center', padding: '40px', color: '#6E6E6E' }}>Loading...</div>
      </div>
    );
  }

  return (
    <div className={settingsStyles.settingsPage}>
      <div className={settingsStyles.pageHeader}>
        <button onClick={onBack} className={settingsStyles.backBtn}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 5l-7 7 7 7" />
          </svg>
        </button>
        <div>
          <h1 className={settingsStyles.pageTitle}>Email Preferences</h1>
          <p className={settingsStyles.pageSubtitle}>Manage which emails you and your clients receive</p>
        </div>
      </div>

      {PREFERENCE_GROUPS.map((group, groupIndex) => (
        <div key={groupIndex} style={{ marginBottom: '32px' }}>
          <h2 className={settingsStyles.settingsSection} style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px', color: '#082421' }}>{group.title}</h2>
          {group.preferences.map((pref) => (
            <div key={pref.key} className={settingsStyles.settingCardColumn}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <label style={{ fontFamily: 'Urbanist', fontWeight: '500', fontSize: '14px', color: '#555', cursor: 'pointer', flex: 1 }}>
                  {pref.label}
                </label>
                <div style={{
                  width: '44px', height: '24px', borderRadius: '12px', cursor: 'pointer',
                  background: preferences[pref.key as keyof PreferencesState] ? '#2D7579' : '#ccc',
                  position: 'relative', transition: 'background 0.2s', flexShrink: 0, marginLeft: '16px'
                }}
                  onClick={() => handleToggle(pref.key as keyof PreferencesState)}
                  role="switch"
                  aria-checked={preferences[pref.key as keyof PreferencesState]}
                >
                  <div style={{
                    position: 'absolute', top: '3px',
                    left: preferences[pref.key as keyof PreferencesState] ? '23px' : '3px',
                    width: '18px', height: '18px', borderRadius: '50%',
                    background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                  }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      ))}

      <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '32px' }}>
        <button onClick={onBack} disabled={saving} style={{ padding: '10px 24px', borderRadius: '8px', border: '1px solid #e0e0e0', background: '#fff', fontFamily: 'Urbanist', fontWeight: '600', fontSize: '14px', cursor: 'pointer', color: '#333' }}>
          Cancel
        </button>
        <button onClick={handleSave} disabled={saving} style={{ padding: '10px 24px', borderRadius: '8px', border: 'none', background: '#082421', fontFamily: 'Urbanist', fontWeight: '600', fontSize: '14px', color: '#fff', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1 }}>
          {saving ? 'Saving...' : 'Save Preferences'}
        </button>
      </div>
    </div>
  );
};

export default EmailPreferences;
