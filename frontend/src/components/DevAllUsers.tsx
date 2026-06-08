import React, { useState, useEffect } from 'react';
import API_BASE_URL from '../config/api';

const DevAllUsers: React.FC = () => {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAllUsers();
  }, []);

  const fetchAllUsers = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/dev/all-users`, {
        credentials: 'include'
      });
      const data = await res.json();
      setUsers(data.users || []);
    } catch (err) {
      console.error('Failed to fetch users:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div style={{ padding: '20px' }}>
      <h1>All Users</h1>

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: '#f9f9f9', borderBottom: '1px solid #e0e0e0' }}>
            <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600 }}>ID</th>
            <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600 }}>Name</th>
            <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600 }}>Email</th>
            <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600 }}>Plan</th>
            <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600 }}>Created</th>
            <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600 }}>Last Login</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.id} style={{ borderBottom: '1px solid #e0e0e0' }}>
              <td style={{ padding: '12px' }}>{user.id}</td>
              <td style={{ padding: '12px' }}>{user.user_name}</td>
              <td style={{ padding: '12px' }}>{user.email}</td>
              <td style={{ padding: '12px', textTransform: 'capitalize' }}>{user.plan_name}</td>
              <td style={{ padding: '12px' }}>{new Date(user.created_at).toLocaleDateString()}</td>
              <td style={{ padding: '12px' }}>{user.last_login ? new Date(user.last_login).toLocaleDateString() : 'Never'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default DevAllUsers;
