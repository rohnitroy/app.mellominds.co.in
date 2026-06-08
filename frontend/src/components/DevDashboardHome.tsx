import React, { useState, useEffect } from 'react';
import API_BASE_URL from '../config/api';
import './DevDashboardHome.css';

const DevDashboardHome: React.FC = () => {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardStats();
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

  if (loading) return <div>Loading...</div>;

  // Calculate metrics
  const totalUsers = stats?.usersByPlan?.reduce((sum: number, p: any) => sum + parseInt(p.count), 0) || 0;
  const freeUsers = stats?.usersByPlan?.find((p: any) => p.plan_name === 'free')?.count || 0;
  const paidUsers = totalUsers - freeUsers;
  const paidPlanUsers = (stats?.usersByPlan?.find((p: any) => p.plan_name === 'individual')?.count || 0) +
                        (stats?.usersByPlan?.find((p: any) => p.plan_name === 'team')?.count || 0) +
                        (stats?.usersByPlan?.find((p: any) => p.plan_name === 'enterprise')?.count || 0);
  const teamPlanUsers = stats?.usersByPlan?.find((p: any) => p.plan_name === 'team')?.count || 0;
  const inactiveUsers = totalUsers - (stats?.activeUsers || 0);

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

      <h2>Recent Payments</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: '#f9f9f9', borderBottom: '1px solid #e0e0e0' }}>
            <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600 }}>User</th>
            <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600 }}>Amount</th>
            <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600 }}>Plan</th>
            <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600 }}>Status</th>
            <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600 }}>Date</th>
          </tr>
        </thead>
        <tbody>
          {stats?.recentPayments?.map((payment: any) => (
            <tr key={payment.id} style={{ borderBottom: '1px solid #e0e0e0' }}>
              <td style={{ padding: '12px' }}>{payment.user_name}</td>
              <td style={{ padding: '12px' }}>₹{payment.payment_amount}</td>
              <td style={{ padding: '12px', textTransform: 'capitalize' }}>{payment.plan_name}</td>
              <td style={{ padding: '12px' }}>
                <span style={{
                  padding: '4px 8px',
                  borderRadius: '4px',
                  fontSize: '12px',
                  fontWeight: 600,
                  background: payment.payment_status === 'Paid' ? '#c8e6c9' : '#fff3cd',
                  color: payment.payment_status === 'Paid' ? '#2e7d32' : '#856404'
                }}>
                  {payment.payment_status}
                </span>
              </td>
              <td style={{ padding: '12px' }}>{new Date(payment.created_at).toLocaleDateString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default DevDashboardHome;
