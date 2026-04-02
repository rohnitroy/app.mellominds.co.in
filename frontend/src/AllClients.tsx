import React, { useState, useEffect, useMemo } from 'react';
import styles from './AllClients.module.css';
import ClientView from './ClientView';
import { Search } from 'react-iconly';
import API_BASE_URL from './config/api';
import DataTable from './components/DataTable';
import { ColumnDef } from '@tanstack/react-table';
import Loader from './components/Loader';
import { useToast } from './context/ToastContext';
import { exportToCSV } from './utils/exportCSV';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
interface Client {
  id: number;
  name: string;
  phone: string;
  email: string;
  sessions: string;
  revenue: string;
  lastSession?: string;
  lastSessionStatus?: string;
  age?: string;
  occupation?: string;
  gender?: string;
  maritalStatus?: string;
  emergencyName?: string;
  emergencyPhone?: string;
  emergencyRelation?: string;
}

const defaultForm = {
  name: '',
  email: '',
  phone: '',
  age: '',
  occupation: '',
  gender: 'Male',
  maritalStatus: 'Single',
  emergencyName: '',
  emergencyPhone: '',
  emergencyRelation: '',
};

const AllClients: React.FC = () => {
  const toast = useToast();
  const location = useLocation();
  const navigate = useNavigate();
  const { clientId, tab } = useParams<{ clientId?: string; tab?: string; listTab?: string }>();
  const listTabParam = useParams<{ listTab?: string }>().listTab;
  const [activeTab, setActiveTab] = useState<'all' | 'transferred'>(listTabParam === 'transferred' ? 'transferred' : 'all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [initialTab, setInitialTab] = useState<string | undefined>(undefined);
  const [selectedClientCutoff, setSelectedClientCutoff] = useState<Date | undefined>(undefined);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRows, setSelectedRows] = useState<Client[]>([]);

  // Transferred clients state
  const [transfers, setTransfers] = useState<any[]>([]);
  const [transfersLoading, setTransfersLoading] = useState(false);
  const [transferSearch, setTransferSearch] = useState('');

  // Add client modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({ ...defaultForm });
  const [saving, setSaving] = useState(false);
  const [addClientCalendarId, setAddClientCalendarId] = useState<string>('');

  // Bulk send booking link state
  const [showBulkSendModal, setShowBulkSendModal] = useState(false);
  const [calendars, setCalendars] = useState<{ id: number; title: string; duration: string; slug: string }[]>([]);
  const [selectedCalendarId, setSelectedCalendarId] = useState<string>('');
  const [bulkSending, setBulkSending] = useState(false);

  const fetchClients = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/bookings/clients`, { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        setClients(data);
      }
    } catch (error) {
      console.error('Failed to fetch clients:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCalendars = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/calendars`, { credentials: 'include' });
      if (res.ok) setCalendars(await res.json());
    } catch { /* silent */ }
  };

  const handleBulkSend = async () => {
    if (!selectedCalendarId) { toast.warning('Please select a calendar.'); return; }
    setBulkSending(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/bookings/send-link/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          calendar_id: parseInt(selectedCalendarId),
          clients: selectedRows.map(c => ({ name: c.name, email: c.email })),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`Booking link sent to ${data.sent} client${data.sent !== 1 ? 's' : ''}${data.failed > 0 ? ` (${data.failed} failed)` : ''}.`);
        setShowBulkSendModal(false);
        setSelectedCalendarId('');
      } else {
        toast.error(data.error || 'Failed to send booking links.');
      }
    } catch {
      toast.error('Network error. Please try again.');
    } finally {
      setBulkSending(false);
    }
  };

  useEffect(() => {
    fetchClients();
  }, []);

  // Handle URL-based client selection (e.g. /clients/:clientId/:tab)
  useEffect(() => {
    if (clientId && clients.length > 0) {
      const match = clients.find(c => c.id === parseInt(clientId));
      if (match) {
        const tabName = tab ? decodeURIComponent(tab) : 'Overview';
        setInitialTab(tabName);
        setSelectedClient(match);
      }
    }
  }, [clientId, tab, clients]);

  // Handle navigation from Appointments "Add Note" action
  useEffect(() => {
    const state = location.state as { clientEmail?: string; initialTab?: string } | null;
    if (state?.clientEmail && clients.length > 0) {
      const match = clients.find(c => c.email === state.clientEmail);
      if (match) {
        setInitialTab(state.initialTab);
        setSelectedClient(match);
        // Clear state so back navigation doesn't re-trigger
        window.history.replaceState({}, '');
      }
    }
  }, [clients, location.state]);

  const fetchTransfers = async () => {
    setTransfersLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/clients/transfers/outgoing`, { credentials: 'include' });
      if (res.ok) setTransfers(await res.json());
    } catch { /* silent */ } finally {
      setTransfersLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'transferred') fetchTransfers();
  }, [activeTab]);

  const handleAddClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addForm.name.trim() || !addForm.email.trim()) {
      toast.error('Name and email are required.');
      return;
    }
    setSaving(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/clients`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          ...addForm,
          ...(addClientCalendarId ? { calendarId: parseInt(addClientCalendarId) } : {}),
        }),
      });

      if (response.ok) {
        const newClient = await response.json();
        setClients(prev => [newClient, ...prev]);
        setShowAddModal(false);
        setAddForm({ ...defaultForm });
        setAddClientCalendarId('');
        toast.success('Client added successfully!');
        // Open the new client's view immediately
        setSelectedClient(newClient);
      } else {
        const err = await response.json();
        toast.error(err.error || 'Failed to add client.');
      }
    } catch (error) {
      console.error('Error adding client:', error);
      toast.error('An error occurred while adding the client.');
    } finally {
      setSaving(false);
    }
  };

  const filteredClients = useMemo(() => clients.filter(c =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.phone.includes(searchTerm) ||
    c.email.toLowerCase().includes(searchTerm.toLowerCase())
  ), [clients, searchTerm]);

  const filteredTransfers = useMemo(() => transfers.filter(t =>
    t.client_name?.toLowerCase().includes(transferSearch.toLowerCase()) ||
    t.client_email?.toLowerCase().includes(transferSearch.toLowerCase()) ||
    t.client_phone?.includes(transferSearch) ||
    t.to_therapist_email?.toLowerCase().includes(transferSearch.toLowerCase())
  ), [transfers, transferSearch]);

  const columns: ColumnDef<Client, any>[] = useMemo(() => [
    {
      accessorKey: 'name',
      header: 'Client Name',
      cell: ({ row }) => (
        <div
          className={styles.clientName}
          style={{ cursor: 'pointer', color: '#2D7579', textDecoration: 'underline' }}
          onClick={() => {
            setSelectedClient(row.original);
            navigate(`/clients/${row.original.id}/Overview`);
          }}
        >
          {row.original.name}
        </div>
      ),
    },
    {
      id: 'contact',
      header: 'Contact Info',
      enableSorting: false,
      cell: ({ row }) => (
        <div>
          <div className={styles.phoneNumber}>{row.original.phone}</div>
          <div className={styles.emailAddress}>{row.original.email}</div>
        </div>
      ),
    },
    {
      accessorKey: 'sessions',
      header: 'No. of Sessions',
      cell: ({ getValue }) => (
        <span className={styles.sessionCount}>{getValue()}</span>
      ),
    },
    {
      accessorKey: 'lastSession',
      header: 'Last Session Booked',
      cell: ({ row }) => {
        const date = row.original.lastSession;
        const status = row.original.lastSessionStatus;
        const color =
          status === 'cancelled' ? '#c62828' :
          status === 'completed' ? '#2e7d32' :
          status === 'noshow'    ? '#e65100' :
          undefined;
        return (
          <span className={styles.sessionCount} style={color ? { color, fontWeight: 600 } : undefined}>
            {date || '—'}
          </span>
        );
      },
    },
    {
      accessorKey: 'revenue',
      header: 'Revenue',
      cell: ({ getValue }) => (
        <span className={styles.revenueAmount}>{getValue()}</span>
      ),
    },
  ], []);

  const transferColumns: ColumnDef<any, any>[] = useMemo(() => [
    {
      accessorKey: 'client_name',
      header: 'Client Name',
      cell: ({ row }) => (
        <div>
          <div className={styles.clientName}>{row.original.client_name}</div>
        </div>
      ),
    },
    {
      id: 'contact',
      header: 'Contact Info',
      enableSorting: false,
      cell: ({ row }) => (
        <div>
          <div className={styles.phoneNumber}>{row.original.client_phone || '—'}</div>
          <div className={styles.emailAddress}>{row.original.client_email}</div>
        </div>
      ),
    },
    {
      accessorKey: 'sessions',
      header: 'No. of Sessions',
      cell: ({ getValue }) => <span className={styles.sessionCount}>{getValue() || '0'}</span>,
    },
    {
      accessorKey: 'last_session',
      header: 'Last Session Booked',
      cell: ({ getValue }) => {
        const v = getValue();
        return <span className={styles.sessionCount}>{v ? new Date(v).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}</span>;
      },
    },
    {
      accessorKey: 'revenue',
      header: 'Revenue',
      cell: ({ getValue }) => <span className={styles.revenueAmount}>₹{parseFloat(getValue() || 0).toLocaleString('en-IN')}</span>,
    },
    {
      accessorKey: 'to_therapist_email',
      header: 'Transferred To',
      cell: ({ getValue }) => <span className={styles.emailAddress}>{getValue()}</span>,
    },
    {
      accessorKey: 'status',
      header: 'Transfer Status',
      cell: ({ getValue }) => {
        const s = getValue() as string;
        return (
          <span style={{
            padding: '4px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 600,
            background: s === 'approved' ? '#e8f5e9' : s === 'rejected' ? '#fdecea' : '#fff8e1',
            color: s === 'approved' ? '#2e7d32' : s === 'rejected' ? '#c62828' : '#f57f17'
          }}>
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </span>
        );
      },
    },
    {
      id: 'view',
      header: 'View',
      enableSorting: false,
      cell: ({ row }) => {
        const t = row.original;
        if (t.status !== 'approved') return <span style={{ color: '#ccc', fontSize: '12px' }}>—</span>;
        return (
          <button
            onClick={() => {
              const clientObj: Client = {
                id: t.client_id,
                name: t.client_name,
                email: t.client_email,
                phone: t.client_phone || '',
                sessions: t.sessions || '0',
                revenue: `₹${t.revenue || 0}`,
              };
              setSelectedClientCutoff(new Date(t.transfer_date || t.updated_at));
              setInitialTab('Overview');
              setSelectedClient(clientObj);
              navigate(`/clients/${t.client_id}/Overview`);
            }}
            style={{ padding: '5px 14px', background: '#082421', color: '#fff', border: 'none', borderRadius: '8px', fontFamily: 'Urbanist', fontWeight: 600, fontSize: '12px', cursor: 'pointer' }}
          >
            View
          </button>
        );
      },
    },
  ], []);

  if (selectedClient) {
    return (
      <ClientView
        client={selectedClient}
        initialTab={initialTab}
        propCutoffDate={selectedClientCutoff}
        onBack={() => {
          setSelectedClient(null);
          setInitialTab(undefined);
          setSelectedClientCutoff(undefined);
          fetchClients();
          navigate('/clients', { replace: true });
        }}
        onTabChange={(newTab) => {
          navigate(`/clients/${selectedClient.id}/${encodeURIComponent(newTab)}`, { replace: true });
        }}
      />
    );
  }

  return (
    <div className={styles.clientsContent}>
      <div className={styles.pageHeader}>
        <div>
          <h1>All Clients</h1>
          <p>View Client Details, Sessions and more...</p>
        </div>
        <button className={styles.addClientBtn} onClick={() => { fetchCalendars(); setShowAddModal(true); }}>+ Add Client</button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '20px', borderBottom: '1px solid #e0e0e0' }}>
        {(['all', 'transferred'] as const).map(t => (
          <button key={t} onClick={() => {
            setActiveTab(t);
            navigate(t === 'all' ? '/clients' : '/clients/list/transferred', { replace: true });
          }} style={{
            padding: '10px 20px', border: 'none', background: 'none', cursor: 'pointer',
            fontFamily: 'Urbanist', fontWeight: 600, fontSize: '14px',
            color: activeTab === t ? '#082421' : '#9CA3AF',
            borderBottom: activeTab === t ? '2px solid #082421' : '2px solid transparent',
            marginBottom: '-1px'
          }}>
            {t === 'all' ? 'All Clients' : 'Transferred'}
          </button>
        ))}
      </div>

      {activeTab === 'transferred' ? (
        transfersLoading ? <Loader /> : (
          <div>
            <div className={styles.pageActions}>
              <div className={styles.searchContainer}>
                <Search size="medium" primaryColor="#6E6E6E" />
                <input
                  type="text"
                  placeholder="Search by client name, email, phone or transferred to..."
                  value={transferSearch}
                  onChange={e => setTransferSearch(e.target.value)}
                  className={styles.searchInput}
                />
              </div>
            </div>
            <DataTable
              data={filteredTransfers}
              columns={transferColumns}
              pageSize={10}
              emptyMessage="No transfers found"
            />
          </div>
        )
      ) : (
        <>
        <div className={styles.pageActions}>
          <div className={styles.searchContainer}>
            <Search size="medium" primaryColor="#6E6E6E" />
            <input
              type="text"
              placeholder="Search users by name, phone no or email id..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={styles.searchInput}
            />
          </div>
          <button className={styles.exportBtn} onClick={() => {
            const toExport = selectedRows.length > 0 ? selectedRows : filteredClients;
            exportToCSV(toExport, 'clients', {
              name: 'Name', email: 'Email', phone: 'Phone',
              sessions: 'Sessions', revenue: 'Revenue', lastSession: 'Last Session'
            });
          }}>
            <img src="/Upload.svg" alt="" />
            {selectedRows.length > 0 ? `Export ${selectedRows.length} Selected` : 'Export to CSV'}
          </button>
          {selectedRows.length > 0 && (
            <button
              className={styles.exportBtn}
              onClick={() => { fetchCalendars(); setShowBulkSendModal(true); }}
              style={{ background: '#082421', color: '#fff', borderRadius: '8px', padding: '10px 18px', display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
              </svg>
              Send Booking Link ({selectedRows.length})
            </button>
          )}
        </div>
        {loading ? (
          <Loader />
        ) : (
          <DataTable
            data={filteredClients}
            columns={columns}
            pageSize={10}
            emptyMessage="No clients found"
            enableSelection
            onSelectionChange={setSelectedRows}
          />
        )}
      </>
      )}

      {/* Bulk Send Booking Link Modal */}
      {showBulkSendModal && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}
          onClick={() => !bulkSending && setShowBulkSendModal(false)}
        >
          <div
            style={{ background: '#fff', borderRadius: '16px', padding: '32px', width: '100%', maxWidth: '480px' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
              <h2 style={{ fontFamily: 'Urbanist', fontWeight: 700, fontSize: '20px', margin: 0 }}>Send Booking Link</h2>
              <button onClick={() => setShowBulkSendModal(false)} style={{ background: 'none', border: 'none', fontSize: '22px', cursor: 'pointer', color: '#666', lineHeight: 1 }}>×</button>
            </div>
            <p style={{ fontFamily: 'Urbanist', fontSize: '14px', color: '#6E6E6E', margin: '0 0 24px 0' }}>
              Sending to <strong>{selectedRows.length}</strong> client{selectedRows.length !== 1 ? 's' : ''}:&nbsp;
              {selectedRows.slice(0, 3).map(c => c.name).join(', ')}{selectedRows.length > 3 ? ` +${selectedRows.length - 3} more` : ''}
            </p>

            {/* Client chips */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '24px', maxHeight: '100px', overflowY: 'auto' }}>
              {selectedRows.map(c => (
                <span key={c.id} style={{ background: '#f0faf9', border: '1px solid #b2dfdb', borderRadius: '20px', padding: '4px 12px', fontSize: '13px', fontFamily: 'Urbanist', color: '#082421' }}>
                  {c.name}
                </span>
              ))}
            </div>

            <label style={labelStyle}>Select Calendar *</label>
            {calendars.length === 0 ? (
              <p style={{ fontFamily: 'Urbanist', fontSize: '13px', color: '#c62828', marginBottom: '24px' }}>No calendars found. Please create a calendar first.</p>
            ) : (
              <select
                style={{ ...inputStyle, marginBottom: '24px' }}
                value={selectedCalendarId}
                onChange={e => setSelectedCalendarId(e.target.value)}
              >
                <option value="">— Choose a calendar —</option>
                {calendars.map(c => (
                  <option key={c.id} value={c.id}>{c.title} ({c.duration})</option>
                ))}
              </select>
            )}

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => { setShowBulkSendModal(false); setSelectedCalendarId(''); }}
                disabled={bulkSending}
                style={{ padding: '10px 24px', borderRadius: '8px', border: '1px solid #e0e0e0', background: '#fff', fontFamily: 'Urbanist', fontWeight: 500, fontSize: '14px', color: '#333', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleBulkSend}
                disabled={bulkSending || !selectedCalendarId || calendars.length === 0}
                style={{ padding: '10px 24px', borderRadius: '8px', border: 'none', background: '#082421', fontFamily: 'Urbanist', fontWeight: 600, fontSize: '14px', color: '#fff', cursor: (bulkSending || !selectedCalendarId) ? 'not-allowed' : 'pointer', opacity: (bulkSending || !selectedCalendarId) ? 0.7 : 1 }}
              >
                {bulkSending ? 'Sending...' : `Send to ${selectedRows.length} Client${selectedRows.length !== 1 ? 's' : ''}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Client Modal */}
      {showAddModal && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
            zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px'
          }}
          onClick={() => !saving && setShowAddModal(false)}
        >
          <div
            style={{
              background: '#fff', borderRadius: '16px', padding: '32px',
              width: '100%', maxWidth: '560px', maxHeight: '90vh', overflowY: 'auto'
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
              <h2 style={{ fontFamily: 'Urbanist', fontWeight: 700, fontSize: '22px', margin: 0 }}>Add New Client</h2>
              <button onClick={() => { setShowAddModal(false); setAddForm({ ...defaultForm }); setAddClientCalendarId(''); }} style={{ background: 'none', border: 'none', fontSize: '22px', cursor: 'pointer', color: '#666', lineHeight: 1 }}>×</button>
            </div>
            <p style={{ fontFamily: 'Urbanist', fontSize: '14px', color: '#6E6E6E', margin: '0 0 24px 0' }}>Fill in the client's details below</p>

            <form onSubmit={handleAddClient}>
              {/* Basic Info */}
              <p style={{ fontFamily: 'Urbanist', fontWeight: 600, fontSize: '13px', color: '#2D7579', margin: '0 0 12px 0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Basic Info</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div>
                  <label style={labelStyle}>Full Name *</label>
                  <input style={inputStyle} type="text" required value={addForm.name} onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))} placeholder="Jane Doe" />
                </div>
                <div>
                  <label style={labelStyle}>Email *</label>
                  <input style={inputStyle} type="email" required value={addForm.email} onChange={e => setAddForm(f => ({ ...f, email: e.target.value }))} placeholder="jane@example.com" />
                </div>
                <div>
                  <label style={labelStyle}>Phone</label>
                  <input style={inputStyle} type="tel" value={addForm.phone} onChange={e => setAddForm(f => ({ ...f, phone: e.target.value }))} placeholder="+91 98765 43210" />
                </div>
                <div>
                  <label style={labelStyle}>Age</label>
                  <input style={inputStyle} type="text" value={addForm.age} onChange={e => setAddForm(f => ({ ...f, age: e.target.value }))} placeholder="28" />
                </div>
                <div>
                  <label style={labelStyle}>Occupation</label>
                  <input style={inputStyle} type="text" value={addForm.occupation} onChange={e => setAddForm(f => ({ ...f, occupation: e.target.value }))} placeholder="Software Engineer" />
                </div>
                <div>
                  <label style={labelStyle}>Gender</label>
                  <select style={inputStyle} value={addForm.gender} onChange={e => setAddForm(f => ({ ...f, gender: e.target.value }))}>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                    <option value="Prefer not to say">Prefer not to say</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Marital Status</label>
                  <select style={inputStyle} value={addForm.maritalStatus} onChange={e => setAddForm(f => ({ ...f, maritalStatus: e.target.value }))}>
                    <option value="Single">Single</option>
                    <option value="Married">Married</option>
                    <option value="Divorced">Divorced</option>
                    <option value="Widowed">Widowed</option>
                  </select>
                </div>
              </div>

              {/* Emergency Contact */}
              <p style={{ fontFamily: 'Urbanist', fontWeight: 600, fontSize: '13px', color: '#2D7579', margin: '8px 0 12px 0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Emergency Contact</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '28px' }}>
                <div>
                  <label style={labelStyle}>Name</label>
                  <input style={inputStyle} type="text" value={addForm.emergencyName} onChange={e => setAddForm(f => ({ ...f, emergencyName: e.target.value }))} placeholder="John Doe" />
                </div>
                <div>
                  <label style={labelStyle}>Phone</label>
                  <input style={inputStyle} type="tel" value={addForm.emergencyPhone} onChange={e => setAddForm(f => ({ ...f, emergencyPhone: e.target.value }))} placeholder="+91 98765 43210" />
                </div>
                <div>
                  <label style={labelStyle}>Relation</label>
                  <input style={inputStyle} type="text" value={addForm.emergencyRelation} onChange={e => setAddForm(f => ({ ...f, emergencyRelation: e.target.value }))} placeholder="Spouse" />
                </div>
              </div>

              {/* Send Booking Link */}
              {calendars.length > 0 && (
                <>
                  <p style={{ fontFamily: 'Urbanist', fontWeight: 600, fontSize: '13px', color: '#2D7579', margin: '8px 0 12px 0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Send Booking Link (Optional)</p>
                  <div style={{ marginBottom: '28px' }}>
                    <label style={labelStyle}>Select Calendar</label>
                    <select style={inputStyle} value={addClientCalendarId} onChange={e => setAddClientCalendarId(e.target.value)}>
                      <option value="">— Skip, don't send —</option>
                      {calendars.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                    </select>
                    {addClientCalendarId && (
                      <p style={{ fontFamily: 'Urbanist', fontSize: '12px', color: '#6E6E6E', margin: '6px 0 0 0' }}>
                        A welcome email with the booking link will be sent to the client.
                      </p>
                    )}
                  </div>
                </>
              )}

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => { setShowAddModal(false); setAddForm({ ...defaultForm }); setAddClientCalendarId(''); }}
                  disabled={saving}
                  style={{ padding: '10px 24px', borderRadius: '8px', border: '1px solid #e0e0e0', background: '#fff', fontFamily: 'Urbanist', fontWeight: 500, fontSize: '14px', color: '#333', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  style={{ padding: '10px 24px', borderRadius: '8px', border: 'none', background: '#082421', fontFamily: 'Urbanist', fontWeight: 600, fontSize: '14px', color: '#fff', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}
                >
                  {saving ? 'Adding...' : 'Add Client'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

const labelStyle: React.CSSProperties = {
  display: 'block', fontFamily: 'Urbanist', fontWeight: 500,
  fontSize: '13px', color: '#555', marginBottom: '6px'
};

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', borderRadius: '8px',
  border: '1px solid #e0e0e0', fontFamily: 'Urbanist', fontSize: '14px',
  color: '#333', outline: 'none', boxSizing: 'border-box', background: '#fff'
};

export default AllClients;
