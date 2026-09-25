import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { tokens } from '../theme/tokens';
import AppWordmark from '../components/branding/AppWordmark';

export default function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!email || !password) {
      setError('Introduce email y contraseña');
      return;
    }
    try {
      setError('');
      setLoading(true);
      await login(email.trim(), password);
    } catch (err) {
      setError((err.response && err.response.data && err.response.data.message) || 'Credenciales inválidas');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.card, tokens.shadows.md]}>
        <View style={styles.brandHeader}>
          <AppWordmark size={48} />
          <Text style={styles.subtitle}>Sistema de Planificación de Recursos Empresariales</Text>
        </View>

        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Correo electrónico</Text>
            <TextInput
              style={styles.input}
              placeholder="admin@test.com"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              editable={!loading}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Contraseña</Text>
            <TextInput
              style={styles.input}
              placeholder="••••••••"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              editable={!loading}
              onSubmitEditing={submit}
            />
          </View>

          {!!error && <Text style={styles.error}>{error}</Text>}

          <TouchableOpacity style={[styles.button, loading && styles.buttonDisabled]} onPress={submit} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Iniciar sesión</Text>}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: tokens.colors.background,
    padding: tokens.spacing.md
  },
  card: {
    backgroundColor: tokens.colors.surface,
    borderRadius: tokens.borderRadius.lg,
    padding: tokens.spacing.xl,
    width: '100%',
    maxWidth: 420,
    borderWidth: 1,
    borderColor: tokens.colors.border
  },
  brandHeader: {
    alignItems: 'center',
    marginBottom: tokens.spacing.lg
  },
  subtitle: {
    fontSize: tokens.typography.sizes.xs,
    color: tokens.colors.textSecondary,
    marginTop: tokens.spacing.xs,
    textAlign: 'center'
  },
  form: {
    gap: tokens.spacing.md
  },
  inputGroup: {
    gap: tokens.spacing.xxs
  },
  label: {
    fontSize: tokens.typography.sizes.sm,
    fontWeight: '600',
    color: tokens.colors.text
  },
  input: {
    borderWidth: 1,
    borderColor: tokens.colors.border,
    borderRadius: tokens.borderRadius.md,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
    fontSize: tokens.typography.sizes.md,
    backgroundColor: tokens.colors.surfaceVariant
  },
  error: {
    color: tokens.colors.error,
    fontSize: tokens.typography.sizes.sm
  },
  button: {
    backgroundColor: tokens.colors.primary,
    borderRadius: tokens.borderRadius.md,
    paddingVertical: tokens.spacing.sm,
    alignItems: 'center',
    marginTop: tokens.spacing.xs
  },
  buttonDisabled: {
    opacity: 0.7
  },
  buttonText: {
    color: '#fff',
    fontSize: tokens.typography.sizes.md,
    fontWeight: '600'
  }
});
