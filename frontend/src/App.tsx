import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import ConfirmModal from './components/ConfirmModal';
import { Analytics } from '@vercel/analytics/react';
import { BrowserRouter, Routes, Route, useNavigate, useLocation, Outlet, Navigate, useOutletContext } from 'react-router-dom';
import './App.css';
import AllClients from './AllClients';
import Appointments from './Appointments';
import PaymentsInvoice from './PaymentsInvoice';
import MySettings from './MySettings';
import MyProfile from './MyProfile';
import ClientNotesTemplate from './components/ClientNotesTemplate';
import CreateBooking from './components/CreateBooking';
import SendBookingLinkModal from './components/SendBookingLinkModal';
import CalendarPage from './components/CalendarPage';
import LoginPage from './components/LoginPage';
import SignUpPage from './components/SignUpPage';
import PublicBookingPage from './components/PublicBookingPage';
import BookingStatus from './components/BookingStatus';
import ManageBooking from './components/ManageBooking';
import TherapistProfilePage from './components/TherapistProfilePage';
import PrivacyPolicy from './components/PrivacyPolicy';
import TermsOfService from './components/TermsOfService';
import CreateEventPage from './components/CreateEventPage';
import ManageReminders from './components/ManageReminders';
import EditDashboard from './components/EditDashboard';
import EmailPreferences from './components/EmailPreferences';
import ProfileLink from './components/ProfileLink';
import ResetPassword from './components/ResetPassword';
import Therapists from './Therapists';
import TherapistProfileView from './TherapistProfileView';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider, useToast } from './context/ToastContext';
import { NotificationProvider, useNotifications } from './context/NotificationContext';
import { SocketProvider } from './context/SocketContext';
import ToastContainer from './components/ToastContainer';
import ProtectedRoute from './components/ProtectedRoute';
import TeamSettings from './components/TeamSettings';
import TeamAnalytics from './components/TeamAnalytics';
import API_BASE_URL from './config/api';
import { Category, TwoUsers, Calendar, Discovery, Wallet, Setting, Paper, AddUser } from 'react-iconly';
import DataTable from './components/DataTable';
import { ColumnDef } from '@tanstack/react-table';
import QuickActionMenu from './components/QuickActionMenu';
import InlineCalendar from './components/InlineCalendar';
import TimeSlotList from './components/TimeSlotList';
import Loader from './components/Loader';
import CookieBanner from './components/CookieBanner';
import UpgradePlanModal from './components/UpgradePlanModal';
import MobileBlocker from './components/MobileBlocker';

interface NavItem {
  name: string;
  icon: string;
  path: string;
}

interface StatData {
  label: string;
  value: string;
}

interface Booking {
  time: string;
  client: string;
  type: string;
  mode: string;
}

// ===== NOTIFICATION BELL COMPONENT =====
const NotificationBell: React.FC<{
  showNotificationsPage: boolean;
  showNotificationDropdown: boolean;
  setShowNotificationDropdown: (v: boolean) => void;
}> = ({ showNotificationsPage, showNotificationDropdown, setShowNotificationDropdown }) => {
  const { notifications, unreadCount, markAsRead, markAllAsRead, refresh } = useNotifications();
  const navigate = useNavigate();
  const toast = useToast();
  const dropdownRef = React.useRef<HTMLDivElement>(null);
  const [actioningNotifId, setActioningNotifId] = React.useState<number | null>(null);

  const handleTransferAction = async (transferId: number, action: 'approve' | 'reject', notifId: number) => {
    setActioningNotifId(notifId);
    try {
      const res = await fetch(`${API_BASE_URL}/api/clients/transfers/${transferId}/${action}`, {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(action === 'approve' ? 'Transfer approved!' : 'Transfer rejected.');
        markAsRead(notifId);
        refresh();
      } else {
        toast.error(data.error || 'Action failed');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setActioningNotifId(null);
    }
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowNotificationDropdown(false);
      }
    };
    if (showNotificationDropdown) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showNotificationDropdown, setShowNotificationDropdown]);

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    return isToday
      ? `Today - ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`
      : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const preview = notifications.slice(0, 3);

  return (
    <div className="notification-container" ref={dropdownRef} style={{ fontSize: '20px', cursor: 'pointer' }}
      onClick={() => {
        // On mobile (≤768px) navigate directly to notifications page
        if (window.innerWidth <= 768) {
          navigate('/notifications');
          return;
        }
        setShowNotificationDropdown(!showNotificationDropdown);
      }}>
      <img src={showNotificationDropdown ? 'Notification-tap.svg' : 'Notification.svg'} alt="bell" className="notification-bell-icon" style={{ width: '35px', height: '35px' }} />
      {unreadCount > 0 && !showNotificationsPage && <div className="notification-badge"></div>}
      {showNotificationDropdown && (
        <div className="notification-dropdown" onClick={e => e.stopPropagation()}>
          <div className="notification-header">
            <div className="notification-title">Notifications {unreadCount > 0 && <span style={{ background: '#ff0000', color: '#fff', borderRadius: '10px', padding: '1px 7px', fontSize: '11px', marginLeft: '6px' }}>{unreadCount}</span>}</div>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              {unreadCount > 0 && (
                <button className="notification-view-more" onClick={e => { e.stopPropagation(); markAllAsRead(); }}>mark all read</button>
              )}
              <button className="notification-view-more" onClick={e => { e.stopPropagation(); navigate('/notifications'); setShowNotificationDropdown(false); }}>view more→</button>
            </div>
          </div>
          {preview.length === 0 ? (
            <div style={{ padding: '20px', textAlign: 'center', color: '#6E6E6E', fontSize: '13px' }}>No notifications yet</div>
          ) : (
            preview.map(n => (
              <div key={n.id} className="notification-item" style={{ background: n.is_read ? 'white' : '#f0faf9', display: 'flex', flexDirection: 'column', gap: '8px' }}
                onClick={() => { if (!n.is_read && n.type !== 'transfer_request') markAsRead(n.id); }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div className="notification-content" style={{ flex: 1 }}>
                    <div className="notification-item-title" style={{ color: n.is_read ? '#555' : '#000' }}>{n.title}</div>
                    <div className="notification-item-desc">{n.description}</div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px', flexShrink: 0, marginLeft: '8px' }}>
                    <span style={{ fontSize: '11px', color: '#6E6E6E', whiteSpace: 'nowrap' }}>{formatTime(n.created_at)}</span>
                    {!n.is_read && <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#2D7579', display: 'inline-block' }}></span>}
                  </div>
                </div>
                {n.type === 'transfer_request' && !n.is_read && (
                  <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                    <button
                      onClick={e => { e.stopPropagation(); if (n.related_id) handleTransferAction(n.related_id, 'approve', n.id); }}
                      disabled={actioningNotifId === n.id}
                      style={{ padding: '6px 14px', borderRadius: '6px', border: 'none', background: '#082421', color: '#fff', fontFamily: 'Urbanist', fontWeight: 600, fontSize: '12px', cursor: actioningNotifId === n.id ? 'not-allowed' : 'pointer', opacity: actioningNotifId === n.id ? 0.6 : 1, flex: 1 }}>
                      {actioningNotifId === n.id ? '...' : 'Approve'}
                    </button>
                    <button
                      onClick={e => { e.stopPropagation(); if (n.related_id) handleTransferAction(n.related_id, 'reject', n.id); }}
                      disabled={actioningNotifId === n.id}
                      style={{ padding: '6px 14px', borderRadius: '6px', border: '1px solid #e53935', background: '#fff', color: '#e53935', fontFamily: 'Urbanist', fontWeight: 600, fontSize: '12px', cursor: actioningNotifId === n.id ? 'not-allowed' : 'pointer', opacity: actioningNotifId === n.id ? 0.6 : 1, flex: 1 }}>
                      {actioningNotifId === n.id ? '...' : 'Reject'}
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

// ===== NOTIFICATIONS FULL PAGE =====
const NotificationsPage: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const { notifications, markAsRead, markAllAsRead, refresh } = useNotifications();
  const toast = useToast();

  const handleTransferAction = useCallback(async (transferId: number, action: 'approve' | 'reject', notifId: number) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/clients/transfers/${transferId}/${action}`, {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(action === 'approve' ? 'Transfer approved!' : 'Transfer rejected.');
        markAsRead(notifId);
        refresh();
      } else {
        toast.error(data.error || 'Action failed');
      }
    } catch {
      toast.error('Network error');
    }
  }, [toast, markAsRead, refresh]);

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
    const isYesterday = d.toDateString() === yesterday.toDateString();
    if (isToday) return `Today - ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`;
    if (isYesterday) return `Yesterday - ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const grouped = notifications.reduce((acc: Record<string, typeof notifications>, n) => {
    const d = new Date(n.created_at);
    const now = new Date();
    const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
    const key = d.toDateString() === now.toDateString() ? "Today's"
      : d.toDateString() === yesterday.toDateString() ? "Yesterday's"
      : d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    if (!acc[key]) acc[key] = [];
    acc[key].push(n);
    return acc;
  }, {});

  return (
    <div className="dashboard-content">
      <div className="dashboard-header">
        <div>
          <h1 style={{ fontFamily: 'Urbanist', fontWeight: '700', fontSize: '30px', lineHeight: '100%' }}>Notifications</h1>
          <p style={{ fontFamily: 'Urbanist', fontWeight: '500', fontSize: '16px', color: '#6E6E6E' }}>Get alerts regarding new bookings, payments, cancellations, and more...</p>
        </div>
        {notifications.some(n => !n.is_read) && (
          <button onClick={markAllAsRead} style={{ background: '#2D7579', color: '#fff', border: 'none', borderRadius: '8px', padding: '8px 16px', cursor: 'pointer', fontFamily: 'Urbanist', fontWeight: '600' }}>
            Mark all as read
          </button>
        )}
      </div>
      {Object.keys(grouped).length === 0 ? (
        <div style={{ textAlign: 'center', color: '#6E6E6E', marginTop: '60px', fontSize: '16px' }}>No notifications yet</div>
      ) : (
        Object.entries(grouped).map(([group, items]) => (
          <div className="notifications-section" key={group}>
            <h3 style={{ fontFamily: 'Urbanist', fontWeight: '600', fontSize: '18px', color: '#6E6E6E', marginBottom: '16px', marginLeft: '5px' }}>{group}</h3>
            {items.map(n => (
              <div key={n.id} className="notification-card" style={{ background: n.is_read ? 'white' : '#f0faf9' }}
                onClick={() => { if (!n.is_read && n.type !== 'transfer_request') markAsRead(n.id); }}>
                <div className="notification-card-content">
                  <h4 style={{ fontFamily: 'Urbanist', fontWeight: '700', fontSize: '20px', color: '#082421', margin: '0 0 6px 0' }}>{n.title}</h4>
                  <p style={{ fontFamily: 'Urbanist', fontWeight: '500', fontSize: '14px', color: '#6E6E6E', margin: '0 0 10px 0' }}>{n.description}</p>
                  {n.type === 'transfer_request' && !n.is_read && (
                    <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                      <button
                        onClick={e => { e.stopPropagation(); if (n.related_id) handleTransferAction(n.related_id, 'approve', n.id); }}
                        style={{ padding: '7px 18px', borderRadius: '7px', border: 'none', background: '#082421', color: '#fff', fontFamily: 'Urbanist', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}>
                        Approve
                      </button>
                      <button
                        onClick={e => { e.stopPropagation(); if (n.related_id) handleTransferAction(n.related_id, 'reject', n.id); }}
                        style={{ padding: '7px 18px', borderRadius: '7px', border: '1px solid #e53935', background: '#fff', color: '#e53935', fontFamily: 'Urbanist', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}>
                        Reject
                      </button>
                    </div>
                  )}
                  {n.type === 'transfer_request' && n.is_read && (
                    <span style={{ fontSize: '12px', color: '#9CA3AF', fontFamily: 'Urbanist' }}>Actioned</span>
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px', flexShrink: 0, marginLeft: '16px' }}>
                  <span style={{ fontFamily: 'Urbanist', fontSize: '13px', color: '#6E6E6E', whiteSpace: 'nowrap' }}>{formatTime(n.created_at)}</span>
                  {!n.is_read && <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#2D7579', display: 'inline-block' }}></span>}
                </div>
              </div>
            ))}
          </div>
        ))
      )}
    </div>
  );
};

// ===== ADD CLIENT MODAL =====
const defaultClientForm = {
  name: '', email: '', phone: '', age: '', occupation: '',
  gender: 'Male', maritalStatus: 'Single',
  emergencyName: '', emergencyPhone: '', emergencyRelation: '',
};

const AddClientModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const toast = useToast();
  const { user } = useAuth();
  const [form, setForm] = useState({ ...defaultClientForm });
  const [saving, setSaving] = useState(false);
  const [calendars, setCalendars] = useState<{ id: number; title: string; slug: string; duration: string; description?: string }[]>([]);
  const [selectedCalendarId, setSelectedCalendarId] = useState<string>('');

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/calendars`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : [])
      .then(setCalendars)
      .catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim()) { toast.error('Name and email are required.'); return; }
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/clients`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          ...form,
          ...(selectedCalendarId ? { calendarId: parseInt(selectedCalendarId) } : {}),
        }),
      });
      if (res.ok) {
        toast.success('Client added successfully!');
        onClose();
      } else {
        const err = await res.json();
        toast.error(err.error || 'Failed to add client.');
      }
    } catch {
      toast.error('An error occurred.');
    } finally {
      setSaving(false);
    }
  };

  const f = (field: keyof typeof form) => ({
    value: form[field],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm(prev => ({ ...prev, [field]: e.target.value })),
  });

  const iStyle: React.CSSProperties = {
    width: '100%', padding: '10px 12px', borderRadius: '8px',
    border: '1px solid #e0e0e0', fontFamily: 'Urbanist', fontSize: '14px',
    color: '#333', outline: 'none', boxSizing: 'border-box',
  };
  const lStyle: React.CSSProperties = {
    display: 'block', fontFamily: 'Urbanist', fontWeight: 500,
    fontSize: '13px', color: '#555', marginBottom: '6px',
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}
      onClick={() => !saving && onClose()}>
      <div style={{ background: '#fff', borderRadius: '16px', padding: '32px', width: '100%', maxWidth: '560px', maxHeight: '90vh', overflowY: 'auto' }}
        onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
          <h2 style={{ fontFamily: 'Urbanist', fontWeight: 700, fontSize: '22px', margin: 0 }}>Add New Client</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '22px', cursor: 'pointer', color: '#666', lineHeight: 1 }}>×</button>
        </div>
        <p style={{ fontFamily: 'Urbanist', fontSize: '14px', color: '#6E6E6E', margin: '0 0 24px 0' }}>Fill in the client's details below</p>
        <form onSubmit={handleSubmit}>
          <p style={{ fontFamily: 'Urbanist', fontWeight: 600, fontSize: '13px', color: '#2D7579', margin: '0 0 12px 0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Basic Info</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
            <div><label style={lStyle}>Full Name *</label><input style={iStyle} type="text" required placeholder="Jane Doe" {...f('name')} /></div>
            <div><label style={lStyle}>Email *</label><input style={iStyle} type="email" required placeholder="jane@example.com" {...f('email')} /></div>
            <div><label style={lStyle}>Phone</label><input style={iStyle} type="tel" placeholder="+91 98765 43210" {...f('phone')} /></div>
            <div><label style={lStyle}>Age</label><input style={iStyle} type="text" placeholder="28" {...f('age')} /></div>
            <div><label style={lStyle}>Occupation</label><input style={iStyle} type="text" placeholder="Software Engineer" {...f('occupation')} /></div>
            <div><label style={lStyle}>Gender</label>
              <select style={iStyle} {...f('gender')}>
                <option value="Male">Male</option><option value="Female">Female</option>
                <option value="Other">Other</option><option value="Prefer not to say">Prefer not to say</option>
              </select>
            </div>
            <div><label style={lStyle}>Marital Status</label>
              <select style={iStyle} {...f('maritalStatus')}>
                <option value="Single">Single</option><option value="Married">Married</option>
                <option value="Divorced">Divorced</option><option value="Widowed">Widowed</option>
              </select>
            </div>
          </div>
          <p style={{ fontFamily: 'Urbanist', fontWeight: 600, fontSize: '13px', color: '#2D7579', margin: '8px 0 12px 0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Emergency Contact</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '28px' }}>
            <div><label style={lStyle}>Name</label><input style={iStyle} type="text" placeholder="John Doe" {...f('emergencyName')} /></div>
            <div><label style={lStyle}>Phone</label><input style={iStyle} type="tel" placeholder="+91 98765 43210" {...f('emergencyPhone')} /></div>
            <div><label style={lStyle}>Relation</label><input style={iStyle} type="text" placeholder="Spouse" {...f('emergencyRelation')} /></div>
          </div>
          {calendars.length > 0 && (
            <>
              <p style={{ fontFamily: 'Urbanist', fontWeight: 600, fontSize: '13px', color: '#2D7579', margin: '8px 0 12px 0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Send Booking Link (Optional)</p>
              <div style={{ marginBottom: '28px' }}>
                <label style={lStyle}>Select Calendar</label>
                <select style={iStyle} value={selectedCalendarId} onChange={e => setSelectedCalendarId(e.target.value)}>
                  <option value="">— Skip, don't send —</option>
                  {calendars.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                </select>
                {selectedCalendarId && (
                  <p style={{ fontFamily: 'Urbanist', fontSize: '12px', color: '#6E6E6E', margin: '6px 0 0 0' }}>
                    A welcome email with the booking link will be sent to the client.
                  </p>
                )}
              </div>
            </>
          )}
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
            <button type="button" onClick={onClose} disabled={saving}
              style={{ padding: '10px 24px', borderRadius: '8px', border: '1px solid #e0e0e0', background: '#fff', fontFamily: 'Urbanist', fontWeight: 500, fontSize: '14px', color: '#333', cursor: 'pointer' }}>
              Cancel
            </button>
            <button type="submit" disabled={saving}
              style={{ padding: '10px 24px', borderRadius: '8px', border: 'none', background: '#082421', fontFamily: 'Urbanist', fontWeight: 600, fontSize: '14px', color: '#fff', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>
              {saving ? 'Adding...' : 'Add Client'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const MemberGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  if (user?.org_role === 'member') return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
};

const DashboardLayout: React.FC = () => {
  const [showSendLinkModal, setShowSendLinkModal] = useState<boolean>(false);
  const [showNotificationDropdown, setShowNotificationDropdown] = useState<boolean>(false);
  const [showCreateBookingModal, setShowCreateBookingModal] = useState<boolean>(false);
  const [showAddClientModal, setShowAddClientModal] = useState<boolean>(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState<boolean>(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState<boolean>(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState<boolean>(false);
  const { logout, user } = useAuth();
  const { unreadCount } = useNotifications();
  const navigate = useNavigate();
  const location = useLocation();

  const showNotificationsPage = location.pathname === '/notifications';

  const navItems: NavItem[] = [
    { name: 'Dashboard', icon: 'Category1.svg', path: '/dashboard' },
    { name: 'All Clients', icon: '3 User.svg', path: '/clients' },
    ...(user?.plan_name === 'team' && user?.org_role !== 'member'
      ? [{ name: 'Therapists', icon: '', path: '/therapists' }]
      : []),
    { name: 'Bookings', icon: 'Calendar1.svg', path: '/bookings' },
    { name: 'My Calendars', icon: 'Category.svg', path: '/my-calendar' },
    ...(user?.org_role !== 'member'
      ? [{ name: 'Payments & Invoice', icon: 'Wallet.svg', path: '/payment-invoice' }]
      : []),
  ];

  // Mobile-only nav: Dashboard, All Clients, Bookings, My Calendars, Notifications, My Profile
  const mobileNavItems: NavItem[] = [
    { name: 'Dashboard', icon: 'Category1.svg', path: '/dashboard' },
    { name: 'All Clients', icon: '3 User.svg', path: '/clients' },
    { name: 'Bookings', icon: 'Calendar1.svg', path: '/bookings' },
    { name: 'My Calendars', icon: 'Category.svg', path: '/my-calendar' },
  ];

  const mobileBottomNavItems: NavItem[] = [
    { name: 'Notifications', icon: 'Notification.svg', path: '/notifications' },
    { name: 'My Profile', icon: 'Profile.svg', path: '/settings/my-profile' },
  ];

  const bottomNavItems: NavItem[] = [
    { name: 'Notifications', icon: 'Notification.svg', path: '/notifications' },
    { name: 'My Settings', icon: 'Setting.svg', path: '/settings' }
  ];

  const isNavActive = (item: NavItem) =>
    !showNotificationsPage && (
      location.pathname === item.path ||
      (item.path !== '/dashboard' && location.pathname.startsWith(item.path))
    );

  const renderNavIcon = (name: string, active: boolean) => {
    const color = active ? '#082421' : '#D5FFFA';
    const props = { size: 24, primaryColor: color } as any;
    switch (name) {
      case 'Dashboard':          return <Category {...props} />;
      case 'All Clients':        return <TwoUsers {...props} />;
      case 'Therapists':         return <AddUser {...props} />;
      case 'Bookings':           return <Paper {...props} />;
      case 'My Calendars':       return <Calendar {...props} />;
      case 'Payments & Invoice': return <Wallet {...props} />;
      case 'My Settings':        return <Setting {...props} />;
      case 'My Profile':         return <Setting {...props} />;
      default:                   return null;
    }
  };

  const renderSidebar = (): JSX.Element => (
    <div className={`sidebar${mobileSidebarOpen ? ' mobile-open' : ''}`}>
      <div className="logo">
        <img src="/Frame 2 1 (1).svg" alt="MelloMinds Logo" />
      </div>

      {/* Desktop nav */}
      <div className="nav-menu desktop-nav">
        {navItems.map((item) => (
          <div
            key={item.name}
            className={`nav-item ${isNavActive(item) ? 'active' : ''}`}
            onClick={() => { navigate(item.path); setMobileSidebarOpen(false); }}
          >
            <span className={`nav-icon ${item.name === 'My Calendars' ? 'calendar-icon' : ''}`}>
              {renderNavIcon(item.name, isNavActive(item))}
            </span>
            {item.name}
          </div>
        ))}
      </div>

      {/* Mobile nav */}
      <div className="nav-menu mobile-nav">
        {mobileNavItems.map((item) => (
          <div
            key={item.name}
            className={`nav-item ${isNavActive(item) ? 'active' : ''}`}
            onClick={() => { navigate(item.path); setMobileSidebarOpen(false); }}
          >
            <span className={`nav-icon ${item.name === 'My Calendars' ? 'calendar-icon' : ''}`}>
              {renderNavIcon(item.name, isNavActive(item))}
            </span>
            {item.name}
          </div>
        ))}
      </div>

      <div className="nav-divider"></div>

      {/* Desktop bottom nav */}
      <div className="nav-bottom desktop-nav">
        {bottomNavItems.map((item) => (
          <div key={item.name} className={`nav-item ${
            !showNotificationsPage && location.pathname === item.path ? 'active' :
            item.name === 'Notifications' && showNotificationsPage ? 'active' : ''
          }`} onClick={() => {
            if (item.name === 'Notifications') {
              navigate('/notifications');
            } else {
              navigate(item.path);
            }
            setMobileSidebarOpen(false);
          }}>
            {item.name === 'Notifications' ? (
              <span className="nav-icon" style={{ position: 'relative' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
                {unreadCount > 0 && !showNotificationsPage && (
                  <span style={{
                    position: 'absolute', top: '-4px', right: '-4px',
                    width: '8px', height: '8px', borderRadius: '50%',
                    background: '#ff0000', border: '1.5px solid #082421'
                  }} />
                )}
              </span>
            ) : (
              <span className="nav-icon">
                {renderNavIcon(item.name, !showNotificationsPage && location.pathname === item.path)}
              </span>
            )}
            {item.name}
          </div>
        ))}
      </div>

      {/* Mobile bottom nav */}
      <div className="nav-bottom mobile-nav">
        {mobileBottomNavItems.map((item) => (
          <div key={item.name} className={`nav-item ${
            item.name === 'Notifications' && showNotificationsPage ? 'active' :
            !showNotificationsPage && location.pathname === item.path ? 'active' :
            !showNotificationsPage && item.path !== '/notifications' && location.pathname.startsWith(item.path) ? 'active' : ''
          }`} onClick={() => {
            navigate(item.path);
            setMobileSidebarOpen(false);
          }}>
            {item.name === 'Notifications' ? (
              <span className="nav-icon" style={{ position: 'relative' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
                {unreadCount > 0 && !showNotificationsPage && (
                  <span style={{
                    position: 'absolute', top: '-4px', right: '-4px',
                    width: '8px', height: '8px', borderRadius: '50%',
                    background: '#ff0000', border: '1.5px solid #082421'
                  }} />
                )}
              </span>
            ) : (
              <span className="nav-icon">
                {renderNavIcon(item.name, !showNotificationsPage && location.pathname.startsWith(item.path))}
              </span>
            )}
            {item.name}
          </div>
        ))}
      </div>

      <div className="hello-section">
        <div style={{ transform: 'translate(-5px, 20px)' }}>
          Say 👋 hello<br />
          to <strong style={{ color: '#F9E141' }}>mello!</strong>
        </div>
      </div>

      <img src="/MelloFevicon 1.svg" alt="Mello Favicon" className="sidebar-favicon" />
    </div>
  );

  const renderHeader = (): JSX.Element => {
    const isEnterprise = user?.plan_name === 'team';
    const planLabel = isEnterprise
      ? `Team Plan ${user?.used_seats && user?.purchased_seats ? `(${user.used_seats}/${user.purchased_seats})` : ''}`
      : 'Free (Early Access)';

    return (
    <div className="header">
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <button
          className="mobile-menu-toggle"
          onClick={() => setMobileSidebarOpen(prev => !prev)}
          aria-label="Toggle navigation menu"
          aria-expanded={mobileSidebarOpen}
        >
          {mobileSidebarOpen ? (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          ) : (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="6" x2="21" y2="6"/>
              <line x1="3" y1="12" x2="21" y2="12"/>
              <line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
          )}
        </button>
        <div className="plan-info">
          <span>Your Plan:</span>
          <span
            className="free-tier"
            onClick={!isEnterprise ? () => setShowUpgradeModal(true) : undefined}
            style={!isEnterprise ? { cursor: 'pointer' } : {}}
          >
            {planLabel} {!isEnterprise && <img src="Danger Circle.svg" alt="Info" style={{ width: '17px', height: '17px', verticalAlign: 'middle' }} />}
          </span>
        </div>
      </div>

      <div className="user-info">
        <span className="header-desktop-only">
          <QuickActionMenu
            onAddClient={() => setShowAddClientModal(true)}
          />
        </span>
        <NotificationBell
          showNotificationsPage={showNotificationsPage}
          showNotificationDropdown={showNotificationDropdown}
          setShowNotificationDropdown={setShowNotificationDropdown}
        />
        <div className="user-info-card header-desktop-only">
          <div className="user-avatar">
            <img 
              src={
                user?.profile_picture 
                  ? (user.profile_picture.startsWith('http') 
                      ? user.profile_picture 
                      : `${API_BASE_URL}${user.profile_picture}`)
                  : "Profile.svg"
              } 
              alt="Profile" 
            />
          </div>
          <div>
            <div style={{ fontWeight: '600', fontSize: '14px', color: '#2c3e50' }}>{user?.user_name || 'User'}</div>
            <div style={{ fontSize: '12px', color: '#7f8c8d' }}>{user?.email || ''}</div>
          </div>
        </div>
        <button className="logout-btn" onClick={() => setShowLogoutConfirm(true)} title="Logout">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
        </button>
      </div>
    </div>
  );
  };

  return (
    <MobileBlocker>
      <div className="dashboard">
      <div
        className={`mobile-overlay${mobileSidebarOpen ? ' active' : ''}`}
        onClick={() => setMobileSidebarOpen(false)}
        aria-hidden="true"
      />
      {renderSidebar()}
      <div className="main-content">
        {renderHeader()}
        <Outlet context={{ setShowSendLinkModal }} />
      </div>

      {/* Mobile Bottom Navigation */}
      <nav className="mobile-bottom-nav" aria-label="Mobile navigation">
        <div className="mobile-bottom-nav-items">
          {/* Dashboard */}
          <div
            className={`mobile-nav-item ${isNavActive({ name: 'Dashboard', icon: '', path: '/dashboard' }) ? 'active' : ''}`}
            onClick={() => navigate('/dashboard')}
          >
            <div className="mobile-nav-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7" rx="1"/>
                <rect x="14" y="3" width="7" height="7" rx="1"/>
                <rect x="3" y="14" width="7" height="7" rx="1"/>
                <rect x="14" y="14" width="7" height="7" rx="1"/>
              </svg>
            </div>
            <span>Dashboard</span>
          </div>

          {/* All Clients */}
          <div
            className={`mobile-nav-item ${isNavActive({ name: 'All Clients', icon: '', path: '/clients' }) ? 'active' : ''}`}
            onClick={() => navigate('/clients')}
          >
            <div className="mobile-nav-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
            </div>
            <span>Clients</span>
          </div>

          {/* Bookings */}
          <div
            className={`mobile-nav-item ${isNavActive({ name: 'Bookings', icon: '', path: '/bookings' }) ? 'active' : ''}`}
            onClick={() => navigate('/bookings')}
          >
            <div className="mobile-nav-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                <line x1="16" y1="2" x2="16" y2="6"/>
                <line x1="8" y1="2" x2="8" y2="6"/>
                <line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
            </div>
            <span>Bookings</span>
          </div>

          {/* My Calendars */}
          <div
            className={`mobile-nav-item ${isNavActive({ name: 'My Calendars', icon: '', path: '/my-calendar' }) ? 'active' : ''}`}
            onClick={() => navigate('/my-calendar')}
          >
            <div className="mobile-nav-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
              </svg>
            </div>
            <span>Calendars</span>
          </div>

          {/* My Profile */}
          <div
            className={`mobile-nav-item ${!showNotificationsPage && location.pathname.startsWith('/settings/my-profile') ? 'active' : ''}`}
            onClick={() => navigate('/settings/my-profile')}
          >
            <div className="mobile-nav-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
            </div>
            <span>Profile</span>
          </div>
        </div>
      </nav>

      <SendBookingLinkModal
        isOpen={showSendLinkModal}
        onClose={() => setShowSendLinkModal(false)}
      />
      {showCreateBookingModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
          zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '24px'
        }} onClick={() => setShowCreateBookingModal(false)}>
          <div style={{
            background: '#fff', borderRadius: '16px', width: '100%', maxWidth: '860px',
            maxHeight: '90vh', overflowY: 'auto', position: 'relative'
          }} onClick={e => e.stopPropagation()}>
            <button onClick={() => setShowCreateBookingModal(false)} style={{ position: 'absolute', top: '16px', right: '16px', background: 'none', border: 'none', fontSize: '22px', cursor: 'pointer', color: '#666', zIndex: 1 }}>×</button>
            <CreateBooking onBack={() => setShowCreateBookingModal(false)} />
          </div>
        </div>
      )}
      {showAddClientModal && (
        <AddClientModal onClose={() => setShowAddClientModal(false)} />
      )}
      <UpgradePlanModal isOpen={showUpgradeModal} onClose={() => setShowUpgradeModal(false)} />

      <ConfirmModal
        isOpen={showLogoutConfirm}
        title="Log out"
        message="Are you sure you want to log out?"
        confirmLabel="Yes, log out"
        cancelLabel="Stay logged in"
        danger
        onConfirm={() => { setShowLogoutConfirm(false); logout(); }}
        onCancel={() => setShowLogoutConfirm(false)}
      />
    </div>
    </MobileBlocker>
  );
};

const FREE_TIER_ANALYTICS_DAYS = 90;

const DashboardHome: React.FC = () => {
  const { user } = useAuth();
  const toast = useToast();
  const { setShowSendLinkModal } = useOutletContext<{ setShowSendLinkModal: any }>();
  const isFreeTier = !user?.plan_name || user.plan_name === 'free';
  const [dateFilter, setDateFilter] = useState<string>('all_time');
  const [showTeamAnalytics, setShowTeamAnalytics] = useState<boolean>(false);
  const [showDateDropdown, setShowDateDropdown] = useState<boolean>(false);
  const [showCustomDatePicker, setShowCustomDatePicker] = useState<boolean>(false);
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const navigate = useNavigate();
  const location = useLocation();
  const dateDropdownRef = React.useRef<HTMLDivElement>(null);

  // Earliest date free-tier users can query analytics for
  const getFreeTierMinDate = (): Date => {
    const d = new Date();
    d.setDate(d.getDate() - FREE_TIER_ANALYTICS_DAYS);
    d.setHours(0, 0, 0, 0);
    return d;
  };

  const getFreeTierMinDateStr = (): string => getFreeTierMinDate().toISOString().split('T')[0];

  // Handle Google Calendar OAuth redirect result
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('calendar_connected') === 'true') {
      toast.success('Google Calendar connected successfully!');
      navigate('/dashboard', { replace: true });
    } else if (params.get('calendar_error')) {
      toast.error('Failed to connect Google Calendar. Please try again.');
      navigate('/dashboard', { replace: true });
    }
  }, []);

  // Load analytics mode from URL params
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const analyticsMode = params.get('analytics');
    if (analyticsMode === 'enterprise' && user?.plan_name === 'team' && user?.org_role !== 'member') {
      setShowTeamAnalytics(true);
    }
  }, [location.search, user]);

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dateDropdownRef.current && !dateDropdownRef.current.contains(event.target as Node)) {
        setShowDateDropdown(false);
      }
    };

    if (showDateDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showDateDropdown]);

  // Get current month and adjacent months
  const getCurrentMonthOptions = () => {
    const now = new Date();
    const months = [];
    
    // Previous month
    const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    months.push({
      value: `${prevMonth.toLocaleString('en-US', { month: 'short' })} ${prevMonth.getFullYear()}`,
      label: `${prevMonth.toLocaleString('en-US', { month: 'short' })} ${prevMonth.getFullYear()}`
    });
    
    // Current month
    const currentMonth = `${now.toLocaleString('en-US', { month: 'short' })} ${now.getFullYear()}`;
    months.push({
      value: currentMonth,
      label: currentMonth
    });
    
    // Next month
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    months.push({
      value: `${nextMonth.toLocaleString('en-US', { month: 'short' })} ${nextMonth.getFullYear()}`,
      label: `${nextMonth.toLocaleString('en-US', { month: 'short' })} ${nextMonth.getFullYear()}`
    });
    
    return months;
  };

  const getDateFilterLabel = () => {
    if (dateFilter === 'all_time') return 'All time';
    if (dateFilter === 'custom' && customStartDate && customEndDate) {
      return `${new Date(customStartDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${new Date(customEndDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
    }
    return dateFilter;
  };

  const handleDateFilterSelect = (value: string) => {
    if (value === 'custom') {
      setShowCustomDatePicker(true);
    } else if (isFreeTier && value !== 'all_time' && value !== 'custom') {
      // Check if the selected month is entirely before the free-tier cutoff
      const parts = value.split(' ');
      if (parts.length === 2) {
        const month = parts[0];
        const year = parts[1];
        const monthIndex = new Date(`${month} 1, 2000`).getMonth();
        const yearNum = parseInt(year);
        if (!isNaN(yearNum)) {
          const monthEnd = new Date(yearNum, monthIndex + 1, 0, 23, 59, 59);
          if (monthEnd < getFreeTierMinDate()) {
            toast.error(`Free plan analytics is limited to the last ${FREE_TIER_ANALYTICS_DAYS} days. Upgrade to access older data.`);
            return;
          }
        }
      }
    }
    setDateFilter(value);
    setShowDateDropdown(false);
  };

  // Dynamically calculate profile progress based on optional user fields (email & user_name excluded as they are always filled)
  const profileProgress = useMemo(() => {
    if (!user) return 0;

    const profileFields = [
      user.phone,
      user.date_of_birth,
      user.gender,
      user.specialization,
      user.language_spoken,
      user.country,
      user.state,
      user.city,
      user.pincode,
      user.clinic_address
    ];

    const filledFields = profileFields.filter(field => {
      if (!field) return false;
      
      // Handle arrays
      if (Array.isArray(field)) {
        return field.length > 0 && field.some(f => f && f.toString().trim() !== '');
      }
      
      // Handle strings and other types
      return typeof field === 'string' ? field.trim() !== '' : true;
    }).length;
    
    const totalFields = profileFields.length;

    return filledFields === totalFields ? 100 : Math.floor((filledFields / totalFields) * 100);
  }, [user]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>({
    revenue: '₹0',
    refund: '₹0',
    sessions: 0,
    cancelled: 0,
    noShow: 0,
    pendingNotes: 0,
    pendingPayment: 0,
    noOfClients: 0
  });
  const [recentBookings, setRecentBookings] = useState<any[]>([]);

  // Action menu state
  const [activeMenuId, setActiveMenuId] = useState<number | null>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  // Reschedule state
  const [rescheduleAppt, setRescheduleAppt] = useState<any | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState(new Date().toISOString().split('T')[0]);
  const [rescheduleSlot, setRescheduleSlot] = useState<string | null>(null);
  const [rescheduling, setRescheduling] = useState(false);
  const [cancelConfirmId, setCancelConfirmId] = useState<number | null>(null);

  // Dashboard widget prefs (enterprise only)
  const isEnterprise = user?.plan_name === 'team';
  const ALL_WIDGETS = ['Revenue', 'Refund', 'Sessions', 'Cancelled', 'No Show', 'Pending Notes', 'Pending Payment', 'No of Clients'];
  const defaultWidgets = Object.fromEntries(ALL_WIDGETS.map(k => [k, true]));
  const [widgetPrefs, setWidgetPrefs] = useState<Record<string, boolean>>(defaultWidgets);
  const [showEditDashboard, setShowEditDashboard] = useState(false);
  const [editWidgets, setEditWidgets] = useState<Record<string, boolean>>(defaultWidgets);
  const [savingWidgets, setSavingWidgets] = useState(false);

  useEffect(() => {
    if (!isEnterprise) return;
    fetch(`${API_BASE_URL}/auth/dashboard-prefs`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.widgets) { setWidgetPrefs(d.widgets); setEditWidgets(d.widgets); } })
      .catch(() => {});
  }, [isEnterprise]);

  // Close menu on outside click
  useEffect(() => {
    if (activeMenuId === null) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setActiveMenuId(null); setMenuPos(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [activeMenuId]);

  useEffect(() => {
    const fetchDashboardData = async () => {
      setLoading(true);
      try {
        // Build stats URL with date filter
        const isTeamOwner = user?.plan_name === 'team' && user?.org_role !== 'member';
        let statsUrl = `${API_BASE_URL}/${showTeamAnalytics && isTeamOwner ? 'auth/team-analytics' : 'api/bookings/stats'}`;
        const freeCutoff = isFreeTier ? getFreeTierMinDate() : null;

        if (dateFilter !== 'all_time' && dateFilter !== 'custom') {
          // Parse month filter (e.g., "Dec 2025")
          const parts = dateFilter.split(' ');
          if (parts.length === 2) {
            const month = parts[0];
            const year = parts[1];
            const monthIndex = new Date(`${month} 1, 2000`).getMonth();
            const yearNum = parseInt(year);
            if (!isNaN(yearNum)) {
              let startDate = new Date(yearNum, monthIndex, 1);
              const endDate = new Date(yearNum, monthIndex + 1, 0, 23, 59, 59);
              // Clamp start date for free tier
              if (freeCutoff && startDate < freeCutoff) startDate = freeCutoff;
              statsUrl += `?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`;
            }
          }
        } else if (dateFilter === 'custom' && customStartDate && customEndDate) {
          let startDate = new Date(customStartDate);
          const endDate = new Date(customEndDate);
          // Clamp start date for free tier
          if (freeCutoff && startDate < freeCutoff) startDate = freeCutoff;
          statsUrl += `?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`;
        } else if (dateFilter === 'all_time' && freeCutoff) {
          // Free tier: restrict "all time" to last 90 days
          statsUrl += `?startDate=${freeCutoff.toISOString()}`;
        }

        // Fetch Stats
        const statsRes = await fetch(statsUrl, { credentials: 'include' });
        if (statsRes.ok) {
          const data = await statsRes.json();
          setStats(data);
        } else {
          const errData = await statsRes.json().catch(() => ({}));
          toast.error(`Failed to load analytics: ${errData.error || 'Unknown error'}`);
          console.error('Failed to fetch stats:', statsRes.statusText);
        }

        // Fetch Upcoming Bookings only
        const bookingsUrl = showTeamAnalytics
          ? `${API_BASE_URL}/api/bookings?upcoming=true&enterprise=true`
          : `${API_BASE_URL}/api/bookings?upcoming=true`;
        const bookingsRes = await fetch(bookingsUrl, { credentials: 'include' });
        if (bookingsRes.ok) {
          const data = await bookingsRes.json();
          setRecentBookings(data);
        } else {
          const errData = await bookingsRes.json().catch(() => ({}));
          toast.error(`Failed to load bookings: ${errData.error || 'Unknown error'}`);
          console.error('Failed to fetch bookings:', bookingsRes.statusText);
        }
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [dateFilter, customStartDate, customEndDate, showTeamAnalytics, user]);

  const refreshBookings = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/bookings?upcoming=true`, { credentials: 'include' });
      if (res.ok) {
        setRecentBookings(await res.json());
      } else {
        const errData = await res.json().catch(() => ({}));
        toast.error(`Failed to refresh bookings: ${errData.error || 'Unknown error'}`);
      }
    } catch (error) {
      toast.error('Network error while refreshing bookings');
      console.error('refreshBookings error:', error);
    }
  };

  const handleSendReminder = async (booking: any) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/bookings/${booking.id}/reminder`, {
        method: 'POST', credentials: 'include'
      });
      if (res.ok) toast.success('Reminder sent to client!');
      else toast.error('Failed to send reminder');
    } catch { toast.error('Network error'); }
  };

  const handleCancelBooking = async (id: number) => {
    const res = await fetch(`${API_BASE_URL}/api/bookings/${id}/status`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      credentials: 'include', body: JSON.stringify({ status: 'cancelled' })
    });
    if (res.ok) { toast.success('Booking cancelled'); setCancelConfirmId(null); refreshBookings(); }
    else toast.error('Failed to cancel booking');
  };

  const handleMarkPaid = async (id: number) => {
    const res = await fetch(`${API_BASE_URL}/api/bookings/${id}/payment`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      credentials: 'include', body: JSON.stringify({ payment_status: 'Paid' })
    });
    if (res.ok) { toast.success('Marked as paid!'); refreshBookings(); }
    else toast.error('Failed to update payment');
  };

  const handleReschedule = async () => {
    if (!rescheduleAppt || !rescheduleSlot) return;
    setRescheduling(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/bookings/${rescheduleAppt.id}/reschedule`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        credentials: 'include', body: JSON.stringify({ new_start_time: rescheduleSlot })
      });
      if (res.ok) {
        toast.success('Booking rescheduled!');
        setRescheduleAppt(null); setRescheduleSlot(null);
        refreshBookings();
      } else {
        const err = await res.json();
        toast.error(err.error || 'Failed to reschedule');
      }
    } catch { toast.error('Network error'); }
    finally { setRescheduling(false); }
  };

  const menuItemStyle: React.CSSProperties = {
    display: 'block', width: '100%', padding: '10px 16px', border: 'none',
    background: 'none', textAlign: 'left', fontFamily: 'Urbanist', fontWeight: 500,
    fontSize: '13px', color: '#082421', cursor: 'pointer', borderBottom: '1px solid #f5f5f5',
  };

  const statsData: StatData[] = [
    { label: 'Revenue', value: `₹${(stats.revenue ?? 0).toLocaleString()}` },
    { label: 'Refund', value: `₹${(stats.refund ?? 0).toLocaleString()}` },
    { label: 'Sessions', value: (stats.sessions ?? 0).toString() },
    { label: 'Cancelled', value: (stats.cancelled ?? 0).toString() },
    { label: 'No Show', value: (stats.noShow ?? 0).toString() },
    { label: 'Pending Notes', value: (stats.pendingNotes ?? 0).toString() },
    { label: 'Pending Payment', value: (stats.pendingPayment ?? 0).toString() },
    { label: 'No of Clients', value: (stats.noOfClients ?? 0).toString() }
  ].filter(s => !isEnterprise || widgetPrefs[s.label] !== false);

  const handleSaveWidgetPrefs = async () => {
    setSavingWidgets(true);
    try {
      const res = await fetch(`${API_BASE_URL}/auth/dashboard-prefs`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ widgets: editWidgets }),
      });
      if (res.ok) {
        setWidgetPrefs({ ...editWidgets });
        setShowEditDashboard(false);
      }
    } catch { /* silent */ }
    finally { setSavingWidgets(false); }
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

  const upcomingBookings = useMemo(() => {
    const now = new Date();
    return recentBookings.filter(b => new Date(b.start_time) >= now && b.status !== 'cancelled');
  }, [recentBookings]);

  const bookingColumns: ColumnDef<any, any>[] = useMemo(() => {
    const cols: ColumnDef<any, any>[] = [
      {
        accessorKey: 'start_time',
        header: 'Session Timings',
        cell: ({ getValue }) => <span className="session-time">{formatDateTime(getValue())}</span>,
      },
      {
        accessorKey: 'client_name',
        header: 'Client Name',
        cell: ({ getValue }) => <span className="client-name">{getValue() || 'Client'}</span>,
      },
      {
        accessorKey: 'title',
        header: 'Session Type',
        cell: ({ getValue }) => <span className="session-type">{getValue()}</span>,
      },
    ];

    if (showTeamAnalytics) {
      cols.push({
        accessorKey: 'therapist_name',
        header: 'Therapist Name',
        cell: ({ getValue }) => <span className="therapist-name">{getValue() || 'N/A'}</span>,
      });
    }

    cols.push(
      {
        id: 'mode',
        header: 'Mode',
        enableSorting: false,
        cell: ({ row }) => (
          <span className="session-mode">{row.original.meet_link ? 'Google Meet' : (row.original.location_type === 'in_person' ? 'In-person' : 'Google Meet')}</span>
        ),
      },
      {
        id: 'actions',
        header: 'Actions',
        enableSorting: false,
        cell: ({ row }) => {
          const { id, payment_status } = row.original;
          const isMenuOpen = activeMenuId === id;
          return (
            <div style={{ position: 'relative' }}>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (isMenuOpen) { setActiveMenuId(null); setMenuPos(null); return; }
                  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                  setMenuPos({ top: rect.bottom + window.scrollY + 4, right: window.innerWidth - rect.right });
                  setActiveMenuId(id);
                }}
                style={{ background: 'none', border: '1px solid #e0e0e0', borderRadius: '6px', padding: '4px 10px', cursor: 'pointer', color: '#333', fontSize: '16px', lineHeight: 1 }}
              >
                ···
              </button>
            </div>
          );
        },
      }
    );
    return cols;
  }, [activeMenuId, showTeamAnalytics]);

  return (
    <div className="dashboard-content">
      <div className="dashboard-header">
        <div>
          <h1>Dashboard</h1>
          <p>Welcome Back, {user?.user_name || 'User'}!</p>
        </div>
        <div className="header-right">
          {profileProgress < 100 && (
            <div className="profile-completion">
              <div className="completion-circle">
                <svg width="48" height="48" viewBox="0 0 48 48">
                  <circle cx="24" cy="24" r="20" fill="none" stroke="#e9ecef" strokeWidth="4" />
                  <circle cx="24" cy="24" r="20" fill="none" stroke="#2D7579" strokeWidth="4"
                    strokeDasharray={`${2 * Math.PI * 20}`}
                    strokeDashoffset={`${2 * Math.PI * 20 * (1 - profileProgress / 100)}`}
                    strokeLinecap="round" transform="rotate(-90 24 24)"
                    style={{ transition: 'stroke-dashoffset 0.5s ease' }}
                  />
                  <text x="24" y="28" textAnchor="middle" fontSize="12" fontWeight="600" fill="#000000">{profileProgress}%</text>
                </svg>
              </div>
              <span onClick={() => navigate('/settings/my-profile')} style={{ cursor: 'pointer' }}>Complete your profile <img src="Edit.svg" alt="Edit" style={{ width: '16px', height: '16px', marginLeft: '4px' }} /></span>
            </div>
          )}
          <div className="date-selector-wrapper" ref={dateDropdownRef}>
            <div className="date-selector" onClick={() => setShowDateDropdown(!showDateDropdown)}>
              <div className="date-icon"><img src="/Graph.svg" alt="Graph" /></div>
              <span>{getDateFilterLabel()}</span>
              <div className="dropdown-arrow">▼</div>
            </div>
            {showDateDropdown && (
              <div className="date-dropdown">
                <div className={`dropdown-item ${dateFilter === 'custom' ? 'selected' : ''}`} onClick={() => handleDateFilterSelect('custom')}>Custom</div>
                <div className={`dropdown-item ${dateFilter === 'all_time' ? 'selected' : ''}`} onClick={() => handleDateFilterSelect('all_time')}>All time</div>
                {getCurrentMonthOptions().map((month) => (
                  <div key={month.value} className={`dropdown-item ${dateFilter === month.value ? 'selected' : ''}`} onClick={() => handleDateFilterSelect(month.value)}>{month.label}</div>
                ))}
              </div>
            )}
          </div>
          {user?.plan_name === 'team' && user?.org_role !== 'member' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', background: '#f5f5f5', borderRadius: '8px', border: '1px solid #e0e0e0' }}>
              <div style={{ fontSize: '13px', fontWeight: 500, color: '#333', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>{showTeamAnalytics ? 'Team Analytics' : 'My Analytics'}</span>
                <button
                  className={`analytics-toggle-switch ${showTeamAnalytics ? 'toggle-on' : ''}`}
                  onClick={() => {
                    const newState = !showTeamAnalytics;
                    setShowTeamAnalytics(newState);
                    const params = new URLSearchParams(location.search);
                    if (newState) {
                      params.set('analytics', 'enterprise');
                    } else {
                      params.delete('analytics');
                    }
                    navigate(`/dashboard?${params.toString()}`, { replace: true });
                  }}
                  role="switch"
                  aria-checked={showTeamAnalytics}
                >
                  <span className="analytics-toggle-thumb" />
                </button>
              </div>
            </div>
          )}
          {showCustomDatePicker && (
            <div className="custom-date-modal" onClick={() => setShowCustomDatePicker(false)}>
              <div className="custom-date-content" onClick={(e) => e.stopPropagation()}>
                <h3>Select Date Range</h3>
                {isFreeTier && (
                  <p style={{ margin: '0 0 12px', fontSize: '12px', color: '#B45309', background: '#FEF3C7', borderRadius: '6px', padding: '8px 10px' }}>
                    Free plan: analytics limited to the last {FREE_TIER_ANALYTICS_DAYS} days. Contact us to upgrade.
                  </p>
                )}
                <div className="date-inputs">
                  <div className="date-input-group">
                    <label>Start Date</label>
                    <input
                      type="date"
                      value={customStartDate}
                      min={isFreeTier ? getFreeTierMinDateStr() : undefined}
                      max={new Date().toISOString().split('T')[0]}
                      onChange={(e) => {
                        let val = e.target.value;
                        if (isFreeTier && val < getFreeTierMinDateStr()) {
                          val = getFreeTierMinDateStr();
                          toast.error(`Free plan analytics is limited to the last ${FREE_TIER_ANALYTICS_DAYS} days.`);
                        }
                        setCustomStartDate(val);
                      }}
                    />
                  </div>
                  <div className="date-input-group">
                    <label>End Date</label>
                    <input
                      type="date"
                      value={customEndDate}
                      min={isFreeTier ? getFreeTierMinDateStr() : customStartDate || undefined}
                      max={new Date().toISOString().split('T')[0]}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                    />
                  </div>
                </div>
                <div className="date-modal-actions">
                  <button onClick={() => setShowCustomDatePicker(false)} className="cancel-btn">Cancel</button>
                  <button
                    onClick={() => {
                      if (customStartDate && customEndDate) {
                        // Final clamp safety check
                        if (isFreeTier && customStartDate < getFreeTierMinDateStr()) {
                          setCustomStartDate(getFreeTierMinDateStr());
                        }
                        setShowCustomDatePicker(false);
                      }
                    }}
                    className="apply-btn"
                    disabled={!customStartDate || !customEndDate}
                  >Apply</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="stats-grid">
        {statsData.map((stat, index) => (
          <div key={index} className="stat-card">
            <div className="stat-label">{stat.label}</div>
            <div className="stat-value">{stat.value}</div>
          </div>
        ))}
      </div>

      {/* Edit Dashboard Modal */}
      {showEditDashboard && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}
          onClick={() => !savingWidgets && setShowEditDashboard(false)}>
          <div style={{ background: '#fff', borderRadius: '16px', padding: '28px', width: '100%', maxWidth: '420px' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <h2 style={{ fontFamily: 'Urbanist', fontWeight: 700, fontSize: '20px', margin: 0 }}>Edit Dashboard</h2>
              <button onClick={() => setShowEditDashboard(false)} style={{ background: 'none', border: 'none', fontSize: '22px', cursor: 'pointer', color: '#666', lineHeight: 1 }}>×</button>
            </div>
            <p style={{ fontFamily: 'Urbanist', fontSize: '13px', color: '#6E6E6E', margin: '0 0 20px 0' }}>Show or hide analytics modules on your dashboard.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
              {ALL_WIDGETS.map(key => (
                <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid #f0f0f0' }}>
                  <span style={{ fontFamily: 'Urbanist', fontWeight: 600, fontSize: '15px', color: '#111' }}>{key}</span>
                  <button
                    onClick={() => setEditWidgets(prev => ({ ...prev, [key]: !prev[key] }))}
                    style={{
                      position: 'relative', width: '44px', height: '24px', borderRadius: '12px',
                      background: editWidgets[key] ? '#082421' : '#d1d5db',
                      border: 'none', cursor: 'pointer', padding: 0, transition: 'background 0.2s',
                    }}
                    role="switch" aria-checked={editWidgets[key]}
                  >
                    <span style={{
                      position: 'absolute', top: '3px', left: editWidgets[key] ? '23px' : '3px',
                      width: '18px', height: '18px', borderRadius: '50%', background: '#fff',
                      transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                    }} />
                  </button>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '20px' }}>
              <button onClick={() => setShowEditDashboard(false)} disabled={savingWidgets}
                style={{ padding: '9px 20px', borderRadius: '8px', border: '1px solid #e0e0e0', background: '#fff', fontFamily: 'Urbanist', fontWeight: 500, fontSize: '14px', cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={handleSaveWidgetPrefs} disabled={savingWidgets}
                style={{ padding: '9px 20px', borderRadius: '8px', border: 'none', background: '#082421', fontFamily: 'Urbanist', fontWeight: 600, fontSize: '14px', color: '#fff', cursor: savingWidgets ? 'not-allowed' : 'pointer', opacity: savingWidgets ? 0.7 : 1 }}>
                {savingWidgets ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="content-sections">
        <div>
          <h2 style={{ margin: '0 0 24px 0', fontFamily: 'Urbanist', fontWeight: '600', fontSize: '20px', color: '#082421' }}>Upcoming Bookings</h2>
          {loading ? (
            <Loader />
          ) : (
            <DataTable
              data={upcomingBookings}
              columns={bookingColumns}
              pageSize={5}
              emptyMessage="No upcoming bookings found."
            />
          )}
        </div>
      </div>

      {/* Portal action menu */}
      {activeMenuId !== null && menuPos && (() => {
        const booking = recentBookings.find(b => b.id === activeMenuId);
        if (!booking) return null;
        const canMarkPaid = booking.payment_status === 'Pending';
        return createPortal(
          <div ref={menuRef} style={{
            position: 'absolute', top: menuPos.top, right: menuPos.right,
            background: '#fff', border: '1px solid #e9ecef', borderRadius: '10px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)', zIndex: 9999,
            minWidth: '180px', overflow: 'hidden'
          }} onClick={e => e.stopPropagation()}>
            <button onClick={() => { handleSendReminder(booking); setActiveMenuId(null); setMenuPos(null); }} style={menuItemStyle}>
              Send Reminder
            </button>
            <button onClick={() => { setRescheduleAppt(booking); setRescheduleDate(new Date().toISOString().split('T')[0]); setRescheduleSlot(null); setActiveMenuId(null); setMenuPos(null); }} style={menuItemStyle}>
              Reschedule Booking
            </button>
            <button onClick={() => { setCancelConfirmId(booking.id); setActiveMenuId(null); setMenuPos(null); }} style={{ ...menuItemStyle, color: '#c62828' }}>
              Cancel Booking
            </button>
            {canMarkPaid && (
              <button onClick={() => { handleMarkPaid(booking.id); setActiveMenuId(null); setMenuPos(null); }} style={{ ...menuItemStyle, color: '#2e7d32', borderBottom: 'none' }}>
                Mark as Paid
              </button>
            )}
          </div>,
          document.body
        );
      })()}

      {/* Reschedule lightbox */}
      {rescheduleAppt && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 2000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '40px 24px', overflowY: 'auto' }}
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
              <TimeSlotList calendarId={rescheduleAppt.calendar_id} selectedDate={rescheduleDate} selectedSlot={rescheduleSlot} onSlotSelect={setRescheduleSlot} />
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
        isOpen={cancelConfirmId !== null}
        title="Cancel Booking"
        message="Are you sure you want to cancel this booking?"
        confirmLabel="Yes, Cancel"
        cancelLabel="Keep Booking"
        danger
        onConfirm={() => { if (cancelConfirmId) handleCancelBooking(cancelConfirmId); }}
        onCancel={() => setCancelConfirmId(null)}
      />
    </div>
  );
};

const BASE_URL = 'https://app.mellominds.co.in';
const DEFAULT_DESCRIPTION = 'A Dashboard to streamline your mental health practice with MelloMinds. An all-in-one platform for appointments, billing, and therapy notes designed for therapists.';

function setPageMeta(title: string, description: string, path: string) {
  document.title = title;

  const descEl = document.getElementById('meta-description') as HTMLMetaElement | null;
  if (descEl) descEl.content = description;

  const canonicalEl = document.getElementById('canonical-tag') as HTMLLinkElement | null;
  if (canonicalEl) canonicalEl.href = `${BASE_URL}${path}`;
}

const PageTitle: React.FC = () => {
  const location = useLocation();

  useEffect(() => {
    type PageMeta = { title: string; description: string };
    const pageMeta: Record<string, PageMeta> = {
      '/login': {
        title: 'Login – MelloMinds',
        description: 'Sign in to your MelloMinds account to manage your therapy practice.',
      },
      '/signup': {
        title: 'Sign Up – MelloMinds',
        description: 'Create your MelloMinds account and start streamlining your mental health practice today.',
      },
      '/privacy-policy': {
        title: 'Privacy Policy – MelloMinds',
        description: 'Read the MelloMinds Privacy Policy to understand how we collect, use, and protect your data.',
      },
      '/terms-of-service': {
        title: 'Terms of Service – MelloMinds',
        description: 'Review the MelloMinds Terms of Service governing your use of our therapy practice management platform.',
      },
      '/dashboard': { title: 'Dashboard – MelloMinds', description: DEFAULT_DESCRIPTION },
      '/clients': { title: 'All Clients – MelloMinds', description: DEFAULT_DESCRIPTION },
      '/bookings': { title: 'Bookings – MelloMinds', description: DEFAULT_DESCRIPTION },
      '/my-calendar': { title: 'My Calendars – MelloMinds', description: DEFAULT_DESCRIPTION },
      '/my-calendar/new': { title: 'Create Event – MelloMinds', description: DEFAULT_DESCRIPTION },
      '/my-calendar/edit': { title: 'Edit Event – MelloMinds', description: DEFAULT_DESCRIPTION },
      '/payment-invoice': { title: 'Payments & Invoice – MelloMinds', description: DEFAULT_DESCRIPTION },
      '/settings': { title: 'My Settings – MelloMinds', description: DEFAULT_DESCRIPTION },
      '/settings/my-profile': { title: 'My Profile – MelloMinds', description: DEFAULT_DESCRIPTION },
      '/settings/client-notes-template': { title: 'Client Notes Template – MelloMinds', description: DEFAULT_DESCRIPTION },
      '/settings/email-preferences': { title: 'Email Preferences – MelloMinds', description: DEFAULT_DESCRIPTION },
      '/notifications': { title: 'Notifications – MelloMinds', description: DEFAULT_DESCRIPTION },
    };

    // Skip /book/ routes — PublicBookingPage sets its own meta after data loads
    if (location.pathname.startsWith('/book/')) return;

    const match = Object.keys(pageMeta).find(p => location.pathname === p)
      || Object.keys(pageMeta).find(p => location.pathname.startsWith(p + '/'));

    const meta = match ? pageMeta[match] : { title: 'MelloMinds', description: DEFAULT_DESCRIPTION };
    setPageMeta(meta.title, meta.description, location.pathname);

    // Fire GA4 page view on route change
    if (typeof (window as any).gtag === 'function') {
      (window as any).gtag('event', 'page_view', { page_path: location.pathname });
    }
  }, [location.pathname]);

  return null;
};

const AppContent: React.FC = () => {
  const { toasts, removeToast } = useToast();

  return (
    <>
      <BrowserRouter>
        <PageTitle />
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignUpPage />} />
          <Route path="/reset-password" element={<ResetPassword />} />

          {/* Protected Routes */}
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<DashboardLayout />}>
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard" element={<DashboardHome />} />
              <Route path="clients" element={<AllClients />} />
              <Route path="clients/list/:listTab" element={<AllClients />} />
              <Route path="clients/:clientId" element={<AllClients />} />
              <Route path="clients/:clientId/:tab" element={<AllClients />} />
              <Route path="therapists" element={<Therapists />} />
              <Route path="therapists/:id" element={<TherapistProfileView />} />
              <Route path="bookings" element={<Appointments />} />
              <Route path="bookings/:tab" element={<Appointments />} />
              <Route path="my-calendar" element={<CalendarPage />} />
              <Route path="my-calendar/new" element={<CreateEventPage />} />
              <Route path="my-calendar/edit" element={<CreateEventPage />} />
              <Route path="payment-invoice" element={<MemberGuard><PaymentsInvoice /></MemberGuard>} />
              <Route path="payment-invoice/:tab" element={<MemberGuard><PaymentsInvoice /></MemberGuard>} />
              <Route path="settings" element={<MySettings />} />
              <Route path="settings/my-profile" element={<MyProfile onBack={() => window.history.back()} />} />
              <Route path="settings/client-notes-template" element={<ClientNotesTemplate onBack={() => window.history.back()} />} />
              <Route path="settings/email-preferences" element={<EmailPreferences onBack={() => window.history.back()} />} />
              <Route path="settings/reminders" element={<ManageReminders onBack={() => window.history.back()} />} />
              <Route path="settings/edit-dashboard" element={<EditDashboard onBack={() => window.history.back()} />} />
              <Route path="settings/profile-link" element={<ProfileLink onBack={() => window.history.back()} />} />
              <Route path="settings/team-settings" element={<MemberGuard><TeamSettings onBack={() => window.history.back()} /></MemberGuard>} />
              <Route path="settings/team-analytics" element={<MemberGuard><TeamAnalytics onBack={() => window.history.back()} /></MemberGuard>} />
              <Route path="notifications" element={<NotificationsPage onBack={() => {}} />} />
            </Route>
          </Route>

          {/* Public Booking Route */}
          <Route path="/book/:userId" element={<TherapistProfilePage />} />
          <Route path="/book/:userId/:slug" element={<PublicBookingPage />} />
          <Route path="/booking-status" element={<BookingStatus />} />
          <Route path="/manage-booking/:token" element={<ManageBooking />} />

          {/* Privacy Policy */}
          <Route path="/privacy-policy" element={<PrivacyPolicy />} />

          {/* Terms of Service */}
          <Route path="/terms-of-service" element={<TermsOfService />} />

          {/* Catch all redirect to dashboard */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
      <ToastContainer toasts={toasts} onClose={removeToast} />
      <CookieBanner />
    </>
  );
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <ToastProvider>
        <SocketProvider>
          <NotificationProvider>
            <AppContent />
            <Analytics />
          </NotificationProvider>
        </SocketProvider>
      </ToastProvider>
    </AuthProvider>
  );
};

export default App;