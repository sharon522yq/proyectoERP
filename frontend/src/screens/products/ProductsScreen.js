import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Button, Modal } from 'react-native';
import { productsApi } from '../../services/api';
import { tokens } from '../../theme/tokens';
import PageHeader from '../../components/layout/PageHeader';
import LoadingSkeleton from '../../components/data-display/LoadingSkeleton';
import ErrorState from '../../components/data-display/ErrorState';
import EmptyState from '../../components/data-display/EmptyState';
import StatusBadge from '../../components/data-display/StatusBadge';

export default function ProductsScreen({ onBack }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [modalVisible, setModalVisible] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [price, setPrice] = useState('');
  const [cost, setCost] = useState('');
  const [formError, setFormError] = useState('');

  useEffect(() => {
    loadProducts();
  }, [search]);

  const loadProducts = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await productsApi.getProducts({ search: search.trim() });
      setProducts(data.items || data || []);
    } catch (err) {
      setError(err.message || 'Error al cargar productos');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!name || !sku || !price) {
      setFormError('Nombre, SKU y Precio son obligatorios');
      return;
    }
    try {
      setFormError('');
      await productsApi.createProduct({
        name: name.trim(),
        sku: sku.trim(),
        price: Number(price),
        cost: Number(cost || 0)
      });
      setModalVisible(false);
      setName('');
      setSku('');
      setPrice('');
      setCost('');
      loadProducts();
    } catch (err) {
      setFormError((err.response && err.response.data && err.response.data.message) || 'Error al crear producto');
    }
  };

  return (
    <View style={styles.container}>
      <PageHeader
        title="Catálogo de Productos"
        subtitle="Gestión de inventario y artículos de venta"
        actionTitle="Nuevo Producto"
        onAction={() => setModalVisible(true)}
      />

      <View style={styles.toolbar}>
        <TextInput
          style={styles.search}
          placeholder="Buscar por nombre o SKU..."
          value={search}
          onChangeText={setSearch}
        />
        {onBack ? <Button title="Volver" onPress={onBack} /> : null}
      </View>

      {loading ? (
        <LoadingSkeleton />
      ) : error ? (
        <ErrorState message={error} onRetry={loadProducts} />
      ) : products.length === 0 ? (
        <EmptyState title="No hay productos" description="Crea tu primer producto para comenzar." actionTitle="Crear Producto" onAction={() => setModalVisible(true)} />
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {products.map((p) => (
            <View key={p._id || p.sku} style={[styles.itemCard, tokens.shadows.sm]}>
              <View>
                <Text style={styles.itemName}>{p.name}</Text>
                <Text style={styles.itemSku}>SKU: {p.sku}</Text>
              </View>
              <View style={styles.itemRight}>
                <Text style={styles.itemPrice}>${p.price}</Text>
                <StatusBadge status={p.status || 'ACTIVE'} />
              </View>
            </View>
          ))}
        </ScrollView>
      )}

      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, tokens.shadows.lg]}>
            <Text style={styles.modalTitle}>Crear Nuevo Producto</Text>
            <TextInput style={styles.input} placeholder="Nombre del producto" value={name} onChangeText={setName} />
            <TextInput style={styles.input} placeholder="SKU (ej. PROD-001)" value={sku} onChangeText={setSku} />
            <TextInput style={styles.input} placeholder="Precio de venta ($)" value={price} onChangeText={setPrice} keyboardType="numeric" />
            <TextInput style={styles.input} placeholder="Costo ($)" value={cost} onChangeText={setCost} keyboardType="numeric" />
            {!!formError && <Text style={styles.error}>{formError}</Text>}
            <View style={styles.modalActions}>
              <Button title="Cancelar" color="#64748b" onPress={() => setModalVisible(false)} />
              <Button title="Guardar Producto" onPress={handleCreate} />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: tokens.spacing.md },
  toolbar: { flexDirection: 'row', gap: tokens.spacing.md, marginBottom: tokens.spacing.md, alignItems: 'center' },
  search: { flex: 1, borderWidth: 1, borderColor: tokens.colors.border, borderRadius: tokens.borderRadius.md, padding: tokens.spacing.sm, backgroundColor: tokens.colors.surface },
  list: { gap: tokens.spacing.sm, paddingBottom: tokens.spacing.xl },
  itemCard: { backgroundColor: tokens.colors.surface, borderRadius: tokens.borderRadius.md, padding: tokens.spacing.md, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: tokens.colors.border },
  itemName: { fontSize: tokens.typography.sizes.md, fontWeight: '600', color: tokens.colors.text },
  itemSku: { fontSize: tokens.typography.sizes.xs, color: tokens.colors.textSecondary, marginTop: 2 },
  itemRight: { alignItems: 'flex-end', gap: 4 },
  itemPrice: { fontSize: tokens.typography.sizes.md, fontWeight: '700', color: tokens.colors.primary },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: tokens.spacing.md },
  modalContent: { backgroundColor: tokens.colors.surface, borderRadius: tokens.borderRadius.lg, padding: tokens.spacing.xl, width: '100%', maxWidth: 440, gap: tokens.spacing.md },
  modalTitle: { fontSize: tokens.typography.sizes.lg, fontWeight: '700', color: tokens.colors.text },
  input: { borderWidth: 1, borderColor: tokens.colors.border, borderRadius: tokens.borderRadius.md, padding: tokens.spacing.sm, backgroundColor: tokens.colors.surfaceVariant },
  error: { color: tokens.colors.error, fontSize: tokens.typography.sizes.sm },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: tokens.spacing.md, marginTop: tokens.spacing.sm }
});
