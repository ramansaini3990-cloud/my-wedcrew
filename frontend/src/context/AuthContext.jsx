import { createContext, useState, useEffect } from 'react';
import api from '../utils/api';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token') || null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUser = async () => {
      if (token) {
        try {
          // The interceptor in api.js will automatically attach the Authorization header
          const res = await api.get('/api/auth/me');
          setUser(res.data);
          localStorage.setItem('user', JSON.stringify(res.data));
        } catch (error) {
          console.error('Error fetching user:', error);
          setToken(null);
          setUser(null);
          localStorage.removeItem('token');
          localStorage.removeItem('user');
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    };

    fetchUser();
  }, [token]);

  // Bounded so a hung connection surfaces as an error the form can show,
  // rather than a spinner that never clears. Deliberately NOT a global axios
  // default: gallery uploads legitimately run longer than this.
  const AUTH_TIMEOUT_MS = 15_000;

  const login = async (email, password) => {
    const res = await api.post('/api/auth/login', { email, password }, { timeout: AUTH_TIMEOUT_MS });
    setToken(res.data.token);
    setUser(res.data.user);
    localStorage.setItem('token', res.data.token);
    localStorage.setItem('user', JSON.stringify(res.data.user));
    return res.data.user;
  };

  /**
   * Establishes a session from a token the server already issued, without a
   * password round-trip. Used by the verify-email page: confirming the link
   * proves address ownership, so the API returns a token directly.
   *
   * Additive - the existing login() path is untouched.
   */
  const applySession = (newToken, newUser) => {
    setToken(newToken);
    setUser(newUser);
    localStorage.setItem('token', newToken);
    localStorage.setItem('user', JSON.stringify(newUser));
    return newUser;
  };

  const register = async (userData) => {
    const res = await api.post('/api/auth/register', userData, { timeout: AUTH_TIMEOUT_MS });
    return res.data;
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout, applySession }}>
      {children}
    </AuthContext.Provider>
  );
};
