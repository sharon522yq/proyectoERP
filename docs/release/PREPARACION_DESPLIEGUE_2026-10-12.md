# NexusERP: candidato de publicación, 12 de octubre de 2026

Estado: correcciones de la auditoría implementadas y verificadas localmente. Candidato preparado; no publicado. La habilitación en producción queda condicionada al preflight de la base de destino y al job Docker de CI.

## Código y preservación del trabajo

El candidato está en `C:\proyectoERP\.local\release-candidate`, rama `codex/release-readiness`, basado en main `9922e2a2a2bd9a9e6d4c1809eb25d1c81f24e774`, que coincidía con el backend publicado al iniciar la preparación. El checkout raíz estaba en `b48dbe5`, con cambios locales y funcionalidades experimentales: se conservaron allí, además de una copia del diff en `.local/preparation-local-changes.patch`. No se trasladaron servicios antiguos que habrían eliminado las correcciones de main. Las extensiones comerciales locales requieren su integración y validación independiente; no se presentan como parte de este candidato.

## Hallazgos corregidos

| Hallazgo | Resultado verificado |
| --- | --- |
| B1 recepción parcial al fallar finanzas | Stock, documento y movimiento se revierten juntos. Reintentar recibe cinco unidades una sola vez. |
| B2 confirmación concurrente | Un único descuento y movimiento; la segunda confirmación se rechaza. |
| B3 producción sin consumo | No permite completar ni generar producto terminado sin consumir los materiales requeridos. |
| B4 saldo perdido por concurrencia | Dos ingresos de siete sobre saldo diez producen veinticuatro. |
| B5 transferencia unilateral | Se rechaza sin modificar saldo. No se habilitó una transferencia incompleta. |
| B6 referencia a categoría de otra empresa | Alta y edición validan empresa, categoría activa y unidad existente. También se previenen ciclos de categorías. |

Main ya incluía las transacciones de B1–B5; el candidato las conserva y añade regresiones que reproducen los hallazgos sin las barreras artificiales del checkout antiguo. También incorpora idempotencia para ajustes de inventario, protección contra doble clic, reintento ante colisiones de índices, rechazo de tokens con empresa anterior y comprobación de índices antes de aceptar mutaciones.

En acceso, login espera hasta noventa segundos, valida la respuesta y no reenvía credenciales automáticamente. La restauración conserva tokens ante fallos temporales del servidor y permite reintentar. Los errores de credenciales, red, espera y servidor se distinguen. La captura original no permite determinar una causa definitiva del fallo publicado: no se reprodujo durante la auditoría. Estas correcciones cubren los fallos comprobados del cliente; la confirmación con la cuenta real se hará después de publicar.

Ventas permite entrar a roles que solo leen facturas y selecciona una pestaña autorizada. Los resúmenes requieren permisos para todas las fuentes que consultan. Las rutas guardadas conservan el módulo y bloquean pantallas sin autorización o módulos deshabilitados. Facturado y cobrado se muestran por separado; los agregados no se presentan como saldo por moneda.

La inspección de escritorio y pantalla de 390×844 detectó un registro de BackHandler de Android en web; se corrigió limitándolo a Android. La compilación y las pruebas comprueban ambas plataformas. Esto no sustituye pruebas en un dispositivo Android físico.

## Evidencia y límites

- Backend completo: 29 suites, 264 pruebas aprobadas. Regresión específica final: ocho pruebas aprobadas, incluida detección de datos duplicados en preflight.
- Frontend final: 44 pruebas aprobadas; lint de backend y frontend aprobado.
- React/DOM 19.2.3 y React Native 0.86.3 coherentes; render web real del runtime aprobado.
- Exportación web y Android aprobadas; Android es JavaScript Hermes y recursos, no un APK firmado.
- Simulación de Cloudflare aprobada, usando `wrangler deploy --dry-run`; no hubo publicación.
- Instalación de servidor equivalente a Docker: 300 paquetes, arranque de Express aprobado, auditoría de producción con cero vulnerabilidades.
- Docker no está disponible en este equipo. CI conserva el build Linux de la imagen y su prueba de arranque: debe aprobar antes de publicar.
- No se ejecutaron pruebas con escrituras sobre la base de producción ni se modificaron cuentas, roles, secretos o hosting.

El manifiesto `frontend/dist/release.json` contiene commit, huella del código, destino de API y SHA-256 de los activos. Se genera después de cada exportación. La verificación web comprueba sus hashes. Los artefactos antiguos de Android se retiraron del control de código; se entregan compilaciones actuales como archivos separados.

## Dependencias

Se fijaron `uuid` 11.1.1 y `source-map-js` 1.2.2. Docker ahora instala solo el workspace backend: se eliminó la instalación de paquetes huérfanos del frontend que añadía braces/micromatch al servidor. El informe de producción sin alertas está en `evidence/backend-runtime-audit.json`.

La auditoría de todo el monorepo conserva 62 entradas propagadas (57 altas, cinco moderadas), correspondientes a tres avisos sin versión corregida: [braces](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm), [node-forge](https://github.com/advisories/GHSA-86w9-cpqp-85rv) y [sprintf-js](https://github.com/advisories/GHSA-hp3w-g68c-fv3c). No se afirma que hayan sido parcheados. Se restringen a herramientas de construcción y pruebas: no figuran en la instalación de producción del backend. La exportación web es estática y no publica el servidor de Metro. Construir únicamente código confiable; no procesar patrones, certificados o formatos arbitrarios externos mediante estas herramientas. No se aplicó la degradación incompatible de Expo sugerida por `npm audit fix --force`. Las alertas y su aceptación residual deben revisarse al autorizar la publicación.

## Procedimiento de publicación preparado

1. Usar este candidato, no el checkout raíz antiguo. Revisar el diff y ejecutar CI en la rama antes de integrar. Render tiene despliegue automático por commit: no subir ni integrar a main hasta autorizar la publicación.
2. Crear una copia recuperable de la base de destino y conservar el commit anterior y su versión de Cloudflare para reversión.
3. En un entorno seguro con `MONGODB_URI` configurada, ejecutar `npm --prefix backend run release:preflight`. Es de solo lectura: verifica soporte de transacciones y duplicados que impedirían crear índices únicos. No imprime la URI ni documentos. Detenerse ante cualquier fallo; corregir los datos históricos mediante un plan revisado, no borrarlos automáticamente.
4. Confirmar los secretos existentes, CORS y FRONTEND_URL, módulos habilitados y envío de recuperación de contraseña. No rotar secretos JWT durante esta publicación ni ejecutar inicialización de propietario sobre cuentas existentes.
5. Publicar backend primero, comprobar `/health` y el commit reportado, y esperar a que termine la preparación de índices. MongoDB debe ser replica set o clúster sharded; el servidor rechazará una instalación sin transacciones.
6. Desde el candidato ejecutar `npm --prefix frontend run deploy:cloudflare`. El comando usa Wrangler 4.149.0, vuelve a compilar y verifica los activos antes de subir. API fijada a `https://proyectoerp-api.onrender.com/api/v1`.
7. Verificar el manifiesto publicado y probar login/restauración con la cuenta real, permisos y recuperación. Hacer operaciones comerciales de prueba únicamente en una empresa de pruebas autorizada.

La publicación y las verificaciones del destino no se ejecutaron en esta preparación. El paquete contiene código y artefactos verificables; no incluye credenciales ni bases de datos.

## Reversión

Si el backend no inicia o falla la comprobación funcional, detener la publicación del frontend y restaurar el despliegue previo de Render. Si el frontend falla, restaurar la versión anterior de Cloudflare. No eliminar índices ni movimientos para revertir una versión: las nuevas claves requestId son opcionales y los índices son aditivos. Revisar compatibilidad si se considera volver más atrás que main `9922e2a`; versiones antiguas carecen de protecciones transaccionales. Solo restaurar la copia de base de datos con una decisión explícita y un plan para reconciliar operaciones posteriores.
