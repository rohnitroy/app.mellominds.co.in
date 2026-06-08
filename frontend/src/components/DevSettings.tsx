import React, { useState, useEffect } from 'react';
import API_BASE_URL from '../config/api';

const DevSettings: React.FC = () => {
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/dev/settings`, {
        credentials: 'include'
      });
      const data = await res.json();
      setSettings(data);
    } catch (err) {
      console.error('Failed to fetch settings:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div style={{ padding: '20px' }}>
      <h1>System Settings</h1>

      <div style={{ background: '#f9f9f9', padding: '20px', borderRadius: '8px', border: '1px solid #e0e0e0', maxWidth: '600px' }}>
        <h2 style={{ fontSize: '18px', margin: '0 0 20px 0' }}>Configuration</h2>

        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>Max Team Seats</label>
          <input type="number" value={settings?.maxTeamSeats || 20} disabled style={{ width: '100%', padding: '8px', border: '1px solid #e0e0e0', borderRadius: '4px' }} />
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>Free Analytics Days Limit</label>
          <input type="number" value={settings?.freeAnalyticsDays || 90} disabled style={{ width: '100%', padding: '8px', border: '1px solid #e0e0e0', borderRadius: '4px' }} />
        </div>

        <h2 style={{ fontSize: '18px', margin: '30px 0 20px 0' }}>Dev Admin Whitelist</h2>
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {settings?.devAdminEmails?.map((email: string) => (
            <li key={email} style={{ padding: '8px 12px', background: '#fff', border: '1px solid #e0e0e0', borderRadius: '4px', marginBottom: '8px' }}>
              {email}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default DevSettings;
