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
  const isMember = user?.org_role === 'member';
  const isEnterpriseOwner = isEnterprise && !isMember;

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

  const defaultEnterpriseSettings = {
    allow_client_transfers: true,
    require_transfer_approval: false,
  };
  const [enterpriseSettings, setEnterpriseSettings] = useState(defaultEnterpriseSettings);
  const [enterpriseSettingsLoading, setEnterpriseSettingsLoading] = useState(false);
  const [enterpriseSettingsSaving, setEnterpriseSettingsSaving] = useState(false);
  const [controlsExpanded, setControlsExpanded] = useState(true);

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

    // Fetch enterprise settings for owners
    if (isEnterpriseOwner) {
      setEnterpriseSettingsLoading(true);
      fetch(`${API_BASE_URL}/auth/enterprise-settings`, { credentials: 'include' })
        .then(r => r.ok ? r.json() : null)
        .then(d => { if (d?.settings) setEnterpriseSettings(s => ({ ...s, ...d.settings })); })
        .catch(() => {})
        .finally(() => setEnterpriseSettingsLoading(false));
    }
  }, []);  const handleCashfreeConnect = async (e: React.FormEvent) => {
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

  const handleEnterpriseToggle = async (key: keyof typeof defaultEnterpriseSettings, value: boolean) => {
    const updated = { ...enterpriseSettings, [key]: value };
    setEnterpriseSettings(updated);
    setEnterpriseSettingsSaving(true);
    try {
      const res = await fetch(`${API_BASE_URL}/auth/enterprise-settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ [key]: value }),
      });
      if (!res.ok) {
        setEnterpriseSettings(s => ({ ...s, [key]: !value })); // revert
        toast.error('Failed to save setting.');
      }
    } catch {
      setEnterpriseSettings(s => ({ ...s, [key]: !value })); // revert
      toast.error('Network error.');
    } finally {
      setEnterpriseSettingsSaving(false);
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

          <div className={styles.settingCard} style={{ position: 'relative', opacity: isEnterprise ? 1 : 0.75, cursor: isEnterprise ? 'pointer' : 'not-allowed' }} onClick={isEnterprise ? () => navigate('/settings/edit-dashboard') : undefined}>
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
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#082421" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
                  <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
                </svg>
                Edit Dashboard
              </h3>
              <p>show or hide analytics modules on your dashboard...</p>
            </div>
            <div className={styles.cardArrow} style={!isEnterprise ? { pointerEvents: 'none' } : {}}>
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                <path d="M12 24L20 16L12 8" stroke="#2D7579" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>

          {isEnterpriseOwner && (
            <div className={styles.settingCardColumn}>
              {/* Controls Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: controlsExpanded ? '4px' : '0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#082421" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="7" width="20" height="14" rx="2"/>
                    <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
                    <line x1="12" y1="12" x2="12" y2="16"/><line x1="10" y1="14" x2="14" y2="14"/>
                  </svg>
                  <h3 style={{ fontFamily: 'Urbanist', fontWeight: 700, fontSize: '18px', color: '#000', margin: 0 }}>
                    Enterprise Control Center
                    {enterpriseSettingsSaving && <span style={{ fontSize: '12px', color: '#2D7579', fontWeight: 400, marginLeft: '10px' }}>Saving...</span>}
                  </h3>
                </div>
                <button
                  onClick={() => setControlsExpanded(v => !v)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: '#6E6E6E', display: 'flex', alignItems: 'center' }}
                  aria-label={controlsExpanded ? 'Hide controls' : 'Show controls'}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                    style={{ transition: 'transform 0.2s', transform: controlsExpanded ? 'rotate(0deg)' : 'rotate(-90deg)' }}>
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>
              </div>
              {controlsExpanded && (enterpriseSettingsLoading ? (
                <div style={{ color: '#6E6E6E', fontFamily: 'Urbanist', fontSize: '14px', marginTop: '12px' }}>Loading settings...</div>
              ) : (
                <div className={styles.enterpriseToggles}>
                  {([
                    { key: 'allow_client_transfers', label: 'Allow client transfers', desc: 'Therapists can transfer clients to other team members' },
                    { key: 'require_transfer_approval', label: 'Require approval for transfers', desc: 'Only you (the admin) can approve client transfers — members cannot self-approve' },
                  ] as { key: keyof typeof defaultEnterpriseSettings; label: string; desc: string }[]).map(({ key, label, desc }) => (
                    <div key={key} className={styles.toggleRow}>
                      <div className={styles.toggleInfo}>
                        <span className={styles.toggleLabel}>{label}</span>
                        <span className={styles.toggleDesc}>{desc}</span>
                      </div>
                      <button
                        className={`${styles.toggleSwitch} ${enterpriseSettings[key] ? styles.toggleOn : ''}`}
                        onClick={() => handleEnterpriseToggle(key, !enterpriseSettings[key])}
                        disabled={enterpriseSettingsSaving}
                        aria-label={label}
                        role="switch"
                        aria-checked={enterpriseSettings[key]}
                      >
                        <span className={styles.toggleThumb} />
                      </button>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
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

          {!isMember && (
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
          )}
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
