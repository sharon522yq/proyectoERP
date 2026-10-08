import React, { useRef, useState } from 'react';
import { View, Text, TouchableOpacity, Platform } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { inventoryApi } from '../services/api';
import { saveInventoryExcel } from '../services/saveInventoryExcel';

export default function InventoryExportButton({ warehouseId }) {
  const { has } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const running = useRef(false);
  if (!has('inventory.read') || !has('products.read')) return null;
  const label = warehouseId ? 'Exportar este almacén a Excel' : 'Exportar inventario a Excel';
  const download = async () => {
    if (running.current) return;
    running.current = true; setBusy(true); setError(''); setNotice('');
    try {
      const data = await inventoryApi.exportExcel(warehouseId);
      setNotice(await saveInventoryExcel(data, Platform.OS));
    } catch (e) { setError(e.response?.data?.message || e.message || 'No se pudo exportar. Intenta nuevamente.'); }
    finally { running.current = false; setBusy(false); }
  };
  return <View style={{ gap: 8, marginVertical: 12, alignSelf: 'stretch' }}>
    <TouchableOpacity accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: busy, busy }} disabled={busy} onPress={download} style={{ backgroundColor: busy ? '#64748b' : '#4338ca', borderRadius: 10, padding: 14, minHeight: 48, alignItems: 'center' }}>
      <Text style={{ color: '#ffffff', fontWeight: '700', fontSize: 16 }}>{busy ? 'Preparando Excel…' : label}</Text>
    </TouchableOpacity>
    <Text style={{ color: '#475569', fontSize: 13 }}>Incluye existencias, reservas, disponibles y costos al momento de exportar. Cada descarga genera un archivo actualizado.</Text>
    {!!error && <Text accessibilityRole="alert" style={{ color: '#b91c1c' }}>{error}</Text>}
    {!!notice && <Text accessibilityLiveRegion="polite" style={{ color: '#166534' }}>{notice}</Text>}
  </View>;
}
