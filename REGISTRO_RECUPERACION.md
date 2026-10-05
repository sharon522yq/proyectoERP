# Registro y recuperación de contraseña

La pantalla de acceso incluye registro con nombre, correo, contraseña y confirmación; recuperación por correo; y restablecimiento desde el enlace o pegando su código en móvil.

Las cuentas públicas son EMPLEADO y no tienen empresa asignada. Un administrador debe asignar su empresa y permisos; registrarse no concede administración ni acceso a otras empresas. Los roles base deben estar inicializados como exige el backend existente.

En Render configurar RESEND_API_KEY, MAIL_FROM (remitente de un dominio verificado en Resend) y FRONTEND_URL (URL pública donde se sirve la aplicación). No activar ALLOW_PRIVILEGED_REGISTER en producción. El envío usa la API de Resend con Node 20 del Dockerfile existente.

El enlace contiene resetToken, vence en una hora, se guarda solo su hash y se consume mediante una actualización atómica. Al cambiar la contraseña se revoca el refresh token; los access tokens existentes expiran según JWT_ACCESS_EXPIRES. Solicitar de nuevo invalida el enlace previo. Fuera de tests la API nunca devuelve el token.

Publicar esta rama y reconstruir el frontend para que aparezcan los botones. Configurar y probar correo real antes de habilitar recuperación a usuarios. No se han configurado secretos ni desplegado estos cambios.

## Seguimiento de trabajo con Git

Rama remota: feat/registro-recuperacion. PR: #4. Cada cambio funcional, pruebas y documentación se publica en commits separados; no se modifica main directamente.

- [x] Formularios de registro y recuperación.
- [x] Sesión desde la respuesta de registro, sin segundo login.
- [x] Pantalla informativa para EMPLEADO sin empresa; cierre de sesión disponible.
- [x] Pruebas unitarias de recuperación y envío simulado de correo.
- [x] Compilación web.
- [ ] Integración con MongoDB y regresión completa: este entorno rechaza el arranque de MongoDB con open: Operation not permitted. Ejecutar npm --prefix backend test en un entorno compatible; no son pruebas aprobadas.
- [ ] Asignación de empresa: user.validation acepta companyId, pero user.service.update no lo aplica. La interfaz actual no resuelve esta asignación. Diseñar un flujo autorizado con validación de empresa, límites por tenant, auditoría y pruebas de permisos antes de ofrecer acceso operativo a cuentas públicas.
- [ ] Correo real: configurar secretos en Render, verificar remitente y probar entrega.
- [ ] Recorrido visual en web y teléfono físico.
- [ ] Revisar e integrar PR, desplegar backend y reconstruir frontend.

Pruebas agregadas: registration-recovery.test.js (registro público, validación, duplicados, renovación de enlace, expiración, consumo único, refresh revocado y nuevo login); password-reset-mail.test.js (enlace al frontend, falta de configuración y fallo del proveedor).

El registro no implementa verificación de correo ni crea empresas automáticamente. El PR permanece en borrador hasta resolver integración y los pendientes operativos.
