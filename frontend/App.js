import { registerRootComponent } from 'expo';
import React, { useState, useEffect } from 'react';
import DesignProvider from './src/design/DesignProvider';
import { tokens } from './src/theme/tokens';
import { View, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import { Text, Button } from './src/design/ui';
import { useAuth, AuthProvider } from './src/context/AuthContext';
import LoginScreen from './src/screens/LoginScreen';
import PendingCompanyScreen from './src/screens/PendingCompanyScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import CommercialScreen from './src/screens/CommercialScreen';
import CompanySelectionScreen from './src/screens/CompanySelectionScreen';

const routeFromHash = () => Platform.OS === 'web' && typeof window !== 'undefined' && window.location ? window.location.hash.slice(1).split('?')[0] : '';
const commercialRoutes = ['home', 'register', 'subscription', 'new-contract', 'verify', 'invite', 'forgot', 'reset', 'legal', 'cancel'];

function Root() {
  const { user, ready, sessionError, retrySession, logout } = useAuth();
  const [screen, setScreen] = useState(routeFromHash);
  const go = route => { setScreen(route); if (Platform.OS === 'web' && typeof window !== 'undefined') window.location.hash = route; };
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const update = () => setScreen(routeFromHash());
    window.addEventListener('hashchange', update);
    return () => window.removeEventListener('hashchange', update);
  }, []);
  if (!ready) return <ActivityIndicator accessibilityLabel="Cargando sesión" />;
  if (sessionError) return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, gap: 16 }}>
    <Text accessibilityRole="alert">{sessionError}</Text>
    <Button title="Reintentar conexión" onPress={retrySession} />
    <Button title="Cerrar sesión" onPress={logout} />
  </View>;
  if (commercialRoutes.includes(screen)) return <CommercialScreen initialRoute={screen} onLogin={() => go('login')} onDashboard={() => go('dashboard')} />;
  if (!user) return <LoginScreen onAbout={() => go('home')} />;
  if (screen === 'companies') return <CompanySelectionScreen onSelected={() => go('dashboard')} onCommercial={() => go('subscription')} />;
  if (user.commercialAccount && !user.companyId) return <CommercialScreen initialRoute="subscription" onLogin={() => go('login')} onDashboard={() => go('companies')} />;
  if (!user.companyId && user.role !== 'SUPER_ADMIN') return <PendingCompanyScreen />;
  return <View style={{ flex: 1 }}>
    {user.companyId && user.role !== 'SUPER_ADMIN' && <View style={{ flexDirection: 'row', gap: 12, padding: 12 }}>
      <Button title="Mis empresas" onPress={() => go('companies')} />
      {user.commercialAccount && <Button title="Mi suscripción" onPress={() => go('subscription')} />}
    </View>}
    <DashboardScreen key={user.companyId || 'global'} />
  </View>;
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
