import axios from 'axios';
import { API_URL } from '../constants/config';

const api = axios.create({ baseURL: API_URL, timeout: 15000 });
let accessToken = null;
let refreshTokenValue = null;
let onUnauthorized = null;
let refreshPromise = null;

export function setAccessToken(t) { accessToken = t; }
export function setRefreshToken(t) { refreshTokenValue = t; }
export function setOnUnauthorized(fn) { onUnauthorized = fn; }

api.interceptors.request.use((config) => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config;
    // Si 401 y no es petición de refresh y tenemos refresh token → intentar refrescar
    if (err.response && err.response.status === 401 && !original._retry && !original.url.includes('/auth/') && refreshTokenValue) {
      original._retry = true;
      if (!refreshPromise) {
        refreshPromise = axios.post(`${API_URL}/auth/refresh`, { refreshToken: refreshTokenValue })
          .then((r) => {
            const { accessToken: newAccess, refreshToken: newRefresh } = r.data.data;
            setAccessToken(newAccess);
            setRefreshToken(newRefresh);
            return newAccess;
          })
          .catch(() => {
            setAccessToken(null);
            setRefreshToken(null);
            if (onUnauthorized) onUnauthorized();
            return null;
          })
          .finally(() => { refreshPromise = null; });
      }
      const newToken = await refreshPromise;
      if (newToken) {
        original.headers.Authorization = `Bearer ${newToken}`;
        return api(original);
      }
    }
    if (err.response && err.response.status === 401 && onUnauthorized) onUnauthorized();
    return Promise.reject(err);
  }
);

export const authApi = {
  login: (email, password) => api.post('/auth/login', { email, password }).then((r) => r.data.data),
  logout: (refreshToken) => api.post('/auth/logout', { refreshToken }).then((r) => r.data)
};

// FASE 12 — Módulo IA (las claves del proveedor viven SOLO en el backend)
export const aiApi = {
  chat: (question, sessionId) => api.post('/ai/chat', { question, sessionId }).then((r) => r.data.data),
  analyze: (scope) => api.post('/ai/analyze', { scope }).then((r) => r.data.data),
  health: () => api.get('/ai/health').then((r) => r.data.data)
};

export default api;
