export const ERP_NAME = 'NexusERP';
export const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

export const MENU_BY_PERMISSION = [
  { label: 'Dashboard', route: 'dashboard', permission: null, icon: 'dashboard' },
  { label: 'CRM', route: 'crm', permission: 'crm.leads.read', icon: 'users' },
  { label: 'Productos', route: 'products', permission: 'products.read', icon: 'box' },
  { label: 'Inventario', route: 'inventory', permission: 'branches.read', icon: 'warehouse' },
  { label: 'Ventas', route: 'sales', permission: 'products.read', icon: 'shopping-cart' },
  { label: 'Compras', route: 'purchases', permission: 'products.read', icon: 'truck' },
  { label: 'Finanzas', route: 'finance', permission: 'settings.read', icon: 'dollar-sign' },
  { label: 'RRHH', route: 'hr', permission: 'users.read', icon: 'user-check' },
  { label: 'Proyectos', route: 'projects', permission: 'users.read', icon: 'briefcase' },
  { label: 'Producción', route: 'production', permission: 'products.read', icon: 'cpu' },
  { label: 'Usuarios y Roles', route: 'admin', permission: 'users.read', icon: 'shield' },
  { label: 'Auditoría', route: 'audit', permission: 'audit.read', icon: 'file-text' },
  { label: 'Asistente IA', route: 'ai', permission: 'ai.chat', icon: 'cpu' }
];
