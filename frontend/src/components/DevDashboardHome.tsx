import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import API_BASE_URL from '../config/api';
import DevUserActions from './DevUserActions';
import './DevDashboardHome.css';

const DevDashboardHome: React.FC = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [recentUsers, setRecentUsers] = useState<any[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalUsers, setTotalUsers] = useState(0);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [showChangePlanModal, setShowChangePlanModal] = useState(false);
  const [showChangePlanConfirm, setShowChangePlanConfirm] = useState(false);
  const [showBanConfirm, setShowBanConfirm] = useState(false);
  const [showCancelPlanModal, setShowCancelPlanModal] = useState(false);
  const [cancelPlanWithRefund, setCancelPlanWithRefund] = useState<boolean | null>(null);
  const [newPlan, setNewPlan] = useState('');
  const [teamSeats, setTeamSeats] = useState(3);
  const [actionLoading, setActionLoading] = useState(false);
  const recordsPerPage = 5;

  useEffect(() => {
    fetchDashboardStats();
    fetchRecentUsers(1);
  }, []);

  useEffect(() => {
    // Connect to Socket.io
    const socket = io(API_BASE_URL.replace('/api', ''));

    // Listen for real-time updates
    socket.on('plan-changed', () => {
      fetchDashboardStats();
      fetchRecentUsers(currentPage);
    });

    socket.on('user-banned', () => {
      fetchDashboardStats();
      fetchRecentUsers(currentPage);
    });

    socket.on('user-unbanned', () => {
      fetchDashboardStats();
      fetchRecentUsers(currentPage);
    });

    socket.on('payment-recorded', () => {
      fetchDashboardStats();
    });

    socket.on('plan-cancelled', () => {
      fetchDashboardStats();
      fetchRecentUsers(currentPage);
    });

    return () => {
      socket.disconnect();
    };
  }, [currentPage]);

  const fetchDashboardStats = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/dev/dashboard`, {
        credentials: 'include'
      });
      const data = await res.json();
      setStats(data);
    } catch (err) {
      console.error('Failed to fetch dashboard stats:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchRecentUsers = async (page: number = 1) => {
    try {
      const offset = (page - 1) * recordsPerPage;
      const res = await fetch(`${API_BASE_URL}/api/dev/all-users?limit=${recordsPerPage}&offset=${offset}`, {
        credentials: 'include'
      });
      const data = await res.json();
      setRecentUsers(data.users || []);
      setTotalUsers(data.total || 0);
      setCurrentPage(page);
    } catch (err) {
      console.error('Failed to fetch recent users:', err);
    }
  };

  if (loading) return <div>Loading...</div>;

  // Get metrics from API
  const freeUsers = stats?.usersByPlan?.find((p: any) => p.plan_name === 'free')?.count || 0;
  const individualPlanUsers = stats?.individualPlanUsers || 0;
  const teamPlanUsers = stats?.teamPlanUsers || 0;
  const paidPlanUsers = stats?.paidPlanUsers || 0;

  const analyticsData = [
    { label: 'Total Revenue', value: `₹${stats?.totalRevenue || 0}` },
    { label: 'Total Refunds', value: `₹${stats?.totalRefunds || 0}` },
    { label: 'Active Users', value: stats?.activeUsers || 0 },
    { label: 'Free Plan Users', value: freeUsers },
    { label: 'Individual Plan Users', value: individualPlanUsers },
    { label: 'Team Plan Users', value: teamPlanUsers },
    { label: 'Paid Plan Users', value: paidPlanUsers },
  ];

  const getStatus = (user: any) => {
    // If banned
    if (user.account_status === 'banned') {
      return 'Banned';
    }

    // If never logged in
    if (!user.last_login) {
      return 'Inactive';
    }

    // If logged in past 7 days
    const lastLogin = new Date(user.last_login);
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    return lastLogin >= sevenDaysAgo ? 'Active' : 'Inactive';
  };

  const handleConfirmPlanChange = () => {
    if (!newPlan) return;
    setShowChangePlanModal(false);
    setShowChangePlanConfirm(true);
  };

  const handleChangePlan = async () => {
    if (!selectedUser || !newPlan) return;
    setActionLoading(true);
    try {
      const body: any = { plan_name: newPlan };
      if (newPlan === 'team') {
        body.purchased_seats = teamSeats;
        body.org_role = 'owner';
      }
      const res = await fetch(`${API_BASE_URL}/api/dev/user/${selectedUser.id}/change-plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body)
      });
      if (res.ok) {
        fetchRecentUsers(currentPage);
        setShowChangePlanConfirm(false);
        setShowChangePlanModal(false);
        setSelectedUser(null);
        setNewPlan('');
        setTeamSeats(3);
      }
    } catch (err) {
      console.error('Error changing plan:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleBanUser = async () => {
    if (!selectedUser) return;
    setActionLoading(true);
    try {
      const isBanned = selectedUser.account_status === 'banned';
      const endpoint = isBanned ? 'unban' : 'suspend';
      const res = await fetch(`${API_BASE_URL}/api/dev/user/${selectedUser.id}/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
      });
      if (res.ok) {
        fetchRecentUsers(currentPage);
        setShowBanConfirm(false);
        setSelectedUser(null);
      }
    } catch (err) {
      console.error('Error banning user:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelPlan = async () => {
    if (!selectedUser || cancelPlanWithRefund === null) return;
    setActionLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/dev/user/${selectedUser.id}/cancel-plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ issueRefund: cancelPlanWithRefund })
      });
      if (res.ok) {
        fetchDashboardStats();
        fetchRecentUsers(currentPage);
        setShowCancelPlanModal(false);
        setSelectedUser(null);
        setCancelPlanWithRefund(null);
      }
    } catch (err) {
      console.error('Error canceling plan:', err);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="dev-dashboard-home">
      <h1 className="dev-dashboard-heading">SuperAdmin Dashboard</h1>

      <div className="dev-stats-grid">
        {analyticsData.map((stat, index) => (
          <div key={index} className="dev-stat-card">
            <div className="dev-stat-label">{stat.label}</div>
            <div className="dev-stat-value">{stat.value}</div>
          </div>
        ))}
      </div>

      <div className="dev-recent-users-section">
        <h2>Recent Users</h2>
        <table className="dev-users-table">
          <thead>
            <tr>
              <th>User's Name</th>
              <th>Contact Info</th>
              <th>City</th>
              <th>Plan Name</th>
              <th>Status</th>
              <th>Joining Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {recentUsers.map((user) => (
              <tr key={user.id}>
                <td>
                  <button
                    className="dev-user-name-link"
                    onClick={() => navigate(`/devdashboard-allusers/${user.id}`)}
                  >
                    {user.user_name}
                  </button>
                </td>
                <td>
                  <div>{user.email}</div>
                  {user.phone && <div style={{ fontSize: '12px', color: '#666' }}>{user.phone}</div>}
                </td>
                <td>{user.city || '-'}</td>
                <td style={{ textTransform: 'capitalize' }}>{user.plan_name}</td>
                <td>
                  <span className={`dev-status-badge ${getStatus(user)}`}>
                    {getStatus(user)}
                  </span>
                </td>
                <td>{new Date(user.created_at).toLocaleDateString()}</td>
                <td>
                  <DevUserActions
                    user={user}
                    onChangePlan={(u) => { setSelectedUser(u); setShowChangePlanModal(true); }}
                    onBanUser={(u) => { setSelectedUser(u); setShowBanConfirm(true); }}
                    onCancelPlan={(u) => { setSelectedUser(u); setShowCancelPlanModal(true); }}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="dev-pagination">
          <button
            className="dev-pagination-btn"
            onClick={() => fetchRecentUsers(currentPage - 1)}
            disabled={currentPage === 1}
          >
            Previous
          </button>

          <div className="dev-pagination-info">
            Page {currentPage} of {Math.ceil(totalUsers / recordsPerPage)}
          </div>

          <button
            className="dev-pagination-btn"
            onClick={() => fetchRecentUsers(currentPage + 1)}
            disabled={currentPage >= Math.ceil(totalUsers / recordsPerPage)}
          >
            Next
          </button>
        </div>
      </div>

      {/* Change Plan Modal */}
      {showChangePlanModal && (
        <div className="dev-modal-overlay" onClick={() => setShowChangePlanModal(false)}>
          <div className="dev-modal" onClick={e => e.stopPropagation()}>
            <h2>Change Plan</h2>
            <p>Change plan for {selectedUser?.user_name}</p>
            <select value={newPlan} onChange={e => { setNewPlan(e.target.value); setTeamSeats(3); }}>
              <option value="">Select Plan</option>
              <option value="free">Free</option>
              <option value="individual">Individual</option>
              <option value="team">Team</option>
            </select>
            {newPlan === 'team' && (
              <div className="dev-modal-input-group">
                <label>Number of Seats (3-20)</label>
                <input
                  type="number"
                  min="3"
                  max="20"
                  value={teamSeats}
                  onChange={e => setTeamSeats(Math.max(3, Math.min(20, parseInt(e.target.value) || 3)))}
                />
                <small>Minimum 3 seats, Maximum 20 seats</small>
              </div>
            )}
            <div className="dev-modal-actions">
              <button onClick={() => setShowChangePlanModal(false)}>Cancel</button>
              <button onClick={handleConfirmPlanChange} disabled={!newPlan}>
                Continue
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Change Plan Confirmation Modal */}
      {showChangePlanConfirm && (
        <div className="dev-modal-overlay" onClick={() => setShowChangePlanConfirm(false)}>
          <div className="dev-modal" onClick={e => e.stopPropagation()}>
            <h2>Confirm Plan Change</h2>
            <p>Change {selectedUser?.user_name}'s plan to <strong>{newPlan}</strong>?</p>
            {newPlan === 'team' && (
              <p className="dev-info">Team will have {teamSeats} seats. User will be assigned as team owner.</p>
            )}
            <div className="dev-modal-actions">
              <button onClick={() => setShowChangePlanConfirm(false)}>Cancel</button>
              <button onClick={handleChangePlan} disabled={actionLoading} className="dev-btn-primary">
                {actionLoading ? 'Changing...' : 'Confirm Change'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Ban/Unban Confirmation */}
      {showBanConfirm && selectedUser && (
        <div className="dev-modal-overlay" onClick={() => setShowBanConfirm(false)}>
          <div className="dev-modal" onClick={e => e.stopPropagation()}>
            <h2>{selectedUser.account_status === 'banned' ? 'Unban User' : 'Ban User'}</h2>
            <p>Are you sure you want to {selectedUser.account_status === 'banned' ? 'unban' : 'ban'} {selectedUser.user_name}?</p>
            {selectedUser.account_status !== 'banned' && (
              <p className="dev-warning">This user will not be able to access the platform.</p>
            )}
            <div className="dev-modal-actions">
              <button onClick={() => setShowBanConfirm(false)}>Cancel</button>
              <button onClick={handleBanUser} disabled={actionLoading} className="dev-btn-danger">
                {actionLoading ? (selectedUser.account_status === 'banned' ? 'Unbanning...' : 'Banning...') : (selectedUser.account_status === 'banned' ? 'Unban User' : 'Ban User')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Plan Modal */}
      {showCancelPlanModal && selectedUser && (
        <div className="dev-modal-overlay" onClick={() => setShowCancelPlanModal(false)}>
          <div className="dev-modal" onClick={e => e.stopPropagation()}>
            <h2>Cancel Plan</h2>
            <p>Cancel {selectedUser.user_name}'s plan?</p>
            <p className="dev-info">User will be downgraded to Free plan.</p>
            <div className="dev-modal-input-group">
              <label>Issue Refund?</label>
              <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
                <button
                  onClick={() => setCancelPlanWithRefund(true)}
                  style={{
                    flex: 1,
                    padding: '10px',
                    border: cancelPlanWithRefund === true ? '2px solid #082421' : '1px solid #ddd',
                    background: cancelPlanWithRefund === true ? '#f0f7f6' : 'white',
                    borderRadius: '6px',
                    cursor: 'pointer'
                  }}
                >
                  Yes, Refund
                </button>
                <button
                  onClick={() => setCancelPlanWithRefund(false)}
                  style={{
                    flex: 1,
                    padding: '10px',
                    border: cancelPlanWithRefund === false ? '2px solid #082421' : '1px solid #ddd',
                    background: cancelPlanWithRefund === false ? '#f0f7f6' : 'white',
                    borderRadius: '6px',
                    cursor: 'pointer'
                  }}
                >
                  No Refund
                </button>
              </div>
            </div>
            <div className="dev-modal-actions">
              <button onClick={() => { setShowCancelPlanModal(false); setCancelPlanWithRefund(null); }}>Cancel</button>
              <button onClick={handleCancelPlan} disabled={actionLoading || cancelPlanWithRefund === null} className="dev-btn-danger">
                {actionLoading ? 'Canceling...' : 'Confirm Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DevDashboardHome;
