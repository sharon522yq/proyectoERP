import { operationError } from '../../services/operationError';
import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, TextInput, TouchableOpacity, ScrollView, Button, Modal } from '../../design/ui';
import CatalogActions from '../../components/CatalogActions';
import { useAuth } from '../../context/AuthContext';
import { productsApi } from '../../services/api';
import { tokens } from '../../theme/tokens';
import PageHeader from '../../components/layout/PageHeader';
import LoadingSkeleton from '../../components/data-display/LoadingSkeleton';
import ErrorState from '../../components/data-display/ErrorState';
import EmptyState from '../../components/data-display/EmptyState';
import DataTable from '../../components/data-display/DataTable';
import StatusBadge from '../../components/data-display/StatusBadge';

export default function ProductsScreen({ onBack }) {
  const { has } = useAuth();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState(null), [saving, setSaving] = useState(false), [page, setPage] = useState(1), [total, setTotal] = useState(0);
  const pending = useRef(false), requestVersion = useRef(0);
  function openForm(product = null) {
    setEditing(product); setName(product?.name || ''); setSku(product?.sku || ''); setPrice(product ? String(product.price) : ''); setCost(product ? String(product.cost || 0) : ''); setFormError(''); setModalVisible(true);
  }

  // Form state
  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [price, setPrice] = useState('');
  const [cost, setCost] = useState('');
  const [formError, setFormError] = useState('');

  useEffect(() => {
    loadProducts();
  }, [search, page]);

  const loadProducts = async () => {
    const version = ++requestVersion.current;
    try {
      setLoading(true);
      setError(null);
      const data = await productsApi.getProducts({ search: search.trim(), page, limit: 20 });
      if (version !== requestVersion.current) return;
      setProducts(data.items || data || []); setTotal(data.total || 0);
    } catch (err) {
      if (version !== requestVersion.current) return;
      setError(err.response?.data?.message || 'Error al cargar productos');
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!name.trim() || !sku.trim() || !price.trim() || !Number.isFinite(Number(price)) || Number(price) < 0 || !Number.isFinite(Number(cost || 0)) || Number(cost || 0) < 0) {
      setFormError('Escribe nombre y SKU, y precios y costos válidos mayores o iguales a cero.');
      return;
    }
    if (pending.current) return;
    pending.current = true; setSaving(true);
    try {
      setFormError('');
      const data = {
        name: name.trim(),
        sku: sku.trim(),
        price: Number(price),
        cost: Number(cost || 0)
      };
      if (editing) await productsApi.updateProduct(editing._id, data);
      else await productsApi.createProduct(data);
      setModalVisible(false);
      setName('');
      setSku('');
      setPrice('');
      setCost('');
      await loadProducts();
    } catch (err) {
      setFormError(operationError(err));
    } finally { pending.current = false; setSaving(false); }
  };

  return (
    <View style={styles.container}>
      <PageHeader
        title="Catálogo de Productos"
        subtitle="Gestión de inventario y artículos de venta"
        actionTitle={has('products.create') ? 'Nuevo Producto' : undefined}
        onAction={() => openForm()}
      />

      <View style={styles.toolbar}>
        <TextInput
          style={styles.search}
          placeholder="Buscar por nombre o SKU..."
          value={search}
          onChangeText={value => { setSearch(value); setPage(1); }}
        />
        {onBack ? <Button title="Volver" onPress={onBack} /> : null}
      </View>

      {loading ? (
        <LoadingSkeleton />
      ) : error ? (
        <ErrorState message={error} onRetry={loadProducts} />
      ) : products.length === 0 ? (
        <EmptyState title="No hay productos" description="Crea tu primer producto para comenzar." actionTitle={has('products.create') ? 'Crear Producto' : undefined} onAction={() => setModalVisible(true)} />
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          <DataTable label="Catálogo de productos" rows={products} keyFor={p => p._id || p.sku} columns={[{ key: 'identity', label: 'Producto y SKU', flex: 2 }, { key: 'price', label: 'Precio de venta', numeric: true }, { key: 'status', label: 'Estado' }, { key: 'actions', label: 'Gestión', flex: 2 }]} renderCell={(p, column) => {
            if (column === 'identity') return <View><Text style={styles.itemName}>{p.name}</Text><Text style={styles.itemSku}>SKU: {p.sku}</Text></View>;
            if (column === 'price') return <Text style={{ fontWeight: '600', color: tokens.colors.blueAccent }}>{new Intl.NumberFormat('es-MX', { style: 'currency', currency: p.currency || 'MXN' }).format(p.price)} {p.currency || 'MXN'}</Text>;
            if (column === 'status') return <StatusBadge status={p.status || 'ACTIVE'} />;
            return <View style={{ gap: 8 }}>{has('products.update') && <Button title={'Editar ' + p.name} variant="secondary" onPress={() => openForm(p)} />}<CatalogActions name={p.name} active={p.status === 'ACTIVE'} onDelete={has('products.delete') ? () => productsApi.deleteProduct(p._id) : undefined} onToggle={has('products.update') ? () => productsApi.updateProduct(p._id, { status: p.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE' }) : undefined} onChanged={loadProducts} explanation="El producto se retirará del catálogo si no tiene dependencias. Si tiene existencias o documentos relacionados, podrás desactivarlo." /></View>;
          }} />
        </ScrollView>
      )}

      <View style={styles.toolbar}><Button title="Anterior" disabled={loading || page === 1} onPress={() => setPage(page - 1)} /><Text>Página {page}</Text><Button title="Siguiente" disabled={loading || page * 20 >= total} onPress={() => setPage(page + 1)} /></View>
      <Modal onRequestClose={() => { if (!saving) setModalVisible(false); }} visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, tokens.shadows.lg]}>
            <Text style={styles.modalTitle}>{editing ? 'Editar producto' : 'Crear Nuevo Producto'}</Text>
            <Text style={{ fontWeight: '600' }}>Nombre del producto (obligatorio)</Text>
            <TextInput editable={!saving} style={styles.input} accessibilityLabel="Nombre del producto" placeholder="Nombre del producto" value={name} onChangeText={setName} />
            <Text style={{ fontWeight: '600' }}>SKU del producto (obligatorio)</Text>
            <TextInput editable={!saving} style={styles.input} accessibilityLabel="SKU del producto" placeholder="SKU (ej. PROD-001)" value={sku} onChangeText={setSku} />
            <Text style={{ fontWeight: '600' }}>Precio de venta (obligatorio)</Text>
            <TextInput editable={!saving} style={styles.input} accessibilityLabel="Precio de venta" placeholder="Precio de venta ($)" value={price} onChangeText={setPrice} keyboardType="numeric" />
            <Text style={{ fontWeight: '600' }}>Costo del producto (opcional)</Text>
            <TextInput editable={!saving} style={styles.input} accessibilityLabel="Costo del producto" placeholder="Costo ($)" value={cost} onChangeText={setCost} keyboardType="numeric" />
            {!!formError && <Text style={styles.error}>{formError}</Text>}
            <View style={styles.modalActions}>
              <Button title="Cancelar" disabled={saving} color={tokens.colors.surfaceHover} onPress={() => setModalVisible(false)} />
              <Button title={saving ? 'Guardando…' : editing ? 'Guardar cambios' : 'Guardar Producto'} disabled={saving} onPress={handleCreate} />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: tokens.spacing.md },
  toolbar: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spacing.md, marginBottom: tokens.spacing.md, alignItems: 'center' },
  search: { flex: 1, borderWidth: 1, borderColor: tokens.colors.border, borderRadius: tokens.borderRadius.md, padding: tokens.spacing.sm, backgroundColor: tokens.colors.surface },
  list: { gap: tokens.spacing.sm, paddingBottom: tokens.spacing.xl },
  itemCard: { backgroundColor: tokens.colors.surface, borderRadius: tokens.borderRadius.md, padding: tokens.spacing.md, flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spacing.md, justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: tokens.colors.border },
  itemName: { fontSize: tokens.typography.sizes.md, fontWeight: '600', color: tokens.colors.text },
  itemSku: { fontSize: tokens.typography.sizes.xs, color: tokens.colors.textSecondary, marginTop: 2 },
  itemRight: { alignItems: 'flex-end', maxWidth: '100%', flexShrink: 1, gap: 4 },
  itemPrice: { fontSize: tokens.typography.sizes.md, fontWeight: '700', color: tokens.colors.primary },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: tokens.spacing.md },
  modalContent: { backgroundColor: tokens.colors.surface, borderRadius: tokens.borderRadius.lg, padding: tokens.spacing.xl, width: '100%', maxWidth: 440, gap: tokens.spacing.md },
  modalTitle: { fontSize: tokens.typography.sizes.lg, fontWeight: '700', color: tokens.colors.text },
  input: { borderWidth: 1, borderColor: tokens.colors.border, borderRadius: tokens.borderRadius.md, padding: tokens.spacing.sm, backgroundColor: tokens.colors.surfaceVariant },
  error: { color: tokens.colors.error, fontSize: tokens.typography.sizes.sm },
  modalActions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: tokens.spacing.md, marginTop: tokens.spacing.sm }
});
