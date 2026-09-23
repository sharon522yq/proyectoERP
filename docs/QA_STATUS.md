# QA STATUS

Última actualización: 2026-09-22

## Tests ejecutados

| Suite | Tests | Estado | Tiempo |
|---|---|---|---|
| core.test.js | 8 | ✅ PASS | ~7s |
| refresh.test.js | 1 | ✅ PASS | ~2s |
| crm-products.test.js | 19 | ✅ PASS | ~7s |
| inventory-sales.test.js | 15 | ✅ PASS | ~8s |
| purchases.test.js | 3 | ✅ PASS | ~7s |
| finance-hr.test.js | 8 | ✅ PASS | ~7s |
| projects.test.js | 7 | ✅ PASS | ~7s |
| production.test.js | 19 | ✅ PASS | ~7s |
| dashboard.test.js | 8 | ✅ PASS | ~6s |
| e2e.test.js | 31 | ✅ PASS | ~6s |
| audit-integration.test.js | 18 | ✅ PASS | ~6s |
| security.test.js | 10 | ✅ PASS | ~7s |
| **Total** | **147** | **✅ ALL PASS** | **~57s** |

## Cobertura por módulo

| Módulo | Tests | Cobertura |
|---|---|---|
| Auth | 4 | ✅ Login, registro, refresh, reuse |
| Users | 1 | ✅ RBAC 403 |
| Companies | 2 | ✅ CRUD |
| Branches | 1 | ✅ Multiempresa 403 |
| Audit | 1 | ✅ Log en create |
| CRM Leads | 6 | ✅ CRUD + conversión |
| CRM Customers | 4 | ✅ CRUD + contacts |
| CRM Activities | 2 | ✅ Crear + listar |
| Products | 4 | ✅ CRUD + búsqueda + SKU duplicado |
| Categories | 2 | ✅ Crear + listar |
| Inventory | 7 | ✅ Almacenes, stock, movimientos, kardex |
| Sales | 8 | ✅ Quote → Order → Invoice → Payment |
| Purchases | 3 | ✅ Crear, listar, estado |
| Finance | 4 | ✅ Cuentas, transacciones, resumen |
| HR | 4 | ✅ Departamentos, empleados |
| Projects | 6 | ✅ Proyectos, tareas, estados |
| Production BOM | 3 | ✅ Crear, listar, obtener |
| Production Orders | 7 | ✅ CRUD + transiciones de estado |
| Production Work Orders | 4 | ✅ Crear + transiciones |
| Production Consumption | 4 | ✅ Consumo + inventario + completar |
| Dashboard | 7 | ✅ Todos los resúmenes + reportes |
| E2E Sales | 12 | ✅ Flujo completo de venta |
| E2E Multi-tenancy | 3 | ✅ Aislamiento entre empresas |
| E2E Production | 11 | ✅ Flujo completo de producción |
| E2E Dashboard | 1 | ✅ Dashboard con datos reales |

## Pruebas de seguridad

| Prueba | Estado |
|---|---|
| Login inválido → 401 | ✅ PASS |
| Sin permiso → 403 | ✅ PASS |
| Cross-company → 403 | ✅ PASS |
| Refresh reuse → 401 | ✅ PASS |
| Sin token CRM → 401 | ✅ PASS |
| Sin token Inventory → 401 | ✅ PASS |
| Sin token Purchases → 401 | ✅ PASS |
| Sin token Projects → 401 | ✅ PASS |
| Sin token Production → 401 | ✅ PASS |
| Sin token Dashboard → 401 | ✅ PASS |

### Auditoría Final — pen testing no destructivo (`security.test.js`)

| Prueba | Estado |
|---|---|
| Headers Helmet + sin X-Powered-By | ✅ PASS |
| Sin token / token malformado / token falsificado → 401 | ✅ PASS |
| Refresh token como access token → 401 | ✅ PASS |
| Inyección NoSQL en query (`limit[$gt]`, `page[$ne]`, `companyId[$ne]`) | ✅ PASS |
| `page/limit` no numéricos sin 500 | ✅ PASS |
| Operadores de filtro en body no persisten | ✅ PASS |
| CORS: origen evil sin ACAO | ✅ PASS |
| Rate limit login → 429 con `RATE_LIMIT` | ✅ PASS |

### Auditoría Final — integración y multiempresa (`audit-integration.test.js`)

| Prueba | Estado |
|---|---|
| Confirmar venta descuenta stock (SALE_EXIT + referencia) | ✅ PASS |
| Transiciones inválidas (reconfirmar/cancelar/recepción repetida) → 400 | ✅ PASS |
| Stock insuficiente bloquea confirmación sin salidas parciales | ✅ PASS |
| Factura genera CxC; pago acredita caja y reduce CxC | ✅ PASS |
| Recibir compra da de alta stock y reconoce CxP | ✅ PASS |
| Proveedor/producto de otra empresa → 404 | ✅ PASS |
| Registro sin privilegios no fija role/companyId | ✅ PASS |
| IDOR: B no accede a productos/pedidos/compras/stock/finanzas/usuarios de A (7 tests) | ✅ PASS |

## Bugs encontrados y corregidos

| # | Bug | Severidad | Estado |
|---|---|---|---|
| 1 | product.price era String en vez de Number | CRÍTICA | ✅ Corregido |
| 2 | Stock insuficiente nunca se detectaba (Math.max silencioso) | ALTA | ✅ Corregido |
| 3 | Permisos faltantes para Sales/Purchases/Finance/HR/Projects | ALTA | ✅ Corregido |
| 4 | ROLE_SEEDS sin permisos módulos Fase 2-9 | MEDIA | ✅ Corregido |
| 5 | previousStock no definido en inventory service | ALTA | ✅ Corregido |
| 6 | companyId null en CRM (branchId undefined) | ALTA | ✅ Corregido |
| 7 | Invoice creation sin order CONFIRMED | MEDIA | ✅ Corregido |
| 8 | Projects /tasks routing conflict con /:id | MEDIA | ✅ Corregido |
| 9 | scopeCompany sin fallback a DB | MEDIA | ✅ Corregido |
| 10 | `"type": "module"` vs CommonJS: servidor no arrancaba y Jest no corría | CRÍTICA | ✅ Corregido (Auditoría Final) |
| 11 | Registro público con role/companyId libres (tenant takeover) | CRÍTICA | ✅ Corregido (D-011) |
| 12 | Listado de usuarios sin companyId devolvía todas las empresas | ALTA | ✅ Corregido |
| 13 | Inyección NoSQL por query params | MEDIA | ✅ Corregido |
| 14 | Permisos de inventario vs catálogo (rol ALMACEN sin efecto) | MEDIA | ✅ Corregido |
| 15 | X-Powered-By expuesto / 429 sin formato de error | BAJA | ✅ Corregido |
| 16 | Versión inconsistente + settings sin auditoría | BAJA | ✅ Corregido |
| 17 | Dependencias web del frontend ausentes (build imposible) | ALTA | ✅ Corregido |
| 18 | `dashboard.getSalesSummary`: agregación con `companyId` string sin castear → totales de ventas siempre 0 | ALTA | ✅ Corregido (FASE 12; regresión en ai-security) |

## FASE 12 — IA: cobertura de pruebas

| Área | Suite | Tests | Estado |
|---|---|---|---|
| Integración (health, RBAC, tools, analyze, auditoría, units) | `ai.test.js` | 17 | ✅ PASS |
| Seguridad (prompt injection, cross-tenant, spoofing, secretos, tool abuse, output malicioso, timeout/error) | `ai-security.test.js` | 11 | ✅ PASS |
| Cost control (techos diarios usuario/empresa, kill-switch 501) | `ai-limits.test.js` | 4 | ✅ PASS |
| Rate limit IA (AI_RATE_LIMIT 429) | `ai-rate-limit.test.js` | 2 | ✅ PASS |

Detalle de la matriz: `docs/AI_TEST_PLAN.md`. Regresión: los 147 tests anteriores intactos → **181/181 PASS**.

## Verificación final (estado definitivo del código — FASE 12)

- `npm run lint` → EXIT 0 (0 errores, 0 warnings, 136 ficheros JS de `src`)
- `node -e "require('./src/app').createApp()"` → BUILD_CHECK_OK
- `npm test` → **16/16 suites, 181/181 PASS** (147 anteriores intactos + 34 IA), TEST_EXIT=0
- `npx expo export --platform web` → EXIT 0 (dist-web, 179 módulos, 215 kB)
- `npx expo export --platform android` → EXIT 0 (dist-android, Hermes, 471 módulos, 1.42 MB)
- `node scripts/perf-benchmark.js` → 240 req, 0 errores (p95: /health 13.2ms, /products 18.6ms, /sales/orders 61.8ms, /dashboard 133.2ms)
