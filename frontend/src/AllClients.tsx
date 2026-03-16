// ... imports
import React, { useState, useEffect } from 'react';
import styles from './AllClients.module.css';
import ClientView from './ClientView';
import { Search } from 'react-iconly';

interface Client {
  id: number;
  name: string;
  phone: string;
  email: string;
  sessions: string;
  revenue: string;
}

const AllClients: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  // Pagination State
  const [currentPage, setCurrentPage] = useState<number>(1);
  const itemsPerPage = 10;

  useEffect(() => {
    const fetchClients = async () => {
      try {
        const response = await fetch('http://localhost:3001/api/bookings/clients', {
          credentials: 'include'
        });
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

  // Reset page when search term changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  if (selectedClient) {
    return (
      <ClientView
        client={selectedClient}
        onBack={() => setSelectedClient(null)}
      />
    );
  }

  // Filter clients
  const filteredClients = clients.filter(client =>
    client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.phone.includes(searchTerm) ||
    client.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Pagination Logic
  const totalPages = Math.ceil(filteredClients.length / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentClients = filteredClients.slice(startIndex, startIndex + itemsPerPage);

  const handlePrevPage = () => {
    setCurrentPage((prev) => Math.max(prev - 1, 1));
  };

  const handleNextPage = () => {
    setCurrentPage((prev) => Math.min(prev + 1, totalPages));
  };

  return (
    <div className={styles.clientsContent}>
      <div className={styles.pageHeader}>
        <div>
          <h1>All Clients</h1>
          <p>View Client Details, Sessions and more...</p>
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
      </div>

      <div className={styles.tableContainer}>
        {currentClients.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#666' }}>No clients found</div>
        ) : (
          <table className={styles.clientsTable}>
            <thead>
              <tr>
                <th>Client Name</th>
                <th>Contact Info</th>
                <th>No. of Sessions</th>
                <th>Revenue</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {currentClients.map((client) => (
                <tr key={client.id}>
                  <td className={styles.clientNameCell}>
                    <div className={styles.clientName}>{client.name}</div>
                  </td>
                  <td className={styles.contactInfoCell}>
                    <div className={styles.phoneNumber}>{client.phone}</div>
                    <div className={styles.emailAddress}>{client.email}</div>
                  </td>
                  <td className={styles.sessionsCell}>
                    <span className={styles.sessionCount}>{client.sessions}</span>
                  </td>
                  <td className={styles.revenueCell}>
                    <span className={styles.revenueAmount}>{client.revenue}</span>
                  </td>
                  <td className={styles.actionCell}>
                    <div className={styles.actionButtons}>
                      <button
                        className={styles.viewClientBtn}
                        onClick={() => setSelectedClient(client)}
                      >
                        View Client
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className={styles.pagination}>
        <span>
          Showing {filteredClients.length === 0 ? 0 : startIndex + 1} to {Math.min(startIndex + itemsPerPage, filteredClients.length)} of {filteredClients.length} results
        </span>
        <div className={styles.paginationControls}>
          <img
            src="/Arrow - Left Square.svg"
            alt="Previous"
            className={`${styles.paginationBtn} ${currentPage === 1 ? styles.disabled : ''}`}
            onClick={handlePrevPage}
            role="button"
          />
          <img
            src="/Arrow - Right Square.svg"
            alt="Next"
            className={`${styles.paginationBtn} ${currentPage === totalPages ? styles.disabled : ''}`}
            onClick={handleNextPage}
            role="button"
          />
        </div>
      </div>
    </div>
  );
};

export default AllClients;