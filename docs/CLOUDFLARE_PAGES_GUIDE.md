# Guía paso a paso: desplegar el frontend en Cloudflare Pages

> **Importante sobre el panel nuevo:** si la pantalla contiene los campos
> **Build command** y **Deploy command**, y la URL del panel contiene
> `/workers/services/`, Cloudflare creó un **Worker con Builds**, no un proyecto
> Pages clásico. Esa modalidad también sirve para este frontend, pero necesita
> completar ambos comandos. Sigue primero la sección siguiente.

## Configuración para la pantalla “Builds” de Workers

La pantalla no está configurada si **Build command**, **Deploy command** y
**Root directory** aparecen vacíos, o si dice **No build variables or secrets
configured**. En **Settings → Builds → Build configuration**, pulsa **Edit** y
guarda exactamente:

| Campo | Valor |
|---|---|
| Build command | `npm run export:web` |
| Deploy command | `npm run deploy:cloudflare` |
| Root directory | `frontend` |
| Production branch | `main` |

La configuración visual es correcta cuando, en la misma pantalla, también se
ve un **API token** seleccionado y las variables `EXPO_PUBLIC_API_URL` y
`NODE_VERSION`. El aviso rojo **Latest build failed** puede seguir visible
porque describe el intento anterior; no desaparece hasta guardar y completar
un build nuevo. Los campos **Build watch paths** pueden conservar sus valores
predeterminados (`*` como inclusión). No es necesario excluir manualmente
`node_modules` o `.git`, aunque conservar esas exclusiones tampoco afecta el
build.

En **Variables and secrets**, agrega variables de texto plano para Production:

```env
EXPO_PUBLIC_API_URL=https://proyectoerp-api.onrender.com/api/v1
NODE_VERSION=24
```

El repositorio incluye `frontend/wrangler.jsonc`: Wrangler publicará `dist` como
assets estáticos y enviará las rutas desconocidas a la aplicación web. No
agregues `dist` al campo Root directory ni al Deploy command.

Después de guardar:

1. Desplázate hasta el final de Settings y pulsa **Save** si el panel lo muestra.
2. Abre **Deployments/Builds**.
3. En el build fallido, usa **Retry deployment**; si no aparece, crea un nuevo
   commit o utiliza **Deploy latest commit**.
4. Abre el log completo y confirma primero `App exported to: dist` y después una
   ejecución satisfactoria de `wrangler deploy`.

Si el build falla antes de ejecutar `npm run export:web`, confirma que Root
directory sea `frontend`. Si falla diciendo que no encuentra `wrangler.jsonc` o
`dist`, también está ejecutándose desde la raíz equivocada.

### Error `Missing script: "deploy:cloudflare"`

Este error no se corrige reintentando el mismo commit. Significa que Cloudflare
sí entró correctamente en `frontend`, pero el `frontend/package.json` del commit
clonado todavía no contiene el script. El log permite confirmarlo si el build
muestra la definición antigua:

```text
> npx expo export --platform web
```

La revisión preparada muestra en cambio `expo export --platform web
--output-dir dist --clear` y también define `deploy:cloudflare`. Para corregirlo:

1. Fusiona en GitHub el PR que agrega `frontend/wrangler.jsonc` y el script
   `deploy:cloudflare`.
2. En GitHub → **Code** → rama `main`, abre `frontend/package.json` y busca
   literalmente `deploy:cloudflare`.
3. Confirma también que `frontend/wrangler.jsonc` sea visible en `main`.
4. En Cloudflare ejecuta **Deploy latest commit**, no **Retry** sobre el build
   antiguo. La cabecera del log debe mostrar el hash nuevo.

Como alternativa temporal, una vez que `frontend/wrangler.jsonc` ya exista en
`main`, el campo **Deploy command** puede contener directamente:

```text
npx --yes wrangler@4 deploy
```

La alternativa evita depender del script de npm, pero no evita la necesidad de
publicar `wrangler.jsonc`. La configuración recomendada sigue siendo
`npm run deploy:cloudflare` para mantener el comando versionado en Git.

## Protección añadida en GitHub

El workflow `.github/workflows/ci.yml` ahora tiene el job **Frontend /
Cloudflare readiness**. En cada pull request y push a `main` instala desde el
lockfile, genera `frontend/dist` con la URL productiva y comprueba el HTML, las
reglas de Cloudflare, `wrangler.jsonc` y la URL de Render dentro del bundle. No
despliega ni modifica Render/Cloudflare: solamente impide considerar lista una
revisión que no pueda compilarse.

Antes de fusionar, espera que ese check aparezca verde. Esta protección consume
algunos minutos de GitHub Actions, pero no cambia el backend ya desplegado ni
requiere guardar tokens de Cloudflare en GitHub.

### No uses `echo "No deploy command needed"` en Workers Builds

Ese consejo corresponde a otros flujos de Pages donde la plataforma publica un
directorio de salida por separado. En la interfaz mostrada aquí se creó un
**Worker con Builds**: el campo **Deploy command** es la fase que publica los
assets. Un `echo` terminaría sin error, pero no ejecutaría Wrangler ni publicaría
`dist` en el Worker.

Usa una de estas opciones, después de publicar `wrangler.jsonc` en `main`:

```text
npm run deploy:cloudflare
```

o directamente:

```text
npx --yes wrangler@4 deploy
```

Si el navegador traduce GitHub al español, puede mostrar visualmente `main` como
“principal”, `frontend` como “Interfaz”, `docs` como “documentos” y
`package.json` como “paquete.json”. La traducción no cambia los nombres reales:
en Cloudflare deben seguir escribiéndose `main`, `frontend` y los comandos en
inglés. Para comprobar archivos sin ambigüedad, desactiva temporalmente la
traducción automática de GitHub.

## 1. Condición previa

No continúes si Render no muestra `HEAD / 200`, `GET / 200`,
`GET /health 200` y `Your service is live`. La URL que debe usar el frontend es:

```text
https://proyectoerp-api.onrender.com/api/v1
```

La página raíz de Render es solamente el índice informativo del backend; no es
la interfaz visual del ERP.

## 2. Crear el proyecto de Pages

1. Abre Cloudflare Dashboard.
2. Entra en **Workers & Pages**.
3. Pulsa **Create application** (o **Create**) → **Pages** → **Connect to Git**.
4. Autoriza GitHub si Cloudflare todavía no tiene acceso.
5. Selecciona `sharon522yq/proyectoERP`.
6. En **Production branch**, selecciona `main`.

No elijas **Direct Upload**: conectar Git permite desplegar automáticamente cada
commit nuevo de `main`.

Esta sección describe Pages clásico. Si ya tienes la pantalla **Builds** de un
Worker conectado a Git, no necesitas borrar el proyecto: usa la configuración
de Workers indicada al comienzo de esta guía.

## 3. Configuración exacta del build

Configura estos valores:

| Campo de Cloudflare | Valor |
|---|---|
| Framework preset | `None` |
| Build command | `npm run export:web` |
| Build output directory | `dist` |
| Root directory | `frontend` |

En **Environment variables (Production)** agrega:

```env
EXPO_PUBLIC_API_URL=https://proyectoerp-api.onrender.com/api/v1
NODE_VERSION=24
```

Detalles que evitan errores frecuentes:

- `EXPO_PUBLIC_API_URL` debe incluir `https://` y terminar en `/api/v1`.
- No agregues una barra final después de `/api/v1`.
- `Root directory` debe ser `frontend`, no `/frontend` ni la raíz vacía.
- `Build output directory` es `dist` relativo a `frontend`; no uses
  `frontend/dist`.
- Las variables `EXPO_PUBLIC_*` se insertan al compilar. Si se cambian, hay que
  ejecutar un nuevo deploy.

## 4. Ejecutar y revisar el primer despliegue

Pulsa **Save and Deploy**. El log correcto debe incluir de forma equivalente:

```text
npm install
npm run export:web
App exported to: dist
Success: Assets published
```

Al finalizar, Cloudflare entregará una URL estable similar a:

```text
https://nombre-del-proyecto.pages.dev
```

Abre esa URL. Debe mostrarse la pantalla web de NexusERP, no el JSON del
backend. Si el sitio abre pero el login muestra un error de red o CORS, sigue el
paso 5; el primer build puede estar correcto aunque Render aún no autorice el
nuevo origen.

## 5. Autorizar la URL de Pages en Render

Copia la URL estable de Pages, sin barra final. En Render abre:

```text
proyectoerp-api → Environment
```

Establece:

```env
FRONTEND_URL=https://nombre-del-proyecto.pages.dev
CORS_ORIGINS=https://nombre-del-proyecto.pages.dev
```

Si también habrá un dominio propio, usa una lista separada por comas:

```env
CORS_ORIGINS=https://nombre-del-proyecto.pages.dev,https://erp.tudominio.com
```

No escribas `/api/v1` en estas dos variables. Guarda los cambios y espera el
redeploy/restart de Render.

## 6. Comprobar CORS antes de probar el login

Sustituye el origen por tu URL real de Pages:

```bash
curl -i -X OPTIONS \
  https://proyectoerp-api.onrender.com/api/v1/auth/login \
  -H "Origin: https://nombre-del-proyecto.pages.dev" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: content-type"
```

La respuesta debe incluir:

```text
Access-Control-Allow-Origin: https://nombre-del-proyecto.pages.dev
```

Si esa cabecera no aparece:

1. Comprueba que `CORS_ORIGINS` coincida exactamente con protocolo y dominio.
2. Quita cualquier barra final.
3. Confirma que Render guardó la variable y reinició el servicio.
4. No uses `*`; el backend trabaja con una lista explícita de orígenes.

## 7. Verificar que el bundle usa Render y no localhost

En el navegador abre el sitio de Pages y luego:

1. Pulsa `F12` → **Network**.
2. Intenta iniciar sesión.
3. Selecciona la solicitud `login`.
4. La Request URL debe comenzar con:

```text
https://proyectoerp-api.onrender.com/api/v1/auth/login
```

Si comienza con `http://localhost:4000`, la variable no estuvo disponible al
compilar. Agrégala tanto al entorno **Production** como, si se usa, **Preview**,
y ejecuta **Deployments → Retry deployment** después de limpiar la caché del
build.

## 8. Dominio propio (después de validar pages.dev)

1. En Pages abre **Custom domains** → **Set up a custom domain**.
2. Agrega, por ejemplo, `erp.tudominio.com`.
3. Si el DNS está en Cloudflare, acepta el registro sugerido.
4. Espera que el certificado figure como activo.
5. Agrega el dominio a `CORS_ORIGINS` en Render.
6. Cambia `FRONTEND_URL` al dominio que será el principal.
7. Vuelve a verificar CORS usando el nuevo origen.

## 9. Resultados esperados

| Prueba | Resultado correcto |
|---|---|
| URL `pages.dev` | Carga la interfaz NexusERP |
| Recargar una ruta web | No produce 404 gracias a `_redirects` |
| Assets `/_expo/static/*` | Responden 200 y admiten caché larga |
| Solicitud de login | Va a Render mediante HTTPS |
| Preflight OPTIONS | Devuelve `Access-Control-Allow-Origin` con Pages |
| Ruta raíz de Render | Sigue mostrando JSON; es correcto |

## 10. Instancias gratuitas de Render

El servicio gratuito puede suspenderse por inactividad. La primera solicitud
desde Pages puede tardar alrededor de un minuto y parecer un timeout. Espera a
que `https://proyectoerp-api.onrender.com/health` responda y repite el login. Un
inicio en frío no se corrige cambiando CORS ni reconstruyendo el frontend.
