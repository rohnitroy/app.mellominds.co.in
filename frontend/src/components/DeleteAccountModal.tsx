import React, { useState } from 'react';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import API_BASE_URL from '../config/api';

interface Props {
  isOpen: boolean;
  onCancel: () => void;
}

const DeleteAccountModal: React.FC<Props> = ({ isOpen, onCancel }) => {
  const toast = useToast();
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState<'confirm' | 'otp'>('confirm');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleRequestOTP = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/auth/delete-account/request`, {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Failed to send verification code');
        return;
      }
      toast.info('Verification code sent to your email.');
      setStep('otp');
    } catch {
      toast.error('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!/^\d{6}$/.test(otp)) {
      toast.error('Please enter a valid 6-digit code.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/auth/delete-account/confirm`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ otp }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Verification failed');
        return;
      }
      toast.success('Your account has been deleted.');
      await logout();
      navigate('/login', { replace: true });
    } catch {
      toast.error('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setStep('confirm');
    setOtp('');
    onCancel();
  };

  // Shared modal shell styles
  const overlay: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.45)',
    zIndex: 9999,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
  };

  const box: React.CSSProperties = {
    background: '#fff',
    borderRadius: '16px',
    padding: '32px',
    width: '100%',
    maxWidth: '420px',
    fontFamily: 'Urbanist',
  };

  return (
    <div style={overlay} onClick={handleClose}>
      <div style={box} onClick={(e) => e.stopPropagation()}>
        {step === 'confirm' && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: '50%',
                  background: '#fdecea',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#c62828"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
              </div>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#082421' }}>
                Delete Account
              </h3>
            </div>

            <p style={{ margin: '0 0 8px', fontSize: '14px', color: '#555', lineHeight: 1.6 }}>
              This will permanently delete your account. The following data will be removed:
            </p>

            <ul
              style={{
                margin: '0 0 16px',
                padding: '0 0 0 20px',
                fontSize: '13px',
                color: '#777',
                lineHeight: 1.8,
              }}
            >
              <li>All bookings and calendar events</li>
              <li>All client records and session notes</li>
              <li>Profile picture, bio, and settings</li>
              <li>Connected integrations</li>
            </ul>

            <p style={{ margin: '0 0 24px', fontSize: '13px', color: '#c62828', fontWeight: 600 }}>
              This action cannot be undone.
            </p>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={handleClose}
                style={{
                  padding: '10px 20px',
                  borderRadius: '8px',
                  border: '1px solid #e0e0e0',
                  background: '#fff',
                  fontFamily: 'Urbanist',
                  fontWeight: 500,
                  fontSize: '14px',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleRequestOTP}
                disabled={loading}
                style={{
                  padding: '10px 20px',
                  borderRadius: '8px',
                  border: 'none',
                  background: '#c62828',
                  color: '#fff',
                  fontFamily: 'Urbanist',
                  fontWeight: 600,
                  fontSize: '14px',
                  cursor: 'pointer',
                  opacity: loading ? 0.7 : 1,
                }}
              >
                {loading ? 'Sending...' : 'Send Verification Code'}
              </button>
            </div>
          </>
        )}

        {step === 'otp' && (
          <>
            <h3 style={{ margin: '0 0 8px', fontSize: '18px', fontWeight: 700, color: '#082421' }}>
              Enter Verification Code
            </h3>

            <p style={{ margin: '0 0 20px', fontSize: '14px', color: '#555', lineHeight: 1.6 }}>
              A 6-digit code was sent to your email. Enter it below to confirm deletion.
            </p>

            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '14px 16px',
                fontSize: '28px',
                letterSpacing: '12px',
                textAlign: 'center',
                border: '2px solid #c62828',
                borderRadius: '10px',
                fontFamily: 'Urbanist',
                marginBottom: '20px',
                outline: 'none',
              }}
            />

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={handleClose}
                style={{
                  padding: '10px 20px',
                  borderRadius: '8px',
                  border: '1px solid #e0e0e0',
                  background: '#fff',
                  fontFamily: 'Urbanist',
                  fontWeight: 500,
                  fontSize: '14px',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={loading || otp.length !== 6}
                style={{
                  padding: '10px 20px',
                  borderRadius: '8px',
                  border: 'none',
                  background: '#c62828',
                  color: '#fff',
                  fontFamily: 'Urbanist',
                  fontWeight: 600,
                  fontSize: '14px',
                  cursor: 'pointer',
                  opacity: loading || otp.length !== 6 ? 0.6 : 1,
                }}
              >
                {loading ? 'Deleting...' : 'Delete My Account'}
              </button>
            </div>

            <p style={{ margin: '16px 0 0', fontSize: '12px', color: '#888', textAlign: 'center' }}>
              Didn't receive the code?{' '}
              <button
                onClick={handleRequestOTP}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#2D7579',
                  cursor: 'pointer',
                  fontFamily: 'Urbanist',
                  fontSize: '12px',
                  padding: 0,
                  textDecoration: 'underline',
                }}
              >
                Resend
              </button>
            </p>
          </>
        )}
      </div>
    </div>
  );
};

export default DeleteAccountModal;
