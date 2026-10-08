# Rediseño NexusERP: web y Android

## Alcance implementado

Rama local: codex/nexus-responsive-design, basada en main b162b162d3ae60171154d721377a138b4fe9ba46. No se publicó ni desplegó esta rama.

Se actualizaron login, registro, recuperación/restablecimiento, acceso pendiente de empresa, dashboard, CRM, productos, inventario y detalle de almacén, ventas, compras, finanzas, RRHH, proyectos, producción, usuarios/roles, configuración, auditoría y asistente IA. Estas pantallas comparten componentes React Native para web y Android; no hay una segunda interfaz web independiente.

## Identidad y componentes

- Logo: se conserva la geometría de sus estilos originales y los colores #4f46e5/#e0e7ff. Se escala uniformemente la composición original de 32 px. El wordmark conserva su fuente de sistema, peso, espaciado y color; la superficie clara permite contraste sin modificar la marca. El icono y los recursos nativos de inicio permanecen sin cambios.
- Tipografía del resto de la interfaz: Source Sans Pro Regular, SemiBold y Bold, archivos TTF originales locales con licencia SIL OFL y procedencia en frontend/assets/fonts/SOURCE.md. Carga con expo-font, integración nativa mediante plugin y fuente de sistema durante carga o fallo, sin bloquear la aplicación.
- Paleta: frontend/src/theme/colors.js. Azul noche para superficies, púrpura para acción principal, azul para enlaces, rosa para acentos y alertas, menta para estados positivos. Tipografía, radios, espaciado y sombras en frontend/src/theme/tokens.js y sus módulos.
- Controles: frontend/src/design/ui.js. Botones de al menos 48 px, relieve discreto, pulsación visible, foco de teclado, estados deshabilitado/carga, inputs con borde contrastado y texto de 16 px, modales desplazables con Escape, ciclo de Tab y restauración del foco. No hay animación decorativa permanente; modales sin transición animada.
- SafeAreaProvider/SafeAreaView y barras claras del sistema en DesignProvider. Teclado atendido mediante KeyboardAvoidingView y ScrollView. El botón Atrás cierra menú/modales, vuelve del detalle de almacén o formularios de ventas y finalmente al dashboard.

## Distribución

Escritorio web desde 1024 px: sidebar persistente de 256 px, cabecera y área de trabajo amplia. Tabla de productos desde 1200 px, con etiquetas y tarjetas equivalentes en tamaños menores y Android. Formularios y acciones se envuelven sin cortar texto. Login dividido desde 1024 px, una columna en celular.

Android y web móvil: menú mediante botón táctil, tarjetas, controles accesibles, modales desplazables y campos de una columna. Inventario usa selectores buscables de producto y almacén; conserva los identificadores internos y los contratos del backend sin mostrarlos en el formulario.

## Funciones conservadas

API exclusivamente https://proyectoerp-api.onrender.com/api/v1. AuthContext, servicios API, configuración de conexión, backend, permisos y documento impreso de factura no tienen cambios funcionales. La navegación respeta permisos y módulos habilitados en ambas distribuciones. No se añadieron pagos simulados, privilegios ni datos en producción. Las pruebas usan MongoDB temporal, credenciales aleatorias sin imprimir y transporte de Render interceptado hacia un backend aislado.

## Validación

Resultados y capturas reales en C:/proyectoERP/.local/nexus-design/report.json y archivos PNG del mismo directorio. El script backend/tests/design-browser.qa.js comprueba login/dashboard a 360, 390, 768, 1024, 1440 y 1920 px; visita las 14 pantallas de módulos en escritorio/celular; comprueba las tres fuentes cargadas, formularios/modales, Escape, menú, carga, error 503 sintético con recuperación, vacío, sesión al recargar y logout. Las capturas móviles son de navegador: no constituyen ejecución Android.

Pruebas de componentes: fuentes y fallback, pulsación/foco, disabled/busy, modales y foco de teclado, registro del botón Atrás, contraste AA de texto/botones/estados y bordes de campos. Pruebas previas de autenticación, exportación Excel, CRM y finanzas conservadas.

Regresión de navegador: catalog-browser.qa.js (45 pasos) y operations-browser.qa.js (61 pasos). Se comprobaron eliminaciones y dependencias, almacenes, ajustes, cotización/pedido/factura interna/cobro, PDF mediante flujo de impresión, compras/recepción, producción/consumo, empleados, tareas/proyectos, finanzas, configuración de módulos y sesión. La impresión de factura conserva la validación existente del HTML y llamada a print; no verifica una impresora física.

Resultados finales ejecutados:

| Comprobación | Resultado |
| --- | --- |
| npm ci desde raíz | Correcto; 1034 paquetes, lockfile reproducible |
| npm --prefix frontend run lint | Correcto |
| npm --prefix frontend test | 31 pruebas correctas |
| npm --prefix frontend run export:web | Correcto |
| npm --prefix frontend run verify:web | Correcto; artefactos y URL de API de Render |
| expo install --check | Dependencias compatibles |
| expo export --platform android | Correcto; Hermes HBC y tres fuentes |
| design-browser.qa.js | 55 comprobaciones correctas, sin excepciones JavaScript ni fallos de API inesperados |
| catalog-browser.qa.js | 45 pasos correctos |
| operations-browser.qa.js | 61 pasos correctos |
| Preservación de logo e identidad nativa | Estilos originales del gráfico e icono/inicio sin cambios |
| assembleDebug nativo local | Falló; CMake/NDK, descrito abajo |

La validación de navegador suma 161 comprobaciones/pasos. Se revisaron capturas reales de login, dashboard, tabla, formulario/modal, menú móvil y estados vacío/carga/error; no se trata de un resultado visual inferido solamente del código. El frontend es JavaScript; no existe proyecto tsconfig ni una comprobación TypeScript configurada. ESLint comprueba sintaxis, referencias, claves duplicadas y código inalcanzable, además de las pruebas ejecutadas.

## Android: límite concreto

Prebuild Android en una copia aislada finalizó, incorporando los tres TTF. La exportación Android/Hermes finalizó. El intento local assembleDebug falló en :expo-modules-core:configureCMakeDebug[arm64-v8a]: CXX1214, el comando CMake solicita Android 22 y ReactAndroid/hermestooling requiere 24. La auditoría de Gradle confirma minSdk 24 en app y bibliotecas; el NDK 27.1.12297006 local solo contiene source.properties/.installer y no la toolchain. No se modificó el proyecto Android versionado ni se parchearon dependencias para ocultar el fallo. Se requiere reinstalar/completar el NDK local o compilar en EAS y revisar el resultado.

No hay dispositivo conectado ni AVD disponible. Pendientes: ejecución de APK, barras/áreas seguras, teclado real, escalado de fuente, botón Atrás físico, rendimiento y navegación en teléfono. No se afirma que una nueva APK esté lista o que esos puntos estén verificados.

## Publicación

El propietario autorizó publicar e integrar el nuevo diseño. PR #19: https://github.com/sharon522yq/proyectoERP/pull/19. La revisión detectó un fallo del catálogo ante monedas heredadas inválidas; se corrigió con formato numérico seguro y dos pruebas de regresión. El frontend suma 33 pruebas correctas. Backend Node 22/24, Docker y frontend pasaron en GitHub.

La primera vista previa de Cloudflare falló. Su configuración tenía directorio raíz / y ningún comando de compilación. El propietario corrigió Vistas previas Base: raíz frontend, npm run export:web, npx wrangler preview y EXPO_PUBLIC_API_URL de Render. Este commit relanza la validación de esa configuración. No se afirma que el merge o el despliegue hayan terminado mientras sus comprobaciones estén pendientes.

EAS terminó correctamente la APK preview versión 11, fuente a1f783aba7b5dc0e2bc6bda55cef773a11853626, con firma remota existente y API de Render. Build: https://expo.dev/accounts/sharon71/projects/nexus-erp/builds/fd970a82-a220-40ca-bdc6-69d972c88df3. Descarga: https://expo.dev/artifacts/eas/iEbODRQYmjHnij7vH5EtUyif6aPcS4YNRGvkZIBSgnQ.apk. Se descargó y verificó: 70500936 bytes, firma válida con apksigner, paquete com.nexuserp.erp, versión 11, minSdk 24, targetSdk 36, actividad MainActivity, cuatro arquitecturas y tres TTF Source Sans Pro. El bundle incluye la API de Render. SHA256: C0D3E2F15796C36644FC431CABCDF9873C91E9C50923AB5F450D5BBD35919C94.

La compilación nativa EAS supera el bloqueo de toolchain local descrito arriba. Continúan pendientes las pruebas físicas Android: no hay dispositivo ni AVD disponible. Los 161 pasos de navegador y la exportación Hermes no sustituyen esas pruebas. Este nuevo commit solo actualiza documentación; la APK contiene el mismo código funcional del diseño.
