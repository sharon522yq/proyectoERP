# ARCHITECTURE — ERP Modular Monolith

## 1. Estilo

Modular Monolith + REST API. Un solo deploy backend, módulos con fronteras estrictas para permitir extracción futura a microservicios sin reescribir.

```
React Native / Web (Expo)
        | HTTPS (JWT access + refresh)
        v
Node.js + Express (/api/*)
  auth | users | roles | companies | branches | audit | settings (+ futuros ERP)
        | Mongoose
        v
MongoDB Atlas
  users, roles, companies, branches, audit_logs, system_settings (+ colecciones FASE 2+)
```

## 2. Capas por módulo (obligatorio)

`X.model.js` (Mongoose) → `X.repository.js` (solo datos) → `X.service.js` (reglas negocio)
→ `X.controller.js` (solo HTTP) → `X.routes.js` (definición endpoints) → `X.validation.js` (express-validator).

Reglas:
- Controller jamás contiene reglas de negocio ni acceso directo a Mongoose.
- Service jamás toca `req/res`.
- Repository jamás valida permisos ni genera auditoría.
- Validación siempre antes del controller.
- Operaciones críticas emiten auditoría vía `auditService.log()` (fire-and-forget, nunca rompe la operación).

## 3. Estructura

```
ERP/
├── frontend/src/{components,screens,navigation,services,context,hooks,utils,constants,theme}
├── backend/src/{config,middlewares,modules/{auth,users,roles,companies,branches,audit,settings},utils}
├── docs/ tests/ scripts/
├── .env.example .gitignore README.md package.json
```

## 4. Seguridad

- bcrypt (12 rounds), JWT access (15m) + refresh (7d, rotativo, hasheado en DB).
- RBAC: `Usuario → Rol → permisos[]` (ej. `inventory.read`). Middleware `authenticate` + `requirePermission('modulo.accion')`. El frontend oculta menús, el backend deniega (403).
- Multiempresa: todo documento de negocio lleva `companyId` (+ `branchId` cuando aplique). Middleware `scopeCompany` inyecta `req.companyId` del usuario; repository siempre filtra por él. Acceso cruzado → 403 + log auditoría.
- Headers: helmet, CORS whitelist (`FRONTEND_URL`), rate-limit global + estricto en `/auth/login`.
- Errores: middleware global, formato `{success:false,message,code}`; detalles técnicos solo en logs.
- Secretos solo en `.env`, nunca en Git.

## 5. Auditoría

Colección `audit_logs`: `userId, companyId, action, module, documentId, previousData, newData, timestamp, ip`.
Acciones: CREATE/UPDATE/DELETE/LOGIN/LOGOUT/APPROVE/REJECT/EXPORT. Solo lectura para `ADMIN+` con permiso `audit.read`; nadie (ni SUPER_ADMIN vía API) puede UPDATE/DELETE logs.

## 6. API (convenciones FASE 1)

- `POST /api/auth/register|login|refresh|logout|forgot-password|reset-password|change-password`
- `GET|POST /api/users`, `GET|PUT|DELETE /api/users/:id`
- `GET /api/roles`
- `GET|POST /api/companies`, `GET|PUT /api/companies/:id`
- `GET|POST /api/branches`, `GET|PUT /api/branches/:id`
- `GET /api/audit`
- `GET /api/settings`, `PUT /api/settings`
- Todo bajo `/api`, JSON, paginación `?page&limit` donde liste.

## 7. Frontend

Expo + React Native Web: `services/api.js` (axios, inyección JWT, refresh auto), `context/AuthContext.js`,
`navigation/` con guardas por `permissions[]`, pantallas por rol. Sin keys ni lógica crítica en cliente.

## 8. IA (FASE 6, preparado desde FASE 1)

`RN → Express → backend/src/services/aiService.js → proveedor LLM`. FASE 1 solo deja el contrato `POST /api/ai/*` documentado y bloqueado (501). La IA solo ANALIZA/RECOMIENDA; ejecución crítica exige aprobación humana.

## 9. Testing

Jest + Supertest + mongodb-memory-server. Pirámide: unitarias (services/validaciones) > integración API (auth/RBAC/aislamiento/auditoría) > regresión por fase. Matriz en `docs/QA_TEST_PLAN.md`.

## 10. Cambios arquitectónicos

Prohibido cambiar estilo/capas sin documentar Problema → Alternativa → Ventajas/Desventajas → Impacto → Recomendación (§40 del prompt).
