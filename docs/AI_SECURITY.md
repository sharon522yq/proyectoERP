# AI SECURITY — FASE 12

**Fecha**: 2026-09-22 · **Alcance**: módulo `/api/v1/ai/*` (ETAPA 11 del pliego)
**Principio rector**: la IA es una capa de LECTURA sobre datos ya autorizados; nunca amplía privilegios, nunca escribe, nunca ve la base de datos directamente.

---

## 1. Modelo de amenazas y controles

| Amenaza | Control implementado (servidor) | Test |
|---|---|---|
| **Prompt injection** (texto malicioso en la pregunta o en datos de negocio) | System prompt declara que los datos son *datos, no instrucciones*; el prompt del sistema jamás se refleja en la respuesta; los datos solo llegan marcados como `DATOS_AUTORIZADOS:` | `ai-security.test.js` "Prompt injection" (2) |
| **Escalada por tool abuse** (el modelo pide una herramienta sin permiso) | Intersección en servidor: `allowed = tools allowed by JWT permissions`; si el modelo devuelve otra → **403 `AI_UNAUTHORIZED_TOOL`** sin ejecutarla | `ai.test.js` "GERENTE pide tool de producción" + FORCE_TOOL |
| **Cross-tenant / fuga entre empresas** | `companyId` sale EXCLUSIVAMENTE de `scopeCompany` (JWT + fallback DB); las tools solo reciben `ctx.companyId`; nunca del body | `ai-security.test.js` cross-tenant (A/B) + spoofing |
| **companyId spoofing** (`body.companyId`) | El campo se ignora deliberadamente (ni siquiera se lee); test con token B y `companyId` de A → sigue aislado | `ai-security.test.js` "companyId spoofing" |
| **IDOR / abuso de parámetros** | Esquema de params estricto por tool: claves desconocidas rechazadas, enteros acotados (p.ej. `top 1..50`) → **400 `AI_TOOL_PARAMS`** antes de tocar la DB | `ai.test.js` FORCE_TOOL con `top:999999` |
| **Data leakage de datos ajenos** | Las tools consultan solo por `companyId`; RRHH expone solo conteos (sin PII); sin tool de auditoría ni de usuarios | cross-tenant test |
| **Fuga de secretos** (`AI_API_KEY`, JWT) | Secretos solo en `config/env.js`; nunca entran al prompt, a respuestas, a `/ai/health` ni a `ai_interactions`; test con clave real de prueba ausente en cuerpo y en todos los registros | `ai-security.test.js` "Secret leakage" |
| **Output injection** (JSON malicioso/malformado del proveedor) | Validación de schema (`ai.schemas.js`) → retry controlado 1× → si persiste: no se usa, se registra `INVALID_RESPONSE` y se responde **502 seguro** (sin reflejar la salida cruda) | FORCE_INVALID_JSON, FORCE_MALFORMED |
| **Tool inexistente** (fuera de la whitelist) | Mismo rechazo 403 (whitelist cerrada `TOOLS`) | unit: `allowedToolsFor` |
| **Ejecución arbitraria** | No hay `eval`, ni shell, ni query libre, ni acceso directo a Mongo desde el servicio IA (solo `ai.tools` → servicios/repos con `companyId`) | arquitectura + revisiones |
| **Consumo descontrolado (coste/DoS)** | Ver sección 3 | `ai-limits.test.js`, `ai-rate-limit.test.js` |

## 2. Acciones críticas (human-in-the-loop)

El módulo **no tiene ninguna tool de escritura**. La IA no puede crear facturas, modificar inventario, crear órdenes, registrar pagos, cancelar documentos ni tocar empleados/finanzas. El flujo de propuesta→confirmación humana (ETAPA 10) se implementará en una subfase posterior pasando por la API normal del ERP (validaciones + transacción + auditoría). Prohibido por diseño: `LLM → MongoDB`.

## 3. Rate limit y control de coste

| Capa | Mecanismo | Default (env) |
|---|---|---|
| Por IP (ventana 15 min) | `express-rate-limit` en `POST /chat` y `/analyze` (no en health) → 429 `AI_RATE_LIMIT` | `AI_RATE_LIMIT_MAX=20` |
| Por usuario (día UTC) | contador en `ai.limits` → 429 `AI_DAILY_LIMIT` + registro `RATE_LIMITED` | `AI_DAILY_USER_MAX=100` |
| Por empresa (día UTC) | ídem | `AI_DAILY_COMPANY_MAX=500` |
| Tokens por respuesta | `max_tokens` del proveedor acotado | `AI_MAX_TOKENS=1024` |
| Latencia | `AbortController`/`Promise.race` por invocación → 504 `AI_TIMEOUT` + registro `TIMEOUT` | `AI_TIMEOUT_MS=20000` |
| Kill-switch global | `AI_ENABLED=false` → 501 `AI_DISABLED` en chat/analyze | enabled solo si proveedor es `mock` o `AI_ENABLED=true` |
| Registro de consumo | `ai_interactions`: `tokensInput/tokensOutput/latencyMs/status/errorCode` por petición | — |

**Nota de escalado**: los contadores diarios y el rate limit viven en memoria (por proceso). Al escalar a múltiples instancias migrarlos a Redis (mismo hueco que el límite global). Documentado como pendiente en `docs/TODO.md`.

## 4. Datos y retención

- `ai_interactions` guarda **solo metadatos**; `promptText/responseText` no se almacenan salvo `AI_STORE_TEXT=true` (revisar antes de habilitar en producción).
- Nunca se almacenan API keys, tokens ni credenciales (test automático).
- TTL con `expireAfterSeconds = AI_RETENTION_DAYS·86400` (default 90 días).
- `ai_interactions` es el **registro de auditoría del módulo IA** (userId, companyId, sesión, tool usadas, estado).

## 5. Fallback de proveedor / configuración

- `AI_PROVIDER=mock` (default): sin red ni claves; determinista; ideal para tests/CI. Los "hooks" `FORCE_*` del mock solo alteran *su propia* salida y **no eluden** permisos ni validaciones (comprobado por test).
- `AI_PROVIDER=openai-compatible`: exige `AI_BASE_URL` + `AI_MODEL` (+ `AI_API_KEY`, salvo localhost) o responde 503 `AI_NOT_CONFIGURED` — nunca arranca con claves a medias.
- `GET /ai/health` informa estado **sin exponer** clave ni URL.

## 6. Pendientes de seguridad IA

- [ ] Validación de inyección con proveedor REAL (requiere clave: prueba manual en staging antes de producción)
- [ ] Contadores/rate-limit en Redis (multi-instancia)
- [ ] Rotación y gestión de `AI_API_KEY` vía gestor de secretos
- [ ] Revisión de `AI_STORE_TEXT` + política de retención legal (D-014)
