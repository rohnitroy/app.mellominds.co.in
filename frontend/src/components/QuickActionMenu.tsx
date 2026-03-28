import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './QuickActionMenu.module.css';

interface QuickActionMenuProps {
  onCreateBooking: () => void;
  onSendBookingLink: () => void;
  onAddClient: () => void;
}

const CalendarIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/>
    <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
  </svg>
);

const BookingIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
  </svg>
);

const LinkIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
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

const QuickActionMenu: React.FC<QuickActionMenuProps> = ({ onCreateBooking, onSendBookingLink, onAddClient }) => {
  const [open, setOpen] = useState(false);
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
      label: 'Create Calendar',
      description: 'Add new resource and connect it with your calendar',
      icon: <CalendarIcon />,
      onClick: () => { navigate('/my-calendar?openModal=true'); setOpen(false); },
    },
    {
      label: 'Create a Booking',
      description: 'Schedule a session for your client manually',
      icon: <BookingIcon />,
      onClick: () => { onCreateBooking(); setOpen(false); },
    },
    {
      label: 'Send Booking Link',
      description: 'Share booking link to client to schedule a session',
      icon: <LinkIcon />,
      onClick: () => { onSendBookingLink(); setOpen(false); },
    },
    {
      label: 'Add Client',
      description: 'Manually add a new client to your client list',
      icon: <AddClientIcon />,
      onClick: () => { onAddClient(); setOpen(false); },
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
    </div>
  );
};

export default QuickActionMenu;
