import React, { useState, useEffect } from 'react';
import styles from './Appointments.module.css';
import { Search, Upload, MoreCircle } from 'react-iconly';

const Appointments: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('Upcoming');
  const [appointments, setAppointments] = useState<any[]>([]);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const itemsPerPage = 10;

  const tabs = ['Upcoming', 'All Appointments', 'Completed', 'No Show', 'Cancelled'];

  // Reset to page 1 when tab changes
  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab]);

  useEffect(() => {
    const fetchAppointments = async () => {
      try {
        const response = await fetch('http://localhost:3001/api/bookings', {
          credentials: 'include'
        });
        if (response.ok) {
          const data = await response.json();
          setAppointments(data);
        }
      } catch (error) {
        console.error('Failed to fetch appointments:', error);
      }
    };
    fetchAppointments();
  }, []);

  const formatDateTime = (isoString: string, durationMinutes: number = 60) => {
    const startDate = new Date(isoString);
    const endDate = new Date(startDate.getTime() + durationMinutes * 60000);

    return `${startDate.toLocaleString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })} at ${startDate.toLocaleString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })} - ${endDate.toLocaleString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })} IST`;
  };

  const getFilteredAppointments = () => {
    const now = new Date();
    return appointments.filter(app => {
      const startTime = new Date(app.start_time);

      switch (activeTab) {
        case 'Upcoming':
          return startTime > now && app.status !== 'cancelled';
        case 'Completed':
          return startTime < now && app.status !== 'cancelled';
        case 'Cancelled':
          return app.status === 'cancelled';
        case 'No Show':
          return app.status === 'noshow'; // Assuming noshow status exists
        case 'All Appointments':
        default:
          return true;
      }
    });
  };

  const filteredAppointments = getFilteredAppointments();

  // Get current posts
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredAppointments.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredAppointments.length / itemsPerPage);

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  return (
    <div className={styles.appointmentsPage}>
      <div className={styles.appointmentsHeader}>
        <div className={styles.headerContent}>
          <h1>My Appointments</h1>
          <p>View Recently Book Session, Send Invite and more...</p>
        </div>
        <div className={styles.headerActions}>
          <div className={styles.searchContainer}>
            <Search size="small" primaryColor="#6E6E6E" />
            <input type="text" placeholder="Search users by name, or phone no" />
          </div>
          <button className={styles.exportBtn}>
            <img src="/Upload.svg" alt="" />
            Export to CSV
          </button>
        </div>
      </div>

      <div className={styles.appointmentsTabs}>
        {tabs.map((tab) => (
          <button
            key={tab}
            className={`${styles.tabBtn} ${activeTab === tab ? styles.active : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className={styles.tableContainer}>
        {filteredAppointments.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#666' }}>No appointments found</div>
        ) : (
          <table className={styles.appointmentsTable}>
            <thead>
              <tr>
                <th>Client Details</th>
                <th>Session Type</th>
                <th>Session Timing</th>
                <th>Mode</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {currentItems.map((appointment, index) => (
                <tr key={index}>
                  <td>
                    <div className={styles.clientDetails}>
                      <div className={styles.clientName}>{appointment.client_name || 'Unknown'}</div>
                      <div className={styles.clientPhone}>{appointment.client_phone || '-'}</div>
                    </div>
                  </td>
                  <td>{appointment.title}</td>
                  <td>{formatDateTime(appointment.start_time)}</td>
                  <td>{appointment.meet_link ? 'Google Meet' : 'In-person'}</td>
                  <td>{appointment.status || 'Scheduled'}</td>
                  <td>
                    <button className={styles.actionsBtn}>
                      <MoreCircle set="light" size={24} primaryColor="#6E6E6E" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {filteredAppointments.length > 0 && (
        <div className={styles.pagination}>
          <span>Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, filteredAppointments.length)} of {filteredAppointments.length} results</span>
          <div className={styles.paginationControls}>
            <img
              src="/Arrow - Left Square.svg"
              alt="Previous"
              className={styles.paginationBtn}
              style={{ opacity: currentPage === 1 ? 0.5 : 1, cursor: currentPage === 1 ? 'default' : 'pointer' }}
              onClick={handlePrevPage}
            />
            <span style={{ margin: '0 10px', fontSize: '14px', fontWeight: 500 }}>Page {currentPage} of {totalPages}</span>
            <img
              src="/Arrow - Right Square.svg"
              alt="Next"
              className={styles.paginationBtn}
              style={{ opacity: currentPage === totalPages ? 0.5 : 1, cursor: currentPage === totalPages ? 'default' : 'pointer' }}
              onClick={handleNextPage}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default Appointments;
