import React, { useEffect, useState, useRef } from 'react';
import { View, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { Text as DesignText } from '../design/ui';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
const Text = props => <DesignText {...props} style={[{ color: '#163655' }, props.style]} />;

export default function CompanySelectionScreen({ onSelected, onCommercial }) {
  const { refreshProfile, logout } = useAuth();
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const selecting = useRef(false);
  useEffect(() => {
    let active = true;
    api.get('/commercial/memberships').then(response => { if (active) setCompanies(response.data.data); })
      .catch(() => { if (active) setError('No se pudieron consultar tus empresas.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  const select = async companyId => {
    if (selecting.current) return;
    selecting.current = true;
    setLoading(true); setError('');
    try {
      await api.post('/commercial/switch-company', { companyId });
      await refreshProfile(); onSelected();
    } catch { setError('No se pudo seleccionar esta empresa.'); }
    finally { selecting.current = false; setLoading(false); }
  };
  return <View style={styles.page}><View style={styles.card}>
    <Text style={styles.title}>Selecciona tu empresa</Text>
    <Text>El acceso se valida para la empresa seleccionada.</Text>
    {loading && <ActivityIndicator accessibilityLabel="Consultando empresas" />}
    {!!error && <Text accessibilityRole="alert" style={{ color: '#9f1c28' }}>{error}</Text>}
    {companies.map(membership => <Pressable key={membership._id} accessibilityRole="button" disabled={loading}
      onPress={() => select(membership.companyId._id)} style={styles.button}>
      <Text style={styles.buttonText}>{membership.companyId?.name} · {membership.role}</Text>
    </Pressable>)}
    {!loading && !companies.length && <Text>Tu cuenta aún no tiene una empresa activa. Completa la verificación y contratación o acepta una invitación.</Text>}
    <Pressable accessibilityRole="button" onPress={onCommercial}><Text>Mi suscripción / contratación</Text></Pressable>
    <Pressable accessibilityRole="button" onPress={logout}><Text>Salir</Text></Pressable>
  </View></View>;
}
const styles = StyleSheet.create({ page: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: '#f4f7fb' },
  card: { width: '100%', maxWidth: 560, padding: 24, gap: 20, backgroundColor: '#fff', borderRadius: 16 }, title: { fontSize: 27, color: '#163655', fontWeight: '700' },
  button: { backgroundColor: '#163655', padding: 18, borderRadius: 8 }, buttonText: { color: '#fff', fontSize: 17 } });
