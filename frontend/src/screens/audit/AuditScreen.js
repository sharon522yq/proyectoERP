import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, Button } from 'react-native';
import { adminApi } from '../../services/api';
import { tokens } from '../../theme/tokens';
import PageHeader from '../../components/layout/PageHeader';
import LoadingSkeleton from '../../components/data-display/LoadingSkeleton';
import ErrorState from '../../components/data-display/ErrorState';
import EmptyState from '../../components/data-display/EmptyState';

export default function AuditScreen({ onBack }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadAudit();
  }, []);

  const loadAudit = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await adminApi.getAuditLogs();
      setLogs(data.items || data || []);
    } catch (err) {
      setError(err.message || 'Error al cargar registros de auditoría');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <PageHeader title="Auditoría del Sistema" subtitle="Registro append-only de operaciones críticas" />
      <View style={styles.toolbar}>{onBack ? <Button title="Volver" onPress={onBack} /> : null}</View>

      {loading ? (
        <LoadingSkeleton />
      ) : error ? (
        <ErrorState message={error} onRetry={loadAudit} />
      ) : logs.length === 0 ? (
        <EmptyState title="Sin registros de auditoría" description="No hay eventos registrados." />
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {logs.map((l) => (
            <View key={l._id} style={[styles.card, tokens.shadows.sm]}>
              <View>
                <Text style={styles.titleText}>{l.action} — Módulo: {l.module}</Text>
                <Text style={styles.subText}>Usuario: {l.userId} • {new Date(l.timestamp || Date.now()).toLocaleString()}</Text>
              </View>
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
