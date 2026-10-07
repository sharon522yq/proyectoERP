import React, { useState } from 'react';
import { View, Text, TextInput, Modal, ScrollView, Pressable, StyleSheet } from 'react-native';
import { tokens } from '../theme/tokens';
export default function SearchSelect({ label, items, value, onChange, disabled = false, placeholder = 'Seleccionar', describe = item => item.name }) {
  const [open, setOpen] = useState(false), [search, setSearch] = useState('');
  const selected = items.find(item => String(item._id) === String(value));
  const filtered = items.filter(item => describe(item).toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));
  return <View style={styles.wrapper}>
    <Text style={styles.label}>{label}</Text>
    <Pressable accessibilityRole="button" accessibilityLabel={selected ? label + ': ' + describe(selected) : placeholder} disabled={disabled} style={[styles.trigger, disabled && styles.disabled]} onPress={() => { setSearch(''); setOpen(true); }}>
      <Text style={styles.text}>{selected ? describe(selected) : placeholder}</Text><Text style={styles.chevron}>⌄</Text>
    </Pressable>
    <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
      <View style={styles.overlay}><View style={styles.dialog}>
        <Text style={styles.title}>{label}</Text>
        <TextInput autoFocus accessibilityLabel={'Buscar ' + label.toLowerCase()} placeholder="Buscar por nombre…" value={search} onChangeText={setSearch} style={styles.search} />
        <ScrollView keyboardShouldPersistTaps="handled" style={styles.list}>
          {!filtered.length && <Text style={styles.empty}>{items.length ? 'No hay coincidencias. Prueba otro nombre.' : 'No hay opciones disponibles. Revisa el catálogo y tus permisos.'}</Text>}
          {filtered.map(item => <Pressable key={item._id} accessibilityRole="button" disabled={disabled} accessibilityLabel={describe(item)} onPress={() => { onChange(String(item._id)); setOpen(false); }} style={[styles.option, String(item._id) === String(value) && styles.selected]}><Text style={styles.text}>{describe(item)}</Text>{String(item._id) === String(value) && <Text style={styles.chevron}>✓</Text>}</Pressable>)}
        </ScrollView>
        <Pressable accessibilityRole="button" accessibilityLabel={'Cerrar selector ' + label.toLowerCase()} onPress={() => setOpen(false)} style={styles.close}><Text style={styles.chevron}>Volver sin cambiar</Text></Pressable>
      </View></View>
    </Modal>
  </View>;
}
const styles = StyleSheet.create({
  wrapper: { gap: 6 }, label: { fontWeight: '600', color: tokens.colors.text }, text: { color: tokens.colors.text, fontSize: 16 },
  trigger: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, padding: 14, minHeight: 48, borderRadius: 8, borderWidth: 1, borderColor: tokens.colors.border, backgroundColor: tokens.colors.surface },
  chevron: { color: tokens.colors.primary, fontWeight: '600' }, disabled: { opacity: 0.5 },
  overlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  dialog: { width: '100%', maxWidth: 580, maxHeight: '80%', padding: 20, gap: 14, borderRadius: 16, backgroundColor: tokens.colors.surface },
  title: { fontSize: 20, fontWeight: '700', color: tokens.colors.text }, search: { borderWidth: 1, borderColor: tokens.colors.border, borderRadius: 8, padding: 12, fontSize: 16 },
  list: { flexGrow: 0 }, option: { padding: 14, minHeight: 48, borderBottomWidth: 1, borderColor: tokens.colors.border, flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  selected: { backgroundColor: tokens.colors.surfaceVariant }, empty: { padding: 16, color: tokens.colors.textSecondary }, close: { padding: 12, alignItems: 'center', minHeight: 44 }
});
