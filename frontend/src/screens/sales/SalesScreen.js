import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, ScrollView, StyleSheet, Button, Platform, Share } from 'react-native';
import { salesApi, crmApi, productsApi } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { tokens } from '../../theme/tokens';
import PageHeader from '../../components/layout/PageHeader';
import { invoiceHtml, invoiceText, money } from './invoiceDocument';

const rows = data => data?.items || (Array.isArray(data) ? data : []);
const labels = { DRAFT: 'Borrador', SENT: 'Enviada', APPROVED: 'Aprobada', CONVERTED: 'Convertida', CONFIRMED: 'Confirmado', PREPARING: 'En preparación', SHIPPED: 'Enviado', DELIVERED: 'Entregado', CANCELLED: 'Cancelado' };
const blankLine = () => ({ productId: '', quantity: '1', unitPrice: '', taxRate: '0' });

export default function SalesScreen({ onBack }) {
  const { has } = useAuth();
  const [tab, setTab] = useState('quotes');
  const [data, setData] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [customerId, setCustomerId] = useState('');
  const [lines, setLines] = useState([blankLine()]);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const requestVersion = useRef(0);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [selected, setSelected] = useState(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [catalogError, setCatalogError] = useState('');

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [c, p] = await Promise.all([
          has('crm.customers.read') ? loadCatalog(crmApi.getCustomers) : [],
          has('products.read') ? loadCatalog(params => productsApi.getProducts({ ...params, status: 'ACTIVE' })) : []
        ]);
        if (active) { setCustomers(c); setProducts(p); }
      } catch { if (active) setCatalogError('No se pudieron cargar los clientes o productos. Revisa tus permisos y vuelve a abrir Ventas.'); }
    })();
    return () => { active = false; };
  }, []);

  async function loadCatalog(get) {
    const result = [];
    for (let current = 1; ; current++) {
      const response = await get({ page: current, limit: 100 });
      const batch = rows(response);
      result.push(...batch);
      if (!batch.length || !response.total || result.length >= response.total) return result;
    }
  }

  async function load(currentTab = tab, currentPage = page) {
    const version = ++requestVersion.current;
    try {
      setError('');
      const getter = { quotes: salesApi.getQuotes, orders: salesApi.getOrders, invoices: salesApi.getInvoices }[currentTab];
      const response = await getter({ page: currentPage, limit: 20 });
      if (version === requestVersion.current) { setData(rows(response)); setTotal(response.total || rows(response).length); }
    } catch (err) { if (version === requestVersion.current) setError(err.response?.data?.message || 'No se pudieron cargar los documentos'); }
  }
  useEffect(() => { load(); }, [tab, page]);

  async function action(work, success, nextTab = tab) {
    if (pending.current) return;
    pending.current = true; setBusy(true); setError(''); setMessage('');
    try {
      const result = await work();
      setMessage(success);
      if (nextTab !== tab || page !== 1) { setTab(nextTab); setPage(1); }
      else await load(nextTab, 1);
      return result;
    } catch (err) { setError(err.response?.data?.message || err.message || 'No se pudo completar la operación'); }
    finally { pending.current = false; setBusy(false); }
  }
  const patch = (index, values) => setLines(previous => previous.map((line, i) => i === index ? { ...line, ...values } : line));
  const customerName = id => customers.find(c => c._id === String(id))?.name || String(id || 'Cliente');
  const productName = id => products.find(p => p._id === String(id))?.name || String(id || 'Producto');

  async function create() {
    const items = lines.map(line => ({
      productId: line.productId, description: productName(line.productId),
      quantity: Number(line.quantity), unitPrice: Number(line.unitPrice), taxRate: Number(line.taxRate)
    }));
    if (!customerId || items.some((item, index) => !item.productId || !Number.isInteger(item.quantity) || item.quantity < 1 ||
      !lines[index].unitPrice.trim() || !Number.isFinite(item.unitPrice) || item.unitPrice < 0 ||
      !Number.isFinite(item.taxRate) || item.taxRate < 0 || item.taxRate > 100)) {
      setError('Selecciona un cliente y productos; utiliza cantidades enteras positivas, precios válidos e impuestos entre 0 y 100%.');
      return;
    }
    const quote = await action(() => salesApi.createQuote({ customerId, items }), 'Cotización creada', 'quotes');
    if (quote) { setCreating(false); setLines([blankLine()]); setCustomerId(''); }
  }
  async function exportInvoice(invoice) {
    const customer = customerName(invoice.customerId);
    if (Platform.OS === 'web') {
      const popup = window.open('', '_blank');
      if (!popup) { setError('Permite ventanas emergentes para imprimir o guardar la factura como PDF.'); return; }
      popup.document.write(invoiceHtml(invoice, customer));
      popup.document.close();
      popup.focus();
      popup.print();
    } else {
      try { await Share.share({ title: invoice.folio, message: invoiceText(invoice, customer) }); }
      catch { setError('No se pudo compartir la factura'); }
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <PageHeader title="Ventas y facturación" subtitle="Cotización → Aprobación → Pedido → Confirmación → Factura interna" />
      <View style={styles.row}>
        {[['quotes', 'Cotizaciones', 'sales.quotes.read'], ['orders', 'Pedidos', 'sales.orders.read'], ['invoices', 'Facturas', 'sales.invoices.read']].filter(([, , permission]) => has(permission)).map(([key, label]) =>
          <Button key={key} title={label} disabled={busy} color={tab === key ? tokens.colors.primary : '#64748b'} onPress={() => { setTab(key); setPage(1); setSelected(null); }} />)}
        {onBack && <Button title="Volver" onPress={onBack} />}
        <Button title="Actualizar" onPress={() => load()} disabled={busy} />
      </View>
      {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
      {!!message && <Text accessibilityRole="alert">{message}</Text>}
      {!!catalogError && <Text style={styles.error}>{catalogError}</Text>}
      {tab === 'quotes' && has('sales.quotes.create') && <Button title={creating ? 'Cerrar formulario' : 'Nueva cotización'} disabled={busy} onPress={() => setCreating(!creating)} />}
      {creating && tab === 'quotes' && <View style={styles.card}>
        <Text style={styles.title}>Nueva cotización</Text>
        <Text>Cliente</Text>
        {!customers.length && <Text>Primero registra un cliente en CRM y vuelve a abrir Ventas.</Text>}
        <View style={styles.row}>{customers.map(c => <Button key={c._id} title={c.name} color={customerId === c._id ? tokens.colors.primary : '#64748b'} disabled={busy} onPress={() => setCustomerId(c._id)} />)}</View>
        {!products.length && <Text>Primero registra productos y existencias en Productos e Inventario.</Text>}
        {lines.map((line, index) => <View key={index} style={styles.card}>
          <Text style={styles.title}>Partida {index + 1}</Text>
          <View style={styles.row}>{products.map(p => <Button key={p._id} title={p.name + ' (' + money(p.price) + ')'} color={line.productId === p._id ? tokens.colors.primary : '#64748b'} disabled={busy} onPress={() => patch(index, { productId: p._id, unitPrice: String(p.price ?? 0) })} />)}</View>
          {[['quantity', 'Cantidad'], ['unitPrice', 'Precio unitario'], ['taxRate', 'Impuesto (%)']].map(([key, label]) => <View key={key}>
            <Text>{label}</Text><TextInput accessibilityLabel={label + ' partida ' + (index + 1)} style={styles.input} value={line[key]} keyboardType="numeric" editable={!busy} onChangeText={value => patch(index, { [key]: value })} />
          </View>)}
          {lines.length > 1 && <Button title="Quitar partida" disabled={busy} onPress={() => setLines(lines.filter((_, i) => i !== index))} />}
        </View>)}
        <Button title="Agregar producto" disabled={busy} onPress={() => setLines([...lines, blankLine()])} />
        <Button title="Guardar cotización" onPress={create} disabled={busy || !customers.length || !products.length} />
      </View>}
      {data.length === 0 && <Text>No hay documentos en esta página.</Text>}
      {data.map(doc => <View key={doc._id} style={styles.card}>
        <Text style={styles.title}>{doc.folio}</Text>
        <Text>Cliente: {doc.customerName || customerName(doc.customerId)}</Text>
        <Text>Estado: {labels[doc.status] || doc.status}</Text>
        <Text>Total: {money(doc.total, doc.currency)}</Text>
        {(doc.items || []).map((item, i) => <Text key={i}>{item.description || productName(item.productId)} — {item.quantity} × {money(item.unitPrice, doc.currency)}</Text>)}
        <View style={styles.row}>
          {tab === 'quotes' && ['DRAFT', 'SENT'].includes(doc.status) && has('sales.quotes.approve') && <Button title="Aprobar cotización" disabled={busy} onPress={() => action(() => salesApi.approveQuote(doc._id), 'Cotización aprobada')} />}
          {tab === 'quotes' && doc.status === 'APPROVED' && has('sales.orders.create') && <Button title="Convertir a pedido" disabled={busy} onPress={() => action(() => salesApi.createOrderFromQuote(doc._id), 'Pedido creado en borrador', 'orders')} />}
          {tab === 'orders' && doc.status === 'DRAFT' && has('sales.orders.update') && <Button title="Confirmar pedido y descontar stock" disabled={busy} onPress={() => setSelected(doc)} />}
          {tab === 'orders' && ['CONFIRMED', 'PREPARING', 'SHIPPED', 'DELIVERED'].includes(doc.status) && has('sales.invoices.create') && <Button title="Generar factura interna" disabled={busy} onPress={() => action(() => salesApi.createInvoiceFromOrder(doc._id), 'Factura interna generada', 'invoices')} />}
          {tab === 'invoices' && <Button title={Platform.OS === 'web' ? 'Imprimir / Guardar PDF' : 'Compartir factura'} onPress={() => exportInvoice(doc)} />}
        </View>
        {tab === 'invoices' && <>
          <Text>Subtotal neto: {money(doc.subtotal, doc.currency)} · Descuento incluido: {money(doc.discountTotal, doc.currency)}</Text>
          <Text>Impuestos: {money(doc.taxTotal, doc.currency)}</Text>
          <Text>Documento interno del ERP. No es un comprobante fiscal.</Text>
        </>}
      </View>)}
      {selected && tab === 'orders' && <View style={styles.card}>
        <Text>Confirmar {selected.folio} descontará existencias del almacén configurado. Comprueba las partidas antes de continuar.</Text>
        <Button title="Confirmar salida de existencias" disabled={busy} onPress={async () => {
          const result = await action(() => salesApi.updateOrderStatus(selected._id, 'CONFIRMED'), 'Pedido confirmado y stock actualizado');
          if (result) setSelected(null);
        }} />
        <Button title="Volver sin confirmar" disabled={busy} onPress={() => setSelected(null)} />
      </View>}
      <View style={styles.row}>
        <Button title="Anterior" disabled={busy || page === 1} onPress={() => setPage(page - 1)} />
        <Text>Página {page}</Text>
        <Button title="Siguiente" disabled={busy || page * 20 >= total} onPress={() => setPage(page + 1)} />
      </View>
    </ScrollView>
  );
}
const styles = StyleSheet.create({
  container: { padding: tokens.spacing.md, gap: tokens.spacing.md },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: tokens.spacing.sm },
  card: { backgroundColor: tokens.colors.surface, padding: tokens.spacing.md, borderRadius: tokens.borderRadius.md, borderWidth: 1, borderColor: tokens.colors.border, gap: tokens.spacing.sm },
  title: { fontWeight: '700', fontSize: 18 },
  input: { borderWidth: 1, borderColor: tokens.colors.border, padding: 10, borderRadius: 6 },
  error: { color: tokens.colors.error }
});
