# Despliegue y operación comercial

Estado: preparado localmente, no publicado ni habilitado para cobros. Fecha: 2026-10-05.

## Configuración

Combinar `.env.example` y `.env.commercial.example` sin incorporar secretos a Git. No existen `.env` raíz/backend ni las credenciales de proveedores/despliegue examinadas en el proceso de esta sesión.

Variables: MONGODB_URI, JWT_SECRET, JWT_REFRESH_SECRET, NODE_ENV, FRONTEND_URL, EXPO_PUBLIC_API_URL, COMMERCIAL_MODE, COMMERCIAL_AMOUNT_MINOR, COMMERCIAL_CURRENCY, COMMERCIAL_INTERVAL, COMMERCIAL_PLAN_NAME, COMMERCIAL_MAX_USERS, COMMERCIAL_TERMS_VERSION, COMMERCIAL_LEGAL_APPROVED, COMMERCIAL_LIVE_APPROVED, STRIPE_SECRET_KEY, STRIPE_PRICE_ID, STRIPE_WEBHOOK_SECRET, RESEND_API_KEY, MAIL_FROM. Cada secreto se configura en el alojamiento; jamás en el bundle web.

FRONTEND_URL debe ser el origen exacto, sin ruta ni barra final. Desarrollo: `http://localhost:19006`. Producción: origen HTTPS del frontend real. EXPO_PUBLIC_API_URL: `https://proyectoerp-api.onrender.com/api/v1`, sujeto a verificar el backend desplegado. Para pruebas usar un backend separado de producción y clave Stripe test; producción rechaza COMMERCIAL_MODE=test.

Checkout deshabilitado por defecto. Solo admite test/live, clave concordante, precio e importe configurados, moneda/periodo coincidentes, webhook secret y URL válida. Live requiere NODE_ENV=production y aprobaciones comerciales/legales explícitas. Estas banderas no constituyen aprobación humana ni evidencia de QA; no activarlas hasta resolver los pendientes del informe.

## Preparación reproducible

1. `npm ci` en la raíz; runtime probado en esta sesión: Node v24.21.0 / npm 11.19.0. Validar esa versión o una compatible en el alojamiento antes de publicar.
2. Configurar MongoDB replica set y realizar respaldo previo. Crear índices mediante `npm --prefix backend run commercial:indexes`. El script valida topología y añade índices; no elimina índices ni registros. Resolver duplicados heredados con revisión antes de reintentar, nunca borrar cuentas para pasar una migración.
3. Ejecutar `npm --prefix backend test` y `npm --prefix backend run lint`.
4. Configurar EXPO_PUBLIC_API_URL y ejecutar `npm --prefix frontend run export:web -- --output-dir dist-commercial`.
5. Cloudflare Pages: raíz del repositorio; comando del paso 4, directorio publicado `frontend/dist-commercial`. `_redirects` y `_headers` se copian desde `frontend/public`. Las rutas por fragmento recargan index.html. [Documentación de rutas de Cloudflare](https://developers.cloudflare.com/pages/configuration/serving-pages/).
6. Render: plantilla `render.commercial.example.yaml`, npm ci, `npm --prefix backend start`, health `/health`. La plantilla deja contratación deshabilitada y no crea servicios de pago.
7. Cuenta Stripe test: crear producto y Price recurrente con una sola línea, cantidad 1, importe/moneda/periodo iguales al catálogo, sin cupones, pruebas gratuitas ni impuestos automáticos para esta primera versión. Crear portal con cancelación al final del periodo; deshabilitar cambios de precio/plan hasta implementarlos.
8. Configurar webhook `/api/v1/commercial/webhook`, API de evento 2024-06-20: checkout.session.completed/async_payment_succeeded/async_payment_failed/expired, customer.subscription.created/updated/deleted, invoice.paid/payment_failed, charge.refunded y charge.dispute.*. Firma usa el secreto del endpoint específico, no otro webhook.
9. Validar remitente/dominio de Resend y entrega real de verificación, recuperación, invitación, activación y restricciones. Outbox local no equivale a entrega real.
10. Scheduler externo o Render Cron autorizado: cada cinco minutos ejecutar `npm --prefix backend run commercial:worker`, con las mismas variables privadas. El worker reconcilia sesiones y renovaciones, aplica vencimiento y entrega correo. La API también comprueba vigencia por solicitud, aunque el scheduler falle.

## Membresías heredadas e invitaciones

Antes de publicar el selector de empresas nuevo, revisar las relaciones existentes. El comando `npm --prefix backend run commercial:membership-backfill` es de solo lectura por defecto y reporta conteos sin correos ni datos personales. Después del respaldo, ejecutar `npm --prefix backend run commercial:membership-backfill -- --apply` para crear membresías faltantes únicamente cuando el usuario ya tiene un `companyId` válido, una empresa activa y un rol compatible. Es idempotente y no asigna empresa a usuarios huérfanos.

Los administradores con permiso `users.create` pueden invitar a usuarios de empresas heredadas; el dueño de una suscripción comercial activa invita respetando los cupos. El correo contiene un token de un solo uso ligado al correo, empresa y rol. La invitación permite crear una cuenta directamente en la empresa o asociar una cuenta existente tras iniciar sesión. Producción requiere `RESEND_API_KEY`, `MAIL_FROM` y el origen HTTPS exacto en `FRONTEND_URL`. El modo de contratación puede seguir deshabilitado para las invitaciones heredadas; los registros de propietarios se rechazan hasta que checkout esté configurado.

## Alojamiento y disponibilidad

No se promete operación gratuita: Render documenta suspensión de servicios web gratuitos tras inactividad y limitaciones de horas/servicios; esto afecta latencia y disponibilidad de webhooks. Seleccionar un servicio siempre activo y scheduler tras revisar coste y autorización. [Límites oficiales de Render](https://render.com/docs/free). La versión local no demuestra capacidad, uptime ni tiempos reales del dominio existente.

La consulta de `/health` del dominio reportado no fue accesible desde la herramienta web en esta sesión. No se considera backend caído por ese resultado ni se declara despliegue verificado.

## Respaldo y restauración

Antes de cambiar índices o publicar: respaldo consistente del replica set mediante proveedor o mongodump con oplog, cifrado y fuera de Git. Incluir users, companies, branches, membresías, contratos, tokens, eventos, pagos, outbox y colecciones operativas. Guardar identificación de snapshot, fecha, hashes y versión de código. Proteger archivos de outbox porque contienen enlaces secretos pendientes.

Restaurar primero en un cluster aislado mediante herramienta del proveedor o mongorestore; no restaurar sobre producción en este procedimiento sin autorización específica. Verificar conteos, índices únicos, consistencia membresía/contrato/empresa y replay de evento conocido sin crear otra empresa. Cron y webhook deben apuntar solo al entorno aislado. Probar login y acceso entre dos empresas. Documentar RPO/RTO medidos; no se han ejecutado respaldo ni restauración externos.

## Monitoreo y soporte

`npm --prefix backend run commercial:status` informa conteos por estado, eventos recibidos pendientes, activaciones y correo pendientes; no muestra secretos ni correos. Alertar si el worker devuelve código distinto de cero, eventos pendientes aumentan o una contratación pagada permanece sin empresa. Consultar Stripe para distinguir abandono de fallo de activación.

Herramienta de operador: `npm --prefix backend run commercial:support -- CONTRACT_ID reconcile "motivo documentado"`. Revisa snapshot actual y recupera activación sin nuevo checkout. `clear-hold` solo después de verificar resolución de reembolso/disputa y registrar el motivo. Estas herramientas necesitan credencial DB de operador; no existe un endpoint de plataforma para administradores de empresa.

La auditoría comercial guarda IDs/estados/motivo, no claves, tokens, mensajes de correo ni cuerpo de webhook. Rotar credenciales, revisar backups y probar restauración periódicamente. La programación y alertas externas no están configuradas en esta sesión.

## Reversión

Deshabilitar nuevo checkout (`COMMERCIAL_MODE=disabled`), mantener registro seguro y rutas de gestión accesibles. Si ya hay pagos activos, no dejar el webhook desconectado: poner en cola/reintentar entregas y mantener la versión que reconcilia correctamente. Revertir código mediante artefacto/commit anterior conocido; no eliminar empresas activadas ni registros de pago. Los índices añadidos son compatibles con conservación de datos. Reconciliar eventos acumulados antes de habilitar nuevas contrataciones. Restauración completa solo como recuperación controlada, con respaldo y autorización.

## Pendientes externos

Credenciales/cuenta Stripe test y endpoint; remitente/dominio de correo; replica set y acceso de operación; proyectos Cloudflare/Render; scheduler y alertas; backup/restore real; política y precio aprobados; inspección visual en navegador funcional. Publicación y cobros reales no ejecutados.
