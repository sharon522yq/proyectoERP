# ERP Modular — Sistema ERP Multiplataforma

Sistema ERP modular, multiplataforma y escalable construido con React Native + Node.js + MongoDB.

## Arquitectura

```
Modular Monolith + REST API
```

- **Frontend**: React Native + React Native Web
- **Backend**: Node.js + Express.js
- **Database**: MongoDB Atlas + Mongoose
- **Auth**: JWT (access + refresh tokens) + RBAC
- **Seguridad**: Helmet, CORS, Rate Limiting, bcrypt

## Módulos

| Módulo | Estado | Descripción |
|---|---|---|
| Auth | ✅ | Login, registro, refresh, logout, cambio/ reset contraseña |
| Users | ✅ | Gestión de usuarios con RBAC |
| Roles | ✅ | 10 roles predefinidos con permisos granulares |
| Companies | ✅ | Multiempresa con aislamiento de datos |
| Branches | ✅ | Multisucursal |
| Audit | ✅ | Logs de auditoría append-only |
| Settings | ✅ | Configuración por empresa |
| CRM | ✅ | Leads, customers, contacts, activities |
| Products | ✅ | Productos, categorías, unidades |
| Inventory | ✅ | Almacenes, stock, movimientos, kardex |
| Sales | ✅ | Cotizaciones → Pedidos → Facturas → Pagos |
| Purchases | ✅ | Órdenes de compra |
| Finance | ✅ | Cuentas, transacciones, resumen |
| HR | ✅ | Departamentos, empleados |
| Projects | ✅ | Proyectos y tareas |
| Production | ✅ | BOM, órdenes de producción, work orders, consumo de materiales |
| Dashboard | ✅ | Indicadores y reportes en tiempo real |

## Stack Tecnológico

### Backend
- Node.js 18+
- Express.js 4.x
- Mongoose 8.x
- JWT (jsonwebtoken)
- bcryptjs
- express-validator
- Helmet, CORS, Rate Limiting

### Base de datos
- MongoDB Atlas (producción)
- MongoDB Memory Server (tests)

### Testing
- Jest
- Supertest

## Instalación

### Requisitos
- Node.js 18+
- npm 9+
- MongoDB (local o Atlas)

### Pasos

```bash
# Clonar repositorio
git clone <repo-url>
cd Default\ Project

# Backend
cd backend
cp ../.env.example .env
npm install

# Configurar .env
# Editar MONGODB_URI con tu cadena de conexión a MongoDB Atlas

# Ejecutar tests
npm test

# Iniciar servidor
npm run dev
```

### Frontend (React Native + Web)

```bash
cd frontend
npm install
npm run web
# O para iniciar Expo en desarrollo móvil:
npm start
```

## Variables de Entorno

| Variable | Descripción | Default |
|---|---|---|
| NODE_ENV | Entorno | development |
| PORT | Puerto del servidor | 4000 |
| MONGODB_URI | Cadena de conexión MongoDB | — |
| JWT_SECRET | Secreto para access tokens | — |
| JWT_REFRESH_SECRET | Secreto para refresh tokens | — |
| JWT_ACCESS_EXPIRES | Tiempo de vida access token | 15m |
| JWT_REFRESH_EXPIRES_DAYS | Días de vida refresh token | 7 |
| FRONTEND_URL | URL del frontend | http://localhost:19006 |

**IMPORTANTE**: Nunca colocar secrets directamente en el código. Usar variables de entorno.

## API

### Health Check
```
GET /health
```

### Swagger
```
GET /docs
```

Documentación interactiva de todos los endpoints.

### Base URL
```
http://localhost:4000/api/v1/
```

### Autenticación
```bash
# Registrar usuario
curl -X POST http://localhost:4000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Admin","email":"admin@test.com","password":"Password123","role":"ADMIN"}'

# Login
curl -X POST http://localhost:4000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@test.com","password":"Password123"}'
```

### Endpoints Principales

| Método | Endpoint | Descripción |
|---|---|---|
| POST | /api/v1/auth/register | Registrar usuario |
| POST | /api/v1/auth/login | Iniciar sesión |
| POST | /api/v1/auth/refresh | Renovar token |
| GET | /api/v1/crm/leads | Listar leads |
| POST | /api/v1/crm/leads | Crear lead |
| POST | /api/v1/crm/leads/:id/convert | Convertir lead a customer |
| GET | /api/v1/products | Listar productos |
| POST | /api/v1/products | Crear producto |
| POST | /api/v1/inventory/stock/adjust | Ajustar stock |
| GET | /api/v1/inventory/kardex/:productId/:warehouseId | Kardex |
| POST | /api/v1/sales/quotes | Crear cotización |
| POST | /api/v1/sales/quotes/:id/approve | Aprobar cotización |
| POST | /api/v1/sales/quotes/:quoteId/order | Convertir a pedido |
| POST | /api/v1/sales/orders/:orderId/invoice | Crear factura |
| POST | /api/v1/sales/invoices/:invoiceId/payments | Registrar pago |
| POST | /api/v1/purchases | Crear orden de compra |
| GET | /api/v1/finance/summary | Resumen financiero |
| POST | /api/v1/hr/employees | Crear empleado |
| POST | /api/v1/projects | Crear proyecto |
| POST | /api/v1/production/bom | Crear BOM |
| POST | /api/v1/production/orders | Crear orden de producción |
| POST | /api/v1/production/orders/:id/consume | Consumir materiales |
| POST | /api/v1/production/orders/:id/complete | Completar producción |
| GET | /api/v1/dashboard | Dashboard completo |

Ver `docs/API.md` para documentación completa.

## Tests

```bash
cd backend
npm test
```

### Suites de prueba

| Suite | Tests | Descripción |
|---|---|---|
| core.test.js | 8 | Auth, users, companies, branches, audit |
| refresh.test.js | 1 | Refresh token rotation |
| crm-products.test.js | 19 | CRM + Products CRUD |
| inventory-sales.test.js | 15 | Inventory + Sales flow |
| purchases.test.js | 3 | Purchase orders |
| finance-hr.test.js | 8 | Finance + HR |
| projects.test.js | 7 | Projects + Tasks |
| production.test.js | 19 | BOM, Production Orders, Work Orders, Material Consumption |
| dashboard.test.js | 8 | Dashboard + Reports |
| e2e.test.js | 31 | End-to-end scenarios |
| **Total** | **119** | **All passing** |

## Seguridad

- JWT con access + refresh tokens
- Refresh token rotation (único por sesión)
- RBAC con 10 roles predefinidos
- Multiempresa con aislamiento de datos por companyId
- Bcrypt para hashing de contraseñas
- Helmet para headers de seguridad
- CORS configurado
- Rate limiting (300 req/15min)
- Validación de entrada con express-validator
- Auditoría de operaciones críticas
- Soft delete para trazabilidad

## Flujos de Negocio

### Ventas
```
Cotización (DRAFT) → Aprobación → Pedido → Confirmación → Factura → Pago
```

### Producción
```
BOM → Orden de Producción → Consumo de Materiales → Producto Terminado → Entrada a Inventario
```

### Compras
```
Solicitud → Aprobación → Orden de Compra → Recepción
```

## Documentación

- `docs/API.md` — Referencia completa de endpoints
- `docs/ARCHITECTURE.md` — Decisiones arquitectónicas
- `docs/DATABASE.md` — Schema de MongoDB
- `docs/MODULES.md` — Estado de módulos
- `docs/SECURITY.md` — Política de seguridad
- `docs/PROJECT_STATUS.md` — Estado del proyecto
- `docs/CHANGELOG.md` — Historial de cambios
- `docs/DECISIONS.md` — Decisiones técnicas
- `docs/QA_STATUS.md` — Estado de pruebas
- `docs/TODO.md` — Pendientes
- `backend/docs/swagger.json` — OpenAPI 3.0 spec

## Licencia

Proyecto privado.
