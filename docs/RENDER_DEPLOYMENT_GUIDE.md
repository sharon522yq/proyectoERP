# Guía paso a paso: desplegar el backend en Render

Esta guía corresponde al backend de este repositorio. Cloudflare se configura
**después** de comprobar que Render funciona.

## Confirmación visual en el panel de Render

En la pantalla **Events** del servicio, la fila situada debajo del nombre del
repositorio muestra tres datos: rama, commit activo y estado. Si allí aparece:

```text
main   d5f50db   Live
```

Render está funcionando, pero está ejecutando la versión antigua. Pulsar
**Manual Deploy** en ese momento vuelve a desplegar el último commit que Render
ve en `main`; no sube archivos desde la computadora ni fusiona un pull request.

Antes de volver a pulsar **Manual Deploy**, hay que conseguir que GitHub muestre
en `main` un commit posterior a `d5f50db`. La secuencia exacta es:

1. Abrir GitHub → `sharon522yq/proyectoERP` → **Pull requests**.
2. Abrir el PR que contiene las correcciones de despliegue.
3. Pulsar **Merge pull request** y luego **Confirm merge**.
4. Abrir GitHub → **Code**, seleccionar `main` y comprobar que el commit superior
   ya no sea `d5f50db`.
5. Volver a Render → **Manual Deploy → Clear build cache & deploy**.
6. Cancelar el diagnóstico si el evento nuevo todavía muestra `d5f50db`: eso
   significa que GitHub `main` aún no cambió o que Render está conectado a otro
   repositorio/rama.

No es necesario borrar el servicio que aparece como **Live**. El estado Live y
los `GET /health 200` confirman que el contenedor actual funciona; lo pendiente
es publicar y seleccionar la revisión nueva.

## 1. Qué significa el 404 del log anterior

El despliegue mostrado en el log **sí arrancó correctamente**: Render mostró
`Your service is live` y `GET /health 200`. El `HEAD / 404` y `GET / 404`
significaban únicamente que el commit desplegado (`d5f50db`) no tenía una ruta
en `/`. No eran un fallo del contenedor, de MongoDB ni del health check.

Esta revisión añade respuestas válidas para:

- `GET` y `HEAD /`
- `GET /health`
- `GET /api` y `GET /api/v1`
- `GET /docs`
- `GET /favicon.ico` (204)

Si esas rutas todavía devuelven 404, Render está ejecutando un commit anterior.

## 2. Publicar esta revisión en GitHub

Render solo puede desplegar commits que estén en GitHub. En una terminal local,
desde la raíz del repositorio:

```bash
git status
git log -1 --oneline
git remote -v
git push origin HEAD:main
```

Si se trabaja mediante pull request, no se debe ejecutar el último comando
directamente: sube la rama, abre el PR, espera que CI termine y pulsa **Merge**.
Luego comprueba en GitHub que `main` contiene los archivos `render.yaml` y
`backend/tests/deployment.test.js`.

El panel de Render debe mostrar el hash del nuevo commit, no `d5f50db`. Que el
repositorio local tenga el cambio no modifica por sí solo GitHub ni Render.

## 3. Crear o corregir el servicio de Render

### Opción A: servicio existente (recomendado para `proyectoerp-api`)

1. Abre **Render Dashboard → proyectoerp-api → Settings**.
2. En **Repository**, confirma `sharon522yq/proyectoERP`.
3. En **Branch**, selecciona `main`.
4. Deja **Root Directory** vacío.
5. Selecciona **Runtime: Docker**.
6. Establece **Dockerfile Path** en `backend/Dockerfile`.
7. Establece **Docker Build Context Directory** en `.`.
8. En **Health Check Path**, escribe `/health`.
9. Activa **Auto-Deploy: On Commit**.
10. Guarda los cambios.

No se debe configurar Root Directory como `backend` junto con el Dockerfile
actual: las instrucciones `COPY backend/...` parten de la raíz del repositorio.

### Opción B: Blueprint nuevo

1. Abre **Render Dashboard → New → Blueprint**.
2. Conecta `sharon522yq/proyectoERP`.
3. Selecciona la rama `main`.
4. Render detectará `render.yaml` en la raíz.
5. Revisa el servicio `proyectoerp-api` y completa las variables marcadas como
   `sync: false`.

No crees un segundo servicio con el mismo propósito si ya existe el actual.
`render.yaml` no cambia automáticamente la configuración de un servicio manual
antiguo; para ese servicio sigue los pasos de la opción A.

## 4. Configurar las variables del backend

En **Environment**, agrega:

```env
NODE_ENV=production
MONGODB_URI=mongodb+srv://USUARIO:CLAVE@CLUSTER.mongodb.net/erp?retryWrites=true&w=majority
JWT_SECRET=UN_VALOR_ALEATORIO_DE_MAS_DE_32_CARACTERES
JWT_REFRESH_SECRET=OTRO_VALOR_ALEATORIO_DISTINTO_DE_MAS_DE_32_CARACTERES
FRONTEND_URL=https://dominio-temporal.example
CORS_ORIGINS=https://dominio-temporal.example
```

Reglas importantes:

- `JWT_SECRET` y `JWT_REFRESH_SECRET` deben ser diferentes.
- No copies literalmente los valores de ejemplo.
- No agregues comillas alrededor de las variables.
- No agregues `/api/v1` a `FRONTEND_URL` o `CORS_ORIGINS`.
- Mientras Cloudflare no exista, el dominio temporal puede ser
  `http://localhost:19006`; luego se reemplazará por la URL de Pages.
- La contraseña de MongoDB debe estar codificada como URL si contiene `@`,
  `:`, `/`, `?`, `#` o `%`.

En MongoDB Atlas, autoriza conexiones desde Render. Para una primera prueba se
puede agregar `0.0.0.0/0` en **Network Access** y usar un usuario con acceso a
la base `erp`; después debe restringirse según la política del proyecto.

## 5. Forzar un despliegue del commit correcto

1. Abre **Manual Deploy**.
2. Selecciona **Clear build cache & deploy**.
3. Confirma que la primera parte del log dice `Checking out commit ...` con el
   hash presente en `main` de GitHub.
4. Espera `ERP backend v1.0.0 en puerto 10000`.
5. Espera `GET /health 200` y `Your service is live`.

Si el log vuelve a decir `Checking out commit d5f50db...`, no continúes
depurando la aplicación: la rama conectada en Render no contiene la revisión.

## 6. Verificar sin confundir rutas válidas con endpoints inexistentes

Abre, en este orden:

```text
https://proyectoerp-api.onrender.com/
https://proyectoerp-api.onrender.com/health
https://proyectoerp-api.onrender.com/api
https://proyectoerp-api.onrender.com/api/v1
https://proyectoerp-api.onrender.com/docs
```

Las primeras cuatro deben devolver 200; `/docs` debe abrir Swagger. La respuesta
de `/` y `/health` incluye `commit` cuando Render proporciona
`RENDER_GIT_COMMIT`, lo que permite compararlo con GitHub.

Una ruta inventada, por ejemplo `/dashboard` o `/api/v1/no-existe`, debe seguir
devolviendo 404. Eso confirma que el manejador de rutas desconocidas funciona.
Los endpoints de negocio pueden devolver 401 sin token; ese 401 también es
correcto y no representa un fallo de despliegue.

También se puede comprobar desde una terminal:

```bash
curl -i https://proyectoerp-api.onrender.com/
curl -i https://proyectoerp-api.onrender.com/health
curl -I https://proyectoerp-api.onrender.com/
```

## 7. Diagnóstico según el resultado

| Resultado | Causa más probable | Acción |
|---|---|---|
| Render muestra el commit viejo | Rama o PR sin publicar | Subir/mezclar a `main` y desplegar de nuevo |
| Build falla en `COPY backend/...` | Root Directory incorrecto | Dejarlo vacío y usar contexto `.` |
| Build falla en `npm ci` | Lockfile no llegó a GitHub | Confirmar `backend/package-lock.json` en `main` |
| Arranque falla por JWT | Secretos ausentes/cortos/iguales | Corregir ambos secretos en Environment |
| Arranque falla conectando MongoDB | URI, usuario o Network Access | Corregir Atlas y `MONGODB_URI` |
| `/health` da 200 pero `/` da 404 | Commit anterior desplegado | Comparar el hash del log y limpiar caché |
| Endpoint de negocio da 401 | Falta autenticación | Iniciar sesión y enviar Bearer token |
| Ruta desconocida da 404 | Comportamiento esperado | Usar una ruta documentada en `/docs` |

## 8. Cuándo continuar con Cloudflare

Continúa con Cloudflare Pages únicamente cuando `/`, `/health`, `/api/v1` y
`/docs` funcionen en Render. Después sigue la sección Cloudflare de
`docs/DEPLOYMENT.md`, despliega el frontend y sustituye `FRONTEND_URL` y
`CORS_ORIGINS` por la URL real `https://<proyecto>.pages.dev`.
