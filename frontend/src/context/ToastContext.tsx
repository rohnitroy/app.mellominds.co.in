import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { ToastMessage } from '../components/ToastContainer';

interface ToastContextType {
  toasts: ToastMessage[];
  showToast: (message: string, type: 'success' | 'error' | 'warning' | 'info', duration?: number) => void;
  removeToast: (id: string) => void;
  success: (message: string, duration?: number) => void;
  error: (message: string, duration?: number) => void;
  warning: (message: string, duration?: number) => void;
  info: (message: string, duration?: number) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

// Deduplication: track recent toasts to prevent duplicates
const DEDUP_WINDOW = 500; // 500ms window to consider toasts as duplicates
const recentToastsRef = { messages: new Map<string, number>() };

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const toastTimeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  const removeToast = useCallback((id: string) => {
    // Clear any pending timeout for this toast
    const timeout = toastTimeoutsRef.current.get(id);
    if (timeout) {
      clearTimeout(timeout);
      toastTimeoutsRef.current.delete(id);
    }
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'warning' | 'info', duration = 4000) => {
    // Check if this exact message was shown recently (deduplication)
    const key = `${type}:${message}`;
    const lastShownTime = recentToastsRef.messages.get(key);
    const now = Date.now();

    if (lastShownTime && now - lastShownTime < DEDUP_WINDOW) {
      // Skip duplicate toast
      return;
    }

    // Record this toast as shown
    recentToastsRef.messages.set(key, now);

    // Clean up old entries after 1 second
    setTimeout(() => {
      recentToastsRef.messages.delete(key);
    }, 1000);

    const id = Date.now().toString() + Math.random();
    const newToast: ToastMessage = { id, message, type };
    
    setToasts((prev) => [...prev, newToast]);

    if (duration > 0) {
      const timeout = setTimeout(() => {
        removeToast(id);
      }, duration);
      toastTimeoutsRef.current.set(id, timeout);
    }
  }, [removeToast]);

  const success = useCallback((message: string, duration?: number) => {
    showToast(message, 'success', duration);
  }, [showToast]);

  const error = useCallback((message: string, duration?: number) => {
    showToast(message, 'error', duration);
  }, [showToast]);

  const warning = useCallback((message: string, duration?: number) => {
    showToast(message, 'warning', duration);
  }, [showToast]);

  const info = useCallback((message: string, duration?: number) => {
    showToast(message, 'info', duration);
  }, [showToast]);

  return (
    <ToastContext.Provider value={{ toasts, showToast, removeToast, success, error, warning, info }}>
      {children}
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
};
