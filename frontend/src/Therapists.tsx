import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './Therapists.module.css';
import API_BASE_URL from './config/api';
import { useToast } from './context/ToastContext';
import Loader from './components/Loader';

interface Therapist {
  id: number;
  therapist_user_id: number | null;
  invite_email: string;
  status: 'pending' | 'active';
  created_at: string;
  user_name: string | null;
  email: string | null;
  specialization: string | null;
  profile_picture: string | null;
  phone: string | null;
  calendar_count: number;
}

const Therapists: React.FC = () => {
  const toast = useToast();
  const navigate = useNavigate();
  const [therapists, setTherapists] = useState<Therapist[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const [removingId, setRemovingId] = useState<number | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<Therapist | null>(null);

  const fetchTherapists = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/therapists`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setTherapists(data);
      } else {
        toast.error('Failed to load therapists.');
      }
    } catch {
      toast.error('Network error.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTherapists();
  }, [fetchTherapists]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setInviting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/therapists/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: inviteEmail.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message || 'Invite sent!');
        setInviteEmail('');
        setShowInviteModal(false);
        fetchTherapists();
      } else {
        toast.error(data.error || 'Failed to send invite.');
      }
    } catch {
      toast.error('Network error.');
    } finally {
      setInviting(false);
    }
  };

  const handleRemove = async (therapist: Therapist) => {
    setRemovingId(therapist.id);
    try {
      const res = await fetch(`${API_BASE_URL}/api/therapists/${therapist.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (res.ok) {
        toast.success('Therapist removed from your team.');
        setTherapists(prev => prev.filter(t => t.id !== therapist.id));
      } else {
        const data = await res.json();
        if (data.code === 'HAS_CLIENTS') {
          toast.error(`Cannot remove — ${therapist.user_name || 'this therapist'} has ${data.client_count} client${data.client_count !== 1 ? 's' : ''}. Transfer all their clients first.`);
        } else {
          toast.error(data.error || 'Failed to remove therapist.');
        }
      }
    } catch {
      toast.error('Network error.');
    } finally {
      setRemovingId(null);
      setConfirmRemove(null);
    }
  };

  const getInitials = (name: string | null, email: string) => {
    if (name) return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    return email[0].toUpperCase();
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h1 className={styles.title}>Therapists</h1>
          <p className={styles.subtitle}>Manage your team of therapists under your enterprise account.</p>
        </div>
        <div className={styles.headerRight}>
          <button className={styles.inviteBtn} onClick={() => setShowInviteModal(true)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Add Therapist
          </button>
        </div>
      </div>

      {/* Stats bar */}
      <div className={styles.statsBar}>
        <div className={styles.statCard}>
          <span className={styles.statValue}>{therapists.filter(t => t.status === 'active').length}</span>
          <span className={styles.statLabel}>Active</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statValue}>{therapists.filter(t => t.status === 'pending').length}</span>
          <span className={styles.statLabel}>Pending Invite</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statValue}>{therapists.length}</span>
          <span className={styles.statLabel}>Total</span>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className={styles.loaderWrap}><Loader /></div>
      ) : therapists.length === 0 ? (
        <div className={styles.emptyState}>
          <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#b0c4c2" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
            <circle cx="9" cy="7" r="4"/>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
          <p className={styles.emptyTitle}>No therapists yet</p>
          <p className={styles.emptyDesc}>Add therapists to your team by inviting them via email.</p>
          <button className={styles.emptyBtn} onClick={() => setShowInviteModal(true)}>
            Add Your First Therapist
          </button>
        </div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Therapist</th>
                <th>Email</th>
                <th>Specialization</th>
                <th>Calendars</th>
                <th>Status</th>
                <th>Added On</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {therapists.map(t => (
                <tr key={t.id}>
                  <td>
                    <div className={styles.therapistCell}>
                      <span
                        className={styles.therapistNameLink}
                        onClick={() => navigate(`/therapists/${t.id}`)}
                      >
                        {t.user_name || <span className={styles.pendingName}>Invite Pending</span>}
                      </span>
                    </div>
                  </td>
                  <td className={styles.emailCell}>{t.email || t.invite_email}</td>
                  <td className={styles.specCell}>{t.specialization || <span className={styles.na}>—</span>}</td>
                  <td className={styles.calendarCell}>
                    {t.status === 'active'
                      ? <span className={styles.calendarCount}>{t.calendar_count}</span>
                      : <span className={styles.na}>—</span>}
                  </td>
                  <td>
                    <span className={`${styles.badge} ${t.status === 'active' ? styles.badgeActive : styles.badgePending}`}>
                      {t.status === 'active' ? 'Active' : 'Invite Sent'}
                    </span>
                  </td>
                  <td className={styles.dateCell}>{formatDate(t.created_at)}</td>
                  <td>
                    <button
                      className={styles.removeBtn}
                      onClick={() => setConfirmRemove(t)}
                      disabled={removingId === t.id}
                      title="Remove from team"
                    >
                      {removingId === t.id ? '...' : (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6"/>
                          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                          <path d="M10 11v6"/><path d="M14 11v6"/>
                          <path d="M9 6V4h6v2"/>
                        </svg>
                      )}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Invite Modal */}
      {showInviteModal && (
        <div className={styles.modalOverlay} onClick={() => !inviting && setShowInviteModal(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>Add Therapist</h2>
              <button className={styles.modalClose} onClick={() => !inviting && setShowInviteModal(false)}>×</button>
            </div>
            <p className={styles.modalDesc}>
              Enter the therapist's email address. If they already have a MelloMinds account, they'll be added immediately. Otherwise, they'll receive an invite to sign up.
            </p>
            <form onSubmit={handleInvite}>
              <label className={styles.label}>Email Address *</label>
              <input
                type="email"
                className={styles.input}
                placeholder="therapist@example.com"
                value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)}
                required
                autoFocus
                disabled={inviting}
              />
              <div className={styles.modalActions}>
                <button type="button" className={styles.cancelBtn} onClick={() => setShowInviteModal(false)} disabled={inviting}>
                  Cancel
                </button>
                <button type="submit" className={styles.submitBtn} disabled={inviting || !inviteEmail.trim()}>
                  {inviting ? 'Sending...' : 'Send Invite'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirm Remove Modal */}
      {confirmRemove && (
        <div className={styles.modalOverlay} onClick={() => setConfirmRemove(null)}>
          <div className={styles.modal} style={{ maxWidth: '420px' }} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>Remove Therapist</h2>
              <button className={styles.modalClose} onClick={() => setConfirmRemove(null)}>×</button>
            </div>
            <p className={styles.modalDesc}>
              Are you sure you want to remove <strong>{confirmRemove.user_name || confirmRemove.invite_email}</strong> from your team? This action cannot be undone.
              {confirmRemove.status === 'active' && (
                <span style={{ display: 'block', marginTop: '8px', color: '#b07a00', fontSize: '13px' }}>
                  ⚠ Make sure all their clients have been transferred before removing.
                </span>
              )}
            </p>
            <div className={styles.modalActions}>
              <button className={styles.cancelBtn} onClick={() => setConfirmRemove(null)}>
                Cancel
              </button>
              <button
                className={styles.removeConfirmBtn}
                onClick={() => handleRemove(confirmRemove)}
                disabled={removingId === confirmRemove.id}
              >
                {removingId === confirmRemove.id ? 'Removing...' : 'Remove'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Therapists;
