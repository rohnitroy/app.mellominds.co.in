import React, { useState, useEffect, useCallback } from 'react';
import API_BASE_URL from '../config/api';
import { useToast } from '../context/ToastContext';

interface PriceRow {
  plan_key: string;
  interval: string;
  amount_rupees: number;
  razorpay_plan_id: string;
}

const DevPlanPricing: React.FC = () => {
  const toast = useToast();
  const [rows, setRows] = useState<PriceRow[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const keyOf = (r: { plan_key: string; interval: string }) => `${r.plan_key}:${r.interval}`;

  const fetchPricing = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/plan/admin/pricing`, { credentials: 'include' });
      if (res.ok) {
        const data: PriceRow[] = await res.json();
        setRows(data);
        const d: Record<string, string> = {};
        data.forEach(r => { d[keyOf(r)] = String(r.amount_rupees); });
        setDrafts(d);
      } else if (res.status === 403) {
        toast.error('Admin access required.');
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [toast]);

  useEffect(() => { fetchPricing(); }, [fetchPricing]);

  const save = async (r: PriceRow) => {
    const k = keyOf(r);
    const raw = (drafts[k] ?? '').trim();
    const rupees = Number(raw);
    if (!Number.isInteger(rupees) || rupees < 1 || rupees > 1000000) {
      toast.warning('Enter a whole number between 1 and 10,00,000.');
      return;
    }
    if (rupees === r.amount_rupees) { toast.info('Price unchanged.'); return; }
    setSavingKey(k);
    try {
      const res = await fetch(`${API_BASE_URL}/api/plan/admin/pricing`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ plan_key: r.plan_key, interval: r.interval, amount_rupees: rupees }),
      });
      const data = await res.json();
      if (res.ok) { toast.success(`Updated ${r.plan_key} ${r.interval} to ₹${rupees.toLocaleString('en-IN')}.`); await fetchPricing(); }
      else toast.error(data.error || 'Failed to update price');
    } catch { toast.error('Network error. Please try again.'); }
    finally { setSavingKey(null); }
  };

  const label = (r: PriceRow) => {
    const plan = r.plan_key === 'team' ? 'Team' : 'Individual';
    const iv = r.interval === 'yearly' ? 'Annual' : 'Monthly';
    const unit = r.plan_key === 'team' ? '/seat' : '';
    const period = r.interval === 'yearly' ? '/year' : '/month';
    return { plan, iv, suffix: `${unit}${period}` };
  };

  return (
    <div style={{ padding: '24px', maxWidth: '820px' }}>
      <h1 style={{ fontFamily: 'Urbanist', fontWeight: 700, fontSize: '24px', color: '#082421', margin: '0 0 4px' }}>Plan Pricing</h1>
      <p style={{ fontFamily: 'Urbanist', fontSize: '14px', color: '#6E6E6E', margin: '0 0 20px' }}>
        Change subscription prices. New Razorpay plans are created automatically — existing subscribers keep their current price; new sign-ups pay the new price.
      </p>

      {loading ? (
        <div style={{ padding: '40px', textAlign: 'center', color: '#9CA3AF', fontFamily: 'Urbanist' }}>Loading…</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {rows.map(r => {
            const k = keyOf(r);
            const { plan, iv, suffix } = label(r);
            const changed = (drafts[k] ?? '') !== String(r.amount_rupees);
            return (
              <div key={k} style={{ background: '#fff', border: '1px solid #f1f3f4', borderRadius: '14px', padding: '18px 20px', display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                <div style={{ minWidth: '150px' }}>
                  <div style={{ fontFamily: 'Urbanist', fontWeight: 700, fontSize: '15px', color: '#082421' }}>{plan} · {iv}</div>
                  <div style={{ fontFamily: 'Urbanist', fontSize: '11px', color: '#9CA3AF' }}>{r.razorpay_plan_id}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontFamily: 'Urbanist', fontWeight: 700, color: '#082421' }}>₹</span>
                  <input
                    type="number" min={1} max={1000000}
                    value={drafts[k] ?? ''}
                    onChange={e => setDrafts(d => ({ ...d, [k]: e.target.value }))}
                    style={{ width: '120px', padding: '8px 10px', borderRadius: '8px', border: '1px solid #ccc', fontFamily: 'Urbanist', fontSize: '14px' }}
                  />
                  <span style={{ fontFamily: 'Urbanist', fontSize: '13px', color: '#6E6E6E' }}>{suffix}</span>
                </div>
                <button
                  onClick={() => save(r)}
                  disabled={!changed || savingKey === k}
                  style={{
                    marginLeft: 'auto', padding: '9px 18px', borderRadius: '10px', border: 'none',
                    fontFamily: 'Urbanist', fontWeight: 700, fontSize: '13px', cursor: changed ? 'pointer' : 'not-allowed',
                    background: changed ? '#082421' : '#e5e7eb', color: changed ? '#fff' : '#9CA3AF',
                  }}
                >
                  {savingKey === k ? 'Saving…' : 'Save'}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default DevPlanPricing;
