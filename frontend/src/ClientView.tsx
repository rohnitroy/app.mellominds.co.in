import React, { useState, useEffect } from 'react';
import styles from './ClientView.module.css';
import { Delete, EditSquare, Call, Message, Calendar, ArrowLeft, ChevronDown } from 'react-iconly';
import CustomDropdown from './components/CustomDropdown';
import { useToast } from './context/ToastContext';

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
  const [selectedDate, setSelectedDate] = useState<string>('Dec 2025');
  const [showDateDropdown, setShowDateDropdown] = useState<boolean>(false);
  const [showAddNotesModal, setShowAddNotesModal] = useState<boolean>(false);
  const [showAddActivitiesModal, setShowAddActivitiesModal] = useState<boolean>(false);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [isEditHovered, setIsEditHovered] = useState<boolean>(false);

  // Real data state
  const [appointments, setAppointments] = useState<any[]>([]);
  const [stats, setStats] = useState({
    sessions: '0',
    revenue: '₹0',
    nextSession: '-',
    cancellations: '0',
    noShow: '0'
  });

  const [editData, setEditData] = useState({
    name: client.name || '',
    phone: client.phone || '',
    email: client.email || '',
    emergencyName: client.emergencyName || '-',
    emergencyRelation: client.emergencyRelation || '-',
    emergencyPhone: client.emergencyPhone || '-',
    age: client.age || '-',
    occupation: client.occupation || '-',
    gender: client.gender || 'Male',
    maritalStatus: client.maritalStatus || 'Single'
  });

  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string>('');
  const [noteContent, setNoteContent] = useState<string>('');
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const fetchClientData = async () => {
    if (!client.email) return;
    try {
      const response = await fetch(`http://localhost:3001/api/bookings?email=${encodeURIComponent(client.email)}`, {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setAppointments(data);

        const totalSessions = data.length;
        const totalRevenue = data.reduce((sum: number, app: any) => sum + (parseFloat(app.payment_amount) || 0), 0);
        const cancelled = data.filter((app: any) => app.status === 'cancelled').length;
        const noShow = data.filter((app: any) => app.status === 'noshow').length;

        const now = new Date();
        const upcoming = data
          .filter((app: any) => new Date(app.start_time) > now)
          .sort((a: any, b: any) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())[0];

        const nextSessionDate = upcoming ? new Date(upcoming.start_time).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '-';

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
  }, [client.email, refreshTrigger]);

  const handleNoteSubmit = async () => {
    if (!selectedAppointmentId || !noteContent) {
      toast.warning('Please select an appointment and enter note content.');
      return;
    }

    try {
      const response = await fetch('http://localhost:3001/api/notes', {
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
    setIsEditing(!isEditing);
  };

  const handleSaveEdit = async () => {
    try {
      const response = await fetch(`http://localhost:3001/api/clients/${client.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(editData),
        credentials: 'include'
      });

      if (response.ok) {
        // const updatedClient = await response.json();
        setIsEditing(false);
        toast.success('Client information updated successfully!');
        // Ideally update local state or trigger refresh
        setRefreshTrigger(prev => prev + 1);
      } else {
        toast.error('Failed to update client information.');
      }
    } catch (error) {
      console.error('Error updating client:', error);
      toast.error('Error updating client information.');
    }
  };

  const tabs: string[] = ['Overview', 'Sessions', 'Activity Suggestion'];

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

  return (
    <div className={styles.clientView}>
      <div className={styles.clientLayout}>
        <div className={styles.leftPanel}>
          <div className={styles.clientTitleSection}>
            <button className={styles.backButton} onClick={onBack}>
              <ArrowLeft size="medium" primaryColor="#000000" />
            </button>
            <div className={styles.clientInfo}>
              {isEditing ? (
                <input
                  type="text"
                  value={editData.name}
                  onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                  style={{ fontSize: '25px', fontWeight: '700', border: '1px solid #ccc', padding: '4px' }}
                />
              ) : (
                <h1>{client.name}</h1>
              )}
              <p>Client ID: {client.id}</p>
            </div>
            <button
              className={styles.editButton}
              onClick={isEditing ? handleSaveEdit : handleEditClient}
              onMouseEnter={() => setIsEditHovered(true)}
              onMouseLeave={() => setIsEditHovered(false)}
            >
              <EditSquare size="small" primaryColor={isEditHovered ? "#ffffff" : "#2D7579"} />
              {isEditing ? 'Save' : 'Edit'}
            </button>
          </div>

          <div className={styles.infoSection}>
            <h3>Contact Info:</h3>
            <div className={styles.contactItem}>
              <Call size="small" primaryColor="#000000" />
              {isEditing ? (
                <input
                  type="text"
                  value={editData.phone}
                  onChange={(e) => setEditData({ ...editData, phone: e.target.value })}
                  style={{ border: '1px solid #ccc', padding: '2px' }}
                />
              ) : (
                <span>{editData.phone || '-'}</span>
              )}
            </div>
            <div className={styles.contactItem}>
              <Message size="small" primaryColor="#000000" />
              {isEditing ? (
                <input
                  type="email"
                  value={editData.email}
                  onChange={(e) => setEditData({ ...editData, email: e.target.value })}
                  style={{ border: '1px solid #ccc', padding: '2px' }}
                />
              ) : (
                <span>{editData.email || '-'}</span>
              )}
            </div>
          </div>

          <div className={styles.infoSection}>
            <h3>Emergency Contact:</h3>
            <div className={styles.emergencyContactCard}>
              <div className={styles.emergencyName}>
                {isEditing ? (
                  <input
                    type="text"
                    value={editData.emergencyName}
                    onChange={(e) => setEditData({ ...editData, emergencyName: e.target.value })}
                    style={{ border: '1px solid #ccc', padding: '2px', marginRight: '8px' }}
                  />
                ) : (
                  editData.emergencyName
                )}
                <span className={styles.relationship}>
                  ({isEditing ? (
                    <input
                      type="text"
                      value={editData.emergencyRelation}
                      onChange={(e) => setEditData({ ...editData, emergencyRelation: e.target.value })}
                      style={{ border: '1px solid #ccc', padding: '2px', width: '80px' }}
                    />
                  ) : (
                    editData.emergencyRelation
                  )})
                </span>
              </div>
              <div className={styles.emergencyPhone}>
                {isEditing ? (
                  <input
                    type="text"
                    value={editData.emergencyPhone}
                    onChange={(e) => setEditData({ ...editData, emergencyPhone: e.target.value })}
                    style={{ border: '1px solid #ccc', padding: '2px' }}
                  />
                ) : (
                  editData.emergencyPhone
                )}
              </div>
            </div>
          </div>

          <div className={styles.infoSection}>
            <h3>Demographics:</h3>
            <div className={styles.demographicsGrid}>
              <div className={styles.demoRow}>
                <span className={styles.demoLabel}>Age</span>
                {isEditing ? (
                  <input
                    type="text"
                    value={editData.age}
                    onChange={(e) => setEditData({ ...editData, age: e.target.value })}
                    style={{ border: '1px solid #ccc', padding: '2px', width: '50px' }}
                  />
                ) : (
                  <span className={styles.demoValue}>{editData.age}</span>
                )}
                <span className={styles.demoLabel}>Occupation</span>
                {isEditing ? (
                  <input
                    type="text"
                    value={editData.occupation}
                    onChange={(e) => setEditData({ ...editData, occupation: e.target.value })}
                    style={{ border: '1px solid #ccc', padding: '2px', width: '80px' }}
                  />
                ) : (
                  <span className={styles.demoValue}>{editData.occupation}</span>
                )}
              </div>
              <div className={styles.demoRow}>
                <span className={styles.demoLabel}>Gender</span>
                {isEditing ? (
                  <div style={{ minWidth: '150px' }}>
                    <CustomDropdown
                      options={[
                        { value: 'Male', label: 'Male' },
                        { value: 'Female', label: 'Female' },
                        { value: 'Other', label: 'Other' }
                      ]}
                      value={editData.gender}
                      onChange={(value) => setEditData({ ...editData, gender: value })}
                      placeholder="Select gender"
                    />
                  </div>
                ) : (
                  <span className={styles.demoValue}>{editData.gender}</span>
                )}
                <span className={styles.demoLabel}>Marital Status</span>
                {isEditing ? (
                  <div style={{ minWidth: '150px' }}>
                    <CustomDropdown
                      options={[
                        { value: 'Single', label: 'Single' },
                        { value: 'Married', label: 'Married' },
                        { value: 'Divorced', label: 'Divorced' }
                      ]}
                      value={editData.maritalStatus}
                      onChange={(value) => setEditData({ ...editData, maritalStatus: value })}
                      placeholder="Select status"
                    />
                  </div>
                ) : (
                  <span className={styles.demoValue}>{editData.maritalStatus}</span>
                )}
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
                    <span>{selectedDate}</span>
                    <div className={styles.dropdownArrow}>
                      <ChevronDown size="small" primaryColor="#6E6E6E" />
                    </div>
                    {/* Date Dropdown Logic here (omitted for brevity) */}
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
                    <div className={styles.statLabel}>NoShow</div>
                    <div className={styles.statValue}>{stats.noShow}</div>
                  </div>
                </div>

                <div className={styles.appointmentsSection}>
                  <h3>Appointments</h3>
                  <div className={styles.appointmentsTable}>
                    <div className={styles.tableHeader}>
                      <span>Session Timings</span>
                      <span>Session Type</span>
                      <span>Mode</span>
                    </div>
                    {appointments.slice(0, 3).map((app, i) => ( // Show first 3
                      <div className={styles.tableRow} key={i}>
                        <span>{formatDateTime(app.start_time)}</span>
                        <span>{app.title}</span>
                        <span>{app.meet_link ? 'Google Meet' : 'In-person'}</span>
                      </div>
                    ))}
                    {appointments.length === 0 && <div style={{ padding: '10px', textAlign: 'center' }}>No appointments found</div>}

                    <div className={styles.tableFooter}>
                      <span>Showing {Math.min(appointments.length, 3)} of {appointments.length} results</span>
                      <div className={styles.pagination}>
                        <img src="/Arrow - Left Square.svg" alt="Previous" />
                        <img src="/Arrow - Right Square.svg" alt="Next" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'Sessions' && (
              <>
                <div className={styles.sessionsHeader}>
                  {/* Header controls same as before */}
                </div>

                <div className={styles.sessionList}>
                  {appointments.map((app, i) => (
                    <div className={styles.sessionItem} key={i}>
                      <div className={styles.sessionHeader}>
                        <span className={styles.sessionTime}>{formatDateTime(app.start_time)}</span>
                      </div>
                      <div className={styles.sessionTags}>
                        <span className={styles.sessionMode}>{app.meet_link ? 'Google Meet' : 'In-person'}</span>
                        <span className={styles.sessionType}>#{app.title}</span>
                      </div>
                      <div className={styles.sessionNotes}>
                        {app.notes && app.notes.length > 0 ? (
                          app.notes.map((note: any, idx: number) => (
                            <div key={idx} style={{ marginBottom: '8px', borderBottom: '1px dashed #eee', paddingBottom: '4px' }}>
                              <div style={{ fontWeight: 'bold', fontSize: '12px', color: '#555' }}>Note {idx + 1}:</div>
                              <div>{note.content?.text || JSON.stringify(note.content)}</div>
                            </div>
                          ))
                        ) : (
                          <div>No notes added yet.</div>
                        )}
                      </div>
                    </div>
                  ))}
                  {appointments.length === 0 && <div style={{ padding: '20px' }}>No sessions found.</div>}
                </div>

                <div className={styles.addNotesSection}>
                  <button className={styles.addNotesButton} onClick={() => setShowAddNotesModal(true)}>+ Add Notes</button>
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
                  <div className={styles.activityItem}>
                    <div className={styles.activityInfo}>
                      <div className={styles.activityName}>&lt;Activity_name&gt;</div>
                      <div className={styles.activityDescription}>&lt;Activity_description&gt;</div>
                    </div>
                    <button className={styles.deleteBtn}>
                      <Delete size="small" primaryColor="#dc3545" />
                    </button>
                  </div>

                  <div className={styles.activityItem}>
                    <div className={styles.activityInfo}>
                      <div className={styles.activityName}>&lt;Activity_name&gt;</div>
                      <div className={styles.activityDescription}>&lt;Activity_description&gt;</div>
                    </div>
                    <button className={styles.deleteBtn}>
                      <Delete size="small" primaryColor="#dc3545" />
                    </button>
                  </div>

                  <div className={styles.activityItem}>
                    <div className={styles.activityInfo}>
                      <div className={styles.activityName}>&lt;Activity_name&gt;</div>
                      <div className={styles.activityDescription}>&lt;Activity_description&gt;</div>
                    </div>
                    <button className={styles.deleteBtn}>
                      <Delete size="small" primaryColor="#dc3545" />
                    </button>
                  </div>

                  <div className={styles.activityItem}>
                    <div className={styles.activityInfo}>
                      <div className={styles.activityName}>&lt;Activity_name&gt;</div>
                      <div className={styles.activityDescription}>&lt;Activity_description&gt;</div>
                    </div>
                    <button className={styles.deleteBtn}>
                      <Delete size="small" primaryColor="#dc3545" />
                    </button>
                  </div>
                </div>

                <button className={styles.addActivitiesBtn} onClick={() => setShowAddActivitiesModal(true)}>+ Add Activities</button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add Notes Modal */}
      {showAddNotesModal && (
        <div className={styles.modalOverlay} onClick={() => setShowAddNotesModal(false)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <h2>+ Add Notes</h2>
            <p>add private notes to a dedicated client appointment.</p>

            <div className={styles.formGroup}>
              <label>Select Appointment</label>
              <select
                className={styles.formSelect}
                value={selectedAppointmentId}
                onChange={(e) => setSelectedAppointmentId(e.target.value)}
              >
                <option value="">Select appointment</option>
                {appointments.map(app => (
                  <option key={app.id} value={app.id}>
                    {formatDateTime(app.start_time)} - {app.title}
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
            <p>add activity to a dedicated client appointment.</p>

            <div className={styles.formGroup}>
              <label>Should this activity visible to client?</label>
              <select className={styles.formSelect}>
                <option>select yes/no</option>
                <option>Yes</option>
                <option>No</option>
              </select>
            </div>

            <div className={styles.formGroup}>
              <label>Activity Name</label>
              <input type="text" placeholder="enter activity name" className={styles.formInput} />
            </div>

            <div className={styles.formGroup}>
              <label>Activity Description</label>
              <textarea placeholder="enter activity description" className={styles.formTextarea} rows={4}></textarea>
            </div>

            <button className={styles.modalSubmitBtn} onClick={() => setShowAddActivitiesModal(false)}>Add Activity</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClientView;