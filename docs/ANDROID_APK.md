# Android APK — corrección del primer build

El primer build EAS falló porque el proyecto Android versionado usaba Expo anterior y autolinking.gradle eliminado. El lockfile también incluía React 18 y React Native 0.74 junto a las versiones del frontend Expo 57.

Se actualizó Expo a ~57.0.27 y se regeneró/deduplicó el lockfile raíz: React 19.2.3, React DOM 19.2.3 y React Native 0.86.3. Mantener npm ci desde la raíz del monorepo.

La .easignore raíz excluye frontend/android y frontend/ios para generar el proyecto nativo compatible mediante Prebuild en EAS. Los archivos originales siguen versionados y en disco. No modificar esos archivos para este flujo; mantener configuración nativa en app.json/plugins. También se excluyen node_modules, .env y archivos de firma. No subir MongoDB, JWT ni Resend al build móvil.

El perfil preview en frontend/eas.json produce APK interno y apunta exclusivamente a la API HTTPS de Render. Se conserva el projectId creado por el propietario y la firma remota de EAS.

Validaciones ejecutadas: npm ci correcto, Expo Doctor 21/21, expo install --check correcto e inspección del archivo EAS sin directorio Android ni backend/.env. No constituye compilación Gradle ni prueba en Android físico.

Para compilar desde frontend:

```powershell
npx eas-cli@latest build --platform android --profile preview --clear-cache
```

No generar otra keystore: reutilizar la guardada por Expo. Una vez disponible el APK, probar login, dashboard Nexus, módulos, persistencia al cerrar/reabrir, recuperación vía web y logout. Las pruebas reales deben usar la cuenta del propietario y no bases sintéticas publicadas.
