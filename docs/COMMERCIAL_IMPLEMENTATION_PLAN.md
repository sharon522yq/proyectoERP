# Implementación comercial

Fecha: 2026-10-05. Alcance: landing → registro → verificación → checkout → activación → configuración → invitaciones → suscripción.

Cada fila es una tarea de fase. El estado final y evidencia de ejecución se mantienen en COMMERCIAL_PROGRESS.md y COMMERCIAL_TEST_REPORT.md. No se han ejecutado cobros ni publicaciones.

| ID | Objetivo | Dependencias | Archivos principales | Criterio de aceptación |
|---|---|---|---|---|
| C00 | Auditar arquitectura y establecer baseline | Repositorio | auth/*, middlewares/auth.js, app.js, tests/* | Diagnóstico de autenticación, aislamiento y scripts con ejecución real |
| C01 | Centralizar reglas y bloquear configuración incompleta | C00 | commercial/catalog.js, .env.commercial.example | Checkout usa catálogo servidor; producción no acepta modo de prueba ni aprobación ausente |
| C02 | Modelar contratos y membresías recuperables | C00,C01 | commercial/models.js, routes.js, service.js | Índices únicos; múltiples empresas por propietario; una contratación pendiente por cuenta |
| C03 | Registro, verificación y recuperación seguros | C02 | auth/*, users/user.model.js, commercial/mail.js | Registro rechaza privilegios; contraseña cifrada con bcrypt; tokens hash de uso único; correo recibido |
| C04 | Exigir plan, vigencia, aislamiento y cupos | C02,C03 | middlewares/auth.js, commercial/service.js | API directa no evade restricciones; último cupo concurrente no se duplica; exportación autorizada durante restricción |
| C05 | Checkout, webhook y activación transaccional | C01-C04 | commercial/provider.js, service.js, models.js | Pago real de prueba verificado por proveedor activa exactamente una empresa; rollback y reintento sin cobro adicional |
| C06 | Landing y navegación comercial en español | C01,C03,C05 | CommercialScreen.js, App.js, public/* | Catálogo coincide; enlaces recargan; escritorio/celular y teclado inspeccionados |
| C07 | Configuración e invitaciones | C03-C05 | commercial/service.js, CommercialScreen.js | Sucursal única; invitación vincula correo, rol y empresa; aceptación concurrente respeta cupos |
| C08 | Gestión, pagos, cancelación y soporte | C04,C05 | commercial/*, commercial-support.js, commercial-status.js | Vigencia preservada al cancelar; restricciones por reembolso/disputa; soporte no accesible al tenant |
| C09 | QA integral | C03-C08 | tests/commercial.test.js, tests/mongo-ports.js, documentos de evidencia | Regresión y build pasan; validación visual y de proveedor sin fallos altos |
| C10 | Preparar y validar despliegue | C09, acceso externo | render.commercial.example.yaml, public/*, scripts/commercial-indexes.js | Webhook, correo, scheduler, respaldo y restauración verificados en entornos reales |
| C11 | Operación y entrega | C08-C10 | COMMERCIAL_DEPLOYMENT.md, scripts/commercial-* | Alertas, reconciliación y recuperación documentadas y probadas en entorno operativo |

## Contratos de API

Todos los endpoints comerciales están bajo `/api/v1/commercial`. El registro reutiliza `/api/v1/auth/register` y añade `confirmPassword`, `companyName`, `acceptTerms` booleano y `termsVersion`.

| Método/ruta | Acceso | Resultado |
|---|---|---|
| GET /catalog | Público | Plan, precio configurado o null, moneda, periodo, módulos y límites |
| POST /verify | Token | Consumo atómico de token, verifica correo |
| POST /verification | Autenticado | Reenvío limitado, bandeja de correo |
| POST /contracts | Cuenta existente | Contratación pendiente recuperable; exige términos |
| GET /subscription | Autenticado | Estado, vigencia, cupos y pagos; invitado no recibe comprobantes del propietario |
| GET /memberships | Autenticado | Empresas de la cuenta |
| POST /switch-company | Miembro | Cambia contexto únicamente a una membresía propia |
| POST /checkout | Propietario verificado | URL de checkout alojado, precio validado contra servidor |
| POST /webhook | Firma del proveedor | Reconcilia snapshot actual; no utiliza redirección del navegador |
| POST /setup | Propietario activo | Crea una sola sucursal principal |
| POST /invitations | Admin de empresa heredada o propietario comercial activo | Token ligado al correo/empresa y rol de empresa permitido; comerciales reservan cupo al aceptar |
| POST /invitations/accept | Cuenta autenticada con token exacto | Membresía atómica; el token de correo confirma la dirección |
| POST /invitations/complete | Invitación válida | Crea cuenta y membresía en una transacción; token prueba control del correo |
| POST /portal | Propietario | Portal de pagos y comprobantes |
| POST /cancel | Propietario | Cancelación al final del periodo |

`GET /api/v1/auth/me` actualiza el perfil. El acceso operativo consulta identidad y empresa en DB; los privilegios de plataforma quedan fuera de la contratación.

## Pantallas y recuperación

Rutas web por fragmento: `#home`, `#register`, `#verify?token=…`, `#forgot`, `#reset?token=…`, `#subscription`, `#invite?token=…`, `#new-contract`, `#cancel`, `#legal`. La invitación permite registrar una cuenta directamente en la empresa o iniciar sesión con una cuenta existente. No se activa una empresa por un parámetro de éxito. El propietario retoma una sesión abierta y el worker reconcilia checkout cerrado o activación interrumpida.

Estados internos: pending → checkout → active; checkout abandonado → expired; active → restricted/canceled; restricted → active únicamente con snapshot pagado y vigente, sin retención por disputa/reembolso. Confirmación de pago y creación de empresa se confirman dentro de la misma transacción. Ninguna API admite escribir un estado arbitrario.
