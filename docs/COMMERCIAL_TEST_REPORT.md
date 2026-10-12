# Informe de pruebas comerciales

Fecha: 2026-10-05. Runtime: Node v24.21.0 / npm 11.19.0, Windows. Persistencia real en MongoMemoryServer/MongoMemoryReplSet efímeros. No se usó la base de producción.

| Ejecución | Resultado | Evidencia |
|---|---|---|
| Baseline `npm run test:backend` | 16 suites, 181 aprobadas; 115.551 s | evidence/baseline-tests.txt |
| Baseline lint backend | Sin errores | evidence/baseline-lint.txt |
| Regresión `npm --prefix backend test` | 17 suites, 199 aprobadas; 110.876 s | evidence/regression-tests.txt |
| Comercial final `npm --prefix backend test -- --runTestsByPath tests/commercial.test.js` | 18 aprobadas; 38.344 s | evidence/commercial-tests.txt |
| Lint final backend | Sin errores ni warnings | evidence/backend-lint.txt |
| Export web final a dist-commercial | Bundle generado; 292 módulos, 545 KB; _headers/_redirects presentes | evidence/web-build.txt |
| git diff --check | Sin errores de whitespace; avisos de conversión LF/CRLF | Verificación local |
| Navegador local | Kernel de herramienta falló al iniciar, dos intentos | No hay screenshots ni QA visual aprobada |
| Render /health | Herramienta web no pudo acceder | No demuestra caída ni verifica despliegue |

Los últimos cambios posteriores a la regresión completa fueron campos de aceptación de términos, rechazo de cuerpo no Buffer y ajustes de ancho/errores de UI. Se repitieron suite comercial, lint y build; ninguna ejecución se presenta como QA visual.

## Cobertura comercial ejecutada

1. Registro rechaza privilegios y duplicados; pendiente no accede al ERP.
2. Verificación: uso único, vencimiento y cooldown de reenvío.
3. Dos resets del mismo token producen un éxito y un rechazo; acceso anterior revocado y nueva contraseña funciona.
4. Checkout deshabilitado sin importe o con modo mock.
5. Firma HMAC/tolerancia temporal; modificar cuerpo original invalida firma.
6. Activación simultánea crea una empresa/administrador; evento repetido no duplica; cruce de empresa y creación heredada de usuarios rechazados; setup repetido crea una sucursal.
7. Fallo temporal de proveedor no deja activación parcial; reintento recupera.
8. Importe incorrecto y pago pendiente no activan.
9. Evento antiguo usa snapshot actual; vigencia vencida rechaza API directa.
10. Dos invitaciones disputan último cupo y una se acepta; correo ajeno rechazado; invitado no obtiene comprobantes del propietario.
11. Cuenta existente contrata segunda empresa y conserva membresías; cambio a empresa ajena rechazado.
12. Checkout usa precio servidor y recupera sesión abierta; precio discrepante se rechaza.
13. Fallo DB después de crear empresa revierte empresa/cuenta/membresía; reintento crea una sola empresa.
14. Renovación recupera acceso; cancelación mantiene vigencia; reembolso restringe sin reactivación automática.
15. Webhook HTTP preserva raw body; firma falsa rechazada.
16. Pago rechazado/checkout vencido no crean empresa.
17. invoice.paid anterior al checkout recupera activación; evento duplicado de fallo crea un aviso.
18. Refresh concurrente permite una rotación; contraseña mayor de 72 bytes UTF-8 se rechaza en vez de truncarse.

## Evidencia del recorrido

Registro/login reales mediante Supertest → enlace leído del outbox privado de prueba → token consumido por API → catálogo/precio/checkout con mock de provider.stripe → snapshot de factura pagada y suscripción activa → empresa/membresía/contrato/pago persistidos en replica set efímero → sucursal única → invitación para correo concreto → aceptación y reserva de cupo → cancelación/recuperación.

Demuestra el recorrido de API y persistencia local. Stripe está simulado exclusivamente en Jest: no son pagos reales ni validación con Stripe. Resend no recibió mensajes; outbox no equivale a envío. La landing compiló, pero no se ejecutó el recorrido completo en navegador.

## Fallos corregidos

Primera regresión: 189/191. La prueba antigua esperaba ignorar privilegios públicos y ahora exige rechazo sin crear cuenta. Se corrigió la autenticación para preservar tokens heredados con permisos restringidos. Siguiente ejecución: 191/191.

Otra ejecución falló en 25 pruebas por EACCES al reservar puertos, sin llegar a sus aserciones. Puertos 56254 y 54733 estaban en rangos excluidos de Windows, confirmados por netsh. El harness recupera exclusivamente ese error con puerto elegido por el sistema. Las siguientes regresiones completas pasaron. No se eliminaron tests ni se redujeron validaciones.

## Pendientes y riesgos

Stripe test real: checkout, firma/entrega/reintento, renovación, portal, comprobantes, reembolso y disputa. Correo: recepción y dominio verificado. Navegador: teclado, contraste, 360/1440 px, enlaces directos, recarga, cierre/abandono y regreso. MongoDB desplegado: índices/transacciones y respaldo/restauración. Hosting: CORS, dominios, scheduler y disponibilidad de webhook. Exportación sensible sin implementar tras rechazo automático. Términos/fiscalidad/retención pendientes. localStorage de sesión heredado requiere revisión antes de habilitación comercial.

No se declara listo para producción. No se ejecutaron cobros ni despliegues.
