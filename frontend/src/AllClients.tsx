import React, { useState, useEffect, useMemo } from 'react';
import styles from './AllClients.module.css';
import ClientView from './ClientView';
import { Search } from 'react-iconly';
import API_BASE_URL from './config/api';
import DataTable from './components/DataTable';
import { ColumnDef } from '@tanstack/react-table';

interface Client {
  id: number;
  name: string;
  phone: string;
  email: string;
  sessions: string;
  revenue: string;
  lastSession?: string;
}

const AllClients: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [clients, setClients] = useState<Client[]>([]);

  useEffect(() => {
    const fetchClients = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/bookings/clients`, { credentials: 'include' });
        if (response.ok) {
          const data = await response.json();
          setClients(data);
        }
      } catch (error) {
        console.error('Failed to fetch clients:', error);
      }
    };
    fetchClients();
  }, []);

  const filteredClients = useMemo(() => clients.filter(c =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.phone.includes(searchTerm) ||
    c.email.toLowerCase().includes(searchTerm.toLowerCase())
  ), [clients, searchTerm]);

  const columns: ColumnDef<Client, any>[] = useMemo(() => [
    {
      accessorKey: 'name',
      header: 'Client Name',
      cell: ({ getValue }) => (
        <div className={styles.clientName}>{getValue()}</div>
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
    {
      id: 'actions',
      header: '',
      enableSorting: false,
      cell: ({ row }) => (
        <div className={styles.actionButtons}>
          <button className={styles.viewClientBtn} onClick={() => setSelectedClient(row.original)}>
            View Client
          </button>
        </div>
      ),
    },
  ], []);

  if (selectedClient) {
    return <ClientView client={selectedClient} onBack={() => setSelectedClient(null)} />;
  }

  return (
    <div className={styles.clientsContent}>
      <div className={styles.pageHeader}>
        <div>
          <h1>All Clients</h1>
          <p>View Client Details, Sessions and more...</p>
        </div>
      </div>

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
        <button className={styles.exportBtn}><img src="/Upload.svg" alt="" />Export to CSV</button>
      </div>

      <DataTable
        data={filteredClients}
        columns={columns}
        pageSize={10}
        emptyMessage="No clients found"
      />
    </div>
  );
};

export default AllClients;
