import React, { useState, useEffect } from 'react';
import styles from './SendBookingLinkModal.module.css';
import API_BASE_URL from '../config/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

interface SendBookingLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Calendar {
  id: number;
  title: string;
  slug: string;
}

const SendBookingLinkModal: React.FC<SendBookingLinkModalProps> = ({ isOpen, onClose }) => {
  const { user } = useAuth();
  const toast = useToast();
  const [calendars, setCalendars] = useState<Calendar[]>([]);
  const [selectedCalendarId, setSelectedCalendarId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    fetch(`${API_BASE_URL}/api/calendars`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : [])
      .then(data => {
        setCalendars(data);
        if (data.length > 0) setSelectedCalendarId(String(data[0].id));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [isOpen]);

  const selectedCalendar = calendars.find(c => String(c.id) === selectedCalendarId);
  const bookingLink = selectedCalendar && user
    ? `${window.location.origin}/book/${user.id}/${selectedCalendar.slug?.replace(/^\//, '')}`
    : '';

  const handleCopy = () => {
    if (!bookingLink) return;
    navigator.clipboard.writeText(bookingLink).then(() => {
      setCopied(true);
      toast.success('Booking link copied!');
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleWhatsApp = () => {
    if (!bookingLink) return;
    const msg = encodeURIComponent(`Hi! You can book a session with me here: ${bookingLink}`);
    window.open(`https://wa.me/?text=${msg}`, '_blank');
  };

  if (!isOpen) return null;

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <div className={styles.modalTitle}>
            <img src="/Send.svg" alt="Send" className={styles.sendIcon} />
            Send Booking Link
          </div>
          <button className={styles.closeButton} onClick={onClose}>✕</button>
        </div>

        <div className={styles.modalBody}>
          {loading ? (
            <p style={{ color: '#6E6E6E', fontSize: '14px' }}>Loading calendars...</p>
          ) : calendars.length === 0 ? (
            <p style={{ color: '#6E6E6E', fontSize: '14px' }}>No calendars found. Create a calendar first to generate a booking link.</p>
          ) : (
            <>
              <div className={styles.formGroup}>
                <label className={styles.label}>Select Calendar / Service</label>
                <select
                  className={styles.input}
                  value={selectedCalendarId}
                  onChange={e => setSelectedCalendarId(e.target.value)}
                >
                  {calendars.map(c => (
                    <option key={c.id} value={c.id}>{c.title}</option>
                  ))}
                </select>
              </div>

              {bookingLink && (
                <div className={styles.formGroup}>
                  <label className={styles.label}>Booking Link</label>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input
                      className={styles.input}
                      value={bookingLink}
                      readOnly
                      style={{ flex: 1, background: '#f8f9fa', cursor: 'text' }}
                    />
                    <button
                      onClick={handleCopy}
                      style={{ padding: '10px 16px', background: copied ? '#2D7579' : '#082421', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontFamily: 'Urbanist', fontWeight: 600, fontSize: '13px', whiteSpace: 'nowrap' }}
                    >
                      {copied ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <div className={styles.modalFooter}>
          <button
            className={styles.sendLinkButton}
            onClick={handleWhatsApp}
            disabled={!bookingLink}
            style={{ opacity: bookingLink ? 1 : 0.5 }}
          >
            Share via WhatsApp
          </button>
        </div>
      </div>
    </div>
  );
};

export default SendBookingLinkModal;
