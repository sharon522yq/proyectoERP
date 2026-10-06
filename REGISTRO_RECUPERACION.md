# Registro y recuperación integrados

Registro público crea EMPLEADO sin empresa, sin aceptar privilegios. La interfaz utiliza la sesión de la respuesta y muestra el estado pendiente. La asignación de empresa requiere permisos globales explícitos (SUPER_ADMIN), valida empresa activa, impide transferencias, audita y revoca sesiones. No se crea administrador global durante el primer acceso.

Recuperación Resend: hash, caducidad de una hora, consumo atómico y revocación de sesiones. Configurar RESEND_API_KEY, MAIL_FROM verificado y FRONTEND_URL en backend; entrega real y Android físico pendientes.
