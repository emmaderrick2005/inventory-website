import { createContext, useContext, useEffect, useState } from 'react';
import { api } from './api.js';

const AuthContext = createContext(null);

export const ROLE_LABELS = {
  admin: 'Administrator',
  senior: 'Senior technician',
  reception: 'Receptionist',
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  // restore session from a stored token
  useEffect(() => {
    const token = localStorage.getItem('oas_token');
    if (!token) {
      setReady(true);
      return;
    }
    api
      .get('/auth/me')
      .then(setUser)
      .catch(() => localStorage.removeItem('oas_token'))
      .finally(() => setReady(true));
  }, []);

  // the api dispatches this whenever a request comes back 401
  useEffect(() => {
    const onUnauthorized = () => setUser(null);
    window.addEventListener('oas:unauthorized', onUnauthorized);
    return () => window.removeEventListener('oas:unauthorized', onUnauthorized);
  }, []);

  const login = async (email, password) => {
    const result = await api.post('/auth/login', { email, password });
    localStorage.setItem('oas_token', result.token);
    setUser(result.user);
    return result.user;
  };

  const logout = () => {
    localStorage.removeItem('oas_token');
    setUser(null);
  };

  const value = {
    user,
    ready,
    login,
    logout,
    isAdmin: user?.role === 'admin',
    isStaff: user?.role === 'admin' || user?.role === 'senior',
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
