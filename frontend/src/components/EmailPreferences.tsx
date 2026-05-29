import React, { useState, useEffect, useCallback } from 'react';
import { useToast } from '../context/ToastContext';
import { ChevronLeft } from 'react-iconly';
import API_BASE_URL from '../config/api';
import styles from './EmailPreferences.module.css';

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
    description: 'Emails about session bookings and confirmations',
    preferences: [
      { key: 'booking_confirmation', label: 'Send booking confirmations to clients' },
      { key: 'booking_confirmation_therapist', label: 'Receive new booking notifications' },
    ]
  },
  {
    title: 'Session Management',
    description: 'Emails about cancellations, reschedules, and reminders',
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
    description: 'Emails about activities and client engagement',
    preferences: [
      { key: 'activity_notification', label: 'Send activity suggestions to clients' },
      { key: 'booking_link', label: 'Send booking links to clients' },
    ]
  },
  {
    title: 'Payment & Admin',
    description: 'Emails about payments and administrative notifications',
    preferences: [
      { key: 'invoice', label: 'Send invoices to clients' },
      { key: 'payment_confirmation', label: 'Send payment confirmations' },
    ]
  },
  {
    title: 'Client Transfers',
    description: 'Emails about client transfer requests and status',
    preferences: [
      { key: 'transfer_request', label: 'Receive transfer requests from other therapists' },
      { key: 'transfer_status', label: 'Receive transfer status updates' },
    ]
  },
  {
    title: 'Email Integration',
    description: 'Send emails from your own Gmail account',
    preferences: [
      { key: 'use_own_email', label: 'Use my Gmail account to send emails (Enterprise only)' },
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
      } else if (res.status === 401) {
        toast.error('Session expired. Please log in again.');
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
      } else if (res.status === 400) {
        const error = await res.json();
        toast.error(error.error || 'Invalid preferences provided');
      } else if (res.status === 401) {
        toast.error('Session expired. Please log in again.');
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
      <div className={styles.container}>
        <div className={styles.header}>
          <button onClick={onBack} className={styles.backBtn}>
            <ChevronLeft size={24} primaryColor="#082421" />
          </button>
          <h1>Email Preferences</h1>
        </div>
        <div style={{ textAlign: 'center', padding: '40px', color: '#6E6E6E' }}>Loading...</div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <button onClick={onBack} className={styles.backBtn}>
          <ChevronLeft size={24} primaryColor="#082421" />
        </button>
        <h1>Email Preferences</h1>
      </div>

      <div className={styles.content}>
        <p className={styles.intro}>
          Manage which emails you and your clients receive from MelloMinds. These preferences apply to all sessions and interactions.
        </p>

        {PREFERENCE_GROUPS.map((group, groupIndex) => (
          <div key={groupIndex} className={styles.section}>
            <h2>{group.title}</h2>
            <p className={styles.sectionDesc}>{group.description}</p>

            <div className={styles.preferencesGroup}>
              {group.preferences.map((pref) => (
                <div key={pref.key} className={styles.preferenceItem}>
                  <label className={styles.preferenceLabel}>
                    <input
                      type="checkbox"
                      checked={preferences[pref.key as keyof PreferencesState] || false}
                      onChange={() => handleToggle(pref.key as keyof PreferencesState)}
                      disabled={saving}
                    />
                    <span>{pref.label}</span>
                  </label>
                </div>
              ))}
            </div>
          </div>
        ))}

        <div className={styles.actions}>
          <button onClick={handleSave} disabled={saving} className={styles.saveBtn}>
            {saving ? 'Saving...' : 'Save Preferences'}
          </button>
          <button onClick={onBack} disabled={saving} className={styles.cancelBtn}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default EmailPreferences;
