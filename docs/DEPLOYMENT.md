# DEPLOYMENT

Última actualización: 2026-09-22

## Requisitos

- Node.js 18+
- npm 9+
- MongoDB Atlas (producción) o MongoDB local (desarrollo)

## Desarrollo Local

### Instalación

```bash
# Clonar repositorio
git clone <repo-url>
cd Default\ Project

# Backend
cd backend
cp ../.env.example .env
# Editar .env con tus credenciales
npm install

# Ejecutar tests
npm test

# Iniciar en modo desarrollo
npm run dev
```

### Variables de Entorno

Copiar `.env.example` a `.env` y configurar:

```env
NODE_ENV=development
PORT=4000
MONGODB_URI=mongodb://localhost:27017/erp
JWT_SECRET=tu-secreto-aqui-minimo-32-caracteres
JWT_REFRESH_SECRET=otro-secreto-aqui-minimo-32-caracteres
JWT_ACCESS_EXPIRES=15m
JWT_REFRESH_EXPIRES_DAYS=7
FRONTEND_URL=http://localhost:19006
```

**IMPORTANTE**: Nunca commitear `.env` a Git.

## Docker

### Con Docker Compose

```bash
# Iniciar todo
docker-compose up -d

# Ver logs
docker-compose logs -f

# Detener
docker-compose down
```

Esto inicia:
- **MongoDB**: Puerto 27017
- **Backend**: Puerto 4000

### Solo Backend (Dockerfile)

```bash
cd backend
docker build -t erp-backend .
docker run -p 4000:4000 --env-file ../.env erp-backend
```

## MongoDB Atlas

### Configuración

1. Crear cuenta en [mongodb.com/atlas](https://www.mongodb.com/atlas)
2. Crear cluster gratuito (M0)
3. Crear usuario de base de datos
4. Whitelist IP (0.0.0.0/0 para desarrollo)
5. Obtener connection string
6. Configurar en `.env`:
   ```
   MONGODB_URI=mongodb+srv://<user>:<password>@cluster.xxxxx.mongodb.net/erp?retryWrites=true&w=majority
   ```

## Producción

### Render (backend)

El repositorio incluye `render.yaml` y un Dockerfile reproducible. Al crear un
Blueprint en Render, selecciona este repositorio. Si el servicio ya existe,
configura manualmente los mismos valores:

Para corregir un servicio existente y comprobar que Render realmente desplegó
el commit nuevo, sigue primero la guía detallada
[`RENDER_DEPLOYMENT_GUIDE.md`](RENDER_DEPLOYMENT_GUIDE.md).

- **Runtime:** Docker
- **Dockerfile:** `backend/Dockerfile`
- **Docker build context:** `.` (raíz del repositorio)
- **Health check:** `/health`

Configura en Render las variables secretas `MONGODB_URI`, `JWT_SECRET` y
`JWT_REFRESH_SECRET`. Configura también:

```env
NODE_ENV=production
FRONTEND_URL=https://tu-proyecto.pages.dev
CORS_ORIGINS=https://tu-proyecto.pages.dev,https://erp.tudominio.com
```

`CORS_ORIGINS` acepta una lista separada por comas y debe contener cada origen
web que consumirá la API (protocolo + host, sin rutas). No uses `*` en
producción. La URL pública del backend responde en `/`, `/health` y `/docs`;
un `404` en `/` ya no debe aparecer después de desplegar esta revisión.

### Cloudflare Pages (frontend web)

La configuración completa, las comprobaciones de CORS y el diagnóstico del
bundle están en [`CLOUDFLARE_PAGES_GUIDE.md`](CLOUDFLARE_PAGES_GUIDE.md).

Si Cloudflare muestra una pantalla de **Workers Builds** con un campo adicional
**Deploy command**, usa `npm run deploy:cloudflare`; el archivo
`frontend/wrangler.jsonc` publica el directorio `dist` como sitio estático.

Crea un proyecto de Pages conectado al repositorio y utiliza:

- **Root directory:** `frontend`
- **Build command:** `npm run export:web`
- **Build output directory:** `dist`
- **Node.js:** 20

Agrega esta variable en **Production** y **Preview**, ajustándola si usas un
dominio propio para la API:

```env
EXPO_PUBLIC_API_URL=https://proyectoerp-api.onrender.com/api/v1
```

Esta variable se incorpora al bundle durante el build: cambiarla requiere un
nuevo despliegue de Pages. Los archivos `public/_redirects` y
`public/_headers` agregan fallback para navegación web y cabeceras básicas de
seguridad. Finalmente, copia la URL definitiva de Pages a `FRONTEND_URL` y
`CORS_ORIGINS` en Render y vuelve a desplegar el backend.

> Las URLs `*.pages.dev` de previews cambian por commit. Por seguridad no se
> habilita un comodín; agrega explícitamente los orígenes de preview que vayas
> a probar o utiliza el dominio estable de producción.

### Checklist

- [ ] MongoDB Atlas configurado con replica set
- [ ] Variables de entorno seguras (no en código)
- [ ] JWT_SECRET y JWT_REFRESH_SECRET seguros (32+ chars)
- [ ] CORS configurado para dominio de producción
- [ ] Rate limiting habilitado
- [ ] HTTPS habilitado (via reverse proxy)
- [ ] Logging configurado
- [ ] Monitoreo configurado

### Reverse Proxy (Nginx)

```nginx
server {
    listen 443 ssl;
    server_name api.yourdomain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### PM2 (Process Manager)

```bash
npm install -g pm2
pm2 start src/server.js --name erp-backend
pm2 save
pm2 startup
```

## CI/CD

### GitHub Actions

Pipeline automático en push/PR a main/develop:

1. **Install**: `npm ci`
2. **Lint**: `npm run lint`
3. **Test**: `npm test`
4. **Build check**: Verificar que la app carga correctamente

Ver `.github/workflows/ci.yml`.

## Health Check

```
GET /health
```

Respuesta:
```json
{
  "success": true,
  "service": "erp-backend",
  "version": "1.0.0"
}
```

## Swagger

```
GET /docs
```

Documentación interactiva de la API.

## Troubleshooting

### Problema: `npm` no funciona
```powershell
$env:Path = "C:\Program Files\nodejs;" + $env:Path
```

### Problema: MongoDB no conecta
Verificar que MONGODB_URI esté configurado correctamente en `.env`.

### Problema: Puerto en uso
Cambiar PORT en `.env` o detener el proceso que usa el puerto.
