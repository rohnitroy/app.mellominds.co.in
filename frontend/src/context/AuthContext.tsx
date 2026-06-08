import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { API_URL } from '../config/api';
import Loader from '../components/Loader';

interface User {
    id: string;
    user_name: string;
    email: string;
    profile_picture: string;
    phone?: string;
    date_of_birth?: string;
    gender?: string;
    specialization?: string;
    specializations?: string[];
    language_spoken?: string[];
    country?: string;
    state?: string;
    city?: string;
    pincode?: string;
    clinic_address?: string;
    plan_name?: 'free' | 'team';
    profile_slug?: string | null;
    org_role?: 'owner' | 'member' | null;
    org_owner_id?: number | null;
    profileComplete?: boolean;
    used_seats?: number;
    purchased_seats?: number;
}

interface AuthContextType {
    isAuthenticated: boolean;
    user: User | null;
    login: () => void;
    logout: () => void;
    checkAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [sessionStartTime, setSessionStartTime] = useState<number | null>(null);

    const checkAuth = async () => {
        try {
            const response = await fetch(`${API_URL}/auth/me`, {
                credentials: 'include', // Send cookies
            });
            if (response.ok) {
                const data = await response.json();
                setIsAuthenticated(true);
                setUser(data.user || null);
            } else {
                setIsAuthenticated(false);
                setUser(null);
            }
        } catch (error) {
            console.error('Auth check failed:', error);
            setIsAuthenticated(false);
            setUser(null);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        checkAuth();
    }, []);

    useEffect(() => {
        const handleBeforeUnload = async () => {
            if (sessionId && isAuthenticated) {
                await endSession();
            }
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [sessionId, isAuthenticated]);

    const startSession = async () => {
        try {
            const response = await fetch(`${API_URL}/sessions/start`, {
                method: 'POST',
                credentials: 'include',
            });
            if (response.ok) {
                const data = await response.json();
                setSessionId(data.sessionId);
                setSessionStartTime(Date.now());
            }
        } catch (error) {
            console.error('Session start failed:', error);
        }
    };

    const endSession = async () => {
        if (!sessionId || !sessionStartTime) return;

        try {
            const durationMinutes = Math.round((Date.now() - sessionStartTime) / 60000);
            await fetch(`${API_URL}/sessions/end`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId, durationMinutes }),
            });
        } catch (error) {
            console.error('Session end failed:', error);
        } finally {
            setSessionId(null);
            setSessionStartTime(null);
        }
    };

    const login = async () => {
        setIsAuthenticated(true);
        await checkAuth();
        await startSession();
    };

    const logout = async () => {
        try {
            await endSession();
            await fetch(`${API_URL}/auth/logout`, {
                method: 'POST',
                credentials: 'include',
            });
            setIsAuthenticated(false);
            setUser(null);
        } catch (error) {
            console.error('Logout failed:', error);
        }
    };

    if (loading) {
        return <Loader fullScreen text="Loading..." />;
    }

    return (
        <AuthContext.Provider value={{ isAuthenticated, user, login, logout, checkAuth }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
