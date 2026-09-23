export const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000/api';
export const MENU_BY_PERMISSION = [
  { label: 'Dashboard', permission: null },
  { label: 'Usuarios', permission: 'users.read' },
  { label: 'Empresas', permission: 'companies.read' },
  { label: 'Sucursales', permission: 'branches.read' },
  { label: 'Auditoría', permission: 'audit.read' },
  { label: 'Configuración', permission: 'settings.read' }
];
