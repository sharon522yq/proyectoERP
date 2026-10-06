# Publicar esta rama y crear el Pull Request real

Los commits locales y la preparación del título/cuerpo de un Pull Request no
aparecen en GitHub hasta que la rama se envía (`git push`) con una cuenta que
tenga permiso de escritura. Este entorno no tiene una sesión de GitHub iniciada
ni un remoto `origin` configurado, por lo que no puede publicar por sí solo.

## Estado que debe publicarse

La rama contiene, en orden, las correcciones funcionales y sus protecciones de
CI. El commit superior incluye a los anteriores, así que se publica la rama
completa; no es necesario crear un PR por cada commit.

## Desde un terminal que tenga acceso a esta copia del repositorio

No pegues tokens en comandos, archivos o mensajes. Autentica GitHub CLI mediante
su flujo seguro y después publica una rama, nunca directamente sobre `main`:

```bash
gh auth login
git remote add origin https://github.com/sharon522yq/proyectoERP.git
git push -u origin HEAD:codex/cloudflare-deployment
gh pr create \
  --base main \
  --head codex/cloudflare-deployment \
  --title "Prepare Render and Cloudflare Workers deployment" \
  --body "Adds reproducible deployment configuration, Cloudflare static assets, CORS handling, deployment checks, tests, and runbooks."
```

Si `origin` ya existe, reemplaza `git remote add` por:

```bash
git remote set-url origin https://github.com/sharon522yq/proyectoERP.git
```

## Verificación en GitHub

Antes de fusionar, el PR debe mostrar como nuevos o modificados, entre otros:

```text
frontend/wrangler.jsonc
frontend/package.json
frontend/.node-version
.github/workflows/ci.yml
backend/src/app.js
```

Espera que los checks estén verdes, fusiona el PR y luego usa **Deploy latest
commit** en Cloudflare. Reintentar un build asociado al commit antiguo no hace
que Cloudflare descargue la rama nueva.

## Si solo tienes acceso al navegador

No recrees manualmente los archivos uno por uno ni compartas un token. Abre un
entorno Git autenticado (GitHub Codespaces, GitHub Desktop o un clon local),
aplica/publica la rama completa y crea un único PR. Esto conserva el historial,
permite revisión y evita dejar `main` en un estado parcialmente configurado.
