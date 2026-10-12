# Seguimiento comercial

Fecha: 2026-10-05. Estado: implementación local con QA automatizado. Integración real, QA visual, publicación y habilitación comercial pendientes. No se ejecutaron cobros, compras, despliegues ni commits.

Se conserva `docs/AUDITORIA_2026-10-02.md`, archivo previo sin seguimiento.
Objetivos, dependencias, archivos y criterios de cada tarea: COMMERCIAL_IMPLEMENTATION_PLAN.md. Evidencia detallada: COMMERCIAL_TEST_REPORT.md y evidence/*.txt.
El entorno aislado falla al iniciar procesos; las lecturas y verificaciones requieren ejecución revisada fuera del aislamiento.

| ID / fase | Estado | Resultado y archivos afectados | Evidencia | Bloqueo o pendiente |
|---|---|---|---|---|
| C00 / 0 | completada | Arquitectura, API, auth, roles, empresas, CORS y scripts auditados; correcciones en auth/*, middlewares/auth.js, companies/controller, users/service | Baseline 16 suites/181 pruebas; regresión 17 suites/199 pruebas | Infraestructura real por validar en C10 |
| C01 / 1 | completada | Catálogo central, precio explícito, módulos, cupos, recursos ilimitados declarados, cancelación al periodo y sin gracia. catalog.js, .env.commercial.example | Tests de configuración incompleta y precio discrepante | Precio y políticas comerciales/legales pendientes; checkout deshabilitado por defecto |
| C02 / 2 | completada | Contratos, membresías, tokens, eventos, pagos, outbox, índices únicos, segunda empresa y recuperación. models.js, routes.js, service.js, CommercialScreen.js | Tests de segunda empresa, cambio de contexto, duplicados, sesión recuperada y rollback | Aplicar índices en DB desplegada |
| C03 / 3 | bloqueada | Registro seguro, términos por contrato, verificación, reenvío y recuperación atómica. auth/*, mail.js, users/model | Tokens vencidos/reutilizados, duplicados, reset y refresh concurrentes, revocación y límite bcrypt probados | Remitente/dominio y recepción de correo real |
| C04 / 4 | bloqueada | Plan/vigencia/empresa exigidos en API, cupos transaccionales y vencimiento por worker. middlewares/auth.js, service.js | API directa y cruce de empresa rechazados; último cupo acepta un solo invitado | Exportación sensible rechazada por revisión automática; pendiente autorización adicional |
| C05 / 5 | bloqueada | Stripe checkout/webhook, firma/raw body, reconciliación, lease, activación transaccional y reintentos. provider.js, service.js | Simulaciones de firma falsa/replay, importe incorrecto, duplicados/fuera de orden, invoice antes de checkout, rollback, rechazo/abandono | Credenciales Stripe test, producto/precio y webhook real |
| C06 / 6 | en revisión | Landing española, catálogo servidor, demo ficticia, FAQ, términos borrador y rutas hash. CommercialScreen.js, App.js, public/* | Build final pasa, _headers/_redirects presentes; ancho y etiquetas revisados en código | Navegador falló al iniciar; celular/escritorio/teclado no inspeccionados; contacto por configurar |
| C07 / 7 | bloqueada | Sucursal única, invitaciones vinculadas a correo/rol/empresa, múltiples membresías. service.js, CommercialScreen.js | Setup repetido y concurrencia pasan; correo ajeno rechazado; invitado no obtiene vista de propietario | Entrega real de invitación y recorrido visual |
| C08 / 8 | bloqueada | Plan/vigencia/cupos/pagos, portal, cancelación, auditoría, avisos, retenciones y soporte CLI. commercial/*, commercial-support/status.js | Cancelación conserva periodo; reembolso no se reactiva; aviso de fallo idempotente | Portal/recibos/disputas reales, exportación y fiscalidad |
| C09 / 9 | bloqueada | Regresión 199/199; comercial final 18/18; lint y build pasan. tests/commercial.test.js, tests/mongo-ports.js | COMMERCIAL_TEST_REPORT.md y evidence/* | QA real de proveedor, correo y navegador |
| C10 / 10 | bloqueada | Plantilla Render, Cloudflare, variables, índices, worker, respaldo/restauración/reversión. render.commercial.example.yaml, scripts/*, COMMERCIAL_DEPLOYMENT.md | Artefacto web y scripts preparados; configuración externa ausente comprobada sin mostrar secretos | Acceso externo, scheduler, alertas, backup/restore real |
| C11 / 11 | en revisión | Métricas sin secretos, soporte y mantenimiento documentados. commercial-status.js, COMMERCIAL_*.md | Herramientas y documentación existen; soporte no expuesto a tenants | Operación externa y mantenimiento de respaldos por configurar |

Una fase bloqueada contiene trabajo local terminado, pero no satisface todavía todos sus criterios. No equivale a integración externa validada. No se encontró AGENTS.md en el repositorio ni en C:\.

Cambios críticos: registro privilegiado ignorado fuera de test/desarrollo; parámetros de privilegios rechazados; actividad/roles/empresa consultados en DB; pendientes y vigencias bloqueados; aislamiento para administradores heredados asignados; promoción a SUPER_ADMIN desde empresa rechazada; reset y refresh atómicos; sesión revocada al cambiar contraseña; bcrypt limitado a 72 bytes.

Siguiente paso: configurar proveedores test, verificar correo/webhook/portal/disputas, inspeccionar pantallas y aprobar el alcance de exportación de COMMERCIAL_DECISIONS.md. No habilitar cobros reales con estos pendientes.

## Corrección de cuentas sin empresa — 2026-10-10

Cambios locales añadidos después del seguimiento original: invitaciones para administradores de empresas heredadas y propietarios comerciales activos; roles limitados a roles de empresa; aceptar una invitación puede asociar una cuenta existente o crear una cuenta directamente en la empresa; la aceptación verifica el correo mediante el token de un solo uso, respeta cupos comerciales y escribe membresía/usuario/auditoría en la misma transacción. El formulario de administración ahora puede enviar invitaciones. El alta pública de propietarios en entornos alojados falla antes de crear una cuenta si el checkout está deshabilitado.

Se añadió `commercial:membership-backfill`: por defecto solo reporta conteos; `--apply` crea membresías faltantes para usuarios con empresa activa y rol admitido. No se ejecutó en ninguna base.

Estado de esta corrección: código y documentación modificados localmente; **no probados, no publicados y sin cambios en Cloudflare, Render o MongoDB**. Pendiente: QA de API/navegador, revisión de roles y permisos, ejecutar dry-run con credenciales del operador, revisar conteos, respaldar y aplicar migración en staging, configurar correo real y publicar frontend/backend compatibles.
