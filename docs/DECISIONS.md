# DECISIONS

## D-001: API versioning to /api/v1/

**Fecha**: 2026-09-22
**Problema**: API actual usa /api/ sin versioning. A medida que se agregan módulos, se necesita compatibilidad.
**Alternativas**:
1. Mantener /api/ (sin versioning)
2. Cambiar a /api/v1/
**Ventajas v1**: Permite evolución sin romper clientes existentes.
**Desventajas v1**: Requiere actualizar todas las rutas existentes.
**Decisión**: Migrar a /api/v1/ progresivamente. Rutas viejas se mantiene temporalmente como alias.
**Impacto**: Menor. Solo cambio de prefijo en rutas.

## D-002: CRM con entidades separadas

**Fecha**: 2026-09-22
**Problema**: CRM puede implementarse como un solo modelo o como entidades separadas.
**Alternativas**:
1. Un solo modelo 'crm' con type field
2. Modelos separados: leads, customers, contacts, activities
**Ventajas 2**: Mejor separación de responsabilidades, esquemas más limpios, consultas más eficientes.
**Desventajas 2**: Más archivos, más rutas.
**Decisión**: Modelos separados. Cada entidad tiene su propio model/service/controller/routes.
**Impacto**: Mejor mantenibilidad a largo plazo.

## D-003: refreshTokenHash como string único

**Fecha**: 2026-09-21
**Problema**: Array de refresh tokens causaba race conditions y $pull/$push conflicts.
**Alternativas**:
1. Array de hashes con rotación
2. String único con rotación
**Ventajas 2**: Simple, sin race conditions, un solo update.
**Desventajas 2**: No permite múltiples sesiones activas.
**Decisión**: String único. Suficiente para FASE 1. Si se necesitan múltiples sesiones, migrar a collection.
**Impacto**: Menor para fase actual.

## D-004: Folios secuenciales con counters collection

**Fecha**: 2026-09-22
**Problema**: Documentos (quotes, orders, invoices, payments) necesitan folios únicos y secuenciales.
**Alternativas**:
1. UUID random
2. Timestamp-based
3. MongoDB counters collection
**Ventajas 3**: Secuencial, legible, único bajo concurrencia.
**Desventajas 3**: Requiere collection adicional.
**Decisión**: Usar MongoDB `counters` collection con `findOneAndUpdate` + `$inc`. Prefijo + secuencia (ej: FAC-000001).
**Impacto**: Folios consistentes y únicos.

## D-005: Stock como campo computed + movements como source of truth

**Fecha**: 2026-09-22
**Problema**: Inventario puede ser simple (campo stock) o completo (movimientos + stock).
**Alternativas**:
1. Solo campo stock en producto
2. Campo stock en inventory + historial de movimientos
3. Solo movimientos (stock = suma de movimientos)
**Ventajas 2**: Rápido para queries de stock, pero mantiene historial completo.
**Desventajas 2**: Dual write (stock + movement).
**Decisión**: Opción 2. Campo `quantity` en inventory para queries rápidas + movements como audit trail. Movements es source of truth.
**Impacto**: Mejor rendimiento en queries comunes + trazabilidad completa.

## D-006: scopeCompany fallback a DB

**Fecha**: 2026-09-22
**Problema**: JWT no siempre tiene companyId (usuarios creados antes de asignar empresa).
**Alternativas**:
1. Re-login obligatorio después de asignar empresa
2. Fallback a DB lookup
**Ventajas 2**: Transparente para el usuario, no requiere re-login.
**Desventajas 2**: Extra DB query per request cuando no hay companyId en JWT.
**Decisión**: Implementar fallback. Buscar companyId en DB si no está en JWT. Se optimizará cuando se implemente refresh token renewal.
**Impacto**: Menor. Solo una query extra cuando el token no tiene companyId.

## D-007: Validación de transiciones de estado

**Fecha**: 2026-09-22
**Problema**: Los módulos de ventas, producción y compras manejan estados. Sin validación, se pueden hacer transiciones inválidas.
**Alternativas**:
1. Sin validación (cualquier estado a cualquier estado)
2. Matriz de transiciones válidas
**Ventajas 2**: Previene estados inconsistentes, mejora trazabilidad.
**Desventajas 2**: Más código de validación.
**Decisión**: Implementar matriz de transiciones válidas en service layer. Ejemplo: DRAFT → PLANNED → RELEASED → IN_PROGRESS → COMPLETED.
**Impacto**: Integridad de datos mejorada.

## D-008: Permisos granulares por módulo

**Fecha**: 2026-09-22
**Problema**: Los módulos Fase 2-9 usaban permisos genéricos (products.create) en vez de permisos específicos (sales.quotes.create).
**Alternativas**:
1. Permisos genéricos reutilizados
2. Permisos granulares por módulo
**Ventajas 2**: Control más fino, mejor seguridad, roles más flexibles.
**Desventajas 2**: Más permisos que gestionar (70+ vs 20).
**Decisión**: Permisos granulares. Cada operación crítica tiene su propio permiso. Roles se configuran con los permisos necesarios.
**Impacto**: Seguridad mejorada. Un usuario VENTAS solo puede ver lo que necesita.

## D-009: Producción con BOM y consumo de materiales

**Fecha**: 2026-09-22
**Problema**: El módulo de producción debe manejar recetas (BOM), consumo de materiales y generación de producto terminado.
**Alternativas**:
1. Producción simple (solo entrada a inventario)
2. BOM + consumo + salida de materia prima + entrada de producto terminado
**Ventajas 2**: Trazabilidad completa, costos precisos, integridad de inventario.
**Desventajas 2**: Más complejo, requiere transacciones.
**Decisión**: Opción 2. BOM define composición. Al consumir, se genera movimiento SALE_EXIT por cada materia prima. Al completar, se genera PURCHASE_ENTRY del producto terminado. Validación de stock antes de consumir.
**Impacto**: Costos de producción precisos. Inventario siempre consistente.

## D-010: Enlaces cross-module Venta/Compra ↔ Inventario/Finanzas

**Fecha**: 2026-09-22 (Auditoría Final)
**Problema**: Confirmar un pedido de venta no descontaba stock; recibir una compra no daba de alta stock; facturas no generaban Cuentas por Cobrar ni Cuentas por Pagar. Los módulos existían pero estaban desconectados.
**Alternativas**:
1. Dejarlo manual (documentar como PARCIAL)
2. Enlaces automáticos en los puntos de estado relevantes
**Ventajas 2**: Flujos ERP completos, inventario y finanzas siempre reflejan la operación.
**Desventajas 2**: Acoplamiento entre módulos (aceptable en monolito modular); requiere matriz de transiciones estricta para ejecutar cada enlace exactamente una vez.
**Decisión**: Opción 2.
- Venta: al pasar a `CONFIRMED` → salida `SALE_EXIT` por producto (con pre-validación de stock total, almacén por defecto de la empresa, referencia `SALES_ORDER`).
- Venta: al crear factura → asiento automático `CxC` (cuenta 1200, ASSET). Al registrar pago → `Caja y bancos` (1000, INCOME) + `CxC` (1200, EXPENSE), partida doble vía dos transacciones.
- Compra: al pasar a `RECEIVED` → entrada `PURCHASE_ENTRY` (referencia `PURCHASE_ORDER`) + reconocimiento de `CxP` (cuenta 2100, LIABILITY).
- Cuentas del catálogo operativo (1000/1200/2100) se crean automáticamente por empresa bajo demanda (`getOrCreateSystemAccount`).
- La salida/entrada ocurre una sola vez gracias a la matriz D-007 (no se puede re-entrar en CONFIRMED/RECEIVED).
**Impacto**: Integración VENTA/COMPRA/PRODUCCIÓN con inventario y finanzas verificada por tests (`tests/audit-integration.test.js`).

## D-011: Registro público no privilegiado por defecto

**Fecha**: 2026-09-22 (Auditoría Final)
**Problema**: `POST /auth/register` aceptaba `role` y `companyId` libres: cualquier usuario no autenticado podía registrarse como ADMIN de una empresa existente (OWASP A01, escalada de privilegios crítica).
**Alternativas**:
1. Desactivar el registro público
2. Restringirlo siempre a EMPLEADO (rompe el setup de tests)
3. Política por entorno (elegido)
**Decisión**: Opción 3. El registro privilegiado (elegir rol/empresa) solo aplica en `NODE_ENV=test`, o cuando `ALLOW_PRIVILEGED_REGISTER=true` explícitamente (entornos de desarrollo controlados). En cualquier otro entorno (producción, staging) el registro público crea usuarios con rol `EMPLEADO` y sin `companyId`; el alta en una empresa la hace un admin autenticado (`users.create`).
Además: en `NODE_ENV=production` el backend **no arranca** si `JWT_SECRET`/`JWT_REFRESH_SECRET` son los de desarrollo, miden < 32 caracteres o son iguales entre sí (fail-fast en `config/env.js`).
**Impacto**: Cerrada vulnerabilidad crítica de escalada/tenant-takeover. Tests existentes sin cambios (corren en test).

## D-012: Adaptador de proveedor IA mock + openai-compatible

**Fecha**: 2026-09-22 (FASE 12)
**Problema**: acoplar el ERP a un proveedor LLM concreto (Gemini/OpenAI/Claude) obligaría a reescribir la integración al cambiar de proveedor, y los tests/CI no pueden depender de claves ni de red.
**Alternativas**:
1. SDK oficial de un proveedor concreto integrado directamente
2. Interfaz propia `AIProvider` + adapters intercambiables (elegido)
**Decisión**: Opción 2. Interfaz con `generateText/generateStructured/analyze/healthCheck` y factory por `AI_PROVIDER`:
- `mock` (default): determinista, sin red ni claves; ejercita la tubería completa (tools, permisos, companyId, validación, auditoría) en tests/CI/desarrollo. Sus hooks `FORCE_*` solo alteran su propia salida y no eluden permisos (testeado).
- `openai-compatible`: HTTP genérico chat-completions (`AI_BASE_URL`) que cubre OpenAI, Gemini (endpoint compatible), DeepSeek, Groq y Ollama local.
**Impacto**: cambio de proveedor = variables de entorno; añadir proveedor nativo = un fichero + registrar en la factory. Recomendación técnica y comparativa en `docs/AI_PROVIDER_DECISION.md` (sin precios inventados: a verificar antes de producción).

## D-013: Habilitación de IA por entorno (kill-switch)

**Fecha**: 2026-09-22 (FASE 12)
**Problema**: un proveedor real consume dinero y puede filtrar datos; no puede activarse implícitamente.
**Decisión**: `AI_ENABLED` es kill-switch global (501 `AI_DISABLED`). Default: habilitado SOLO cuando `AI_PROVIDER=mock`; con cualquier proveedor real exige `AI_ENABLED=true` explícito además de `AI_API_KEY/AI_BASE_URL/AI_MODEL` (si no → 503 `AI_NOT_CONFIGURED`, nunca claves a medias). Los límites diarios/por IP y `AI_MAX_TOKENS/AI_TIMEOUT_MS` aplican siempre.
**Impacto**: producción debe configurar y verificar el proveedor de forma deliberada; desarrollo y tests funcionan sin secretos.

## D-014: Auditoría y retención de interacciones IA

**Fecha**: 2026-09-22 (FASE 12)
**Problema**: registrar interacciones con IA puede acumular PII, prompts inyectados o secretos si se guarda el texto completo.
**Decisión**: la colección **nueva** `ai_interactions` (no existía) es el registro de auditoría del módulo. Guarda solo metadatos (empresa, usuario, sesión, proveedor, modelo, tipo, longitud de pregunta/respuesta, tools disponibles/usadas, tokens, latencia, status, errorCode). El texto completo NO se guarda salvo `AI_STORE_TEXT=true` (revisar antes de producción). Retención por TTL: `expireAfterSeconds = AI_RETENTION_DAYS·86400` (default 90 días). Nunca API keys ni credenciales (test automático). Los límites diarios se registran con `status=RATE_LIMITED`.
**Impacto**: trazabilidad completa del uso de IA sin retener datos sensibles por defecto.
