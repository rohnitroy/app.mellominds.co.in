import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import API_BASE_URL from '../config/api';
import './DevUserDetail.css';

const DevUserDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [userDetail, setUserDetail] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [showChangePlanModal, setShowChangePlanModal] = useState(false);
  const [showChangePlanConfirm, setShowChangePlanConfirm] = useState(false);
  const [showBanConfirm, setShowBanConfirm] = useState(false);
  const [showCancelPlanModal, setShowCancelPlanModal] = useState(false);
  const [cancelPlanWithRefund, setCancelPlanWithRefund] = useState<boolean | null>(null);
  const [newPlan, setNewPlan] = useState('');
  const [teamSeats, setTeamSeats] = useState(3);
  const [actionLoading, setActionLoading] = useState(false);
  const [showEditInfoModal, setShowEditInfoModal] = useState(false);
  const [editFormData, setEditFormData] = useState({
    user_name: '',
    email: '',
    phone: '',
    city: ''
  });
  const [error, setError] = useState<string | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    fetchUserDetail();
  }, [id]);

  const fetchUserDetail = async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/dev/user/${id}/detail`, {
        credentials: 'include'
      });
      const data = await res.json();
      if (res.ok && data.user) {
        setUserDetail(data);
        setSelectedUser(data.user);
      } else {
        setError(data?.error || 'User not found');
        setUserDetail(null);
        setSelectedUser(null);
      }
    } catch (err) {
      console.error('Failed to fetch user detail:', err);
      setError('Failed to load user details');
    } finally {
      setLoading(false);
    }
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
        fetchUserDetail();
        setShowChangePlanConfirm(false);
        setShowChangePlanModal(false);
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
        fetchUserDetail();
        setShowBanConfirm(false);
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
        fetchUserDetail();
        setShowCancelPlanModal(false);
        setCancelPlanWithRefund(null);
      }
    } catch (err) {
      console.error('Error canceling plan:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenEditInfo = () => {
    if (selectedUser) {
      setEditFormData({
        user_name: selectedUser.user_name || '',
        email: selectedUser.email || '',
        phone: selectedUser.phone || '',
        city: selectedUser.city || ''
      });
      setShowEditInfoModal(true);
    }
  };

  const handleUpdateInfo = async () => {
    if (!selectedUser) return;
    setActionLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/dev/user/${selectedUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(editFormData)
      });
      if (res.ok) {
        fetchUserDetail();
        setShowEditInfoModal(false);
      }
    } catch (err) {
      console.error('Error updating user:', err);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return <div className="dev-user-detail-loading">Loading...</div>;
  }

  if (error || !userDetail || !userDetail.user) {
    return <div className="dev-user-detail-error">{error || 'User not found'}</div>;
  }

  const user = userDetail.user || {};
  const userData = {
    id: user.id || '',
    user_name: user.user_name || 'Unknown',
    email: user.email || 'N/A',
    phone: user.phone || 'N/A',
    city: user.city || 'N/A',
    plan_name: user.plan_name || 'free',
    created_at: user.created_at || new Date().toISOString(),
    last_login: user.last_login,
    account_status: user.account_status || 'active',
    purchased_seats: user.purchased_seats || null
  };

  const detail = {
    clientCount: userDetail.clientCount || 0,
    dailyTimeSpend: userDetail.dailyTimeSpend || '0m',
    avgTimeSpend: userDetail.avgTimeSpend || '0m',
    totalSessions: userDetail.totalSessions || 0,
    isPaidUser: userDetail.isPaidUser || false
  };

  return (
    <div className="dev-user-detail">
      <button className="dev-back-btn" onClick={() => navigate(-1)}>
        ← Back
      </button>

      <div className="dev-user-detail-header">
        <div>
          <div className="dev-header-title">
            <h1>{userData.user_name}</h1>
            <div className="dev-dropdown-container" style={{ position: 'relative' }}>
              <button
                className="dev-action-menu-btn"
                onClick={() => setShowDropdown(!showDropdown)}
                title="Actions"
              >
                ⋯
              </button>
              {showDropdown && (
                <div className="dev-action-dropdown">
                  <button
                    className="dev-action-item"
                    onClick={() => {
                      setShowChangePlanModal(true);
                      setShowDropdown(false);
                    }}
                  >
                    Upgrade Plan
                  </button>
                  <button
                    className="dev-action-item"
                    onClick={() => {
                      handleOpenEditInfo();
                      setShowDropdown(false);
                    }}
                  >
                    Update Info
                  </button>
                  <button
                    className="dev-action-item dev-action-danger"
                    onClick={() => {
                      setShowBanConfirm(true);
                      setShowDropdown(false);
                    }}
                  >
                    {userData.account_status === 'banned' ? 'Unban User' : 'Ban User'}
                  </button>
                  {detail.isPaidUser && (
                    <button
                      className="dev-action-item dev-action-danger"
                      onClick={() => {
                        setShowCancelPlanModal(true);
                        setShowDropdown(false);
                      }}
                    >
                      Cancel Plan
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
          <div className="dev-contact-info-header">
            <span>{userData.email}</span>
            {userData.phone !== 'N/A' && <span>•</span>}
            {userData.phone !== 'N/A' && <span>{userData.phone}</span>}
            {userData.city !== 'N/A' && <span>•</span>}
            {userData.city !== 'N/A' && <span>{userData.city}</span>}
          </div>
        </div>
        <p className="dev-user-status">
          <span className={`dev-status-badge ${userData.account_status === 'banned' ? 'Banned' : 'Active'}`}>
            {userData.account_status === 'banned' ? 'Banned' : 'Active'}
          </span>
        </p>
      </div>

      <div className="dev-user-detail-grid">
        <div className="dev-detail-card">
          <label>Plan</label>
          <div className="dev-plan-info" style={{ textTransform: 'capitalize' }}>
            {userData.plan_name}
            {userData.plan_name === 'team' && userData.purchased_seats && (
              <small style={{ display: 'block', marginTop: '4px' }}>
                {userData.purchased_seats} seats
              </small>
            )}
          </div>
        </div>

        <div className="dev-detail-card">
          <label>Joined Date</label>
          <div className="dev-detail-value">
            {new Date(userData.created_at).toLocaleDateString()}
          </div>
        </div>

        <div className="dev-detail-card">
          <label>Last Login</label>
          <div className="dev-detail-value">
            {userData.last_login ? new Date(userData.last_login).toLocaleDateString() : 'Never'}
          </div>
        </div>

        <div className="dev-detail-card">
          <label>Avg Time Spend</label>
          <div className="dev-detail-value">
            {detail.avgTimeSpend}
          </div>
        </div>

        <div className="dev-detail-card">
          <label>No of Clients</label>
          <div className="dev-detail-value">
            {detail.clientCount}
          </div>
        </div>
      </div>


      {/* Change Plan Modal */}
      {showChangePlanModal && (
        <div className="dev-modal-overlay" onClick={() => setShowChangePlanModal(false)}>
          <div className="dev-modal" onClick={(e) => e.stopPropagation()}>
            <h2>Change Plan</h2>
            <p>Change plan for {userData.user_name}</p>
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
          <div className="dev-modal" onClick={(e) => e.stopPropagation()}>
            <h2>Confirm Plan Change</h2>
            <p>Change {userData.user_name}'s plan to <strong>{newPlan}</strong>?</p>
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
      {showBanConfirm && (
        <div className="dev-modal-overlay" onClick={() => setShowBanConfirm(false)}>
          <div className="dev-modal" onClick={(e) => e.stopPropagation()}>
            <h2>{userData.account_status === 'banned' ? 'Unban User' : 'Ban User'}</h2>
            <p>Are you sure you want to {userData.account_status === 'banned' ? 'unban' : 'ban'} {userData.user_name}?</p>
            {userData.account_status !== 'banned' && (
              <p className="dev-warning">This user will not be able to access the platform.</p>
            )}
            <div className="dev-modal-actions">
              <button onClick={() => setShowBanConfirm(false)}>Cancel</button>
              <button onClick={handleBanUser} disabled={actionLoading} className="dev-btn-danger">
                {actionLoading ? (user.account_status === 'banned' ? 'Unbanning...' : 'Banning...') : (user.account_status === 'banned' ? 'Unban User' : 'Ban User')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Plan Modal */}
      {showCancelPlanModal && (
        <div className="dev-modal-overlay" onClick={() => setShowCancelPlanModal(false)}>
          <div className="dev-modal" onClick={(e) => e.stopPropagation()}>
            <h2>Cancel Plan</h2>
            <p>Cancel {userData.user_name}'s plan?</p>
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

      {/* Edit Info Modal */}
      {showEditInfoModal && (
        <div className="dev-modal-overlay" onClick={() => setShowEditInfoModal(false)}>
          <div className="dev-modal" onClick={(e) => e.stopPropagation()}>
            <h2>Update User Info</h2>
            <p>Edit {userData.user_name}'s profile information</p>

            <div className="dev-modal-input-group">
              <label>Name</label>
              <input
                type="text"
                value={editFormData.user_name}
                onChange={(e) => setEditFormData({...editFormData, user_name: e.target.value})}
                placeholder="User name"
              />
            </div>

            <div className="dev-modal-input-group">
              <label>Email</label>
              <input
                type="email"
                value={editFormData.email}
                onChange={(e) => setEditFormData({...editFormData, email: e.target.value})}
                placeholder="Email address"
              />
            </div>

            <div className="dev-modal-input-group">
              <label>Phone</label>
              <input
                type="tel"
                value={editFormData.phone}
                onChange={(e) => setEditFormData({...editFormData, phone: e.target.value})}
                placeholder="Phone number"
              />
            </div>

            <div className="dev-modal-input-group">
              <label>City</label>
              <input
                type="text"
                value={editFormData.city}
                onChange={(e) => setEditFormData({...editFormData, city: e.target.value})}
                placeholder="City"
              />
            </div>

            <div className="dev-modal-actions">
              <button onClick={() => setShowEditInfoModal(false)}>Cancel</button>
              <button onClick={handleUpdateInfo} disabled={actionLoading} className="dev-btn-primary">
                {actionLoading ? 'Updating...' : 'Update Info'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DevUserDetail;
