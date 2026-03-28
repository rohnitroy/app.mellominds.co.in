import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { API_URL } from '../config/api';
import { useAuth } from './AuthContext';

interface Notification {
    id: number;
    type: string;
    title: string;
    description: string;
    is_read: boolean;
    related_id: number | null;
    created_at: string;
}

interface NotificationContextType {
    notifications: Notification[];
    unreadCount: number;
    fetchNotifications: () => Promise<void>;
    refresh: () => Promise<void>;
    markAsRead: (id: number) => Promise<void>;
    markAllAsRead: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const { isAuthenticated } = useAuth();

    const fetchNotifications = useCallback(async () => {
        if (!isAuthenticated) return;
        try {
            const res = await fetch(`${API_URL}/api/notifications`, { credentials: 'include' });
            if (res.ok) {
                const data = await res.json();
                setNotifications(data);
                setUnreadCount(data.filter((n: Notification) => !n.is_read).length);
            }
        } catch (err) {
            console.error('Failed to fetch notifications:', err);
        }
    }, [isAuthenticated]);

    const markAsRead = async (id: number) => {
        try {
            await fetch(`${API_URL}/api/notifications/${id}/read`, { method: 'PUT', credentials: 'include' });
            setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
            setUnreadCount(prev => Math.max(0, prev - 1));
        } catch (err) {
            console.error('Failed to mark notification as read:', err);
        }
    };

    const markAllAsRead = async () => {
        try {
            await fetch(`${API_URL}/api/notifications/read-all`, { method: 'PUT', credentials: 'include' });
            setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
            setUnreadCount(0);
        } catch (err) {
            console.error('Failed to mark all as read:', err);
        }
    };

    // Initial fetch + poll every 30s
    useEffect(() => {
        if (!isAuthenticated) return;
        fetchNotifications();
        const interval = setInterval(fetchNotifications, 30000);
        return () => clearInterval(interval);
    }, [isAuthenticated, fetchNotifications]);

    return (
        <NotificationContext.Provider value={{ notifications, unreadCount, fetchNotifications, refresh: fetchNotifications, markAsRead, markAllAsRead }}>
            {children}
        </NotificationContext.Provider>
    );
};

export const useNotifications = () => {
    const ctx = useContext(NotificationContext);
    if (!ctx) throw new Error('useNotifications must be used within NotificationProvider');
    return ctx;
};
