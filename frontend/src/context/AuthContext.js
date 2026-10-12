import React, { createContext, useContext, useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { authApi, setAccessToken, setRefreshToken, setOnUnauthorized, getStoredToken, setStoredToken } from '../services/api';

const AuthContext = createContext(null);

const STORAGE_KEYS = {
  USER: 'erp_user_data',
  PERMISSIONS: 'erp_permissions'
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [permissions, setPermissions] = useState([]);
  const [ready, setReady] = useState(false);
  const [sessionError, setSessionError] = useState('');
  const mounted = useRef(true);
  const restoreSession = useCallback(async () => {
    setReady(false); setSessionError('');
    try {
      if (getStoredToken('erp_access_token')) {
        const data = await authApi.me();
        if (mounted.current) { setUser(data.user); setPermissions(data.permissions || []); }
      }
    } catch (error) {
      if (!mounted.current) return;
      if ([401, 403].includes(error.response?.status)) {
        setAccessToken(null); setRefreshToken(null); setUser(null); setPermissions([]);
        setStoredToken(STORAGE_KEYS.USER, null); setStoredToken(STORAGE_KEYS.PERMISSIONS, null);
      } else setSessionError('No se pudo comprobar tu sesión. Conservamos el acceso; reintenta cuando el servidor responda.');
    } finally { if (mounted.current) setReady(true); }
  }, []);

  useEffect(() => {
    mounted.current = true;
    restoreSession();
    return () => { mounted.current = false; };
  }, [restoreSession]);

  if (typeof setOnUnauthorized === 'function') {
    setOnUnauthorized(() => {
      setUser(null);
      setSessionError('');
      setPermissions([]);
      setStoredToken(STORAGE_KEYS.USER, null);
      setStoredToken(STORAGE_KEYS.PERMISSIONS, null);
    });
  }

  const value = useMemo(() => ({
    user, permissions, ready, sessionError, retrySession: restoreSession,
    has: (p) => permissions.includes('*') || permissions.includes(p),
    refreshProfile: async () => {
      const data = await authApi.me();
      setUser(data.user); setPermissions(data.permissions || []);
      setStoredToken(STORAGE_KEYS.USER, JSON.stringify(data.user));
      setStoredToken(STORAGE_KEYS.PERMISSIONS, JSON.stringify(data.permissions || []));
    },
    login: async (email, password) => {
      const data = await authApi.login(email, password);
      setAccessToken(data.accessToken);
      setRefreshToken(data.refreshToken);
      setUser(data.user);
      setPermissions(data.permissions || []);
      setStoredToken(STORAGE_KEYS.USER, JSON.stringify(data.user));
      setStoredToken(STORAGE_KEYS.PERMISSIONS, JSON.stringify(data.permissions || []));
    },
    register: async (payload) => {
      const data = await authApi.register(payload);
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
      setSessionError('');
      setPermissions([]);
      setStoredToken(STORAGE_KEYS.USER, null);
      setStoredToken(STORAGE_KEYS.PERMISSIONS, null);
    }
  }), [user, permissions, ready, sessionError, restoreSession]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
