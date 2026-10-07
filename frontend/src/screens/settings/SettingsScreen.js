import { operationError } from '../../services/operationError';
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, Pressable, Button, StyleSheet } from 'react-native';
import { adminApi } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { tokens } from '../../theme/tokens';
import PageHeader from '../../components/layout/PageHeader';
const modules = [
  { key: 'hr', name: 'Personal', description: 'Fichas de empleados y datos de su puesto.' },
  { key: 'projects', name: 'Proyectos', description: 'Objetivos, tareas y seguimiento del trabajo.' },
  { key: 'production', name: 'Producción', description: 'Recetas, consumo de materiales y productos terminados.' },
  { key: 'ai', name: 'Asistente IA', description: 'Consultas al asistente cuando el proveedor esté configurado.' }
];
export default function SettingsScreen({ onBack }) {
  const { has } = useAuth();
  const [enabled, setEnabled] = useState(null), [busy, setBusy] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState(''), [confirming, setConfirming] = useState(false);
  const running = useRef(false);
  async function load() {
    setError('');
    try { const items = await adminApi.getSettings(); const preferences = items.find(item => item.key === 'modulePreferences'); setEnabled(Array.isArray(preferences?.value?.enabledModules) ? preferences.value.enabledModules : modules.map(item => item.key)); }
    catch (err) { setError(err.response?.data?.message || 'No se pudo cargar la configuración. Pulsa Actualizar para reintentar.'); }
  }
  useEffect(() => { load(); }, []);
  async function save() {
    if (running.current) return;
    running.current = true; setBusy(true); setError(''); setMessage('');
    try { await adminApi.updateSettings({ key: 'modulePreferences', value: { enabledModules: enabled } }); setMessage('Configuración guardada. Vuelve al inicio para actualizar el menú.'); setConfirming(false); }
    catch (err) { setError(operationError(err)); }
    finally { running.current = false; setBusy(false); }
  }
  return <ScrollView contentContainerStyle={styles.container}>
    <PageHeader title="Configuración de la empresa" subtitle="Adapta los módulos opcionales al trabajo de tu equipo." />
    <View style={styles.row}>{onBack && <Button title="Volver" disabled={busy} onPress={onBack} />}<Button title="Actualizar" disabled={busy} onPress={load} /></View>
    {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}{!!message && <Text accessibilityRole="alert">{message}</Text>}
    <View style={styles.card}><Text style={styles.title}>Núcleo comercial</Text><Text>CRM, Productos, Inventario, Ventas, Compras y Finanzas permanecen disponibles según los permisos del usuario.</Text></View>
    {enabled === null ? <Text>Cargando configuración…</Text> : modules.map(module => {
      const active = enabled.includes(module.key);
      return <Pressable key={module.key} accessibilityRole="checkbox" accessibilityLabel={module.name} accessibilityState={{ checked: active, disabled: busy || !has('settings.update') }} disabled={busy || !has('settings.update')} style={[styles.card, active && styles.active]} onPress={() => { setEnabled(previous => active ? previous.filter(key => key !== module.key) : [...previous, module.key]); setMessage(''); }}>
        <View style={styles.row}><Text style={styles.title}>{active ? '✓ ' : '○ '}{module.name}</Text><Text>{active ? 'Habilitado' : 'Desactivado'}</Text></View><Text>{module.description}</Text>
      </Pressable>;
    })}
    <Text>Desactivar un módulo conserva sus registros y bloquea sus operaciones. Habilitarlo mantiene los permisos asignados a cada usuario.</Text>
    {has('settings.update') && enabled !== null && <Button title="Revisar y guardar configuración" disabled={busy} onPress={() => setConfirming(true)} />}
    {confirming && <View style={styles.card}><Text>Esta configuración se aplicará a todos los usuarios de tu empresa. No elimina datos.</Text><Button title="Confirmar configuración de módulos" disabled={busy} onPress={save} /><Button title="Volver sin guardar" disabled={busy} onPress={() => setConfirming(false)} /></View>}
  </ScrollView>;
}
const styles = StyleSheet.create({ container: { padding: tokens.spacing.md, gap: tokens.spacing.md }, row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: tokens.spacing.sm }, card: { padding: 20, gap: 10, backgroundColor: tokens.colors.surface, borderRadius: 12, borderWidth: 1, borderColor: tokens.colors.border }, active: { borderColor: tokens.colors.primary }, title: { fontSize: 18, fontWeight: '700' }, error: { color: tokens.colors.error } });
