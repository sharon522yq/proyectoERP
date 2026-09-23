# SECURITY

Última actualización: 2026-09-22

## Autenticación

### JWT (JSON Web Tokens)
- **Access Token**: 15 minutos de vida, contiene userId, role, companyId, permissions
- **Refresh Token**: 7 días de vida, único por sesión (rotación)
- **Secretos**: Variables de entorno, nunca en código

### Refresh Token Rotation
Cada uso del refresh token genera uno nuevo. El anterior se invalida. Previene reuse de tokens.

## Autorización (RBAC)

### 10 Roles Predefinidos
| Rol | Permisos |
|---|---|
| SUPER_ADMIN | Todos (`*`) |
| ADMIN | Todos los permisos |
| GERENTE | Lectura general + CRM + Products |
| FINANZAS | Finance + Sales (pagos/facturas) |
| VENTAS | CRM completo + Sales completo |
| COMPRAS | Purchases + Products + Inventory |
| ALMACEN | Inventory completo |
| RRHH | HR completo |
| PRODUCCION | Production completo |
| EMPLEADO | Sin permisos |

### 70+ Permisos Granulares
Cada operación crítica tiene su propio permiso:
- `crm.leads.create`, `crm.leads.read`, `crm.leads.update`, `crm.leads.delete`
- `sales.quotes.create`, `sales.quotes.approve`
- `production.orders.create`, `production.orders.update`
- etc.

## Multiempresa

### Aislamiento de Datos
Todo dato empresarial está filtrado por `companyId`:
- Queries MongoDB incluyen `companyId` automáticamente
- `scopeCompany` middleware inyecta companyId del JWT
- Fallback a DB lookup si JWT no tiene companyId

### Protección Cross-Company
- Usuario de Empresa A no puede ver datos de Empresa B
- Tests específicos verifican aislamiento
- `companyId` se obtiene del JWT, nunca del request body

## Seguridad de Transporte

### Helmet
Headers de seguridad HTTP:
- X-Content-Type-Options: nosniff
- X-Frame-Options: DENY
- X-XSS-Protection: 1; mode=block
- Strict-Transport-Security
- `X-Powered-By` deshabilitado (no expone el framework)

### CORS
Orígenes permitidos configurados por entorno.

### Rate Limiting
- Global: 300 requests por 15 minutos por IP.
- Login: 50 intentos por 15 minutos por IP, con respuesta en formato de error (`429 {success:false, code:'RATE_LIMIT'}`).

## Registro de usuarios (D-011)

El endpoint público `POST /auth/register` **no** permite elegir rol ni empresa por defecto:
- Solo en `NODE_ENV=test`, o con `ALLOW_PRIVILEGED_REGISTER=true` explícito (desarrollo controlado), se acepta `role`/`companyId`.
- En cualquier otro entorno el registro crea usuarios con rol `EMPLEADO` y sin `companyId`; el alta en una empresa la realiza un admin autenticado (`users.create`).
- Esto cierra la escalada de privilegios / tenant takeover (OWASP A01).

## Secretos en producción

Con `NODE_ENV=production`, `config/env.js` **no arranca el servidor** si:
- `JWT_SECRET` o `JWT_REFRESH_SECRET` no existen, miden < 32 caracteres o son los valores de desarrollo.
- Ambos secretos son iguales entre sí.

## Validación de Entrada

- express-validator en cada endpoint
- Validación de tipos, longitudes, formatos
- Protección contra NoSQL injection:
  - Query params no escalares (`?limit[$gt]=1`) se eliminan en middleware (app.js)
  - `page`/`limit` restringidos a enteros
  - Operadores de filtro en body rechazados por las validaciones

## Hashing de Contraseñas

- bcryptjs con 12 rounds
- Contraseñas nunca se almacenan en texto plano

## Auditoría

Toda operación crítica registra:
- userId
- companyId
- action (CREATE, UPDATE, DELETE, etc.)
- module
- documentId
- previousData / newData
- timestamp
- ip

No se registran contraseñas ni secretos.

## IA (FASE 12) — ver `docs/AI_SECURITY.md`

- Cadena obligatoria: `Usuario → API (JWT+RBAC+scopeCompany) → Context Builder → Tools autorizadas (companyId del contexto) → AI Service → Provider Adapter → LLM → validación schema → respuesta + ai_interactions`
- El LLM **nunca** accede a MongoDB, no puede ejecutar código, no escribe datos y no puede saltarse RBAC (intersección de permisos en servidor aunque el modelo pida una tool ajena → 403).
- `companyId` exclusivamente del contexto autenticado; el body se ignora (test de spoofing).
- Secretos solo en variables de entorno; jamás en prompts, respuestas, `/ai/health` ni en `ai_interactions`.
- Rate limit por IP (`AI_RATE_LIMIT`), techos diarios por usuario/empresa (`AI_DAILY_LIMIT`), `AI_MAX_TOKENS`, `AI_TIMEOUT_MS`, kill-switch `AI_ENABLED` (501).
- Auditoría de cada interacción en `ai_interactions` (metadatos; texto no almacenado por defecto; TTL 90 días).

## Logs

- Morgan para HTTP requests (solo en development)
- Errores 500 se loguean en consola
- Nunca se registran: passwords, JWT secrets, API keys, refresh tokens completos

## Pendientes

- [x] Penetration testing (no destructivo) → `docs/PENETRATION_TEST.md`
- [x] OWASP checklist (revisión A01–A07 + tests) → `docs/PENETRATION_TEST.md`
- [x] SQL/NoSQL injection testing → `tests/security.test.js`
- [x] Rate limiting por usuario (no solo por IP) → límites diarios por usuario/empresa en IA (`ai.limits`); global por IP pendiente de Redis
- [ ] Token blacklisting
- [ ] Encryption at rest
- [ ] Backoff/CAPTCHA por cuenta en login (fuerza bruta)
- [ ] Email real para forgot-password
- [x] Prompt injection protection (IA) → `docs/AI_SECURITY.md` + `tests/ai-security.test.js`
- [ ] Pruebas de IA con proveedor real (requiere API key, staging)
- [ ] Gestión de `AI_API_KEY` en gestor de secretos + rotación
