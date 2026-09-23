import React, { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet } from 'react-native';
import { useAuth } from '../context/AuthContext';

export default function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const submit = async () => {
    try { setError(''); await login(email, password); }
    catch { setError('Credenciales inválidas'); }
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>ERP — Iniciar sesión</Text>
      <TextInput style={styles.input} placeholder="Email" value={email} onChangeText={setEmail} autoCapitalize="none" />
      <TextInput style={styles.input} placeholder="Contraseña" value={password} onChangeText={setPassword} secureTextEntry />
      {!!error && <Text style={styles.error}>{error}</Text>}
      <Button title="Entrar" onPress={submit} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: 'center', padding: 24, maxWidth: 480, width: '100%', alignSelf: 'center' },
  title: { fontSize: 22, marginBottom: 16 },
  input: { borderWidth: 1, borderColor: '#ccc', padding: 10, marginBottom: 12, borderRadius: 6 },
  error: { color: 'red', marginBottom: 12 }
});
