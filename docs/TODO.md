# TODO

## Completado

- [x] FASE 1: Core (Auth, Users, Roles, Companies, Branches, Audit, Settings)
- [x] FASE 2: CRM (Leads, Customers, Contacts, Activities)
- [x] FASE 3: Products (Categories, Products, Units)
- [x] FASE 4: Inventory (Warehouses, Stock, Movements, Kardex)
- [x] FASE 5: Sales (Quotes, Orders, Invoices, Payments)
- [x] FASE 6: Purchases (Purchase Orders)
- [x] FASE 7: Finance (Accounts, Transactions, Summary)
- [x] FASE 8: HR (Departments, Employees)
- [x] FASE 9: Projects (Projects, Tasks)
- [x] FASE 10: Production (BOM, Production Orders, Work Orders, Material Consumption)
- [x] FASE 11: Dashboard (Sales, Inventory, Finance, Production, CRM, HR summaries)
- [x] FASE 12: IA (Asistente ERP, análisis, health, tools, seguridad, auditoría)
- [x] **Frontend UI Implementation (FASE UI-0 a UI-7)**:
  - Isotipo lineal azul de nodos conectados (`AppLogo`, `AppWordmark`)
  - Sistema de tokens y tema (`colors.js`, `typography.js`, `spacing.js`, `shadows.js`, `tokens.js`)
  - Shell principal (`AppShell`, `Sidebar`, `TopBar`, `MobileDrawer`, `PageHeader`, `PermissionGate`)
  - Componentes de datos y feedback (`MetricCard`, `ModuleCard`, `StatusBadge`, `EmptyState`, `ErrorState`, `LoadingSkeleton`)
  - Clientes API granulares por dominio (`authApi`, `dashboardApi`, `crmApi`, `productsApi`, `inventoryApi`, `salesApi`, `purchasesApi`, `financeApi`, `hrApi`, `projectsApi`, `productionApi`, `adminApi`, `aiApi`)
  - Pantallas funcionales por módulo: Login, Dashboard, CRM, Productos, Inventario, Ventas, Compras, Finanzas, RRHH, Proyectos, Producción, Administración, Auditoría e IA
  - Persistencia de sesión segura (Web `localStorage` + RN)
  - Compilación y exportación web verificada (`dist`)
- [x] E2E Tests (Sales, Multi-tenancy, Production scenarios)
- [x] Swagger/OpenAPI documentation
- [x] Docker support
- [x] CI/CD pipeline (GitHub Actions)
- [x] Auditoría Final del sistema (`docs/FINAL_AUDIT.md`)
- [x] Penetration testing no destructivo (`docs/PENETRATION_TEST.md`)
- [x] Benchmark real de rendimiento (`docs/PERFORMANCE.md`)

## Pendiente

- [ ] Configurar proveedor LLM real de producción (env + verificación de cuotas)
- [ ] Load testing con dataset masivo (100k+ docs)
- [ ] Rate limiting en Redis al escalar horizontalmente
