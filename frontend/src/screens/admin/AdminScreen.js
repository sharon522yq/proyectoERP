import React, { useState, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, ScrollView, Button } from '../../design/ui';
import { useAuth } from '../../context/AuthContext';
import { adminApi } from '../../services/api';
import { tokens } from '../../theme/tokens';
import PageHeader from '../../components/layout/PageHeader';
import LoadingSkeleton from '../../components/data-display/LoadingSkeleton';
import ErrorState from '../../components/data-display/ErrorState';
import EmptyState from '../../components/data-display/EmptyState';

export default function AdminScreen({ onBack }) {
  const { user, has } = useAuth();
  const canAssign = user.role === 'SUPER_ADMIN' && has('*');
  const [companies, setCompanies] = useState([]);
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState('');
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await adminApi.getUsers();
      setUsers(data.items || data || []);
      if (canAssign) setCompanies((await adminApi.getCompanies()).filter(c => c.active));
    } catch (err) {
      setError(err.response?.data?.message || 'Error al cargar usuarios');
    } finally {
      setLoading(false);
    }
  };

  const assignCompany = async (id, companyId) => {
    if (saving) return;
    setSaving(true); setActionError('');
    try { await adminApi.updateUser(id, { companyId }); await loadUsers(); }
    catch (err) { setActionError(err.response?.data?.message || 'No se pudo asignar la empresa'); }
    finally { setSaving(false); }
  };

  return (
    <View style={styles.container}>
      <PageHeader title="Administración de Usuarios y Roles" subtitle="Control de accesos y RBAC" />
      <View style={styles.toolbar}>{onBack ? <Button title="Volver" onPress={onBack} /> : null}</View>

      {!!actionError && <Text accessibilityRole="alert" style={{ color: tokens.colors.error }}>{actionError}</Text>}
      {loading ? (
        <LoadingSkeleton />
      ) : error ? (
        <ErrorState message={error} onRetry={loadUsers} />
      ) : users.length === 0 ? (
        <EmptyState title="No hay usuarios" description="No se encontraron usuarios en la empresa." />
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {users.map((u) => (
            <View key={u._id} style={[styles.card, tokens.shadows.sm]}>
              <View>
                <Text style={styles.titleText}>{u.name}</Text>
                <Text style={styles.subText}>{u.email} • Rol: {u.role}</Text>
                {canAssign && !u.companyId && <View style={{ gap: tokens.spacing.sm, marginTop: tokens.spacing.sm }}>
                  <Text style={styles.subText}>Asignar empresa. El usuario deberá volver a iniciar sesión.</Text>
                  {companies.length === 0 && <Text style={styles.subText}>No hay empresas activas disponibles.</Text>}
                  {companies.map(c => <Button key={c._id} title={`Asignar a ${c.name}`} disabled={saving} onPress={() => assignCompany(u._id, c._id)} />)}
                </View>}
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
  toolbar: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', marginBottom: tokens.spacing.md },
  list: { gap: tokens.spacing.sm, paddingBottom: tokens.spacing.xl },
  card: { backgroundColor: tokens.colors.surface, borderRadius: tokens.borderRadius.md, padding: tokens.spacing.md, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: tokens.colors.border },
  titleText: { fontSize: tokens.typography.sizes.md, fontWeight: '600', color: tokens.colors.text },
  subText: { fontSize: tokens.typography.sizes.xs, color: tokens.colors.textSecondary, marginTop: 2 }
});
