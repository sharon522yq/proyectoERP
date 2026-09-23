import React, { createContext, useContext, useMemo, useState } from 'react';
import { authApi, setAccessToken, setRefreshToken, setOnUnauthorized } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [permissions, setPermissions] = useState([]);

  // Configurar callback de logout automático (solo una vez)
  if (typeof setOnUnauthorized === 'function') {
    setOnUnauthorized(() => { setUser(null); setPermissions([]); });
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
    },
    logout: async () => {
      // Intentar logout en el servidor (no bloquea si falla)
      try { await authApi.logout(); } catch {}
      setAccessToken(null);
      setRefreshToken(null);
      setUser(null);
      setPermissions([]);
    }
  }), [user, permissions]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
