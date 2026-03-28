import React, { useState, useEffect, useMemo } from 'react';
import styles from './ClientView.module.css';
import { Delete, EditSquare, Call, Message, Calendar, ArrowLeft, ChevronDown } from 'react-iconly';
import CustomDropdown from './components/CustomDropdown';
import { useToast } from './context/ToastContext';
import API_BASE_URL from './config/api';
import DataTable from './components/DataTable';
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

  const fetchActivities = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/activities/${client.id}`, { credentials: 'include' });
      if (res.ok) setActivities(await res.json());
    } catch (e) { console.error('Failed to fetch activities:', e); }
  };

  useEffect(() => { fetchActivities(); }, [client.id]);

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

  const tabs: string[] = ['Overview', 'Session Notes', 'Activity Suggestion'];

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
                    <div className={styles.actionMenuItem} onClick={() => { setShowActionMenu(false); toast.info('Transfer feature coming soon'); }}>Transfer</div>
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
                  <h3>Bookings</h3>
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
            <h2 style={{ fontFamily: 'Urbanist', fontWeight: 700, fontSize: '20px', margin: '0 0 4px 0' }}>Edit Client Details</h2>
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
            <h2>+ Add Notes</h2>
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
            <h2>+ Add Activity</h2>
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
    </div>
  );
};

export default ClientView;