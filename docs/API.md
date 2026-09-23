# API REFERENCE

Última actualización: 2026-09-22

Base URL: `http://localhost:4000`

## Autenticación

Todos los endpoints requieren `Authorization: Bearer <token>` excepto:
- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/forgot-password`
- `POST /api/v1/auth/reset-password`
- `GET /health`

## Formato de Respuesta

### Éxito
```json
{
  "success": true,
  "data": { ... }
}
```

### Error
```json
{
  "success": false,
  "message": "Descripción del error",
  "code": "ERROR_CODE"
}
```

### Paginación
```json
{
  "success": true,
  "data": {
    "items": [...],
    "total": 100,
    "page": 1,
    "limit": 20
  }
}
```

Query params: `?page=1&limit=20`

---

## Auth

| Método | Endpoint | Descripción | Auth |
|---|---|---|---|
| POST | `/api/v1/auth/register` | Registrar usuario | No |
| POST | `/api/v1/auth/login` | Login | No |
| POST | `/api/v1/auth/refresh` | Renovar access token | Refresh token |
| POST | `/api/v1/auth/logout` | Cerrar sesión | Sí |
| PUT | `/api/v1/auth/change-password` | Cambiar contraseña | Sí |
| POST | `/api/v1/auth/forgot-password` | Solicitar reset (dev: devuelve token) | No |
| POST | `/api/v1/auth/reset-password` | Resetear contraseña | No |

## Users

| Método | Endpoint | Descripción | Permiso |
|---|---|---|---|
| GET | `/api/v1/users` | Listar usuarios | users.read |
| PUT | `/api/v1/users/:id` | Actualizar usuario | users.update |

## Roles

| Método | Endpoint | Descripción | Permiso |
|---|---|---|---|
| GET | `/api/v1/roles` | Listar roles | roles.read |

## Companies

| Método | Endpoint | Descripción | Permiso |
|---|---|---|---|
| POST | `/api/v1/companies` | Crear empresa | companies.create |
| GET | `/api/v1/companies` | Listar empresas | companies.read |
| GET | `/api/v1/companies/:id` | Obtener empresa | companies.read |
| PUT | `/api/v1/companies/:id` | Actualizar empresa | companies.update |

## Branches

| Método | Endpoint | Descripción | Permiso |
|---|---|---|---|
| POST | `/api/v1/branches` | Crear sucursal | branches.create |
| GET | `/api/v1/branches` | Listar sucursales | branches.read |
| GET | `/api/v1/branches/:id` | Obtener sucursal | branches.read |
| PUT | `/api/v1/branches/:id` | Actualizar sucursal | branches.update |

## CRM

| Método | Endpoint | Descripción | Permiso |
|---|---|---|---|
| POST | `/api/v1/crm/leads` | Crear lead | crm.leads.create |
| GET | `/api/v1/crm/leads` | Listar leads | crm.leads.read |
| GET | `/api/v1/crm/leads/:id` | Obtener lead | crm.leads.read |
| PUT | `/api/v1/crm/leads/:id` | Actualizar lead | crm.leads.update |
| DELETE | `/api/v1/crm/leads/:id` | Eliminar lead | crm.leads.delete |
| POST | `/api/v1/crm/leads/:id/convert` | Convertir a customer | crm.leads.update |
| POST | `/api/v1/crm/customers` | Crear customer | crm.customers.create |
| GET | `/api/v1/crm/customers` | Listar customers | crm.customers.read |
| GET | `/api/v1/crm/customers/:id` | Obtener customer | crm.customers.read |
| PUT | `/api/v1/crm/customers/:id` | Actualizar customer | crm.customers.update |
| DELETE | `/api/v1/crm/customers/:id` | Eliminar customer | crm.customers.delete |
| POST | `/api/v1/crm/customers/:customerId/contacts` | Crear contacto | crm.contacts.create |
| GET | `/api/v1/crm/customers/:customerId/contacts` | Listar contactos | crm.contacts.read |
| POST | `/api/v1/crm/activities` | Crear actividad | crm.activities.create |
| GET | `/api/v1/crm/activities` | Listar actividades | crm.activities.read |

## Products

| Método | Endpoint | Descripción | Permiso |
|---|---|---|---|
| POST | `/api/v1/products/categories` | Crear categoría | categories.create |
| GET | `/api/v1/products/categories` | Listar categorías | categories.read |
| POST | `/api/v1/products` | Crear producto | products.create |
| GET | `/api/v1/products` | Listar productos | products.read |
| GET | `/api/v1/products?search=X` | Buscar productos | products.read |
| GET | `/api/v1/products/:id` | Obtener producto | products.read |
| PUT | `/api/v1/products/:id` | Actualizar producto | products.update |
| DELETE | `/api/v1/products/:id` | Eliminar producto | products.delete |

## Inventory

| Método | Endpoint | Descripción | Permiso |
|---|---|---|---|
| POST | `/api/v1/inventory/warehouses` | Crear almacén | branches.create |
| GET | `/api/v1/inventory/warehouses` | Listar almacenes | branches.read |
| GET | `/api/v1/inventory/stock` | Consultar stock | branches.read |
| POST | `/api/v1/inventory/stock/adjust` | Ajustar stock | branches.update |
| GET | `/api/v1/inventory/movements` | Historial de movimientos | branches.read |
| GET | `/api/v1/inventory/kardex/:productId/:warehouseId` | Kardex | branches.read |

## Sales

| Método | Endpoint | Descripción | Permiso |
|---|---|---|---|
| POST | `/api/v1/sales/quotes` | Crear cotización | products.create |
| GET | `/api/v1/sales/quotes` | Listar cotizaciones | products.read |
| POST | `/api/v1/sales/quotes/:id/approve` | Aprobar cotización | products.update |
| POST | `/api/v1/sales/quotes/:quoteId/order` | Convertir a pedido | products.create |
| GET | `/api/v1/sales/orders` | Listar pedidos | products.read |
| PUT | `/api/v1/sales/orders/:id/status` | Actualizar estado | products.update |
| POST | `/api/v1/sales/orders/:orderId/invoice` | Crear factura | products.create |
| GET | `/api/v1/sales/invoices` | Listar facturas | products.read |
| POST | `/api/v1/sales/invoices/:invoiceId/payments` | Registrar pago | products.create |
| GET | `/api/v1/sales/payments` | Listar pagos | products.read |

## Purchases

| Método | Endpoint | Descripción | Permiso |
|---|---|---|---|
| POST | `/api/v1/purchases` | Crear orden de compra | products.create |
| GET | `/api/v1/purchases` | Listar órdenes | products.read |
| PUT | `/api/v1/purchases/:id/status` | Actualizar estado | products.update |

## Finance

| Método | Endpoint | Descripción | Permiso |
|---|---|---|---|
| GET | `/api/v1/finance/summary` | Resumen financiero | settings.read |
| POST | `/api/v1/finance/accounts` | Crear cuenta | settings.update |
| GET | `/api/v1/finance/accounts` | Listar cuentas | settings.read |
| GET | `/api/v1/finance/accounts/:id` | Obtener cuenta | settings.read |
| POST | `/api/v1/finance/transactions` | Crear transacción | settings.update |
| GET | `/api/v1/finance/transactions` | Listar transacciones | settings.read |

## HR

| Método | Endpoint | Descripción | Permiso |
|---|---|---|---|
| POST | `/api/v1/hr/departments` | Crear departamento | users.create |
| GET | `/api/v1/hr/departments` | Listar departamentos | users.read |
| POST | `/api/v1/hr/employees` | Crear empleado | users.create |
| GET | `/api/v1/hr/employees` | Listar empleados | users.read |
| GET | `/api/v1/hr/employees/:id` | Obtener empleado | users.read |
| PUT | `/api/v1/hr/employees/:id` | Actualizar empleado | users.update |

## Projects

| Método | Endpoint | Descripción | Permiso |
|---|---|---|---|
| POST | `/api/v1/projects` | Crear proyecto | users.create |
| GET | `/api/v1/projects` | Listar proyectos | users.read |
| GET | `/api/v1/projects/:id` | Obtener proyecto | users.read |
| PUT | `/api/v1/projects/:id` | Actualizar proyecto | users.update |
| POST | `/api/v1/projects/tasks` | Crear tarea | users.create |
| GET | `/api/v1/projects/tasks` | Listar tareas | users.read |
| PUT | `/api/v1/projects/tasks/:id` | Actualizar tarea | users.update |

## IA

| Método | Endpoint | Descripción |
|---|---|---|
| * | `/api/v1/ai/*` | 501 Not Implemented |

## Health

| Método | Endpoint | Descripción |
|---|---|---|
| GET | `/health` | Health check |
