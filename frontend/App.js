import { registerRootComponent } from 'expo';
import React from 'react';
import DesignProvider from './src/design/DesignProvider';
import { tokens } from './src/theme/tokens';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { useAuth, AuthProvider } from './src/context/AuthContext';
import LoginScreen from './src/screens/LoginScreen';
import PendingCompanyScreen from './src/screens/PendingCompanyScreen';
import DashboardScreen from './src/screens/DashboardScreen';

function Root() {
  const { user, ready } = useAuth();
  if (!ready) return <ActivityIndicator accessibilityLabel="Cargando sesión" />;
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
