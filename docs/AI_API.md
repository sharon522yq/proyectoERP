# AI API — FASE 12

Base: `/api/v1/ai` (alias sin versionar: `/api/ai`). Autenticación: Bearer JWT + RBAC + `companyId` del contexto.

## Endpoints

### POST /api/v1/ai/chat — `ai.chat`

Asistente ERP con tools autorizadas.

**Request**
```json
{ "question": "¿Cuánto vendimos este mes?", "sessionId": "opcional-4-64chars" }
```
> Un `companyId` en el body se **ignora** (aislamiento multiempresa server-side).

**Response 200**
```json
{
  "success": true,
  "data": {
    "answer": "Según los datos autorizados de ventas:\n- totalInvoiced: …",
    "sessionId": "uuid-o-el-echo",
    "toolsUsed": ["getSalesSummary"],
    "provider": "mock",
    "model": "mock-v1",
    "latencyMs": 12
  }
}
```

**Flujo interno**: validación → límites → system prompt + tools permitidas → proveedor elige tool (JSON) → intersección de permisos → ejecución de la tool con `ctx.companyId` → síntesis → registro `ai_interactions`.

**Errores**

| HTTP | code | Cuándo |
|---|---|---|
| 400 | `VALIDATION_ERROR` | question ausente/ <2 >2000, sessionId malformado |
| 400 | `AI_TOOL_PARAMS` | parámetros de tool inválidos o fuera de rango |
| 400 | `COMPANY_REQUIRED` | usuario sin empresa asignada |
| 401 | `AUTH_REQUIRED` / `AUTH_INVALID` | sin/inválido token |
| 403 | `FORBIDDEN` | sin `ai.chat` |
| 403 | `AI_UNAUTHORIZED_TOOL` | el modelo pidió tool fuera de whitelist/permisos |
| 429 | `AI_RATE_LIMIT` | límite por IP |
| 429 | `AI_DAILY_LIMIT` | techo diario usuario/empresa |
| 501 | `AI_DISABLED` | `AI_ENABLED=false` |
| 502 | `AI_INVALID_RESPONSE` | JSON inválido tras retry (respuesta segura) |
| 502 | `AI_TOOL_ERROR` / `AI_PROVIDER_ERROR` | fallo de tool/proveedor |
| 503 | `AI_NOT_CONFIGURED` | proveedor real sin claves/URL/modelo |
| 504 | `AI_TIMEOUT` | proveedor sin respuesta en `AI_TIMEOUT_MS` |

### POST /api/v1/ai/analyze — `ai.analyze`

Análisis estructurado de los datos a los que el usuario tiene acceso.

**Request**: `{ "scope": "opcional, máx 200" }` · **Response 200**:
```json
{
  "success": true,
  "data": {
    "analysis": { "type": "analysis", "summary": "…", "findings": ["…"], "recommendations": ["…"], "confidence": null },
    "sessionId": "uuid", "toolsUsed": ["getSalesSummary", "…"], "provider": "mock", "model": "mock-v1", "latencyMs": 20
  }
}
```
Errores adicionales: **403 `AI_NO_ACCESS`** (permiso `ai.analyze` pero ningún permiso de datos). `confidence` es `null` hasta la subfase de predicciones.

### GET /api/v1/ai/health — `ai.read`

```json
{ "success": true, "data": { "enabled": true, "provider": "mock", "model": "mock-v1", "configured": true,
  "detail": "…", "limits": { "rateLimitMax": 20, "dailyUserMax": 100, "dailyCompanyMax": 500, "maxTokens": 1024, "timeoutMs": 20000 } } }
```
No expone API keys ni URLs.

## Permisos (catálogo v4)

| Permiso | Otorga | Roles default |
|---|---|---|
| `ai.chat` | usar el asistente | ADMIN, GERENTE |
| `ai.analyze` | análisis estructurado | ADMIN, GERENTE |
| `ai.read` | consultar `/ai/health` | ADMIN, GERENTE |

> En BD existentes: los seeds usan `$setOnInsert` → grantar `ai.*` manualmente a ADMIN/GERENTE (o re-login tras actualizar el rol).

## Tools disponibles (solo lectura)

| Tool | Permiso requerido | Parámetros |
|---|---|---|
| `getSalesSummary` | `sales.invoices.read` | `period`: today\|month\|quarter\|year\|all |
| `getPendingOrders` | `sales.orders.read` | `top`: 1–50 |
| `getInventoryStatus` | `inventory.read` | — |
| `getLowStockProducts` | `inventory.read` | `top`: 1–50 |
| `getAccountsReceivable` | `finance.accounts.read` | — (cuenta 1200) |
| `getAccountsPayable` | `finance.accounts.read` | — (cuenta 2100) |
| `getCustomerBalance` | `sales.invoices.read` | `top`: 1–50 |
| `getProductionSummary` | `production.orders.read` | — |
| `getProjectSummary` | `projects.read` | — |
| `getCRMOverview` | `crm.leads.read` | — |
| `getHRHeadcount` | `hr.employees.read` | — (solo conteos, sin PII) |

Si el usuario no tiene el permiso de la tool, la tool **no se expone ni se ejecuta**.

## Modelo de datos `ai_interactions`

`companyId · userId · sessionId · provider · model · requestType(chat|analyze) · promptMetadata{questionLength, scope?, toolsAvailable[], toolsUsed[]} · responseMetadata{answerLength, refused} · tokensInput · tokensOutput · latencyMs · status(OK|ERROR|INVALID_RESPONSE|RATE_LIMITED|TIMEOUT) · errorCode? · createdAt (TTL AI_RETENTION_DAYS)` — texto completo solo con `AI_STORE_TEXT=true`; nunca secretos.

## Variables de entorno

```env
AI_ENABLED=false|true     # default: true solo si AI_PROVIDER=mock
AI_PROVIDER=mock|openai-compatible
AI_API_KEY=  AI_MODEL=  AI_BASE_URL=
AI_MAX_TOKENS=1024  AI_TEMPERATURE=0.2  AI_TIMEOUT_MS=20000
AI_RATE_LIMIT_MAX=20  AI_DAILY_USER_MAX=100  AI_DAILY_COMPANY_MAX=500
AI_RETENTION_DAYS=90  AI_STORE_TEXT=false
```

Swagger: `backend/docs/swagger.json` → paths `/api/v1/ai/chat`, `/api/v1/ai/analyze`, `/api/v1/ai/health` (tag `IA`).
