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
