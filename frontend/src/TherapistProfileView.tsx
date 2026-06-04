import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import styles from './TherapistProfileView.module.css';
import API_BASE_URL from './config/api';
import { useToast } from './context/ToastContext';
import { useSocket } from './context/SocketContext';
import Loader from './components/Loader';
import { exportToCSV } from './utils/exportCSV';
interface TherapistInfo {
  id: number;
  therapist_user_id: number | null;
  user_name: string | null;
  email: string;
  specialization: string | null;
  profile_picture: string | null;
  calendar_count: number;
  calendars: { id: number; title: string; slug: string }[];
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
  const { socket } = useSocket();

  const [data, setData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [clientSearch, setClientSearch] = useState('');
  const [bookingSearch, setBookingSearch] = useState('');
  const [calendarChecking, setCalendarChecking] = useState(false);
  const [editingCalendarId, setEditingCalendarId] = useState<number | null>(null);
  const [clientPage, setClientPage] = useState(1);
  const [bookingPage, setBookingPage] = useState(1);
  const ITEMS_PER_PAGE = 5;

  const handleEditCalendar = async (calendarId: number, therapistUserId: number | null, therapistName: string | null) => {
    setEditingCalendarId(calendarId);
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout

      const res = await fetch(`${API_BASE_URL}/api/calendars/${calendarId}`, {
        credentials: 'include',
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        toast.error(`Failed to load calendar: ${errData.error || 'Unknown error'}`);
        return;
      }

      const fullCal = await res.json();

      navigate('/my-calendar/edit', {
        state: {
          isEditing: true,
          calendar: fullCal,
          managingUserId: therapistUserId,
          managingUserName: therapistName,
          returnTo: `/therapists/${id}`,
        },
      });
    } catch (err: any) {
      if (err.name === 'AbortError') {
        toast.error('Request timeout. Please try again.');
      } else {
        toast.error('Failed to fetch calendar. Please try again.');
      }
      console.error('Error fetching calendar:', err);
    } finally {
      setEditingCalendarId(null);
    }
  };

  const handleCreateCalendar = async (therapistUserId: number, therapistName: string | null) => {
    if (!therapistUserId) {
      toast.error('Therapist account not fully set up yet.');
      return;
    }

    setCalendarChecking(true);
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout

      const res = await fetch(
        `${API_BASE_URL}/api/connect-calendar/status?for_user_id=${therapistUserId}`,
        { credentials: 'include', signal: controller.signal }
      );

      clearTimeout(timeout);

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        toast.error(`Failed to verify connection: ${errData.error || 'Unknown error'}`);
        return;
      }

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
    } catch (err: any) {
      if (err.name === 'AbortError') {
        toast.error('Request timeout. Please try again.');
      } else {
        toast.error('Could not verify Google Calendar connection. Please try again.');
      }
      console.error('Error checking calendar connection:', err);
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
        const profileData = await res.json();
        console.log('[DEBUG] Therapist profile data:', profileData);
        setData(profileData);
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

  useEffect(() => {
    if (!socket) return;
    socket.on('therapists_updated', fetchProfile);
    return () => {
      socket.off('therapists_updated', fetchProfile);
    };
  }, [socket, fetchProfile]);

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

  // Paginate clients
  const clientStartIdx = (clientPage - 1) * ITEMS_PER_PAGE;
  const paginatedClients = useMemo(() => 
    filteredClients.slice(clientStartIdx, clientStartIdx + ITEMS_PER_PAGE),
    [filteredClients, clientStartIdx]
  );
  const totalClientPages = Math.ceil(filteredClients.length / ITEMS_PER_PAGE);

  // Paginate bookings
  const bookingStartIdx = (bookingPage - 1) * ITEMS_PER_PAGE;
  const paginatedBookings = useMemo(() => 
    filteredBookings.slice(bookingStartIdx, bookingStartIdx + ITEMS_PER_PAGE),
    [filteredBookings, bookingStartIdx]
  );
  const totalBookingPages = Math.ceil(filteredBookings.length / ITEMS_PER_PAGE);

  // Reset pagination when search changes
  useEffect(() => { setClientPage(1); }, [clientSearch]);
  useEffect(() => { setBookingPage(1); }, [bookingSearch]);

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
          {info.therapist_user_id && (
            <div style={{ marginTop: '16px' }}>
              <a
                href={`/book/${info.therapist_user_id}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-block',
                  padding: '8px 16px',
                  backgroundColor: '#2d7579',
                  color: '#fff',
                  borderRadius: '6px',
                  textDecoration: 'none',
                  fontSize: '13px',
                  fontWeight: 500,
                  fontFamily: 'Urbanist'
                }}
              >
                View Public Profile
              </a>
            </div>
          )}
        </div>
      </div>

      {/* ── Calendars Management ── */}
      {!isPending && (
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Calendars ({info.calendar_count})</h2>
          </div>
          {info.calendars && info.calendars.length > 0 ? (
            <div className={styles.calendarsGrid}>
              {info.calendars.map((cal: any) => (
                <div key={cal.id} className={styles.calendarCard}>
                  <div className={styles.calendarCardHeader}>
                    <h3 className={styles.calendarCardTitle}>{cal.title}</h3>
                    <button
                      className={styles.editCalendarBtn}
                      onClick={() => handleEditCalendar(cal.id, info.therapist_user_id, info.user_name)}
                      disabled={editingCalendarId === cal.id}
                      title="Edit calendar"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                      </svg>
                    </button>
                  </div>
                  {info.therapist_user_id && cal.slug && (
                    <div style={{ padding: '12px', borderTop: '1px solid #f0f0f0' }}>
                      <div style={{ fontSize: '11px', color: '#999', marginBottom: '6px', fontWeight: 500 }}>Calendar Link</div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        {(() => {
                          const cleanSlug = cal.slug.startsWith('/') ? cal.slug.slice(1) : cal.slug;
                          const calLink = `${window.location.origin}/book/${info.therapist_user_id}/${cleanSlug}`;
                          return (
                            <>
                              <input
                                type="text"
                                readOnly
                                value={calLink}
                                style={{
                                  flex: 1,
                                  fontSize: '12px',
                                  padding: '8px',
                                  border: '1px solid #e0e0e0',
                                  borderRadius: '4px',
                                  fontFamily: 'monospace',
                                  backgroundColor: '#f9f9f9'
                                }}
                              />
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(calLink);
                                  toast.success('Link copied!');
                                }}
                                style={{
                                  padding: '8px 12px',
                                  backgroundColor: '#f5f5f5',
                                  border: '1px solid #e0e0e0',
                                  borderRadius: '4px',
                                  cursor: 'pointer',
                                  fontSize: '12px',
                                  fontWeight: 500,
                                  color: '#333'
                                }}
                              >
                                Copy
                              </button>
                            </>
                          );
                        })()}
                      </div>
                    </div>
                  )}
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
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <button
                onClick={() => {
                  exportToCSV(filteredClients, 'therapist-clients', {
                    name: 'Name',
                    email: 'Email',
                    phone: 'Phone',
                    gender: 'Gender',
                  });
                }}
                style={{
                  padding: '8px 14px',
                  background: '#082421',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  fontFamily: 'Urbanist',
                  fontWeight: 600,
                  fontSize: '13px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  whiteSpace: 'nowrap'
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                Export
              </button>
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
                  paginatedClients.map(c => (
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
          
          {/* Pagination for Clients */}
          {totalClientPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', paddingTop: '12px', borderTop: '1px solid #e0e0e0' }}>
              <span style={{ fontSize: '13px', color: '#666', fontFamily: 'Urbanist' }}>
                Page {clientPage} of {totalClientPages} • Showing {paginatedClients.length} of {filteredClients.length}
              </span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => setClientPage(p => Math.max(1, p - 1))}
                  disabled={clientPage === 1}
                  style={{ padding: '6px 12px', border: '1px solid #ddd', background: '#fff', borderRadius: '4px', cursor: clientPage === 1 ? 'not-allowed' : 'pointer', fontFamily: 'Urbanist', fontSize: '13px', opacity: clientPage === 1 ? 0.5 : 1 }}
                >
                  Previous
                </button>
                <button
                  onClick={() => setClientPage(p => Math.min(totalClientPages, p + 1))}
                  disabled={clientPage === totalClientPages}
                  style={{ padding: '6px 12px', border: '1px solid #ddd', background: '#fff', borderRadius: '4px', cursor: clientPage === totalClientPages ? 'not-allowed' : 'pointer', fontFamily: 'Urbanist', fontSize: '13px', opacity: clientPage === totalClientPages ? 0.5 : 1 }}
                >
                  Next
                </button>
              </div>
            </div>
          )}
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
                  paginatedBookings.map(b => (
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

          {/* Pagination for Bookings */}
          {totalBookingPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', paddingTop: '12px', borderTop: '1px solid #e0e0e0' }}>
              <span style={{ fontSize: '13px', color: '#666', fontFamily: 'Urbanist' }}>
                Page {bookingPage} of {totalBookingPages} • Showing {paginatedBookings.length} of {filteredBookings.length}
              </span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => setBookingPage(p => Math.max(1, p - 1))}
                  disabled={bookingPage === 1}
                  style={{ padding: '6px 12px', border: '1px solid #ddd', background: '#fff', borderRadius: '4px', cursor: bookingPage === 1 ? 'not-allowed' : 'pointer', fontFamily: 'Urbanist', fontSize: '13px', opacity: bookingPage === 1 ? 0.5 : 1 }}
                >
                  Previous
                </button>
                <button
                  onClick={() => setBookingPage(p => Math.min(totalBookingPages, p + 1))}
                  disabled={bookingPage === totalBookingPages}
                  style={{ padding: '6px 12px', border: '1px solid #ddd', background: '#fff', borderRadius: '4px', cursor: bookingPage === totalBookingPages ? 'not-allowed' : 'pointer', fontFamily: 'Urbanist', fontSize: '13px', opacity: bookingPage === totalBookingPages ? 0.5 : 1 }}
                >
                  Next
                </button>
              </div>
            </div>
          )}
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
