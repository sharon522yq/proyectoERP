import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, TextInput, ScrollView, Button, Modal } from '../../design/ui';
import CatalogActions from '../../components/CatalogActions';
import { useAuth } from '../../context/AuthContext';
import { crmApi } from '../../services/api';
import { tokens } from '../../theme/tokens';
import PageHeader from '../../components/layout/PageHeader';
import LoadingSkeleton from '../../components/data-display/LoadingSkeleton';
import ErrorState from '../../components/data-display/ErrorState';
import EmptyState from '../../components/data-display/EmptyState';
import StatusBadge from '../../components/data-display/StatusBadge';

export default function CrmScreen({ onBack }) {
  const { has } = useAuth();
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

  const [tab, setTab] = useState('leads'), [editing, setEditing] = useState(null), [page, setPage] = useState(1), [total, setTotal] = useState(0), [search, setSearch] = useState('');
  const requestVersion = useRef(0);
  function openForm(record = null) {
    setEditing(record); setName(record?.name || ''); setEmail(record?.email || ''); setPhone(record?.phone || ''); setFormError(''); setModalVisible(true);
  }
  useEffect(() => { loadLeads(); }, [tab, page, search]);

  const loadLeads = async () => {
    const version = ++requestVersion.current;
    try {
      setLoading(true);
      setError(null);
      const params = { page, limit: 20, search: search.trim() };
      const data = await (tab === 'leads' ? crmApi.getLeads(params) : crmApi.getCustomers(params));
      if (version !== requestVersion.current) return;
      setTotal(data.total || 0);
      setLeads(data.items || data || []);
    } catch (err) {
      if (version === requestVersion.current) setError(err.response?.data?.message || 'No se pudo cargar el catálogo. Intenta nuevamente.');
    } finally {
      if (version === requestVersion.current) setLoading(false);
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
      const data = { name: leadName, ...(leadEmail ? { email: leadEmail } : editing ? { email: '' } : {}), ...(leadPhone ? { phone: leadPhone } : editing ? { phone: '' } : {}) };
      if (editing) await (tab === 'leads' ? crmApi.updateLead(editing._id, data) : crmApi.updateCustomer(editing._id, data));
      else await (tab === 'leads' ? crmApi.createLead(data) : crmApi.createCustomer(data));
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
        title="CRM: prospectos, clientes y proveedores"
        subtitle="Gestión comercial y conversión de oportunidades"
        actionTitle={has(tab === 'leads' ? 'crm.leads.create' : 'crm.customers.create') ? tab === 'leads' ? 'Nuevo Lead' : 'Nuevo cliente / proveedor' : undefined}
        onAction={() => openForm()}
      />

      <View style={styles.toolbar}>
        {has('crm.leads.read') && <Button title="Prospectos" variant={tab === 'leads' ? 'primary' : 'secondary'} disabled={saving} onPress={() => { setTab('leads'); setPage(1); }} />}
        {has('crm.customers.read') && <Button title="Clientes y proveedores" variant={tab === 'customers' ? 'primary' : 'secondary'} disabled={saving} onPress={() => { setTab('customers'); setPage(1); }} />}
        <TextInput style={styles.search} accessibilityLabel="Buscar en CRM" placeholder="Buscar por nombre…" value={search} onChangeText={value => { setSearch(value); setPage(1); }} />
        {onBack ? <Button title="Volver" onPress={onBack} /> : null}
      </View>

      {loading ? (
        <LoadingSkeleton />
      ) : error ? (
        <ErrorState message={error} onRetry={loadLeads} />
      ) : leads.length === 0 ? (
        <EmptyState title={tab === 'leads' ? 'No hay prospectos' : 'No hay clientes o proveedores'} description="Agrega un registro para empezar." actionTitle={has(tab === 'leads' ? 'crm.leads.create' : 'crm.customers.create') ? 'Crear registro' : undefined} onAction={() => openForm()} />
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {leads.map((l) => (
            <View key={l._id} style={[styles.card, tokens.shadows.sm]}>
              <View>
                <Text style={styles.name}>{l.name}</Text>
                <Text style={styles.email}>{l.email} {l.phone ? `• ${l.phone}` : ''}</Text>
              </View>
              <View style={styles.right}>
                {tab === 'leads' && has('crm.leads.delete') && <CatalogActions name={l.name} onDelete={() => crmApi.deleteLead(l._id)} onChanged={loadLeads} explanation="El lead se retirará del listado. Si fue convertido, su cliente y documentos se conservan." />}
                {has(tab === 'leads' ? 'crm.leads.update' : 'crm.customers.update') && <Button title={'Editar ' + l.name} disabled={saving} onPress={() => openForm(l)} />}
                <StatusBadge status={l.customerId ? 'CONVERTED' : l.status || 'NEW'} />
                {tab === 'leads' && has('crm.leads.update') && !l.customerId && !l.convertedAt ? (
                  <Button title="Convertir a Cliente" disabled={saving} onPress={() => handleConvert(l._id)} />
                ) : null}
              </View>
            </View>
          ))}
        </ScrollView>
      )}

      <View style={styles.toolbar}><Button title="Anterior" disabled={loading || page === 1} onPress={() => setPage(page - 1)} /><Text>Página {page}</Text><Button title="Siguiente" disabled={loading || page * 20 >= total} onPress={() => setPage(page + 1)} /></View>
      <Modal onRequestClose={() => { if (!saving) setModalVisible(false); }} visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, tokens.shadows.lg]}>
            <Text style={styles.modalTitle}>{editing ? 'Editar registro' : tab === 'leads' ? 'Crear Nuevo Lead' : 'Nuevo cliente / proveedor'}</Text>
            <Text style={{ fontWeight: '600' }}>Nombre completo (obligatorio)</Text>
            <TextInput style={styles.input} ref={nameInput} accessibilityLabel={tab === 'leads' ? 'Nombre del lead' : 'Nombre del cliente o proveedor'} maxLength={150} editable={!saving} placeholder="Nombre completo" value={name} onChangeText={setName} />
            <Text style={{ fontWeight: '600' }}>Correo electrónico (opcional)</Text>
            <TextInput style={styles.input} ref={emailInput} accessibilityLabel={tab === 'leads' ? 'Correo del lead' : 'Correo del cliente o proveedor'} keyboardType="email-address" autoComplete="email" editable={!saving} placeholder="Correo electrónico (opcional)" value={email} onChangeText={setEmail} autoCapitalize="none" />
            <Text style={{ fontWeight: '600' }}>Teléfono (opcional)</Text>
            <TextInput style={styles.input} ref={phoneInput} accessibilityLabel={tab === 'leads' ? 'Teléfono del lead' : 'Teléfono del cliente o proveedor'} maxLength={30} editable={!saving} placeholder="Teléfono (opcional)" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
            {!!formError && <Text style={styles.error}>{formError}</Text>}
            <View style={styles.modalActions}>
              <Button title="Cancelar" disabled={saving} color={tokens.colors.surfaceHover} onPress={() => setModalVisible(false)} />
              <Button title={editing ? 'Guardar cambios' : tab === 'leads' ? 'Guardar Lead' : 'Guardar cliente / proveedor'} disabled={saving} onPress={handleCreateLead} />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: tokens.spacing.md },
  toolbar: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spacing.sm, justifyContent: 'flex-end', marginBottom: tokens.spacing.md },
  search: { minWidth: 180, flex: 1, borderWidth: 1, borderColor: tokens.colors.border, borderRadius: 8, padding: 10 },
  list: { gap: tokens.spacing.sm, paddingBottom: tokens.spacing.xl },
  card: { backgroundColor: tokens.colors.surface, borderRadius: tokens.borderRadius.md, padding: tokens.spacing.md, flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spacing.md, justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: tokens.colors.border },
  name: { fontSize: tokens.typography.sizes.md, fontWeight: '600', color: tokens.colors.text },
  email: { fontSize: tokens.typography.sizes.xs, color: tokens.colors.textSecondary, marginTop: 2 },
  right: { alignItems: 'flex-end', maxWidth: '100%', flexShrink: 1, gap: 6 },
  convertBtn: { backgroundColor: tokens.colors.primaryLight, paddingHorizontal: 8, paddingVertical: 4, borderRadius: tokens.borderRadius.sm },
  convertText: { fontSize: tokens.typography.sizes.xs, color: tokens.colors.primary, fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: tokens.spacing.md },
  modalContent: { backgroundColor: tokens.colors.surface, borderRadius: tokens.borderRadius.lg, padding: tokens.spacing.xl, width: '100%', maxWidth: 440, gap: tokens.spacing.md },
  modalTitle: { fontSize: tokens.typography.sizes.lg, fontWeight: '700', color: tokens.colors.text },
  input: { borderWidth: 1, borderColor: tokens.colors.border, borderRadius: tokens.borderRadius.md, padding: tokens.spacing.sm, backgroundColor: tokens.colors.surfaceVariant },
  error: { color: tokens.colors.error, fontSize: tokens.typography.sizes.sm },
  modalActions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: tokens.spacing.md, marginTop: tokens.spacing.sm }
});
