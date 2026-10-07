# Auditoría funcional y plan de producción de NexusERP

Fecha: 7 de octubre de 2026. Objetivo: ERP configurable para distintos clientes y sectores.

## Dictamen y evidencia

Hay una base útil para demostraciones y recorridos comerciales sencillos. Todavía no es un ERP de operación general confiable ante concurrencia, reintentos y fallos parciales. La primera prioridad es integridad de datos; después, interfaces completas y configuración por cliente.

Código revisado: árbol `05c7ed879c736b539db51c34b20783dc3290c4e9`, integrado en main `0b9bb2cb13352c8a8f0e6a951d1cde893a074df9`. La página pública respondió HTTP 200 y Render HTTP 200, identificando ese commit. Disponibilidad no equivale a validación funcional completa.

La integración anterior aprobó 26 suites / 234 pruebas de backend, 17 pruebas frontend, exportación web y recorridos de navegador con MongoDB temporal. No se repitieron todas esas suites en esta auditoría. Se añadieron pruebas dirigidas de concurrencia, repetición y fallos de dependencias en otra base temporal. No se modificó producción ni se consultaron secretos. Las pruebas anteriores no cubrían los nuevos defectos encontrados.

Clasificación: **interfaz** = acción conectada disponible al usuario; **backend** = ruta/servicio existente sin recorrido completo de pantalla; **pendiente** = implementación completa no encontrada en el código integrado. **Confirmado** = reproducido en laboratorio; **por inspección** = riesgo sustentado por código sin reproducción nueva de ese caso exacto. No se asignan porcentajes de completitud.

## 1. Hallazgos que cambian la prioridad del plan

| ID | Prioridad | Evidencia nueva | Corrección y aceptación |
| --- | --- | --- | --- |
| INV-01 | P0 | Con dos lecturas detenidas antes de actualizar, dos incrementos perdieron una actualización: esperado 106, observado 105. La ejecución natural previa sí dio 103. | Stock actualizado atómicamente; movimiento y saldo coherentes en transacción; concurrencia sin pérdida ni negativos. |
| FIN-01 | P0 | Dos ingresos simultáneos de 10 y 20 dejaron saldo 10 en lugar de 30. Confirmado. | Saldo derivado o incremento atómico junto al movimiento; conciliación reproducible. |
| PROD-01 | P0 al activar Producción | Una orden terminó COMPLETED con cero consumos. Confirmado. | Comparar materiales/cantidades contra receta versionada; bloquear cierre si faltan insumos. |
| PROD-02 | P0 al activar Producción | Consumir dos veces la misma orden descontó dos veces: esperado 103, observado 101. Confirmado. | Identidad única de consumo, cantidades acumuladas e idempotencia; reintento sin duplicación. |
| PUR-01 | P0 antes de recepciones reales | Con caída simulada de Finanzas, stock pasó de 101 a 106 y la compra permaneció CONFIRMED. Confirmado. | Recepción con identidad propia; estado/stock/movimientos atómicos y obligación/evento durable. |
| PAY-01 | P0 antes de cobros reales | Con caída simulada de Finanzas, persistió un pago y la factura quedó con 5 pagados sin completar integración financiera. Confirmado. | Pago, cartera y caja coherentes; transacción/idempotencia y estado de pago explícito. |
| PROD-03 | P0 al activar Producción | Por inspección, la actualización genérica de estado admite COMPLETED por otra vía, sin ejecutar el cierre de fabricación. | Una única operación de cierre; ninguna ruta debe saltar consumo, entrada de terminado y costos. |
| FIN-02 | P1 | Por inspección, el resumen suma cuentas por tipo; el movimiento operativo en cuentas ASSET no constituye un libro de partida doble. | Separar métricas operativas de contabilidad formal; definir alcance e integración contable. |

P0 impide pérdida, duplicación o inconsistencia antes de habilitar ese flujo con datos reales. P1 completa el núcleo comercial; P2 mejora operación/escala; P3 es opcional. No se afirma que estos fallos hayan ocurrido en los datos reales de Nexus.

Evidencia: [resultados del laboratorio](C:/proyectoERP/.local/production-audit-results.json) y [procedimiento reproducible](C:/proyectoERP/.local/production-audit-probe.cjs). Se retrasaron dos lecturas para simular intercalación y se sustituyó temporalmente una dependencia para simular su caída; no se cambiaron los archivos del backend.

Referencias del código inspeccionado:

- [Stock](C:/proyectoERP-integration/backend/src/modules/inventory/inventory.repository.js:20).
- [Movimientos financieros](C:/proyectoERP-integration/backend/src/modules/finance/finance.service.js:19).
- [Recepción de compras](C:/proyectoERP-integration/backend/src/modules/purchases/purchase.service.js:70).
- [Registro de cobros](C:/proyectoERP-integration/backend/src/modules/sales/sales.service.js:168).
- [Consumo](C:/proyectoERP-integration/backend/src/modules/production/production.service.js:153) y [cierre de fabricación](C:/proyectoERP-integration/backend/src/modules/production/production.service.js:213).

## 2. Diseño para distintos clientes

La adaptación se consigue con un núcleo estable y paquetes sectoriales, no prometiendo funciones ilimitadas con los mismos formularios.

**Núcleo común:** empresas, usuarios/membresías, permisos, terceros, artículos/servicios, ventas, compras, existencias cuando correspondan, cobros/pagos, reportes, documentos y auditoría.

**Configuración por empresa:** país, zona horaria, idioma, moneda base, unidades/precisión, impuestos operativos, series, folios, crédito, almacenes, aprobación de descuentos/compras, identidad documental, módulos habilitados y campos adicionales validados. Debe aplicarse en backend; ocultar un botón no sustituye autorización ni integridad.

**Paquetes:** comercio/distribución; servicios/proyectos; fabricación; alimentos/perecederos; comercio minorista/POS. Cada uno tendrá reglas y pruebas propias. Un servicio no debe exigir almacén; un producto por peso necesita cantidades fraccionarias; un lote perecedero requiere trazabilidad si se ofrece ese alcance.

**Multiempresa:** actualmente el usuario tiene un solo `companyId` y un rol fijo. Hay aislamiento, pero falta una membresía multiempresa completa. Añadir usuario–empresa–rol, empresa activa validada por servidor, invitaciones y roles por empresa. Migrar las cuentas existentes conservando sus datos y sin otorgar administrador global.

**Si se comercializa como servicio:** separar identidad, empresa, derechos/módulos, prueba comercial, suscripción y pago. El código integrado auditado no ofrece un recorrido completo de contratación y derechos comerciales. Cambios locales no integrados no se cuentan como funciones publicadas. No simular pagos para habilitar accesos; los accesos internos deben ser explícitos y auditables.

## 3. Funciones actuales y faltantes por módulo

### Dashboard y reportes

Actual: panel/navegación; backend calcula facturado, cobrado, pendiente, stock bajo, valor de inventario y resúmenes financieros/producción con permisos. No todo está expuesto en pantalla.

Necesario:
- P1: separar facturado, entregado, cobrado, pendiente y utilidad; definir estados incluidos. El resumen no excluye expresamente todas las facturas canceladas y su conteo de pendientes puede omitir DRAFT; revisar antes de confiar en indicadores.
- P1: filtros por periodo, empresa/almacén y moneda; abrir los documentos que explican cada total.
- P2: cartera por vencimiento, ventas por cliente/producto, rotación, margen con costo definido, compras pendientes y exportación.
- P2: no sumar monedas sin una conversión establecida; validar zona horaria y permisos de exportación.

Caso: gerente compara facturación semanal con cobros de facturas anteriores. Aceptación: cifras distintas, explicables por documentos; cancelaciones/devoluciones sin doble conteo; error no sustituido por cero.

### CRM, clientes y contactos

Interfaz: alta/listado de leads, conversión y eliminación lógica con confirmación; conserva el cliente convertido. Backend: CRUD de leads/clientes/contactos/actividades, responsables, estados y notas.

Necesario:
- P1: clientes y proveedores/terceros con alta, edición, búsqueda, paginación, detalle y prevención de duplicados.
- P1: editar lead/estado/responsable; contactos y seguimiento conectados a las APIs.
- P1: domicilios, condiciones comerciales e historial de cotizaciones, pedidos y saldos.
- P2: embudo configurable, causas de pérdida, recordatorios, importación validada, adjuntos y consentimiento de comunicaciones.
- P2: proteger terceros referenciados y conservar sus datos históricos en documentos.

Caso: dos contactos, seguimiento y direcciones diferentes para facturar/entregar sin duplicar cliente. Aceptación: oportunidad → seguimiento → cliente → cotización; permisos y bajas sin romper documentos.

### Productos, servicios, categorías y unidades

Interfaz: alta con nombre/SKU/precio/costo, búsqueda/listado, eliminación protegida y activar/desactivar. Backend: categoría, unidad, moneda, impuestos y límites de stock; CRUD de categorías y seed/modelo de unidades, sin configuración completa accesible al usuario.

Necesario:
- P1: edición de campos; categorías/unidades administrables; paginación e importación/exportación con validación.
- P1: distinguir inventariable, servicio y consumible; un servicio no requiere stock.
- P1: precisión por unidad. Ventas y ajustes manuales validan enteros; actualmente no cubren 2.5 kg, 0.75 litros o 1.5 horas.
- P1: moneda y redondeo coherentes; datos de documento independientes de posteriores cambios del catálogo.
- P2: conversiones caja–pieza, listas de precios, barras, proveedores y variantes.
- Sectorial: lotes, series, caducidad y empaques.

Caso: compra en cajas de doce y venta por pieza u horas. Aceptación: conversiones sin pérdida/creación de cantidad; factura histórica inalterada al editar el producto.

### Almacenes e inventario

Actual: alta/detalle/edición/estado/baja protegida de almacén; existencias, ajustes, movimientos, historial paginado y API Kardex. Ventas/compras utilizan el primer almacén activo, sin selección operativa completa.

Necesario:
- P0: INV-01; ajuste transaccional, concurrencia, stock no negativo e idempotencia.
- P1: almacén explícito en ventas/recepciones/fabricación; stock físico, reservado y disponible.
- P1: traslado con origen/destino vinculados; conteo físico y diferencias aprobadas. TRANSFER en el enum actual no implementa un traslado completo.
- P1: devoluciones, referencia documental y motivo obligatorio en backend para ajustes manuales; tipos de ajuste que no confundan diferencia de conteo con venta real.
- P2: ubicaciones, reposición, tránsito, valoración, escaneo y alertas.
- Sectorial: lotes/series, caducidad, FEFO, cuarentena y retiro de lotes.

Caso: traslado de diez piezas A→B interrumpido. Aceptación: una transferencia identificable, cantidad global conservada y reintento sin duplicar entrada/salida; la última pieza no se vende a dos operadores.

### Ventas, pedidos, cobros y documento interno

Interfaz: cotización, aprobación, pedido, confirmación con salida de stock, factura interna e impresión web; Android comparte texto. Backend: estados, pagos parciales, folios y conexión financiera; confirmación/conversión/factura tienen transacciones existentes, pero cobros no comparten toda esa protección.

Necesario:
- P0: PAY-01, cobros íntegros/idempotentes, concurrencia y sobrepago; definir efectos de PENDING/CONFIRMED/REJECTED.
- P1: cobros desde pantalla, saldo, método/referencia, vencimiento e historial/comprobante.
- P1: editar borradores, detalle de pedido, almacén, crédito y aprobación de descuentos.
- P1: separar reserva de salida física según política. Hoy confirmar descuenta stock y bloquea cancelación posterior simple.
- P1: entregas/facturas parciales, devolución y nota de crédito operativa/reversión; no borrar una factura para corregir cartera.
- P1: PDF descargable/compartible en web y Android, identidad y snapshot documental, envío por correo.
- P2: listas especiales, pedidos recurrentes y portal.
- Por país/contrato: integración fiscal separada; el documento actual es interno.

Caso: diez piezas, entrega seis, cobro parcial y devolución una. Aceptación: stock, entregado, facturado, pagado y pendiente cuadran por separado; retransmisiones no duplican operaciones.

### Compras y proveedores

Interfaz: listado. Backend: alta de orden, estados y recepción total con ingreso a stock y movimiento de CxP.

Necesario:
- P0: PUR-01, identidad de recepción, transacción/recuperación y reintento seguro.
- P1: proveedores, formularios/detalle de compra, aprobación, almacén y recepción.
- P1: recepción parcial, diferencias, costos, documento/factura del proveedor y pago separados de recepción física.
- P1: devolución al proveedor y reverso con referencia; entrega recibida una sola vez.
- P2: requisiciones, comparación de ofertas, límites por importe, fechas prometidas y desempeño de proveedor.

Caso: compra cien, recibe sesenta, paga anticipo y recibe cuarenta después. Aceptación: pendientes visibles y conciliación de pedido, recepción y documento del proveedor. Referencia del patrón: [control de tres documentos en Odoo](https://www.odoo.com/documentation/saas-18.3/applications/inventory_and_mrp/purchase/manage_deals/control_bills.html).

### Finanzas, cartera y caja

Interfaz: resumen y movimientos, con errores explícitos. Backend: crear/consultar cuentas, movimientos y registros automáticos. No implementa partida doble completa. No existe PUT de cuenta aunque el permiso y la llamada frontend estén declarados.

Necesario:
- P0: FIN-01, PAY-01 y PUR-01; precisión monetaria, atomicidad y conciliación.
- P1: cuentas/bancos/cajas administrables, CxC/CxP por documento, cobros/pagos/vencimientos.
- P1: transferencias, anticipos, devoluciones y ajustes con reglas explícitas; moneda por operación sin mezcla indebida.
- P1: conciliar caja, documentos y cartera; separar ingresos operativos de utilidad contable.
- P2: presupuesto, centros de costo, importación bancaria, cierres y bloqueo de periodos.
- Si se ofrece contabilidad formal: libro equilibrado, periodos, reversos, estados y validación del responsable contable; alternativamente integración externa con alcance declarado.

Caso: dos cajeros registran cobros simultáneos y uno reintenta. Aceptación: saldos coinciden con movimientos y documentos; transferencia afecta ambos lados una vez; cierre reconstruible.

### RRHH

Interfaz: lista de empleados. Backend: crear/listar departamentos y crear/listar/consultar/actualizar empleados. No hay nómina completa ni rutas para todos los permisos declarados.

Necesario:
- P1 al habilitar: expedientes/edición, departamentos/puestos, estado/baja y permisos por campo; empleado separado de usuario de aplicación.
- P2: asistencia, horarios, vacaciones, ausencias, documentos y aprobaciones.
- Por país/contrato: nómina como paquete/integración específica; un campo salario no demuestra cumplimiento de nómina.

Caso: aprobar ausencia sin exponer salarios a ventas. Aceptación: confidencialidad por campo, baja sin borrar expedientes y trazabilidad.

### Proyectos y tareas

Interfaz: listado. Backend: crear/consultar/actualizar proyectos y tareas, presupuesto/fechas, responsables y asignación por empresa.

Necesario:
- P1 para servicios: formularios/detalle, tablero, tareas, prioridades, fechas y responsables.
- P1 para servicios: horas/partes, hitos, gastos/material y facturación por avance/tiempo.
- P2: dependencias/capacidad, archivos, colaboración, presupuesto vs real y rentabilidad definida.

Caso: tres hitos, registro de horas y factura del primero aprobado. Aceptación: avance/costos/documentos vinculados; no exigir almacén para servicios ni cruzar asignaciones entre empresas.

### Producción

Interfaz: listado de órdenes. Backend: BOM/recetas, órdenes de fabricación/trabajo, estados, consumos y entrada de terminado. Tener rutas no equivale a fabricación segura.

Necesario:
- P0: PROD-01/02/03; cierre único, consumos vs requerimientos, idempotencia y transacciones; prevenir escritura parcial al fallar otro componente.
- P1 al habilitar: formularios de receta/orden/trabajo/consumo/cierre y versiones de receta; reservas/planificación por disponibilidad.
- P1: consumo real/teórico, merma, terminado parcial, no conformidad, costo real y trazabilidad.
- P2: centros de trabajo, rutas, capacidad, tiempos y planificación de necesidades.
- Sectorial: lotes/caducidad/calidad/subproductos; no obligatorio para comercio o consultoría.

Caso: cien unidades planeadas, noventa y cinco útiles, cinco de merma y receta versionada. Aceptación: materiales/terminado/costo explicables; reintento no consume ni produce dos veces; ninguna ruta salta el cierre.

### Usuarios, empresas, roles y acceso

Interfaz: listado y asignación de empresa reservada al administrador global existente. Backend: usuarios/empresas/sucursales, roles sembrados de consulta, aislamiento, inicialización privada, registro, recuperación y sesiones revocables. ADMIN de empresa no tiene privilegios globales.

Necesario:
- P1: administración desde pantalla, invitación/verificación de correo, desactivación y revocación.
- P1: membresías, selector, roles por empresa, aprobaciones y alta autoservicio protegida sin aceptar privilegios globales públicos.
- P1: usuario sin empresa con recorrido claro; distinguir sucursal y almacén.
- P1: sesiones por dispositivo. Un refreshTokenHash por usuario limita sesiones independientes; validar web y Android simultáneos.
- P1: persistencia nativa protegida; actualmente tokens nativos en memoria y web en localStorage. LocalStorage no es protección criptográfica frente a XSS.
- P2: autenticación reforzada para operaciones sensibles y gestión de dispositivos.

Caso: usuario de dos empresas con roles diferentes y teléfono perdido. Aceptación: contexto validado por servidor, sin fuga ni elevación global; revocación efectiva. Referencias: [OWASP autorización](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html) y [Expo SecureStore](https://docs.expo.dev/versions/latest/sdk/securestore/).

### Auditoría

Actual: registro backend y pantalla de consulta. Los errores de escritura de auditoría se capturan y la operación principal continúa.

Necesario:
- P1: filtros, paginación/exportación y enlace a documento; motivos/aprobaciones/reversos y correlación por operación.
- P1: evidencia durable de acciones críticas, mediante transacción u outbox; alerta de fallo de auditoría.
- P2: retención y acceso restringido; registros no editables ordinariamente y datos sensibles redactados.

Caso: explicar quién cambió precio/stock y el motivo. Aceptación: reconstrucción de la operación sin contraseñas/tokens; ausencia de evidencia genera alerta.

### Asistente IA

Actual: chat; API de chat/análisis/salud; herramientas ERP revisadas de solo lectura con empresa, permisos y límites. Proveedor real no validado en esta auditoría.

Necesario:
- P2/P3: habilitación por empresa, política de datos, cuota/costo, trazas y respuesta respaldada por periodo/documentos.
- P2: evaluación por rol y manejo de caída sin inventar cifras.
- P3: propuestas de acción con autorización determinista y revisión humana, antes de permitir escrituras.

Caso: vendedor consulta cartera sin acceder a salarios u otra empresa. Aceptación: respuesta coincide con consulta determinista y explica límites. IA no bloquea el núcleo ERP.

### Configuración, documentos, correo e integraciones

Actual: API settings por empresa, sin panel completo; recuperación con Resend; documento interno imprimible. No se repitió envío real de correo en esta auditoría.

Necesario:
- P1: panel/settings con esquema por clave, defaults, versión y validación; aplicación real en backend.
- P1: correo general a usuarios/clientes, dominio/proveedor autorizado, cola, reintentos y eventos de entrega/rebote.
- P1: PDF y adjuntos persistentes con permisos de empresa, descarga/compartición web/Android.
- P2: API documentada, importación/exportación y webhooks firmados/idempotentes para integraciones.

Limitación conocida: onboarding@resend.dev es remitente de prueba para el correo asociado a la cuenta, no solución de envío a clientes arbitrarios. [Documentación Resend](https://resend.com/docs/knowledge-base/403-error-resend-dev-domain). Considerar dominio propio existente de plataforma/cliente o proveedor autorizado; no asumir un dominio gratuito compatible.

Caso: configurar empresa, invitar usuario y enviar cotización con caída de correo. Aceptación: documento persiste, estado real de entrega visible y reintento sin duplicación; secretos solo en backend.

## 4. Nuevas capacidades y paquetes

| Capacidad | Ubicación | Prioridad / necesidad |
| --- | --- | --- |
| CxC/CxP, caja/bancos y conciliación | Ventas/Compras + Finanzas | P1 núcleo comercial |
| Entregas/devoluciones | Ventas + Inventario | P1 productos físicos |
| Recepciones parciales/documentos proveedor | Compras + Inventario | P1 abastecimiento |
| Empresa/membresías/onboarding | Administración + Configuración | P1 todos los clientes |
| Documentos/adjuntos/notificaciones | Servicio común | P1/P2 |
| Reportes/importación/exportación | Servicio común + Dashboard | P1/P2 |
| Aprobaciones | Servicio común por empresa | P1/P2 según operación |
| POS/caja/cierre/terminal | Paquete comercio minorista | P2 para tiendas |
| Horas/hitos/facturación de servicios | Proyectos + Ventas | P1 servicios |
| Lotes/series/caducidad/FEFO/retiro | Inventario/Producción | P1 cuando el cliente lo necesite |
| Calidad/recetas/merma | Producción | P1 fabricación, ampliable P2 |
| Nómina/fiscalidad/contabilidad formal | Integraciones/paquetes por país | Según contrato y jurisdicción |
| Ecommerce/portal | Paquete/integración comercial | P2/P3 |
| Activos/mantenimiento | Paquete industrial | P2/P3 con equipos propios |
| Suscripciones/derechos comerciales | Administración de plataforma | Si se ofrece como servicio |

No todo requiere un módulo nuevo: preferir capacidades integradas con documentos, permisos y saldos. Patrones sectoriales documentados, todavía no implementados aquí: [lotes](https://www.odoo.com/documentation/19.0/applications/inventory_and_mrp/inventory/product_management/product_tracking/lots.html), [caducidad](https://www.odoo.com/documentation/19.0/applications/inventory_and_mrp/inventory/product_management/product_tracking/expiration_dates.html) y [FEFO](https://www.odoo.com/documentation/19.0/applications/inventory_and_mrp/inventory/shipping_receiving/removal_strategies/fefo.html).

## 5. Requisitos transversales de producción

1. Integridad: precisión de cantidades/dinero, estados, transacciones/eventos durables, claves idempotentes, restricciones únicas, reversos sin borrado histórico.
2. Multiempresa: scope en consultas/escrituras/jobs/archivos/exportaciones/IA y permisos por rol/campo. Feature flags no son autorización.
3. MongoDB: índices según consultas, límites/paginación, migraciones, backup y restauración ensayada en otra base. Acordar RPO/RTO; no prometer cero pérdida. No se inspeccionó el plan Atlas aquí. Free no tiene backups gestionados: requiere estrategia dump/restore o plan compatible [MongoDB](https://www.mongodb.com/docs/atlas/backup-restore-cluster/).
4. Operación: correlationId, logs redactados, métricas y alertas de errores, jobs, stock negativo, saldo descuadrado y auditoría ausente; health separado de dependencias.
5. Entornos: datos sintéticos/anonimizados fuera de producción; URI solo backend; configuración Render/Cloudflare/Android coherente y commit desplegado verificado.
6. Clientes: validación/autocompletado, errores claros, protección de envíos repetidos, sesión nativa segura, versionado compatible y pruebas físicas. APK compilada no prueba funcionamiento en teléfono.
7. Conectividad: inicialmente online con recuperación segura; escritura offline solo después de definir colas, conflictos e idempotencia. No prometer modo offline actual.
8. Escala/costos: medir latencia fría/caliente, concurrencia, datos y cuotas de correo/IA; plan gratuito no garantiza disponibilidad contractual.
9. Soporte: acceso limitado/auditado, guías por rol, demos separadas, exportación de datos y procedimientos de incidente/rollback/restauración.

## 6. Plan por entregables y dependencias

Este es un backlog propuesto; la auditoría no implementó esas correcciones. Un sprint de referencia puede durar dos semanas, pero no se compromete un calendario sin descomponer historias y conocer equipo, volumen, país y nivel de servicio.

| Fase | Entregable | Dependencia | Responsable | Puerta de salida |
| --- | --- | --- | --- | --- |
| 0. Contratos | Tipos de cliente/paquetes, estados, unidades/dinero, métricas y matriz de permisos | Auditoría | Producto + arquitectura | Reglas y ejemplos aceptados; alcance fiscal/comercial explícito |
| 1. Integridad P0 | INV/FIN/PUR/PAY/PROD; idempotencia, transacciones, cierre único, regresiones | F0 | Backend + QA | Sin escrituras parciales, pérdidas ni duplicación; saldos conciliados |
| 2. Configuración/empresa | Membresías, roles, invitaciones, sesiones, settings, terceros/artículos/unidades | F0; migración de acceso; F1 para operaciones | Backend/frontend + producto/QA | Dos empresas configuradas distinto; contexto seguro; cuenta actual conservada |
| 3. Núcleo comercial | CRM completo, servicios/productos, borradores/detalle, venta→entrega→documento→cobro, PDF/correo | F1 y F2 | Frontend/backend + QA | Recorrido diario completo, cobro parcial, devolución y reintento |
| 4. Abastecimiento/stock | Proveedor, compra/recepción parcial, almacén, traslado/reserva/conteo/devolución | F1/F2; contratos F3 | Equipo + operaciones/QA | Stock/documentos/pendientes reconciliados |
| 5. Finanzas/reportes | Cartera, caja/bancos, pagos proveedor, conciliación, cierres/exportación | F1 y documentos F3/F4 | Equipo + responsable de finanzas/QA | Totales reconstruibles; alcance contable definido |
| 6. Paquetes | Servicios/proyectos, fabricación/calidad, perecederos, RRHH/POS según pilotos | Núcleo y reglas del sector | Equipo + representante sectorial | Caso completo de cada paquete, sin romper otros clientes |
| 7. Piloto/operación | Restauración, carga, alertas, soporte, Android físico, documentación/release | Capacidades habilitadas terminadas | QA + DevOps + producto/cliente | Piloto aceptado, rollback/incidentes y evidencia por versión |

Primer incremento recomendado: regresiones de los seis defectos confirmados; corregir atomicidad/idempotencia y cierre de producción; conciliar stock/cartera. Después, terceros/unidades/configuración y cobro con PDF real. Compras y almacenes siguen sobre esa base. Proyectos/RRHH/IA no deben desplazar la integridad del núcleo.

Se pueden preparar interfaces independientes en paralelo, pero recepción/consumo/cobro no se habilitan a clientes antes de pasar su puerta de integridad.

## 7. Casos de aceptación de operación real

Escenarios sintéticos basados en operaciones habituales, no estudios de empresas reales ni pruebas ya aprobadas del ERP.

| Caso | Operación | Invariante |
| --- | --- | --- |
| R01 | Dos operadores venden la última unidad | Una salida válida; la otra solicitud explica falta de stock |
| R02 | Compra cien, recibe sesenta y cuarenta | Pendientes correctos; reintento no duplica recepción |
| R03 | Cobros concurrentes/parciales y caída de Finanzas | Caja/cartera/pago coherentes o reversión íntegra |
| R04 | Traslado A→B interrumpido | Una identidad; cantidad global conservada |
| R05 | Entrega parcial y devolución | Entregado/devuelto/facturado/pendiente explicables |
| R06 | Fabricación con reintento/merma | Consumo único; no terminar sin insumos; cantidad/costo trazables |
| R07 | Servicio y artículo de 2.5 kg | Sin almacén obligatorio para servicio; precisión adecuada |
| R08 | Usuario en dos empresas | Sin fuga en API, búsqueda, exportación, archivos o IA |
| R09 | Otra moneda/país/configuración | Reglas propias; no sumar monedas sin criterio |
| R10 | Teléfono pierde red/cierra app | Resultado conocido, reintento seguro y sesión protegida |
| R11 | Restauración en otra base | Documentos/saldos/relaciones/archivos recuperados y conciliados |
| R12 | Cambio de precio/baja de catálogo | Documentos históricos iguales y recuperables |
| R13 | Caída de correo/IA | Documento persiste; estado visible; reintento sin duplicación |
| R14 | Petición fabricada sin permisos | Backend rechaza rol/empresa/campos no autorizados |
| R15 | Cierre de caja/periodo | Totales explicables; reversos siguen política y auditoría |

Dataset mínimo: dos empresas, roles distintos, dos almacenes, artículos con unidades/servicios, documentos históricos/parciales y usuarios inactivos. Volumen y concurrencia objetivo se acuerdan por perfil; medir antes de prometer capacidad.

Cada historia incluye actor/permiso, flujo feliz, validaciones, conflicto, concurrencia/reintento, fallo de dependencia, aislamiento, auditoría, migración y pruebas web/Android aplicables. Terminado significa pruebas significativas, documentación/API, CI reproducible, rollback y aceptación funcional; no solo un botón.

## 8. Decisiones y pendientes externos

Externos: correo/dominio autorizado, plan/permisos de backup, infraestructura y volumen objetivo, país/integración fiscal-contable si se ofrece, proveedor de pago para comercialización, proveedor IA opcional y teléfonos reales para QA.

Producto: paquetes iniciales, aprobaciones, costo/valoración, RPO/RTO y soporte, crédito/devoluciones, sesiones simultáneas y alcance offline. No es necesario decidir todas las extensiones para estabilizar el núcleo.

Meta: núcleo comercial confiable y configurable, piloto de comercio/distribución y otro de servicios; después fabricación como prueba de extensibilidad. Declarar los sectores y límites realmente validados, sin prometer adaptación ilimitada.
