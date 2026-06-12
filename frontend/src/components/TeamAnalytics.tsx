import React, { useState, useEffect } from 'react';
import { useToast } from '../context/ToastContext';
import API_BASE_URL from '../config/api';
import styles from './TeamAnalytics.module.css';
import { ChevronLeft } from 'react-iconly';

interface TeamAnalyticsProps {
  onBack: () => void;
}

interface Analytics {
  revenue: number;
  refund: number;
  sessions: number;
  cancelled: number;
  noShow: number;
  pendingNotes: number;
  pendingPayment: number;
  noOfClients: number;
}

const TeamAnalytics: React.FC<TeamAnalyticsProps> = ({ onBack }) => {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState<Analytics>({
    revenue: 0,
    refund: 0,
    sessions: 0,
    cancelled: 0,
    noShow: 0,
    pendingNotes: 0,
    pendingPayment: 0,
    noOfClients: 0,
  });

  useEffect(() => {
    fetchAnalytics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE_URL}/auth/team-analytics`, {
        credentials: 'include',
      });

      if (res.ok) {
        const data = await res.json();
        if (data && typeof data.revenue === 'number' && typeof data.sessions === 'number') {
          setAnalytics(data);
        } else {
          toast.error('Invalid analytics data format');
        }
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || 'Failed to load analytics');
      }
    } catch (error) {
      console.error('Error fetching analytics:', error);
      toast.error('Error loading analytics');
    } finally {
      setLoading(false);
    }
  };

  const StatCard: React.FC<{ label: string; value: string | number; icon?: string; color?: string }> = ({
    label,
    value,
    color = '#082421',
  }) => (
    <div className={styles.statCard}>
      <div className={styles.statLabel}>{label}</div>
      <div className={styles.statValue} style={{ color }}>
        {typeof value === 'number' ? value.toLocaleString() : value}
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <button onClick={onBack} className={styles.backBtn}>
            <ChevronLeft size={24} primaryColor="#082421" />
          </button>
          <h1>Team Analytics</h1>
        </div>
        <div style={{ textAlign: 'center', padding: '40px', color: '#6E6E6E' }}>Loading analytics...</div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <button onClick={onBack} className={styles.backBtn}>
          <ChevronLeft size={24} primaryColor="#082421" />
        </button>
        <h1>Team Analytics</h1>
      </div>

      <div className={styles.content}>
        <div className={styles.section}>
          <h2>Team Performance Overview</h2>
          <p className={styles.sectionDesc}>Aggregated metrics across all team members</p>

          <div className={styles.statsGrid}>
            <StatCard label="Total Revenue" value={`₹${analytics.revenue.toLocaleString()}`} color="#2D7579" />
            <StatCard label="Total Refunds" value={`₹${analytics.refund.toLocaleString()}`} color="#e53935" />
            <StatCard label="Total Sessions" value={analytics.sessions} color="#082421" />
            <StatCard label="Cancelled Sessions" value={analytics.cancelled} color="#ff9800" />
            <StatCard label="No-Show Sessions" value={analytics.noShow} color="#f44336" />
            <StatCard label="Total Clients" value={analytics.noOfClients} color="#4caf50" />
            <StatCard label="Pending Payments" value={analytics.pendingPayment} color="#ff9800" />
            <StatCard label="Pending Notes" value={analytics.pendingNotes} color="#2196f3" />
          </div>
        </div>

        <div className={styles.section}>
          <h2>Quick Insights</h2>
          <div className={styles.insightsList}>
            <div className={styles.insightItem}>
              <span className={styles.insightIcon}>📊</span>
              <div>
                <h3>Revenue Performance</h3>
                <p>
                  Your team has generated ₹{analytics.revenue.toLocaleString()} in revenue with{' '}
                  {analytics.refund > 0 ? `₹${analytics.refund.toLocaleString()} in refunds` : 'no refunds'}
                </p>
              </div>
            </div>

            <div className={styles.insightItem}>
              <span className={styles.insightIcon}>📅</span>
              <div>
                <h3>Session Statistics</h3>
                <p>
                  {analytics.sessions} total sessions completed with {analytics.cancelled} cancellations and{' '}
                  {analytics.noShow} no-shows
                </p>
              </div>
            </div>

            <div className={styles.insightItem}>
              <span className={styles.insightIcon}>👥</span>
              <div>
                <h3>Client Base</h3>
                <p>Your team is managing {analytics.noOfClients} active clients</p>
              </div>
            </div>

            {analytics.pendingPayment > 0 && (
              <div className={styles.insightItem}>
                <span className={styles.insightIcon}>⚠️</span>
                <div>
                  <h3>Pending Payments</h3>
                  <p>{analytics.pendingPayment} sessions have pending payments awaiting collection</p>
                </div>
              </div>
            )}

            {analytics.pendingNotes > 0 && (
              <div className={styles.insightItem}>
                <span className={styles.insightIcon}>📝</span>
                <div>
                  <h3>Pending Notes</h3>
                  <p>{analytics.pendingNotes} completed sessions are awaiting session notes</p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className={styles.section}>
          <h2>About Team Analytics</h2>
          <p className={styles.sectionDesc}>
            This dashboard provides aggregated insights across your entire team. All metrics include data from the
            organization owner and all active team members. Data is updated in real-time as sessions are completed and
            payments are processed.
          </p>
        </div>
      </div>
    </div>
  );
};

export default TeamAnalytics;
