import React, { useState, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView, Platform } from 'react-native';
import { authApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { tokens } from '../theme/tokens';
import AppWordmark from '../components/branding/AppWordmark';

export default function LoginScreen() {
  const { login, register } = useAuth();
  const initialToken = Platform.OS === 'web' && typeof window !== 'undefined' && window.location ? new URLSearchParams(window.location.search).get('resetToken') || '' : '';
  const [mode, setMode] = useState(initialToken ? 'reset' : 'login');
  const [name, setName] = useState('');
  const [token, setToken] = useState(initialToken);
  const [confirmation, setConfirmation] = useState('');
  const [message, setMessage] = useState('');
  const switchMode = (next) => { setMode(next); setError(''); setMessage(''); setPassword(''); setConfirmation(''); };
  const emailInput = useRef(null);
  const passwordInput = useRef(null);
  const [emailState, setEmail] = useState('');
  const [passwordState, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (loading) return;
    const email = typeof emailInput.current?.value === 'string' ? emailInput.current.value : emailState;
    const password = typeof passwordInput.current?.value === 'string' ? passwordInput.current.value : passwordState;
    if (mode !== 'reset' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Introduce un correo electrónico válido'); return;
    }
    if (mode !== 'forgot' && !password) { setError('Introduce tu contraseña'); return; }
    if (['register'].includes(mode) && name.trim().length < 2) { setError('Introduce tu nombre completo'); return; }
    if (['register', 'reset'].includes(mode) && (password.length < 8 || new TextEncoder().encode(password).length > 72 || password !== confirmation)) {
      setError('La contraseña debe tener al menos 8 caracteres, máximo 72 bytes y coincidir con la confirmación'); return;
    }
    if (mode === 'reset' && !token.trim()) { setError('Introduce el código del enlace de recuperación'); return; }
    try {
      setError(''); setMessage(''); setLoading(true);
      if (mode === 'login') await login(email.trim(), password);
      else if (mode === 'register') {
        await register({ name: name.trim(), email: email.trim(), password });
      } else if (mode === 'forgot') {
        await authApi.forgotPassword(email.trim());
        setMessage('Si el correo corresponde a una cuenta activa, recibirás un enlace válido durante una hora. Revisa también spam.');
      } else {
        await authApi.resetPassword(token.trim(), password);
        switchMode('login'); setToken('');
        if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location && window.history) {
          const url = new URL(window.location.href); url.searchParams.delete('resetToken');
          window.history.replaceState(null, '', url.toString());
        }
        setMessage('Contraseña actualizada. Ya puedes iniciar sesión.');
      }
    } catch (err) {
      setError((err.response && err.response.data && err.response.data.message) || 'No se pudo completar la solicitud. Revisa tu conexión e inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <View style={[styles.card, tokens.shadows.md]}>
        <View style={styles.brandHeader}>
          <AppWordmark size={48} />
          <Text style={styles.subtitle}>Sistema de Planificación de Recursos Empresariales</Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.label}>{({ login: 'Iniciar sesión', register: 'Crear cuenta', forgot: 'Recuperar contraseña', reset: 'Restablecer contraseña' })[mode]}</Text>
          {['register'].includes(mode) && <View style={styles.inputGroup}>
            <Text style={styles.label}>Nombre completo</Text>
            <TextInput style={styles.input} value={name} onChangeText={setName} maxLength={120} editable={!loading} />
          </View>}
          {mode === 'reset' && <View style={styles.inputGroup}>
            <Text style={styles.label}>Código de recuperación</Text>
            <TextInput style={styles.input} value={token} onChangeText={setToken} autoCapitalize="none" editable={!loading} />
          </View>}
          {mode !== 'reset' && <>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Correo electrónico</Text>
            <TextInput
              style={styles.input}
              ref={emailInput}
              accessibilityLabel="Correo electrónico"
              autoComplete="username"
              placeholder="Tu correo"
              value={emailState}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              editable={!loading}
            />
          </View>

          </>}
          {mode !== 'forgot' && <View style={styles.inputGroup}>
            <Text style={styles.label}>{mode === 'reset' ? 'Nueva contraseña' : 'Contraseña'}</Text>
            <TextInput
              style={styles.input}
              ref={passwordInput}
              accessibilityLabel="Contraseña"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              placeholder="••••••••"
              value={passwordState}
              onChangeText={setPassword}
              secureTextEntry
              editable={!loading}
              onSubmitEditing={submit}
            />
          </View>}
          {['register', 'reset'].includes(mode) && <View style={styles.inputGroup}>
            <Text style={styles.label}>Confirmar contraseña</Text>
            <TextInput style={styles.input} value={confirmation} onChangeText={setConfirmation} secureTextEntry editable={!loading} onSubmitEditing={submit} />
          </View>}
          {!!message && <Text accessibilityRole="alert" style={styles.label}>{message}</Text>}
          {!!error && <Text style={styles.error}>{error}</Text>}

          <TouchableOpacity accessibilityRole="button" style={[styles.button, loading && styles.buttonDisabled]} onPress={submit} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{({ login: 'Iniciar sesión', register: 'Crear cuenta', forgot: 'Enviar enlace', reset: 'Guardar contraseña' })[mode]}</Text>}
          </TouchableOpacity>
          {(mode === 'login' ? [['register', 'Crear cuenta'], ['forgot', '¿Olvidaste tu contraseña?']] : [['login', 'Volver a iniciar sesión'], ...(mode === 'forgot' ? [['reset', 'Ya tengo un código de recuperación']] : [])]).map(([next, label]) => (
            <TouchableOpacity key={next} onPress={() => switchMode(next)} disabled={loading} accessibilityRole="button">
              <Text style={[styles.label, { color: tokens.colors.primary, textAlign: 'center' }]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
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
