import React, { useState, useEffect, useMemo } from 'react';
import styles from './Appointments.module.css';
import { Search } from 'react-iconly';
import API_BASE_URL from './config/api';
import DataTable from './components/DataTable';
import { ColumnDef } from '@tanstack/react-table';
import Loader from './components/Loader';
import { exportToCSV } from './utils/exportCSV';
import CreateBooking from './components/CreateBooking';
import InlineCalendar from './components/InlineCalendar';
import TimeSlotList from './components/TimeSlotList';

const Appointments: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('Upcoming');
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRows, setSelectedRows] = useState<any[]>([]);
  const [showCreateBooking, setShowCreateBooking] = useState(false);

  // Reschedule modal state
  const [rescheduleAppt, setRescheduleAppt] = useState<any | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState(new Date().toISOString().split('T')[0]);
  const [rescheduleSlot, setRescheduleSlot] = useState<string | null>(null);
  const [rescheduling, setRescheduling] = useState(false);

  const tabs = ['Upcoming', 'All Bookings', 'Completed', 'Pending Session Notes', 'Cancelled', 'No Show'];

  const fetchAppointments = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/bookings`, { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        setAppointments(data);
      }
    } catch (error) {
      console.error('Failed to fetch appointments:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAppointments(); }, []);

  const updateStatus = async (id: number, status: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/bookings/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status }),
      });
      if (res.ok) fetchAppointments();
    } catch (e) {
      console.error('Failed to update status:', e);
    }
  };

  const updatePayment = async (id: number, payment_status: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/bookings/${id}/payment`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ payment_status }),
      });
      if (res.ok) fetchAppointments();
    } catch (e) {
      console.error('Failed to update payment:', e);
    }
  };

  const handleReschedule = async () => {
    if (!rescheduleAppt || !rescheduleSlot) return;
    setRescheduling(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/bookings/manage/${rescheduleAppt.cancel_token}/reschedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ new_start_time: rescheduleSlot }),
      });
      if (res.ok) {
        setRescheduleAppt(null);
        setRescheduleSlot(null);
        fetchAppointments();
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to reschedule');
      }
    } catch {
      alert('Network error');
    } finally {
      setRescheduling(false);
    }
  };

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
      cell: ({ row }) => row.original.meet_link ? 'Google Meet' : (row.original.location_type === 'in_person' ? 'In-person' : 'Google Meet'),
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
    {
      id: 'actions',
      header: 'Actions',
      enableSorting: false,
      cell: ({ row }) => {
        const { id, status, payment_status } = row.original;
        const btnStyle: React.CSSProperties = {
          fontSize: '11px', fontWeight: 600, padding: '3px 8px', borderRadius: '6px',
          border: 'none', cursor: 'pointer', marginRight: '4px', marginBottom: '2px'
        };
        return (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px' }}>
            {status !== 'cancelled' && status !== 'noshow' && (
              <>
                {status !== 'completed' && (
                  <button style={{ ...btnStyle, background: '#e3f2fd', color: '#1565c0' }}
                    onClick={() => updateStatus(id, 'completed')}>Complete</button>
                )}
                {status !== 'completed' && new Date(row.original.start_time) > new Date() && (
                  <button style={{ ...btnStyle, background: '#f3e5f5', color: '#6a1b9a' }}
                    onClick={() => { setRescheduleAppt(row.original); setRescheduleDate(new Date().toISOString().split('T')[0]); setRescheduleSlot(null); }}>Reschedule</button>
                )}
                <button style={{ ...btnStyle, background: '#fff3e0', color: '#e65100' }}
                  onClick={() => updateStatus(id, 'noshow')}>No Show</button>
                <button style={{ ...btnStyle, background: '#fdecea', color: '#c62828' }}
                  onClick={() => updateStatus(id, 'cancelled')}>Cancel</button>
              </>
            )}
            {status === 'cancelled' || status === 'noshow' ? (
              <button style={{ ...btnStyle, background: '#e8f5e9', color: '#2e7d32' }}
                onClick={() => updateStatus(id, 'scheduled')}>Restore</button>
            ) : null}
            {payment_status === 'Pending' && (
              <button style={{ ...btnStyle, background: '#e8f5e9', color: '#2e7d32' }}
                onClick={() => updatePayment(id, 'Paid')}>Mark Paid</button>
            )}
            {payment_status === 'Paid' && (
              <button style={{ ...btnStyle, background: '#fdecea', color: '#c62828' }}
                onClick={() => updatePayment(id, 'Refunded')}>Refund</button>
            )}
          </div>
        );
      },
    },
  ], [appointments]);

  return (
    <div className={styles.appointmentsPage}>
      <div className={styles.appointmentsHeader}>
        <div className={styles.headerContent}>
          <h1>Bookings</h1>
          <p>View Recently Booked Sessions, Send Invite and more...</p>
        </div>
        <button
          onClick={() => setShowCreateBooking(true)}
          style={{ padding: '10px 20px', background: '#082421', color: '#fff', border: 'none', borderRadius: '8px', fontFamily: 'Urbanist', fontWeight: 600, fontSize: '14px', cursor: 'pointer' }}
        >
          + Create Booking
        </button>
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
        <button className={styles.exportBtn} onClick={() => {
          const toExport = selectedRows.length > 0 ? selectedRows : filteredAppointments;
          exportToCSV(toExport, 'bookings', {
            start_time: 'Session Time', title: 'Session Name',
            client_name: 'Client Name', client_email: 'Email',
            client_phone: 'Phone', status: 'Status',
            payment_status: 'Payment Status', payment_amount: 'Amount'
          });
        }}>
          <img src="/Upload.svg" alt="" />
          {selectedRows.length > 0 ? `Export ${selectedRows.length} Selected` : 'Export to CSV'}
        </button>
      </div>

      {loading ? (
        <Loader />
      ) : (
        <DataTable
          data={filteredAppointments}
          columns={columns}
          pageSize={10}
          emptyMessage="No bookings found"
          enableSelection
          onSelectionChange={setSelectedRows}
        />
      )}

      {/* Create Booking Lightbox */}
      {showCreateBooking && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}
          onClick={() => setShowCreateBooking(false)}>
          <div style={{ background: '#fff', borderRadius: '16px', width: '100%', maxWidth: '700px', maxHeight: '90vh', overflowY: 'auto', position: 'relative' }}
            onClick={e => e.stopPropagation()}>
            <button onClick={() => setShowCreateBooking(false)} style={{ position: 'absolute', top: '16px', right: '16px', background: 'none', border: 'none', fontSize: '22px', cursor: 'pointer', color: '#666', zIndex: 1 }}>×</button>
            <CreateBooking onBack={() => { setShowCreateBooking(false); fetchAppointments(); }} />
          </div>
        </div>
      )}

      {/* Reschedule Modal */}
      {rescheduleAppt && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '40px 24px', overflowY: 'auto' }}
          onClick={() => setRescheduleAppt(null)}>
          <div style={{ background: '#fff', borderRadius: '16px', padding: '32px', width: '100%', maxWidth: '760px' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div>
                <h2 style={{ margin: 0, fontFamily: 'Urbanist', fontWeight: 700, fontSize: '20px' }}>Reschedule Session</h2>
                <p style={{ margin: '4px 0 0', fontFamily: 'Urbanist', fontSize: '14px', color: '#6E6E6E' }}>{rescheduleAppt.title} — {rescheduleAppt.client_name}</p>
              </div>
              <button onClick={() => setRescheduleAppt(null)} style={{ background: 'none', border: 'none', fontSize: '22px', cursor: 'pointer', color: '#666' }}>×</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
              <InlineCalendar selectedDate={rescheduleDate} onDateSelect={setRescheduleDate} />
              <TimeSlotList
                calendarId={rescheduleAppt.calendar_id}
                selectedDate={rescheduleDate}
                selectedSlot={rescheduleSlot}
                onSlotSelect={setRescheduleSlot}
              />
            </div>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px' }}>
              <button onClick={() => setRescheduleAppt(null)}
                style={{ padding: '10px 24px', borderRadius: '8px', border: '1px solid #e0e0e0', background: '#fff', fontFamily: 'Urbanist', fontWeight: 500, fontSize: '14px', cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={handleReschedule} disabled={!rescheduleSlot || rescheduling}
                style={{ padding: '10px 24px', borderRadius: '8px', border: 'none', background: '#082421', fontFamily: 'Urbanist', fontWeight: 600, fontSize: '14px', color: '#fff', cursor: (!rescheduleSlot || rescheduling) ? 'not-allowed' : 'pointer', opacity: (!rescheduleSlot || rescheduling) ? 0.6 : 1 }}>
                {rescheduling ? 'Rescheduling...' : 'Confirm Reschedule'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Appointments;
