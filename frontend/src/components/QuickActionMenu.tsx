import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './QuickActionMenu.module.css';
import CreateBooking from './CreateBooking';

interface QuickActionMenuProps {
  onAddClient: () => void;
}


const CalendarIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/>
    <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
  </svg>
);

const AddClientIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
    <circle cx="9" cy="7" r="4"/>
    <line x1="19" y1="8" x2="19" y2="14"/>
    <line x1="22" y1="11" x2="16" y2="11"/>
  </svg>
);

const QuickActionMenu: React.FC<QuickActionMenuProps> = ({ onAddClient }) => {
  const [open, setOpen] = useState(false);
  const [showCreateBookingModal, setShowCreateBookingModal] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const actions = [
    {
      label: 'Add Client',
      description: 'Manually add a new client to your client list',
      icon: <AddClientIcon />,
      onClick: () => { onAddClient(); setOpen(false); },
    },
    {
      label: 'Create Booking',
      description: 'Schedule a new booking with a client',
      icon: <CalendarIcon />,
      onClick: () => { setShowCreateBookingModal(true); setOpen(false); },
    },
  ];

  return (
    <div className={styles.wrapper} ref={ref}>
      <button className={styles.trigger} onClick={() => setOpen(o => !o)}>
        <span className={styles.plus}>+</span>
        Quick Action
      </button>

      {open && (
        <div className={styles.dropdown}>
          <div className={styles.dropdownHeader}>Quick Actions</div>
          {actions.map((action) => (
            <button key={action.label} className={styles.actionItem} onClick={action.onClick}>
              <span className={styles.actionIcon}>{action.icon}</span>
              <span className={styles.actionText}>
                <span className={styles.actionLabel}>{action.label}</span>
                <span className={styles.actionDesc}>{action.description}</span>
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Create Booking Modal */}
      {showCreateBookingModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
          zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '24px'
        }} onClick={() => setShowCreateBookingModal(false)}>
          <div style={{
            background: '#fff', borderRadius: '16px', width: '100%', maxWidth: '700px',
            maxHeight: '90vh', overflowY: 'auto', position: 'relative'
          }} onClick={e => e.stopPropagation()}>
            <button onClick={() => setShowCreateBookingModal(false)} style={{
              position: 'absolute', top: '16px', right: '16px', background: 'none',
              border: 'none', fontSize: '22px', cursor: 'pointer', color: '#666', zIndex: 1
            }}>×</button>
            <CreateBooking onBack={() => setShowCreateBookingModal(false)} />
          </div>
        </div>
      )}
    </div>
  );
};

export default QuickActionMenu;
