import React, { useState, useEffect } from 'react';
import styles from './MySettings.module.css';
import { Wallet, Document, Paper, Filter, People } from 'react-iconly';
import { useNavigate } from 'react-router-dom';
import API_BASE_URL from './config/api';

const MySettings: React.FC = () => {
  const navigate = useNavigate();

  const [googleConnected, setGoogleConnected] = useState(false);
  const [cashfreeConnected, setCashfreeConnected] = useState(false);
  const [cashfreeEnv, setCashfreeEnv] = useState('sandbox');
  const [showCashfreeForm, setShowCashfreeForm] = useState(false);
  const [cashfreeForm, setCashfreeForm] = useState({ app_id: '', secret_key: '', environment: 'sandbox' });
  const [cashfreeLoading, setCashfreeLoading] = useState(false);

  useEffect(() => {
    const checkGoogleStatus = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/connect-calendar/status`, {
          credentials: 'include'
        });
        if (response.ok) {
          const data = await response.json();
          setGoogleConnected(data.connected);
        }
      } catch (error) {
        console.error('Error checking google status:', error);
      }
    };
    checkGoogleStatus();

    // Check Cashfree status
    fetch(`${API_BASE_URL}/api/cashfree/status`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : { connected: false })
      .then(d => { setCashfreeConnected(d.connected); if (d.environment) setCashfreeEnv(d.environment); })
      .catch(() => {});
  }, []);

  const handleCashfreeConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    setCashfreeLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/cashfree/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(cashfreeForm),
      });
      const data = await res.json();
      if (res.ok) {
        setCashfreeConnected(true);
        setCashfreeEnv(cashfreeForm.environment);
        setShowCashfreeForm(false);
        setCashfreeForm({ app_id: '', secret_key: '', environment: 'sandbox' });
      } else {
        alert(data.error || 'Failed to connect Cashfree');
      }
    } catch {
      alert('Network error. Please try again.');
    } finally {
      setCashfreeLoading(false);
    }
  };

  const handleCashfreeDisconnect = async () => {
    if (!window.confirm('Disconnect Cashfree? Payments will stop working for your calendars.')) return;
    await fetch(`${API_BASE_URL}/api/cashfree/disconnect`, { method: 'DELETE', credentials: 'include' });
    setCashfreeConnected(false);
    setShowCashfreeForm(false);
  };

  return (
    <div className={styles.settingsPage}>
      <div className={styles.settingsHeader}>
        <div>
          <h1>My Settings</h1>
          <p>Welcome to the mello's control center</p>
        </div>
      </div>

      <div className={styles.settingsContent}>
        <div className={styles.settingsSection}>
          <h2>Profile & Customization</h2>

          <div className={styles.settingCard} onClick={() => navigate('/settings/my-profile')} style={{ cursor: 'pointer' }}>
            <div className={styles.cardContent}>
              <h3>
                <Document set="bulk" size="medium" primaryColor="#082421" />
                My Profile
              </h3>
              <p>edit your personal information and preferences...</p>
            </div>
            <div className={styles.cardArrow}>
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                <path d="M12 24L20 16L12 8" stroke="#2D7579" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>

          <div className={styles.settingCard}>
            <div className={styles.cardContent}>
              <h3>
                <People set="bulk" size="medium" primaryColor="#082421" />
                Profile Link
                <div className={styles.upgradeTag}>Upgrade your plan</div>
              </h3>
              <p>customize your profile link & edit your username...</p>
            </div>
            <div className={styles.cardArrow}>
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                <path d="M12 24L20 16L12 8" stroke="#2D7579" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>

          <div className={styles.settingCard}>
            <div className={styles.cardContent}>
              <h3>
                <Paper set="bulk" size="medium" primaryColor="#082421" />
                Clinical Profile
                <div className={styles.comingSoonTag}>Coming soon</div>
              </h3>
              <p>customize client's clinical profile form...</p>
            </div>
            <div className={styles.cardArrow}>
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                <path d="M12 24L20 16L12 8" stroke="#2D7579" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>

          <div className={styles.settingCard} onClick={() => navigate('/settings/client-notes-template')} style={{ cursor: 'pointer' }}>
            <div className={styles.cardContent}>
              <h3>
                <Document set="bulk" size="medium" primaryColor="#082421" />
                Client Notes
              </h3>
              <p>customize client notes form...</p>
            </div>
            <div className={styles.cardArrow}>
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                <path d="M12 24L20 16L12 8" stroke="#2D7579" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>

          <div className={styles.settingCard}>
            <div className={styles.cardContent}>
              <h3>
                <Filter set="bulk" size="medium" primaryColor="#082421" />
                Manage Reminders
              </h3>
              <p>enable/disable reminders and notifications...</p>
              <div className={styles.upgradeTag}>Upgrade your plan</div>
            </div>
            <div className={styles.cardArrow}>
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                <path d="M12 24L20 16L12 8" stroke="#2D7579" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>
        </div>

        <div className={styles.settingsSection}>
          <h2>Integrations & Connections</h2>

          <div className={styles.settingCard}>
            <div className={styles.cardContent}>
              <h3>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <rect x="3" y="6" width="18" height="15" rx="2" fill="#1F2937" />
                  <rect x="3" y="4" width="18" height="4" rx="2" fill="#D1D5DB" />
                  <rect x="7" y="2" width="2" height="4" rx="1" fill="#1F2937" />
                  <rect x="15" y="2" width="2" height="4" rx="1" fill="#1F2937" />
                  <circle cx="8" cy="11" r="1" fill="white" />
                  <circle cx="12" cy="11" r="1" fill="white" />
                  <circle cx="16" cy="11" r="1" fill="white" />
                  <circle cx="8" cy="15" r="1" fill="white" />
                  <circle cx="12" cy="15" r="1" fill="white" />
                  <circle cx="16" cy="15" r="1" fill="white" />
                </svg>
                Connect Calendar
              </h3>
              <p>To connect Gmail and G Suite calendar</p>
              {!googleConnected ? (
                <button
                  className={styles.connectBtn}
                  onClick={() => window.location.href = `${API_BASE_URL}/api/connect-calendar/start`}
                >
                  + Connect Calendar
                </button>
              ) : (
                <div className={styles.connectedTag}>
                  ✓ Connected
                </div>
              )}
            </div>
          </div>

          <div className={styles.settingCard}>
            <div className={styles.cardContent}>
              <h3>
                <Wallet set="bulk" size="medium" primaryColor="#082421" />
                Connect Cashfree
              </h3>
              <p>Accept appointment payments via Cashfree payment gateway</p>
              {cashfreeConnected ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '8px' }}>
                  <div className={styles.connectedTag}>✓ Connected ({cashfreeEnv})</div>
                  <button className={styles.connectBtn} style={{ background: 'none', color: '#dc3545', border: '1px solid #dc3545' }} onClick={handleCashfreeDisconnect}>Disconnect</button>
                </div>
              ) : showCashfreeForm ? (
                <form onSubmit={handleCashfreeConnect} style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <select
                    value={cashfreeForm.environment}
                    onChange={e => setCashfreeForm({ ...cashfreeForm, environment: e.target.value })}
                    style={{ padding: '8px', borderRadius: '6px', border: '1px solid #ddd', fontSize: '13px' }}
                  >
                    <option value="sandbox">Sandbox (Testing)</option>
                    <option value="production">Production (Live)</option>
                  </select>
                  <input
                    required
                    type="text"
                    placeholder="App ID"
                    value={cashfreeForm.app_id}
                    onChange={e => setCashfreeForm({ ...cashfreeForm, app_id: e.target.value })}
                    style={{ padding: '8px', borderRadius: '6px', border: '1px solid #ddd', fontSize: '13px' }}
                  />
                  <input
                    required
                    type="password"
                    placeholder="Secret Key"
                    value={cashfreeForm.secret_key}
                    onChange={e => setCashfreeForm({ ...cashfreeForm, secret_key: e.target.value })}
                    style={{ padding: '8px', borderRadius: '6px', border: '1px solid #ddd', fontSize: '13px' }}
                  />
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button type="submit" className={styles.connectBtn} disabled={cashfreeLoading}>
                      {cashfreeLoading ? 'Verifying...' : 'Save & Connect'}
                    </button>
                    <button type="button" className={styles.connectBtn} style={{ background: 'none', color: '#666', border: '1px solid #ddd' }} onClick={() => setShowCashfreeForm(false)}>Cancel</button>
                  </div>
                </form>
              ) : (
                <button className={styles.connectBtn} onClick={() => setShowCashfreeForm(true)}>+ Connect Cashfree</button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MySettings;
