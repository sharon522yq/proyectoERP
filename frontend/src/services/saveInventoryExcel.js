// Shared contract: authenticated JSON transport, binary XLSX saved by each platform.
export async function saveInventoryExcel(data, platform, dependencies = {}) {
  if (!/^[A-Za-z0-9_-]+\.xlsx$/.test(data.filename) || !data.base64 || data.mimeType !== 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') throw new Error('El servidor no entregó un archivo Excel válido.');
  if (platform === 'web') {
    const doc = dependencies.document || document;
    const urls = dependencies.URL || URL;
    const decode = dependencies.atob || atob;
    const BlobType = dependencies.Blob || Blob;
    const binary = decode(data.base64);
    const bytes = Uint8Array.from(binary, ch => ch.charCodeAt(0));
    const blob = new BlobType([bytes], { type: data.mimeType });
    const url = urls.createObjectURL(blob);
    const link = doc.createElement('a');
    try { link.href = url; link.download = data.filename; doc.body.appendChild(link); link.click(); }
    finally { link.remove(); (dependencies.setTimeout || setTimeout)(() => urls.revokeObjectURL(url), 60000); }
    return 'Descarga iniciada. Revisa las descargas de tu navegador.';
  }
  const sharing = dependencies.sharing || await import('expo-sharing');
  if (!await sharing.isAvailableAsync()) throw new Error('Este dispositivo no permite compartir archivos. Abre el ERP en tu navegador para descargar el Excel.');
  const filesystem = dependencies.filesystem || await import('expo-file-system');
  const file = new filesystem.File(filesystem.Paths.cache, data.filename);
  file.create({ overwrite: true });
  file.write(data.base64, { encoding: 'base64' });
  // The OS share menu lets the user save to a compatible application or storage provider.
  // Cache files remain available to receiving apps after the menu closes; the OS may clear them.
  await sharing.shareAsync(file.uri, { mimeType: data.mimeType, UTI: 'org.openxmlformats.spreadsheetml.sheet', dialogTitle: 'Guardar o compartir inventario' });
  return 'Archivo generado. Puedes guardarlo o compartirlo desde el menú de Android.';
}
