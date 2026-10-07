# Ventas y factura interna

En Ventas, crea una cotización seleccionando un cliente y una o más partidas con producto, cantidad, precio e impuesto. El cliente se registra en CRM y el producto en Productos. Deben existir un almacén y existencias antes de confirmar el pedido.

1. Guardar cotización.
2. Aprobar cotización.
3. Convertir a pedido: queda en borrador.
4. Confirmar pedido y descontar stock, después de revisar las partidas.
5. Generar factura interna.
6. Abrir Facturas y usar Imprimir / Guardar PDF en web. Android permite compartir el contenido de la factura; requiere actualizar el APK para recibir esta interfaz.

Cada acción respeta los permisos del backend y la empresa de la sesión. El descuento es un importe por partida, ya incluido en el subtotal neto. La factura conserva los nombres de empresa y cliente al emitirla.

La confirmación y la emisión se ejecutan en transacciones MongoDB (replica set). Un fallo revierte existencias/estado, o factura/asiento respectivamente. La emisión repetida para el mismo pedido devuelve la factura existente y no vuelve a registrar cuentas por cobrar. Los folios pueden tener saltos tras un intento fallido; no se reutilizan.

No es CFDI ni incluye timbrado fiscal. No registra un pago automáticamente.

## Validación aislada

- tests/internal-invoices.test.js: recorrido API, reintentos concurrentes, stock insuficiente, reversión ante fallo contable, impuestos/descuentos.
- frontend/scripts/invoice-document.test.js: contenido y escape HTML al imprimir.
- tests/sales-browser.qa.js: navegador con solicitudes Render interceptadas hacia un backend real temporal y MongoDB temporal. No se envían credenciales ni escrituras a producción. Requiere Chrome de QA con CDP en 9337, puertos 8090/8091 libres y exportación web en frontend/dist.
- La prueba de impresión captura el HTML generado, sin operar una impresora física ni validar el diálogo de impresión del sistema.

