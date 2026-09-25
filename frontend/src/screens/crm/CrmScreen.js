import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, ScrollView, StyleSheet, Button, Modal } from 'react-native';
import { crmApi } from '../../services/api';
import { tokens } from '../../theme/tokens';
import PageHeader from '../../components/layout/PageHeader';
import LoadingSkeleton from '../../components/data-display/LoadingSkeleton';
import ErrorState from '../../components/data-display/ErrorState';
import EmptyState from '../../components/data-display/EmptyState';
import StatusBadge from '../../components/data-display/StatusBadge';

export default function CrmScreen({ onBack }) {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);

  // New lead form
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [formError, setFormError] = useState('');

  useEffect(() => {
    loadLeads();
  }, []);

  const loadLeads = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await crmApi.getLeads();
      setLeads(data.items || data || []);
    } catch (err) {
      setError(err.message || 'Error al cargar leads');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateLead = async () => {
    if (!name || !email) {
      setFormError('Nombre y correo son obligatorios');
      return;
    }
    try {
      setFormError('');
      await crmApi.createLead({ name: name.trim(), email: email.trim(), phone: phone.trim() });
      setModalVisible(false);
      setName('');
      setEmail('');
      setPhone('');
      loadLeads();
    } catch (err) {
      setFormError((err.response && err.response.data && err.response.data.message) || 'Error al crear lead');
    }
  };

  const handleConvert = async (id) => {
    try {
      await crmApi.convertLead(id);
      loadLeads();
    } catch (err) {
      alert((err.response && err.response.data && err.response.data.message) || 'Error al convertir lead');
    }
  };

  return (
    <View style={styles.container}>
      <PageHeader
        title="CRM — Leads y Clientes"
        subtitle="Gestión comercial y conversión de oportunidades"
        actionTitle="Nuevo Lead"
        onAction={() => setModalVisible(true)}
      />

      <View style={styles.toolbar}>
        {onBack ? <Button title="Volver" onPress={onBack} /> : null}
      </View>

      {loading ? (
        <LoadingSkeleton />
      ) : error ? (
        <ErrorState message={error} onRetry={loadLeads} />
      ) : leads.length === 0 ? (
        <EmptyState title="No hay leads" description="Crea tu primer lead comercial." actionTitle="Crear Lead" onAction={() => setModalVisible(true)} />
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {leads.map((l) => (
            <View key={l._id} style={[styles.card, tokens.shadows.sm]}>
              <View>
                <Text style={styles.name}>{l.name}</Text>
                <Text style={styles.email}>{l.email} {l.phone ? `• ${l.phone}` : ''}</Text>
              </View>
              <View style={styles.right}>
                <StatusBadge status={l.status || 'NEW'} />
                {l.status !== 'CONVERTED' ? (
                  <TouchableOpacity style={styles.convertBtn} onPress={() => handleConvert(l._id)}>
                    <Text style={styles.convertText}>Convertir a Cliente</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>
          ))}
        </ScrollView>
      )}

      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, tokens.shadows.lg]}>
            <Text style={styles.modalTitle}>Crear Nuevo Lead</Text>
            <TextInput style={styles.input} placeholder="Nombre completo" value={name} onChangeText={setName} />
            <TextInput style={styles.input} placeholder="Correo electrónico" value={email} onChangeText={setEmail} autoCapitalize="none" />
            <TextInput style={styles.input} placeholder="Teléfono" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
            {!!formError && <Text style={styles.error}>{formError}</Text>}
            <View style={styles.modalActions}>
              <Button title="Cancelar" color="#64748b" onPress={() => setModalVisible(false)} />
              <Button title="Guardar Lead" onPress={handleCreateLead} />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: tokens.spacing.md },
  toolbar: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: tokens.spacing.md },
  list: { gap: tokens.spacing.sm, paddingBottom: tokens.spacing.xl },
  card: { backgroundColor: tokens.colors.surface, borderRadius: tokens.borderRadius.md, padding: tokens.spacing.md, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: tokens.colors.border },
  name: { fontSize: tokens.typography.sizes.md, fontWeight: '600', color: tokens.colors.text },
  email: { fontSize: tokens.typography.sizes.xs, color: tokens.colors.textSecondary, marginTop: 2 },
  right: { alignItems: 'flex-end', gap: 6 },
  convertBtn: { backgroundColor: tokens.colors.primaryLight, paddingHorizontal: 8, paddingVertical: 4, borderRadius: tokens.borderRadius.sm },
  convertText: { fontSize: tokens.typography.sizes.xs, color: tokens.colors.primary, fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: tokens.spacing.md },
  modalContent: { backgroundColor: tokens.colors.surface, borderRadius: tokens.borderRadius.lg, padding: tokens.spacing.xl, width: '100%', maxWidth: 440, gap: tokens.spacing.md },
  modalTitle: { fontSize: tokens.typography.sizes.lg, fontWeight: '700', color: tokens.colors.text },
  input: { borderWidth: 1, borderColor: tokens.colors.border, borderRadius: tokens.borderRadius.md, padding: tokens.spacing.sm, backgroundColor: tokens.colors.surfaceVariant },
  error: { color: tokens.colors.error, fontSize: tokens.typography.sizes.sm },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: tokens.spacing.md, marginTop: tokens.spacing.sm }
});
