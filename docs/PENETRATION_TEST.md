# PENETRATION TEST — No destructivo

Auditoría de seguridad activa — 2026-09-22
Alcance: API backend (`/api/v1/*`, `/health`, `/docs`). Pruebas **no destructivas**: sin fuerza bruta real, sin denial-of-service, sin payloads ofensivos, sin modificar datos de terceros. Todo se ejecuta contra una instancia efímera (MongoDB en memoria).

## 1. Pruebas automatizadas (reproducibles)

Suite: `backend/tests/security.test.js` (10 pruebas) + `backend/tests/audit-integration.test.js` (18 pruebas, aislamiento/IDOR).
Ejecución: `npm test` → **147/147 PASS (12 suites)**, `NPM_TEST_EXIT=0`.

| # | Prueba | Resultado |
|---|---|---|
| T-01 | `X-Powered-By` ausente; cabeceras Helmet (`X-Frame-Options`, `X-Content-Type-Options: nosniff`, `Cross-Origin-Resource-Policy`) presentes | PASS |
| T-02 | Sin token → 401 `{success:false, code:'AUTH_REQUIRED'}` | PASS |
| T-03 | Token malformado → 401 `AUTH_INVALID` | PASS |
| T-04 | Token **falsificado** firmado con secreto del atacante → 401 | PASS |
| T-05 | Refresh token reutilizado como access token → 401 | PASS |
| T-06 | Inyección NoSQL en query (`?limit[$gt]=1&page[$ne]=0&companyId[$ne]=null`) → 200, parámetros eliminados, `page=1/limit=20` por defecto | PASS |
| T-07 | `?page=abc&limit=DROP` → 200 con defaults (sin 500 ni NaN en paginación) | PASS |
| T-08 | Operadores de filtro en body (`price:{$gt:0}`) → 400/404, no persiste | PASS |
| T-09 | CORS: `Origin: https://evil.example` no recibe `Access-Control-Allow-Origin` | PASS |
| T-10 | Rate limit de login: tras el límite → 429 con `{success:false, code:'RATE_LIMIT'}` | PASS |
| T-11..T-17 | IDOR/multiempresa: B no lee/escribe productos, pedidos, compras, stock, cuentas, transacciones ni usuarios de A; no crea cotización con cliente de A | PASS |
| T-18 | Registro público sin privilegios no puede fijar `role=ADMIN` ni `companyId` ajeno | PASS |
| T-19 | Proveedor y producto de otra empresa en compra → 404 | PASS |

## 2. Revisión manual de superficie (código + configuración)

| Verificación | Estado | Evidencia |
|---|---|---|
| Contraseñas con bcrypt (cost 12) | OK | `auth.service.js` `bcrypt.hash(pw,12)` |
| JWT access 15m + refresh 7d con `jti` único y rotación (hash en DB) | OK | `auth.service.js`, D-003; test refresh rotation |
| RBAC: todas las rutas con `requirePermission` (70+ permisos granulares) | OK | grep `requirePermission(` en todos `*.routes.js` |
| Multiempresa: `companyId` siempre desde JWT/`scopeCompany`, nunca del body | OK | controllers `ctx(req)`; test T-11..T-17 |
| Escalada de privilegios vía registro (A01) | **CORREGIDO** | D-011: política por entorno; verificado T-18 |
| Fuga de usuarios sin empresa (`listByCompany(null)` devolvía todo) | **CORREGIDO** | `user.repository.js` ahora filtra `companyId:null` |
| Secretos JWT de desarrollo en producción | **CORREGIDO** | `env.js` fail-fast: >=32 chars, distintos, no-default en `NODE_ENV=production` |
| Helmet + CORS whitelist (solo `FRONTEND_URL` + localhost no-prod) | OK | `app.js` |
| Body 1MB, rate limit global 300/15min, login 50/15min | OK | `app.js`, `auth.routes.js` |
| Formato de error uniforme `{success:false,message,code}` en 401/403/404/400/429/500 | OK | `middlewares/http.js`, `auth.routes.js` |
| Audit trail en CREATE/UPDATE/DELETE de operaciones críticas (incl. settings y asientos automáticos `finance.auto`) | OK | `middlewares/audit.js`; módulos `logAudit(...)` |
| Roles: módulo de roles solo-lectura (no hay ruta para crear roles con `*`) | OK | `role.routes.js` (solo GET) |
| Swagger `/docs` (Swagger UI) | OK | `app.js` + `docs/swagger.json` (29 paths) |
| `refreshTokenHash` es `select:false` + `toSafeJSON` elimina secretos | OK | `user.model.js` |

## 3. Vulnerabilidades encontradas y corregidas en esta auditoría

1. **CRÍTICA — Escalada de privilegios / tenant takeover (OWASP A01)**: `POST /auth/register` aceptaba `role` y `companyId` libres → cualquier anónimo podía crear un ADMIN dentro de una empresa existente.
   *Corregido*: D-011 (política por entorno + fail-fast de secretos). Verificado: T-18.
2. **ALTA — Fuga de listado de usuarios**: un usuario sin `companyId` obtenía **todos** los usuarios de todas las empresas (`filter {}`).
   *Corregido*: `user.repository.js` → `companyId: null` (solo usuarios sin empresa).
3. **MEDIA — Inyección NoSQL por query params**: `?limit[$gt]=1` llegaba como objeto a paginación (posible 500/filtro inesperado).
   *Corregido*: sanitizador de query en `app.js`. Verificado: T-06/T-07.
4. **MEDIA — `X-Powered-By` expuesto** y 429 de login fuera del formato de error.
   *Corregido*: `app.disable('x-powered-by')` + mensaje `RATE_LIMIT` en `loginLimiter`. Verificado: T-01/T-10.
5. **MEDIA — Desalineación de permisos de inventario**: `inventory/*` exigía `branches.*` mientras el catálogo y el dashboard usaban `inventory.*` (el rol ALMACEN no podía ajustar stock).
   *Corregido*: `inventory.routes.js` re-cableado a `inventory.read/adjust/movements`.
6. **BAJA — Settings sin auditoría**: `PUT /settings` no generaba log. *Corregido*.

## 4. Riesgos residuales conocidos (no explotados / fuera de alcance)

| Riesgo | Nota | Mitigación prevista |
|---|---|---|
| Fuerza bruta de credenciales | Limitada a 50 intentos/15min/IP; sin CAPTCHA ni bloqueo por cuenta | Añadir backoff por cuenta + notificación en FASE 14 |
| Rate limit en memoria (1 instancia) | En multi-instancia el límite es por instancia | Redis (P-2) al escalar |
| Token JWT sin revocación individual | Logout invalida refresh (hash); access tokens caducan en 15m | Lista de revocación si se requiere invalidación inmediata |
| `forgot-password` entrega token solo en dev/test | En producción no se envía email (requisito FASE 1) | Integrar proveedor de email |
| Dependencias con avisos de deprecación (árbol Expo/RN) | `tar@6`, `glob@7`, `xmldom@0.7.13` vía dependencias transitivas | Actualizar SDK Expo en FASE 16/17; revisar `npm audit` al conectar CI con red |
| Sin WAF/HTTPS propios | Responsabilidad del reverse proxy en despliegue | `docs/DEPLOYMENT.md` |

## 5. Cómo reproducir

```bash
cd backend
npm test -- tests/security.test.js tests/audit-integration.test.js
```

No se realizaron ataques destructivos (sin DoS, sin escrituras masivas, sin fuerza bruta real). Todas las pruebas son seguras de repetir.
