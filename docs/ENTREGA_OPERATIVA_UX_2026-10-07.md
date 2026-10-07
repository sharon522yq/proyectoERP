# Entrega operativa y experiencia de usuario

Implementación iniciada el 7 de octubre de 2026 desde main 0b9bb2c. Esta entrega aplica las correcciones críticas de la auditoría y conecta recorridos existentes del backend a interfaces de uso diario. No representa la finalización de todo el plan de expansión del ERP.

## Cambios por módulo

| Módulo | Recorrido de esta entrega | Límites que siguen vigentes |
| --- | --- | --- |
| CRM | Prospectos y catálogo de clientes/proveedores, alta y edición, búsqueda y paginación; eliminación protegida de leads existente conservada. | Clientes y proveedores comparten catálogo; clasificación comercial, actividades y contactos completos siguen pendientes. |
| Productos | Alta y edición de nombre, SKU, precio y costo; búsqueda paginada, activación y eliminación protegidas. | Faltan servicios, conversiones de unidades, variantes y listas de precios. |
| Ventas | Selector con búsqueda; almacén explícito para confirmar; preparación, envío y entrega; factura interna; cobros con saldo, método, referencia y protección de reintentos. | Devoluciones, reservas, crédito comercial, conciliación y PDF nativo Android pendientes. Factura interna, sin timbrado fiscal. |
| Compras | Crear borrador con proveedor, partidas e impuestos; confirmar; recibir completamente en el almacén elegido; cancelar antes de recepción. | Entregas parciales, devolución, cotizaciones de proveedor y conciliación de factura de proveedor pendientes. |
| Inventario | Actualización atómica de existencias y transacción con movimiento/auditoría; cantidades negativas de saldo rechazadas. Gestión de almacenes existente conservada. | Transferencias, reservas, lotes, series, caducidades, conteos y cantidades comerciales fraccionarias pendientes. |
| Finanzas | Nombres de cuentas, caja/banco, movimientos manuales con motivo e identidad de reintento, saldos atómicos y redondeados. | Transferencias entre cuentas todavía bloqueadas para evitar retiros unilaterales. Resumen operativo: no es libro contable de partida doble, conciliación bancaria ni cierre fiscal. |
| Personal | Alta, edición, búsqueda y paginación de fichas; activación/desactivación confirmada. | No crea cuentas de acceso, no ejecuta baja laboral, no calcula nómina. Departamentos y procesos laborales completos pendientes. |
| Proyectos | Alta/edición, presupuesto de referencia, tareas y estados; cierre bloqueado con tareas pendientes. | Asignación por interfaz, tiempos, costos reales y facturación por proyecto pendientes. |
| Producción | Crear receta; crear y recorrer orden; consumir materiales; finalizar; copia de materiales prevista por orden; reintentos sin duplicar consumo o terminado. | No hay mermas, fabricación parcial, devolución de consumos, control de calidad ni captura de órdenes de trabajo por pantalla. |
| Configuración | Personal, Proyectos, Producción e IA opcionales por empresa; menú y API respetan la configuración; registros conservados. | Esta configuración no otorga permisos, ni sustituye una membresía, licencia o suscripción. |
| Usuarios, Auditoría, IA | Se conservan las funciones anteriores y la auditoría de las nuevas acciones. | Invitaciones, permisos personalizados, sesiones por dispositivo, filtros avanzados de auditoría y validación del proveedor IA real siguen pendientes. |

## Integridad y seguridad

- Servicios anidados comparten la misma transacción MongoDB. Requiere réplica, como Atlas; las pruebas utilizan MongoDB temporal con réplica.
- Un fallo de Finanzas revierte pago/recepción, movimientos y estado. Un fallo de auditoría en una transacción también la revierte o permite el reintento completo del controlador MongoDB.
- Existencias se actualizan con una operación atómica y condición de saldo suficiente. Las cuentas financieras usan una actualización atómica con redondeo a centavos.
- Pagos y movimientos manuales admiten `requestId`, validan conflictos y tienen índices únicos parciales por empresa. No se registran contraseñas ni tokens.
- Los documentos se bloquean dentro de la transacción al modificar estados o registrar operaciones relacionadas. La selección de almacén valida empresa y estado activo.
- Las recetas se copian a las órdenes nuevas. Las órdenes antiguas sin copia usan su receta actual; no se inventa retrospectivamente una versión histórica.
- Producción no puede finalizar sin consumos completos. Cancelar con consumos exige resolver primero su devolución. Un proyecto cerrado rechaza tareas nuevas o modificaciones de tareas.
- Los índices críticos se inicializan antes de aceptar peticiones al arrancar. No se eliminan índices ni registros existentes.
- No se usan bases de producción para pruebas. No se agregan endpoints de inicialización públicos ni privilegios de administrador global.

## Experiencia de usuario

Selección con búsqueda, nombres en lugar de identificadores, acciones visibles según permisos, estados en español, explicación de sus consecuencias, confirmaciones para stock/consumos/cierres/configuración, prevención de doble pulsación, importes pendientes y errores recuperables. Las pantallas usan React Native para compartir código web y Android.

## Validación reproducible

Desde la raíz del repositorio:

```powershell
npm ci --no-audit --fund=false
npm --prefix backend run lint
npm --prefix backend test
node --test frontend/scripts/*.test.js
npm --prefix frontend run export:web
npm --prefix frontend run verify:web
```

Recorrido de navegador: `node backend/tests/operations-browser.qa.js`, con Chrome de QA en el puerto 9337. El procedimiento crea una base temporal, intercepta las solicitudes dirigidas a Render y las atiende en el backend aislado. No envía credenciales a producción. Resultados locales sanitizados en `C:/proyectoERP/.local/operations-browser-qa.json`; pruebas adicionales de catálogos y CRM conservadas.

Resultados ejecutados: instalación reproducible; lint sin errores; 27 suites y 248 pruebas de backend aprobadas; 19 pruebas del frontend aprobadas; exportación y verificación web aprobadas; 61 comprobaciones del recorrido operativo y 8 del recorrido CRM aprobadas con datos sintéticos. La regresión de catálogos pasó sus 45 comprobaciones, incluida eliminación, activación y gestión de almacenes. Una prueba adicional verifica que TRANSFER no registre un retiro unilateral; las transferencias vinculadas siguen pendientes. Registrar los resultados de CI y despliegue en el PR. No interpretar una exportación web o una compilación APK como prueba en Android físico.

## Continuidad del plan

La siguiente entrega debe cerrar terceros/unidades/servicios y membresías/sesiones por dispositivo; después, recepciones parciales, transferencias, reservas y devoluciones; luego cartera y conciliación. Contabilidad formal, nómina, trazabilidad por lote/serie y paquetes sectoriales requieren sus contratos de negocio y pruebas propias antes de activarse. Resend para destinatarios generales necesita dominio verificado. El plan detallado permanece en AUDITORIA_PRODUCCION_PLAN_2026-10-07.md.
