import React, { useState, useEffect } from 'react';
import { Search } from 'react-iconly';
import API_BASE_URL from '../config/api';
import './DevPaymentInvoices.css';

const DevPaymentInvoices: React.FC = () => {
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPayments, setTotalPayments] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [planFilter, setPlanFilter] = useState('');
  const recordsPerPage = 10;

  useEffect(() => {
    fetchPayments(1);
  }, [searchTerm, statusFilter, planFilter]);

  const fetchPayments = async (page: number = 1) => {
    setLoading(true);
    try {
      const offset = (page - 1) * recordsPerPage;
      let url = `${API_BASE_URL}/api/dev/payments?limit=${recordsPerPage}&offset=${offset}`;

      if (searchTerm) url += `&search=${encodeURIComponent(searchTerm)}`;
      if (statusFilter) url += `&status=${statusFilter}`;
      if (planFilter) url += `&plan=${planFilter}`;

      const res = await fetch(url, { credentials: 'include' });
      const data = await res.json();
      setPayments(data.payments || []);
      setTotalPayments(data.total || 0);
      setCurrentPage(page);
    } catch (err) {
      console.error('Failed to fetch payments:', err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadgeClass = (status: string) => {
    if (status === 'Paid') return 'paid';
    if (status === 'Pending') return 'pending';
    if (status === 'Refunded') return 'refunded';
    if (status === 'Partial Refund') return 'partial-refund';
    return 'default';
  };

  const totalPages = Math.ceil(totalPayments / recordsPerPage);

  return (
    <div className="dev-payment-invoices">
      <h1 className="dev-page-heading">Payments & Invoices</h1>

      {/* Filters Section */}
      <div className="dev-filters-section">
        <div className="dev-search-box">
          <Search set="broken" size={18} />
          <input
            type="text"
            placeholder="Search by user name or amount..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            className="dev-search-input"
          />
        </div>

        <div className="dev-filter-group">
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="dev-filter-select"
          >
            <option value="">All Status</option>
            <option value="Paid">Paid</option>
            <option value="Pending">Pending</option>
            <option value="Refunded">Refunded</option>
            <option value="Partial Refund">Partial Refund</option>
          </select>

          <select
            value={planFilter}
            onChange={(e) => {
              setPlanFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="dev-filter-select"
          >
            <option value="">All Plans</option>
            <option value="individual">Individual</option>
            <option value="team">Team</option>
          </select>
        </div>
      </div>

      {/* Results Count */}
      <div className="dev-results-info">
        Showing {payments.length > 0 ? (currentPage - 1) * recordsPerPage + 1 : 0} - {Math.min(currentPage * recordsPerPage, totalPayments)} of {totalPayments} payments
      </div>

      {/* Table */}
      <div className="dev-table-container">
        {loading ? (
          <div className="dev-loading">Loading...</div>
        ) : payments.length === 0 ? (
          <div className="dev-no-data">No payments found</div>
        ) : (
          <table className="dev-payments-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>User Name</th>
                <th>Amount</th>
                <th>Plan</th>
                <th>Status</th>
                <th>Payment Method</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((payment) => (
                <tr key={payment.id}>
                  <td className="dev-payment-id">#{payment.id}</td>
                  <td>{payment.user_name}</td>
                  <td className="dev-amount">₹{payment.payment_amount.toLocaleString()}</td>
                  <td className="dev-plan">{payment.plan_name ? payment.plan_name.charAt(0).toUpperCase() + payment.plan_name.slice(1) : '-'}</td>
                  <td>
                    <span className={`dev-status-badge ${getStatusBadgeClass(payment.payment_status)}`}>
                      {payment.payment_status}
                    </span>
                  </td>
                  <td className="dev-method">{payment.payment_method || '-'}</td>
                  <td>{new Date(payment.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="dev-pagination">
          <button
            className="dev-pagination-btn"
            onClick={() => fetchPayments(currentPage - 1)}
            disabled={currentPage === 1}
          >
            Previous
          </button>

          <div className="dev-pagination-info">
            Page {currentPage} of {totalPages}
          </div>

          <button
            className="dev-pagination-btn"
            onClick={() => fetchPayments(currentPage + 1)}
            disabled={currentPage >= totalPages}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
};

export default DevPaymentInvoices;
