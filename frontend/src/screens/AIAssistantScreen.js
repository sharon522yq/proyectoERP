import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TextInput, Button, ScrollView, ActivityIndicator, StyleSheet } from 'react-native';
import { aiApi } from '../services/api';

// FASE 12 — Asistente IA (React Native + React Native Web).
// Sin lógica de negocio: solo presenta el historial y delega en la API.
function mapError(err) {
  if (err && err.code === 'ECONNABORTED') return 'Tiempo de espera agotado. Inténtalo de nuevo.';
  const status = err && err.response ? err.response.status : null;
  const data = err && err.response ? err.response.data : null;
  if (status === 401) return 'Sesión expirada. Vuelve a iniciar sesión.';
  if (status === 403) return 'No tienes permiso para usar el asistente IA (se requiere ai.chat).';
  if (status === 429) return (data && data.message) || 'Demasiadas solicitudes. Espera unos minutos.';
  if (status === 501) return 'El asistente IA está deshabilitado en este entorno.';
  if (status === 502 || status === 504) return (data && data.message) || 'El servicio de IA no está disponible ahora mismo.';
  if (data && data.message) return data.message;
  return 'Error de conexión con el servidor.';
}

export default function AIAssistantScreen({ onBack }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollToEnd({ animated: false });
  }, [messages, loading]);

  const send = async () => {
    const question = input.trim();
    if (!question || loading) return;
    setMessages((prev) => [...prev, { role: 'user', text: question }]);
    setInput('');
    setError(null);
    setLoading(true);
    try {
      const data = await aiApi.chat(question);
      setMessages((prev) => [...prev, { role: 'ai', text: data.answer }]);
    } catch (err) {
      setError(mapError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Text style={styles.title}>Asistente IA</Text>
        {onBack ? <Button title="Volver" onPress={onBack} /> : null}
      </View>

      <ScrollView style={styles.chat} ref={scrollRef} contentContainerStyle={styles.chatContent}>
        {messages.length === 0 && !loading ? (
          <Text style={styles.empty}>
            Pregúntale al asistente sobre ventas, inventario, cuentas por cobrar/pagar,
            pedidos, producción, proyectos o personal (según tus permisos).
          </Text>
        ) : null}
        {messages.map((m, i) => (
          <View key={`${m.role}-${i}`} style={[styles.bubble, m.role === 'user' ? styles.userBubble : styles.aiBubble]}>
            <Text style={styles.bubbleRole}>{m.role === 'user' ? 'Tú' : 'IA'}</Text>
            <Text style={styles.bubbleText}>{m.text}</Text>
          </View>
        ))}
        {loading ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" />
            <Text style={styles.loadingText}>Procesando…</Text>
          </View>
        ) : null}
      </ScrollView>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder="Escribe tu pregunta…"
          editable={!loading}
          maxLength={2000}
          onSubmitEditing={send}
          returnKeyType="send"
        />
        <Button title="Enviar" onPress={send} disabled={loading || !input.trim()} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, padding: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  title: { fontSize: 20, fontWeight: '600' },
  chat: { flex: 1, marginBottom: 8 },
  chatContent: { paddingBottom: 8 },
  empty: { color: '#666', fontSize: 14, marginVertical: 12 },
  bubble: { borderRadius: 8, padding: 10, marginVertical: 4, maxWidth: '90%' },
  userBubble: { backgroundColor: '#dbeafe', alignSelf: 'flex-end' },
  aiBubble: { backgroundColor: '#f1f5f9', alignSelf: 'flex-start' },
  bubbleRole: { fontSize: 11, color: '#555', marginBottom: 2, fontWeight: '600' },
  bubbleText: { fontSize: 14 },
  loadingRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 6 },
  loadingText: { marginLeft: 8, color: '#555' },
  error: { color: '#b91c1c', marginBottom: 6, fontSize: 13 },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: {
    flex: 1, borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 6,
    paddingHorizontal: 10, paddingVertical: 8, fontSize: 14
  }
});
