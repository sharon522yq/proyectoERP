# Integración de todas las modificaciones locales para publicación

Este documento complementa la preparación anterior de c1050a5. El usuario autorizó ejecutar el despliegue y confirmó mantener contratación deshabilitada. Rama: `codex/deployment-integrated`.

Se incorporaron módulos comerciales e inicialización privada, scripts operativos, selección de empresas, suscripciones e invitaciones, conservando el backend y UX de main vigente. No se reemplazaron ventas, compras, inventario, producción, exportaciones, configuración o diseño por las implementaciones antiguas del checkout raíz.

Compatibilidad y protección:

- Se mantiene `sessionVersion`, su ocultación en las respuestas y la rotación atómica de refresh. Los tokens de una empresa anterior se rechazan y el cliente puede refrescar para el contexto nuevo.
- Las cuentas y empresas heredadas mantienen su acceso y roles actuales. La contratación deshabilitada no las convierte en suscriptores ni exige un pago para usar el ERP.
- Las cuentas comerciales requieren correo verificado y acceso vigente, incluso en el dashboard agregado. Los resúmenes respetan módulos autorizados además de permisos y módulos habilitados de empresa.
- Cambiar de empresa valida pertenencia y empresa activa y escribe auditoría dentro de la transacción. La pantalla operativa se remonta al cambiar el contexto para limpiar datos anteriores.
- La interfaz usa el catálogo para ocultar registro comercial, contratos nuevos y checkout mientras estén deshabilitados; la API también rechaza la contratación no configurada. El login habitual y registro básico existentes se conservan.
- Invitaciones respetan empresa, roles permitidos, cupos y correo del destinatario. El formulario conserva el diseño vigente y evita doble clic. Registrar una invitación no se presenta como prueba de entrega efectiva de correo.
- `COMMERCIAL_MODE=disabled` queda explícito en Render. No se crean servicios de cobro, cron de pago, precios o términos definitivos; no se activan Stripe live o accesos internos por defecto.
- Índices nuevos son aditivos y se preparan antes de aceptar mutaciones. Preflight incluye índices comerciales. El dry-run de membresías y la inspección inicial deshabilitan creación automática de índices y colecciones.
- Inicialización privada solo para destinos vacíos o repetición compatible; no se ejecutará sobre la base existente. Los fixtures de desarrollo requieren entorno y banderas explícitos; nunca se ejecutan al arrancar el servidor publicado.

La landing se abre mediante «Conocer NexusERP» y rutas por fragmento. Se conserva el acceso habitual como pantalla inicial. Los textos legales siguen siendo borradores y la contratación está deshabilitada por decisión del usuario.

Validación local: 31 suites y 285 pruebas de regresión backend aprobadas. Después se añadieron dos regresiones de selección heredada y reducción de rol, con 30 pruebas específicas de comercial, acceso y recuperación aprobadas sobre los últimos cambios. Frontend: 47 pruebas y lint aprobados. Web y Android exportados; CI Linux está pendiente.

La selección de empresas heredadas funciona mediante una vista de su asignación existente, sin crear membresías ni exigir backfill. Las reducciones de rol actualizan la membresía en la misma transacción que el usuario; cambiar de empresa no restaura privilegios anteriores. La comprobación local de navegador confirmó catálogo Alfa/Beta separado, cambio de empresa y restauración de sesión/módulo al recargar.

Las pruebas de navegador utilizan dos empresas sintéticas en MongoDB temporal y una copia local de la compilación con API de loopback. Esa copia solo existe en `.local/qa-web`, está excluida de Git y Docker, y no es un artefacto publicable. La compilación de entrega sigue fijada a Render y tiene manifiesto y verificación separados.

GitHub está conectado y el usuario autorizó expresamente publicar la rama y abrir un PR en el repositorio público. Cloudflare no tiene sesión y Render todavía no está conectado; no hay URI de la base de destino en el entorno. Publicar a main activa Render automáticamente: la integración no debe fusionarse hasta comprobar destino, respaldo recuperable y preflight. Se continuará con CI que no requiere dichos accesos.
