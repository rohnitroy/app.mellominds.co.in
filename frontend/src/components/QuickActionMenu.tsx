import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './QuickActionMenu.module.css';

interface QuickActionMenuProps {
  onCreateBooking: () => void;
  onSendBookingLink: () => void;
}

const QuickActionMenu: React.FC<QuickActionMenuProps> = ({ onCreateBooking, onSendBookingLink }) => {
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
      label: 'Create Resources',
      description: 'Add new resource and connect it with your calendar',
      icon: '🗓️',
      onClick: () => { navigate('/calendars/new'); setOpen(false); },
    },
    {
      label: 'Create a Booking',
      description: 'Schedule a session for your client manually',
      icon: '📅',
      onClick: () => { onCreateBooking(); setOpen(false); },
    },
    {
      label: 'Send Booking Link',
      description: 'Share booking link to client to schedule a session',
      icon: '🔗',
      onClick: () => { onSendBookingLink(); setOpen(false); },
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
