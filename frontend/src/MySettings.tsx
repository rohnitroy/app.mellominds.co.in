import React, { useState, useEffect, useCallback } from 'react';
import styles from './MySettings.module.css';
import { Wallet, Document, Paper, Filter, People, Message } from 'react-iconly';
import { useNavigate } from 'react-router-dom';
import API_BASE_URL from './config/api';
import ConfirmModal from './components/ConfirmModal';
import Loader from './components/Loader';
import { useAuth } from './context/AuthContext';
import { useToast } from './context/ToastContext';

import { useSocket } from './context/SocketContext';
const MySettings: React.FC = () => {
  const { socket } = useSocket();
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();
  const isTeamPlan = user?.plan_name === 'team';
  const isMember = user?.org_role === 'member';
  const isTeamOwner = isTeamPlan && !isMember;

  const [googleConnected, setGoogleConnected] = useState(false);
  const [razorpayConnected, setRazorpayConnected] = useState(false);
  const [showRazorpayForm, setShowRazorpayForm] = useState(false);
  const [razorpayForm, setRazorpayForm] = useState({ key_id: '', key_secret: '' });
  const [razorpayLoading, setRazorpayLoading] = useState(false);
  const [disconnectingRazorpay, setDisconnectingRazorpay] = useState(false);
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
      fetch(`${API_BASE_URL}/api/razorpay/status`, { credentials: 'include' })
        .then(r => r.ok ? r.json() : { connected: false })
        .then(d => { setRazorpayConnected(d.connected); })
        .catch(() => {}),
    ]).finally(() => setIntegrationsLoading(false));

    // Fetch enterprise settings for owners
    if (isTeamOwner) {
      setEnterpriseSettingsLoading(true);
      fetch(`${API_BASE_URL}/auth/team-settings`, { credentials: 'include' })
        .then(r => r.ok ? r.json() : null)
        .then(d => { if (d?.settings) setEnterpriseSettings(s => ({ ...s, ...d.settings })); })
        .catch(() => {})
        .finally(() => setEnterpriseSettingsLoading(false));
    }
  }, []);

  useEffect(() => {
    if (!socket) return;
    socket.on('integrations_updated', () => {
      fetch(`${API_BASE_URL}/api/razorpay/status`, { credentials: 'include' })
        .then(r => r.ok ? r.json() : { connected: false })
        .then(d => { setRazorpayConnected(d.connected); })
        .catch(() => {});
    });
    socket.on('team_settings_updated', () => {
      if (isTeamOwner) {
        fetch(`${API_BASE_URL}/auth/team-settings`, { credentials: 'include' })
          .then(r => r.ok ? r.json() : null)
          .then(d => { if (d?.settings) setEnterpriseSettings(s => ({ ...s, ...d.settings })); })
          .catch(() => {});
      }
    });
    return () => {
      socket.off('integrations_updated');
      socket.off('team_settings_updated');
    };
  }, [socket, isTeamOwner]);

  const handleRazorpayConnect = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setRazorpayLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/razorpay/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(razorpayForm),
      });
      const data = await res.json();
      if (res.ok) {
        setRazorpayConnected(true);
        setShowRazorpayForm(false);
        setRazorpayForm({ key_id: '', key_secret: '' });
        toast.success('Razorpay connected successfully!');
      } else {
        toast.error(data.error || 'Failed to connect Razorpay');
      }
    } catch {
      toast.error('Network error. Please try again.');
    } finally {
      setRazorpayLoading(false);
    }
  }, [toast, razorpayForm]);

  const handleRazorpayDisconnect = useCallback(async () => {
    setDisconnectingRazorpay(true);
    await fetch(`${API_BASE_URL}/api/razorpay/disconnect`, { method: 'DELETE', credentials: 'include' });
    setRazorpayConnected(false);
    setShowRazorpayForm(false);
    setShowDisconnectConfirm(false);
    setDisconnectingRazorpay(false);
  }, []);

  const handleGoogleDisconnect = useCallback(async () => {
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
  }, [toast]);

  const handleEnterpriseToggle = useCallback(async (key: keyof typeof defaultEnterpriseSettings, value: boolean) => {
    const updated = { ...enterpriseSettings, [key]: value };
    setEnterpriseSettings(updated);
    setEnterpriseSettingsSaving(true);
    try {
      const res = await fetch(`${API_BASE_URL}/auth/team-settings`, {
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
  }, [toast]);

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

          <div className={styles.settingCard} style={{ position: 'relative', opacity: isTeamPlan ? 1 : 0.75, cursor: isTeamPlan ? 'pointer' : 'not-allowed' }} onClick={isTeamPlan ? () => navigate('/settings/profile-link') : undefined}>
            {!isTeamPlan && (
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
            <div className={styles.cardContent} style={!isTeamPlan ? { pointerEvents: 'none', userSelect: 'none' } : {}}>
              <h3>
                <People set="bulk" size="medium" primaryColor="#082421" />
                Profile Link & Description
              </h3>
              <p>set a custom URL and add your professional description</p>
            </div>
            <div className={styles.cardArrow} style={!isTeamPlan ? { pointerEvents: 'none' } : {}}>
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

          <div className={styles.settingCard} onClick={() => navigate('/settings/email-preferences')} style={{ cursor: 'pointer' }}>
            <div className={styles.cardContent}>
              <h3>
                <Message set="bulk" size="medium" primaryColor="#082421" />
                Email Preferences
              </h3>
              <p>control which emails you and your clients receive...</p>
            </div>
            <div className={styles.cardArrow}>
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                <path d="M12 24L20 16L12 8" stroke="#2D7579" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>

          <div className={styles.settingCard} style={{ position: 'relative', opacity: isTeamPlan ? 1 : 0.75, cursor: isTeamPlan ? 'pointer' : 'not-allowed' }} onClick={isTeamPlan ? () => navigate('/settings/reminders') : undefined}>
            {!isTeamPlan && (
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
            <div className={styles.cardContent} style={!isTeamPlan ? { pointerEvents: 'none', userSelect: 'none' } : {}}>
              <h3>
                <Filter set="bulk" size="medium" primaryColor="#082421" />
                Manage Reminders
              </h3>
              <p>enable/disable reminders and notifications...</p>
            </div>
            <div className={styles.cardArrow} style={!isTeamPlan ? { pointerEvents: 'none' } : {}}>
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                <path d="M12 24L20 16L12 8" stroke="#2D7579" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>

          <div className={styles.settingCard} style={{ position: 'relative', opacity: isTeamPlan ? 1 : 0.75, cursor: isTeamPlan ? 'pointer' : 'not-allowed' }} onClick={isTeamPlan ? () => navigate('/settings/edit-dashboard') : undefined}>
            {!isTeamPlan && (
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
            <div className={styles.cardContent} style={!isTeamPlan ? { pointerEvents: 'none', userSelect: 'none' } : {}}>
              <h3>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#082421" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
                  <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
                </svg>
                Edit Dashboard
              </h3>
              <p>show or hide analytics modules on your dashboard...</p>
            </div>
            <div className={styles.cardArrow} style={!isTeamPlan ? { pointerEvents: 'none' } : {}}>
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                <path d="M12 24L20 16L12 8" stroke="#2D7579" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>

          {isTeamOwner && (
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
                    Team Control Center
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
          <div className={styles.settingCard} style={{ position: 'relative', opacity: isTeamPlan ? 1 : 0.75 }}>
            {!isTeamPlan && (
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
            <div className={styles.cardContent} style={!isTeamPlan ? { pointerEvents: 'none', userSelect: 'none' } : {}}>
              <h3>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#082421" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '4px' }}>
                  <rect x="2" y="5" width="20" height="14" rx="2" />
                  <line x1="2" y1="10" x2="22" y2="10" />
                </svg>
                Connect Razorpay
              </h3>
              <p>Accept appointment payments via Razorpay payment gateway</p>
              {isTeamPlan ? (
                razorpayConnected ? (
                  <div>
                    <div className={styles.connectedTag}>✓ Connected</div>
                    <button className={styles.connectBtn} style={{ marginTop: '8px', background: '#fee2e2', color: '#dc2626' }} onClick={() => setShowDisconnectConfirm(true)} disabled={disconnectingRazorpay}>{disconnectingRazorpay ? 'Disconnecting...' : 'Disconnect'}</button>
                  </div>
                ) : showRazorpayForm ? (
                  <form onSubmit={handleRazorpayConnect} style={{ marginTop: '8px' }}>
                    <input placeholder="Key ID" value={razorpayForm.key_id} onChange={e => setRazorpayForm(f => ({ ...f, key_id: e.target.value }))} required style={{ display: 'block', marginBottom: '6px', padding: '6px', borderRadius: '6px', border: '1px solid #ccc', width: '100%' }} />
                    <input placeholder="Key Secret" type="password" value={razorpayForm.key_secret} onChange={e => setRazorpayForm(f => ({ ...f, key_secret: e.target.value }))} required style={{ display: 'block', marginBottom: '8px', padding: '6px', borderRadius: '6px', border: '1px solid #ccc', width: '100%' }} />
                    <button type="submit" className={styles.connectBtn} disabled={razorpayLoading}>{razorpayLoading ? 'Connecting...' : 'Save'}</button>
                    <button type="button" className={styles.connectBtn} style={{ marginLeft: '8px', background: '#f3f4f6', color: '#374151' }} onClick={() => setShowRazorpayForm(false)}>Cancel</button>
                  </form>
                ) : (
                  <button className={styles.connectBtn} onClick={() => setShowRazorpayForm(true)}>+ Connect Razorpay</button>
                )
              ) : (
                <button className={styles.connectBtn} disabled style={{ opacity: 0.5, cursor: 'not-allowed' }}>+ Connect Razorpay</button>
              )}
            </div>
          </div>
          )}

        </div>
      </div>
    </div>

    <ConfirmModal
      isOpen={showDisconnectConfirm}
      title="Disconnect Razorpay"
      message="Disconnect Razorpay? Payments will stop working for your calendars that use it."
      confirmLabel={disconnectingRazorpay ? 'Disconnecting...' : 'Disconnect'}
      cancelLabel="Keep Connected"
      danger
      onConfirm={handleRazorpayDisconnect}
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
