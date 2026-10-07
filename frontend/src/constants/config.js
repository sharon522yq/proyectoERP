export const ERP_NAME = 'NexusERP';
const PRODUCTION_API_URL = 'https://proyectoerp-api.onrender.com/api/v1';

// EXPO_PUBLIC_API_URL debe configurarse en Cloudflare/EAS para despliegues controlados.
// El fallback de producción evita que una build publicada intente conectarse a localhost.
export const API_URL = process.env.EXPO_PUBLIC_API_URL || PRODUCTION_API_URL;
if (API_URL !== PRODUCTION_API_URL) throw new Error('EXPO_PUBLIC_API_URL debe apuntar a la API de Render');

export const MENU_BY_PERMISSION = [
  { label: 'Dashboard', route: 'dashboard', permission: null, icon: 'dashboard' },
  { label: 'CRM', route: 'crm', permission: 'crm.leads.read', icon: 'users' },
  { label: 'Productos', route: 'products', permission: 'products.read', icon: 'box' },
  { label: 'Inventario', route: 'inventory', permission: 'inventory.read', icon: 'warehouse' },
  { label: 'Ventas', route: 'sales', permission: 'sales.quotes.read', icon: 'shopping-cart' },
  { label: 'Compras', route: 'purchases', permission: 'purchases.read', icon: 'truck' },
  { label: 'Finanzas', route: 'finance', permission: 'finance.accounts.read', icon: 'dollar-sign' },
  { label: 'RRHH', route: 'hr', permission: 'hr.employees.read', icon: 'user-check' },
  { label: 'Proyectos', route: 'projects', permission: 'projects.read', icon: 'briefcase' },
  { label: 'Producción', route: 'production', permission: 'production.orders.read', icon: 'cpu' },
  { label: 'Usuarios y Roles', route: 'admin', permission: 'users.read', icon: 'shield' },
  { label: 'Configuración', route: 'settings', permission: 'settings.read', icon: 'settings' },
  { label: 'Auditoría', route: 'audit', permission: 'audit.read', icon: 'file-text' },
  { label: 'Asistente IA', route: 'ai', permission: 'ai.chat', icon: 'cpu' }
];
