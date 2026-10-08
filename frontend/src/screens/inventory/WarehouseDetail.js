import { tokens } from '../../theme/tokens';
import React, { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { Text, TextInput, Button, ScrollView } from '../../design/ui';
import { inventoryApi } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import CatalogActions from '../../components/CatalogActions';
import InventoryExportButton from '../../components/InventoryExportButton';
export default function WarehouseDetail({ warehouse, products, onBack, onChanged, onAdjust }) {
  const { has } = useAuth();
  const [record, setRecord] = useState(warehouse);
  const [name, setName] = useState(warehouse.name);
  const [code, setCode] = useState(warehouse.code);
  const [address, setAddress] = useState(warehouse.address || '');
  const [stock, setStock] = useState({ items: [], total: 0 });
  const [movements, setMovements] = useState({ items: [], total: 0 });
  const [stockPage, setStockPage] = useState(1);
  const [movementPage, setMovementPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const running = useRef(false);
  const deleted = useRef(false);
  const load = async () => {
    setLoading(true); setError('');
    try {
      const [info, stocks, history] = await Promise.all([
        inventoryApi.getWarehouse(warehouse._id),
        inventoryApi.getStock({ warehouseId: warehouse._id, page: stockPage, limit: 20 }),
        has('inventory.movements') ? inventoryApi.getMovements({ warehouseId: warehouse._id, page: movementPage, limit: 20 }) : { items: [], total: 0 }
      ]);
      setRecord(info); setStock(stocks); setMovements(history);
    } catch(e) { setError(e.response?.data?.message || 'No se pudo cargar el almacén'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [stockPage, movementPage]);
  const save = async () => {
    if (running.current) return;
    if (!name.trim() || !code.trim()) { setError('Introduce nombre y código del almacén'); return; }
    running.current = true; setSaving(true); setError(''); setNotice('');
    try { const updated = await inventoryApi.updateWarehouse(warehouse._id, { name: name.trim(), code: code.trim(), address: address.trim() }); setRecord(updated); await onChanged(); setNotice('Almacén actualizado'); }
    catch(e) { setError(e.response?.data?.message || 'No se pudo guardar el almacén'); }
    finally { running.current = false; setSaving(false); }
  };
  const productName = id => products.find(p => p._id === id)?.name || id;
  const pager = (page, total, change) => <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}><Button title="Anterior" disabled={loading || page <= 1} onPress={() => change(page - 1)} /><Text>Página {page}</Text><Button title="Siguiente" disabled={loading || page * 20 >= total} onPress={() => change(page + 1)} /></View>;
  return <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
    <Text style={{ fontSize: 24, fontWeight: '700' }}>Almacén: {record.name}</Text>
    <Text>Estado: {record.active ? 'Activo' : 'Desactivado'}</Text>
    <InventoryExportButton warehouseId={record._id} />
    <Button title="Volver a inventario" disabled={saving} onPress={onBack} />
    {!!error && <View><Text accessibilityRole="alert" style={{ color: tokens.colors.error }}>{error}</Text><Button title="Reintentar consulta" onPress={load} /></View>}
    {!!notice && <Text>{notice}</Text>}
    {has('branches.update') ? <View style={{ gap: 8 }}>
      <Text>Nombre</Text><TextInput accessibilityLabel="Nombre del almacén" value={name} onChangeText={setName} maxLength={150} editable={!saving} style={{ borderWidth: 1, padding: 10 }} />
      <Text>Código</Text><TextInput accessibilityLabel="Código del almacén" value={code} onChangeText={setCode} maxLength={20} editable={!saving} style={{ borderWidth: 1, padding: 10 }} />
      <Text>Dirección</Text><TextInput accessibilityLabel="Dirección del almacén" value={address} onChangeText={setAddress} maxLength={300} editable={!saving} style={{ borderWidth: 1, padding: 10 }} />
      <Button title="Guardar cambios del almacén" disabled={saving || loading} onPress={save} />
      {!saving && <CatalogActions name={record.name} active={record.active} onDelete={async () => { await inventoryApi.deleteWarehouse(record._id); deleted.current = true; }} onToggle={() => inventoryApi.updateWarehouse(record._id, { active: !record.active })} onChanged={async () => { await onChanged(); if (deleted.current) onBack(); else await load(); }} explanation="Solo se puede retirar un almacén sin existencias, movimientos ni documentos relacionados." />}
    </View> : <Text>Código: {record.code}. Dirección: {record.address || 'Sin dirección'}</Text>}
    {has('inventory.adjust') && record.active && <Button title="Ajustar existencias de este almacén" disabled={loading || saving} onPress={() => onAdjust(record._id)} />}
    <Text style={{ fontWeight: '700' }}>Existencias ({stock.total})</Text>
    {loading ? <Text>Cargando...</Text> : stock.items.length ? stock.items.map(s => <Text key={s._id}>{productName(s.productId)}: {s.quantity} u.</Text>) : <Text>Sin existencias en este almacén</Text>}
    {pager(stockPage, stock.total, setStockPage)}
    {has('inventory.movements') && <View style={{ gap: 8 }}><Text style={{ fontWeight: '700' }}>Historial de movimientos ({movements.total})</Text>
      {movements.items.length ? movements.items.map(m => <View key={m._id}><Text>{productName(m.productId)} · {m.type} · {m.quantity} u.</Text><Text>{m.previousStock} → {m.newStock} · {m.reason || 'Sin motivo'} · {new Date(m.createdAt).toLocaleString()}</Text></View>) : <Text>Sin movimientos en este almacén</Text>}
      {pager(movementPage, movements.total, setMovementPage)}
    </View>}
  </ScrollView>;
}
