// Catálogo versionado de permisos (v4 — FASE 12: permisos de IA)
const PERMISSIONS = [
  // Users
  'users.read', 'users.create', 'users.update', 'users.delete',
  // Roles
  'roles.read',
  // Companies
  'companies.read', 'companies.create', 'companies.update',
  // Branches
  'branches.read', 'branches.create', 'branches.update',
  // Audit
  'audit.read',
  // Settings
  'settings.read', 'settings.update',
  // CRM
  'crm.leads.read', 'crm.leads.create', 'crm.leads.update', 'crm.leads.delete',
  'crm.customers.read', 'crm.customers.create', 'crm.customers.update', 'crm.customers.delete',
  'crm.contacts.read', 'crm.contacts.create', 'crm.contacts.update', 'crm.contacts.delete',
  'crm.activities.read', 'crm.activities.create', 'crm.activities.update', 'crm.activities.delete',
  // Products
  'products.read', 'products.create', 'products.update', 'products.delete',
  'categories.read', 'categories.create', 'categories.update', 'categories.delete',
  'units.read',
  // Inventory
  'inventory.read', 'inventory.adjust', 'inventory.movements',
  // Sales
  'sales.quotes.read', 'sales.quotes.create', 'sales.quotes.update', 'sales.quotes.delete', 'sales.quotes.approve',
  'sales.orders.read', 'sales.orders.create', 'sales.orders.update', 'sales.orders.delete',
  'sales.invoices.read', 'sales.invoices.create', 'sales.invoices.update', 'sales.invoices.delete',
  'sales.payments.read', 'sales.payments.create',
  // Purchases
  'purchases.read', 'purchases.create', 'purchases.update', 'purchases.delete',
  // Finance
  'finance.accounts.read', 'finance.accounts.create', 'finance.accounts.update',
  'finance.transactions.read', 'finance.transactions.create',
  // HR
  'hr.departments.read', 'hr.departments.create', 'hr.departments.update',
  'hr.employees.read', 'hr.employees.create', 'hr.employees.update', 'hr.employees.delete',
  // Projects
  'projects.read', 'projects.create', 'projects.update', 'projects.delete',
  'projects.tasks.read', 'projects.tasks.create', 'projects.tasks.update', 'projects.tasks.delete',
  // Production
  'production.bom.read', 'production.bom.create', 'production.bom.update',
  'production.orders.read', 'production.orders.create', 'production.orders.update',
  'production.work_orders.read', 'production.work_orders.create', 'production.work_orders.update',
  // AI (FASE 12) — la IA solo responde con datos a los que el usuario ya puede acceder
  'ai.read', 'ai.chat', 'ai.analyze',
];

const ROLE_SEEDS = [
  { name: 'SUPER_ADMIN', permissions: ['*'] },
  { name: 'ADMIN', permissions: PERMISSIONS },
  {
    name: 'GERENTE',
    permissions: [
      'users.read', 'companies.read', 'branches.read', 'audit.read', 'settings.read',
      'crm.leads.read', 'crm.customers.read', 'crm.contacts.read', 'crm.activities.read',
      'products.read', 'categories.read', 'inventory.read',
      'sales.quotes.read', 'sales.orders.read', 'sales.invoices.read', 'sales.payments.read',
      'purchases.read', 'finance.accounts.read', 'finance.transactions.read',
      'hr.departments.read', 'hr.employees.read',
      'projects.read', 'projects.tasks.read',
      'ai.read', 'ai.chat', 'ai.analyze',
    ]
  },
  {
    name: 'FINANZAS',
    permissions: [
      'settings.read', 'crm.customers.read',
      'sales.invoices.read', 'sales.payments.read', 'sales.payments.create',
      'purchases.read',
      'finance.accounts.read', 'finance.accounts.create', 'finance.accounts.update',
      'finance.transactions.read', 'finance.transactions.create',
    ]
  },
  {
    name: 'VENTAS',
    permissions: [
      'companies.read', 'branches.read',
      'crm.leads.read', 'crm.leads.create', 'crm.leads.update',
      'crm.customers.read', 'crm.customers.create', 'crm.customers.update',
      'crm.contacts.read', 'crm.contacts.create', 'crm.contacts.update',
      'crm.activities.read', 'crm.activities.create', 'crm.activities.update',
      'products.read', 'categories.read',
      'sales.quotes.read', 'sales.quotes.create', 'sales.quotes.update', 'sales.quotes.approve',
      'sales.orders.read', 'sales.orders.create', 'sales.orders.update',
      'sales.invoices.read', 'sales.invoices.create',
      'sales.payments.read', 'sales.payments.create',
    ]
  },
  {
    name: 'COMPRAS',
    permissions: [
      'companies.read', 'branches.read',
      'products.read', 'categories.read', 'inventory.read',
      'purchases.read', 'purchases.create', 'purchases.update',
      'finance.accounts.read',
    ]
  },
  {
    name: 'ALMACEN',
    permissions: [
      'branches.read', 'products.read', 'categories.read',
      'inventory.read', 'inventory.adjust', 'inventory.movements',
    ]
  },
  {
    name: 'RRHH',
    permissions: [
      'users.read',
      'hr.departments.read', 'hr.departments.create', 'hr.departments.update',
      'hr.employees.read', 'hr.employees.create', 'hr.employees.update',
    ]
  },
  {
    name: 'PRODUCCION',
    permissions: [
      'branches.read', 'products.read', 'categories.read',
      'inventory.read',
      'production.bom.read', 'production.bom.create', 'production.bom.update',
      'production.orders.read', 'production.orders.create', 'production.orders.update',
      'production.work_orders.read', 'production.work_orders.create', 'production.work_orders.update',
    ]
  },
  { name: 'EMPLEADO', permissions: [] }
];

module.exports = { PERMISSIONS, ROLE_SEEDS };
