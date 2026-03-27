import React, { useState, useEffect } from 'react';
import styles from './MySettings.module.css';
import MyProfile from './MyProfile';
import { Calendar, Wallet, Document, User, Paper, Filter, People, ArrowRight } from 'react-iconly';
import { useLocation } from 'react-router-dom';
import API_BASE_URL from './config/api';

const MySettings: React.FC = () => {
  const location = useLocation();
  const [activeSection, setActiveSection] = useState<string>(
    location.pathname === '/settings/my-profile' ? 'My Profile' : (location.state?.activeSection || '')
  );
  const [googleConnected, setGoogleConnected] = useState(false);

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
  }, []);

  if (activeSection === 'My Profile') {
    return <MyProfile onBack={() => setActiveSection('')} />;
  }

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

          <div className={styles.settingCard} onClick={() => setActiveSection('My Profile')}>
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

          <div className={styles.settingCard}>
            <div className={styles.cardContent}>
              <h3>
                <Document set="bulk" size="medium" primaryColor="#082421" />
                Client Notes
                <div className={styles.comingSoonTag}>Coming soon</div>
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
                <div className={styles.upgradeTag}>Upgrade your plan</div>
              </h3>
              <p>Cashfree payment integration to accept appointment payment via Cashfree payment gateway</p>
              <button className={styles.connectBtn}>+ Connect Cashfree</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MySettings;