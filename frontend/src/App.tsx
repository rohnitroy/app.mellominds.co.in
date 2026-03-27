import React, { useState, useEffect, useMemo } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useLocation, Outlet, Navigate, useOutletContext } from 'react-router-dom';
import './App.css';
import AllClients from './AllClients';
import Appointments from './Appointments';
import PaymentsInvoice from './PaymentsInvoice';
import MySettings from './MySettings';
import CreateBooking from './components/CreateBooking';
import SendBookingLinkModal from './components/SendBookingLinkModal';
import UpgradePlanModal from './components/UpgradePlanModal';
import CalendarPage from './components/CalendarPage';
import LoginPage from './components/LoginPage';
import SignUpPage from './components/SignUpPage';
import PublicBookingPage from './components/PublicBookingPage';
import CreateEventPage from './components/CreateEventPage';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider, useToast } from './context/ToastContext';
import { NotificationProvider, useNotifications } from './context/NotificationContext';
import ToastContainer from './components/ToastContainer';
import ProtectedRoute from './components/ProtectedRoute';
import API_BASE_URL from './config/api';
import { Category, TwoUsers, Calendar, Discovery, Wallet, Setting, Paper } from 'react-iconly';
import DataTable from './components/DataTable';
import { ColumnDef } from '@tanstack/react-table';
import QuickActionMenu from './components/QuickActionMenu';

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
  setShowNotificationsPage: (v: boolean) => void;
  showNotificationDropdown: boolean;
  setShowNotificationDropdown: (v: boolean) => void;
}> = ({ showNotificationsPage, setShowNotificationsPage, showNotificationDropdown, setShowNotificationDropdown }) => {
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const dropdownRef = React.useRef<HTMLDivElement>(null);

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

  const preview = notifications.slice(0, 5);

  return (
    <div className="notification-container" ref={dropdownRef} style={{ fontSize: '20px', cursor: 'pointer' }}
      onClick={() => setShowNotificationDropdown(!showNotificationDropdown)}>
      <img src={showNotificationDropdown ? 'Notification-tap.svg' : 'Notification.svg'} alt="bell" style={{ width: '35px', height: '35px' }} />
      {unreadCount > 0 && !showNotificationsPage && <div className="notification-badge"></div>}
      {showNotificationDropdown && (
        <div className="notification-dropdown" onClick={e => e.stopPropagation()}>
          <div className="notification-header">
            <div className="notification-title">Notifications {unreadCount > 0 && <span style={{ background: '#ff0000', color: '#fff', borderRadius: '10px', padding: '1px 7px', fontSize: '11px', marginLeft: '6px' }}>{unreadCount}</span>}</div>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              {unreadCount > 0 && (
                <button className="notification-view-more" onClick={e => { e.stopPropagation(); markAllAsRead(); }}>mark all read</button>
              )}
              <button className="notification-view-more" onClick={e => { e.stopPropagation(); setShowNotificationsPage(true); setShowNotificationDropdown(false); }}>view more→</button>
            </div>
          </div>
          {preview.length === 0 ? (
            <div style={{ padding: '20px', textAlign: 'center', color: '#6E6E6E', fontSize: '13px' }}>No notifications yet</div>
          ) : (
            preview.map(n => (
              <div key={n.id} className="notification-item" style={{ background: n.is_read ? 'white' : '#f0faf9' }}
                onClick={() => { if (!n.is_read) markAsRead(n.id); }}>
                <div className="notification-content">
                  <div className="notification-item-title" style={{ color: n.is_read ? '#555' : '#000' }}>{n.title}</div>
                  <div className="notification-item-desc">{n.description}</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px', flexShrink: 0, marginLeft: '8px' }}>
                  <span style={{ fontSize: '11px', color: '#6E6E6E', whiteSpace: 'nowrap' }}>{formatTime(n.created_at)}</span>
                  {!n.is_read && <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#2D7579', display: 'inline-block' }}></span>}
                </div>
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
  const { notifications, markAsRead, markAllAsRead } = useNotifications();

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
                onClick={() => { if (!n.is_read) markAsRead(n.id); }}>
                <div className="notification-card-content">
                  <h4 style={{ fontFamily: 'Urbanist', fontWeight: '700', fontSize: '20px', color: '#082421', margin: '0 0 6px 0' }}>{n.title}</h4>
                  <p style={{ fontFamily: 'Urbanist', fontWeight: '500', fontSize: '14px', color: '#6E6E6E', margin: '0' }}>{n.description}</p>
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

const DashboardLayout: React.FC = () => {
  const [showSendLinkModal, setShowSendLinkModal] = useState<boolean>(false);
  const [showNotificationDropdown, setShowNotificationDropdown] = useState<boolean>(false);
  const [showNotificationsPage, setShowNotificationsPage] = useState<boolean>(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState<boolean>(false);
  const [showCreateBookingModal, setShowCreateBookingModal] = useState<boolean>(false);
  const { logout, user } = useAuth();
  const { unreadCount } = useNotifications();
  const navigate = useNavigate();
  const location = useLocation();

  const navItems: NavItem[] = [
    { name: 'Dashboard', icon: 'Category1.svg', path: '/' },
    { name: 'All Clients', icon: '3 User.svg', path: '/clients' },
    { name: 'Bookings', icon: 'Calendar1.svg', path: '/bookings' },
    { name: 'My Calendars', icon: 'Category.svg', path: '/calendars' },
    { name: 'Payments & Invoice', icon: 'Wallet.svg', path: '/payments' }
  ];

  const bottomNavItems: NavItem[] = [
    { name: 'Notifications', icon: 'Notification.svg', path: '/notifications' },
    { name: 'My Settings', icon: 'Setting.svg', path: '/settings' }
  ];

  const isNavActive = (item: NavItem) =>
    !showNotificationsPage && (
      location.pathname === item.path ||
      (item.path !== '/' && location.pathname.startsWith(item.path))
    );

  const renderNavIcon = (name: string, active: boolean) => {
    const color = active ? '#082421' : '#D5FFFA';
    const props = { size: 24, primaryColor: color } as any;
    switch (name) {
      case 'Dashboard':          return <Category {...props} />;
      case 'All Clients':        return <TwoUsers {...props} />;
      case 'Bookings':           return <Paper {...props} />;
      case 'My Calendars':       return <Calendar {...props} />;
      case 'Payments & Invoice': return <Wallet {...props} />;
      case 'My Settings':        return <Setting {...props} />;
      default:                   return null;
    }
  };

  const renderSidebar = (): JSX.Element => (
    <div className="sidebar">
      <div className="logo">
        <img src="Frame 2 1 (1).svg" alt="MelloMinds Logo" />
      </div>

      <div className="nav-menu">
        {navItems.map((item) => (
          <div
            key={item.name}
            className={`nav-item ${isNavActive(item) ? 'active' : ''}`}
            onClick={() => { setShowNotificationsPage(false); navigate(item.path); }}
          >
            <span className={`nav-icon ${item.name === 'My Calendars' ? 'calendar-icon' : ''}`}>
              {renderNavIcon(item.name, isNavActive(item))}
            </span>
            {item.name}
          </div>
        ))}
      </div>

      <div className="nav-divider"></div>

      <div className="nav-bottom">
        {bottomNavItems.map((item) => (
          <div key={item.name} className={`nav-item ${
            item.name === 'Notifications'
              ? showNotificationsPage ? 'active' : ''
              : !showNotificationsPage && location.pathname === item.path ? 'active' : ''
          }`} onClick={() => {
            if (item.name === 'Notifications') {
              setShowNotificationsPage(true);
            } else {
              setShowNotificationsPage(false);
              navigate(item.path);
            }
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

      <div className="hello-section">
        <div style={{ transform: 'translate(-5px, 20px)' }}>
          Say 👋 hello<br />
          to <strong style={{ color: '#F9E141' }}>mello!</strong>
        </div>
      </div>

      <img src="MelloFevicon 1.svg" alt="Mello Favicon" className="sidebar-favicon" />
    </div>
  );

  const renderHeader = (): JSX.Element => (
    <div className="header">
      <div className="plan-info">
        <span>Your Plan:</span>
        <span className="free-tier">
          Free tier <img src="Danger Circle.svg" alt="Info" style={{ width: '17px', height: '17px', verticalAlign: 'middle' }} />
        </span>
        <button className="upgrade-btn" onClick={() => setShowUpgradeModal(true)}>Upgrade now</button>
      </div>

      <div className="user-info">
        <QuickActionMenu
          onCreateBooking={() => setShowCreateBookingModal(true)}
          onSendBookingLink={() => setShowSendLinkModal(true)}
        />
        <NotificationBell
          showNotificationsPage={showNotificationsPage}
          setShowNotificationsPage={setShowNotificationsPage}
          showNotificationDropdown={showNotificationDropdown}
          setShowNotificationDropdown={setShowNotificationDropdown}
        />
        <div className="user-info-card">
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
        <button className="logout-btn" onClick={logout}>
          <img src="Logout.svg" alt="Logout" />
        </button>
      </div>
    </div>
  );

  return (
    <div className="dashboard">
      {renderSidebar()}
      <div className="main-content">
        {renderHeader()}
        {showNotificationsPage ? (
          <NotificationsPage onBack={() => setShowNotificationsPage(false)} />
        ) : (
          <Outlet context={{ setShowSendLinkModal }} />
        )}
      </div>
      <SendBookingLinkModal
        isOpen={showSendLinkModal}
        onClose={() => setShowSendLinkModal(false)}
      />
      <UpgradePlanModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
      />
      {showCreateBookingModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
          zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '24px'
        }} onClick={() => setShowCreateBookingModal(false)}>
          <div style={{
            background: '#fff', borderRadius: '16px', width: '100%', maxWidth: '860px',
            maxHeight: '90vh', overflowY: 'auto'
          }} onClick={e => e.stopPropagation()}>
            <CreateBooking onBack={() => setShowCreateBookingModal(false)} />
          </div>
        </div>
      )}
    </div>
  );
};

const DashboardHome: React.FC = () => {
  const { user } = useAuth();
  const [dateFilter, setDateFilter] = useState<string>('all_time');
  const [showDateDropdown, setShowDateDropdown] = useState<boolean>(false);
  const [showCustomDatePicker, setShowCustomDatePicker] = useState<boolean>(false);
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const navigate = useNavigate();
  const dateDropdownRef = React.useRef<HTMLDivElement>(null);

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
    }
    setDateFilter(value);
    setShowDateDropdown(false);
  };

  // Dynamically calculate profile progress based on available user fields
  const calculateProfileProgress = () => {
    if (!user) return 0;

    const profileFields = [
      user.user_name,
      user.email,
      user.phone,
      user.dob,
      user.gender,
      user.specialization,
      user.language_spoken,
      user.country,
      user.state,
      user.city,
      user.pincode,
      user.clinic_address
    ];

    const filledFields = profileFields.filter(field => field && typeof field === 'string' && field.trim() !== '').length;
    const totalFields = profileFields.length;

    return filledFields === totalFields ? 100 : Math.floor((filledFields / totalFields) * 100);
  };

  const profileProgress = calculateProfileProgress();
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

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        // Build stats URL with date filter
        let statsUrl = `${API_BASE_URL}/api/bookings/stats`;
        if (dateFilter !== 'all_time' && dateFilter !== 'custom') {
          // Parse month filter (e.g., "Dec 2025")
          const [month, year] = dateFilter.split(' ');
          const monthIndex = new Date(`${month} 1, 2000`).getMonth();
          const startDate = new Date(parseInt(year), monthIndex, 1).toISOString();
          const endDate = new Date(parseInt(year), monthIndex + 1, 0, 23, 59, 59).toISOString();
          statsUrl += `?startDate=${startDate}&endDate=${endDate}`;
        } else if (dateFilter === 'custom' && customStartDate && customEndDate) {
          const startDate = new Date(customStartDate).toISOString();
          const endDate = new Date(customEndDate).toISOString();
          statsUrl += `?startDate=${startDate}&endDate=${endDate}`;
        }

        // Fetch Stats
        const statsRes = await fetch(statsUrl, { credentials: 'include' });
        if (statsRes.ok) {
          const data = await statsRes.json();
          setStats(data);
        } else {
          console.error('Failed to fetch stats:', statsRes.statusText);
        }

        // Fetch Upcoming Bookings only
        const bookingsRes = await fetch(`${API_BASE_URL}/api/bookings?upcoming=true`, { credentials: 'include' });
        if (bookingsRes.ok) {
          const data = await bookingsRes.json();
          setRecentBookings(data);
        } else {
          console.error('Failed to fetch bookings:', bookingsRes.statusText);
        }
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error);
      }
    };

    fetchDashboardData();
  }, [dateFilter, customStartDate, customEndDate]);

  const statsData: StatData[] = [
    { label: 'Revenue', value: stats.revenue },
    { label: 'Refund', value: stats.refund },
    { label: 'Sessions', value: stats.sessions.toString() },
    { label: 'Cancelled', value: stats.cancelled.toString() },
    { label: 'No Show', value: stats.noShow.toString() },
    { label: 'Pending Notes', value: stats.pendingNotes.toString() },
    { label: 'Pending Payment', value: stats.pendingPayment.toString() },
    { label: 'No of Clients', value: stats.noOfClients.toString() }
  ];


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

  const bookingColumns: ColumnDef<any, any>[] = useMemo(() => [
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
    {
      id: 'mode',
      header: 'Mode',
      enableSorting: false,
      cell: ({ row }) => (
        <span className="session-mode">{row.original.meet_link ? 'Google Meet' : 'In-person'}</span>
      ),
    },
  ], []);

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
              <span onClick={() => navigate('/settings', { state: { activeSection: 'My Profile' } })} style={{ cursor: 'pointer' }}>Complete your profile <img src="Edit.svg" alt="Edit" style={{ width: '16px', height: '16px', marginLeft: '4px' }} /></span>
            </div>
          )}
          <div className="date-selector-wrapper" ref={dateDropdownRef}>
            <div className="date-selector" onClick={() => setShowDateDropdown(!showDateDropdown)}>
              <div className="date-icon"><img src="Graph.svg" alt="Graph" /></div>
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
          {showCustomDatePicker && (
            <div className="custom-date-modal" onClick={() => setShowCustomDatePicker(false)}>
              <div className="custom-date-content" onClick={(e) => e.stopPropagation()}>
                <h3>Select Date Range</h3>
                <div className="date-inputs">
                  <div className="date-input-group">
                    <label>Start Date</label>
                    <input type="date" value={customStartDate} onChange={(e) => setCustomStartDate(e.target.value)} />
                  </div>
                  <div className="date-input-group">
                    <label>End Date</label>
                    <input type="date" value={customEndDate} onChange={(e) => setCustomEndDate(e.target.value)} />
                  </div>
                </div>
                <div className="date-modal-actions">
                  <button onClick={() => setShowCustomDatePicker(false)} className="cancel-btn">Cancel</button>
                  <button onClick={() => { if (customStartDate && customEndDate) setShowCustomDatePicker(false); }} className="apply-btn" disabled={!customStartDate || !customEndDate}>Apply</button>
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

      <div className="content-sections">
        <div>
          <h2 style={{ margin: '0 0 24px 0', fontFamily: 'Urbanist', fontWeight: '600', fontSize: '20px', color: '#082421' }}>Upcoming Bookings</h2>
          <DataTable
            data={upcomingBookings}
            columns={bookingColumns}
            pageSize={5}
            emptyMessage="No upcoming bookings found."
          />
        </div>


      </div>
    </div>
  );
};

const AppContent: React.FC = () => {
  const { toasts, removeToast } = useToast();

  return (
    <>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignUpPage />} />

          {/* Protected Routes */}
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<DashboardLayout />}>
              <Route index element={<DashboardHome />} />
              <Route path="clients" element={<AllClients />} />
              <Route path="bookings" element={<Appointments />} />
              <Route path="calendars" element={<CalendarPage />} />
              <Route path="calendars/new" element={<CreateEventPage />} />
              <Route path="calendars/edit" element={<CreateEventPage />} />
              <Route path="payments" element={<PaymentsInvoice />} />
              <Route path="settings" element={<MySettings />} />
            </Route>
          </Route>

          {/* Public Booking Route */}
          <Route path="/book/:userId/:slug" element={<PublicBookingPage />} />

          {/* Catch all redirect to login or dashboard */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
      <ToastContainer toasts={toasts} onClose={removeToast} />
    </>
  );
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <ToastProvider>
        <NotificationProvider>
          <AppContent />
        </NotificationProvider>
      </ToastProvider>
    </AuthProvider>
  );
};

export default App;