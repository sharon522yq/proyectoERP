# PERFORMANCE

Auditoría de rendimiento — 2026-09-22
Metodología: mediciones **reales** contra `src/server.js` (servidor de producción) con MongoDB en memoria, vía `backend/scripts/perf-benchmark.js`. 60 peticiones por endpoint tras warmup, secuenciales, latencia medida con `performance.now()` en cliente HTTP (Node 24 `fetch`).

## Resultados del benchmark (local, una instancia)

| Endpoint | n | avg (ms) | p50 (ms) | p95 (ms) | max (ms) | errores |
|---|---|---|---|---|---|---|
| `GET /health` (sin auth) | 60 | 1.00 | 0.89 | 2.03 | 2.11 | 0 |
| `GET /api/v1/products?limit=20` (paginado, auth) | 60 | 3.69 | 3.41 | 5.62 | 7.05 | 0 |
| `GET /api/v1/sales/orders?limit=20` (paginado, auth) | 60 | 4.73 | 4.66 | 6.81 | 8.38 | 0 |
| `GET /api/v1/dashboard` (agrega 6 módulos) | 60 | 7.27 | 6.52 | 12.33 | 14.35 | 0 |

- **Total: 240 peticiones, 0 errores.**
- Tiempo de arranque real: MongoMemoryServer ~0.7s, servidor+seed ~1.4s, `/health` operativo a los ~2.4s desde el inicio del proceso.
- El dashboard (6 agregados: ventas, inventario, finanzas, producción, CRM, RRHH) queda por debajo de 15ms p95 — los índices compuestos por `companyId` hacen su trabajo.
- Condiciones: una instancia Node, MongoDB en memoria (mismo host, sin red), datasets pequeños (~docenas de documentos). En Atlas (red) esperar +1–5ms de ida y vuelta por query.

## Análisis estático de rendimiento

### Índices de base de datos (revisados, presentes)

Todas las colecciones relevantes indexan `companyId` (aislamiento + filtros) y sus pares de consulta:

| Colección | Índices clave |
|---|---|
| `inventory_movements` | `{companyId,createdAt}`, `{companyId,productId,createdAt}`, `warehouseId`, `productId`, `type` |
| `inventory` (stock) | **único** `{companyId,warehouseId,productId}` |
| `transactions` | `{companyId,date}`, `{companyId,accountId}` |
| `accounts` | **único** `{companyId,code}` |
| `sales_orders`, `purchase_orders`, `production_orders` | `{companyId,status,createdAt}` |
| `customers`, `leads` | `{companyId,status}`, `{companyId,assignedTo}`, texto `{name,email}` |
| `audit` | `{companyId,timestamp}`, `{module,timestamp}` |
| `users` | único `email`, `companyId` |
| `employees` | **único** `{companyId,employeeId}` |
| `departments`, `warehouses` | **único** `{companyId,code/name}` |

- Consultas paginadas usan `skip/limit` con `countDocuments` en paralelo (`Promise.all`) — sin `COUNT` secuencial.
- **Sin consultas N+1 detectadas**: los listados no poblan en bucles; los agregados del dashboard hacen `aggregate`/`find` por `companyId`.

### Protecciones de carga

- `express-rate-limit`: global 300 req/15min por IP; `/auth/login` 50 req/15min con mensaje en formato de error (429).
- `express.json({ limit: '1mb' })` — payloads acotados.
- Paginación por defecto `limit=20` en todos los repositorios.
- Query params no escalares eliminados (ver `app.js`): evita que `?limit[$gt]=1` provoque scans inesperados.

### Hallazgos y recomendaciones (no bloqueantes)

| # | Hallazgo | Impacto | Recomendación |
|---|---|---|---|
| P-1 | Sin middleware `compression()` | Respuestas >1KB sin gzip (listados, dashboard) | Añadir `compression()` antes de rutas; gana 5–80% en payloads grandes |
| P-2 | Rate limiter con `MemoryStore` | Correcto en 1 instancia; en N instancias el límite se multiplica por N | Usar `rate-limit-redis` al escalar horizontalmente |
| P-3 | `skip/limit` en colecciones grandes (>100k docs) | `skip` profundo degrada (O(skip)) | Paginación por cursor (`_id`/`createdAt < último`) en kardex y auditoría |
| P-4 | `scopeCompany` con fallback a DB (D-006) | +1 query por request solo cuando el JWT no trae `companyId` | Asignar empresa ⇒ refresh del token (ya previsto en D-006) |
| P-5 | Asientos automáticos de finanzas escriben saldo con lectura-modificación no atómica (`account.balance + delta`) | Carrera si dos pagos concurrentes de la misma empresa | `findOneAndUpdate` con `$inc` (mismo patrón que los folios D-004) |
| P-6 | El benchmark usa dataset pequeño; no hay prueba de carga con 100k+ documentos | Escala no medida | Añadir seed sintético grande antes de FASE 15 si el volumen lo exige |

**Conclusión**: rendimiento actual del API es sólido (p95 < 15ms local en los endpoints más pesados). Los hallazgos P-1/P-5 son las mejoras de mayor retorno inmediato.

## Reproducir el benchmark

```bash
cd backend
node scripts/perf-benchmark.js          # N=60 por endpoint (por defecto)
PERF_N=20 node scripts/perf-benchmark.js # muestra menor
```

Respeta el rate limit global (300/15min): el script mantiene el total de peticiones < 300 por ejecución.
