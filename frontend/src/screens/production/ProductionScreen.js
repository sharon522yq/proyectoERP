import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, Button } from 'react-native';
import { productionApi } from '../../services/api';
import { tokens } from '../../theme/tokens';
import PageHeader from '../../components/layout/PageHeader';
import LoadingSkeleton from '../../components/data-display/LoadingSkeleton';
import ErrorState from '../../components/data-display/ErrorState';
import EmptyState from '../../components/data-display/EmptyState';
import StatusBadge from '../../components/data-display/StatusBadge';

export default function ProductionScreen({ onBack }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadProduction();
  }, []);

  const loadProduction = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await productionApi.getOrders();
      setOrders(data.items || data || []);
    } catch (err) {
      setError(err.message || 'Error al cargar producción');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <PageHeader title="Producción y BOM" subtitle="Listas de materiales, órdenes de producción y consumo" />
      <View style={styles.toolbar}>{onBack ? <Button title="Volver" onPress={onBack} /> : null}</View>

      {loading ? (
        <LoadingSkeleton />
      ) : error ? (
        <ErrorState message={error} onRetry={loadProduction} />
      ) : orders.length === 0 ? (
        <EmptyState title="No hay órdenes de producción" description="Inicia órdenes de fabricación o BOMs." />
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {orders.map((o) => (
            <View key={o._id} style={[styles.card, tokens.shadows.sm]}>
              <View>
                <Text style={styles.titleText}>Orden #{o._id.substring(o._id.length - 6)}</Text>
                <Text style={styles.subText}>Cantidad: {o.quantity || 1}</Text>
              </View>
              <StatusBadge status={o.status || 'DRAFT'} />
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: tokens.spacing.md },
  toolbar: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: tokens.spacing.md },
  list: { gap: tokens.spacing.sm, paddingBottom: tokens.spacing.xl },
  card: { backgroundColor: tokens.colors.surface, borderRadius: tokens.borderRadius.md, padding: tokens.spacing.md, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: tokens.colors.border },
  titleText: { fontSize: tokens.typography.sizes.md, fontWeight: '600', color: tokens.colors.text },
  subText: { fontSize: tokens.typography.sizes.xs, color: tokens.colors.textSecondary, marginTop: 2 }
});
