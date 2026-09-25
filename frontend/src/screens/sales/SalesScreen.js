import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, Button } from 'react-native';
import { salesApi } from '../../services/api';
import { tokens } from '../../theme/tokens';
import PageHeader from '../../components/layout/PageHeader';
import LoadingSkeleton from '../../components/data-display/LoadingSkeleton';
import ErrorState from '../../components/data-display/ErrorState';
import EmptyState from '../../components/data-display/EmptyState';
import StatusBadge from '../../components/data-display/StatusBadge';

export default function SalesScreen({ onBack }) {
  const [quotes, setQuotes] = useState([]);
  const [orders, setOrders] = useState([]);
  const [tab, setTab] = useState('quotes');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadSalesData();
  }, [tab]);

  const loadSalesData = async () => {
    try {
      setLoading(true);
      setError(null);
      if (tab === 'quotes') {
        const data = await salesApi.getQuotes();
        setQuotes(data.items || data || []);
      } else {
        const data = await salesApi.getOrders();
        setOrders(data.items || data || []);
      }
    } catch (err) {
      setError(err.message || 'Error al cargar ventas');
    } finally {
      setLoading(false);
    }
  };

  const handleApproveQuote = async (id) => {
    try {
      await salesApi.approveQuote(id);
      loadSalesData();
    } catch (err) {
      alert((err.response && err.response.data && err.response.data.message) || 'Error al aprobar cotización');
    }
  };

  const handleConvertToOrder = async (id) => {
    try {
      await salesApi.createOrderFromQuote(id);
      setTab('orders');
    } catch (err) {
      alert((err.response && err.response.data && err.response.data.message) || 'Error al convertir cotización a pedido');
    }
  };

  return (
    <View style={styles.container}>
      <PageHeader
        title="Ventas y Facturación"
        subtitle="Flujo: Cotización → Aprobación → Pedido → Factura → Pago"
      />

      <View style={styles.toolbar}>
        <View style={styles.tabRow}>
          <Button title="Cotizaciones" onPress={() => setTab('quotes')} color={tab === 'quotes' ? tokens.colors.primary : '#64748b'} />
          <Button title="Pedidos" onPress={() => setTab('orders')} color={tab === 'orders' ? tokens.colors.primary : '#64748b'} />
        </View>
        {onBack ? <Button title="Volver" onPress={onBack} /> : null}
      </View>

      {loading ? (
        <LoadingSkeleton />
      ) : error ? (
        <ErrorState message={error} onRetry={loadSalesData} />
      ) : tab === 'quotes' && quotes.length === 0 ? (
        <EmptyState title="No hay cotizaciones" description="Crea cotizaciones comerciales." />
      ) : tab === 'orders' && orders.length === 0 ? (
        <EmptyState title="No hay pedidos" description="Los pedidos confirmados aparecerán aquí." />
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {tab === 'quotes'
            ? quotes.map((q) => (
                <View key={q._id} style={[styles.card, tokens.shadows.sm]}>
                  <View>
                    <Text style={styles.titleText}>Cotización #{q._id.substring(q._id.length - 6)}</Text>
                    <Text style={styles.subText}>Cliente ID: {q.customerId}</Text>
                  </View>
                  <View style={styles.actions}>
                    <StatusBadge status={q.status || 'DRAFT'} />
                    {q.status === 'DRAFT' ? (
                      <Button title="Aprobar" onPress={() => handleApproveQuote(q._id)} />
                    ) : q.status === 'APPROVED' ? (
                      <Button title="Convertir a Pedido" onPress={() => handleConvertToOrder(q._id)} />
                    ) : null}
                  </View>
                </View>
              ))
            : orders.map((o) => (
                <View key={o._id} style={[styles.card, tokens.shadows.sm]}>
                  <View>
                    <Text style={styles.titleText}>Pedido #{o._id.substring(o._id.length - 6)}</Text>
                    <Text style={styles.subText}>Total: ${o.total}</Text>
                  </View>
                  <StatusBadge status={o.status || 'CONFIRMED'} />
                </View>
              ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: tokens.spacing.md },
  toolbar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: tokens.spacing.md },
  tabRow: { flexDirection: 'row', gap: tokens.spacing.xs },
  list: { gap: tokens.spacing.sm, paddingBottom: tokens.spacing.xl },
  card: { backgroundColor: tokens.colors.surface, borderRadius: tokens.borderRadius.md, padding: tokens.spacing.md, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: tokens.colors.border },
  titleText: { fontSize: tokens.typography.sizes.md, fontWeight: '600', color: tokens.colors.text },
  subText: { fontSize: tokens.typography.sizes.xs, color: tokens.colors.textSecondary, marginTop: 2 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing.sm }
});
