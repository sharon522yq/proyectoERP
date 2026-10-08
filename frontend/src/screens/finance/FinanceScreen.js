import { operationError } from '../../services/operationError';
import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, ScrollView, Button } from '../../design/ui';
import { financeApi } from '../../services/api';
import { tokens } from '../../theme/tokens';
import SearchSelect from '../../components/SearchSelect';
import RecordEditor, { validateRecord } from '../../components/RecordEditor';
import { useAuth } from '../../context/AuthContext';
import PageHeader from '../../components/layout/PageHeader';
import LoadingSkeleton from '../../components/data-display/LoadingSkeleton';
import ErrorState from '../../components/data-display/ErrorState';
import EmptyState from '../../components/data-display/EmptyState';
import MetricCard from '../../components/data-display/MetricCard';

const accountFields = [{ key: 'code', label: 'Código de cuenta', required: true, maxLength: 20 }, { key: 'name', label: 'Nombre de caja o banco', required: true, maxLength: 150 }];
const movementFields = [{ key: 'amount', label: 'Importe del movimiento', required: true, numeric: true }, { key: 'description', label: 'Motivo del movimiento', required: true, maxLength: 500 }];
export default function FinanceScreen({ onBack }) {
  const { has } = useAuth();
  const [summary, setSummary] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [accounts, setAccounts] = useState([]), [form, setForm] = useState(null), [formType, setFormType] = useState('movement'), [accountId, setAccountId] = useState(''), [type, setType] = useState('INCOME'), [busy, setBusy] = useState(false), [formError, setFormError] = useState(''), [message, setMessage] = useState('');
  const [page, setPage] = useState(1), [total, setTotal] = useState(0), [requestId, setRequestId] = useState('');
  const running = useRef(false);
  useEffect(() => {
    loadFinance();
  }, [page]);

  const loadFinance = async () => {
    try {
      setLoading(true);
      setError(null);
      const [sumData, txData, accountData] = await Promise.all([
        financeApi.getSummary(),
        has('finance.transactions.read') ? financeApi.getTransactions({ page, limit: 20 }) : { items: [], total: 0 },
        financeApi.getAccounts()
      ]);
      setSummary(sumData); setAccounts(accountData || []); setTotal(txData.total || 0);
      setTransactions(txData.items || txData || []);
    } catch (err) {
      setError(err.response?.data?.message || 'No se pudieron cargar los datos financieros. Intenta nuevamente.');
    } finally {
      setLoading(false);
    }
  };

  function open(kind) { setFormType(kind); setForm(kind === 'account' ? { code: '', name: '' } : { amount: '', description: '' }); setFormError(''); setAccountId(''); setType('INCOME'); setRequestId(Date.now().toString(36) + Math.random().toString(36).slice(2)); }
  async function save() {
    const invalid = validateRecord(formType === 'account' ? accountFields : movementFields, form);
    if (invalid) { setFormError(invalid); return; }
    if (formType === 'movement' && (!accountId || Number(form.amount) <= 0 || Math.abs(Number(form.amount) * 100 - Math.round(Number(form.amount) * 100)) >= 1e-8)) { setFormError('Selecciona una caja o banco y un importe mayor que cero, con máximo dos decimales.'); return; }
    if (running.current) return;
    running.current = true; setBusy(true); setFormError(''); setMessage('');
    try {
      if (formType === 'account') await financeApi.createAccount({ code: form.code.trim(), name: form.name.trim(), type: 'ASSET' });
      else await financeApi.createTransaction({ accountId, amount: Number(form.amount), description: form.description.trim(), type, requestId });
      setForm(null); setMessage('Registro guardado y saldos actualizados'); await loadFinance();
    } catch (err) { setFormError(operationError(err)); }
    finally { running.current = false; setBusy(false); }
  }
  return (
    <View style={styles.container}>
      <PageHeader title="Finanzas operativas" subtitle="Consulta saldos y registra movimientos de caja o banco." />
      <View style={styles.toolbar}>{onBack ? <Button title="Volver" onPress={onBack} /> : null}<Button title="Actualizar" disabled={busy} onPress={loadFinance} />{has('finance.accounts.create') && <Button title="Nueva caja o banco" disabled={busy || loading} onPress={() => open('account')} />}{has('finance.transactions.create') && <Button title="Registrar movimiento" disabled={busy || loading} onPress={() => open('movement')} />}</View>
      {!!message && <Text accessibilityRole="alert">{message}</Text>}

      {loading ? (
        <LoadingSkeleton />
      ) : error ? (
        <ErrorState message={error} onRetry={loadFinance} />
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {form && <View style={{ gap: 12, marginBottom: 16 }}>
            {formType === 'movement' && <>
              <Text>Registra una entrada o salida que ya ocurrió. Los cobros de ventas se capturan desde la factura; evita registrarlos otra vez aquí.</Text>
              <SearchSelect label="Caja o banco" placeholder="Seleccionar caja o banco" items={accounts.filter(account => account.type === 'ASSET' && account.code !== '1200')} value={accountId} onChange={setAccountId} disabled={busy} describe={account => account.name + ' · ' + account.code} />
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}><Button title="Entrada de dinero" disabled={busy} color={type === 'INCOME' ? tokens.colors.primary : tokens.colors.surfaceHover} onPress={() => setType('INCOME')} /><Button title="Salida de dinero" disabled={busy} color={type === 'EXPENSE' ? tokens.colors.primary : tokens.colors.surfaceHover} onPress={() => setType('EXPENSE')} /></View>
            </>}
            <RecordEditor title={formType === 'account' ? 'Nueva caja o banco' : type === 'INCOME' ? 'Registrar dinero recibido' : 'Registrar dinero pagado'} fields={formType === 'account' ? accountFields : movementFields} values={form} onChange={setForm} onSave={save} onCancel={() => setForm(null)} busy={busy} error={formError} />
          </View>}
          <Text>Resumen de movimientos operativos. No sustituye un libro contable ni una conciliación bancaria.</Text>
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
                  <Text style={styles.subText}>Tipo: {t.type === 'INCOME' ? 'Entrada' : t.type === 'EXPENSE' ? 'Salida' : 'Transferencia'} • Cuenta: {accounts.find(account => account._id === String(t.accountId))?.name || 'No disponible'}</Text>
                </View>
                <Text style={[styles.amount, t.type === 'INCOME' ? styles.income : styles.expense]}>
                  {t.type === 'INCOME' ? '+' : '-'}${t.amount}
                </Text>
              </View>
            ))
          )}
<View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}><Button title="Anterior" disabled={busy || page === 1} onPress={() => setPage(page - 1)} /><Text>Página {page}</Text><Button title="Siguiente" disabled={busy || page * 20 >= total} onPress={() => setPage(page + 1)} /></View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: tokens.spacing.md },
  toolbar: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'flex-end', marginBottom: tokens.spacing.md },
  metricsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spacing.md, marginBottom: tokens.spacing.lg },
  sectionTitle: { fontSize: tokens.typography.sizes.lg, fontWeight: '700', marginBottom: tokens.spacing.md },
  list: { paddingBottom: tokens.spacing.xl },
  card: { backgroundColor: tokens.colors.surface, borderRadius: tokens.borderRadius.md, padding: tokens.spacing.md, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: tokens.colors.border, marginBottom: tokens.spacing.sm },
  titleText: { fontSize: tokens.typography.sizes.md, fontWeight: '600', color: tokens.colors.text },
  subText: { fontSize: tokens.typography.sizes.xs, color: tokens.colors.textSecondary, marginTop: 2 },
  amount: { fontSize: tokens.typography.sizes.md, fontWeight: '700' },
  income: { color: tokens.colors.success },
  expense: { color: tokens.colors.error }
});
