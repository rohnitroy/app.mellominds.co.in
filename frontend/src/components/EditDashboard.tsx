import React, { useState, useEffect, useCallback } from 'react';
import styles from './EditDashboard.module.css';
import API_BASE_URL from '../config/api';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import Loader from './Loader';

interface EditDashboardProps {
  onBack: () => void;
}

const ALL_WIDGETS = [
  { key: 'Revenue',          desc: 'Total revenue earned across all sessions' },
  { key: 'Refund',           desc: 'Total refunds issued' },
  { key: 'Sessions',         desc: 'Number of completed sessions' },
  { key: 'Cancelled',        desc: 'Number of cancelled bookings' },
  { key: 'No Show',          desc: 'Clients who did not attend their session' },
  { key: 'Pending Notes',    desc: 'Completed sessions without session notes' },
  { key: 'Pending Payment',  desc: 'Bookings with outstanding payments' },
  { key: 'No of Clients',    desc: 'Total number of clients' },
];

const EditDashboard: React.FC<EditDashboardProps> = ({ onBack }) => {
  const { user } = useAuth();
  const { socket } = useSocket();
  const toast = useToast();
  const isEnterprise = user?.plan_name === 'team';

  const [widgets, setWidgets] = useState<Record<string, boolean>>(
    Object.fromEntries(ALL_WIDGETS.map(w => [w.key, true]))
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchPreferences = useCallback(async () => {
    try {
      const r = await fetch(`${API_BASE_URL}/auth/dashboard-prefs`, { credentials: 'include' });
      if (r.ok) {
        const d = await r.json();
        if (d?.widgets) setWidgets(prev => ({ ...prev, ...d.widgets }));
      } else if (r.status === 403) {
        toast.error('Dashboard customization requires Enterprise plan');
      } else {
        toast.error('Failed to load dashboard preferences');
      }
    } catch (err) {
      toast.error('Failed to load preferences. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (!isEnterprise) {
      setLoading(false);
      return;
    }
    fetchPreferences();
  }, [isEnterprise, fetchPreferences]);

  useEffect(() => {
    if (!socket) return;
    socket.on('dashboard_preferences_updated', fetchPreferences);
    return () => { socket.off('dashboard_preferences_updated', fetchPreferences); };
  }, [socket, fetchPreferences]);

  const handleToggle = useCallback((key: string) => {
    setWidgets(prev => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const handleSave = useCallback(async () => {
    if (!isEnterprise) {
      toast.error('Only Enterprise plan users can customize the dashboard');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE_URL}/auth/dashboard-prefs`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ widgets }),
      });
      if (res.ok) {
        toast.success('Dashboard preferences saved!');
        onBack();
      } else if (res.status === 403) {
        toast.error('Dashboard customization requires Enterprise plan');
      } else {
        toast.error('Failed to save preferences. Please try again.');
      }
    } catch (err) {
      toast.error('Network error. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [widgets, isEnterprise, toast, onBack]);

  if (loading) return <Loader fullScreen />;

  return (
    <div style={{ flex: 1, background: '#f8f9fa', padding: '24px', overflowY: 'auto' }}>
      <div className={styles.header}>
        <div className={styles.headerContent}>
          <button onClick={onBack} className={styles.backBtn}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 5l-7 7 7 7" />
            </svg>
          </button>
          <div>
            <h1 className={styles.title}>Edit Dashboard</h1>
            <p className={styles.subtitle}>Show or hide analytics modules on your dashboard.</p>
          </div>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className={styles.saveBtn}
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      <div className={styles.content}>
        {ALL_WIDGETS.map(({ key, desc }, i) => (
          <div key={key} className={styles.widgetItem}>
            <div className={styles.widgetInfo}>
              <div className={styles.widgetKey}>{key}</div>
              <div className={styles.widgetDesc}>{desc}</div>
            </div>
            <button
              onClick={() => handleToggle(key)}
              className={styles.toggleSwitch}
              data-checked={widgets[key]}
              role="switch"
              aria-checked={widgets[key]}
              aria-label={key}
            >
              <span className={styles.toggleThumb} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default EditDashboard;
