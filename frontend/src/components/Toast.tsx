import React, { useEffect } from 'react';
import styles from './Toast.module.css';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastProps {
  id: string;
  message: string;
  type: ToastType;
  onClose: (id: string) => void;
  duration?: number;
}

const Toast: React.FC<ToastProps> = ({ id, message, type, onClose, duration = 4000 }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose(id);
    }, duration);

    return () => clearTimeout(timer);
  }, [id, onClose, duration]);

  const getIcon = () => {
    switch (type) {
      case 'success':
        return (
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <circle cx="10" cy="10" r="10" fill="#10B981"/>
            <path d="M6 10L8.5 12.5L14 7" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        );
      case 'error':
        return (
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <circle cx="10" cy="10" r="10" fill="#EF4444"/>
            <path d="M7 7L13 13M13 7L7 13" stroke="white" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        );
      case 'warning':
        return (
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <circle cx="10" cy="10" r="10" fill="#F59E0B"/>
            <path d="M10 6V11M10 14V14.5" stroke="white" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        );
      case 'info':
        return (
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <circle cx="10" cy="10" r="10" fill="#3B82F6"/>
            <path d="M10 9V14M10 6V6.5" stroke="white" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        );
    }
  };

  return (
    <div className={`${styles.toast} ${styles[type]}`}>
      <div className={styles.iconContainer}>
        {getIcon()}
      </div>
      <div className={styles.message}>{message}</div>
      <button className={styles.closeButton} onClick={() => onClose(id)}>
        <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
          <path d="M1 1L13 13M13 1L1 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        </svg>
      </button>
    </div>
  );
};

export default Toast;
