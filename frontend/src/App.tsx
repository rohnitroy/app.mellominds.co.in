import React, { useState, useEffect } from 'react';
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
import ToastContainer from './components/ToastContainer';
import ProtectedRoute from './components/ProtectedRoute';

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

interface Action {
  title: string;
  description: string;
  icon: JSX.Element;
  bg: string;
}

const DashboardLayout: React.FC = () => {
  const [showSendLinkModal, setShowSendLinkModal] = useState<boolean>(false);
  const [showNotificationDropdown, setShowNotificationDropdown] = useState<boolean>(false);
  const [showNotificationsPage, setShowNotificationsPage] = useState<boolean>(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState<boolean>(false);
  const { logout, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const navItems: NavItem[] = [
    { name: 'Dashboard', icon: 'Category1.svg', path: '/' },
    { name: 'All Clients', icon: '3 User.svg', path: '/clients' },
    { name: 'Appointments', icon: 'Calendar1.svg', path: '/appointments' },
    { name: 'My Calendars', icon: 'Category.svg', path: '/calendars' },
    { name: 'Payments & Invoice', icon: 'Wallet.svg', path: '/payments' }
  ];

  const bottomNavItems: NavItem[] = [
    { name: 'My Settings', icon: 'Setting.svg', path: '/settings' },
    { name: 'Contact Support', icon: 'Calling.svg', path: '/support' }
  ];

  const renderSidebar = (): JSX.Element => (
    <div className="sidebar">
      <div className="logo">
        <img src="Frame 2 1 (1).svg" alt="MelloMinds Logo" />
      </div>

      <div className="nav-menu">
        {navItems.map((item) => (
          <div
            key={item.name}
            className={`nav-item ${location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path)) ? 'active' : ''}`}
            onClick={() => navigate(item.path)}
          >
            <span className={`nav-icon ${item.name === 'My Calendars' ? 'calendar-icon' : ''}`}>
              <img src={item.icon} alt={item.name} />
            </span>
            {item.name}
          </div>
        ))}
      </div>

      <div className="nav-divider"></div>

      <div className="nav-bottom">
        {bottomNavItems.map((item) => (
          <div key={item.name} className={`nav-item ${location.pathname === item.path ? 'active' : ''}`} onClick={() => navigate(item.path)}>
            <span className="nav-icon">
              <img src={item.icon} alt={item.name} />
            </span>
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
        <div className="notification-container" style={{ fontSize: '20px', cursor: 'pointer' }} onClick={() => setShowNotificationDropdown(!showNotificationDropdown)}>
          <img src={showNotificationDropdown ? "Notification-tap.svg" : "Notification.svg"} alt="bell" style={{ width: '35px', height: '35px' }} />
          {!showNotificationsPage && <div className="notification-badge"></div>}
          {showNotificationDropdown && (
            <div className="notification-dropdown">
              <div className="notification-header">
                <div className="notification-title">Notifications</div>
                <button className="notification-view-more" onClick={(e) => { e.stopPropagation(); setShowNotificationsPage(true); setShowNotificationDropdown(false); }}>view more→</button>
              </div>
              <div className="notification-item">
                <div className="notification-content">
                  <div className="notification-item-title">New Booking</div>
                  <div className="notification-item-desc">You have received a new booking from Meet</div>
                </div>
                <div className="notification-arrow">
                  <img src="Arrow - Right Square.svg" alt="arrow" style={{ width: '16px', height: '16px' }} />
                </div>
              </div>
            </div>
          )}
        </div>
        <div className="user-info-card">
          <div className="user-avatar">
            <img 
              src={
                user?.profile_picture 
                  ? (user.profile_picture.startsWith('http') 
                      ? user.profile_picture 
                      : `http://localhost:3001${user.profile_picture}`)
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
          <div className="dashboard-content">
            <div className="dashboard-header">
              <div>
                <h1 style={{ fontFamily: 'Urbanist', fontWeight: '700', fontStyle: 'Bold', fontSize: '30px', lineHeight: '100%', letterSpacing: '0%' }}>Notifications</h1>
                <p style={{ fontFamily: 'Urbanist', fontWeight: '600', fontStyle: 'SemiBold', fontSize: '18px', lineHeight: '100%', letterSpacing: '0%', color: '#6E6E6E' }}>Get alerts regarding new booking, payments, cancellations, and more...</p>
              </div>
            </div>

            <div className="notifications-section">
              <h3 style={{ fontFamily: 'Urbanist', fontWeight: '600', fontStyle: 'SemiBold', fontSize: '18px', lineHeight: '100%', letterSpacing: '0%', color: '#6E6E6E', marginBottom: '16px', marginLeft: '5px' }}>Today's</h3>
              <div className="notification-card">
                <div className="notification-card-content">
                  <h4 style={{ fontFamily: 'Urbanist', fontWeight: '700', fontStyle: 'Bold', fontSize: '25px', lineHeight: '100%', letterSpacing: '0%', color: '#082421', margin: '0 0 4px 0' }}>New Booking</h4>
                  <p style={{ fontFamily: 'Urbanist', fontWeight: '500', fontStyle: 'Medium', fontSize: '15px', lineHeight: '100%', letterSpacing: '0%', color: '#6E6E6E', margin: '0' }}>You have received a new booking from Meet</p>
                </div>
                <span style={{ fontFamily: 'Urbanist', fontWeight: '500', fontStyle: 'Medium', fontSize: '15px', lineHeight: '100%', letterSpacing: '0%', color: '#6E6E6E' }}>Today - 07:32PM</span>
              </div>
            </div>
          </div>
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
  const [showCreateBooking, setShowCreateBooking] = useState<boolean>(false);
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
  const [currentPage, setCurrentPage] = useState<number>(1);
  const itemsPerPage = 3;

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        // Build stats URL with date filter
        let statsUrl = 'http://localhost:3001/api/bookings/stats';
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

        // Fetch Recent Bookings
        const bookingsRes = await fetch('http://localhost:3001/api/bookings', { credentials: 'include' });
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
    { label: 'NoShow', value: stats.noShow.toString() },
    { label: 'Pending Notes', value: stats.pendingNotes.toString() },
    { label: 'Pending Payment', value: stats.pendingPayment.toString() },
    { label: 'No of Clients', value: stats.noOfClients.toString() }
  ];

  const grayFilter = 'invert(43%) sepia(0%) saturate(0%) hue-rotate(180deg) brightness(95%) contrast(87%)';
  const blackFilter = 'brightness(0)';

  const totalPages = Math.ceil(recentBookings.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentBookings = recentBookings.slice(startIndex, startIndex + itemsPerPage);

  const handlePrevPage = () => currentPage > 1 && setCurrentPage(currentPage - 1);
  const handleNextPage = () => currentPage < totalPages && setCurrentPage(currentPage + 1);

  const { setShowSendLinkModal: setGlobalModal } = useOutletContext<{ setShowSendLinkModal: (v: boolean) => void }>();

  const actions: Action[] = [
    {
      title: 'Create Resources',
      description: 'Add new resource and connect it with your calendar',
      icon: <img src="Category.svg" alt="Create Resources" style={{ width: '24px', height: '24px' }} />,
      bg: '#9CFFF499'
    },
    {
      title: 'Create a Booking',
      description: 'Schedule a session for your client manually',
      icon: <img src="Calendar.svg" alt="Create a Booking" style={{ width: '24px', height: '24px' }} />,
      bg: '#FFF29C'
    },
    {
      title: 'Send Booking Link',
      description: 'Share booking link to client to schedule a session',
      icon: <img src="Send.svg" alt="Send Booking link" style={{ width: '24px', height: '24px' }} />,
      bg: '#00403999'
    }
  ];

  if (showCreateBooking) {
    return <CreateBooking onBack={() => {
      setShowCreateBooking(false);
      // Refresh data on back
      // Ideally we'd move fetch logic outside or use React Query, but simplified:
      window.location.reload();
    }} />;
  }

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
                <div 
                  className={`dropdown-item ${dateFilter === 'custom' ? 'selected' : ''}`}
                  onClick={() => handleDateFilterSelect('custom')}
                >
                  Custom
                </div>
                <div 
                  className={`dropdown-item ${dateFilter === 'all_time' ? 'selected' : ''}`}
                  onClick={() => handleDateFilterSelect('all_time')}
                >
                  All time
                </div>
                {getCurrentMonthOptions().map((month) => (
                  <div
                    key={month.value}
                    className={`dropdown-item ${dateFilter === month.value ? 'selected' : ''}`}
                    onClick={() => handleDateFilterSelect(month.value)}
                  >
                    {month.label}
                  </div>
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
                    <input 
                      type="date" 
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                    />
                  </div>
                  <div className="date-input-group">
                    <label>End Date</label>
                    <input 
                      type="date" 
                      value={customEndDate}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                    />
                  </div>
                </div>
                <div className="date-modal-actions">
                  <button onClick={() => setShowCustomDatePicker(false)} className="cancel-btn">Cancel</button>
                  <button 
                    onClick={() => {
                      if (customStartDate && customEndDate) {
                        setShowCustomDatePicker(false);
                      }
                    }}
                    className="apply-btn"
                    disabled={!customStartDate || !customEndDate}
                  >
                    Apply
                  </button>
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
          <h2 style={{ margin: '0 0 24px 15px', fontFamily: 'Urbanist', fontWeight: '600', fontStyle: 'SemiBold', fontSize: '25px', color: '#082421' }}>Upcoming Bookings</h2>
          <div className="section">
            <div className="table-header">
              <span>Session Timings</span>
              <span>Client Name</span>
              <span>Session Type</span>
              <span>Mode</span>
            </div>
            {currentBookings.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', color: '#666' }}>No upcoming bookings found.</div>
            ) : (
              currentBookings.map((booking, index) => (
                <div key={index} className="table-row">
                  <span className="session-time">
                    {formatDateTime(booking.start_time)}
                  </span>
                  <span className="client-name">{booking.client_name || 'Client'}</span>
                  <span className="session-type">{booking.title}</span>
                  <span className="session-mode">
                    {booking.meet_link ? 'Google Meet' : 'In-person'}
                  </span>
                </div>
              ))
            )}
            <div className="table-footer">
              <span>Showing {startIndex + 1} to {Math.min(startIndex + itemsPerPage, recentBookings.length)} of {recentBookings.length} results</span>
              <div className="pagination">
                <img src="Arrow - Left Square.svg" alt="Previous" style={{ width: '25px', height: '25px', cursor: currentPage > 1 ? 'pointer' : 'not-allowed', filter: currentPage > 1 ? blackFilter : grayFilter }} onClick={handlePrevPage} />
                <img src="Arrow - Right Square.svg" alt="Next" style={{ width: '25px', height: '25px', cursor: currentPage < totalPages ? 'pointer' : 'not-allowed', filter: currentPage < totalPages ? blackFilter : grayFilter }} onClick={handleNextPage} />
              </div>
            </div>
          </div>
        </div>

        <div>
          <h2 style={{ margin: '0 0 24px 0', fontFamily: 'Urbanist', fontWeight: '600', fontStyle: 'SemiBold', fontSize: '25px', color: '#082421' }}>Quick Actions</h2>
          <div style={{ display: 'grid', gridTemplateRows: 'repeat(3, 1fr)', gap: '16px' }}>
            {actions.map((action, index) => (
              <div
                key={index}
                className="action-card"
                onClick={() => {
                  if (action.title === 'Create Resources') {
                    navigate('/calendars?openModal=true');
                  } else if (action.title === 'Create a Booking') {
                    setShowCreateBooking(true);
                  } else if (action.title === 'Send Booking Link') {
                    if (setGlobalModal) setGlobalModal(true);
                  }
                }}
              >
                <div className="action-icon" style={{ background: action.bg }}>{action.icon}</div>
                <div>
                  <div className="action-title">{action.title}</div>
                  <div className="action-description">{action.description}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="footer">All Rights Reserved. 2026 MelloMinds LLP</div>
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
              <Route path="appointments" element={<Appointments />} />
              <Route path="calendars" element={<CalendarPage />} />
              <Route path="calendars/new" element={<CreateEventPage />} />
              <Route path="calendars/edit" element={<CreateEventPage />} />
              <Route path="payments" element={<PaymentsInvoice />} />
              <Route path="settings" element={<MySettings />} />
              <Route path="support" element={<div className="dashboard-content"><h1>Contact Support</h1></div>} />
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
        <AppContent />
      </ToastProvider>
    </AuthProvider>
  );
};

export default App;