# Registro y recuperación de contraseña

La pantalla de acceso incluye registro con nombre, correo, contraseña y confirmación; recuperación por correo; y restablecimiento desde el enlace o pegando su código en móvil.

Las cuentas públicas son EMPLEADO y no tienen empresa asignada. Un administrador debe asignar su empresa y permisos; registrarse no concede administración ni acceso a otras empresas. Los roles base deben estar inicializados como exige el backend existente.

En Render configurar RESEND_API_KEY, MAIL_FROM (remitente de un dominio verificado en Resend) y FRONTEND_URL (URL pública donde se sirve la aplicación). No activar ALLOW_PRIVILEGED_REGISTER en producción. El envío usa la API de Resend con Node 20 del Dockerfile existente.

El enlace contiene resetToken, vence en una hora, se guarda solo su hash y se consume mediante una actualización atómica. Al cambiar la contraseña se revoca el refresh token; los access tokens existentes expiran según JWT_ACCESS_EXPIRES. Solicitar de nuevo invalida el enlace previo. Fuera de tests la API nunca devuelve el token.

Publicar esta rama y reconstruir el frontend para que aparezcan los botones. Configurar y probar correo real antes de habilitar recuperación a usuarios. No se han configurado secretos ni desplegado estos cambios.
