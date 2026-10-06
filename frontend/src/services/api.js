import axios from 'axios';
import { Platform } from 'react-native';
import { API_URL } from '../constants/config';

const api = axios.create({ baseURL: API_URL, timeout: 20000 });

let accessToken = null;
let refreshTokenValue = null;
let onUnauthorized = null;
let refreshPromise = null;

// Persistencia segura en web (localStorage) o memoria
const STORAGE_KEYS = {
  ACCESS: 'erp_access_token',
  REFRESH: 'erp_refresh_token',
  USER: 'erp_user_data',
  PERMISSIONS: 'erp_permissions'
};

export function getStoredToken(key) {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
    try { return window.localStorage.getItem(key); } catch { return null; }
  }
  return null;
}

export function setStoredToken(key, value) {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
    try {
      if (value) window.localStorage.setItem(key, value);
      else window.localStorage.removeItem(key);
    } catch {}
  }
}

export function setAccessToken(t) {
  accessToken = t;
  setStoredToken(STORAGE_KEYS.ACCESS, t);
}

export function setRefreshToken(t) {
  refreshTokenValue = t;
  setStoredToken(STORAGE_KEYS.REFRESH, t);
}

export function setOnUnauthorized(fn) {
  onUnauthorized = fn;
}

// Inicializar tokens desde almacenamiento si existen
const initialAccess = getStoredToken(STORAGE_KEYS.ACCESS);
const initialRefresh = getStoredToken(STORAGE_KEYS.REFRESH);
if (initialAccess) accessToken = initialAccess;
if (initialRefresh) refreshTokenValue = initialRefresh;

api.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config;
    if (err.response && err.response.status === 401 && !original._retry && (!original.url.includes('/auth/') || original.url === '/auth/me') && refreshTokenValue) {
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
            setStoredToken(STORAGE_KEYS.USER, null);
            setStoredToken(STORAGE_KEYS.PERMISSIONS, null);
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
    if (err.response && err.response.status === 401 && onUnauthorized) {
      setAccessToken(null);
      setRefreshToken(null);
      onUnauthorized();
    }
    return Promise.reject(err);
  }
);

// --- Dominios API ---

export const authApi = {
  me: () => api.get('/auth/me').then(r => r.data.data),
  login: (email, password) => api.post('/auth/login', { email, password }).then((r) => r.data.data),
  register: (payload) => api.post('/auth/register', payload).then((r) => r.data.data),
  logout: (token) => api.post('/auth/logout', { refreshToken: token || refreshTokenValue }).then((r) => r.data),
  refresh: (token) => api.post('/auth/refresh', { refreshToken: token || refreshTokenValue }).then((r) => r.data.data),
  changePassword: (currentPassword, newPassword) => api.post('/auth/change-password', { currentPassword, newPassword }).then((r) => r.data),
  forgotPassword: (email) => api.post('/auth/forgot-password', { email }).then((r) => r.data),
  resetPassword: (token, newPassword) => api.post('/auth/reset-password', { token, newPassword }).then((r) => r.data)
};

export const dashboardApi = {
  getSummary: () => api.get('/dashboard').then((r) => r.data.data),
  getSalesSummary: () => api.get('/dashboard/sales').then((r) => r.data.data),
  getInventorySummary: () => api.get('/dashboard/inventory').then((r) => r.data.data),
  getFinanceSummary: () => api.get('/dashboard/finance').then((r) => r.data.data),
  getProductionSummary: () => api.get('/dashboard/production').then((r) => r.data.data)
};

export const crmApi = {
  getLeads: (params) => api.get('/crm/leads', { params }).then((r) => r.data.data),
  createLead: (data) => api.post('/crm/leads', data).then((r) => r.data.data),
  updateLead: (id, data) => api.put(`/crm/leads/${id}`, data).then((r) => r.data.data),
  deleteLead: (id) => api.delete(`/crm/leads/${id}`).then((r) => r.data),
  convertLead: (id) => api.post(`/crm/leads/${id}/convert`).then((r) => r.data.data),
  getCustomers: (params) => api.get('/crm/customers', { params }).then((r) => r.data.data),
  createCustomer: (data) => api.post('/crm/customers', data).then((r) => r.data.data),
  updateCustomer: (id, data) => api.put(`/crm/customers/${id}`, data).then((r) => r.data.data),
  deleteCustomer: (id) => api.delete(`/crm/customers/${id}`).then((r) => r.data),
  getContacts: (customerId) => api.get(`/crm/customers/${customerId}/contacts`).then((r) => r.data.data),
  createContact: (customerId, data) => api.post(`/crm/customers/${customerId}/contacts`, data).then((r) => r.data.data),
  getActivities: (params) => api.get('/crm/activities', { params }).then((r) => r.data.data),
  createActivity: (data) => api.post('/crm/activities', data).then((r) => r.data.data)
};

export const productsApi = {
  getCategories: () => api.get('/products/categories').then((r) => r.data.data),
  createCategory: (data) => api.post('/products/categories', data).then((r) => r.data.data),
  getProducts: (params) => api.get('/products', { params }).then((r) => r.data.data),
  getProduct: (id) => api.get(`/products/${id}`).then((r) => r.data.data),
  createProduct: (data) => api.post('/products', data).then((r) => r.data.data),
  updateProduct: (id, data) => api.put(`/products/${id}`, data).then((r) => r.data.data),
  deleteProduct: (id) => api.delete(`/products/${id}`).then((r) => r.data)
};

export const inventoryApi = {
  getWarehouses: () => api.get('/inventory/warehouses').then((r) => r.data.data),
  createWarehouse: (data) => api.post('/inventory/warehouses', data).then((r) => r.data.data),
  getStock: (params) => api.get('/inventory/stock', { params }).then((r) => r.data.data),
  adjustStock: (data) => api.post('/inventory/stock/adjust', data).then((r) => r.data.data),
  getMovements: (params) => api.get('/inventory/movements', { params }).then((r) => r.data.data),
  getKardex: (productId, warehouseId) => api.get(`/inventory/kardex/${productId}/${warehouseId}`).then((r) => r.data.data)
};

export const salesApi = {
  getQuotes: (params) => api.get('/sales/quotes', { params }).then((r) => r.data.data),
  createQuote: (data) => api.post('/sales/quotes', data).then((r) => r.data.data),
  approveQuote: (id) => api.post(`/sales/quotes/${id}/approve`).then((r) => r.data.data),
  createOrderFromQuote: (quoteId) => api.post(`/sales/quotes/${quoteId}/order`).then((r) => r.data.data),
  getOrders: (params) => api.get('/sales/orders', { params }).then((r) => r.data.data),
  updateOrderStatus: (id, status) => api.put(`/sales/orders/${id}/status`, { status }).then((r) => r.data.data),
  createInvoiceFromOrder: (orderId) => api.post(`/sales/orders/${orderId}/invoice`).then((r) => r.data.data),
  getInvoices: (params) => api.get('/sales/invoices', { params }).then((r) => r.data.data),
  createPayment: (invoiceId, data) => api.post(`/sales/invoices/${invoiceId}/payments`, data).then((r) => r.data.data),
  getPayments: () => api.get('/sales/payments').then((r) => r.data.data)
};

export const purchasesApi = {
  getPurchases: (params) => api.get('/purchases', { params }).then((r) => r.data.data),
  createPurchase: (data) => api.post('/purchases', data).then((r) => r.data.data),
  updatePurchaseStatus: (id, status) => api.put(`/purchases/${id}/status`, { status }).then((r) => r.data.data)
};

export const financeApi = {
  getSummary: () => api.get('/finance/summary').then((r) => r.data.data),
  getAccounts: () => api.get('/finance/accounts').then((r) => r.data.data),
  createAccount: (data) => api.post('/finance/accounts', data).then((r) => r.data.data),
  getAccount: (id) => api.get(`/finance/accounts/${id}`).then((r) => r.data.data),
  getTransactions: (params) => api.get('/finance/transactions', { params }).then((r) => r.data.data),
  createTransaction: (data) => api.post('/finance/transactions', data).then((r) => r.data.data)
};

export const hrApi = {
  getDepartments: () => api.get('/hr/departments').then((r) => r.data.data),
  createDepartment: (data) => api.post('/hr/departments', data).then((r) => r.data.data),
  getEmployees: (params) => api.get('/hr/employees', { params }).then((r) => r.data.data),
  getEmployee: (id) => api.get(`/hr/employees/${id}`).then((r) => r.data.data),
  createEmployee: (data) => api.post('/hr/employees', data).then((r) => r.data.data),
  updateEmployee: (id, data) => api.put(`/hr/employees/${id}`, data).then((r) => r.data.data)
};

export const projectsApi = {
  getProjects: (params) => api.get('/projects', { params }).then((r) => r.data.data),
  getProject: (id) => api.get(`/projects/${id}`).then((r) => r.data.data),
  createProject: (data) => api.post('/projects', data).then((r) => r.data.data),
  updateProject: (id, data) => api.put(`/projects/${id}`, data).then((r) => r.data.data),
  getTasks: (params) => api.get('/projects/tasks', { params }).then((r) => r.data.data),
  createTask: (data) => api.post('/projects/tasks', data).then((r) => r.data.data),
  updateTask: (id, data) => api.put(`/projects/tasks/${id}`, data).then((r) => r.data.data)
};

export const productionApi = {
  getBoms: () => api.get('/production/bom').then((r) => r.data.data),
  createBom: (data) => api.post('/production/bom', data).then((r) => r.data.data),
  getOrders: (params) => api.get('/production/orders', { params }).then((r) => r.data.data),
  createOrder: (data) => api.post('/production/orders', data).then((r) => r.data.data),
  updateOrderStatus: (id, status) => api.put(`/production/orders/${id}/status`, { status }).then((r) => r.data.data),
  consumeMaterials: (id, data) => api.post(`/production/orders/${id}/consume`, data).then((r) => r.data.data),
  completeOrder: (id, data) => api.post(`/production/orders/${id}/complete`, data).then((r) => r.data.data)
};

export const adminApi = {
  getUsers: (params) => api.get('/users', { params }).then((r) => r.data.data),
  updateUser: (id, data) => api.put(`/users/${id}`, data).then((r) => r.data.data),
  getRoles: () => api.get('/roles').then((r) => r.data.data),
  getCompanies: () => api.get('/companies').then((r) => r.data.data),
  createCompany: (data) => api.post('/companies', data).then((r) => r.data.data),
  getCompany: (id) => api.get(`/companies/${id}`).then((r) => r.data.data),
  updateCompany: (id, data) => api.put(`/companies/${id}`, data).then((r) => r.data.data),
  getBranches: () => api.get('/branches').then((r) => r.data.data),
  createBranch: (data) => api.post('/branches', data).then((r) => r.data.data),
  getBranch: (id) => api.get(`/branches/${id}`).then((r) => r.data.data),
  updateBranch: (id, data) => api.put(`/branches/${id}`, data).then((r) => r.data.data),
  getAuditLogs: (params) => api.get('/audit', { params }).then((r) => r.data.data),
  getSettings: () => api.get('/settings').then((r) => r.data.data),
  updateSettings: (data) => api.put('/settings', data).then((r) => r.data.data)
};

export const aiApi = {
  chat: (question, sessionId) => api.post('/ai/chat', { question, sessionId }).then((r) => r.data.data),
  analyze: (scope) => api.post('/ai/analyze', { scope }).then((r) => r.data.data),
  health: () => api.get('/ai/health').then((r) => r.data.data)
};

export default api;
