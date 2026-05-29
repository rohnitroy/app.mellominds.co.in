import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';
import { API_URL } from '../config/api';
import { useAuth } from './AuthContext';

interface SocketContextType {
    socket: Socket | null;
}

const SocketContext = createContext<SocketContextType>({ socket: null });

export const SocketProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [socket, setSocket] = useState<Socket | null>(null);
    const { isAuthenticated, user } = useAuth();

    useEffect(() => {
        if (!isAuthenticated || !user?.id) return;

        const s = io(API_URL, {
            withCredentials: true,
            transports: ['websocket', 'polling'],
        });

        s.on('connect', () => {
            s.emit('join', user.id);
        });

        setSocket(s);

        return () => {
            s.disconnect();
            setSocket(null);
        };
    }, [isAuthenticated, user?.id]);

    return (
        <SocketContext.Provider value={{ socket }}>
            {children}
        </SocketContext.Provider>
    );
};

export const useSocket = () => useContext(SocketContext);
