import React, { useState, useEffect } from 'react';
import styles from './PaymentsInvoice.module.css';

const PaymentsInvoice: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('All Payments');
  const [bookings, setBookings] = useState<any[]>([]);

  const tabs = ['All Payments', 'All Cancellations', 'Pending Payments'];

  useEffect(() => {
    const fetchBookings = async () => {
      try {
        const response = await fetch('http://localhost:3001/api/bookings', {
          credentials: 'include'
        });
        if (response.ok) {
          const data = await response.json();
          setBookings(data);
        }
      } catch (error) {
        console.error('Failed to fetch bookings for payments:', error);
      }
    };
    fetchBookings();
  }, []);

  const formatDateTime = (isoString: string) => {
    const date = new Date(isoString);
    return `${date.toLocaleString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })} at ${date.toLocaleString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`;
  };

  const getFilteredPayments = () => {
    // Filter based on tab
    return bookings.filter(b => {
      switch (activeTab) {
        case 'All Cancellations':
          return b.status === 'cancelled' || b.payment_status === 'Refunded';
        case 'Pending Payments':
          return b.payment_status === 'Pending';
        case 'All Payments':
        default:
          // Show everything or just Paid/Pending? All implies all history
          return true;
      }
    });
  };

  const filteredPayments = getFilteredPayments();

  return (
    <div className={styles.paymentsPage}>
      <div className={styles.paymentsHeader}>
        <div className={styles.headerContent}>
          <h1>Payments & Invoices</h1>
          <p>View Client's payment, cancellations and invoices</p>
        </div>
        <div className={styles.headerActions}>
          <div className={styles.searchContainer}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="11" cy="11" r="8" stroke="#6E6E6E" strokeWidth="2" />
              <path d="m21 21-4.35-4.35" stroke="#6E6E6E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <input type="text" placeholder="Search users by name, or phone no" />
          </div>
          <button className={styles.exportBtn}>
            <img src="/Upload.svg" alt="" />
            Export to CSV
          </button>
        </div>
      </div>

      <div className={styles.paymentsTabs}>
        {tabs.map((tab) => (
          <button
            key={tab}
            className={`${styles.tabBtn} ${activeTab === tab ? styles.active : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
        <button className={styles.filterBtn}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M22 3H2L10 12.46V19L14 21V12.46L22 3Z" stroke="#6E6E6E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      <div className={styles.paymentsTable}>
        <div className={styles.tableHeader}>
          <span>Client Details</span>
          <span>Session Type</span>
          <span>Session Timing</span>
          <span>Amount</span>
          <span>Status</span>
          <span>Invoices</span>
        </div>

        {filteredPayments.length === 0 ? (
          <div style={{ padding: '20px', textAlign: 'center', color: '#666' }}>No payment records found</div>
        ) : (
          filteredPayments.map((payment, index) => (
            <div key={index} className={styles.tableRow}>
              <div className={styles.clientDetails}>
                <div className={styles.clientName}>{payment.client_name || 'Unknown'}</div>
                <div className={styles.clientPhone}>{payment.client_phone || '-'}</div>
              </div>
              <span>{payment.title}</span>
              <span>{formatDateTime(payment.start_time)}</span>
              <span className={styles.amount}>Rs. {payment.payment_amount || 0}/-</span>
              <span className={styles.status}>{payment.payment_status || 'Pending'}</span>
              <span className={styles.invoiceLink}>View IN#{payment.id}</span>
            </div>
          ))
        )}
      </div>

      <div className={styles.pagination}>
        <span>Showing 1 to {Math.min(10, filteredPayments.length)} of {filteredPayments.length} results</span>
        <div className={styles.paginationControls}>
          <img src="/Arrow - Left Square.svg" alt="Previous" className={styles.paginationBtn} />
          <img src="/Arrow - Right Square.svg" alt="Next" className={styles.paginationBtn} />
        </div>
      </div>
    </div>
  );
};

export default PaymentsInvoice;
