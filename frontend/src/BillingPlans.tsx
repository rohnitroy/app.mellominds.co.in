import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import API_BASE_URL from './config/api';
import { useAuth } from './context/AuthContext';
import { useToast } from './context/ToastContext';
import { useSocket } from './context/SocketContext';
import ConfirmModal from './components/ConfirmModal';

const TEAM_MIN_SEATS = 3;
const TEAM_MAX_SEATS = 20;

const card: React.CSSProperties = {
  background: '#fff', border: '1px solid #f1f3f4', borderRadius: '16px',
  padding: '24px', marginBottom: '20px',
};
const sectionTitle: React.CSSProperties = {
  fontFamily: 'Urbanist', fontWeight: 700, fontSize: '16px', color: '#082421', margin: '0 0 16px',
};
const label: React.CSSProperties = { fontFamily: 'Urbanist', fontSize: '12px', color: '#9CA3AF', marginBottom: '2px' };
const value: React.CSSProperties = { fontFamily: 'Urbanist', fontSize: '15px', color: '#082421', fontWeight: 600 };
const btn: React.CSSProperties = {
  fontFamily: 'Urbanist', fontWeight: 700, fontSize: '13px', padding: '9px 18px',
  borderRadius: '10px', border: 'none', background: '#082421', color: '#fff', cursor: 'pointer',
};
const btnGhost: React.CSSProperties = { ...btn, background: '#fff', color: '#082421', border: '1px solid #082421' };
const btnDanger: React.CSSProperties = { ...btn, background: '#fee2e2', color: '#dc2626' };

const fmtDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

const BillingPlans: React.FC = () => {
  const navigate = useNavigate();
  const { user, checkAuth } = useAuth();
  const toast = useToast();
  const { socket } = useSocket();

  const [sub, setSub] = useState<any>(null);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [seatInput, setSeatInput] = useState(TEAM_MIN_SEATS);
  const [updatingSeats, setUpdatingSeats] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [showCancel, setShowCancel] = useState(false);

  const isTeamOwner = user?.plan_name === 'team' && user?.org_role !== 'member';

  const fetchAll = useCallback(async () => {
    try {
      const [s, inv] = await Promise.all([
        fetch(`${API_BASE_URL}/api/plan/subscription`, { credentials: 'include' }).then(r => r.ok ? r.json() : null),
        fetch(`${API_BASE_URL}/api/plan/invoices`, { credentials: 'include' }).then(r => r.ok ? r.json() : []),
      ]);
      if (s) { setSub(s); if (s.purchased_seats) setSeatInput(s.purchased_seats); }
      setInvoices(Array.isArray(inv) ? inv : []);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  useEffect(() => {
    if (!socket) return;
    const refresh = () => { checkAuth(); fetchAll(); };
    socket.on('plan_updated', refresh);
    return () => { socket.off('plan_updated', refresh); };
  }, [socket, checkAuth, fetchAll]);

  const loadRazorpay = () => new Promise<void>((resolve, reject) => {
    if ((window as any).Razorpay) return resolve();
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Failed to load Razorpay'));
    document.head.appendChild(s);
  });

  const handleUpdatePayment = async () => {
    setRetrying(true);
    try {
      const r = await fetch(`${API_BASE_URL}/api/plan/retry`, { credentials: 'include' });
      const data = await r.json();
      if (!r.ok) { toast.error(data.error || 'Could not start payment update'); setRetrying(false); return; }
      await loadRazorpay();
      await new Promise<void>((resolve) => {
        const options = {
          key: data.key_id, subscription_id: data.subscription_id,
          name: 'MelloMinds', description: 'Update payment method',
          prefill: { name: user?.user_name || '', email: user?.email || '' },
          handler: async (response: any) => {
            try {
              const v = await fetch(`${API_BASE_URL}/api/plan/verify`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
                body: JSON.stringify({
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_subscription_id: response.razorpay_subscription_id,
                  razorpay_signature: response.razorpay_signature,
                  plan_key: data.plan_key, seats: data.seats,
                }),
              });
              if (v.ok) { await checkAuth(); toast.success('Payment method updated.'); await fetchAll(); }
              else { const e = await v.json(); toast.error(e.error || 'Verification failed'); }
            } catch { toast.error('Verification failed'); }
            finally { resolve(); }
          },
          modal: { ondismiss: () => resolve() },
          theme: { color: '#082421' },
        };
        new (window as any).Razorpay(options).open();
      });
    } catch { toast.error('Something went wrong. Please try again.'); }
    finally { setRetrying(false); }
  };

  const handleUpdateSeats = async () => {
    setUpdatingSeats(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/plan/update-seats`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ seats: seatInput }),
      });
      const data = await res.json();
      if (res.ok) { toast.success(`Seats updated to ${data.seats}.`); await checkAuth(); await fetchAll(); }
      else toast.error(data.error || 'Failed to update seats');
    } catch { toast.error('Network error. Please try again.'); }
    finally { setUpdatingSeats(false); }
  };

  const handleCancel = async () => {
    setCancelling(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/plan/cancel`, { method: 'POST', credentials: 'include' });
      const data = await res.json();
      if (res.ok) { toast.success(data.message || 'Subscription will end at period close.'); await fetchAll(); }
      else toast.error(data.error || 'Failed to cancel');
    } catch { toast.error('Network error. Please try again.'); }
    finally { setCancelling(false); setShowCancel(false); }
  };

  const planName = (sub?.plan_name || user?.plan_name || 'free') as string;
  const status = sub?.plan_status as string | undefined;
  const isPaid = planName === 'individual' || planName === 'team';
  const isTeam = planName === 'team';
  const planLabel = planName === 'team' ? 'Team' : planName === 'individual' ? 'Individual' : 'Free';
  const seats = sub?.purchased_seats;
  const periodEnd = sub?.plan_current_period_end;

  return (
    <div style={{ padding: '24px', maxWidth: '860px' }}>
      <h1 style={{ fontFamily: 'Urbanist', fontWeight: 700, fontSize: '24px', color: '#082421', margin: '0 0 4px' }}>
        Billing and Plans
      </h1>
      <p style={{ fontFamily: 'Urbanist', fontSize: '14px', color: '#6E6E6E', margin: '0 0 24px' }}>
        Manage your plan, payment method and invoices.
      </p>

      {loading ? (
        <div style={{ padding: '40px', textAlign: 'center', color: '#9CA3AF', fontFamily: 'Urbanist' }}>Loading…</div>
      ) : (
        <>
          {/* ── Plan ── */}
          <div style={card}>
            <h2 style={sectionTitle}>Plan</h2>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '32px', alignItems: 'flex-start' }}>
              <div>
                <div style={label}>Plan Name</div>
                <div style={value}>{planLabel}{isTeam && seats ? ` · ${seats} seats` : ''}</div>
              </div>
              <div>
                <div style={label}>{status === 'cancelling' ? 'Active Until' : 'Renewal Date'}</div>
                <div style={value}>{isPaid ? fmtDate(periodEnd) : '—'}</div>
              </div>
              {status && (
                <div>
                  <div style={label}>Status</div>
                  <div style={{ ...value, textTransform: 'capitalize' }}>{status}</div>
                </div>
              )}
              <div style={{ marginLeft: 'auto' }}>
                <button style={btn} onClick={() => navigate('/pricing')}>
                  {isPaid ? 'Adjust Plan' : 'Choose a Plan'}
                </button>
              </div>
            </div>

            {isTeam && isTeamOwner && status !== 'cancelling' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '18px', flexWrap: 'wrap' }}>
                <span style={{ fontFamily: 'Urbanist', fontSize: '13px', color: '#333' }}>Seats:</span>
                <button style={{ ...btnGhost, padding: '4px 12px' }} onClick={() => setSeatInput(s => Math.max(TEAM_MIN_SEATS, s - 1))}>−</button>
                <input type="number" min={TEAM_MIN_SEATS} max={TEAM_MAX_SEATS} value={seatInput}
                  onChange={e => setSeatInput(Math.max(TEAM_MIN_SEATS, Math.min(TEAM_MAX_SEATS, parseInt(e.target.value) || TEAM_MIN_SEATS)))}
                  style={{ width: '56px', textAlign: 'center', padding: '6px', borderRadius: '8px', border: '1px solid #ccc' }} />
                <button style={{ ...btnGhost, padding: '4px 12px' }} onClick={() => setSeatInput(s => Math.min(TEAM_MAX_SEATS, s + 1))}>+</button>
                <button style={btn} disabled={updatingSeats || seatInput === seats} onClick={handleUpdateSeats}>
                  {updatingSeats ? 'Updating…' : 'Update Seats'}
                </button>
              </div>
            )}
          </div>

          {/* ── Payment ── */}
          {isPaid && (
            <div style={card}>
              <h2 style={sectionTitle}>Payment</h2>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '32px', alignItems: 'center' }}>
                <div>
                  <div style={label}>Payment Method</div>
                  <div style={value}>Razorpay AutoPay</div>
                </div>
                <div>
                  <div style={label}>AutoPay Status</div>
                  <div style={{ ...value, textTransform: 'capitalize' }}>{sub?.mandate_status || (status === 'active' ? 'active' : '—')}</div>
                </div>
                <div style={{ marginLeft: 'auto' }}>
                  <button style={btnGhost} disabled={retrying} onClick={handleUpdatePayment}>
                    {retrying ? 'Opening…' : 'Update Payment Method'}
                  </button>
                </div>
              </div>
              {status === 'past_due' && (
                <p style={{ fontFamily: 'Urbanist', fontSize: '13px', color: '#c62828', marginTop: '12px' }}>
                  ⚠️ Your renewal payment is failing. Update your payment method to keep your plan.
                </p>
              )}
            </div>
          )}

          {/* ── Invoices ── */}
          {invoices.length > 0 && (
            <div style={card}>
              <h2 style={sectionTitle}>Invoices</h2>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'Urbanist', fontSize: '13px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #e0e0e0', textAlign: 'left', color: '#6E6E6E' }}>
                    <th style={{ padding: '10px 8px' }}>Date</th>
                    <th style={{ padding: '10px 8px' }}>Total</th>
                    <th style={{ padding: '10px 8px' }}>Status</th>
                    <th style={{ padding: '10px 8px' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map(inv => (
                    <tr key={inv.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                      <td style={{ padding: '10px 8px' }}>{fmtDate(inv.created_at)}</td>
                      <td style={{ padding: '10px 8px', fontWeight: 700 }}>₹{Number(inv.amount).toLocaleString('en-IN')}</td>
                      <td style={{ padding: '10px 8px' }}>
                        <span style={{ background: '#e8f5e9', color: '#2e7d32', padding: '3px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 600 }}>
                          {inv.status || 'Paid'}
                        </span>
                      </td>
                      <td style={{ padding: '10px 8px' }}>
                        {inv.invoice_url
                          ? <a href={inv.invoice_url} target="_blank" rel="noopener noreferrer" style={{ color: '#2D7579', textDecoration: 'underline', fontWeight: 600 }}>View Invoice</a>
                          : <span style={{ color: '#9CA3AF' }}>—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ── Cancellation ── */}
          {isPaid && status !== 'cancelling' && (
            <div style={card}>
              <h2 style={sectionTitle}>Cancellation</h2>
              <p style={{ fontFamily: 'Urbanist', fontSize: '13px', color: '#6E6E6E', margin: '0 0 12px' }}>
                Cancelling keeps your plan active until the end of the current billing period, then moves you to Free.
              </p>
              <button style={btnDanger} disabled={cancelling} onClick={() => setShowCancel(true)}>
                {cancelling ? 'Cancelling…' : 'Cancel Plan'}
              </button>
            </div>
          )}

          {isPaid && status === 'cancelling' && (
            <div style={card}>
              <h2 style={sectionTitle}>Cancellation</h2>
              <p style={{ fontFamily: 'Urbanist', fontSize: '13px', color: '#8a6d00', margin: 0 }}>
                Your plan is scheduled to cancel on {fmtDate(periodEnd)}.
              </p>
            </div>
          )}
        </>
      )}

      <ConfirmModal
        isOpen={showCancel}
        title="Cancel Plan"
        message="Cancel your plan? You'll keep access until the end of your current billing period, then move to Free."
        confirmLabel={cancelling ? 'Cancelling…' : 'Cancel Plan'}
        cancelLabel="Keep Plan"
        danger
        onConfirm={handleCancel}
        onCancel={() => setShowCancel(false)}
      />
    </div>
  );
};

export default BillingPlans;
