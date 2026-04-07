import React, { useState, useEffect, useRef } from 'react';
import styles from './SendBookingLinkModal.module.css';
import API_BASE_URL from '../config/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import Loader from './Loader';

interface SendBookingLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Calendar {
  id: number;
  title: string;
  slug: string;
  duration: string;
  description?: string;
}

interface ClientSuggestion {
  id: number;
  name: string;
  email: string;
  phone: string;
}

const SendBookingLinkModal: React.FC<SendBookingLinkModalProps> = ({ isOpen, onClose }) => {
  const { user } = useAuth();
  const toast = useToast();

  const [calendars, setCalendars] = useState<Calendar[]>([]);
  const [selectedCalendarId, setSelectedCalendarId] = useState<string>('');
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // Autofill suggestions
  const [allClients, setAllClients] = useState<ClientSuggestion[]>([]);
  const [suggestions, setSuggestions] = useState<ClientSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    Promise.all([
      fetch(`${API_BASE_URL}/api/calendars`, { credentials: 'include' }).then(r => r.ok ? r.json() : []),
      fetch(`${API_BASE_URL}/api/bookings/clients`, { credentials: 'include' }).then(r => r.ok ? r.json() : []),
    ]).then(([cals, clients]) => {
      setCalendars(cals);
      if (cals.length > 0) setSelectedCalendarId(String(cals[0].id));
      setAllClients(clients);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [isOpen]);

  // Close suggestions on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleNameChange = (val: string) => {
    setClientName(val);
    if (val.trim().length < 1) { setSuggestions([]); setShowSuggestions(false); return; }
    const matches = allClients.filter(c =>
      c.name.toLowerCase().includes(val.toLowerCase()) ||
      c.email.toLowerCase().includes(val.toLowerCase())
    ).slice(0, 5);
    setSuggestions(matches);
    setShowSuggestions(matches.length > 0);
  };

  const handleSelectSuggestion = (c: ClientSuggestion) => {
    setClientName(c.name);
    setClientEmail(c.email);
    setClientPhone(c.phone || '');
    setSuggestions([]);
    setShowSuggestions(false);
  };

  const handleClose = () => {
    setClientName(''); setClientEmail(''); setClientPhone('');
    setShowConfirm(false); setSuggestions([]); setShowSuggestions(false);
    onClose();
  };

  const handleSendClick = () => {
    if (!clientName.trim() || !clientEmail.trim() || !selectedCalendarId) {
      toast.warning('Please fill in all required fields.');
      return;
    }
    setShowConfirm(true);
  };

  const handleConfirmSend = async () => {
    setSending(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/bookings/send-link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          client_name: clientName.trim(),
          client_email: clientEmail.trim(),
          client_phone: clientPhone.trim(),
          calendar_id: parseInt(selectedCalendarId),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success('Booking link sent to client!');
        handleClose();
      } else {
        toast.error(data.error || 'Failed to send booking link');
        setShowConfirm(false);
      }
    } catch {
      toast.error('Network error. Please try again.');
      setShowConfirm(false);
    } finally {
      setSending(false);
    }
  };

  const selectedCalendar = calendars.find(c => String(c.id) === selectedCalendarId);
  const bookingLink = selectedCalendar && user
    ? `${window.location.origin}/book/${user.profile_slug || user.id}/${selectedCalendar.slug?.replace(/^\//, '')}`
    : '';

  if (!isOpen) return null;

  return (
    <div className={styles.modalOverlay} onClick={handleClose}>
      <div className={styles.modalContent} onClick={e => e.stopPropagation()}>

        {/* Confirm lightbox */}
        {showConfirm && (
          <div className={styles.confirmOverlay}>
            <div className={styles.confirmBox}>
              <div className={styles.confirmIcon}>✉️</div>
              <h3 className={styles.confirmTitle}>Send Booking Link?</h3>
              <p className={styles.confirmText}>
                This will send a booking link for <strong>{selectedCalendar?.title}</strong> to <strong>{clientEmail}</strong>. Are you sure?
              </p>
              <div className={styles.confirmActions}>
                <button className={styles.confirmCancel} onClick={() => setShowConfirm(false)} disabled={sending}>Cancel</button>
                <button className={styles.confirmSend} onClick={handleConfirmSend} disabled={sending}>
                  {sending ? 'Sending...' : 'Yes, Send'}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className={styles.modalHeader}>
          <div className={styles.modalTitle}>
            <img src="/Send.svg" alt="Send" className={styles.sendIcon} />
            Send Booking Link
          </div>
          <button className={styles.closeButton} onClick={handleClose}>✕</button>
        </div>

        <div className={styles.modalBody}>
          {loading ? (
            <Loader />
          ) : calendars.length === 0 ? (
            <p style={{ color: '#6E6E6E', fontSize: '14px', fontFamily: 'Urbanist' }}>No calendars found. Create a calendar first.</p>
          ) : (
            <>
              {/* Client Name with autofill */}
              <div className={styles.formGroup} ref={suggestionsRef} style={{ position: 'relative' }}>
                <label className={styles.label}>Client Name <span className={styles.required}>*</span></label>
                <input
                  className={styles.input}
                  placeholder="Search or enter client name"
                  value={clientName}
                  onChange={e => handleNameChange(e.target.value)}
                  onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                  autoComplete="off"
                />
                {showSuggestions && (
                  <div className={styles.suggestionsList}>
                    {suggestions.map(c => (
                      <div key={c.id} className={styles.suggestionItem} onClick={() => handleSelectSuggestion(c)}>
                        <span className={styles.suggestionName}>{c.name}</span>
                        <span className={styles.suggestionEmail}>{c.email}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Email */}
              <div className={styles.formGroup}>
                <label className={styles.label}>Email <span className={styles.required}>*</span></label>
                <input
                  className={styles.input}
                  type="email"
                  placeholder="client@example.com"
                  value={clientEmail}
                  onChange={e => setClientEmail(e.target.value)}
                />
              </div>

              {/* Phone */}
              <div className={styles.formGroup}>
                <label className={styles.label}>Phone</label>
                <input
                  className={styles.input}
                  type="tel"
                  placeholder="+91 98765 43210"
                  value={clientPhone}
                  onChange={e => setClientPhone(e.target.value)}
                />
              </div>

              {/* Calendar */}
              <div className={styles.formGroup}>
                <label className={styles.label}>Calendar / Service <span className={styles.required}>*</span></label>
                <select className={styles.input} value={selectedCalendarId} onChange={e => setSelectedCalendarId(e.target.value)}>
                  {calendars.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                </select>
              </div>

              {/* Preview */}
              {selectedCalendar && (
                <div className={styles.previewCard}>
                  <div className={styles.previewTitle}>{selectedCalendar.title}</div>
                  {selectedCalendar.description && <div className={styles.previewDesc}>{selectedCalendar.description}</div>}
                  <div className={styles.previewMeta}>⏱ {selectedCalendar.duration}</div>
                  <div className={styles.previewLink}>{bookingLink}</div>
                </div>
              )}
            </>
          )}
        </div>

        <div className={styles.modalFooter}>
          <button
            className={styles.sendLinkButton}
            onClick={handleSendClick}
            disabled={!bookingLink || loading}
            style={{ opacity: bookingLink && !loading ? 1 : 0.5 }}
          >
            Send Booking Link
          </button>
        </div>
      </div>
    </div>
  );
};

export default SendBookingLinkModal;
