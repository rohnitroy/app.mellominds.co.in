import React, { useState, useEffect } from 'react';
import API_BASE_URL from '../config/api';

const DevPaymentInvoices: React.FC = () => {
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPayments();
  }, []);

  const fetchPayments = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/dev/payments`, {
        credentials: 'include'
      });
      const data = await res.json();
      setPayments(data.payments || []);
    } catch (err) {
      console.error('Failed to fetch payments:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div style={{ padding: '20px' }}>
      <h1>Payments & Invoices</h1>

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: '#f9f9f9', borderBottom: '1px solid #e0e0e0' }}>
            <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600 }}>ID</th>
            <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600 }}>User</th>
            <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600 }}>Amount</th>
            <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600 }}>Plan</th>
            <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600 }}>Status</th>
            <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600 }}>Method</th>
            <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600 }}>Date</th>
          </tr>
        </thead>
        <tbody>
          {payments.map((payment) => (
            <tr key={payment.id} style={{ borderBottom: '1px solid #e0e0e0' }}>
              <td style={{ padding: '12px' }}>{payment.id}</td>
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
              <td style={{ padding: '12px', textTransform: 'capitalize' }}>{payment.payment_method}</td>
              <td style={{ padding: '12px' }}>{new Date(payment.created_at).toLocaleDateString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default DevPaymentInvoices;
