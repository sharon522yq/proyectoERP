import { operationError } from '../../services/operationError';
import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, TextInput, ScrollView, Button } from '../../design/ui';
import { productionApi, productsApi, inventoryApi } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { tokens } from '../../theme/tokens';
import PageHeader from '../../components/layout/PageHeader';
import SearchSelect from '../../components/SearchSelect';
const rows = value => value?.items || (Array.isArray(value) ? value : []);
const labels = { DRAFT: 'Borrador', PLANNED: 'Planificada', RELEASED: 'Liberada', IN_PROGRESS: 'En producción', COMPLETED: 'Terminada', CANCELLED: 'Cancelada' };
const next = { DRAFT: ['PLANNED', 'Planificar'], PLANNED: ['RELEASED', 'Liberar orden'], RELEASED: ['IN_PROGRESS', 'Iniciar producción'] };
export default function ProductionScreen({ onBack }) {
  const { has } = useAuth();
  const [orders, setOrders] = useState([]), [boms, setBoms] = useState([]), [products, setProducts] = useState([]), [warehouses, setWarehouses] = useState([]);
  const [form, setForm] = useState(''), [name, setName] = useState(''), [productId, setProductId] = useState(''), [components, setComponents] = useState([{ componentProductId: '', quantity: '1' }]);
  const [bomId, setBomId] = useState(''), [warehouseId, setWarehouseId] = useState(''), [quantity, setQuantity] = useState('1');
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState(''), [confirmation, setConfirmation] = useState(null);
  const [page, setPage] = useState(1), [total, setTotal] = useState(0);
  const running = useRef(false), version = useRef(0);
  async function load(current = page) {
    const request = ++version.current;
    try {
      const [result, recipes] = await Promise.all([productionApi.getOrders({ page: current, limit: 20 }), has('production.bom.read') ? productionApi.getBoms({ page: 1, limit: 100 }) : []]);
      if (request === version.current) { setOrders(rows(result)); setTotal(result.total || 0); setBoms(rows(recipes)); }
    } catch (err) { if (request === version.current) setError(err.response?.data?.message || 'No se pudo cargar Producción. Pulsa Actualizar para reintentar.'); }
  }
  useEffect(() => { load(); return () => { version.current++; }; }, [page]);
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const result = [];
        if (has('products.read')) for (let current = 1; ; current++) {
          const response = await productsApi.getProducts({ page: current, limit: 100, status: 'ACTIVE' }); result.push(...rows(response));
          if (!response.total || result.length >= response.total || !rows(response).length) break;
        }
        const wh = has('inventory.read') ? rows(await inventoryApi.getWarehouses()).filter(item => item.active) : [];
        if (active) { setProducts(result); setWarehouses(wh); }
      } catch { if (active) setError('No se cargaron los productos o almacenes. Revisa tus permisos y vuelve a abrir Producción.'); }
    })(); return () => { active = false; };
  }, []);
  async function action(work, text) {
    if (running.current) return;
    running.current = true; setBusy(true); setError(''); setMessage('');
    try { const result = await work(); setMessage(text); await load(); return result; }
    catch (err) { setError(operationError(err)); }
    finally { running.current = false; setBusy(false); }
  }
  const productName = id => products.find(item => item._id === String(id))?.name || 'Producto no disponible';
  async function save() {
    if (form === 'recipe') {
      const items = components.map(item => ({ componentProductId: item.componentProductId, quantity: Number(item.quantity) }));
      if (!name.trim() || !productId || items.some(item => !item.componentProductId || item.componentProductId === productId || !Number.isFinite(item.quantity) || item.quantity <= 0) || new Set(items.map(item => item.componentProductId)).size !== items.length) {
        setError('Escribe el nombre, selecciona el producto terminado y agrega materiales distintos con cantidades mayores que cero.'); return;
      }
      const result = await action(() => productionApi.createBom({ name: name.trim(), productId, items }), 'Receta creada. Ahora puedes crear una orden de producción.');
      if (result) { setForm(''); setComponents([{ componentProductId: '', quantity: '1' }]); setName(''); }
    } else {
      const bom = boms.find(item => item._id === bomId), count = Number(quantity);
      if (!bom || !warehouseId || !Number.isInteger(count) || count <= 0) { setError('Selecciona receta, almacén y una cantidad entera mayor que cero.'); return; }
      const result = await action(() => productionApi.createOrder({ bomId, productId: bom.productId, warehouseId, quantity: count }), 'Orden creada en borrador. Revisa las cantidades antes de planificarla.');
      if (result) setForm('');
    }
  }
  return <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
    <PageHeader title="Producción" subtitle="Define materiales por unidad, prepara la orden y registra su fabricación." />
    <View style={styles.row}>{onBack && <Button title="Volver" onPress={onBack} />}<Button title="Actualizar" disabled={busy} onPress={() => load()} />{has('production.bom.create') && <Button title="Nueva receta" disabled={busy} onPress={() => setForm('recipe')} />}{has('production.orders.create') && <Button title="Nueva orden de producción" disabled={busy} onPress={() => setForm('order')} />}</View>
    {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}{!!message && <Text accessibilityRole="alert">{message}</Text>}
    {!!form && <View style={styles.card}>
      <Text style={styles.title}>{form === 'recipe' ? 'Nueva receta de materiales' : 'Nueva orden de producción'}</Text>
      {form === 'recipe' ? <>
        <Text>Nombre de la receta</Text><TextInput accessibilityLabel="Nombre de la receta" style={styles.input} value={name} maxLength={150} editable={!busy} onChangeText={setName} />
        <SearchSelect label="Producto terminado" placeholder="Seleccionar producto terminado" items={products} value={productId} onChange={setProductId} disabled={busy} />
        <Text>Indica los materiales necesarios para fabricar una unidad del producto terminado.</Text>
        {components.map((item, index) => <View key={index} style={styles.card}>
          <SearchSelect label={'Material ' + (index + 1)} placeholder={'Seleccionar material ' + (index + 1)} items={products.filter(p => p._id !== productId)} value={item.componentProductId} disabled={busy} onChange={id => setComponents(previous => previous.map((row, i) => i === index ? { ...row, componentProductId: id } : row))} />
          <Text>Cantidad por unidad terminada</Text><TextInput accessibilityLabel={'Cantidad material ' + (index + 1)} value={item.quantity} style={styles.input} keyboardType="decimal-pad" editable={!busy} onChangeText={value => setComponents(previous => previous.map((row, i) => i === index ? { ...row, quantity: value } : row))} />
          {components.length > 1 && <Button title="Quitar material" disabled={busy} onPress={() => setComponents(components.filter((_, i) => i !== index))} />}
        </View>)}<Button title="Agregar material" disabled={busy} onPress={() => setComponents([...components, { componentProductId: '', quantity: '1' }])} />
      </> : <>
        {!boms.length && <Text>Crea una receta antes de preparar una orden.</Text>}
        <SearchSelect label="Receta" placeholder="Seleccionar receta" items={boms} value={bomId} disabled={busy} onChange={setBomId} describe={item => item.name + ' · ' + productName(item.productId)} />
        <SearchSelect label="Almacén de producción" placeholder="Seleccionar almacén de producción" items={warehouses} value={warehouseId} disabled={busy} onChange={setWarehouseId} />
        <Text>Unidades a fabricar</Text><TextInput accessibilityLabel="Unidades a fabricar" value={quantity} style={styles.input} keyboardType="number-pad" editable={!busy} onChangeText={setQuantity} />
        {(boms.find(item => item._id === bomId)?.items || []).map((item, index) => <Text key={index}>Necesitas {item.quantity * Number(quantity || 0)} de {productName(item.componentProductId)}</Text>)}
      </>}
      <Button title={form === 'recipe' ? 'Guardar receta' : 'Guardar orden en borrador'} disabled={busy} onPress={save} /><Button title="Cerrar sin guardar" disabled={busy} onPress={() => setForm('')} />
    </View>}
    {!orders.length && <Text>No hay órdenes en esta página. Empieza creando una receta y una orden.</Text>}
    {orders.map(order => <View key={order._id} style={styles.card}>
      <Text style={styles.title}>{order.folio} · {productName(order.productId)}</Text><Text>Estado: {labels[order.status] || order.status}</Text><Text>Unidades: {order.quantity}</Text><Text>Almacén: {warehouses.find(item => item._id === String(order.warehouseId))?.name || 'No disponible'}</Text>
      {(order.materialRequirements || []).map((item, i) => <Text key={i}>Material: {productName(item.componentProductId)} · {item.quantity * order.quantity}</Text>)}
      {has('production.orders.update') && <View style={styles.row}>
        {next[order.status] && <Button title={next[order.status][1]} disabled={busy} onPress={() => setConfirmation({ order, type: 'status', status: next[order.status][0] })} />}
        {['RELEASED', 'IN_PROGRESS'].includes(order.status) && <Button title="Registrar consumo de materiales" disabled={busy} onPress={() => setConfirmation({ order, type: 'consume' })} />}
        {order.status === 'IN_PROGRESS' && <Button title="Finalizar fabricación" disabled={busy} onPress={() => setConfirmation({ order, type: 'complete' })} />}
        {['DRAFT', 'PLANNED'].includes(order.status) && <Button title="Cancelar orden" disabled={busy} onPress={() => setConfirmation({ order, type: 'status', status: 'CANCELLED' })} />}
      </View>}
    </View>)}
    {confirmation && <View style={styles.card}><Text style={styles.title}>Revisar operación · {confirmation.order.folio}</Text>
      <Text>{confirmation.type === 'consume' ? 'Se descontarán todos los materiales de esta orden. Confirma que los entregaste a producción. Reintentar el mismo consumo no vuelve a descontarlos.' : confirmation.type === 'complete' ? 'Se registrarán los productos terminados en el almacén. Antes deben estar completos los consumos de materiales.' : 'La orden pasará a: ' + labels[confirmation.status] + '.'}</Text>
      <Button title="Confirmar operación de producción" disabled={busy} onPress={async () => {
        const { order, type, status } = confirmation;
        const result = await action(() => type === 'consume' ? productionApi.consumeMaterials(order._id) : type === 'complete' ? productionApi.completeOrder(order._id) : productionApi.updateOrderStatus(order._id, status), 'Operación de producción registrada');
        if (result) setConfirmation(null);
      }} /><Button title="Volver sin cambios" disabled={busy} onPress={() => setConfirmation(null)} />
    </View>}
    <View style={styles.row}><Button title="Anterior" disabled={busy || page === 1} onPress={() => setPage(page - 1)} /><Text>Página {page}</Text><Button title="Siguiente" disabled={busy || page * 20 >= total} onPress={() => setPage(page + 1)} /></View>
  </ScrollView>;
}
const styles = StyleSheet.create({ container: { padding: tokens.spacing.md, gap: tokens.spacing.md }, row: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spacing.sm }, card: { padding: tokens.spacing.md, gap: tokens.spacing.sm, backgroundColor: tokens.colors.surface, borderRadius: tokens.borderRadius.md, borderWidth: 1, borderColor: tokens.colors.border }, title: { fontSize: 18, fontWeight: '700' }, input: { borderWidth: 1, borderColor: tokens.colors.border, padding: 12, borderRadius: 8 }, error: { color: tokens.colors.error } });
