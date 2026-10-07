import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Button, Modal } from 'react-native';
import { inventoryApi, productsApi } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { tokens } from '../../theme/tokens';
import PageHeader from '../../components/layout/PageHeader';
import LoadingSkeleton from '../../components/data-display/LoadingSkeleton';
import ErrorState from '../../components/data-display/ErrorState';
import EmptyState from '../../components/data-display/EmptyState';

export default function InventoryScreen({ onBack }) {
  const { has } = useAuth();
  const [warehouses, setWarehouses] = useState([]);
  const [products, setProducts] = useState([]);
  const [warehouseForm, setWarehouseForm] = useState(false);
  const [warehouseName, setWarehouseName] = useState('');
  const [warehouseCode, setWarehouseCode] = useState('');
  const [saving, setSaving] = useState(false);
  const [stockList, setStockList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);

  // Adjustment form
  const [productId, setProductId] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('');
  const [formError, setFormError] = useState('');

  useEffect(() => {
    loadStock();
  }, []);

  const loadStock = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await inventoryApi.getStock();
      const [wh, catalog] = await Promise.all([inventoryApi.getWarehouses(), has('products.read') ? productsApi.getProducts({ limit: 100 }) : []]);
      setWarehouses(wh);
      setProducts(catalog.items || catalog || []);
      setStockList(data.items || data || []);
    } catch (err) {
      setError(err.message || 'Error al cargar stock');
    } finally {
      setLoading(false);
    }
  };

  const handleAdjust = async () => {
    if (saving) return;
    if (!productId || !warehouseId || !Number.isInteger(Number(quantity)) || Number(quantity) === 0 || !reason.trim()) {
      setFormError('Todos los campos incluyendo el motivo son obligatorios');
      return;
    }
    try {
      setFormError('');
      await inventoryApi.adjustStock({
        productId: productId.trim(),
        warehouseId: warehouseId.trim(),
        quantity: Math.abs(Number(quantity)),
        type: Number(quantity) < 0 ? 'SALE_EXIT' : 'ADJUSTMENT',
        reason: reason.trim()
      });
      setModalVisible(false);
      setProductId('');
      setWarehouseId('');
      setQuantity('');
      setReason('');
      loadStock();
    } catch (err) {
      setFormError((err.response && err.response.data && err.response.data.message) || 'Error al ajustar stock');
    }
  };

  return (
    <View style={styles.container}>
      <PageHeader
        title="Gestión de Inventario y Stock"
        subtitle="Control de existencias por almacén y movimientos"
        actionTitle="Ajuste de Stock"
        onAction={has('inventory.adjust') ? () => setModalVisible(true) : undefined}
      />

      {has('branches.create') && <Button title={warehouseForm ? 'Cerrar almacén' : 'Nuevo almacén'} onPress={() => { setWarehouseForm(!warehouseForm); setFormError(''); }} />}
      {warehouseForm && <View style={{ gap: 8 }}>
        <TextInput accessibilityLabel="Nombre del almacén" style={styles.input} placeholder="Nombre del almacén" maxLength={150} value={warehouseName} onChangeText={setWarehouseName} editable={!saving} />
        <TextInput accessibilityLabel="Código del almacén" style={styles.input} placeholder="Código del almacén" maxLength={20} value={warehouseCode} onChangeText={setWarehouseCode} editable={!saving} />
        {!!formError && <Text style={styles.error}>{formError}</Text>}
        <Button title="Guardar almacén" disabled={saving} onPress={async () => {
          if (saving) return;
          if (!warehouseName.trim() || !warehouseCode.trim()) { setFormError('Introduce nombre y código del almacén'); return; }
          try {
            setSaving(true); setFormError('');
            await inventoryApi.createWarehouse({ name: warehouseName.trim(), code: warehouseCode.trim() });
            setWarehouseForm(false); setWarehouseName(''); setWarehouseCode(''); await loadStock();
          } catch (err) { setFormError(err.response?.data?.message || 'No se pudo crear el almacén'); }
          finally { setSaving(false); }
        }} />
      </View>}
      <Text>Almacenes: {warehouses.map(w => w.name + ' (' + w.code + ')').join(', ') || 'Sin almacenes; crea uno antes de registrar existencias.'}</Text>
      <View style={styles.toolbar}>
        {onBack ? <Button title="Volver" onPress={onBack} /> : null}
      </View>

      {loading ? (
        <LoadingSkeleton />
      ) : error ? (
        <ErrorState message={error} onRetry={loadStock} />
      ) : stockList.length === 0 ? (
        <EmptyState title="Sin stock registrado" description="No hay existencias registradas en los almacenes." actionTitle="Realizar Ajuste" onAction={() => setModalVisible(true)} />
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {stockList.map((s, idx) => (
            <View key={s._id || idx} style={[styles.card, tokens.shadows.sm]}>
              <View>
                <Text style={styles.productText}>Producto ID: {s.productId}</Text>
                <Text style={styles.warehouseText}>Almacén ID: {s.warehouseId}</Text>
              </View>
              <View style={styles.stockBadge}>
                <Text style={styles.stockValue}>{s.quantity} u.</Text>
              </View>
            </View>
          ))}
        </ScrollView>
      )}

      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, tokens.shadows.lg]}>
            <Text style={styles.modalTitle}>Ajuste Autorizado de Stock</Text>
            <Text>Selecciona producto</Text>
            <ScrollView style={{ maxHeight: 120 }}>{products.map(p => <Button key={p._id} title={p.name} color={productId === p._id ? tokens.colors.primary : '#64748b'} disabled={saving} onPress={() => setProductId(p._id)} />)}</ScrollView>
            <TextInput accessibilityLabel="ID de Producto" style={styles.input} placeholder="ID de Producto" value={productId} onChangeText={setProductId} />
            <Text>Selecciona almacén</Text>
            <ScrollView style={{ maxHeight: 120 }}>{warehouses.map(w => <Button key={w._id} title={w.name} color={warehouseId === w._id ? tokens.colors.primary : '#64748b'} disabled={saving} onPress={() => setWarehouseId(w._id)} />)}</ScrollView>
            <TextInput accessibilityLabel="ID de Almacén" style={styles.input} placeholder="ID de Almacén" value={warehouseId} onChangeText={setWarehouseId} />
            <TextInput style={styles.input} placeholder="Cantidad (+/-)" value={quantity} onChangeText={setQuantity} keyboardType="numeric" />
            <TextInput style={styles.input} placeholder="Motivo obligatorio del ajuste" value={reason} onChangeText={setReason} />
            {!!formError && <Text style={styles.error}>{formError}</Text>}
            <View style={styles.modalActions}>
              <Button title="Cancelar" color="#64748b" onPress={() => setModalVisible(false)} />
              <Button title="Confirmar Ajuste" disabled={saving} onPress={handleAdjust} />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: tokens.spacing.md },
  toolbar: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: tokens.spacing.md },
  list: { gap: tokens.spacing.sm, paddingBottom: tokens.spacing.xl },
  card: { backgroundColor: tokens.colors.surface, borderRadius: tokens.borderRadius.md, padding: tokens.spacing.md, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: tokens.colors.border },
  productText: { fontSize: tokens.typography.sizes.md, fontWeight: '600', color: tokens.colors.text },
  warehouseText: { fontSize: tokens.typography.sizes.xs, color: tokens.colors.textSecondary, marginTop: 2 },
  stockBadge: { backgroundColor: tokens.colors.primaryLight, paddingHorizontal: 12, paddingVertical: 6, borderRadius: tokens.borderRadius.full },
  stockValue: { fontSize: tokens.typography.sizes.md, fontWeight: '700', color: tokens.colors.primary },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: tokens.spacing.md },
  modalContent: { backgroundColor: tokens.colors.surface, borderRadius: tokens.borderRadius.lg, padding: tokens.spacing.xl, width: '100%', maxWidth: 440, gap: tokens.spacing.md },
  modalTitle: { fontSize: tokens.typography.sizes.lg, fontWeight: '700', color: tokens.colors.text },
  input: { borderWidth: 1, borderColor: tokens.colors.border, borderRadius: tokens.borderRadius.md, padding: tokens.spacing.sm, backgroundColor: tokens.colors.surfaceVariant },
  error: { color: tokens.colors.error, fontSize: tokens.typography.sizes.sm },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: tokens.spacing.md, marginTop: tokens.spacing.sm }
});
