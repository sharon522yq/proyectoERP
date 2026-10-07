import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, Button } from 'react-native';
import { financeApi } from '../../services/api';
import { tokens } from '../../theme/tokens';
import PageHeader from '../../components/layout/PageHeader';
import LoadingSkeleton from '../../components/data-display/LoadingSkeleton';
import ErrorState from '../../components/data-display/ErrorState';
import EmptyState from '../../components/data-display/EmptyState';
import MetricCard from '../../components/data-display/MetricCard';

export default function FinanceScreen({ onBack }) {
  const [summary, setSummary] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadFinance();
  }, []);

  const loadFinance = async () => {
    try {
      setLoading(true);
      setError(null);
      const [sumData, txData] = await Promise.all([
        financeApi.getSummary(),
        financeApi.getTransactions()
      ]);
      setSummary(sumData);
      setTransactions(txData.items || txData || []);
    } catch (err) {
      setError(err.response?.data?.message || 'No se pudieron cargar los datos financieros. Intenta nuevamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <PageHeader title="Finanzas y Contabilidad" subtitle="Cuentas, transacciones y flujo financiero" />
      <View style={styles.toolbar}>{onBack ? <Button title="Volver" onPress={onBack} /> : null}</View>

      {loading ? (
        <LoadingSkeleton />
      ) : error ? (
        <ErrorState message={error} onRetry={loadFinance} />
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          <View style={styles.metricsRow}>
            <MetricCard title="Activos" value={'$' + String(summary?.assets ?? 0)} />
            <MetricCard title="Pasivos" value={'$' + String(summary?.liabilities ?? 0)} />
            <MetricCard title="Ingresos netos" value={'$' + String(summary?.netIncome ?? 0)} />
            <MetricCard title="Transacciones" value={transactions.length} color={tokens.colors.secondary} />
          </View>
          <Text style={styles.sectionTitle}>Últimas Transacciones</Text>
          {transactions.length === 0 ? (
            <EmptyState title="Sin transacciones" description="No hay movimientos financieros registrados." />
          ) : (
            transactions.map((t) => (
              <View key={t._id} style={[styles.card, tokens.shadows.sm]}>
                <View>
                  <Text style={styles.titleText}>{t.description || 'Transacción'}</Text>
                  <Text style={styles.subText}>Tipo: {t.type} • Cuenta: {t.accountId}</Text>
                </View>
                <Text style={[styles.amount, t.type === 'INCOME' ? styles.income : styles.expense]}>
                  {t.type === 'INCOME' ? '+' : '-'}${t.amount}
                </Text>
              </View>
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: tokens.spacing.md },
  toolbar: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: tokens.spacing.md },
  metricsRow: { flexDirection: 'row', gap: tokens.spacing.md, marginBottom: tokens.spacing.lg },
  sectionTitle: { fontSize: tokens.typography.sizes.lg, fontWeight: '700', marginBottom: tokens.spacing.md },
  list: { paddingBottom: tokens.spacing.xl },
  card: { backgroundColor: tokens.colors.surface, borderRadius: tokens.borderRadius.md, padding: tokens.spacing.md, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: tokens.colors.border, marginBottom: tokens.spacing.sm },
  titleText: { fontSize: tokens.typography.sizes.md, fontWeight: '600', color: tokens.colors.text },
  subText: { fontSize: tokens.typography.sizes.xs, color: tokens.colors.textSecondary, marginTop: 2 },
  amount: { fontSize: tokens.typography.sizes.md, fontWeight: '700' },
  income: { color: tokens.colors.success },
  expense: { color: tokens.colors.error }
});
