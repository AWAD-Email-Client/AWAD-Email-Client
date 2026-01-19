import React, { createContext, useContext, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from '../hooks/useAuth';
import { getAccessToken } from '../api/axios';
import { API_URL } from '../config';

interface SocketContextType {
  socket: Socket | null;
}

const SocketContext = createContext<SocketContextType>({ socket: null });

export const useSocket = () => useContext(SocketContext);

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    if (isAuthenticated) {
      const token = getAccessToken();
      
      const apiUrl: string = API_URL || 'http://localhost:5000/api';
      // Handle both absolute URLs (http://...) and relative URLs (/api)
      let socketUrl: string;
      if (apiUrl.startsWith('http')) {
        // Absolute URL: http://localhost:5000/api -> http://localhost:5000
        socketUrl = apiUrl.replace('/api', '');
      } else {
        // Relative URL: /api -> / (same origin)
        socketUrl = '/';
      }

      const newSocket = io(socketUrl, {
        path: '/ws',
        auth: {
          token: token
        }
      });

      setSocket(newSocket);

      return () => {
        newSocket.close();
      };
    } else {
      if (socket) {
        socket.close();
        setSocket(null);
      }
    }
  }, [isAuthenticated]);

  return (
    <SocketContext.Provider value={{ socket }}>
      {children}
    </SocketContext.Provider>
  );
};
