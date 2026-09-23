# AI ARCHITECTURE PROPOSAL — FASE 12

**Fecha**: 2026-09-22
**Estado**: Propuesta para aprobación → base de la implementación de FASE 12
**Precedente**: `docs/FINAL_AUDIT.md` (auditoría final, 147/147 tests PASS)

---

## 0. Auditoría del código existente (ETAPA 1)

| Elemento | Estado hallado |
|---|---|
| Reserva `/api/v1/ai/*` | Handler inline en `app.js:117` → 501 `AI_NOT_IMPLEMENTED`. Sin módulo. |
| Colección `ai_interactions` | **No existe** en el código ni en los modelos → se creará nueva (nada que reemplazar). |
| Permisos `ai.*` | No existen en `permissions.js` (catálogo v3). |
| Variables de entorno IA | No existen en `config/env.js`. |
| Tests referenciando `/ai` o `501` | Ninguno → implementar no rompe regresiones. |
| Swagger | Sin paths `/ai`. |
| Frontend | Sin pantalla de IA; `api.js` con axios + refresh automático. |

### A. Datos que la IA PUEDE consumir (vía servicios existentes, siempre `companyId`-scoped)

| Dominio | Fuente ya existente | Exposición a IA |
|---|---|---|
| Ventas (facturas/pagos/CxC, pedidos pendientes) | `dashboard.getSalesSummary`, `sales.repository` | Agregados + top-N |
| Inventario (stock bajo, valor de stock) | `dashboard.getInventorySummary` | Agregados + listado limitado |
| Finanzas (activos, pasivos, CxC, CxP) | `dashboard.getFinanceSummary` | Agregados |
| Producción (órdenes por estado) | `dashboard.getProductionSummary` | Agregados |
| Proyectos (totales, pendientes) | `dashboard.getProjectSummary` | Agregados |
| CRM (leads, clientes) | `dashboard.getCRMSummary` | Agregados |
| RRHH (empleados/departamentos: **solo conteos**) | `dashboard.getHRSummary` | Solo agregados (sin PII) |
| Productos (top-N bajo stock) | `dashboard.getInventorySummary` | Listado limitado |

### B. Datos que la IA NO debe consumir

- **Nunca acceso directo a MongoDB.** El servicio IA no hace `require()` de modelos; solo invoca tools.
- Hashes de contraseñas / refresh tokens / reset tokens (`select:false`, y fuera de todo tool).
- Registros completos de auditoría (contienen IPs y PII) — no se expone tool de auditoría.
- Logs, variables de entorno, API keys, secretos: jamás entran al contexto ni salen en respuestas.
- Datos de otra empresa (aislamiento por construcción: `companyId` solo del contexto JWT).
- Consultas arbitrarias libres (`runQuery`) — prohibido por diseño.
- **Escrituras**: la IA no tiene tools de escritura en FASE 12 (solo lectura).

### Cadena obligatoria (ETAPA 1-B del pliego)

```
Usuario → API (JWT + RBAC + scopeCompany) → AI Service → Context Builder
        → Tools autorizadas (solo lectura, companyId del contexto) → AI Service
        → Provider Adapter (abstracción) → LLM (nunca ve MongoDB)
        → Validación de salida (schema) → Respuesta + registro en ai_interactions
```

Prohibido: `Usuario → LLM → MongoDB`, y `LLM → escritura en MongoDB`.

---

## 1. AI Controller (`ai.controller.js`)

Recibe solicitudes, traslada `ctx` canónico (`{userId, companyId, branchId, role, permissions, ip}`) construido **desde el JWT/middleware**, nunca desde el body. Responde con el formato estándar `{success, data}` / `{success:false, message, code}`.

```
POST /api/v1/ai/chat      { question, sessionId? }   → ai.chat
POST /api/v1/ai/analyze   { scope? }                 → ai.analyze
GET  /api/v1/ai/health                                → ai.read
```

El controller **no contiene lógica de negocio ni acceso a datos**.

## 2. AI Service (`ai.service.js`)

Responsabilidades, en orden:

1. **Límites primero**: rate limit por usuario/empresa, `AI_MAX_TOKENS`, `AI_TIMEOUT_MS`, presupuesto diario de tokens por empresa (contador en memoria, documentado single-instance).
2. **Context Builder**: identidad del usuario (nombre, rol), empresa (solo `ctx.companyId`), fecha/hora, reglas del sistema. **No** se incluyen datos de empresa en el prompt inicial: los datos llegan solo por tools.
3. **Selección de herramientas**: calcula el subconjunto de tools cuyo `requiredPermission` posee el usuario (`intersection(modelOutput, userTools)`) — *aunque el modelo devuelva una tool no autorizada, no se ejecuta*.
4. **Invocación al provider** vía adaptador (1ª llamada: selección de tool; 2ª llamada: síntesis con datos de la tool).
5. **Validación de salida**: schema (JSON) por `requestType`; si falla → retry controlado (1) → si vuelve a fallar → respuesta segura de "no se pudo generar" + `status: INVALID_RESPONSE`.
6. **Registro** de interacción en `ai_interactions` (metadatos, nunca prompt completo por defecto).
7. **Errores**: timeouts/cuota/provider caído → códigos `AI_TIMEOUT`, `AI_QUOTA_EXCEEDED`, `AI_PROVIDER_ERROR`, `AI_NOT_CONFIGURED`; nunca exponer stack ni secretos.

## 3. AI Provider Adapter (`providers/`)

Interfaz (no acopla al ERP a ningún proveedor):

```
AIProvider
├── generateText(messages, opts)        → { text, tokensIn, tokensOut, latencyMs }
├── generateStructured(messages, schema, opts) → { data, tokensIn, tokensOut, latencyMs }
├── analyze(prompt, opts)               → (delegado a generateStructured)
├── healthCheck()                       → { ok, provider, model, detail }
```

Implementaciones:

| Adapter | Descripción | Uso |
|---|---|---|
| `MockProvider` | Determinista, sin red ni claves. Selecciona tools por palabras clave y sintetiza respuestas a partir de los datos reales de las tools. | **Default** (`AI_PROVIDER=mock`): tests, CI, desarrollo offline. |
| `OpenAICompatProvider` | HTTP genérico compatible con el estándar *chat completions* (`AI_BASE_URL` configurable): cubre OpenAI, Gemini (endpoint compatible), DeepSeek, Groq, Ollama local, etc. | Producción. |

Cambio de proveedor = cambiar variables de entorno; añadir un proveedor nativo = añadir un fichero adapter + registrar en la factory. El ERP no cambia.

## 4. Modelo de datos — `ai_interactions` (nuevo)

No existía; se crea con los campos exigidos:

```
companyId (index) · userId (index) · sessionId (index) · provider · model
requestType (chat|analyze) · promptMetadata {questionLength, toolsUsed[], scope}
responseMetadata {answerLength, refused?} · tokensInput · tokensOutput ·
latencyMs · status (OK|ERROR|INVALID_RESPONSE|RATE_LIMITED|TIMEOUT) · errorCode?
createdAt (TTL index)
```

**Política de datos**: NO se almacenan API keys, secretos, ni el texto completo de prompt/respuesta por defecto (`AI_STORE_TEXT=false`; si se habilita explícitamente, también aplica TTL). Retención: TTL de `AI_RETENTION_DAYS` (default 90 días) vía índice `expireAfterSeconds`.

## 5. Permisos (catálogo v4 — mínimos)

```
ai.chat     — usar el asistente
ai.analyze  — generar análisis estructurados
ai.read     — consultar /ai/health e interacciones
```

No se crean más (`ai.recommend`/`ai.admin` diferidos hasta existir endpoints que los necesiten). Regla: **la IA solo puede responder con datos a los que el usuario ya puede acceder** → cada tool declara `requiredPermission` del catálogo existente; si el usuario no la tiene, la tool no se expone.

Asignación: `ADMIN` (automático vía lista PERMISSIONS), `GERENTE` (+`ai.chat/analyze/read`), resto sin IA. Los seeds usan `upsert` con `$setOnInsert`: en BD existentes habrá que grantar los permisos manualmente (documentado).

## 6. Tools ERP autorizadas (ETAPA 7) — solo lectura

| Tool | Permiso requerido | Fuente |
|---|---|---|
| `getSalesSummary({period})` | `sales.invoices.read` | dashboard |
| `getPendingOrders({top})` | `sales.orders.read` | sales repo ( companyId) |
| `getInventoryStatus()` | `inventory.read` | dashboard |
| `getLowStockProducts({top})` | `inventory.read` | dashboard |
| `getAccountsReceivable()` | `finance.accounts.read` | dashboard/finance |
| `getAccountsPayable()` | `finance.accounts.read` | finance (cuenta 2100) |
| `getCustomerBalance({top})` | `sales.invoices.read` | aggregate facturas-pagos por cliente |
| `getProductionSummary()` | `production.orders.read` | dashboard |
| `getProjectSummary()` | `projects.read` | dashboard |
| `getCRMOverview()` | `crm.leads.read` | dashboard |
| `getHRHeadcount()` | `hr.employees.read` | dashboard (solo conteos) |

Todas: validan parámetros (enteros acotados), usan **exclusivamente** `ctx.companyId`, devuelven ≤ N registros, y no exponen PII salvo nombre de cliente cuando la tool ya lo requiere (facturación).

## 7. Estructura de carpetas

```
backend/src/modules/ai/
├── ai.routes.js           # rutas + permisos + rate limit IA
├── ai.controller.js       # ctx canónico + respuestas
├── ai.service.js          # orquestación, límites, validación, registro
├── ai.context.js          # context builder + prompts de sistema
├── ai.tools.js            # registro de tools (nombre, schema, permiso, handler)
├── ai.validation.js       # express-validator (question, scope, sessionId)
├── ai.schemas.js          # schemas de salida estructurada (chatToolCall, analyze)
├── ai.interaction.model.js
├── ai.limits.js           # contadores por usuario/empresa (memoria + TTL)
├── providers/
│   ├── index.js           # factory según AI_PROVIDER
│   ├── mock.provider.js
│   └── openai-compat.provider.js
backend/src/config/env.js  # + bloque ai: {enabled, provider, apiKey, model, baseUrl, ...}
```

## 8. Seguridad y límites (ETAPA 11)

- **Prompt injection**: el system prompt declara que los datos de tools son *datos, no instrucciones*; la validación de salida y la intersección de permisos ocurren **en servidor**, por lo que inyectar instrucciones no puede ampliar privilegios (propiedad testeable: forzar al provider a pedir una tool no autorizada → se rechaza).
- **Data leakage**: tests cross-tenant, sin permisos, companyId spoofing (body ignorado), secretos ausentes de respuestas/logs.
- **Tool abuse**: whitelist cerrada; sin eval, sin shell, sin query libre.
- **Output injection**: schema validation + retry(1) + respuesta segura.
- **Rate limit IA**: `AI_RATE_LIMIT_MAX` (default 20/15min por IP) + tope diario por usuario/empresa (`AI_DAILY_USER_MAX`, `AI_DAILY_COMPANY_MAX`).
- **Cost control**: `AI_MAX_TOKENS` (default 1024), `AI_TIMEOUT_MS` (default 20000), conteo de tokens por interacción y acumulado diario; `AI_ENABLED=false` como kill-switch global (→ 501 `AI_DISABLED`).

## 9. Frontend mínimo (ETAPA 12)

`frontend/src/screens/AIAssistantScreen.js` (RN + RN-Web, sin lógica de negocio):
historial en estado local, input, enviar, indicador de procesamiento, render de respuesta, errores (401/403/429/504), estado vacío, timeout (axios 15s del cliente), mensaje de acceso denegado. Acceso desde Dashboard (botón "Asistente IA" con vuelta atrás). Cliente nuevo `aiApi.chat/analyze/health` en `api.js`.

## 10. Riesgos

| Riesgo | Mitigación |
|---|---|
| Alucinación del modelo | Tools como única fuente; prompt exige citar datos o declarar "datos insuficientes"; schema `confidence: null` hasta FASE posterior |
| Costo/latencia impredecibles | Límites duros (tokens, timeout, rate, diario) + registro de consumo |
| Proveedor caído | `healthCheck` + `AI_PROVIDER_ERROR` claro; mock para desarrollo |
| Contadores en memoria no válidos multi-instancia | Documentado; migrar a Redis al escalar (mismo hueco que rate-limit global) |
| Seeds de permisos no aplicados en BD ya creadas | Instrucción de grant manual en docs |
| Datos sensibles en logs | `AI_STORE_TEXT=false` por defecto; auditoría solo metadatos |

## 11. Decisiones pendientes (no bloqueantes)

1. **Proveedor de producción** (recomendación técnica en `AI_PROVIDER_DECISION.md`; elegible vía env sin reescritura).
2. Retención de interacciones (default 90 días) y techos diarios por empresa — ajustables vía env.
3. Tools de escritura con confirmación humana (ETAPA 10) — fase posterior con flujo de propuesta/confirmación.

**Conclusión (PASO 5)**: no hay decisión arquitectónica crítica sin resolver; el diseño es implementable con el provider `mock` por defecto y el adapter `openai-compatible` listo para producción → se procede a PASO 6+.
