import React, { useState, useEffect, useCallback } from 'react';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import API_BASE_URL from '../config/api';
import styles from './TeamSettings.module.css';
import { ChevronLeft } from 'react-iconly';

interface EnterpriseSettingsProps {
  onBack: () => void;
}

interface OrgDetails {
  company_name: string;
  company_email: string;
  gst: string;
  street: string;
  city: string;
  pincode: string;
  state: string;
  country: string;
}

interface EnterpriseControlSettings {
  allow_client_transfers: boolean;
  require_transfer_approval: boolean;
}

const EnterpriseSettings: React.FC<EnterpriseSettingsProps> = ({ onBack }) => {
  const { user } = useAuth();
  const { socket } = useSocket();
  const toast = useToast();
  const isEnterprise = user?.plan_name === 'team';
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [orgDetails, setOrgDetails] = useState<OrgDetails>({
    company_name: '',
    company_email: '',
    gst: '',
    street: '',
    city: '',
    pincode: '',
    state: '',
    country: '',
  });
  const [settings, setSettings] = useState<EnterpriseControlSettings>({
    allow_client_transfers: true,
    require_transfer_approval: false,
  });

  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true);
      const [settingsRes, orgRes] = await Promise.all([
        fetch(`${API_BASE_URL}/auth/team-settings`, { credentials: 'include' }),
        fetch(`${API_BASE_URL}/auth/organization`, { credentials: 'include' }),
      ]);

      if (settingsRes.ok) {
        const data = await settingsRes.json();
        setSettings(data.settings);
      } else if (settingsRes.status === 403) {
        toast.error('Enterprise settings require Enterprise plan access');
      } else {
        toast.error('Failed to load enterprise settings');
      }

      if (orgRes.ok) {
        const data = await orgRes.json();
        setOrgDetails(data.organization || orgDetails);
      } else if (orgRes.status === 403) {
        toast.error('Organization details require Enterprise plan access');
      } else {
        toast.error('Failed to load organization details');
      }
    } catch (error) {
      toast.error('Failed to load settings. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [toast, orgDetails]);

  useEffect(() => {
    if (!isEnterprise) {
      setLoading(false);
      return;
    }
    fetchSettings();
  }, [isEnterprise, fetchSettings]);

  useEffect(() => {
    if (!socket) return;
    socket.on('team_settings_updated', fetchSettings);
    socket.on('profile_updated', fetchSettings);
    return () => {
      socket.off('team_settings_updated', fetchSettings);
      socket.off('profile_updated', fetchSettings);
    };
  }, [socket, fetchSettings]);

  const handleOrgDetailsChange = useCallback((field: keyof OrgDetails, value: string) => {
    setOrgDetails(prev => ({ ...prev, [field]: value }));
  }, []);

  const handleSettingChange = useCallback((field: keyof EnterpriseControlSettings, value: boolean) => {
    setSettings(prev => ({ ...prev, [field]: value }));
  }, []);

  const saveOrgDetails = useCallback(async () => {
    if (!isEnterprise) {
      toast.error('Only Enterprise plan users can update organization details');
      return;
    }
    try {
      setSaving(true);
      const res = await fetch(`${API_BASE_URL}/auth/organization`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(orgDetails),
      });

      if (res.ok) {
        toast.success('Organization details saved successfully');
      } else if (res.status === 403) {
        toast.error('Organization details require Enterprise plan access');
      } else {
        const err = await res.json();
        toast.error(err.error || 'Failed to save organization details');
      }
    } catch (error) {
      toast.error('Network error. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [orgDetails, isEnterprise, toast]);

  const saveSettings = useCallback(async () => {
    if (!isEnterprise) {
      toast.error('Only Enterprise plan users can update enterprise settings');
      return;
    }
    try {
      setSaving(true);
      const res = await fetch(`${API_BASE_URL}/auth/team-settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(settings),
      });

      if (res.ok) {
        toast.success('Enterprise settings saved successfully');
      } else if (res.status === 403) {
        toast.error('Enterprise settings require Enterprise plan access');
      } else {
        const err = await res.json();
        toast.error(err.error || 'Failed to save settings');
      }
    } catch (error) {
      toast.error('Network error. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [settings, isEnterprise, toast]);

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <button onClick={onBack} className={styles.backBtn}>
            <ChevronLeft size={24} primaryColor="#082421" />
          </button>
          <h1>Enterprise Settings</h1>
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
        <h1>Enterprise Settings</h1>
      </div>

      <div className={styles.content}>
        {/* Organization Details Section */}
        <div className={styles.section}>
          <h2>Organization Details</h2>
          <p className={styles.sectionDesc}>Update your company information</p>

          <div className={styles.formGrid}>
            <div className={styles.formGroup}>
              <label>Company Name</label>
              <input
                type="text"
                value={orgDetails.company_name}
                onChange={e => handleOrgDetailsChange('company_name', e.target.value)}
                placeholder="Your Company Name"
              />
            </div>

            <div className={styles.formGroup}>
              <label>Company Email</label>
              <input
                type="email"
                value={orgDetails.company_email}
                onChange={e => handleOrgDetailsChange('company_email', e.target.value)}
                placeholder="company@example.com"
              />
            </div>

            <div className={styles.formGroup}>
              <label>GST Number</label>
              <input
                type="text"
                value={orgDetails.gst}
                onChange={e => handleOrgDetailsChange('gst', e.target.value)}
                placeholder="GST Number"
              />
            </div>

            <div className={styles.formGroup}>
              <label>Street Address</label>
              <input
                type="text"
                value={orgDetails.street}
                onChange={e => handleOrgDetailsChange('street', e.target.value)}
                placeholder="Street Address"
              />
            </div>

            <div className={styles.formGroup}>
              <label>City</label>
              <input
                type="text"
                value={orgDetails.city}
                onChange={e => handleOrgDetailsChange('city', e.target.value)}
                placeholder="City"
              />
            </div>

            <div className={styles.formGroup}>
              <label>State</label>
              <input
                type="text"
                value={orgDetails.state}
                onChange={e => handleOrgDetailsChange('state', e.target.value)}
                placeholder="State"
              />
            </div>

            <div className={styles.formGroup}>
              <label>Pincode</label>
              <input
                type="text"
                value={orgDetails.pincode}
                onChange={e => handleOrgDetailsChange('pincode', e.target.value)}
                placeholder="Pincode"
              />
            </div>

            <div className={styles.formGroup}>
              <label>Country</label>
              <input
                type="text"
                value={orgDetails.country}
                onChange={e => handleOrgDetailsChange('country', e.target.value)}
                placeholder="Country"
              />
            </div>
          </div>

          <button onClick={saveOrgDetails} disabled={saving} className={styles.saveBtn}>
            {saving ? 'Saving...' : 'Save Organization Details'}
          </button>
        </div>

        {/* Control Center Section */}
        <div className={styles.section}>
          <h2>Control Center</h2>
          <p className={styles.sectionDesc}>Manage team policies and permissions</p>

          <div className={styles.settingItem}>
            <div className={styles.settingInfo}>
              <h3>Allow Client Transfers</h3>
              <p>Enable team members to transfer clients between therapists</p>
            </div>
            <label className={styles.toggle}>
              <input
                type="checkbox"
                checked={settings.allow_client_transfers}
                onChange={e => handleSettingChange('allow_client_transfers', e.target.checked)}
              />
              <span className={styles.toggleSlider}></span>
            </label>
          </div>

          <div className={styles.settingItem}>
            <div className={styles.settingInfo}>
              <h3>Require Transfer Approval</h3>
              <p>Organization owner must approve all client transfers</p>
            </div>
            <label className={styles.toggle}>
              <input
                type="checkbox"
                checked={settings.require_transfer_approval}
                onChange={e => handleSettingChange('require_transfer_approval', e.target.checked)}
              />
              <span className={styles.toggleSlider}></span>
            </label>
          </div>

          <button onClick={saveSettings} disabled={saving} className={styles.saveBtn}>
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EnterpriseSettings;
