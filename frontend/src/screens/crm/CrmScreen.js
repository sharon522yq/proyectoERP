import React, { useState, useEffect, useRef } from 'react';
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
  const [saving, setSaving] = useState(false);
  const submitting = useRef(false);
  const nameInput = useRef(null);
  const emailInput = useRef(null);
  const phoneInput = useRef(null);

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
    if (submitting.current) return;
    const value = (ref, state) => typeof ref.current?.value === 'string' ? ref.current.value.trim() : state.trim();
    const leadName = value(nameInput, name);
    const leadEmail = value(emailInput, email);
    const leadPhone = value(phoneInput, phone);
    if (!leadName || leadName.length > 150) { setFormError('Introduce un nombre de 1 a 150 caracteres'); return; }
    if (leadEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(leadEmail)) { setFormError('Introduce un correo válido, por ejemplo nombre@dominio.com, o deja el correo vacío'); return; }
    if (leadPhone.length > 30) { setFormError('El teléfono admite hasta 30 caracteres'); return; }
    try {
      submitting.current = true; setSaving(true); setFormError('');
      await crmApi.createLead({ name: leadName, ...(leadEmail ? { email: leadEmail } : {}), ...(leadPhone ? { phone: leadPhone } : {}) });
      setModalVisible(false);
      setName('');
      setEmail('');
      setPhone('');
      loadLeads();
    } catch (err) {
      const response = err.response?.data;
      const labels = { name: 'nombre', email: 'correo electrónico', phone: 'teléfono' };
      const fields = response?.fields?.map(field => labels[field] || field).join(', ');
      setFormError(fields ? 'Revisa estos campos: ' + fields : response?.message || 'Error al crear lead');
    } finally { submitting.current = false; setSaving(false); }
  };

  const handleConvert = async (id) => {
    if (submitting.current) return;
    submitting.current = true; setSaving(true); setError(null);
    try {
      await crmApi.convertLead(id);
      loadLeads();
    } catch (err) {
      setError(err.response?.data?.message || 'Error al convertir lead');
    } finally { submitting.current = false; setSaving(false); }
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
                <StatusBadge status={l.customerId ? 'CONVERTED' : l.status || 'NEW'} />
                {!l.customerId && !l.convertedAt ? (
                  <Button title="Convertir a Cliente" disabled={saving} onPress={() => handleConvert(l._id)} />
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
            <TextInput style={styles.input} ref={nameInput} accessibilityLabel="Nombre del lead" maxLength={150} editable={!saving} placeholder="Nombre completo" value={name} onChangeText={setName} />
            <TextInput style={styles.input} ref={emailInput} accessibilityLabel="Correo del lead" keyboardType="email-address" autoComplete="email" editable={!saving} placeholder="Correo electrónico (opcional)" value={email} onChangeText={setEmail} autoCapitalize="none" />
            <TextInput style={styles.input} ref={phoneInput} accessibilityLabel="Teléfono del lead" maxLength={30} editable={!saving} placeholder="Teléfono (opcional)" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
            {!!formError && <Text style={styles.error}>{formError}</Text>}
            <View style={styles.modalActions}>
              <Button title="Cancelar" disabled={saving} color="#64748b" onPress={() => setModalVisible(false)} />
              <Button title="Guardar Lead" disabled={saving} onPress={handleCreateLead} />
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
