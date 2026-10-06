import { registerRootComponent } from 'expo';
import React from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { useAuth, AuthProvider } from './src/context/AuthContext';
import LoginScreen from './src/screens/LoginScreen';
import DashboardScreen from './src/screens/DashboardScreen';

function Root() {
  const { user, ready } = useAuth();
  if (!ready) return <ActivityIndicator accessibilityLabel="Cargando sesión" />;
  return user ? <DashboardScreen /> : <LoginScreen />;
}

export default function App() {
  return (
    <View style={styles.container}>
      <AuthProvider>
        <Root />
      </AuthProvider>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    height: '100%',
    width: '100%',
    backgroundColor: '#f8fafc'
  }
});

registerRootComponent(App);
