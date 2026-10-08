import React, { useState, useRef, useEffect } from 'react';
import { View, StyleSheet, ActivityIndicator, Platform, useWindowDimensions, KeyboardAvoidingView, BackHandler } from 'react-native';
import { Text, TextInput, TouchableOpacity, ScrollView, Button } from '../design/ui';
import { authApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { tokens } from '../theme/tokens';
import LoginArtwork from '../components/branding/LoginArtwork';
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

  const wide = useWindowDimensions().width >= 1024;
  const [showPassword, setShowPassword] = useState(false);
  useEffect(() => { const subscription = BackHandler.addEventListener('hardwareBackPress', () => { if (mode !== 'login') { switchMode('login'); return true; } return false; }); return () => subscription.remove(); }, [mode]);
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
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}><ScrollView contentContainerStyle={[styles.container, { padding: wide ? 40 : 16 }]} keyboardShouldPersistTaps="handled"><View style={[styles.composition, wide && { flexDirection: 'row' }]}>
      <View style={[styles.card, { width: wide ? '44%' : '100%', padding: wide ? 40 : 24 }]}>
        <View style={styles.brandHeader}>
          <AppWordmark size={48} />
          <Text style={styles.subtitle}>Sistema de Planificación de Recursos Empresariales</Text>
        </View>

        <View style={styles.form}>
          <Text style={[styles.label, { fontSize: 28, lineHeight: 36 }]}>{({ login: 'Iniciar sesión', register: 'Crear cuenta', forgot: 'Recuperar contraseña', reset: 'Restablecer contraseña' })[mode]}</Text>
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
              secureTextEntry={!showPassword}
              editable={!loading}
              onSubmitEditing={submit}
            />
          </View>}
          {mode !== 'forgot' && <TouchableOpacity accessibilityLabel={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'} onPress={() => setShowPassword(!showPassword)}><Text style={{ color: tokens.colors.blueAccent }}>{showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}</Text></TouchableOpacity>}
          {['register', 'reset'].includes(mode) && <View style={styles.inputGroup}>
            <Text style={styles.label}>Confirmar contraseña</Text>
            <TextInput style={styles.input} value={confirmation} onChangeText={setConfirmation} secureTextEntry editable={!loading} onSubmitEditing={submit} />
          </View>}
          {!!message && <Text accessibilityRole="alert" style={styles.label}>{message}</Text>}
          {!!error && <Text style={styles.error}>{error}</Text>}

          <Button title={({ login: 'Iniciar sesión', register: 'Crear cuenta', forgot: 'Enviar enlace', reset: 'Guardar contraseña' })[mode]} loading={loading} disabled={loading} onPress={submit} />
          {(mode === 'login' ? [['register', 'Crear cuenta'], ['forgot', '¿Olvidaste tu contraseña?']] : [['login', 'Volver a iniciar sesión'], ...(mode === 'forgot' ? [['reset', 'Ya tengo un código de recuperación']] : [])]).map(([next, label]) => (
            <TouchableOpacity key={next} onPress={() => switchMode(next)} disabled={loading} accessibilityRole="button">
              <Text style={[styles.label, { color: tokens.colors.blueAccent, textAlign: 'center' }]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
      {wide && <LoginArtwork />}
      </View></ScrollView></KeyboardAvoidingView>
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
  composition: { width: '100%', maxWidth: 1120, borderRadius: 24, overflow: 'hidden', backgroundColor: tokens.colors.surface, borderWidth: 1, borderColor: tokens.colors.border, ...tokens.shadows.md },
  card: {
    backgroundColor: tokens.colors.surface,
    borderRadius: 0,
    padding: tokens.spacing.xl,
    width: '100%',
    maxWidth: 520,
    justifyContent: 'center'
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
