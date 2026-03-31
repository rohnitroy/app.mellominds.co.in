import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useParams } from 'react-router-dom';
import styles from './PaymentsInvoice.module.css';
import API_BASE_URL from './config/api';
import DataTable from './components/DataTable';
import { ColumnDef } from '@tanstack/react-table';
import Loader from './components/Loader';
import { exportToCSV } from './utils/exportCSV';
import { useAuth } from './context/AuthContext';

const TAB_SLUGS: Record<string, string> = {
  'all-payments': 'All Payments',
  'all-cancellations': 'All Cancellations',
  'pending-payments': 'Pending Payments',
};
const TAB_TO_SLUG: Record<string, string> = Object.fromEntries(
  Object.entries(TAB_SLUGS).map(([slug, tab]) => [tab, slug])
);

const PaymentsInvoice: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { tab: tabParam } = useParams<{ tab?: string }>();
  const resolvedTab = (tabParam && TAB_SLUGS[tabParam]) || 'All Payments';
  const [activeTab, setActiveTab] = useState<string>(resolvedTab);
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRows, setSelectedRows] = useState<any[]>([]);
  const [activeMenuId, setActiveMenuId] = useState<number | null>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(null);
  const [receiptBooking, setReceiptBooking] = useState<any | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const receiptRef = useRef<HTMLDivElement>(null);

  const tabs = ['All Payments', 'All Cancellations', 'Pending Payments'];

  // Sync URL param → tab
  useEffect(() => {
    const t = (tabParam && TAB_SLUGS[tabParam]) || 'All Payments';
    setActiveTab(t);
  }, [tabParam]);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    navigate(`/payment-invoice/${TAB_TO_SLUG[tab]}`, { replace: true });
  };

  useEffect(() => {
    const fetchBookings = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/bookings`, { credentials: 'include' });
        if (response.ok) {
          const data = await response.json();
          setBookings(data);
        }
      } catch (error) {
        console.error('Failed to fetch bookings for payments:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchBookings();
  }, []);

  // Close menu on outside click
  useEffect(() => {
    if (activeMenuId === null) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setActiveMenuId(null); setMenuPos(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [activeMenuId]);

  const formatDateTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric',
      year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true
    });
  };

  const filteredPayments = useMemo(() => {
    return bookings.filter(b => {
      switch (activeTab) {
        case 'All Cancellations':
          return b.status === 'cancelled' || b.payment_status === 'Refunded' || b.payment_status === 'Cancelled';
        case 'Pending Payments':
          return b.payment_status === 'Pending' && b.status !== 'cancelled';
        default:
          return true;
      }
    });
  }, [bookings, activeTab]);

  const menuItemStyle: React.CSSProperties = {
    display: 'block', width: '100%', padding: '10px 16px', border: 'none',
    background: 'none', textAlign: 'left', fontFamily: 'Urbanist', fontWeight: 500,
    fontSize: '13px', color: '#082421', cursor: 'pointer', borderBottom: '1px solid #f5f5f5',
  };

  const handleRefund = async (bookingId: number) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/bookings/${bookingId}/payment`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ payment_status: 'Refunded' }),
      });
      if (res.ok) {
        setBookings(prev => prev.map(b => b.id === bookingId ? { ...b, payment_status: 'Refunded' } : b));
      }
    } catch (e) {
      console.error('Failed to process refund:', e);
    }
  };

  const handleDownloadReceipt = (booking: any) => {
    const html = buildReceiptHTML(booking);
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 500);
  };

  const buildReceiptHTML = (b: any) => `
    <!DOCTYPE html><html><head><title>Receipt #${b.id}</title>
    <style>
      body { font-family: 'Helvetica Neue', Arial, sans-serif; padding: 40px; color: #1a1a1a; max-width: 600px; margin: 0 auto; }
      .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px; border-bottom: 2px solid #082421; padding-bottom: 20px; }
      .brand { font-size: 22px; font-weight: 700; color: #082421; }
      .receipt-title { font-size: 13px; color: #666; margin-top: 4px; }
      .meta { text-align: right; font-size: 13px; color: #555; }
      .section { margin-bottom: 24px; }
      .section-title { font-size: 11px; font-weight: 700; color: #999; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 10px; }
      .row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 14px; border-bottom: 1px solid #f0f0f0; }
      .row .label { color: #555; }
      .row .value { font-weight: 600; }
      .total-row { display: flex; justify-content: space-between; padding: 12px 0; font-size: 16px; font-weight: 700; border-top: 2px solid #082421; margin-top: 8px; }
      .status-badge { display: inline-block; padding: 3px 12px; border-radius: 20px; font-size: 12px; font-weight: 600;
        background: ${b.payment_status === 'Paid' ? '#e8f5e9' : b.payment_status === 'Refunded' ? '#fdecea' : '#fff3e0'};
        color: ${b.payment_status === 'Paid' ? '#2e7d32' : b.payment_status === 'Refunded' ? '#c62828' : '#e65100'}; }
      .footer { margin-top: 40px; text-align: center; font-size: 12px; color: #999; border-top: 1px solid #eee; padding-top: 16px; }
      @media print { body { padding: 20px; } }
    </style></head><body>
    <div class="header">
      <div>
        <div class="brand">${user?.user_name || 'MelloMinds'}</div>
        <div class="receipt-title">Payment Receipt</div>
      </div>
      <div class="meta">
        <div><strong>Receipt #${b.id}</strong></div>
        <div>${new Date(b.start_time).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
      </div>
    </div>
    <div class="section">
      <div class="section-title">Client Details</div>
      <div class="row"><span class="label">Name</span><span class="value">${b.client_name || '—'}</span></div>
      <div class="row"><span class="label">Email</span><span class="value">${b.client_email || '—'}</span></div>
      <div class="row"><span class="label">Phone</span><span class="value">${b.client_phone || '—'}</span></div>
    </div>
    <div class="section">
      <div class="section-title">Session Details</div>
      <div class="row"><span class="label">Service</span><span class="value">${b.title || '—'}</span></div>
      <div class="row"><span class="label">Date & Time</span><span class="value">${formatDateTime(b.start_time)}</span></div>
      <div class="row"><span class="label">Mode</span><span class="value">${b.location_type === 'in_person' ? 'In-person' : 'Online (Google Meet)'}</span></div>
    </div>
    <div class="section">
      <div class="section-title">Payment</div>
      <div class="row"><span class="label">Payment Status</span><span class="value"><span class="status-badge">${b.payment_status || 'Pending'}</span></span></div>
      <div class="total-row"><span>Total Amount</span><span>₹${parseFloat(b.payment_amount || 0).toFixed(2)}</span></div>
    </div>
    <div class="footer">Thank you for choosing ${user?.user_name || 'MelloMinds'}. For queries, contact ${user?.email || 'support@mellominds.co.in'}</div>
    </body></html>
  `;

  const columns: ColumnDef<any, any>[] = useMemo(() => [
    {
      id: 'client',
      header: 'Client Details',
      enableSorting: false,
      cell: ({ row }) => (
        <div>
          <div className={styles.clientName}>{row.original.client_name || 'Unknown'}</div>
          <div className={styles.clientPhone}>{row.original.client_phone || '—'}</div>
        </div>
      ),
    },
    {
      accessorKey: 'title',
      header: 'Session Type',
    },
    {
      accessorKey: 'start_time',
      header: 'Session Timing',
      cell: ({ getValue }) => formatDateTime(getValue()),
    },
    {
      accessorKey: 'payment_amount',
      header: 'Amount',
      cell: ({ getValue }) => <span className={styles.amount}>₹{parseFloat(getValue() || 0).toFixed(2)}</span>,
    },
    {
      accessorKey: 'payment_status',
      header: 'Payment Status',
      cell: ({ getValue, row }) => {
        // Derive effective payment status
        const ps = getValue() || 'Pending';
        const bookingStatus = row.original.status;
        // If booking cancelled and payment was pending → show Cancelled
        const display = (bookingStatus === 'cancelled' && ps === 'Pending') ? 'Cancelled' : ps;
        const colors: Record<string, { bg: string; color: string }> = {
          Paid:      { bg: '#e8f5e9', color: '#2e7d32' },
          Pending:   { bg: '#fff3e0', color: '#e65100' },
          Refunded:  { bg: '#fdecea', color: '#c62828' },
          Cancelled: { bg: '#f5f5f5', color: '#6E6E6E' },
        };
        const style = colors[display] || colors.Pending;
        return (
          <span style={{ background: style.bg, color: style.color, padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 600 }}>
            {display}
          </span>
        );
      },
    },
    {
      accessorKey: 'status',
      header: 'Booking Status',
      cell: ({ getValue }) => {
        const s = getValue() || 'scheduled';
        const colors: Record<string, { bg: string; color: string }> = {
          scheduled: { bg: '#e8f5e9', color: '#2e7d32' },
          cancelled:  { bg: '#fdecea', color: '#c62828' },
          completed:  { bg: '#e3f2fd', color: '#1565c0' },
          noshow:     { bg: '#fff3e0', color: '#e65100' },
        };
        const style = colors[s] || colors.scheduled;
        return (
          <span style={{ background: style.bg, color: style.color, padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 600, textTransform: 'capitalize' }}>
            {s}
          </span>
        );
      },
    },
    {
      id: 'actions',
      header: 'Actions',
      enableSorting: false,
      cell: ({ row }) => {
        const { id } = row.original;
        const isMenuOpen = activeMenuId === id;
        return (
          <div style={{ position: 'relative' }}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (isMenuOpen) { setActiveMenuId(null); setMenuPos(null); return; }
                const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                setMenuPos({ top: rect.bottom + window.scrollY + 4, right: window.innerWidth - rect.right });
                setActiveMenuId(id);
              }}
              style={{ background: 'none', border: '1px solid #e0e0e0', borderRadius: '6px', padding: '4px 10px', cursor: 'pointer', color: '#333', fontSize: '16px', lineHeight: 1 }}
            >
              ···
            </button>
          </div>
        );
      },
    },
  ], [activeMenuId]);

  return (
    <div className={styles.paymentsPage}>
      <div className={styles.paymentsHeader}>
        <div className={styles.headerContent}>
          <h1>Payments & Invoices</h1>
          <p>View Client's payment, cancellations and invoices</p>
        </div>
      </div>

      <div className={styles.paymentsTabs}>
        {tabs.map(tab => (
          <button key={tab} className={`${styles.tabBtn} ${activeTab === tab ? styles.active : ''}`} onClick={() => handleTabChange(tab)}>
            {tab}
          </button>
        ))}
      </div>

      <div className={styles.headerActions}>
        <div className={styles.searchContainer}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <circle cx="11" cy="11" r="8" stroke="#6E6E6E" strokeWidth="2" />
            <path d="m21 21-4.35-4.35" stroke="#6E6E6E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <input type="text" placeholder="Search users by name, or phone no" />
        </div>
        <button className={styles.exportBtn} onClick={() => {
          const toExport = selectedRows.length > 0 ? selectedRows : filteredPayments;
          exportToCSV(toExport, 'payments', {
            client_name: 'Client Name', client_phone: 'Phone',
            title: 'Session Type', start_time: 'Session Time',
            payment_amount: 'Amount', payment_status: 'Payment Status', status: 'Booking Status'
          });
        }}>
          <img src="/Upload.svg" alt="" />
          {selectedRows.length > 0 ? `Export ${selectedRows.length} Selected` : 'Export to CSV'}
        </button>
      </div>

      {loading ? <Loader /> : (
        <DataTable data={filteredPayments} columns={columns} pageSize={10}
          emptyMessage="No payment records found" enableSelection onSelectionChange={setSelectedRows} />
      )}

      {/* Portal action menu */}
      {activeMenuId !== null && menuPos && (() => {
        const booking = bookings.find(b => b.id === activeMenuId);
        if (!booking) return null;
        const canRefund = booking.payment_status === 'Paid' && booking.status === 'cancelled';
        return createPortal(
          <div ref={menuRef} style={{
            position: 'absolute', top: menuPos.top, right: menuPos.right,
            background: '#fff', border: '1px solid #e9ecef', borderRadius: '10px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)', zIndex: 9999,
            minWidth: '170px', overflow: 'hidden'
          }} onClick={e => e.stopPropagation()}>
            <button onClick={() => { setReceiptBooking(booking); setActiveMenuId(null); setMenuPos(null); }} style={menuItemStyle}>
              View Receipt
            </button>
            <button onClick={() => { handleDownloadReceipt(booking); setActiveMenuId(null); setMenuPos(null); }} style={{ ...menuItemStyle, borderBottom: canRefund ? '1px solid #f5f5f5' : 'none' }}>
              Download Receipt
            </button>
            {canRefund && (
              <button onClick={() => { handleRefund(booking.id); setActiveMenuId(null); setMenuPos(null); }} style={{ ...menuItemStyle, color: '#c62828', borderBottom: 'none' }}>
                Mark as Refunded
              </button>
            )}
          </div>,
          document.body
        );
      })()}

      {/* Receipt lightbox */}
      {receiptBooking && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}
          onClick={() => setReceiptBooking(null)}>
          <div style={{ background: '#fff', borderRadius: '16px', width: '100%', maxWidth: '560px', maxHeight: '90vh', overflowY: 'auto', position: 'relative' }}
            onClick={e => e.stopPropagation()}>
            {/* Receipt header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderBottom: '1px solid #eee' }}>
              <h2 style={{ margin: 0, fontFamily: 'Urbanist', fontWeight: 700, fontSize: '18px' }}>Receipt #{receiptBooking.id}</h2>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <button onClick={() => handleDownloadReceipt(receiptBooking)}
                  style={{ padding: '7px 16px', background: '#082421', color: '#fff', border: 'none', borderRadius: '8px', fontFamily: 'Urbanist', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}>
                  Download
                </button>
                <button onClick={() => setReceiptBooking(null)} style={{ background: 'none', border: 'none', fontSize: '22px', cursor: 'pointer', color: '#666', lineHeight: 1 }}>×</button>
              </div>
            </div>

            {/* Receipt body */}
            <div ref={receiptRef} style={{ padding: '24px', fontFamily: 'Urbanist' }}>
              {/* Brand */}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px', paddingBottom: '16px', borderBottom: '2px solid #082421' }}>
                <div>
                  <div style={{ fontSize: '20px', fontWeight: 700, color: '#082421' }}>{user?.user_name || 'MelloMinds'}</div>
                  <div style={{ fontSize: '12px', color: '#999', marginTop: '2px' }}>Payment Receipt</div>
                </div>
                <div style={{ textAlign: 'right', fontSize: '13px', color: '#555' }}>
                  <div><strong>Receipt #{receiptBooking.id}</strong></div>
                  <div>{new Date(receiptBooking.start_time).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                </div>
              </div>

              {/* Client */}
              <div style={{ marginBottom: '20px' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>Client Details</div>
                {[['Name', receiptBooking.client_name], ['Email', receiptBooking.client_email], ['Phone', receiptBooking.client_phone]].map(([l, v]) => (
                  <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f5f5f5', fontSize: '14px' }}>
                    <span style={{ color: '#555' }}>{l}</span><span style={{ fontWeight: 600 }}>{v || '—'}</span>
                  </div>
                ))}
              </div>

              {/* Session */}
              <div style={{ marginBottom: '20px' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>Session Details</div>
                {[
                  ['Service', receiptBooking.title],
                  ['Date & Time', formatDateTime(receiptBooking.start_time)],
                  ['Mode', receiptBooking.location_type === 'in_person' ? 'In-person' : 'Online (Google Meet)'],
                ].map(([l, v]) => (
                  <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f5f5f5', fontSize: '14px' }}>
                    <span style={{ color: '#555' }}>{l}</span><span style={{ fontWeight: 600 }}>{v || '—'}</span>
                  </div>
                ))}
              </div>

              {/* Payment */}
              <div>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>Payment</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f5f5f5', fontSize: '14px' }}>
                  <span style={{ color: '#555' }}>Status</span>
                  <span>
                    {(() => {
                      const ps = receiptBooking.payment_status || 'Pending';
                      const display = (receiptBooking.status === 'cancelled' && ps === 'Pending') ? 'Cancelled' : ps;
                      const colors: Record<string, { bg: string; color: string }> = {
                        Paid: { bg: '#e8f5e9', color: '#2e7d32' }, Pending: { bg: '#fff3e0', color: '#e65100' },
                        Refunded: { bg: '#fdecea', color: '#c62828' }, Cancelled: { bg: '#f5f5f5', color: '#6E6E6E' },
                      };
                      const c = colors[display] || colors.Pending;
                      return <span style={{ background: c.bg, color: c.color, padding: '3px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 600 }}>{display}</span>;
                    })()}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', fontSize: '16px', fontWeight: 700, borderTop: '2px solid #082421', marginTop: '8px' }}>
                  <span>Total Amount</span>
                  <span>₹{parseFloat(receiptBooking.payment_amount || 0).toFixed(2)}</span>
                </div>
              </div>

              <div style={{ marginTop: '24px', textAlign: 'center', fontSize: '12px', color: '#999', borderTop: '1px solid #eee', paddingTop: '16px' }}>
                Thank you for choosing {user?.user_name || 'MelloMinds'}. For queries, contact {user?.email || 'support@mellominds.co.in'}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PaymentsInvoice;
