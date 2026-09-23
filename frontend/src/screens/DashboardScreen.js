import React, { useState } from 'react';
import { View, Text, Button, StyleSheet } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { MENU_BY_PERMISSION } from '../constants/config';
import AIAssistantScreen from './AIAssistantScreen';

export default function DashboardScreen() {
  const { user, has, logout } = useAuth();
  const [view, setView] = useState('menu');
  const menu = MENU_BY_PERMISSION.filter((m) => !m.permission || has(m.permission));

  if (view === 'ai') {
    return <AIAssistantScreen onBack={() => setView('menu')} />;
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Hola, {user ? user.name : ''} ({user ? user.role : ''})</Text>
      {menu.map((m) => <Text key={m.label} style={styles.item}>• {m.label}</Text>)}
      {has('ai.chat') ? <Button title="Asistente IA" onPress={() => setView('ai')} /> : null}
      <Button title="Cerrar sesión" onPress={logout} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, padding: 24 },
  title: { fontSize: 20, marginBottom: 12 },
  item: { fontSize: 16, marginVertical: 4 }
});
