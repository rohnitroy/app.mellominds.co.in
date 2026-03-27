import React, { useState, useEffect, useMemo } from 'react';
import styles from './Appointments.module.css';
import { Search } from 'react-iconly';
import API_BASE_URL from './config/api';
import DataTable from './components/DataTable';
import { ColumnDef } from '@tanstack/react-table';

const Appointments: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('Upcoming');
  const [appointments, setAppointments] = useState<any[]>([]);

  const tabs = ['Upcoming', 'All Bookings', 'Completed', 'Pending Session Notes', 'Cancelled', 'No Show'];

  useEffect(() => {
    const fetchAppointments = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/bookings`, { credentials: 'include' });
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

  const formatDateTime = (isoString: string) => {
    const start = new Date(isoString);
    return start.toLocaleString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric',
      year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true
    });
  };

  const filteredAppointments = useMemo(() => {
    const now = new Date();
    return appointments.filter(app => {
      const startTime = new Date(app.start_time);
      switch (activeTab) {
        case 'Upcoming':
          return startTime > now && app.status !== 'cancelled' && app.status !== 'noshow';
        case 'Completed':
          return startTime < now && app.status !== 'cancelled' && app.status !== 'noshow';
        case 'Pending Session Notes':
          // Appointments that are past, not cancelled/noshow, and have no notes
          return startTime < now
            && app.status !== 'cancelled'
            && app.status !== 'noshow'
            && (!app.notes || app.notes.length === 0);
        case 'Cancelled':
          return app.status === 'cancelled';
        case 'No Show':
          return app.status === 'noshow';
        case 'All Bookings':
        default:
          return true;
      }
    });
  }, [appointments, activeTab]);

  const columns: ColumnDef<any, any>[] = useMemo(() => [
    {
      accessorKey: 'start_time',
      header: 'Session Timings',
      cell: ({ getValue }) => formatDateTime(getValue()),
    },
    {
      accessorKey: 'title',
      header: 'Session Name',
    },
    {
      accessorKey: 'client_name',
      header: 'Client Name',
      cell: ({ getValue }) => getValue() || '—',
    },
    {
      id: 'contact',
      header: 'Contact Info',
      enableSorting: false,
      cell: ({ row }) => (
        <div>
          <div className={styles.clientName}>{row.original.client_email || '—'}</div>
          <div className={styles.clientPhone}>{row.original.client_phone || '—'}</div>
        </div>
      ),
    },
    {
      id: 'mode',
      header: 'Mode',
      enableSorting: false,
      cell: ({ row }) => row.original.meet_link ? 'Google Meet' : 'In-person',
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ getValue }) => {
        const status = (getValue() || 'scheduled') as string;
        const colors: Record<string, { bg: string; color: string }> = {
          scheduled: { bg: '#e8f5e9', color: '#2e7d32' },
          cancelled:  { bg: '#fdecea', color: '#c62828' },
          completed:  { bg: '#e3f2fd', color: '#1565c0' },
          noshow:     { bg: '#fff3e0', color: '#e65100' },
        };
        const style = colors[status] || colors.scheduled;
        return (
          <span style={{ background: style.bg, color: style.color, padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 600, textTransform: 'capitalize' }}>
            {status}
          </span>
        );
      },
    },
  ], []);

  return (
    <div className={styles.appointmentsPage}>
      <div className={styles.appointmentsHeader}>
        <div className={styles.headerContent}>
          <h1>Bookings</h1>
          <p>View Recently Booked Sessions, Send Invite and more...</p>
        </div>
      </div>

      <div className={styles.appointmentsTabs}>
        {tabs.map(tab => (
          <button
            key={tab}
            className={`${styles.tabBtn} ${activeTab === tab ? styles.active : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className={styles.headerActions}>
        <div className={styles.searchContainer}>
          <Search size="small" primaryColor="#6E6E6E" />
          <input type="text" placeholder="Search users by name, or phone no" />
        </div>
        <button className={styles.exportBtn}>
          <img src="/Upload.svg" alt="" />Export to CSV
        </button>
      </div>

      <DataTable
        data={filteredAppointments}
        columns={columns}
        pageSize={10}
        emptyMessage="No bookings found"
      />
    </div>
  );
};

export default Appointments;
