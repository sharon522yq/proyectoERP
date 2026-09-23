# QA TEST PLAN — Fase 1 Core

## Tests ejecutados — ✅ TODOS PASAN (9/9)

| ID | Módulo | Prueba | Resultado |
|---|---|---|---|
| QA-001 | Auth | Login válido | ✅ PASS |
| QA-002 | Auth | Login inválido → 401 | ✅ PASS |
| QA-003 | Roles | Sin permiso → 403 | ✅ PASS |
| QA-004 | Empresas | Crear empresa | ✅ PASS |
| QA-005 | Multiempresa | Aislamiento sucursales (cross-company 403) | ✅ PASS |
| QA-006 | Auth | Refresh rotativo (reuso → 401) | ✅ PASS |
| QA-007 | Empresas | Listar empresas | ✅ PASS |
| QA-008 | Auditoría | Operación genera log | ✅ PASS |
| QA-009 | Auth | Refresh: hash cambia en DB | ✅ PASS |

## Bugs encontrados y corregidos durante ejecución

| Bug | Causa | Fix |
|---|---|---|
| `findByIdAndUpdate` no persistía cambios | Mongoose 8 necesita `$set` explícito | Repository usa `updateOne` + `$set` |
| Refresh token no rotaba (mismo hash) | JWT sin `jti` → tokens idénticos en el mismo segundo | `signRefresh` incluye `jti: crypto.randomUUID()` |
| `$pull + $push` en mismo array fallaba | MongoDB no permite dos operadores en el mismo campo | Cambiado a `refreshTokenHash` (string, no array) |

## Pendientes de crear

| ID | Módulo | Prueba |
|---|---|---|
| QA-010 | Auth | Registro con email duplicado → 409 |
| QA-011 | Auth | Registro con contraseña corta → 400 |
| QA-012 | Users | Listar usuarios de otra empresa → 403 |
| QA-013 | Users | Desactivarse a sí mismo → 400 |
| QA-014 | Settings | PUT sin key → 400 |
| QA-015 | Branches | Listar sin companyId → 400 |

## Ejecución

```bash
cd backend && npm install && npm test
```
