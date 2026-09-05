import React, { createContext, useContext, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { io } from 'socket.io-client';
import { AuthContext } from './AuthContext'; // adjust path if needed
import { API_BASE_URL } from '../utils/api';

/**
 * Routes that must never open a socket.
 *
 * These are the pre-session pages. A stale or expired token left in
 * localStorage would otherwise make this provider dial out on /login,
 * /register and /verify-email, the handshake would be rejected, and
 * socket.io would retry on a loop behind a page where the visitor is, by
 * definition, still establishing their session. That is the pending websocket
 * visible on the verification page.
 *
 * Only the DECISION TO CONNECT is gated here. The auth handshake, room
 * joining, unread emission and notification push are untouched.
 */
const NO_SOCKET_ROUTES = ['/login', '/register', '/verify-email'];

const SocketContext = createContext(null);

export const useSocket = () => useContext(SocketContext);

export const SocketProvider = ({ children }) => {
  const { token } = useContext(AuthContext);
  const [socket, setSocket] = useState(null);
  const { pathname } = useLocation();

  const suppressed = NO_SOCKET_ROUTES.includes(pathname);

  useEffect(() => {
    if (token && !suppressed) {
      // Uses the same origin as the REST client so LAN/deployed hosts work too.
      const newSocket = io(API_BASE_URL, {
        auth: { token }
      });

      setSocket(newSocket);

      return () => newSocket.close();
    }

    setSocket(null);
    return undefined;
  }, [token, suppressed]);

  return (
    <SocketContext.Provider value={socket}>
      {children}
    </SocketContext.Provider>
  );
};
