import React, { useState, useEffect, useCallback } from 'react';
import { ArrowLeft } from 'react-iconly';
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
  const isEnterprise = user?.plan_name === 'enterprise';

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
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
            <ArrowLeft size="medium" primaryColor="#000000" />
          </button>
          <div>
            <h1 style={{ fontFamily: 'Urbanist', fontWeight: 700, fontSize: '22px', color: '#000', margin: '0 0 8px 0' }}>Edit Dashboard</h1>
            <p style={{ fontFamily: 'Urbanist', fontWeight: 500, fontSize: '14px', color: '#6E6E6E', margin: 0 }}>Show or hide analytics modules on your dashboard.</p>
          </div>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{ background: '#082421', color: '#fff', border: 'none', borderRadius: '8px', padding: '12px 24px', fontFamily: 'Urbanist', fontWeight: 500, fontSize: '14px', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      {/* Widget list */}
      <div style={{ background: '#fff', borderRadius: '16px', padding: '8px 24px' }}>
        {ALL_WIDGETS.map(({ key, desc }, i) => (
          <div
            key={key}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '18px 0',
              borderBottom: i < ALL_WIDGETS.length - 1 ? '1px solid #f0f0f0' : 'none',
            }}
          >
            <div>
              <div style={{ fontFamily: 'Urbanist', fontWeight: 700, fontSize: '16px', color: '#111', marginBottom: '3px' }}>{key}</div>
              <div style={{ fontFamily: 'Urbanist', fontWeight: 400, fontSize: '13px', color: '#6E6E6E' }}>{desc}</div>
            </div>
            <button
              onClick={() => handleToggle(key)}
              style={{
                position: 'relative', width: '48px', height: '26px', borderRadius: '13px',
                background: widgets[key] ? '#082421' : '#d1d5db',
                border: 'none', cursor: 'pointer', padding: 0,
                transition: 'background 0.2s', flexShrink: 0,
              }}
              role="switch"
              aria-checked={widgets[key]}
              aria-label={key}
            >
              <span style={{
                position: 'absolute', top: '4px',
                left: widgets[key] ? '26px' : '4px',
                width: '18px', height: '18px', borderRadius: '50%',
                background: '#fff', transition: 'left 0.2s',
                boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
              }} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default EditDashboard;
