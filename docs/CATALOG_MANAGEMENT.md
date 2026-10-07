# Gestión de leads, productos y almacenes

## Uso

- CRM: cada lead incluye Eliminar cuando el usuario tiene `crm.leads.delete`. La confirmación muestra su nombre. La baja es lógica; si se convirtió, el cliente y sus documentos permanecen.
- Productos: Eliminar requiere `products.delete`. Si tiene inventario, movimientos, cotizaciones, pedidos, facturas, compras o relaciones de producción, el backend devuelve 409 y explica que puede desactivarse. Activar/Desactivar requiere `products.update`. Los productos inactivos no se ofrecen al crear cotizaciones ni se aceptan en nuevas cotizaciones, compras o altas de producción. Su stock se puede conciliar y su historial se conserva.
- Inventario: pulsa Gestionar junto al almacén. El detalle permite consultar existencias y movimientos con paginación; editar nombre, código y dirección; activar, desactivar o eliminar; y abrir el ajuste con el almacén seleccionado.
- La administración de almacenes usa el permiso existente `branches.update`, coherente con `branches.create` para su alta. Consultas requieren `inventory.read`; historial requiere `inventory.movements`; ajustes requieren `inventory.adjust`.
- No puede desactivarse un almacén con existencias distintas de cero o producción pendiente. No puede eliminarse si conserva inventario, movimientos o relaciones de producción. La baja es lógica y el código permanece reservado para conservar la identidad histórica.
- Las ventas y compras seleccionan únicamente almacenes activos. Los ajustes y nuevas órdenes de producción rechazan almacenes inactivos.

## Verificación

Backend: pruebas de eliminación y consulta posterior, conservación del cliente convertido, dependencias de productos, desactivación, edición/baja de almacenes, validación de campos y código, aislamiento entre empresas, rechazo por permisos y registros de auditoría.

Frontend: pruebas de confirmación/cancelación, bloqueo de clics concurrentes y presentación de conflictos. Recorrido automatizado de navegador contra backend real con MongoDB temporal y credenciales sintéticas, sin operaciones de prueba en producción. Incluye recarga, existencias, historial y conflictos esperados.

La APK anterior no incorpora estos controles. Se requiere una nueva compilación; su ejecución en un teléfono físico se valida por separado.
