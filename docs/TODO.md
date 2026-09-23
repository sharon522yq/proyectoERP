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
- [x] E2E Tests (Sales, Multi-tenancy, Production scenarios)
- [x] Swagger/OpenAPI documentation
- [x] Docker support
- [x] CI/CD pipeline (GitHub Actions)
- [x] Auditoría Final del sistema (`docs/FINAL_AUDIT.md`)
- [x] Enlaces Venta/Compra ↔ Inventario/Finanzas + transiciones D-007 (D-010)
- [x] Penetration testing no destructivo (`docs/PENETRATION_TEST.md`)
- [x] OWASP: cierre de hallazgos críticos (registro privilegiado, IDOR usuarios, NoSQLi, headers)
- [x] Rendimiento: benchmark real + análisis de índices (`docs/PERFORMANCE.md`)
- [x] Builds reales verificados: backend (arranque), RN Web (expo export), RN Android (bundle Hermes)
- [x] ESLint ejecutable y bloqueante en CI

## Pendiente

### FASE 12 — IA
- [ ] Asistente ERP (preguntas en lenguaje natural)
- [ ] Análisis de tendencias
- [ ] Predicciones de demanda
- [ ] Alertas inteligentes
- [ ] Backend AI service con LLM provider
- [ ] Seguridad: sin exposición de API keys

### Frontend
- [ ] React Native + React Native Web completo
- [ ] Navegación modular por módulo (hoy: solo Login ↔ Dashboard con menú estático)
- [ ] Sidebar web + navegación móvil
- [ ] Pantallas CRUD por módulo (productos, ventas, compras, inventario, finanzas, RRHH, proyectos, producción)
- [ ] Formularios con validación
- [ ] Tablas con paginación y filtros
- [ ] Estados de carga, error, vacío
- [ ] Responsive (Desktop, Laptop, Tablet, Mobile)
- [ ] Tests de frontend

### Backend (pendientes de la auditoría)
- [ ] Pagos de compra automatizados (hoy: manuales en /finance/transactions)
- [ ] DELETE/anulación en sales, purchases, hr (permisos publicados sin ruta) — decidir soft delete vs anulación
- [ ] Compresión HTTP (compression middleware)
- [ ] Saldos financieros con `$inc` atómico (P-5)
- [ ] Paginación por cursor en kardex/auditoría (P-3)
- [ ] Cobertura de tests con `--coverage`
- [ ] Swagger completo (faltan users/companies/listados)

### Performance
- [x] Benchmark real de endpoints (`docs/PERFORMANCE.md`)
- [x] Revisión de índices
- [ ] Caching layer
- [ ] Load testing con dataset grande (100k+ docs)
- [ ] Rate limiting en Redis al escalar horizontalmente

### Seguridad
- [x] Penetration testing no destructivo
- [x] OWASP checklist (A01–A07)
- [x] NoSQL injection testing
- [ ] Rate limiting por usuario
- [ ] CAPTCHA/backoff por cuenta en login

### Documentación
- [x] Guía de deployment
- [x] Architecture Decision Records (DECISIONS.md D-001..D-014)
- [x] Docs de IA (AI_ARCHITECTURE_PROPOSAL, AI_PROVIDER_DECISION, AI_SECURITY, AI_API, AI_TEST_PLAN)
- [ ] Guía de desarrollo
- [ ] Git init + remoto + commit inicial (repo aún no inicializado)

### IA (post-FASE 12)
- [ ] Configurar proveedor LLM real (AI_PROVIDER/AI_API_KEY/AI_MODEL/AI_BASE_URL + verificar precios y cuotas vigentes)
- [ ] Predicciones (subfase específica; hoy `confidence: null`)
- [ ] Tools de escritura con propuesta + confirmación humana (ETAPA 10, flujo por la API normal)
- [ ] Contadores/rate-limit de IA en Redis (multi-instancia)
- [ ] Ampliar integración progresiva (CRM/ventas/compras/inventario/finanzas/RRHH/proyectos/producción ya cubiertos en lectura; falta profundidad por módulo)
- [ ] Revisar `AI_STORE_TEXT` y política de retención legal
