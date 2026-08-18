import React, { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { AuthContext } from './AuthContext'; // adjust path if needed
import { API_BASE_URL } from '../utils/api';

const SocketContext = createContext(null);

export const useSocket = () => useContext(SocketContext);

export const SocketProvider = ({ children }) => {
  const { token } = useContext(AuthContext);
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    if (token) {
      // Uses the same origin as the REST client so LAN/deployed hosts work too.
      const newSocket = io(API_BASE_URL, {
        auth: { token }
      });

      setSocket(newSocket);

      return () => newSocket.close();
    }

    setSocket(null);
  }, [token]);

  return (
    <SocketContext.Provider value={socket}>
      {children}
    </SocketContext.Provider>
  );
};
