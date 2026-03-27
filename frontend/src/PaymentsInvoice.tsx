import React, { useState, useEffect, useMemo } from 'react';
import styles from './PaymentsInvoice.module.css';
import API_BASE_URL from './config/api';
import DataTable from './components/DataTable';
import { ColumnDef } from '@tanstack/react-table';
import Loader from './components/Loader';

const PaymentsInvoice: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('All Payments');
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const tabs = ['All Payments', 'All Cancellations', 'Pending Payments'];

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
        case 'All Cancellations': return b.status === 'cancelled' || b.payment_status === 'Refunded';
        case 'Pending Payments':  return b.payment_status === 'Pending';
        default:                  return true;
      }
    });
  }, [bookings, activeTab]);

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
      cell: ({ getValue }) => <span className={styles.amount}>₹{getValue() || 0}</span>,
    },
    {
      accessorKey: 'payment_status',
      header: 'Status',
      cell: ({ getValue }) => {
        const status = getValue() || 'Pending';
        const colors: Record<string, { bg: string; color: string }> = {
          Paid:      { bg: '#e8f5e9', color: '#2e7d32' },
          Pending:   { bg: '#fff3e0', color: '#e65100' },
          Refunded:  { bg: '#fdecea', color: '#c62828' },
        };
        const style = colors[status] || colors.Pending;
        return (
          <span style={{ background: style.bg, color: style.color, padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 600 }}>
            {status}
          </span>
        );
      },
    },
    {
      id: 'invoice',
      header: 'Invoice',
      enableSorting: false,
      cell: ({ row }) => (
        <span className={styles.invoiceLink}>View IN#{row.original.id}</span>
      ),
    },
  ], []);

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
          <button
            key={tab}
            className={`${styles.tabBtn} ${activeTab === tab ? styles.active : ''}`}
            onClick={() => setActiveTab(tab)}
          >
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
        <button className={styles.exportBtn}>
          <img src="/Upload.svg" alt="" />Export to CSV
        </button>
      </div>

      {loading ? (
        <Loader />
      ) : (
        <DataTable
          data={filteredPayments}
          columns={columns}
          pageSize={10}
          emptyMessage="No payment records found"
        />
      )}
    </div>
  );
};

export default PaymentsInvoice;
