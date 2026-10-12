import { registerRootComponent } from 'expo';
import React from 'react';
import DesignProvider from './src/design/DesignProvider';
import { tokens } from './src/theme/tokens';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { Text, Button } from './src/design/ui';
import { useAuth, AuthProvider } from './src/context/AuthContext';
import LoginScreen from './src/screens/LoginScreen';
import PendingCompanyScreen from './src/screens/PendingCompanyScreen';
import DashboardScreen from './src/screens/DashboardScreen';

function Root() {
  const { user, ready, sessionError, retrySession, logout } = useAuth();
  if (!ready) return <ActivityIndicator accessibilityLabel="Cargando sesión" />;
  if (sessionError) return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, gap: 16 }}>
    <Text accessibilityRole="alert">{sessionError}</Text>
    <Button title="Reintentar conexión" onPress={retrySession} />
    <Button title="Cerrar sesión" onPress={logout} />
  </View>;
  if (!user) return <LoginScreen />;
  if (!user.companyId && user.role !== 'SUPER_ADMIN') return <PendingCompanyScreen />;
  return <DashboardScreen />;
}

export default function App() {
  return (
    <DesignProvider><View style={styles.container}>
      <AuthProvider>
        <Root />
      </AuthProvider>
    </View></DesignProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    height: '100%',
    width: '100%',
    backgroundColor: tokens.colors.background
  }
});

registerRootComponent(App);
