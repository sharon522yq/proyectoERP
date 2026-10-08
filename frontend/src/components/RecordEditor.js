import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, TextInput, Button } from '../design/ui';
import { tokens } from '../theme/tokens';
export default function RecordEditor({ title, fields, values, onChange, onSave, onCancel, busy, error }) {
  return <View style={styles.card}>
    <Text style={styles.title}>{title}</Text>
    {fields.map(field => <View key={field.key} style={styles.field}>
      <Text style={styles.label}>{field.label}{field.required ? ' (obligatorio)' : ''}</Text>
      {!!field.hint && <Text style={styles.hint}>{field.hint}</Text>}
      <TextInput accessibilityLabel={field.label} value={values[field.key] ?? ''} editable={!busy} maxLength={field.maxLength || 200} multiline={field.multiline} keyboardType={field.numeric ? 'decimal-pad' : field.email ? 'email-address' : 'default'} autoCapitalize={field.email ? 'none' : 'sentences'} style={styles.input} onChangeText={value => onChange({ ...values, [field.key]: value })} />
    </View>)}
    {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
    <View style={styles.row}><Button title={busy ? 'Guardando…' : 'Guardar cambios'} disabled={busy} onPress={onSave} /><Button title="Cerrar sin guardar" disabled={busy} onPress={onCancel} /></View>
  </View>;
}
export function validateRecord(fields, values) {
  for (const field of fields) {
    const value = String(values[field.key] || '').trim();
    if (field.required && !value) return 'Completa el campo ' + field.label.toLowerCase() + '.';
    if (value && field.numeric && (!Number.isFinite(Number(value)) || Number(value) < 0)) return field.label + ': escribe un número mayor o igual a cero.';
    if (value && field.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'Escribe un correo electrónico válido o deja el campo vacío.';
    if (value && field.date && (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value)) return field.label + ': utiliza una fecha válida con formato AAAA-MM-DD.';
  }
  return '';
}
const styles = StyleSheet.create({ card: { padding: 20, borderWidth: 1, borderColor: tokens.colors.border, backgroundColor: tokens.colors.surface, borderRadius: 12, gap: 16 }, title: { fontSize: 20, fontWeight: '700' }, field: { gap: 6 }, label: { fontWeight: '600' }, hint: { color: tokens.colors.textSecondary }, input: { borderWidth: 1, borderColor: tokens.colors.border, borderRadius: 8, padding: 12, fontSize: 16 }, row: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 }, error: { color: tokens.colors.error } });
