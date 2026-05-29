import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import styles from './TherapistProfileView.module.css';
import API_BASE_URL from './config/api';
import { useToast } from './context/ToastContext';
import Loader from './components/Loader';
interface TherapistInfo {
  id: number;
  therapist_user_id: number | null;
  user_name: string | null;
  email: string;
  specialization: string | null;
  profile_picture: string | null;
  calendar_count: number;
  calendars: { id: number; title: string }[];
  status: 'pending' | 'active';
  created_at: string;
}

interface Analytics {
  revenue: number;
  sessions: number;
  bookings: number;
  cancelled: number;
  clients: number;
}

interface Client {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  gender: string | null;
}

interface Booking {
  id: number;
  client_name: string;
  client_email: string;
  start_time: string;
  status: string;
  calendar_title: string | null;
}

interface ProfileData {
  info: TherapistInfo;
  analytics: Analytics;
  clients: Client[];
  recentBookings: Booking[];
}

const TherapistProfileView: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast();

  const [data, setData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [clientSearch, setClientSearch] = useState('');
  const [bookingSearch, setBookingSearch] = useState('');
  const [calendarChecking, setCalendarChecking] = useState(false);

  const handleCreateCalendar = async (therapistUserId: number, therapistName: string | null) => {
    setCalendarChecking(true);
    try {
      const res = await fetch(
        `${API_BASE_URL}/api/connect-calendar/status?for_user_id=${therapistUserId}`,
        { credentials: 'include' }
      );
      const data = await res.json();
      if (!data.connected) {
        toast.error(`${therapistName || 'This therapist'} hasn't connected their Google Calendar yet. Ask them to connect it from their Settings first.`);
        return;
      }
      navigate('/my-calendar/new', {
        state: {
          managingUserId: therapistUserId,
          managingUserName: therapistName,
          returnTo: `/therapists/${id}`,
        },
      });
    } catch {
      toast.error('Could not verify Google Calendar connection. Please try again.');
    } finally {
      setCalendarChecking(false);
    }
  };

  const fetchProfile = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/therapists/${id}/profile`, {
        credentials: 'include',
      });
      if (res.ok) {
        setData(await res.json());
      } else {
        toast.error('Failed to load therapist profile.');
        navigate('/therapists');
      }
    } catch {
      toast.error('Network error.');
      navigate('/therapists');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  const filteredClients = useMemo(() => {
    if (!data) return [];
    const q = clientSearch.toLowerCase();
    return data.clients.filter(c =>
      c.name.toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q) ||
      (c.phone || '').includes(q) ||
      (c.gender || '').toLowerCase().includes(q)
    );
  }, [data, clientSearch]);

  const filteredBookings = useMemo(() => {
    if (!data) return [];
    const q = bookingSearch.toLowerCase();
    return data.recentBookings.filter(b =>
      (b.client_name || '').toLowerCase().includes(q) ||
      (b.client_email || '').toLowerCase().includes(q) ||
      (b.calendar_title || '').toLowerCase().includes(q)
    );
  }, [data, bookingSearch]);

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
    });

  const formatDateTime = (iso: string) => {
    const d = new Date(iso);
    return `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} · ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`;
  };

  const getInitials = (name: string | null, email: string) => {
    if (name) return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    return email[0].toUpperCase();
  };

  const statusColor: Record<string, string> = {
    scheduled: '#2d7579',
    completed: '#1a7a4a',
    cancelled: '#e53935',
    noshow: '#b07a00',
  };

  if (loading) return <div className={styles.loaderWrap}><Loader /></div>;
  if (!data) return null;

  const { info, analytics } = data;
  const isPending = info.status === 'pending';

  return (
    <div className={styles.container}>
      {/* Back */}
      <button className={styles.backBtn} onClick={() => navigate('/therapists')}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6" />
        </svg>
        Back to Therapists
      </button>

      {/* ── Profile Card ── */}
      <div className={styles.profileCard}>
        <div className={styles.avatarWrap}>
          {info.profile_picture ? (
            <img
              src={info.profile_picture.startsWith('http') ? info.profile_picture : `${API_BASE_URL}${info.profile_picture}`}
              alt={info.user_name || info.email}
              className={styles.avatar}
            />
          ) : (
            <div className={styles.avatarInitials}>
              {getInitials(info.user_name, info.email)}
            </div>
          )}
        </div>
        <div className={styles.profileInfo}>
          <div className={styles.profileNameRow}>
            <h1 className={styles.profileName}>
              {info.user_name || <span className={styles.pendingName}>Invite Pending</span>}
            </h1>
            <span className={`${styles.statusBadge} ${info.status === 'active' ? styles.badgeActive : styles.badgePending}`}>
              {info.status === 'active' ? 'Active' : 'Invite Sent'}
            </span>
          </div>
          <div className={styles.profileMeta}>
            <span className={styles.metaItem}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
              </svg>
              {info.email}
            </span>
            {info.specialization && (
              <span className={styles.metaItem}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/>
                </svg>
                {info.specialization}
              </span>
            )}
            <span className={styles.metaItem}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
              {info.calendar_count} {info.calendar_count === 1 ? 'Calendar' : 'Calendars'}
            </span>
            <span className={styles.metaItem}>
              Added {formatDate(info.created_at)}
            </span>
          </div>
          {info.calendars && info.calendars.length > 0 && (
            <div className={styles.calendarTags}>
              {info.calendars.map(c => (
                <span key={c.id} className={styles.calendarTag}>{c.title}</span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Calendars Management ── */}
      {!isPending && (
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Calendars ({info.calendar_count})</h2>
            <button
              className={styles.createCalendarBtn}
              disabled={calendarChecking}
              onClick={() => handleCreateCalendar(info.therapist_user_id!, info.user_name)}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              {calendarChecking ? 'Checking...' : 'Create Calendar'}
            </button>
          </div>
          {info.calendars && info.calendars.length > 0 ? (
            <div className={styles.calendarsGrid}>
              {info.calendars.map((cal: any) => (
                <div key={cal.id} className={styles.calendarCard}>
                  <div className={styles.calendarCardHeader}>
                    <h3 className={styles.calendarCardTitle}>{cal.title}</h3>
                    <button
                      className={styles.editCalendarBtn}
                      onClick={() => {
                        // Fetch full calendar data then navigate to edit
                        fetch(`${API_BASE_URL}/api/calendars/public/${info.therapist_user_id}${cal.slug || ''}`, { credentials: 'include' })
                          .then(r => r.ok ? r.json() : null)
                          .then(fullCal => {
                            if (fullCal) {
                              navigate('/my-calendar/edit', {
                                state: {
                                  isEditing: true,
                                  calendar: fullCal,
                                  managingUserId: info.therapist_user_id,
                                  managingUserName: info.user_name,
                                  returnTo: `/therapists/${id}`,
                                },
                              });
                            }
                          });
                      }}
                      title="Edit calendar"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className={styles.emptyCalendars}>
              <p>No calendars yet. Create one to get started.</p>
            </div>
          )}
        </div>
      )}

      {/* ── Analytics ── */}
      {!isPending && (        <div className={styles.analyticsGrid}>
          <div className={styles.analyticsCard}>
            <span className={styles.analyticsValue}>₹{analytics.revenue.toLocaleString('en-IN')}</span>
            <span className={styles.analyticsLabel}>Revenue</span>
          </div>
          <div className={styles.analyticsCard}>
            <span className={styles.analyticsValue}>{analytics.sessions}</span>
            <span className={styles.analyticsLabel}>Sessions</span>
          </div>
          <div className={styles.analyticsCard}>
            <span className={styles.analyticsValue}>{analytics.bookings}</span>
            <span className={styles.analyticsLabel}>Bookings</span>
          </div>
          <div className={styles.analyticsCard}>
            <span className={styles.analyticsValue}>{analytics.cancelled}</span>
            <span className={styles.analyticsLabel}>Cancelled</span>
          </div>
          <div className={styles.analyticsCard}>
            <span className={styles.analyticsValue}>{analytics.clients}</span>
            <span className={styles.analyticsLabel}>Clients</span>
          </div>
        </div>
      )}

      {/* ── Clients Table ── */}
      {!isPending && (
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Clients</h2>
            <div className={styles.searchWrap}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input
                className={styles.searchInput}
                placeholder="Search clients..."
                value={clientSearch}
                onChange={e => setClientSearch(e.target.value)}
              />
            </div>
          </div>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Client Name</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Gender</th>
                </tr>
              </thead>
              <tbody>
                {filteredClients.length === 0 ? (
                  <tr>
                    <td colSpan={4} className={styles.emptyRow}>
                      {clientSearch ? 'No clients match your search.' : 'No clients yet.'}
                    </td>
                  </tr>
                ) : (
                  filteredClients.map(c => (
                    <tr key={c.id}>
                      <td className={styles.boldCell}>{c.name}</td>
                      <td className={styles.mutedCell}>{c.email}</td>
                      <td className={styles.mutedCell}>{c.phone || <span className={styles.na}>—</span>}</td>
                      <td className={styles.mutedCell}>{c.gender || <span className={styles.na}>—</span>}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Recent Bookings Table ── */}
      {!isPending && (
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Recent Bookings</h2>
            <div className={styles.searchWrap}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input
                className={styles.searchInput}
                placeholder="Search bookings..."
                value={bookingSearch}
                onChange={e => setBookingSearch(e.target.value)}
              />
            </div>
          </div>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Client Name</th>
                  <th>Calendar</th>
                  <th>Date & Time</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredBookings.length === 0 ? (
                  <tr>
                    <td colSpan={4} className={styles.emptyRow}>
                      {bookingSearch ? 'No bookings match your search.' : 'No bookings yet.'}
                    </td>
                  </tr>
                ) : (
                  filteredBookings.map(b => (
                    <tr key={b.id}>
                      <td className={styles.boldCell}>{b.client_name || '—'}</td>
                      <td className={styles.mutedCell}>{b.calendar_title || <span className={styles.na}>—</span>}</td>
                      <td className={styles.mutedCell}>{formatDateTime(b.start_time)}</td>
                      <td>
                        <span
                          className={styles.statusPill}
                          style={{ background: `${statusColor[b.status] || '#888'}18`, color: statusColor[b.status] || '#888' }}
                        >
                          {b.status.charAt(0).toUpperCase() + b.status.slice(1)}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {isPending && (
        <div className={styles.pendingNotice}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#b0c4c2" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <p>This therapist hasn't accepted their invite yet. Analytics and data will appear once they sign up.</p>
        </div>
      )}
    </div>
  );
};

export default TherapistProfileView;
