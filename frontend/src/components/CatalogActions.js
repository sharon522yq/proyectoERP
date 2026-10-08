import { tokens } from '../theme/tokens';
import React, { useRef, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, Button, Modal } from '../design/ui';
export default function CatalogActions({ name, onDelete, onToggle, active = true, onChanged, explanation }) {
  const [action, setAction] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const running = useRef(false);
  const confirm = async () => {
    if (running.current) return;
    running.current = true; setBusy(true); setError('');
    try { await (action === 'delete' ? onDelete() : onToggle()); setAction(null); await onChanged(); }
    catch (e) { setError(e.response?.data?.message || 'No se pudo completar la operación. Intenta nuevamente.'); }
    finally { running.current = false; setBusy(false); }
  };
  const open = value => { setError(''); setAction(value); };
  return <View style={{ gap: 6 }}>
    {onDelete && <Button title="Eliminar" color={tokens.colors.error} onPress={() => open('delete')} />}
    {onToggle && <Button title={active ? 'Desactivar' : 'Activar'} onPress={() => open('toggle')} />}
    <Modal visible={!!action} transparent animationType="fade" onRequestClose={() => { if (!busy) setAction(null); }}>
      <View style={styles.overlay}><View style={styles.dialog}>
        <Text style={{ fontWeight: '700' }}>{action === 'delete' ? 'Eliminar' : active ? 'Desactivar' : 'Activar'}: {name}</Text>
        <Text>{action === 'delete' ? explanation || 'Se retirará del listado. El historial relacionado se conserva.' : 'Cambiará su disponibilidad para nuevas operaciones.'}</Text>
        {!!error && <Text accessibilityRole="alert" style={{ color: tokens.colors.error }}>{error}</Text>}
        <Button title="Cancelar" disabled={busy} onPress={() => setAction(null)} />
        <Button title="Confirmar" disabled={busy} onPress={confirm} />
      </View></View>
    </Modal>
  </View>;
}
const styles = StyleSheet.create({ overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 16 }, dialog: { backgroundColor: tokens.colors.surface, padding: 24, borderRadius: 12, width: '100%', maxWidth: 440, gap: 12 } });
