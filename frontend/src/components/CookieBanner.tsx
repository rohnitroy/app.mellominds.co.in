import React, { useState, useEffect } from 'react';
import styles from './CookieBanner.module.css';

const COOKIE_CONSENT_KEY = 'cookie_consent';

const CookieBanner: React.FC = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem(COOKIE_CONSENT_KEY);
    if (!consent) setVisible(true);
  }, []);

  const handleAccept = () => {
    localStorage.setItem(COOKIE_CONSENT_KEY, 'accepted');
    setVisible(false);
  };

  const handleDecline = () => {
    localStorage.setItem(COOKIE_CONSENT_KEY, 'declined');
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className={styles.banner} role="dialog" aria-label="Cookie consent">
      <p className={styles.text}>
        We use cookies to keep you logged in and improve your experience.{' '}
        <a href="/privacy-policy" className={styles.link}>Learn more</a>
      </p>
      <div className={styles.actions}>
        <button onClick={handleDecline} className={styles.declineBtn}>Decline</button>
        <button onClick={handleAccept} className={styles.acceptBtn}>Accept</button>
      </div>
    </div>
  );
};

export default CookieBanner;
