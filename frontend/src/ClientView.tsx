import React, { useState, useEffect, useMemo } from 'react';
import styles from './ClientView.module.css';
import { Delete, EditSquare, Call, Message, Calendar, ArrowLeft, ChevronDown } from 'react-iconly';
import CustomDropdown from './components/CustomDropdown';
import { useToast } from './context/ToastContext';
import API_BASE_URL from './config/api';
import DataTable from './components/DataTable';
import CreateBooking from './components/CreateBooking';
import { ColumnDef } from '@tanstack/react-table';

interface Client {
  id: number;
  name: string;
  phone: string;
  email: string;
  sessions: string;
  revenue: string;
  age?: string;
  occupation?: string;
  gender?: string;
  maritalStatus?: string;
  emergencyName?: string;
  emergencyPhone?: string;
  emergencyRelation?: string;
  manually_added?: boolean;
}

interface ClientViewProps {
  client: Client;
  onBack: () => void;
}

const ClientView: React.FC<ClientViewProps> = ({ client, onBack }) => {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<string>('Overview');
  const [selectedDate, setSelectedDate] = useState<string>('all');
  const [showDateDropdown, setShowDateDropdown] = useState<boolean>(false);
  const [showAddNotesModal, setShowAddNotesModal] = useState<boolean>(false);
  const [showAddActivitiesModal, setShowAddActivitiesModal] = useState<boolean>(false);
  const [showActionMenu, setShowActionMenu] = useState<boolean>(false);
  const actionMenuRef = React.useRef<HTMLDivElement>(null);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);
  const [deleting, setDeleting] = useState<boolean>(false);
  const [showCreateBookingModal, setShowCreateBookingModal] = useState<boolean>(false);
  const [showTransferModal, setShowTransferModal] = useState<boolean>(false);
  const [transferEmail, setTransferEmail] = useState('');
  const [transferOptions, setTransferOptions] = useState({
    notes: false,
    activities: false,
    clinical_profile: false,
  });
  const [transferring, setTransferring] = useState(false);
  const [emailLookup, setEmailLookup] = useState<{ status: 'idle' | 'checking' | 'found' | 'notfound'; name?: string }>({ status: 'idle' });

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (actionMenuRef.current && !actionMenuRef.current.contains(e.target as Node)) {
        setShowActionMenu(false);
      }
    };
    if (showActionMenu) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showActionMenu]);

  // Real data state
  const [appointments, setAppointments] = useState<any[]>([]);
  const [stats, setStats] = useState({
    sessions: '0',
    revenue: '₹0',
    nextSession: '-',
    cancellations: '0',
    noShow: '0'
  });

  // Track saved state separately so cancel always resets to last saved
  const [savedData, setSavedData] = useState({
    name: client.name || '',
    phone: client.phone || '',
    email: client.email || '',
    emergencyName: client.emergencyName || '',
    emergencyRelation: client.emergencyRelation || '',
    emergencyPhone: client.emergencyPhone || '',
    age: client.age || '',
    occupation: client.occupation || '',
    gender: client.gender || 'Male',
    maritalStatus: client.maritalStatus || 'Single'
  });

  const [editData, setEditData] = useState({ ...savedData });

  const [activities, setActivities] = useState<any[]>([]);
  const [activityForm, setActivityForm] = useState({ name: '', description: '', visible_to_client: false });
  const [transferInfo, setTransferInfo] = useState<{ transferred: boolean; from_therapist_email?: string; created_at?: string } | null>(null);
  const [isTransferredClient, setIsTransferredClient] = useState(false);

  const fetchActivities = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/activities/${client.id}`, { credentials: 'include' });
      if (res.ok) setActivities(await res.json());
    } catch (e) { console.error('Failed to fetch activities:', e); }
  };

  useEffect(() => { fetchActivities(); }, [client.id]);

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/clients/${client.id}/transfer-info`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : { transferred: false })
      .then(data => {
        setTransferInfo(data);
        if (data.transferred) setIsTransferredClient(true);
      })
      .catch(() => setTransferInfo({ transferred: false }));

    // Also check if this client was transferred out by current therapist
    fetch(`${API_BASE_URL}/api/clients/transfers/outgoing`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : [])
      .then((data: any[]) => {
        const match = data.find(t => t.client_email === client.email && t.status === 'approved');
        if (match) setIsTransferredClient(true);
      })
      .catch(() => {});
  }, [client.id, client.email]);

  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string>('');
  const [noteContent, setNoteContent] = useState<string>('');
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleActivitySubmit = async () => {
    if (!activityForm.name.trim()) { toast.warning('Activity name is required.'); return; }
    try {
      const res = await fetch(`${API_BASE_URL}/api/activities`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: client.id, ...activityForm }),
        credentials: 'include'
      });
      if (res.ok) {
        toast.success('Activity added!');
        setShowAddActivitiesModal(false);
        setActivityForm({ name: '', description: '', visible_to_client: false });
        fetchActivities();
      } else { toast.error('Failed to add activity.'); }
    } catch (e) { toast.error('Error adding activity.'); }
  };

  const handleDeleteActivity = async (id: number) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/activities/${id}`, { method: 'DELETE', credentials: 'include' });
      if (res.ok) { toast.success('Activity removed.'); fetchActivities(); }
      else toast.error('Failed to delete activity.');
    } catch (e) { toast.error('Error deleting activity.'); }
  };

  const fetchClientData = async () => {
    if (!client.email) return;
    try {
      const response = await fetch(`${API_BASE_URL}/api/bookings?email=${encodeURIComponent(client.email)}`, {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();

        // Apply date filter client-side
        const filtered = selectedDate === 'all' ? data : data.filter((app: any) => {
          const d = new Date(app.start_time);
          const [mon, yr] = selectedDate.split(' ');
          const monthIndex = new Date(`${mon} 1, 2000`).getMonth();
          return d.getMonth() === monthIndex && d.getFullYear() === parseInt(yr);
        });

        setAppointments(filtered);

        const totalSessions = filtered.length;
        // Only count Paid revenue
        const totalRevenue = filtered.reduce((sum: number, app: any) =>
          app.payment_status === 'Paid' ? sum + (parseFloat(app.payment_amount) || 0) : sum, 0);
        const cancelled = filtered.filter((app: any) => app.status === 'cancelled').length;
        const noShow = filtered.filter((app: any) => app.status === 'noshow').length;

        const now = new Date();
        const upcoming = data
          .filter((app: any) => new Date(app.start_time) > now && app.status !== 'cancelled')
          .sort((a: any, b: any) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())[0];

        const nextSessionDate = upcoming
          ? new Date(upcoming.start_time).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
          : '-';

        setStats({
          sessions: totalSessions.toString().padStart(2, '0'),
          revenue: `₹${totalRevenue.toLocaleString()}`,
          nextSession: nextSessionDate,
          cancellations: cancelled.toString().padStart(2, '0'),
          noShow: noShow.toString().padStart(2, '0')
        });
      }
    } catch (error) {
      console.error('Failed to fetch client appointments:', error);
    }
  };

  useEffect(() => {
    fetchClientData();
  }, [client.email, refreshTrigger, selectedDate]);

  const handleNoteSubmit = async () => {
    if (!selectedAppointmentId || !noteContent) {
      toast.warning('Please select a booking and enter note content.');
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appointment_id: selectedAppointmentId,
          content: { text: noteContent }
        }),
        credentials: 'include'
      });

      if (response.ok) {
        toast.success('Note added successfully!');
        setShowAddNotesModal(false);
        setNoteContent('');
        setSelectedAppointmentId('');
        setRefreshTrigger(prev => prev + 1);
      } else {
        toast.error('Failed to add note.');
      }
    } catch (error) {
      console.error('Error adding note:', error);
      toast.error('Error adding note.');
    }
  };

  const handleEditClient = () => {
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setEditData({ ...savedData });
    setIsEditing(false);
  };

  const handleSaveEdit = async () => {
    // Sanitize: replace '-' placeholder with empty string so DB gets null via COALESCE
    const sanitized = Object.fromEntries(
      Object.entries(editData).map(([k, v]) => [k, v === '-' ? '' : v])
    );
    try {
      const response = await fetch(`${API_BASE_URL}/api/clients/${client.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sanitized),
        credentials: 'include'
      });

      if (response.ok) {
        const updated = await response.json();
        // Update savedData so cancel resets to the newly saved values
        const newSaved = {
          name: updated.name || '',
          phone: updated.phone || '',
          email: updated.email || '',
          emergencyName: updated.emergencyName || '',
          emergencyRelation: updated.emergencyRelation || '',
          emergencyPhone: updated.emergencyPhone || '',
          age: updated.age || '',
          occupation: updated.occupation || '',
          gender: updated.gender || 'Male',
          maritalStatus: updated.maritalStatus || 'Single'
        };
        setSavedData(newSaved);
        setEditData(newSaved);
        setIsEditing(false);
        toast.success('Client information updated successfully!');
        setRefreshTrigger(prev => prev + 1);
      } else {
        toast.error('Failed to update client information.');
      }
    } catch (error) {
      console.error('Error updating client:', error);
      toast.error('Error updating client information.');
    }
  };

  const handleDeleteClient = async () => {
    setDeleting(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/clients/${client.id}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      if (response.ok) {
        toast.success('Client deleted successfully');
        setShowDeleteModal(false);
        onBack();
      } else {
        const err = await response.json();
        if (err.error === 'transferred_client') {
          setShowDeleteModal(false);
          toast.error('Transferred clients cannot be deleted. Please contact support@mellominds.co.in');
        } else {
          toast.error(err.error || 'Failed to delete client');
        }
      }
    } catch {
      toast.error('Error deleting client');
    } finally {
      setDeleting(false);
    }
  };

  const handleTransferEmailChange = (email: string) => {
    setTransferEmail(email);
    if (!email.trim() || !email.includes('@')) {
      setEmailLookup({ status: 'idle' });
    } else {
      setEmailLookup({ status: 'checking' });
    }
  };

  useEffect(() => {
    if (!transferEmail.trim() || !transferEmail.includes('@')) return;
    setEmailLookup({ status: 'checking' });
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/clients/lookup-therapist?email=${encodeURIComponent(transferEmail)}`, { credentials: 'include' });
        const data = await res.json();
        if (res.ok && data.exists) {
          setEmailLookup({ status: 'found', name: data.name });
        } else {
          setEmailLookup({ status: 'notfound' });
        }
      } catch {
        setEmailLookup({ status: 'notfound' });
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [transferEmail]);

  const tabs: string[] = ['Overview', 'Session Notes', 'Activity Suggestion'];

  const handleTransferClient = async () => {
    if (!transferEmail.trim()) { toast.warning('Please enter the therapist email.'); return; }
    if (emailLookup.status !== 'found') { toast.warning('Please enter a valid registered therapist email.'); return; }
    setTransferring(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/clients/${client.id}/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ target_email: transferEmail.trim(), transfer_options: transferOptions }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message);
        setShowTransferModal(false);
        onBack();
      } else {
        toast.error(data.error || 'Transfer failed');
      }
    } catch {
      toast.error('Network error. Please try again.');
    } finally {
      setTransferring(false);
    }
  };

  const formatDateTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const bookingColumns: ColumnDef<any, any>[] = useMemo(() => [
    {
      accessorKey: 'start_time',
      header: 'Session Timings',
      cell: ({ getValue }) => formatDateTime(getValue()),
    },
    {
      accessorKey: 'title',
      header: 'Session Type',
    },
    {
      id: 'mode',
      header: 'Mode',
      enableSorting: false,
      cell: ({ row }) => row.original.meet_link ? 'Google Meet' : (row.original.location_type === 'in_person' ? 'In-person' : 'Google Meet'),
    },
  ], []);

  return (
    <div className={styles.clientView}>
      <div className={styles.clientLayout}>
        <div className={styles.leftPanel}>
          <div className={styles.clientTitleSection}>
            <button className={styles.backButton} onClick={onBack}>
              <ArrowLeft size="medium" primaryColor="#000000" />
            </button>
            <div className={styles.clientInfo}>
              <h1>{editData.name}</h1>
              <p>Client ID: {client.id}</p>
            </div>
            {isEditing ? null : (
              <div className={styles.actionMenuWrapper} ref={actionMenuRef}>
                <button className={styles.actionMenuBtn} onClick={() => setShowActionMenu(!showActionMenu)}>···</button>
                {showActionMenu && (
                  <div className={styles.actionMenuDropdown}>
                    <div className={styles.actionMenuItem} onClick={() => { handleEditClient(); setShowActionMenu(false); }}>Edit</div>
                    <div className={styles.actionMenuItem} onClick={() => { setShowActionMenu(false); setShowTransferModal(true); }}>Transfer</div>
                    {client.manually_added && !isTransferredClient && (
                      <div className={styles.actionMenuItem} onClick={() => { setShowActionMenu(false); setShowDeleteModal(true); }} style={{ color: '#e53935' }}>Delete</div>
                    )}
                    {isTransferredClient && (
                      <div className={styles.actionMenuItem} style={{ color: '#9CA3AF', fontSize: '12px', cursor: 'default' }}
                        onClick={() => { setShowActionMenu(false); toast.info('Transferred clients cannot be deleted. Contact support@mellominds.co.in'); }}>
                        Cannot Delete (Transferred)
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className={styles.infoSection}>
            <h3>Contact Info:</h3>
            <div className={styles.contactItem}>
              <Call size="small" primaryColor="#000000" />
              <span>{editData.phone || '-'}</span>
            </div>
            <div className={styles.contactItem}>
              <Message size="small" primaryColor="#000000" />
              <span>{editData.email || '-'}</span>
            </div>
          </div>

          <div className={styles.infoSection}>
            <h3>Emergency Contact:</h3>
            <div className={styles.emergencyContactCard}>
              <div className={styles.emergencyName}>
                {editData.emergencyName || '—'}
                <span className={styles.relationship}> ({editData.emergencyRelation || '—'})</span>
              </div>
              <div className={styles.emergencyPhone}>{editData.emergencyPhone || '—'}</div>
            </div>
          </div>

          <div className={styles.infoSection}>
            <h3>Demographics:</h3>
            {transferInfo?.transferred && (
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                background: '#e8f4fd', border: '1px solid #90caf9',
                borderRadius: '8px', padding: '6px 12px', marginBottom: '12px',
                fontSize: '12px', fontFamily: 'Urbanist', fontWeight: 600, color: '#1565c0'
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>
                </svg>
                Transferred from {transferInfo.from_therapist_email}
                {transferInfo.created_at && (
                  <span style={{ fontWeight: 400, color: '#5c8fc7' }}>
                    · {new Date(transferInfo.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                )}
              </div>
            )}
            <div className={styles.demographicsGrid}>
              <div className={styles.demoRow}>
                <span className={styles.demoLabel}>Age</span>
                <span className={styles.demoValue}>{editData.age || '—'}</span>
                <span className={styles.demoLabel}>Occupation</span>
                <span className={styles.demoValue}>{editData.occupation || '—'}</span>
              </div>
              <div className={styles.demoRow}>
                <span className={styles.demoLabel}>Gender</span>
                <span className={styles.demoValue}>{editData.gender || '—'}</span>
                <span className={styles.demoLabel}>Marital Status</span>
                <span className={styles.demoValue}>{editData.maritalStatus || '—'}</span>
              </div>
            </div>
          </div>

          <div className={styles.infoSection}>
            <h3>Clinical Profile:</h3>
            <div className={styles.clinicalProfileCard}>
              <button className={styles.addClinicalBtn}>+ add clinical profile</button>
            </div>
          </div>
        </div>

        <div className={styles.rightPanel}>
          <div className={styles.tabNavigation}>
            {tabs.map((tab) => (
              <button
                key={tab}
                className={`${styles.tabButton} ${activeTab === tab ? styles.active : ''}`}
                onClick={() => setActiveTab(tab)}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className={styles.tabContent}>
            {activeTab === 'Overview' && (
              <div className={styles.overviewContent}>
                <div className={styles.sessionsHeader}>
                  <div className={styles.dateSelector} onClick={() => setShowDateDropdown(!showDateDropdown)}>
                    <div className={styles.dateIcon}>
                      <Calendar size="small" primaryColor="#6E6E6E" />
                    </div>
                    <span>{selectedDate === 'all' ? 'All Time' : selectedDate}</span>
                    <div className={styles.dropdownArrow}>
                      <ChevronDown size="small" primaryColor="#6E6E6E" />
                    </div>
                    {showDateDropdown && (
                      <div className={styles.dateDropdown} onClick={e => e.stopPropagation()}>
                        <div className={styles.dropdownItem} onClick={() => { setSelectedDate('all'); setShowDateDropdown(false); }}>All Time</div>
                        {(() => {
                          const now = new Date();
                          const months = [];
                          for (let i = 0; i < 6; i++) {
                            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
                            const label = d.toLocaleString('en-US', { month: 'short' }) + ' ' + d.getFullYear();
                            months.push(<div key={label} className={styles.dropdownItem} onClick={() => { setSelectedDate(label); setShowDateDropdown(false); }}>{label}</div>);
                          }
                          return months;
                        })()}
                      </div>
                    )}
                  </div>
                </div>

                <div className={styles.statsGrid}>
                  <div className={styles.statCard}>
                    <div className={styles.statLabel}>Sessions</div>
                    <div className={styles.statValue}>{stats.sessions}</div>
                  </div>
                  <div className={styles.statCard}>
                    <div className={styles.statLabel}>Revenue</div>
                    <div className={styles.statValue}>{stats.revenue}</div>
                  </div>
                  <div className={styles.statCard}>
                    <div className={styles.statLabel}>Next Session</div>
                    <div className={styles.statValue}>{stats.nextSession}</div>
                  </div>
                  <div className={styles.statCard}>
                    <div className={styles.statLabel}>Cancellation</div>
                    <div className={styles.statValue}>{stats.cancellations}</div>
                  </div>
                  <div className={styles.statCard}>
                    <div className={styles.statLabel}>No Show</div>
                    <div className={styles.statValue}>{stats.noShow}</div>
                  </div>
                </div>

                <div className={styles.appointmentsSection}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <h3 style={{ margin: 0 }}>Bookings</h3>
                    <button
                      onClick={() => setShowCreateBookingModal(true)}
                      style={{ padding: '7px 16px', background: '#082421', color: '#fff', border: 'none', borderRadius: '8px', fontFamily: 'Urbanist', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}
                    >
                      + Create Booking
                    </button>
                  </div>
                  <DataTable
                    data={appointments}
                    columns={bookingColumns}
                    pageSize={3}
                    emptyMessage="No bookings found"
                  />
                </div>
              </div>
            )}

            {activeTab === 'Session Notes' && (
              <>
                <div className={styles.sessionList}>
                  {appointments.length === 0 && (
                    <div style={{ padding: '20px', textAlign: 'center', color: '#6E6E6E', fontSize: '14px' }}>No bookings found for this client.</div>
                  )}
                  {appointments.map((app, i) => (
                    <div className={styles.sessionItem} key={i}>
                      <div className={styles.sessionHeader}>
                        <span className={styles.sessionTime}>{formatDateTime(app.start_time)}</span>
                        <div className={styles.sessionTags}>
                          <span className={styles.sessionMode}>{app.meet_link ? 'Google Meet' : (app.location_type === 'in_person' ? 'In-person' : 'Google Meet')}</span>
                          <span className={styles.sessionType}>{app.title}</span>
                          <span style={{
                            fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '12px',
                            background: app.status === 'cancelled' ? '#fdecea' : app.status === 'noshow' ? '#fff3e0' : '#e8f5e9',
                            color: app.status === 'cancelled' ? '#c62828' : app.status === 'noshow' ? '#e65100' : '#2e7d32',
                            textTransform: 'capitalize'
                          }}>{app.status || 'scheduled'}</span>
                        </div>
                      </div>
                      <div className={styles.sessionNotes}>
                        {app.notes && app.notes.length > 0 ? (
                          app.notes.map((note: any, idx: number) => (
                            <div key={idx} style={{ marginBottom: '8px', padding: '10px 12px', background: '#f8fffe', borderRadius: '8px', border: '1px solid #e9ecef' }}>
                              <div style={{ fontSize: '11px', color: '#9CA3AF', marginBottom: '4px', fontFamily: 'Urbanist' }}>
                                {new Date(note.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                              </div>
                              <div style={{ fontSize: '14px', fontFamily: 'Urbanist', fontWeight: 500, color: '#1a1a1a' }}>
                                {typeof note.content === 'object' ? note.content?.text : note.content}
                              </div>
                            </div>
                          ))
                        ) : (
                          <div style={{ fontSize: '13px', color: '#9CA3AF', fontStyle: 'italic', padding: '4px 0' }}>No notes for this session.</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <div className={styles.addNotesSection}>
                  <button className={styles.addNotesButton} onClick={() => setShowAddNotesModal(true)}>+ Add Note</button>
                </div>
              </>
            )}


            {activeTab === 'Activity Suggestion' && (
              <div className={styles.activityContent}>
                <div className={styles.sessionsHeader}>
                  <div className={styles.dateSelector} onClick={() => setShowDateDropdown(!showDateDropdown)}>
                    <div className={styles.dateIcon}>
                      <Calendar size="small" primaryColor="#6E6E6E" />
                    </div>
                    <span>{selectedDate}</span>
                    <div className={styles.dropdownArrow}>
                      <ChevronDown size="small" primaryColor="#6E6E6E" />
                    </div>
                    {showDateDropdown && (
                      <div className={styles.dateDropdown}>
                        <div className={styles.dropdownHeader}>Custom Dates</div>
                        <div className={styles.dropdownItem} onClick={(e) => { e.stopPropagation(); setSelectedDate('Nov 2025'); setShowDateDropdown(false); }}>Nov 2025</div>
                        <div className={styles.dropdownItem} onClick={(e) => { e.stopPropagation(); setSelectedDate('Oct 2025'); setShowDateDropdown(false); }}>Oct 2025</div>
                        <div className={styles.dropdownItem} onClick={(e) => { e.stopPropagation(); setSelectedDate('Sep 2025'); setShowDateDropdown(false); }}>Sep 2025</div>
                        <div className={styles.dropdownItem} onClick={(e) => { e.stopPropagation(); setSelectedDate('Aug 2025'); setShowDateDropdown(false); }}>Aug 2025</div>
                        <div className={styles.dropdownItem} onClick={(e) => { e.stopPropagation(); setSelectedDate('Jul 2025'); setShowDateDropdown(false); }}>Jul 2025</div>
                      </div>
                    )}
                  </div>
                </div>

                <div className={styles.activityList}>
                  {activities.length === 0 ? (
                    <div style={{ padding: '20px', textAlign: 'center', color: '#6E6E6E', fontSize: '14px' }}>No activities added yet.</div>
                  ) : (
                    activities.map((act) => (
                      <div className={styles.activityItem} key={act.id}>
                        <div className={styles.activityInfo}>
                          <div className={styles.activityName}>{act.name}</div>
                          <div className={styles.activityDescription}>{act.description || '—'}</div>
                        </div>
                        <button className={styles.deleteBtn} onClick={() => handleDeleteActivity(act.id)}>
                          <Delete size="small" primaryColor="#dc3545" />
                        </button>
                      </div>
                    ))
                  )}
                </div>

                <button className={styles.addActivitiesBtn} onClick={() => setShowAddActivitiesModal(true)}>+ Add Activities</button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Edit Client Modal */}
      {isEditing && (
        <div className={styles.modalOverlay} onClick={handleCancelEdit}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()} style={{ maxWidth: '560px', width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
              <h2 style={{ fontFamily: 'Urbanist', fontWeight: 700, fontSize: '20px', margin: 0 }}>Edit Client Details</h2>
              <button onClick={handleCancelEdit} style={{ background: 'none', border: 'none', fontSize: '22px', cursor: 'pointer', color: '#666', lineHeight: 1 }}>×</button>
            </div>
            <p style={{ fontFamily: 'Urbanist', fontSize: '14px', color: '#6E6E6E', margin: '0 0 24px 0' }}>Update client information below</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className={styles.formGroup}>
                <label>Full Name</label>
                <input className={styles.formInput} type="text" value={editData.name} onChange={(e) => setEditData({ ...editData, name: e.target.value })} />
              </div>
              <div className={styles.formGroup}>
                <label>Phone</label>
                <input className={styles.formInput} type="text" value={editData.phone} onChange={(e) => setEditData({ ...editData, phone: e.target.value })} />
              </div>
              <div className={styles.formGroup} style={{ gridColumn: '1 / -1' }}>
                <label>Email</label>
                <input className={styles.formInput} type="email" value={editData.email} onChange={(e) => setEditData({ ...editData, email: e.target.value })} />
              </div>
              <div className={styles.formGroup}>
                <label>Age</label>
                <input className={styles.formInput} type="text" value={editData.age} onChange={(e) => setEditData({ ...editData, age: e.target.value })} />
              </div>
              <div className={styles.formGroup}>
                <label>Occupation</label>
                <input className={styles.formInput} type="text" value={editData.occupation} onChange={(e) => setEditData({ ...editData, occupation: e.target.value })} />
              </div>
              <div className={styles.formGroup}>
                <label>Gender</label>
                <select className={styles.formSelect} value={editData.gender} onChange={(e) => setEditData({ ...editData, gender: e.target.value })}>
                  <option>Male</option>
                  <option>Female</option>
                  <option>Other</option>
                </select>
              </div>
              <div className={styles.formGroup}>
                <label>Marital Status</label>
                <select className={styles.formSelect} value={editData.maritalStatus} onChange={(e) => setEditData({ ...editData, maritalStatus: e.target.value })}>
                  <option>Single</option>
                  <option>Married</option>
                  <option>Divorced</option>
                </select>
              </div>
              <div className={styles.formGroup}>
                <label>Emergency Contact Name</label>
                <input className={styles.formInput} type="text" value={editData.emergencyName} onChange={(e) => setEditData({ ...editData, emergencyName: e.target.value })} />
              </div>
              <div className={styles.formGroup}>
                <label>Relation</label>
                <input className={styles.formInput} type="text" value={editData.emergencyRelation} onChange={(e) => setEditData({ ...editData, emergencyRelation: e.target.value })} />
              </div>
              <div className={styles.formGroup} style={{ gridColumn: '1 / -1' }}>
                <label>Emergency Phone</label>
                <input className={styles.formInput} type="text" value={editData.emergencyPhone} onChange={(e) => setEditData({ ...editData, emergencyPhone: e.target.value })} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px' }}>
              <button className={styles.editButton} style={{ background: '#f1f3f4', color: '#082421' }} onClick={handleCancelEdit}>Cancel</button>
              <button className={styles.editButton} onClick={handleSaveEdit}>Save Changes</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Notes Modal */}
      {showAddNotesModal && (
        <div className={styles.modalOverlay} onClick={() => setShowAddNotesModal(false)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <h2 style={{ margin: 0 }}>+ Add Notes</h2>
              <button onClick={() => setShowAddNotesModal(false)} style={{ background: 'none', border: 'none', fontSize: '22px', cursor: 'pointer', color: '#666', lineHeight: 1 }}>×</button>
            </div>
            <p>add private notes to a dedicated client booking.</p>

            <div className={styles.formGroup}>
              <label>Select Booking</label>
              <select
                className={styles.formSelect}
                value={selectedAppointmentId}
                onChange={(e) => setSelectedAppointmentId(e.target.value)}
              >
                <option value="">Select booking</option>
                {appointments.map(app => (
                  <option key={app.id} value={app.id}>
                    {formatDateTime(app.start_time)} - {app.title}{app.notes?.length > 0 ? ' ✓' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.formGroup}>
              <label>Note Content</label>
              <textarea
                placeholder="Enter session notes here..."
                className={styles.formInput}
                style={{ height: '100px', padding: '8px' }}
                value={noteContent}
                onChange={(e) => setNoteContent(e.target.value)}
              />
            </div>

            <button className={styles.modalSubmitBtn} onClick={handleNoteSubmit}>Add Notes</button>
          </div>
        </div>
      )}


      {/* Add Activities Modal */}
      {showAddActivitiesModal && (
        <div className={styles.modalOverlay} onClick={() => setShowAddActivitiesModal(false)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <h2 style={{ margin: 0 }}>+ Add Activity</h2>
              <button onClick={() => setShowAddActivitiesModal(false)} style={{ background: 'none', border: 'none', fontSize: '22px', cursor: 'pointer', color: '#666', lineHeight: 1 }}>×</button>
            </div>
            <p>Add an activity suggestion for this client.</p>

            <div className={styles.formGroup}>
              <label>Visible to client?</label>
              <select className={styles.formSelect} value={activityForm.visible_to_client ? 'Yes' : 'No'}
                onChange={(e) => setActivityForm({ ...activityForm, visible_to_client: e.target.value === 'Yes' })}>
                <option>No</option>
                <option>Yes</option>
              </select>
            </div>

            <div className={styles.formGroup}>
              <label>Activity Name</label>
              <input type="text" placeholder="Enter activity name" className={styles.formInput}
                value={activityForm.name} onChange={(e) => setActivityForm({ ...activityForm, name: e.target.value })} />
            </div>

            <div className={styles.formGroup}>
              <label>Activity Description</label>
              <textarea placeholder="Enter activity description" className={styles.formTextarea} rows={4}
                value={activityForm.description} onChange={(e) => setActivityForm({ ...activityForm, description: e.target.value })}></textarea>
            </div>

            <button className={styles.modalSubmitBtn} onClick={handleActivitySubmit}>Add Activity</button>
          </div>
        </div>
      )}

      {/* Delete Client Confirmation Modal */}
      {showDeleteModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}
          onClick={() => !deleting && setShowDeleteModal(false)}>
          <div style={{ background: '#fff', borderRadius: '16px', padding: '32px 28px', width: '100%', maxWidth: '400px', boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#fdecea', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#e53935" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                </svg>
              </div>
              <h3 style={{ fontFamily: 'Urbanist', fontWeight: 700, fontSize: '18px', color: '#1a1a1a', margin: 0 }}>Delete Client?</h3>
              <button onClick={() => setShowDeleteModal(false)} style={{ marginLeft: 'auto', background: 'none', border: 'none', fontSize: '22px', cursor: 'pointer', color: '#666', lineHeight: 1 }}>×</button>
            </div>
            <p style={{ fontFamily: 'Urbanist', fontWeight: 500, fontSize: '14px', color: '#6E6E6E', marginBottom: '24px', lineHeight: 1.6 }}>
              Are you sure you want to delete <strong>{client.name}</strong>? This will remove their profile. Their booking history will be preserved.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowDeleteModal(false)} disabled={deleting}
                style={{ padding: '10px 20px', borderRadius: '8px', border: '1px solid #e0e0e0', background: '#fff', fontFamily: 'Urbanist', fontWeight: 500, fontSize: '14px', color: '#333', cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={handleDeleteClient} disabled={deleting}
                style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', background: '#e53935', fontFamily: 'Urbanist', fontWeight: 600, fontSize: '14px', color: '#fff', cursor: deleting ? 'not-allowed' : 'pointer', opacity: deleting ? 0.7 : 1 }}>
                {deleting ? 'Deleting...' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Transfer Client Modal */}
      {showTransferModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}
          onClick={() => { if (!transferring) { setShowTransferModal(false); setTransferEmail(''); setEmailLookup({ status: 'idle' }); } }}>
          <div style={{ background: '#fff', borderRadius: '16px', padding: '32px 28px', width: '100%', maxWidth: '460px', boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }}
            onClick={e => e.stopPropagation()}>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h3 style={{ fontFamily: 'Urbanist', fontWeight: 700, fontSize: '18px', color: '#1a1a1a', margin: '0 0 6px 0' }}>Transfer Client</h3>
                <p style={{ fontFamily: 'Urbanist', fontSize: '14px', color: '#6E6E6E', margin: '0 0 24px 0' }}>
                  Transfer <strong>{client.name}</strong> to another therapist using their registered email.
                </p>
              </div>
              <button onClick={() => { setShowTransferModal(false); setTransferEmail(''); setEmailLookup({ status: 'idle' }); }} style={{ background: 'none', border: 'none', fontSize: '22px', cursor: 'pointer', color: '#666', lineHeight: 1, flexShrink: 0 }}>×</button>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ fontFamily: 'Urbanist', fontWeight: 600, fontSize: '13px', color: '#333', display: 'block', marginBottom: '6px' }}>
                Therapist Email *
              </label>
              <input
                type="email"
                placeholder="therapist@example.com"
                value={transferEmail}
                onChange={e => handleTransferEmailChange(e.target.value)}
                style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: `1px solid ${emailLookup.status === 'found' ? '#4caf50' : emailLookup.status === 'notfound' ? '#e53935' : '#e0e0e0'}`, fontFamily: 'Urbanist', fontSize: '14px', boxSizing: 'border-box' }}
              />
              {emailLookup.status === 'checking' && (
                <p style={{ fontSize: '12px', color: '#9CA3AF', margin: '4px 0 0', fontFamily: 'Urbanist' }}>Checking...</p>
              )}
              {emailLookup.status === 'found' && (
                <p style={{ fontSize: '12px', color: '#4caf50', margin: '4px 0 0', fontFamily: 'Urbanist' }}>✓ Found: {emailLookup.name}</p>
              )}
              {emailLookup.status === 'notfound' && (
                <p style={{ fontSize: '12px', color: '#e53935', margin: '4px 0 0', fontFamily: 'Urbanist' }}>✗ No therapist found with this email</p>
              )}
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{ fontFamily: 'Urbanist', fontWeight: 600, fontSize: '13px', color: '#333', display: 'block', marginBottom: '12px' }}>
                What to transfer?
              </label>
              <p style={{ fontFamily: 'Urbanist', fontSize: '12px', color: '#9CA3AF', margin: '0 0 12px 0' }}>
                Client profile is always transferred. Select additional data below.
              </p>

              {[
                { key: 'notes', label: 'Session Notes', desc: 'All session notes for this client', disabled: false },
                { key: 'activities', label: 'Activity Suggestions', desc: 'All activity suggestions for this client', disabled: false },
                { key: 'clinical_profile', label: 'Clinical Profile', desc: 'Coming soon — not available yet', disabled: true },
              ].map(opt => (
                <label key={opt.key} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '12px', cursor: opt.disabled ? 'not-allowed' : 'pointer', opacity: opt.disabled ? 0.45 : 1 }}>
                  <input
                    type="checkbox"
                    disabled={opt.disabled}
                    checked={transferOptions[opt.key as keyof typeof transferOptions]}
                    onChange={e => setTransferOptions(prev => ({ ...prev, [opt.key]: e.target.checked }))}
                    style={{ marginTop: '3px', accentColor: '#082421', width: '16px', height: '16px', flexShrink: 0 }}
                  />
                  <div>
                    <div style={{ fontFamily: 'Urbanist', fontWeight: 600, fontSize: '14px', color: '#1a1a1a' }}>
                      {opt.label}
                      {opt.disabled && <span style={{ marginLeft: '8px', fontSize: '11px', background: '#f1f3f4', color: '#9CA3AF', padding: '2px 6px', borderRadius: '4px' }}>Coming soon</span>}
                    </div>
                    <div style={{ fontFamily: 'Urbanist', fontSize: '12px', color: '#9CA3AF' }}>{opt.desc}</div>
                  </div>
                </label>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button onClick={() => { setShowTransferModal(false); setTransferEmail(''); setEmailLookup({ status: 'idle' }); }} disabled={transferring}
                style={{ padding: '10px 20px', borderRadius: '8px', border: '1px solid #e0e0e0', background: '#fff', fontFamily: 'Urbanist', fontWeight: 500, fontSize: '14px', color: '#333', cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={handleTransferClient} disabled={transferring}
                style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', background: '#082421', fontFamily: 'Urbanist', fontWeight: 600, fontSize: '14px', color: '#fff', cursor: transferring ? 'not-allowed' : 'pointer', opacity: transferring ? 0.7 : 1 }}>
                {transferring ? 'Sending Request...' : 'Send Transfer Request'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Create Booking Modal */}
      {showCreateBookingModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}
          onClick={() => setShowCreateBookingModal(false)}>
          <div style={{ background: '#fff', borderRadius: '16px', width: '100%', maxWidth: '700px', maxHeight: '90vh', overflowY: 'auto', position: 'relative' }}
            onClick={e => e.stopPropagation()}>
            <button onClick={() => setShowCreateBookingModal(false)} style={{ position: 'absolute', top: '16px', right: '16px', background: 'none', border: 'none', fontSize: '22px', cursor: 'pointer', color: '#666', zIndex: 1 }}>×</button>
            <CreateBooking
              onBack={() => { setShowCreateBookingModal(false); setRefreshTrigger(prev => prev + 1); }}
              prefillClient={{ name: editData.name, email: editData.email, phone: editData.phone }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default ClientView;