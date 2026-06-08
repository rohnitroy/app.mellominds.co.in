import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Category, TwoUsers, Wallet, Setting } from 'react-iconly';
import './DevDashboardLayout.css';

const LogoutIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
    <polyline points="16 17 21 12 16 7"></polyline>
    <line x1="21" y1="12" x2="9" y2="12"></line>
  </svg>
);

const DevDashboardLayout: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Redirect non-dev-admins to /dashboard
  if (user && !(user as any).is_dev_admin) {
    return <Navigate to="/dashboard" replace />;
  }

  // Show blank while user loads
  if (!user) {
    return null;
  }

  const menuItems = [
    { label: 'Dashboard', path: '/devdashboard', icon: 'category' },
    { label: 'All Users', path: '/devdashboard-allusers', icon: 'users' },
    { label: 'Payments', path: '/devdashboard-payment-invoices', icon: 'wallet' },
    { label: 'Settings', path: '/devdashboard-settings', icon: 'setting' },
  ];

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="dev-dashboard-container">
      {/* Sidebar */}
      <div className={`dev-sidebar ${sidebarOpen ? 'open' : 'closed'}`}>
        <div className="dev-logo">
          <img src="/Frame 2 1 (1).svg" alt="MelloMinds Logo" />
        </div>

        <nav className="dev-nav-menu">
          {menuItems.map((item) => {
            const renderIcon = () => {
              switch (item.icon) {
                case 'category':
                  return <Category set="bold" />;
                case 'users':
                  return <TwoUsers set="bold" />;
                case 'wallet':
                  return <Wallet set="bold" />;
                case 'setting':
                  return <Setting set="bold" />;
                default:
                  return null;
              }
            };
            return (
              <a
                key={item.path}
                href={item.path}
                className={`dev-nav-item ${location.pathname === item.path ? 'active' : ''}`}
              >
                <span className="dev-nav-icon">{renderIcon()}</span>
                {sidebarOpen && <span className="dev-nav-label">{item.label}</span>}
              </a>
            );
          })}
        </nav>

        <div className="dev-hello-section">
          <div style={{ transform: 'translate(-5px, 20px)' }}>
            Say 👋 hello<br />
            to <strong style={{ color: '#F9E141' }}>mello!</strong>
          </div>
        </div>

        <img src="/MelloFevicon 1.svg" alt="Mello Favicon" className="dev-sidebar-favicon" />
      </div>

      {/* Main Content */}
      <div className="dev-main-content">
        {/* Header */}
        <div className="dev-header">
          <div className="dev-header-user" style={{ marginLeft: 'auto' }}>
            <div className="dev-user-info">
              <div className="dev-user-name">{user?.user_name || 'Admin'}</div>
              <div className="dev-user-email">{user?.email}</div>
            </div>
            <button className="dev-logout-btn" onClick={handleLogout} title="Logout">
              <LogoutIcon />
            </button>
          </div>
        </div>

        {/* Page Content */}
        <div className="dev-page-content">
          <Outlet />
        </div>
      </div>
    </div>
  );
};

export default DevDashboardLayout;
