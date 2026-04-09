import React, { useState, useEffect } from 'react';
import styles from './MySettings.module.css';
import { Wallet, Document, Paper, Filter, People } from 'react-iconly';
import { useNavigate } from 'react-router-dom';
import API_BASE_URL from './config/api';
import ConfirmModal from './components/ConfirmModal';
import Loader from './components/Loader';
import { useAuth } from './context/AuthContext';
import { useToast } from './context/ToastContext';

const MySettings: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();
  const isEnterprise = user?.plan_name === 'enterprise';

  const [googleConnected, setGoogleConnected] = useState(false);
  const [cashfreeConnected, setCashfreeConnected] = useState(false);
  const [cashfreeEnv, setCashfreeEnv] = useState('sandbox');
  const [showCashfreeForm, setShowCashfreeForm] = useState(false);
  const [cashfreeForm, setCashfreeForm] = useState({ app_id: '', secret_key: '', environment: 'sandbox' });
  const [cashfreeLoading, setCashfreeLoading] = useState(false);
  const [disconnectingCashfree, setDisconnectingCashfree] = useState(false);
  const [disconnectingGoogle, setDisconnectingGoogle] = useState(false);
  const [integrationsLoading, setIntegrationsLoading] = useState(true);
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);
  const [showGoogleDisconnectConfirm, setShowGoogleDisconnectConfirm] = useState(false);

  useEffect(() => {
    // Handle Gmail OAuth redirect result
    const params = new URLSearchParams(window.location.search);
    if (params.get('gmail_connected') === 'true') {
      toast.success('Gmail connected successfully!');
      navigate('/settings/reminders', { replace: true });
    } else if (params.get('gmail_error')) {
      toast.error('Failed to connect Gmail. Please try again.');
      navigate('/settings', { replace: true });
    }

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

    Promise.all([
      checkGoogleStatus(),
      fetch(`${API_BASE_URL}/api/cashfree/status`, { credentials: 'include' })
        .then(r => r.ok ? r.json() : { connected: false })
        .then(d => { setCashfreeConnected(d.connected); if (d.environment) setCashfreeEnv(d.environment); })
        .catch(() => {}),
    ]).finally(() => setIntegrationsLoading(false));
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
    setDisconnectingCashfree(true);
    await fetch(`${API_BASE_URL}/api/cashfree/disconnect`, { method: 'DELETE', credentials: 'include' });
    setCashfreeConnected(false);
    setShowCashfreeForm(false);
    setShowDisconnectConfirm(false);
    setDisconnectingCashfree(false);
  };

  const handleGoogleDisconnect = async () => {
    setDisconnectingGoogle(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/connect-calendar/disconnect`, { method: 'DELETE', credentials: 'include' });
      if (res.ok) {
        setGoogleConnected(false);
        toast.success('Google Calendar disconnected.');
      } else {
        toast.error('Failed to disconnect. Please try again.');
      }
    } catch {
      toast.error('Network error. Please try again.');
    } finally {
      setDisconnectingGoogle(false);
      setShowGoogleDisconnectConfirm(false);
    }
  };

  return (
    <>
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

          <div className={styles.settingCard} style={{ position: 'relative', opacity: isEnterprise ? 1 : 0.75, cursor: isEnterprise ? 'pointer' : 'not-allowed' }} onClick={isEnterprise ? () => navigate('/settings/profile-link') : undefined}>
            {!isEnterprise && (
              <div style={{
                position: 'absolute', inset: 0, borderRadius: '16px',
                zIndex: 2, cursor: 'not-allowed',
                display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end',
                padding: '16px'
              }}>
                <span style={{
                  background: '#F9E141',
                  color: '#082421', fontSize: '11px', fontWeight: 700,
                  padding: '4px 10px', borderRadius: '20px',
                  fontFamily: 'Urbanist', letterSpacing: '0.3px',
                  whiteSpace: 'nowrap'
                }}>
                  ⭐ Upgrade your plan
                </span>
              </div>
            )}
            <div className={styles.cardContent} style={!isEnterprise ? { pointerEvents: 'none', userSelect: 'none' } : {}}>
              <h3>
                <People set="bulk" size="medium" primaryColor="#082421" />
                Profile Link
              </h3>
              <p>customize your profile link & edit your username...</p>
            </div>
            <div className={styles.cardArrow} style={!isEnterprise ? { pointerEvents: 'none' } : {}}>
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

          <div className={styles.settingCard} style={{ position: 'relative', opacity: isEnterprise ? 1 : 0.75, cursor: isEnterprise ? 'pointer' : 'not-allowed' }} onClick={isEnterprise ? () => navigate('/settings/reminders') : undefined}>
            {!isEnterprise && (
              <div style={{
                position: 'absolute', inset: 0, borderRadius: '16px',
                zIndex: 2, cursor: 'not-allowed',
                display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end',
                padding: '16px'
              }}>
                <span style={{
                  background: '#F9E141',
                  color: '#082421', fontSize: '11px', fontWeight: 700,
                  padding: '4px 10px', borderRadius: '20px',
                  fontFamily: 'Urbanist', letterSpacing: '0.3px',
                  whiteSpace: 'nowrap'
                }}>
                  ⭐ Upgrade your plan
                </span>
              </div>
            )}
            <div className={styles.cardContent} style={!isEnterprise ? { pointerEvents: 'none', userSelect: 'none' } : {}}>
              <h3>
                <Filter set="bulk" size="medium" primaryColor="#082421" />
                Manage Reminders
              </h3>
              <p>enable/disable reminders and notifications...</p>
            </div>
            <div className={styles.cardArrow} style={!isEnterprise ? { pointerEvents: 'none' } : {}}>
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
                  disabled={integrationsLoading}
                >
                  {integrationsLoading ? 'Checking...' : '+ Connect Calendar'}
                </button>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                  <div className={styles.connectedTag}>✓ Connected</div>
                  <button
                    className={styles.disconnectBtn}
                    onClick={() => setShowGoogleDisconnectConfirm(true)}
                    disabled={disconnectingGoogle}
                  >
                    {disconnectingGoogle ? 'Disconnecting...' : 'Disconnect'}
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className={styles.settingCard} style={{ position: 'relative', opacity: isEnterprise ? 1 : 0.75 }}>
            {!isEnterprise && (
              <div style={{
                position: 'absolute', inset: 0, borderRadius: '16px',
                zIndex: 2, cursor: 'not-allowed',
                display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end',
                padding: '16px'
              }}>
                <span style={{
                  background: '#F9E141',
                  color: '#082421', fontSize: '11px', fontWeight: 700,
                  padding: '4px 10px', borderRadius: '20px',
                  fontFamily: 'Urbanist', letterSpacing: '0.3px',
                  whiteSpace: 'nowrap'
                }}>
                  ⭐ Upgrade your plan
                </span>
              </div>
            )}
            <div className={styles.cardContent} style={!isEnterprise ? { pointerEvents: 'none', userSelect: 'none' } : {}}>
              <h3>
                <Wallet set="bulk" size="medium" primaryColor="#082421" />
                Connect Cashfree
              </h3>
              <p>Accept appointment payments via Cashfree payment gateway</p>
              {isEnterprise ? (
                cashfreeConnected ? (
                  <div>
                    <div className={styles.connectedTag}>✓ Connected ({cashfreeEnv})</div>
                    <button className={styles.connectBtn} style={{ marginTop: '8px', background: '#fee2e2', color: '#dc2626' }} onClick={() => setShowDisconnectConfirm(true)} disabled={disconnectingCashfree}>{disconnectingCashfree ? 'Disconnecting...' : 'Disconnect'}</button>
                  </div>
                ) : showCashfreeForm ? (
                  <form onSubmit={handleCashfreeConnect} style={{ marginTop: '8px' }}>
                    <input placeholder="App ID" value={cashfreeForm.app_id} onChange={e => setCashfreeForm(f => ({ ...f, app_id: e.target.value }))} required style={{ display: 'block', marginBottom: '6px', padding: '6px', borderRadius: '6px', border: '1px solid #ccc', width: '100%' }} />
                    <input placeholder="Secret Key" value={cashfreeForm.secret_key} onChange={e => setCashfreeForm(f => ({ ...f, secret_key: e.target.value }))} required style={{ display: 'block', marginBottom: '6px', padding: '6px', borderRadius: '6px', border: '1px solid #ccc', width: '100%' }} />
                    <select value={cashfreeForm.environment} onChange={e => setCashfreeForm(f => ({ ...f, environment: e.target.value }))} style={{ display: 'block', marginBottom: '8px', padding: '6px', borderRadius: '6px', border: '1px solid #ccc', width: '100%' }}>
                      <option value="sandbox">Sandbox</option>
                      <option value="production">Production</option>
                    </select>
                    <button type="submit" className={styles.connectBtn} disabled={cashfreeLoading}>{cashfreeLoading ? 'Connecting...' : 'Save'}</button>
                    <button type="button" className={styles.connectBtn} style={{ marginLeft: '8px', background: '#f3f4f6', color: '#374151' }} onClick={() => setShowCashfreeForm(false)}>Cancel</button>
                  </form>
                ) : (
                  <button className={styles.connectBtn} onClick={() => setShowCashfreeForm(true)}>+ Connect Cashfree</button>
                )
              ) : (
                <button className={styles.connectBtn} disabled style={{ opacity: 0.5, cursor: 'not-allowed' }}>+ Connect Cashfree</button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>

    <ConfirmModal
      isOpen={showDisconnectConfirm}
      title="Disconnect Cashfree"
      message="Disconnect Cashfree? Payments will stop working for your calendars that use it."
      confirmLabel={disconnectingCashfree ? 'Disconnecting...' : 'Disconnect'}
      cancelLabel="Keep Connected"
      danger
      onConfirm={handleCashfreeDisconnect}
      onCancel={() => setShowDisconnectConfirm(false)}
    />
    <ConfirmModal
      isOpen={showGoogleDisconnectConfirm}
      title="Disconnect Google Calendar"
      message="Disconnect Google Calendar? New appointments will no longer sync to your Google Calendar."
      confirmLabel={disconnectingGoogle ? 'Disconnecting...' : 'Disconnect'}
      cancelLabel="Keep Connected"
      danger
      onConfirm={handleGoogleDisconnect}
      onCancel={() => setShowGoogleDisconnectConfirm(false)}
    />
    </>
  );
};

export default MySettings;
