import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { tokens } from '../theme/tokens';

export default function PendingCompanyScreen() {
  const { user, logout } = useAuth();
  const [loading, setLoading] = useState(false);
  const signOut = async () => {
    if (loading) return;
    setLoading(true);
    try { await logout(); } finally { setLoading(false); }
  };
  return <View style={styles.container}><View style={styles.card}>
    <Text style={styles.title}>Tu cuenta está creada</Text>
    <Text style={styles.text}>{user.name}, tu cuenta todavía no tiene una empresa asignada. Contacta al administrador del ERP para que revise tu acceso.</Text>
    <Text style={styles.text}>Después de que se actualice tu cuenta, vuelve a iniciar sesión para cargar tus permisos.</Text>
    <TouchableOpacity style={styles.button} onPress={signOut} disabled={loading} accessibilityRole="button">
      {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Cerrar sesión</Text>}
    </TouchableOpacity>
  </View></View>;
}
const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: tokens.spacing.md, backgroundColor: tokens.colors.background },
  card: { width: '100%', maxWidth: 460, padding: tokens.spacing.xl, borderRadius: tokens.borderRadius.lg, backgroundColor: tokens.colors.surface, gap: tokens.spacing.md },
  title: { fontSize: 22, fontWeight: '600', color: tokens.colors.text },
  text: { fontSize: 16, lineHeight: 24, color: tokens.colors.textSecondary },
  button: { padding: tokens.spacing.md, borderRadius: tokens.borderRadius.md, backgroundColor: tokens.colors.primary, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: '600' }
});
