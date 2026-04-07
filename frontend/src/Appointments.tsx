import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useParams } from 'react-router-dom';
import styles from './Appointments.module.css';
import { Search } from 'react-iconly';
import API_BASE_URL from './config/api';
import DataTable from './components/DataTable';
import { ColumnDef } from '@tanstack/react-table';
import Loader from './components/Loader';
import { exportToCSV } from './utils/exportCSV';
import InlineCalendar from './components/InlineCalendar';
import TimeSlotList from './components/TimeSlotList';
import ConfirmModal from './components/ConfirmModal';
import { useSocket } from './context/SocketContext';

const TAB_SLUGS: Record<string, string> = {
  'upcoming': 'Upcoming',
  'all-bookings': 'All Bookings',
  'completed': 'Completed',
  'pending-session-notes': 'Pending Session Notes',
  'cancelled': 'Cancelled',
  'no-show': 'No Show',
};
const TAB_TO_SLUG: Record<string, string> = Object.fromEntries(
  Object.entries(TAB_SLUGS).map(([slug, tab]) => [tab, slug])
);

const Appointments: React.FC = () => {
  const navigate = useNavigate();
  const { tab: tabParam } = useParams<{ tab?: string }>();
  const resolvedTab = (tabParam && TAB_SLUGS[tabParam]) || 'Upcoming';
  const [activeTab, setActiveTab] = useState<string>(resolvedTab);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRows, setSelectedRows] = useState<any[]>([]);

  // Reschedule modal state
  const [rescheduleAppt, setRescheduleAppt] = useState<any | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState(new Date().toISOString().split('T')[0]);
  const [rescheduleSlot, setRescheduleSlot] = useState<string | null>(null);
  const [rescheduling, setRescheduling] = useState(false);
  const [activeMenuId, setActiveMenuId] = useState<number | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(null);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  // Confirm modal state
  const [confirmModal, setConfirmModal] = useState<{ id: number; action: string } | null>(null);

  // Sync URL param → tab on navigation
  useEffect(() => {
    const t = (tabParam && TAB_SLUGS[tabParam]) || 'Upcoming';
    setActiveTab(t);
  }, [tabParam]);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    navigate(`/bookings/${TAB_TO_SLUG[tab]}`, { replace: true });
  };

  const tabs = ['Upcoming', 'All Bookings', 'Completed', 'Pending Session Notes', 'Cancelled', 'No Show'];

  const { socket } = useSocket();

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

  // Real-time: refresh when socket emits bookings_updated
  useEffect(() => {
    if (!socket) return;
    socket.on('bookings_updated', fetchAppointments);
    return () => { socket.off('bookings_updated', fetchAppointments); };
  }, [socket]);

  const updateStatus = async (id: number, status: string) => {
    setActionLoading(id);
    try {
      const res = await fetch(`${API_BASE_URL}/api/bookings/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        fetchAppointments();
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error || 'Failed to update booking status.');
      }
    } catch (e) {
      console.error('Failed to update status:', e);
      alert('Network error. Please try again.');
    } finally {
      setActionLoading(null);
    }
  };

  const updatePayment = async (id: number, payment_status: string) => {
    setActionLoading(id);
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
    } finally {
      setActionLoading(null);
    }
  };

  const sendReminder = async (id: number) => {
    setActionLoading(id);
    try {
      const res = await fetch(`${API_BASE_URL}/api/bookings/${id}/reminder`, {
        method: 'POST', credentials: 'include'
      });
      if (!res.ok) console.error('Failed to send reminder');
    } catch (e) {
      console.error('Failed to send reminder:', e);
    } finally {
      setActionLoading(null);
    }
  };

  const handleReschedule = async () => {
    if (!rescheduleAppt || !rescheduleSlot) return;
    setRescheduling(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/bookings/${rescheduleAppt.id}/reschedule`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
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
      switch (activeTab) {
        case 'Upcoming':
          // Future sessions that haven't been cancelled or marked no-show
          return new Date(app.start_time) > now && app.status === 'scheduled';
        case 'Completed':
          // Only explicitly completed sessions
          return app.status === 'completed';
        case 'Pending Session Notes':
          // Completed sessions with no notes attached
          return app.status === 'completed' && (!app.notes || app.notes.length === 0);
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

  const menuItemStyle: React.CSSProperties = {
    display: 'block', width: '100%', padding: '10px 16px', border: 'none',
    background: 'none', textAlign: 'left', fontFamily: 'Urbanist', fontWeight: 500,
    fontSize: '13px', color: '#082421', cursor: 'pointer', borderBottom: '1px solid #f5f5f5',
  };

  // Close menu on outside click
  useEffect(() => {
    if (activeMenuId === null) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setActiveMenuId(null);
        setMenuPos(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [activeMenuId]);

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
        const isPast = new Date(row.original.start_time) < new Date();
        const isUpcoming = !isPast;
        // No actions for cancelled or noshow
        if (status === 'cancelled' || status === 'noshow') return <span style={{ color: '#ccc', fontSize: '12px', fontFamily: 'Urbanist' }}>—</span>;
        const isMenuOpen = activeMenuId === id;
        return (
          <div style={{ position: 'relative' }}>
            <button
              disabled={actionLoading === id}
              onClick={(e) => {
                e.stopPropagation();
                if (isMenuOpen) { setActiveMenuId(null); setMenuPos(null); return; }
                const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                setMenuPos({ top: rect.bottom + window.scrollY + 4, right: window.innerWidth - rect.right });
                setActiveMenuId(id);
              }}
              style={{ background: 'none', border: '1px solid #e0e0e0', borderRadius: '6px', padding: '4px 10px', cursor: actionLoading === id ? 'not-allowed' : 'pointer', color: '#333', fontSize: '16px', lineHeight: 1, opacity: actionLoading === id ? 0.5 : 1 }}
            >
              {actionLoading === id ? '…' : '···'}
            </button>
          </div>
        );
      },
    },
  ], [appointments, activeMenuId]);

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
            onClick={() => handleTabChange(tab)}
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

      {/* Portal dropdown menu for row actions */}
      {activeMenuId !== null && menuPos && (() => {
        const row = appointments.find(a => a.id === activeMenuId);
        if (!row) return null;
        const { id, status, payment_status } = row;
        const isPast = new Date(row.start_time) < new Date();
        const isUpcoming = !isPast;
        const canReschedule = status === 'scheduled' && isUpcoming;
        const canCancel = status === 'scheduled';
        const canMarkPaid = payment_status === 'Pending' && status !== 'cancelled' && status !== 'noshow';
        // Can mark complete: past sessions still in scheduled state
        const canComplete = status === 'scheduled' && isPast;
        // Can mark no-show: past sessions still in scheduled state
        const canMarkNoShow = status === 'scheduled' && isPast;
        const canSendReminder = status === 'scheduled' && isUpcoming;
        const canAddNote = status === 'completed';

        return createPortal(
          <div
            ref={menuRef}
            style={{
              position: 'absolute', top: menuPos.top, right: menuPos.right,
              background: '#fff', border: '1px solid #e9ecef', borderRadius: '10px',
              boxShadow: '0 8px 24px rgba(0,0,0,0.12)', zIndex: 9999,
              minWidth: '180px', overflow: 'hidden'
            }}
            onClick={e => e.stopPropagation()}
          >
            {canSendReminder && (
              <button onClick={() => { sendReminder(id); setActiveMenuId(null); setMenuPos(null); }}
                style={menuItemStyle}>Send Reminder</button>
            )}
            {canReschedule && (
              <button onClick={() => { setRescheduleAppt(row); setRescheduleDate(new Date().toISOString().split('T')[0]); setRescheduleSlot(null); setActiveMenuId(null); setMenuPos(null); }}
                style={menuItemStyle}>Reschedule</button>
            )}
            {canMarkPaid && (
              <button onClick={() => { updatePayment(id, 'Paid'); setActiveMenuId(null); setMenuPos(null); }}
                style={{ ...menuItemStyle, color: '#2e7d32' }}>Mark Paid</button>
            )}
            {canComplete && (
              <button onClick={() => { updateStatus(id, 'completed'); setActiveMenuId(null); setMenuPos(null); }}
                style={menuItemStyle}>Mark as Complete</button>
            )}
            {canMarkNoShow && (
              <button onClick={() => { setConfirmModal({ id, action: 'noshow' }); setActiveMenuId(null); setMenuPos(null); }}
                style={{ ...menuItemStyle, color: '#e65100' }}>Mark as No Show</button>
            )}
            {canAddNote && (
              <button onClick={() => {
                setActiveMenuId(null); setMenuPos(null);
                navigate('/clients', { state: { clientEmail: row.client_email, initialTab: 'Session Notes' } });
              }}
                style={{ ...menuItemStyle, borderBottom: 'none' }}>Add Note</button>
            )}
            {canCancel && (
              <button onClick={() => { setConfirmModal({ id, action: 'cancel' }); setActiveMenuId(null); setMenuPos(null); }}
                style={{ ...menuItemStyle, color: '#c62828', borderBottom: 'none' }}>Cancel</button>
            )}
          </div>,
          document.body
        );
      })()}

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

      <ConfirmModal
        isOpen={!!confirmModal}
        title={confirmModal?.action === 'noshow' ? 'Mark as No Show' : 'Cancel Booking'}
        message={
          confirmModal?.action === 'noshow'
            ? 'Mark this session as a no show? The client did not attend.'
            : 'Are you sure you want to cancel this booking? This action cannot be undone.'
        }
        confirmLabel={confirmModal?.action === 'noshow' ? 'Yes, Mark No Show' : 'Yes, Cancel Booking'}
        cancelLabel={confirmModal?.action === 'noshow' ? 'Go Back' : 'Keep Booking'}
        danger
        onConfirm={() => {
          if (confirmModal) {
            updateStatus(confirmModal.id, confirmModal.action === 'noshow' ? 'noshow' : 'cancelled');
            setConfirmModal(null);
          }
        }}
        onCancel={() => setConfirmModal(null)}
      />
    </div>
  );
};

export default Appointments;
