# Exportar el inventario desde el ERP

En Inventario, pulsa **Exportar inventario a Excel**. En Gestionar almacén, pulsa **Exportar este almacén a Excel** para limitar la consulta a ese almacén. El botón aparece a usuarios con inventory.read y products.read; el servidor exige ambos permisos y una empresa asignada.

La web descarga un archivo .xlsx. Android abre el menú del sistema para guardarlo o compartirlo con una aplicación compatible. La función Android requiere instalar una nueva compilación con expo-file-system y expo-sharing. Una APK anterior no recibe estos módulos nativos automáticamente.

El archivo contiene Inventario (existencias por almacén), Productos (totales por producto, incluidos productos sin existencias en la exportación general) y Resumen (valoración separada por moneda). SKU conserva ceros iniciales; el texto del catálogo se guarda como texto, nunca como fórmulas. Incluye productos inactivos y referencias eliminadas todavía presentes en existencias, identificadas con su estado. Una referencia faltante impide exportar, evitando un informe incompleto.

Cada exportación realiza una lectura consistente mediante snapshot MongoDB: no modifica existencias ni reservas. Es una fotografía del momento indicado, no un archivo vinculado que se actualice automáticamente. La valoración usa el costo actual del catálogo, sin impuestos, y no representa una valoración histórica contable. Sin existencias registradas significa ausencia de registros en el ERP, no un conteo físico.

GET /api/v1/inventory/export.xlsx devuelve JSON autenticado con filename, mimeType y base64; el cliente lo guarda como binario XLSX. Esta respuesta no debe almacenarse en caché ni exponerse mediante enlaces públicos. La sesión y su renovación siguen el transporte autenticado existente.

Límites: 10,000 registros por catálogo/consulta, dos generadores simultáneos por proceso y tres exportaciones por usuario por minuto. Se devuelve un error explícito si se exceden; no se truncan filas. Las exportaciones exitosas registran usuario, empresa, almacén, fecha y número de filas en la auditoría, sin copiar el archivo.

Pruebas: backend/tests/inventory-export.test.js usa exclusivamente MongoDB temporal; frontend/scripts/inventory-export.test.js valida los bytes descargados y el contrato nativo de guardado/compartición. La prueba en teléfono físico queda pendiente hasta instalar la nueva APK.
