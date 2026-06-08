import React, { useState, useEffect } from 'react';
import API_BASE_URL from '../config/api';
import './DevDashboardHome.css';

const DevDashboardHome: React.FC = () => {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [recentUsers, setRecentUsers] = useState<any[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalUsers, setTotalUsers] = useState(0);
  const recordsPerPage = 5;

  useEffect(() => {
    fetchDashboardStats();
  }, []);

  useEffect(() => {
    fetchRecentUsers(1);
  }, []);

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

  // Calculate metrics
  const dashboardTotalUsers = stats?.usersByPlan?.reduce((sum: number, p: any) => sum + parseInt(p.count), 0) || 0;
  const freeUsers = stats?.usersByPlan?.find((p: any) => p.plan_name === 'free')?.count || 0;
  const paidUsers = dashboardTotalUsers - freeUsers;
  const paidPlanUsers = (stats?.usersByPlan?.find((p: any) => p.plan_name === 'individual')?.count || 0) +
                        (stats?.usersByPlan?.find((p: any) => p.plan_name === 'team')?.count || 0) +
                        (stats?.usersByPlan?.find((p: any) => p.plan_name === 'enterprise')?.count || 0);
  const teamPlanUsers = stats?.usersByPlan?.find((p: any) => p.plan_name === 'team')?.count || 0;
  const inactiveUsers = dashboardTotalUsers - (stats?.activeUsers || 0);

  // Calculate total refunds
  const totalRefunds = stats?.recentPayments?.filter((p: any) => p.payment_status === 'Refunded')
    .reduce((sum: number, p: any) => sum + (p.payment_amount || 0), 0) || 0;

  const analyticsData = [
    { label: 'Total Revenue', value: `₹${stats?.totalRevenue || 0}` },
    { label: 'Total Refunds', value: `₹${totalRefunds}` },
    { label: 'Active Users', value: stats?.activeUsers || 0 },
    { label: 'Free Plan Users', value: freeUsers },
    { label: 'Paid Plan Users', value: paidPlanUsers },
    { label: 'Team Plan Users', value: teamPlanUsers },
    { label: 'Inactive Users', value: inactiveUsers },
  ];

  const getStatus = (lastLogin: string) => {
    if (!lastLogin) return 'Inactive';
    const lastLoginDate = new Date(lastLogin);
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    return lastLoginDate >= sevenDaysAgo ? 'Active' : 'Inactive';
  };

  return (
    <div className="dev-dashboard-home">
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
              <th>Plan Name</th>
              <th>Status</th>
              <th>Joining Date</th>
            </tr>
          </thead>
          <tbody>
            {recentUsers.map((user) => (
              <tr key={user.id}>
                <td>{user.user_name}</td>
                <td>{user.email}</td>
                <td style={{ textTransform: 'capitalize' }}>{user.plan_name}</td>
                <td>
                  <span className={`dev-status-badge ${getStatus(user.last_login)}`}>
                    {getStatus(user.last_login)}
                  </span>
                </td>
                <td>{new Date(user.created_at).toLocaleDateString()}</td>
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
    </div>
  );
};

export default DevDashboardHome;
