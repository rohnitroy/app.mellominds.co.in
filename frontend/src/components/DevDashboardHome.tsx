import React, { useState, useEffect } from 'react';
import API_BASE_URL from '../config/api';

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

  return (
    <div style={{ padding: '20px' }}>
      <h1>Dev Dashboard</h1>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px', marginBottom: '40px' }}>
        <div style={{ background: '#f9f9f9', padding: '20px', borderRadius: '8px', border: '1px solid #e0e0e0' }}>
          <h3 style={{ color: '#999', fontSize: '12px', margin: '0 0 8px 0' }}>Total Revenue</h3>
          <p style={{ fontSize: '32px', fontWeight: 'bold', margin: 0, color: '#082421' }}>₹{stats?.totalRevenue || 0}</p>
        </div>

        <div style={{ background: '#f9f9f9', padding: '20px', borderRadius: '8px', border: '1px solid #e0e0e0' }}>
          <h3 style={{ color: '#999', fontSize: '12px', margin: '0 0 8px 0' }}>Active Users (7d)</h3>
          <p style={{ fontSize: '32px', fontWeight: 'bold', margin: 0, color: '#082421' }}>{stats?.activeUsers || 0}</p>
        </div>

        {stats?.usersByPlan?.map((plan: any) => (
          <div key={plan.plan_name} style={{ background: '#f9f9f9', padding: '20px', borderRadius: '8px', border: '1px solid #e0e0e0' }}>
            <h3 style={{ color: '#999', fontSize: '12px', margin: '0 0 8px 0', textTransform: 'capitalize' }}>{plan.plan_name} Users</h3>
            <p style={{ fontSize: '32px', fontWeight: 'bold', margin: 0, color: '#082421' }}>{plan.count}</p>
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
