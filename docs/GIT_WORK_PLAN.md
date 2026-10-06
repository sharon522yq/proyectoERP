# Ejecución del plan ERP

Base auditada: b48dbe5. Trabajar mediante PR revisables y ramas encadenadas; no desplegar automáticamente los cambios pendientes de QA.

## Dependencias existentes
- PR #3 despliegue: revisar antes de fusionar. Contiene regresiones de versiones Expo/React y permisos respecto de main; no integrarlo completo.
- PR #4 registro: sus cambios se reutilizan en feat/erp-access; no fusionar ambos sin comparar diferencias.
- PR #5 QA: replica sets aislados, 181 pruebas aprobadas.

## Orden de integración
1. chore/qa-baseline: entorno de integración con transacciones.
2. feat/erp-access: conexión Render, setup, registro, correo, revocación de sesiones.
3. fix/erp-permissions: autorización e aislamiento.
4. fix/erp-transactions: atomicidad, producción e inventario.
5. feat/erp-workflows: interfaces operativas y despliegue.

Cada PR indicará base y dependencia; integrar en orden, actualizar base y ejecutar checks antes de fusionar. Cada commit separa cambios de aplicación, regresión y documentación cuando corresponde.

## Servicios externos
Se requieren INITIAL_SETUP_TOKEN (aleatorio >=32 caracteres, retirar tras configurar), RESEND_API_KEY, MAIL_FROM verificado, FRONTEND_URL y CORS_ORIGINS del frontend. Nunca guardar secretos en Git.

La configuración inicial solo se permite con cero usuarios. Los registros públicos siguen pendientes de asignación; un administrador crea usuarios de su empresa. La existencia de usuarios previos exige revisar el alta inicial, no habilitar registro privilegiado público.

No se han validado correo real, restauración de backup ni Android físico. Estos pasos no se consideran aprobados por una exportación web o pruebas simuladas.
