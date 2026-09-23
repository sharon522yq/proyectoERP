# AI PROVIDER DECISION — FASE 12

**Fecha**: 2026-09-22
**Estado**: Recomendación técnica basada en criterios; **ningún precio está inventado** en este documento. Todo dato económico/kuota marcado como *[verificar]* debe confirmarse en el sitio del proveedor antes de producción.

---

## 1. Criterios de comparación

Costo · Contexto · Generación estructurada JSON · Latencia · Disponibilidad · Límites · Seguridad/compliance · Facilidad de integración · Tool/function calling · Análisis de datos · Portabilidad (cambio posterior de proveedor).

## 2. Comparativa técnica

| Proveedor | Contexto | JSON estructurado | Tool calling | Latencia | Portabilidad | Notas técnicas | Costo/kuotas |
|---|---|---|---|---|---|---|---|
| **Google Gemini** (API nativa o endpoint *compatible con OpenAI*) | Ventanas amplias de contexto (verificar modelo) | Sí (response schema / modo JSON) | Sí | Baja-media | Alta vía endpoint compatible | Buena integración con datos tabulares; quota gratuita para desarrollo | *[verificar precios y cuotas en ai.google.dev]* |
| **OpenAI** (GPT) | Amplia (verificar modelo) | Sí (JSON mode / structured outputs) | Sí (maduro) | Baja | Estándar *de facto* del mercado | Mayores bibliotecas y ejemplos; máxima compatibilidad de herramientas | *[verificar precios en platform.openai.com]* |
| **Anthropic Claude** | Amplia (verificar modelo) | Sí (tool use + JSON) | Sí | Baja-media | API propia (no compatible con *chat completions* estándar) | Buen razonamiento largo; SDK oficial Node | *[verificar en anthropic.com]* |
| **DeepSeek** | Media-alta (verificar modelo) | Sí | Sí | Variable | Alta (compatible OpenAI) | Coste orientativo bajo según fuentes públicas *[verificar]* | *[verificar]* |
| **Groq / Mistral** | Media (verificar modelo) | Sí | Sí | Muy baja (inferencia rápida) | Alta (compatible OpenAI) | Adecuado para asistente conversacional de baja latencia | *[verificar]* |
| **Ollama local** | Según modelo | Parcial (depende del modelo) | Parcial (mejor en modelos grandes) | Local | Alta (compatible OpenAI) | **Datos nunca salen del servidor**; requiere hardware propio | Sin coste por uso; coste de infraestructura *[verificar]* |
| **Azure OpenAI** | Igual que OpenAI | Sí | Sí | Baja | API propia + SDK | Enterprise: contratos/SLA y residencia de datos *[verificar]* | *[verificar]* |

> Los valores concretos de ventana de contexto, precios por token, límites de tasa y SLA **deben verificarse en la documentación oficial vigente** antes de fijar la configuración de producción. Este documento no afirma cifras.

## 3. Evaluación ponderada (1–5, 5 = mejor)

| Criterio | Gemini | OpenAI | Claude | DeepSeek | Groq | Ollama |
|---|---|---|---|---|---|---|
| JSON estructurado fiable | 5 | 5 | 4 | 4 | 4 | 3 |
| Tool calling | 5 | 5 | 5 | 4 | 4 | 3 |
| Análisis de datos tabulares | 5 | 4 | 4 | 4 | 3 | 3 |
| Latencia | 4 | 5 | 4 | 3 | 5 | 3* |
| Costo | 4 | 3 | 3 | 5 | 4 | 5 |
| Facilidad de integración | 4 | 5 | 3 | 4 | 4 | 4 |
| Seguridad/residencia de datos | 4 | 4 | 4 | 3 | 4 | 5 |
| Portabilidad (evitar *lock-in*) | 4 | 4 | 2 | 4 | 4 | 5 |
| **Total** | **35** | **35** | **30** | **31** | **34** | **36*** |

\* Ollama gana en costo/seguridad pero la latencia/calidad depende del hardware local; sin garantías de disponibilidad fuera de la red interna.

## 4. Recomendación técnica

1. **Arquitectura primero, proveedor segundo.** El ERP no se acopla a ningún proveedor: `AIProvider` (interfaz) + factory `providers/index.js`. Cambiar de proveedor = cambiar `AI_PROVIDER`/`AI_BASE_URL`/`AI_API_KEY`/`AI_MODEL`.
2. **Adapter de implementación: `openai-compatible` (HTTP chat-completions).** Es el estándar con mayor adopción: sirve para OpenAI, Gemini (endpoint compatible), DeepSeek, Groq y **Ollama local** con el mismo código.
3. **Proveedor recomendado para producción (elección del usuario, reversible):**
   - **Opción A — Gemini** (vía endpoint compatible): mejor valoración combinada para análisis de datos del ERP + capacidades gratuitas para desarrollo. *Requiere verificar cuotas/precios actuales.*
   - **Opción B — Ollama local**: si la política de la empresa exige que **ningún dato salga del servidor** (máxima privacidad; sin coste por token; requiere hardware).
   - Cualquier otro proveedor de la tabla es compatible sin tocar el código del ERP.
4. **Default del sistema**: `AI_PROVIDER=mock` (sin claves, determinista) → los tests, CI y el desarrollo funcionan sin credenciales ni costo. Producción cambia variables de entorno.

## 5. Variables que deben configurarse/verificarse antes de producción

```env
AI_ENABLED=false            # kill-switch global (false → 501 AI_DISABLED)
AI_PROVIDER=mock            # mock | openai-compatible  (o futuro adapter nativo)
AI_API_KEY=                 # NUNCA en el repo; gestor de secretos en producción
AI_MODEL=                   # modelo exacto a usar [verificar disponibilidad]
AI_BASE_URL=                # p.ej. endpoint del proveedor elegido [verificar]
AI_MAX_TOKENS=1024          # techo por respuesta
AI_TEMPERATURE=0.2
AI_TIMEOUT_MS=20000
AI_RATE_LIMIT_MAX=20        # peticiones/15min por IP
AI_DAILY_USER_MAX=100       # techo diario por usuario
AI_DAILY_COMPANY_MAX=500    # techo diario por empresa
AI_RETENTION_DAYS=90        # TTL de ai_interactions
AI_STORE_TEXT=false         # no guardar prompt/respuesta íntegros
```

**Antes de producción, verificar obligatoriamente**: precio por token y cuotas del proveedor elegido, modelo concreto disponible, límites de tasa, tratamiento de datos (residencia/retención) y condiciones de uso para datos empresariales.

## 6. Justificación de la decisión (trazabilidad)

| # | Decisión | Justificación |
|---|---|---|
| D-012 | Adaptador `openai-compatible` + `MockProvider` | Desacople total; tests offline sin claves; portabilidad máxima |
| D-013 | Proveedor de producción elegible por env (Gemini / Ollama / otro compatible) | Coste, privacidad y legal son decisión del usuario; el código no cambia |
