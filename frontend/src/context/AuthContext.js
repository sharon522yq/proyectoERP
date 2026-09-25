import React, { createContext, useContext, useMemo, useState, useEffect } from 'react';
import { authApi, setAccessToken, setRefreshToken, setOnUnauthorized, getStoredToken, setStoredToken } from '../services/api';

const AuthContext = createContext(null);

const STORAGE_KEYS = {
  USER: 'erp_user_data',
  PERMISSIONS: 'erp_permissions'
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [permissions, setPermissions] = useState([]);

  useEffect(() => {
    // Restaurar usuario guardado si existe token de acceso
    const access = getStoredToken('erp_access_token');
    if (access) {
      try {
        const savedUser = getStoredToken(STORAGE_KEYS.USER);
        const savedPerms = getStoredToken(STORAGE_KEYS.PERMISSIONS);
        if (savedUser) setUser(JSON.parse(savedUser));
        if (savedPerms) setPermissions(JSON.parse(savedPerms));
      } catch {}
    }
  }, []);

  if (typeof setOnUnauthorized === 'function') {
    setOnUnauthorized(() => {
      setUser(null);
      setPermissions([]);
      setStoredToken(STORAGE_KEYS.USER, null);
      setStoredToken(STORAGE_KEYS.PERMISSIONS, null);
    });
  }

  const value = useMemo(() => ({
    user, permissions,
    has: (p) => permissions.includes('*') || permissions.includes(p),
    login: async (email, password) => {
      const data = await authApi.login(email, password);
      setAccessToken(data.accessToken);
      setRefreshToken(data.refreshToken);
      setUser(data.user);
      setPermissions(data.permissions || []);
      setStoredToken(STORAGE_KEYS.USER, JSON.stringify(data.user));
      setStoredToken(STORAGE_KEYS.PERMISSIONS, JSON.stringify(data.permissions || []));
    },
    logout: async () => {
      try { await authApi.logout(); } catch {}
      setAccessToken(null);
      setRefreshToken(null);
      setUser(null);
      setPermissions([]);
      setStoredToken(STORAGE_KEYS.USER, null);
      setStoredToken(STORAGE_KEYS.PERMISSIONS, null);
    }
  }), [user, permissions]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
