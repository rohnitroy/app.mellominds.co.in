import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './DevDashboardLayout.css';

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
    { label: 'Dashboard', path: '/devdashboard', icon: '📊' },
    { label: 'All Users', path: '/devdashboard-allusers', icon: '👥' },
    { label: 'Payments', path: '/devdashboard-payment-invoices', icon: '💳' },
    { label: 'Settings', path: '/devdashboard-settings', icon: '⚙️' },
  ];

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="dev-dashboard-container">
      {/* Sidebar */}
      <div className={`dev-sidebar ${sidebarOpen ? 'open' : 'closed'}`}>
        <div className="dev-sidebar-header">
          <h2>MelloMinds</h2>
          <span className="dev-badge">DEV</span>
        </div>

        <nav className="dev-nav-menu">
          {menuItems.map((item) => (
            <a
              key={item.path}
              href={item.path}
              className={`dev-nav-item ${location.pathname === item.path ? 'active' : ''}`}
            >
              <span className="dev-nav-icon">{item.icon}</span>
              {sidebarOpen && <span className="dev-nav-label">{item.label}</span>}
            </a>
          ))}
        </nav>
      </div>

      {/* Main Content */}
      <div className="dev-main-content">
        {/* Header */}
        <div className="dev-header">
          <button
            className="dev-sidebar-toggle"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            title={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
          >
            ☰
          </button>

          <div className="dev-header-title">
            <h1>Dev Admin Dashboard</h1>
          </div>

          <div className="dev-header-user">
            <div className="dev-user-info">
              <div className="dev-user-name">{user?.user_name || 'Admin'}</div>
              <div className="dev-user-email">{user?.email}</div>
            </div>
            <button className="dev-logout-btn" onClick={handleLogout} title="Logout">
              🚪
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
