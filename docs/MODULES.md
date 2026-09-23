# MÓDULOS DEL ERP

Última actualización: 2026-09-22

## Estructura de Módulos

```
backend/src/modules/
├── auth/           # Autenticación y autorización
├── users/          # Gestión de usuarios
├── roles/          # Gestión de roles y permisos
├── companies/      # Gestión de empresas (multiempresa)
├── branches/       # Gestión de sucursales
├── audit/          # Logs de auditoría
├── settings/       # Configuración del sistema
├── crm/            # CRM (leads, customers, contacts, activities)
├── products/       # Productos, categorías, unidades
├── inventory/      # Almacenes, stock, movimientos
├── sales/          # Cotizaciones, pedidos, facturas, pagos
├── purchases/      # Órdenes de compra
├── finance/        # Cuentas, transacciones
├── hr/             # Departamentos, empleados
├── projects/       # Proyectos y tareas
├── production/     # BOM, órdenes de producción, work orders
├── dashboard/      # Indicadores y reportes
└── ai/             # IA (pendiente)
```

## Arquitectura por Módulo

Cada módulo sigue el patrón:

```
module/
├── entity.model.js        # Mongoose schema + modelo
├── entity.repository.js   # Acceso a datos (CRUD)
├── entity.service.js      # Lógica de negocio
├── entity.controller.js   # Handlers HTTP
├── entity.routes.js       # Definición de rutas
└── entity.validation.js   # Validación de entrada
```

## Estado por Módulo

| Módulo | Estado | Fase | Tests | Archivos |
|---|---|---|---|---|
| Auth | ✅ COMPLETO | FASE 1 | 4 | 5 |
| Users | ✅ COMPLETO | FASE 1 | 1 | 3 |
| Roles | ✅ COMPLETO | FASE 1 | (seed) | 3 |
| Companies | ✅ COMPLETO | FASE 1 | 2 | 3 |
| Branches | ✅ COMPLETO | FASE 1 | 1 | 4 |
| Audit | ✅ COMPLETO | FASE 1 | 1 | 3 |
| Settings | ✅ COMPLETO | FASE 1 | 0 | 3 |
| CRM | ✅ COMPLETO | FASE 2 | 12 | 12 |
| Products | ✅ COMPLETO | FASE 3 | 6 | 12 |
| Inventory | ✅ COMPLETO | FASE 4 | 7 | 6 |
| Sales | ✅ COMPLETO | FASE 5 | 8 | 8 |
| Purchases | ✅ COMPLETO | FASE 6 | 3 | 4 |
| Finance | ✅ COMPLETO | FASE 7 | 4 | 5 |
| HR | ✅ COMPLETO | FASE 8 | 4 | 5 |
| Projects | ✅ COMPLETO | FASE 9 | 6 | 5 |
| Production | ✅ COMPLETO | FASE 10 | 19 | 8 |
| Dashboard | ✅ COMPLETO | FASE 11 | 8 | 3 |
| AI | ⏳ PENDIENTE | FASE 12 | — | — |

## Flujos de Negocio

### Ventas
```
Cotización (DRAFT) → Aprobación → Pedido (CONFIRMED) → Factura → Pago
```

### Producción
```
BOM → Orden de Producción → Consumo de Materiales → Producto Terminado → Entrada a Inventario
```

### Compras
```
Solicitud → Aprobación → Orden de compra → Recepción
```

### CRM
```
Lead → Conversión → Customer → Contactos → Actividades
```

### Inventario
```
Producto → Almacén → Entrada/Salida/Ajuste → Movimiento → Kardex
```

## Datos Semilla

### Roles (10)
- SUPER_ADMIN, ADMIN, GERENTE, FINANZAS, VENTAS, COMPRAS, ALMACEN, RRHH, PRODUCCION, EMPLEADO

### Unidades (12)
- Pieza, Kilogramo, Gramo, Litro, Mililitro, Metro, Centímetro, Metro cuadrado, Caja, Par, Docena, Tonelada

### Permisos (70+)
- users.*, roles.*, companies.*, branches.*, audit.*, settings.*
- crm.leads.*, crm.customers.*, crm.contacts.*, crm.activities.*
- products.*, categories.*, units.*
- inventory.*
- sales.quotes.*, sales.orders.*, sales.invoices.*, sales.payments.*
- purchases.*
- finance.accounts.*, finance.transactions.*
- hr.departments.*, hr.employees.*
- projects.*, projects.tasks.*
- production.bom.*, production.orders.*, production.work_orders.*
