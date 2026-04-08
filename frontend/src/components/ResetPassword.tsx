import React, { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useToast } from '../context/ToastContext';
import API_BASE_URL from '../config/api';

const ResetPassword: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const token = searchParams.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) { toast.error('Password must be at least 8 characters.'); return; }
    if (password !== confirm) { toast.error('Passwords do not match.'); return; }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (res.ok) {
        setDone(true);
      } else {
        toast.error(data.error || 'Failed to reset password.');
      }
    } catch {
      toast.error('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '14px 16px', border: '1px solid #00000080',
    borderRadius: '8px', fontSize: '15px', fontFamily: "'Urbanist', sans-serif",
    fontWeight: 500, color: '#050505', outline: 'none', boxSizing: 'border-box',
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f8f9fa', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ background: '#fff', borderRadius: '16px', padding: '40px', width: '100%', maxWidth: '420px', border: '1px solid #e9ecef' }}>
        <div style={{ marginBottom: '28px' }}>
          <h1 style={{ fontFamily: "'Urbanist', sans-serif", fontWeight: 700, fontSize: '26px', color: '#082421', margin: '0 0 8px' }}>
            Set New Password
          </h1>
          <p style={{ fontFamily: "'Urbanist', sans-serif", fontSize: '14px', color: '#6E6E6E', margin: 0 }}>
            Choose a strong password for your account.
          </p>
        </div>

        {!token ? (
          <p style={{ color: '#e53935', fontFamily: "'Urbanist', sans-serif", fontSize: '14px' }}>
            Invalid or missing reset token. Please request a new reset link.
          </p>
        ) : done ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{ width: '56px', height: '56px', background: '#D5FFFA', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: '24px' }}>✓</div>
            <p style={{ fontFamily: "'Urbanist', sans-serif", fontWeight: 600, fontSize: '16px', color: '#082421', marginBottom: '8px' }}>Password updated!</p>
            <p style={{ fontFamily: "'Urbanist', sans-serif", fontSize: '14px', color: '#6E6E6E', marginBottom: '24px' }}>You can now log in with your new password.</p>
            <button
              onClick={() => navigate('/login')}
              style={{ background: '#082421', color: '#fff', border: 'none', borderRadius: '8px', padding: '12px 32px', fontFamily: "'Urbanist', sans-serif", fontWeight: 600, fontSize: '15px', cursor: 'pointer' }}
            >
              Go to Login
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontFamily: "'Urbanist', sans-serif", fontWeight: 700, fontSize: '14px', color: '#050505', marginBottom: '8px' }}>
                New Password
              </label>
              <input
                type="password"
                style={inputStyle}
                placeholder="At least 8 characters"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
            </div>
            <div style={{ marginBottom: '28px' }}>
              <label style={{ display: 'block', fontFamily: "'Urbanist', sans-serif", fontWeight: 700, fontSize: '14px', color: '#050505', marginBottom: '8px' }}>
                Confirm Password
              </label>
              <input
                type="password"
                style={inputStyle}
                placeholder="Repeat your password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              style={{ width: '100%', padding: '14px', background: '#082421', color: '#fff', border: 'none', borderRadius: '8px', fontFamily: "'Urbanist', sans-serif", fontWeight: 600, fontSize: '15px', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}
            >
              {loading ? 'Updating...' : 'Update Password'}
            </button>
            <p style={{ textAlign: 'center', marginTop: '16px', fontFamily: "'Urbanist', sans-serif", fontSize: '13px', color: '#6E6E6E' }}>
              <span style={{ color: '#2D7579', cursor: 'pointer', fontWeight: 600 }} onClick={() => navigate('/login')}>Back to Login</span>
            </p>
          </form>
        )}
      </div>
    </div>
  );
};

export default ResetPassword;
