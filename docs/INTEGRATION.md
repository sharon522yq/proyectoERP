# Integración ERP: operación y límites

Rama creada desde origin/main b48dbe5. PR #5 → #6 → #7; reconciliación de #4 y #3 sin reemplazar versiones completas de archivos.

## Configuración
- Instalación: npm ci desde la raíz. El único lockfile es package-lock.json; Docker usa el mismo lockfile y workspace backend.
- Node 24 para frontend/Docker; CI backend Node 22 y 24. Se conservan Expo 57, React 19 y React Native 0.86 de main. Los lockfiles de workspace del PR #3 estaban obsoletos (Expo 51 / React 18).
- API web/app: https://proyectoerp-api.onrender.com/api/v1. No hay fallback local ni selección automática por __DEV__.
- EXPO_PUBLIC_API_URL solo en frontend. MONGODB_URI, JWT_SECRET y JWT_REFRESH_SECRET solo en backend.
- FRONTEND_URL: URL pública real del frontend, utilizada en enlaces de recuperación. CORS_ORIGINS: lista exacta de dominios autorizados sin rutas. Agregar http://localhost:8086 solo si se permite ese frontend local; sin comodines de previews.
- Correo: RESEND_API_KEY y MAIL_FROM verificado. No se ha probado entrega real.

## Primera cuenta
No existen rutas HTTP de setup ni credenciales por defecto. Ejecutar backend/scripts/Initialize-Owner.ps1 en una consola privada o npm --prefix backend run setup:owner con variables de proceso: MONGODB_URI del destino autorizado, INITIAL_SETUP_TOKEN aleatorio mínimo 32 caracteres, SETUP_NAME, SETUP_EMAIL, SETUP_COMPANY_NAME, SETUP_PASSWORD propia (8 caracteres / máximo 72 bytes UTF-8). No escribir secretos en argumentos, historial, Git ni logs.

La consola solicita URI, secreto y contraseña con entrada oculta. Verificar el destino antes de ejecutarlo. Requiere MongoDB con transacciones (replica set / Atlas). Crea empresa, ADMIN de empresa, roles sin usuario global y auditoría en una transacción. Repetir con los mismos datos es idempotente; cuentas, empresas o permisos conflictivos provocan rechazo sin escrituras parciales. Retirar el secreto operativo después de terminar. La integración no ejecuta este comando contra producción.

## Acceso y aislamiento
Registro público entrega sesión EMPLEADO sin empresa y muestra estado pendiente. La asignación requiere permisos globales explícitos SUPER_ADMIN, no ADMIN sin empresa; no crea ni eleva cuentas globales. Valida empresa activa, impide transferencias, audita y revoca access/refresh. Usuarios sin empresa no acceden a operaciones; el dashboard devuelve un resumen vacío sin datos ajenos.

Logout, cambio/reset de contraseña y cambio de rol/empresa revocan sesiones. Refresh usa compare-and-swap y versión; tokens reset son hash, caducan a una hora y se consumen una sola vez. No se devuelve token reset fuera de test.

## Pendientes externos
Merge no equivale a despliegue. Se requiere acceso operativo a Render/Cloudflare, secretos JWT/Mongo/correo y CORS con dominios reales. No se han validado correo real, Android físico, restauración de backup ni despliegue. Las pruebas usan bases temporales aisladas.

## Validaciones ejecutadas
- Instalación reproducible: npm ci --offline --ignore-scripts --no-audit --no-fund desde raíz, 1178 paquetes. CI repetirá npm ci estándar.
- Lint backend: aprobado.
- Regresión: 23 suites / 217 pruebas aprobadas en MongoDB temporal; incluye registro, login/me/logout, cambio/reset, caducidad y uso único reset, rotación concurrente refresh, revocación, bootstrap privado idempotente/atómico, aislamiento y permisos, producción/inventario/ventas/finanzas/IA y CORS producción.
- Exportación web: aprobada con API de Render. _headers, _redirects y wrangler.jsonc presentes.
- Navegador Chrome: registro pendiente, logout, login por autocompletado sin eventos React, dashboard, productos, recarga con sesión y login manual aprobados. Transporte hacia Render interceptado y atendido exclusivamente por backend de prueba con MongoDB temporal; no prueba producción.
- Evidencia: browser-integration.json y integration-dashboard.png. Ejecutable: backend/tests/browser-integration.qa.js con Chrome de QA en puerto 9336. No imprime cuerpos, contraseñas ni tokens.
- CORS/Render en vivo y entrega de correo no se consideran verificados por estas pruebas.

El trabajo no confirmado de C:\proyectoERP se conserva intacto; esta integración se realizó en C:\proyectoERP-integration.
