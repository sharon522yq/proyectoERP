import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView } from 'react-native';
import { authApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { tokens } from '../theme/tokens';
import AppWordmark from '../components/branding/AppWordmark';

export default function LoginScreen() {
  const { login } = useAuth();
  const initialToken = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('resetToken') || '' : '';
  const [mode, setMode] = useState(initialToken ? 'reset' : 'login');
  const [setupAvailable, setSetupAvailable] = useState(false);
  const [companyName, setCompanyName] = useState('');
  const [setupCode, setSetupCode] = useState('');
  useEffect(() => { authApi.setupStatus().then(r => setSetupAvailable(r.available)).catch(() => {}); }, []);
  const [name, setName] = useState('');
  const [token, setToken] = useState(initialToken);
  const [confirmation, setConfirmation] = useState('');
  const [message, setMessage] = useState('');
  const switchMode = (next) => { setMode(next); setError(''); setMessage(''); setPassword(''); setConfirmation(''); };
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (loading) return;
    if (mode !== 'reset' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Introduce un correo electrónico válido'); return;
    }
    if (mode !== 'forgot' && !password) { setError('Introduce tu contraseña'); return; }
    if (['register', 'setup'].includes(mode) && name.trim().length < 2) { setError('Introduce tu nombre completo'); return; }
    if (['register', 'reset', 'setup'].includes(mode) && (password.length < 8 || password.length > 100 || password !== confirmation)) {
      setError('La contraseña debe tener entre 8 y 100 caracteres y coincidir con la confirmación'); return;
    }
    if (mode === 'reset' && !token.trim()) { setError('Introduce el código del enlace de recuperación'); return; }
    try {
      setError(''); setMessage(''); setLoading(true);
      if (mode === 'setup') {
        await authApi.setup({ name: name.trim(), email: email.trim(), password, companyName: companyName.trim() }, setupCode.trim());
        setSetupAvailable(false); await login(email.trim(), password);
      } else if (mode === 'login') await login(email.trim(), password);
      else if (mode === 'register') {
        await authApi.register({ name: name.trim(), email: email.trim(), password });
        await login(email.trim(), password);
      } else if (mode === 'forgot') {
        await authApi.forgotPassword(email.trim());
        setMessage('Si el correo corresponde a una cuenta activa, recibirás un enlace válido durante una hora. Revisa también spam.');
      } else {
        await authApi.resetPassword(token.trim(), password);
        switchMode('login'); setToken('');
        if (typeof window !== 'undefined') {
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
          {mode === 'setup' && <>
            <Text style={styles.label}>Empresa</Text>
            <TextInput style={styles.input} value={companyName} onChangeText={setCompanyName} editable={!loading} />
            <Text style={styles.label}>Código de configuración proporcionado por el responsable</Text>
            <TextInput style={styles.input} value={setupCode} onChangeText={setSetupCode} secureTextEntry editable={!loading} />
          </>}
          <Text style={styles.label}>{({ setup: 'Configurar empresa y administrador', login: 'Iniciar sesión', register: 'Crear cuenta', forgot: 'Recuperar contraseña', reset: 'Restablecer contraseña' })[mode]}</Text>
          {['register', 'setup'].includes(mode) && <View style={styles.inputGroup}>
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
              placeholder="tu@correo.com"
              value={email}
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
              placeholder="••••••••"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              editable={!loading}
              onSubmitEditing={submit}
            />
          </View>}
          {['register', 'reset', 'setup'].includes(mode) && <View style={styles.inputGroup}>
            <Text style={styles.label}>Confirmar contraseña</Text>
            <TextInput style={styles.input} value={confirmation} onChangeText={setConfirmation} secureTextEntry editable={!loading} onSubmitEditing={submit} />
          </View>}
          {!!message && <Text accessibilityRole="alert" style={styles.label}>{message}</Text>}
          {!!error && <Text style={styles.error}>{error}</Text>}

          <TouchableOpacity style={[styles.button, loading && styles.buttonDisabled]} onPress={submit} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{({ setup: 'Configurar empresa y administrador', login: 'Iniciar sesión', register: 'Crear cuenta', forgot: 'Enviar enlace', reset: 'Guardar contraseña' })[mode]}</Text>}
          </TouchableOpacity>
          {(mode === 'login' ? [['register', 'Crear cuenta'], ['forgot', '¿Olvidaste tu contraseña?'], ...(setupAvailable ? [['setup', 'Configurar primera empresa']] : [])] : [['login', 'Volver a iniciar sesión'], ...(mode === 'forgot' ? [['reset', 'Ya tengo un código de recuperación']] : [])]).map(([next, label]) => (
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
