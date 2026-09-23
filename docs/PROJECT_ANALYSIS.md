# PROJECT ANALYSIS — ERP Multiplataforma (FASE 0)

Fecha: 2026-09-21 (última revisión: 2026-09-21)
Estado: **FASE 1 COMPLETADA — 9/9 TESTS PASAN**
Repo Git: NO inicializado

## Estado actual

Código FASE 1 completo, code reviewed, corregido y **ejecutado con éxito**:
- Backend: auth, users, roles, companies, branches, audit, settings
- Frontend: Login + Dashboard con refresh automático
- Tests: 9/9 PASS (Jest + mongodb-memory-server)
- Node.js v24.21.0 + npm 11.19.0 instalados

## Bugs encontrados y corregidos (13 en total)

### Code Review inicial (10)
| # | Severidad | Fix |
|---|---|---|
| 1 | CRÍTICO | Settings PUT sin validación → `settings.validation.js` |
| 2 | ALTO | Branch service recibía `req` → patrón `ctx` |
| 3 | ALTO | Auth refresh race condition → actualización secuencial |
| 4 | MEDIO | Company update sin whitelist → `ALLOWED_UPDATE_FIELDS` |
| 5 | MEDIO | User update mutaba `req.body` → whitelist |
| 6 | MEDIO | CORS solo 1 origin → handler dinámico |
| 7 | MEDIO | Rate-limit sin handler JSON → `{success,message,code}` |
| 8 | BAJO | Auth resetPassword require dinámico → import estático |
| 9 | BAJO | Tests compartían estado → emails únicos |
| 10 | BAJO | Frontend sin refresh auto → interceptor con retry |

### Bugs durante ejecución (3)
| # | Severidad | Fix |
|---|---|---|
| 11 | CRÍTICO | `findByIdAndUpdate` no persistía → `updateOne` + `$set` explícito |
| 12 | CRÍTICO | Refresh tokens idénticos (sin `iat` diferenciador) → `jti: crypto.randomUUID()` |
| 13 | ALTO | `$pull + $push` en mismo array fallaba → `refreshTokenHash` (string) |

## Estructura definitiva

```
ERP/
├── backend/
│   ├── src/
│   │   ├── config/          (env.js, db.js, permissions.js)
│   │   ├── middlewares/      (auth.js, http.js, audit.js)
│   │   ├── modules/
│   │   │   ├── auth/         (service, controller, routes, validation)
│   │   │   ├── users/        (model, repository, service, controller, routes, validation)
│   │   │   ├── roles/        (model, service, controller, routes)
│   │   │   ├── companies/    (model, repository, service, controller, routes, validation)
│   │   │   ├── branches/     (model, repository, service, controller, routes, validation)
│   │   │   ├── audit/        (model, service, controller, routes)
│   │   │   └── settings/     (model, routes, validation)
│   │   └── utils/ApiError.js
│   ├── tests/               (core.test.js, refresh.test.js)
│   ├── package.json
│   └── jest.config.js
├── frontend/
│   ├── src/
│   │   ├── context/AuthContext.js
│   │   ├── services/api.js
│   │   ├── screens/{LoginScreen,DashboardScreen}.js
│   │   └── constants/config.js
│   └── App.js
├── docs/                    (7 archivos .md)
├── .env.example
├── .gitignore
├── README.md
└── package.json
```

## Supuestos documentados

1. Node 20 LTS baseline (instalado v24.21.0)
2. `permissions` = catálogo versionado (no colección CRUD)
3. Frontend FASE 1: Login + Dashboard mínimo
4. Forgot-password: sin email real; token en dev/test
5. Refresh token: string único (`refreshTokenHash`), rotación con `jti`
6. Repository update: siempre `updateOne` + `$set` explícito

## Siguiente paso: FASE 2

Backend: clients, suppliers, products, categories, warehouses, inventory_movements.
Frontend: pantallas CRUD básicas.
