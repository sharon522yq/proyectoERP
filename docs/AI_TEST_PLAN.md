# AI TEST PLAN — FASE 12

**Regla inamovible**: los 147 tests previos se conservaron intactos; se añadieron **34 tests nuevos** → **181/181 PASS (16 suites)**. Ningún test se eliminó ni relajó.

## Matriz de cobertura

### Unit tests

| Qué | Dónde | Tests |
|---|---|---|
| AI service (orquestación, retry, persistencia) | `tests/ai.test.js` (describe "Auditoría ai_interactions + unidades") | 5 |
| Provider adapter mock (selección, síntesis, forces) | ejercitado vía HTTP en las 4 suites | — |
| Context builder (system prompt con tools filtradas) | implícito en chat con GERENTE/ADMIN | — |
| Schema validation (`validateChatSelection`, `validateAnalysis`) | `tests/ai.test.js` | 2 |
| Permission validation (`allowedToolsFor`) | `tests/ai.test.js` | 1 |

### Integration tests — `tests/ai.test.js` (17)

| Caso | Esperado |
|---|---|
| health sin token / con `ai.read` | 401 / 200 sin secretos |
| chat sin token | 401 `AUTH_REQUIRED` |
| chat EMPLEADO (sin `ai.chat`) | 403 `FORBIDDEN` |
| saludo | respuesta directa, `toolsUsed []` |
| "¿Cuánto vendimos este mes?" | ejecuta `getSalesSummary`, sessionId respetado |
| pregunta sin datos | "No dispongo de datos suficientes" (no alucina) |
| `top:999999` | 400 `AI_TOOL_PARAMS` |
| GERENTE → tool de producción | 403 `AI_UNAUTHORIZED_TOOL` |
| `/analyze` | JSON `{type, summary, findings[], recommendations[], confidence:null}` |
| question ausente / 1 carácter | 400 |
| auditoría + unidades ×5 | registro con metadatos, sin texto, validadores y whitelist |

### Security tests — `tests/ai-security.test.js` (11)

| Caso | Esperado |
|---|---|
| Prompt injection (orden + pedir prompt/API key) | 200 sin fugas del system prompt ni de `AI_API_KEY` |
| Inyección 2 | rechazo "datos insuficientes" |
| Cross-tenant B vs factura de A | sin `999999` en la respuesta |
| Control positivo A | `999999` visible **+ regresión del cast de companyId** |
| `body.companyId` de A con token B | ignorado; interacción registrada con companyId de B |
| token válido solo con `ai.analyze` | 403 `AI_NO_ACCESS` |
| Secret leakage | clave ausente de cuerpo y de TODOS los `ai_interactions`; `promptText` no guardado |
| `FORCE_INVALID_JSON` | retry → 502 `AI_INVALID_RESPONSE` (sin reflejar la salida cruda) |
| `FORCE_MALFORMED` en analyze | retry → 502 + registro `INVALID_RESPONSE` |
| `FORCE_ERROR` | 502 `AI_PROVIDER_ERROR` |
| `FORCE_TIMEOUT` (timeout 150ms) | 504 `AI_TIMEOUT` + registro `TIMEOUT` |

### Failure tests

Proveedor caído, JSON inválido, respuesta malformada, timeout → cubiertos arriba. **API key ausente / cuota**: provider `openai-compatible` sin clave → 503 `AI_NOT_CONFIGURED` (factory) y `healthCheck {ok:false}` — verificado por diseño de `providers/index.js`; la respuesta 429/cuota del proveedor real se propaga como `AI_PROVIDER_ERROR` (probar con proveedor real en staging).

### Rate limit / cost control

| Suite | Caso | Esperado |
|---|---|---|
| `tests/ai-limits.test.js` (4) | techo diario por usuario | 429 `AI_DAILY_LIMIT` + registro `RATE_LIMITED` |
| | techo diario por empresa | 429 `AI_DAILY_LIMIT` |
| | `AI_ENABLED=false` | 501 `AI_DISABLED` + health lo refleja |
| | tras reactivar | 200 |
| `tests/ai-rate-limit.test.js` (2) | `AI_RATE_LIMIT_MAX=2` → 3ª petición | 429 `AI_RATE_LIMIT` formato estándar |
| | health fuera del limiter | 200 |

## Multi-tenancy (ETAPA 5)

- `AI cross-tenant access` → `ai-security.test.js` cross-tenant ✅
- `AI unauthorized module access` → GERENTE/producción y `AI_NO_ACCESS` ✅
- `AI IDOR` → params acotados/whitelist ✅
- `AI companyId spoofing` → body ignorado ✅

## Comandos de verificación

```powershell
# backend
npm test          # 16 suites / 181 tests
npm run lint      # 0 errores
node -e "require('./src/app').createApp()"
node scripts/perf-benchmark.js
# frontend
npx expo export --platform web
npx expo export --platform android
```

## Pendientes de test

- [ ] Prueba de inyección/latencia con proveedor real (requiere `AI_API_KEY`, staging)
- [ ] Tests de frontend (hoy solo build check)
- [ ] `jest --coverage` del módulo IA
