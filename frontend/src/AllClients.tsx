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
interface Client {
  id: number;
  name: string;
  phone: string;
  email: string;
  sessions: string;
  revenue: string;
  lastSession?: string;
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
  const [activeTab, setActiveTab] = useState<'all' | 'transferred'>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
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

  useEffect(() => {
    fetchClients();
  }, []);

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
        body: JSON.stringify(addForm),
      });

      if (response.ok) {
        const newClient = await response.json();
        setClients(prev => [newClient, ...prev]);
        setShowAddModal(false);
        setAddForm({ ...defaultForm });
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
          onClick={() => setSelectedClient(row.original)}
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
      cell: ({ getValue }) => (
        <span className={styles.sessionCount}>{getValue() || '—'}</span>
      ),
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
      cell: ({ getValue }) => <span className={styles.revenueAmount}>₹{parseFloat(getValue() || 0).toLocaleString()}</span>,
    },
    {
      accessorKey: 'to_therapist_email',
      header: 'Transferred To',
      cell: ({ getValue }) => <span className={styles.emailAddress}>{getValue()}</span>,
    },
    {
      accessorKey: 'status',
      header: 'Status',
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
  ], []);

  if (selectedClient) {
    return (
      <ClientView
        client={selectedClient}
        onBack={() => {
          setSelectedClient(null);
          fetchClients(); // refresh list in case client was edited
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
        <button className={styles.addClientBtn} onClick={() => setShowAddModal(true)}>+ Add Client</button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '20px', borderBottom: '1px solid #e0e0e0' }}>
        {(['all', 'transferred'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{
            padding: '10px 20px', border: 'none', background: 'none', cursor: 'pointer',
            fontFamily: 'Urbanist', fontWeight: 600, fontSize: '14px',
            color: activeTab === tab ? '#082421' : '#9CA3AF',
            borderBottom: activeTab === tab ? '2px solid #082421' : '2px solid transparent',
            marginBottom: '-1px'
          }}>
            {tab === 'all' ? 'All Clients' : 'Transferred'}
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
            <h2 style={{ fontFamily: 'Urbanist', fontWeight: 700, fontSize: '22px', margin: '0 0 4px 0' }}>Add New Client</h2>
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

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => { setShowAddModal(false); setAddForm({ ...defaultForm }); }}
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
