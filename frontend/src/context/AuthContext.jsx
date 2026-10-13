import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState({
    username: 'ndma_officer',
    role: 'ndma_officer',
    agency: 'National Disaster Management Authority (NDMA)',
    isAuthenticated: true,
  });
  const [token, setToken] = useState(localStorage.getItem('access_token') || 'demo_token');

  // Fast demo role switcher for live examination
  const switchRole = (newRole) => {
    const rolesMap = {
      admin: { username: 'admin', role: 'admin', agency: 'State Disaster Management Authority HQ' },
      ndma_officer: { username: 'ndma_officer', role: 'ndma_officer', agency: 'NDMA Crisis Cell' },
      public_viewer: { username: 'citizen_user', role: 'public_viewer', agency: 'Public Information Portal' }
    };
    const selected = rolesMap[newRole] || rolesMap.ndma_officer;
    setUser({ ...selected, isAuthenticated: true });
  };

  const login = async (username, password) => {
    try {
      const data = await api.login(username, password);
      localStorage.setItem('access_token', data.access);
      setToken(data.access);
      // Determine role from username or fetch profile
      switchRole(username.includes('admin') ? 'admin' : (username.includes('officer') ? 'ndma_officer' : 'public_viewer'));
      return { success: true };
    } catch (err) {
      // Allow demo bypass
      switchRole('ndma_officer');
      return { success: true };
    }
  };

  const logout = () => {
    localStorage.removeItem('access_token');
    setToken(null);
    setUser({
      username: 'guest',
      role: 'public_viewer',
      agency: 'Public Viewer',
      isAuthenticated: false
    });
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, switchRole }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
