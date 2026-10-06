# Auditoría operativa — 5 de octubre de 2026

## Estado observado

- Frontend integrado: http://localhost:8086, ejecutado desde `C:\proyectoERP-integration\frontend` con `npm run web:render`, caché limpia y `.env.local` ignorado por Git.
- Única API del frontend: https://proyectoerp-api.onrender.com/api/v1. No contiene URI MongoDB ni usa el servidor especial local.
- Render `/health`: HTTP 200; commit `da2fe58e8ff495c68daa3619fb8ab435fc6234cb`.
- POST vacíos a `/auth/login`, `/auth/register`, `/auth/forgot-password`, `/auth/reset-password`: HTTP 400. Comprueban despliegue y validación de rutas, no un registro o login real.
- Network del navegador: preflight HTTP 200 sin `Access-Control-Allow-Origin`; login y registro bloqueados con `PreflightMissingAllowOriginHeader`. No se enviaron credenciales.
- Pantalla visible: login, Crear cuenta y recuperación.
- MongoDB de Render no auditado directamente: falta acceso a la URI privada. El arranque requiere conexión MongoDB, pero el health estático no prueba su estado actual ni cuentas existentes.

## Corrección necesaria en Render

En el servicio `proyectoerp-api`, conservar todos los orígenes autorizados existentes y agregar `http://localhost:8086` a `CORS_ORIGINS` (lista separada por comas, sin rutas). Guardar y desplegar la configuración. La autorización es de ese origen exacto; no usar `*`. No colocar `MONGODB_URI`, claves JWT ni claves de correo en Expo.

## Auditoría privada de MongoDB

Desde PowerShell:

```powershell
& 'C:\proyectoERP-integration\backend\scripts\Audit-Database.ps1'
```

Copiar la URI exacta del backend Render a la entrada oculta. Debe incluir un nombre explícito de base. El comando solo lee: ping, soporte de transacciones y cantidades de usuarios, empresas, roles y administradores. No imprime URI, correos, contraseñas ni hashes. No elimina ni modifica registros. Debe ejecutarlo un operador con acceso autorizado; no es un endpoint público.

## Primera cuenta

Si la base de destino está vacía, ejecutar:

```powershell
& 'C:\proyectoERP-integration\backend\scripts\Initialize-Owner.ps1'
```

Utiliza entradas ocultas para URI, secreto privado y contraseña propia; nombre, correo y empresa son solicitados al operador. El secreto es de al menos 32 caracteres, suministrado solo al proceso privado. No existe contraseña predeterminada. El servicio crea empresa y usuario ADMIN de esa empresa mediante una transacción, registra auditoría y rechaza conflictos; una repetición idéntica es idempotente. No crea un usuario SUPER_ADMIN. MongoDB debe admitir transacciones.

Si ya hay cuentas o empresas, no ejecutar inicialización para sustituirlas. Revisar los resultados y usar acceso o recuperación existentes; no borrar datos para habilitar el procedimiento.

## Verificación pendiente

Después de corregir CORS y crear/verificar la cuenta con credenciales del propietario: login real desde el frontend, empresa, dashboard, módulos, recarga y logout. También comprobar proveedor de correo y enlaces de recuperación. La prueba sintética de integración anterior es una validación del código; no demuestra acceso del propietario en Render. Esta auditoría no afirma que producción ya sea accesible.

Alternativa privada con API key de Render: ejecutar backend/scripts/Configure-RenderCors.ps1. Descubre el servicio por nombre y URL exactos, agrega solo el origen localhost:8086 conservando los demás, actualiza únicamente CORS_ORIGINS y solicita un despliegue de la imagen existente. La clave se introduce oculta y no se guarda. Pendiente de ejecutar con acceso del propietario.

Validaciones ejecutadas en esta auditoría: lint backend correcto; 23 suites y 218 pruebas del ERP correctas; 4 pruebas adicionales del configurador CORS correctas; sintaxis JS y PowerShell correcta; exportación Expo web y verify:web correctos. Las pruebas utilizan bases temporales, nunca MongoDB de producción. No existe script lint del frontend.
