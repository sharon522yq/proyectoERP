import { operationError } from '../../services/operationError';
import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, TextInput, ScrollView, Button } from '../../design/ui';
import { purchasesApi, crmApi, productsApi, inventoryApi } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { tokens } from '../../theme/tokens';
import SearchSelect from '../../components/SearchSelect';
import PageHeader from '../../components/layout/PageHeader';
import { money } from '../sales/invoiceDocument';
const rows = value => value?.items || (Array.isArray(value) ? value : []);
const labels = { DRAFT: 'Borrador', SENT: 'Enviada al proveedor', CONFIRMED: 'Confirmada', RECEIVED: 'Recibida', CANCELLED: 'Cancelada' };
const blank = () => ({ productId: '', quantity: '1', unitCost: '', taxRate: '0' });
async function catalog(get) {
  const items = [];
  for (let page = 1; ; page++) {
    const result = await get({ page, limit: 100 }); items.push(...rows(result));
    if (!result.total || items.length >= result.total || !rows(result).length) return items;
  }
}
export default function PurchasesScreen({ onBack }) {
  const { has } = useAuth();
  const [orders, setOrders] = useState([]), [suppliers, setSuppliers] = useState([]), [products, setProducts] = useState([]), [warehouses, setWarehouses] = useState([]);
  const [supplierId, setSupplierId] = useState(''), [warehouseId, setWarehouseId] = useState(''), [lines, setLines] = useState([blank()]);
  const [receiptWarehouseId, setReceiptWarehouseId] = useState('');
  const [creating, setCreating] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState(''), [confirmation, setConfirmation] = useState(null);
  const [page, setPage] = useState(1), [total, setTotal] = useState(0);
  const running = useRef(false), version = useRef(0);
  async function load(current = page) {
    const request = ++version.current;
    try { const result = await purchasesApi.getPurchases({ page: current, limit: 20 }); if (request === version.current) { setOrders(rows(result)); setTotal(result.total || 0); } }
    catch (err) { if (request === version.current) setError(err.response?.data?.message || 'No se pudieron cargar las compras. Pulsa Actualizar para reintentar.'); }
  }
  useEffect(() => { load(); return () => { version.current++; }; }, [page]);
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [s, p, w] = await Promise.all([has('crm.customers.read') ? catalog(crmApi.getCustomers) : [], has('products.read') ? catalog(params => productsApi.getProducts({ ...params, status: 'ACTIVE' })) : [], has('inventory.read') ? inventoryApi.getWarehouses() : []]);
        if (active) { setSuppliers(s); setProducts(p); setWarehouses(rows(w).filter(item => item.active)); }
      } catch { if (active) setError('No se pudieron cargar los catálogos. Revisa tus permisos y vuelve a abrir Compras.'); }
    })(); return () => { active = false; };
  }, []);
  async function action(work, text) {
    if (running.current) return;
    running.current = true; setBusy(true); setError(''); setMessage('');
    try { const result = await work(); setMessage(text); await load(); return result; }
    catch (err) { setError(operationError(err)); }
    finally { running.current = false; setBusy(false); }
  }
  const patch = (index, changes) => setLines(previous => previous.map((line, i) => i === index ? { ...line, ...changes } : line));
  async function create() {
    if (!supplierId) { setError('Selecciona el proveedor que recibirá esta orden.'); return; }
    if (!warehouseId) { setError('Selecciona el almacén donde recibirás los productos. Si no existe, créalo en Inventario.'); return; }
    const items = lines.map(line => ({ productId: line.productId, quantity: Number(line.quantity), unitCost: Number(line.unitCost), taxRate: Number(line.taxRate) }));
    const invalid = items.findIndex((item, i) => !item.productId || !Number.isInteger(item.quantity) || item.quantity <= 0 || !lines[i].unitCost.trim() || !Number.isFinite(item.unitCost) || item.unitCost < 0 || !Number.isFinite(item.taxRate) || item.taxRate < 0 || item.taxRate > 100);
    if (invalid >= 0) { setError('Revisa la partida ' + (invalid + 1) + ': selecciona producto, cantidad entera positiva, costo válido e impuesto de 0 a 100%.'); return; }
    const result = await action(() => purchasesApi.createPurchase({ supplierId, warehouseId, items }), 'Orden creada en borrador. Revísala antes de confirmarla.');
    if (result) { setCreating(false); setLines([blank()]); }
  }
  const name = (items, id) => items.find(item => item._id === String(id))?.name || 'Registro no disponible';
  return <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
    <PageHeader title="Compras" subtitle="Crea la orden, confirma con el proveedor y registra los productos recibidos." />
    <View style={styles.row}>{onBack && <Button title="Volver" onPress={onBack} />}<Button title="Actualizar" disabled={busy} onPress={() => load()} />{has('purchases.create') && <Button title={creating ? 'Cerrar formulario' : 'Nueva compra'} disabled={busy} onPress={() => setCreating(!creating)} />}</View>
    {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}{!!message && <Text accessibilityRole="alert">{message}</Text>}
    {creating && <View style={styles.card}>
      <Text style={styles.title}>Nueva orden de compra</Text>
      {!suppliers.length && <Text>Registra primero el tercero en CRM. Actualmente el catálogo de clientes y proveedores es compartido.</Text>}
      <SearchSelect label="Proveedor" placeholder="Seleccionar proveedor" items={suppliers} value={supplierId} disabled={busy} onChange={setSupplierId} />
      {!warehouses.length && <Text>Crea un almacén activo en Inventario antes de registrar la compra.</Text>}
      <SearchSelect label="Almacén de recepción" placeholder="Seleccionar almacén de recepción" items={warehouses} value={warehouseId} disabled={busy} onChange={setWarehouseId} />
      {lines.map((line, index) => <View key={index} style={styles.card}><Text style={styles.title}>Partida {index + 1}</Text>
        <SearchSelect label={'Producto de partida ' + (index + 1)} placeholder={'Seleccionar producto de partida ' + (index + 1)} items={products} value={line.productId} disabled={busy} onChange={id => patch(index, { productId: id, unitCost: String(products.find(item => item._id === id)?.cost || 0) })} />
        {[['quantity', 'Cantidad'], ['unitCost', 'Costo unitario'], ['taxRate', 'Impuesto (%)']].map(([key, label]) => <View key={key}><Text>{label}</Text><TextInput accessibilityLabel={label + ' partida ' + (index + 1)} value={line[key]} style={styles.input} keyboardType="decimal-pad" editable={!busy} onChangeText={value => patch(index, { [key]: value })} /></View>)}
        <Text>Importe: {money(Number(line.quantity) * Number(line.unitCost) * (1 + Number(line.taxRate) / 100))}</Text>
        {lines.length > 1 && <Button title="Quitar partida" disabled={busy} onPress={() => setLines(lines.filter((_, i) => i !== index))} />}
      </View>)}
      <Button title="Agregar producto" disabled={busy} onPress={() => setLines([...lines, blank()])} /><Button title="Guardar borrador" disabled={busy} onPress={create} />
    </View>}
    {!orders.length && <Text>No hay compras en esta página. Empieza con Nueva compra.</Text>}
    {orders.map(order => <View key={order._id} style={styles.card}>
      <Text style={styles.title}>{order.folio}</Text><Text>Proveedor: {name(suppliers, order.supplierId)}</Text><Text>Estado: {labels[order.status] || order.status}</Text><Text>Almacén: {order.warehouseId ? name(warehouses, order.warehouseId) : 'Pendiente de configurar'}</Text>
      {(order.items || []).map((item, i) => <Text key={i}>{name(products, item.productId)} · {item.quantity} × {money(item.unitCost)}</Text>)}<Text style={styles.title}>Total: {money(order.total)}</Text>
      {has('purchases.update') && <View style={styles.row}>
        {['DRAFT', 'SENT'].includes(order.status) && <Button title="Confirmar con proveedor" disabled={busy} onPress={() => setConfirmation({ order, status: 'CONFIRMED' })} />}
        {order.status === 'CONFIRMED' && <Button title="Registrar recepción completa" disabled={busy} onPress={() => { setReceiptWarehouseId(order.warehouseId || (warehouses.length === 1 ? warehouses[0]._id : '')); setConfirmation({ order, status: 'RECEIVED' }); }} />}
        {['DRAFT', 'SENT', 'CONFIRMED'].includes(order.status) && <Button title="Cancelar compra" disabled={busy} onPress={() => setConfirmation({ order, status: 'CANCELLED' })} />}
      </View>}
    </View>)}
    {confirmation && <View style={styles.card}><Text style={styles.title}>{labels[confirmation.status]} · {confirmation.order.folio}</Text>
      <Text>{confirmation.status === 'RECEIVED' ? 'Confirma únicamente si recibiste todas las partidas. Se actualizarán existencias y cuentas por pagar; esta pantalla todavía no admite entregas parciales.' : confirmation.status === 'CANCELLED' ? 'La compra quedará cancelada. No se registrará una recepción.' : 'Confirma que el proveedor aceptó estas cantidades y costos.'}</Text>
      {confirmation.status === 'RECEIVED' && <SearchSelect label="Almacén de recepción" placeholder="Seleccionar almacén de recepción" items={warehouses} value={receiptWarehouseId} onChange={setReceiptWarehouseId} disabled={busy} />}
      <Button title="Confirmar operación" disabled={busy} onPress={async () => { if (confirmation.status === 'RECEIVED' && !receiptWarehouseId) { setError('Selecciona el almacén donde recibiste los productos.'); return; } const result = await action(() => purchasesApi.updatePurchaseStatus(confirmation.order._id, confirmation.status, confirmation.status === 'RECEIVED' ? receiptWarehouseId : undefined), 'Compra actualizada correctamente'); if (result) setConfirmation(null); }} /><Button title="Volver sin cambios" disabled={busy} onPress={() => setConfirmation(null)} />
    </View>}
    <View style={styles.row}><Button title="Anterior" disabled={busy || page === 1} onPress={() => setPage(page - 1)} /><Text>Página {page}</Text><Button title="Siguiente" disabled={busy || page * 20 >= total} onPress={() => setPage(page + 1)} /></View>
  </ScrollView>;
}
const styles = StyleSheet.create({
  container: { padding: tokens.spacing.md, gap: tokens.spacing.md }, row: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spacing.sm },
  card: { padding: tokens.spacing.md, gap: tokens.spacing.sm, backgroundColor: tokens.colors.surface, borderRadius: tokens.borderRadius.md, borderWidth: 1, borderColor: tokens.colors.border },
  title: { fontSize: 18, fontWeight: '700' }, input: { borderWidth: 1, borderColor: tokens.colors.border, padding: 10, borderRadius: 6 }, error: { color: tokens.colors.error }
});
