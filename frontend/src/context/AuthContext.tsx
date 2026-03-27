import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { API_URL } from '../config/api';
import Loader from '../components/Loader';

interface User {
    id: string;
    user_name: string;
    email: string;
    profile_picture: string;
    phone?: string;
    dob?: string;
    gender?: string;
    specialization?: string;
    language_spoken?: string;
    country?: string;
    state?: string;
    city?: string;
    pincode?: string;
    clinic_address?: string;
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

    const login = () => {
        setIsAuthenticated(true);
        // We could also re-check auth here to be sure
        checkAuth();
    };

    const logout = async () => {
        try {
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
