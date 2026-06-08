import React, { useState, useEffect } from 'react';
import API_BASE_URL from '../config/api';
import './DevNotifications.css';

const DevNotifications: React.FC = () => {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalNotifs, setTotalNotifs] = useState(0);
  const [typeFilter, setTypeFilter] = useState('');
  const recordsPerPage = 15;

  useEffect(() => {
    fetchNotifications(1);
  }, [typeFilter]);

  const fetchNotifications = async (page: number = 1) => {
    setLoading(true);
    try {
      const offset = (page - 1) * recordsPerPage;
      let url = `${API_BASE_URL}/api/dev/notifications?limit=${recordsPerPage}&offset=${offset}`;

      if (typeFilter) url += `&type=${typeFilter}`;

      const res = await fetch(url, { credentials: 'include' });
      const data = await res.json();
      setNotifications(data.notifications || []);
      setTotalNotifs(data.total || 0);
      setCurrentPage(page);
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'user_signup': return '👤';
      case 'plan_upgrade': return '⬆️';
      case 'user_banned': return '🚫';
      case 'plan_cancelled': return '❌';
      default: return '📢';
    }
  };

  const getTypeBadgeClass = (type: string) => {
    if (type === 'user_signup') return 'signup';
    if (type === 'plan_upgrade') return 'upgrade';
    if (type === 'user_banned') return 'banned';
    if (type === 'plan_cancelled') return 'cancelled';
    return 'default';
  };

  const totalPages = Math.ceil(totalNotifs / recordsPerPage);

  return (
    <div className="dev-notifications-page">
      <h1 className="dev-page-heading">Admin Notifications</h1>

      {/* Filter */}
      <div className="dev-notif-filter">
        <select
          value={typeFilter}
          onChange={(e) => {
            setTypeFilter(e.target.value);
            setCurrentPage(1);
          }}
          className="dev-filter-select"
        >
          <option value="">All Events</option>
          <option value="user_signup">New Signups</option>
          <option value="plan_upgrade">Plan Upgrades</option>
          <option value="user_banned">User Bans</option>
          <option value="plan_cancelled">Plan Cancellations</option>
        </select>
      </div>

      {/* Notifications List */}
      <div className="dev-notif-container">
        {loading ? (
          <div className="dev-loading">Loading...</div>
        ) : notifications.length === 0 ? (
          <div className="dev-no-data">No notifications</div>
        ) : (
          <div className="dev-notif-list">
            {notifications.map((notif) => (
              <div key={notif.id} className={`dev-notif-item ${notif.is_read ? 'read' : 'unread'}`}>
                <div className="dev-notif-icon">{getTypeIcon(notif.type)}</div>
                <div className="dev-notif-content">
                  <div className="dev-notif-header">
                    <h3 className="dev-notif-title">{notif.title}</h3>
                    <span className={`dev-notif-type ${getTypeBadgeClass(notif.type)}`}>
                      {notif.type.replace(/_/g, ' ').toUpperCase()}
                    </span>
                  </div>
                  <p className="dev-notif-message">{notif.message}</p>
                  {notif.user_name && (
                    <div className="dev-notif-user">User: {notif.user_name}</div>
                  )}
                  <div className="dev-notif-time">
                    {new Date(notif.created_at).toLocaleString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="dev-pagination">
          <button
            className="dev-pagination-btn"
            onClick={() => fetchNotifications(currentPage - 1)}
            disabled={currentPage === 1}
          >
            Previous
          </button>

          <div className="dev-pagination-info">
            Page {currentPage} of {totalPages}
          </div>

          <button
            className="dev-pagination-btn"
            onClick={() => fetchNotifications(currentPage + 1)}
            disabled={currentPage >= totalPages}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
};

export default DevNotifications;
