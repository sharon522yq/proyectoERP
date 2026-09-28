# Guía de Despliegue: Render (Backend) + Cloudflare Pages (Frontend)

Este documento detalla la auditoría de preparación y los pasos exactos para desplegar el sistema ERP en producción utilizando **Render** para el backend Node.js / MongoDB y **Cloudflare Pages** para el frontend React Native Web.

---

## 1. Auditoría de Preparación

| Componente | Estado | Notas técnicas |
|---|---|---|
| **Backend (Node.js/Express)** | ✅ Listo | Conecta a MongoDB Atlas, semilla inicial automática (roles y unidades), maneja CORS para `FRONTEND_URL`, rate limiting, helmet, logs y arquitectura modular. |
| **Base de Datos (MongoDB Atlas)** | ✅ Requerido | Render requiere una URI externa de MongoDB Atlas (las bases de datos efímeras de Render no soportan MongoDB nativo). |
| **Frontend (React Native Web)** | ✅ Listo | Exportación estática lista (`expo export --platform web`) generando salida limpia en `frontend/dist`. |
| **Variables de Entorno** | ✅ Configurables | Soportadas vía `.env` en desarrollo y variables de entorno en paneles cloud. |

---

## 2. Despliegue del Backend en Render

1. **Crear Web Service en Render**:
   - Conectar el repositorio GitHub (`https://github.com/sharon522yq/proyectoERP.git`).
   - Root Directory: Dejar vacío o raíz (`.`).
   - Runtime: `Node`.
   - **Build Command**: `npm install && npm install --prefix backend`
   - **Start Command**: `node backend/src/server.js`

2. **Variables de Entorno en Render**:
   Configura las siguientes variables en el dashboard de Render:
   - `NODE_ENV`: `production`
   - `MONGODB_URI`: `mongodb+srv://<user>:<password>@cluster.mongodb.net/proyectoERP?retryWrites=true&w=majority`
   - `JWT_SECRET`: `<genera-un-secreto-seguro-largo>`
   - `JWT_REFRESH_SECRET`: `<genera-otro-secreto-seguro-largo>`
   - `FRONTEND_URL`: `https://<tu-proyecto>.pages.dev` (URL de Cloudflare Pages)

---

## 3. Despliegue del Frontend en Cloudflare Pages

1. **Crear Pages Project en Cloudflare**:
   - Conectar el mismo repositorio GitHub (`https://github.com/sharon522yq/proyectoERP.git`).
   - Framework preset: `None` (o Expo web).
   - **Build Command**: `cd frontend && npm install && npx expo export --platform web`
   - **Build Output Directory**: `frontend/dist`

2. **Variables de Entorno en Cloudflare Pages**:
   - `EXPO_PUBLIC_API_URL`: `https://<tu-servicio-backend>.onrender.com/api/v1`

---
## 4. Verificación Post-Despliegue
- **Health Check Backend**: `GET https://<tu-servicio-backend>.onrender.com/health` → `{success: true, service: "erp-backend", version: "1.0.0"}`
- **Frontend Web**: Visitar `https://<tu-proyecto>.pages.dev`, iniciar sesión con credenciales de administrador y verificar el funcionamiento de los módulos y asistente IA.
