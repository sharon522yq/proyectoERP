# Auditoría de módulos de NexusERP

Auditoría sobre main a3502e7. Las pruebas usan MongoDB temporal separado y datos sintéticos. La revisión de Atlas de Nexus fue exclusivamente de lectura. No se crearon ventas ni pagos de prueba en producción.

## Resultados por módulo

| Módulo | Comprobado | Limitación de interfaz |
| --- | --- | --- |
| Dashboard | Inicio de sesión y navegación a las doce pantallas | Las métricas de facturación no demuestran cobros |
| CRM | Alta de lead y conversión cubiertas por pruebas; pantalla carga | Sin gestión completa de contactos, actividades ni clientes |
| Productos | Alta, búsqueda, listado, eliminación y activación/desactivación; API cubierta por pruebas | Sin edición de campos ni paginación completa |
| Inventario | Almacenes con detalle, edición, baja, activación, existencias, ajustes e historial; API y pantalla | Sin transferencias entre almacenes en pantalla |
| Ventas | Cotización, pedido, confirmación e invoice interna; pruebas transaccionales | Sin formulario de cobros; PDF web usa diálogo de impresión; Android comparte texto |
| Compras | API de órdenes/recepción cubierta y listado carga | Faltan formularios de proveedores, alta y recepción |
| Finanzas | Resumen y movimientos; pantalla verifica activos sintéticos | Faltan formularios contables; no certifica contabilidad fiscal |
| RRHH | API y listado de empleados | Faltan formularios de empleados y departamentos |
| Proyectos | API y listado de proyectos | Faltan formularios de proyectos y tareas |
| Producción | API y listado de órdenes | Faltan formularios de BOM y ejecución |
| Usuarios y roles | Aislamiento/permisos cubiertos; listado de administrador de empresa | Sin gestión completa de roles; no otorga administración global |
| Auditoría | Registro y consulta cubiertos; pantalla carga | Sin filtros, exportación ni paginación completa |
| Asistente IA | Permisos y estado deshabilitado explícito comprobados | Proveedor real y respuestas en producción pendientes |

## Correcciones

Finanzas leía `balance`, campo que no devuelve la API. Ahora muestra activos, pasivos e ingreso neto. Los errores al cargar ya no se ocultan como cifras cero. Dos pruebas de renderizado verifican el contrato y la presentación de errores.

El ajuste de inventario ahora activa y libera su estado de guardado, evitando clics repetidos durante una operación.

## Evidencia y alcance

- Backend: lint aprobado; 25 suites y 226 pruebas aprobadas, incluyendo autenticación, sesiones, recuperación, aislamiento, permisos y operaciones de módulos.
- Frontend: 13 pruebas aprobadas; exportación web aprobada.
- Navegador: recorrido de las doce pantallas con backend real y MongoDB temporal. IA deshabilitada intencionalmente devuelve 501. Los 401 de restauración previos al login se distinguen de las solicitudes autenticadas.
- Atlas de Nexus, lectura: 1 usuario, cliente, lead, producto, almacén, registro de inventario, cotización, pedido, factura, cuenta y movimiento financiero; 28 registros de auditoría. Compras, empleados, proyectos y producción sin registros en esa lectura.
- No se comprobó impresión física, ejecución en Android físico, persistencia nativa al cerrar la aplicación, proveedor real de IA ni operaciones nuevas contra producción.
- La sesión nativa se conserva en memoria; su persistencia segura entre arranques requiere implementación adicional.

## Prioridades restantes

1. Conectar los formularios faltantes de compras, RRHH, proyectos y producción con sus APIs y añadir recorridos completos.
2. Completar cobros, edición de catálogos, contactos, tareas y gestión de permisos de empresa.
3. Añadir paginación, filtros y comprobación de volúmenes reales.
4. Validar nueva APK en dispositivo físico y almacenamiento seguro de sesión; verificar impresión/exportación y proveedor IA por separado.

Que una pantalla cargue y que sus APIs pasen pruebas no significa que todas sus operaciones estén disponibles en la interfaz.
