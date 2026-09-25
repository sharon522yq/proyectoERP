import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Button, Modal } from 'react-native';
import { inventoryApi } from '../../services/api';
import { tokens } from '../../theme/tokens';
import PageHeader from '../../components/layout/PageHeader';
import LoadingSkeleton from '../../components/data-display/LoadingSkeleton';
import ErrorState from '../../components/data-display/ErrorState';
import EmptyState from '../../components/data-display/EmptyState';

export default function InventoryScreen({ onBack }) {
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
      setStockList(data.items || data || []);
    } catch (err) {
      setError(err.message || 'Error al cargar stock');
    } finally {
      setLoading(false);
    }
  };

  const handleAdjust = async () => {
    if (!productId || !warehouseId || !quantity || !reason) {
      setFormError('Todos los campos incluyendo el motivo son obligatorios');
      return;
    }
    try {
      setFormError('');
      await inventoryApi.adjustStock({
        productId: productId.trim(),
        warehouseId: warehouseId.trim(),
        quantity: Number(quantity),
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
        onAction={() => setModalVisible(true)}
      />

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
            <TextInput style={styles.input} placeholder="ID de Producto" value={productId} onChangeText={setProductId} />
            <TextInput style={styles.input} placeholder="ID de Almacén" value={warehouseId} onChangeText={setWarehouseId} />
            <TextInput style={styles.input} placeholder="Cantidad (+/-)" value={quantity} onChangeText={setQuantity} keyboardType="numeric" />
            <TextInput style={styles.input} placeholder="Motivo obligatorio del ajuste" value={reason} onChangeText={setReason} />
            {!!formError && <Text style={styles.error}>{formError}</Text>}
            <View style={styles.modalActions}>
              <Button title="Cancelar" color="#64748b" onPress={() => setModalVisible(false)} />
              <Button title="Confirmar Ajuste" onPress={handleAdjust} />
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
