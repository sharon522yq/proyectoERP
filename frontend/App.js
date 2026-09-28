import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useAuth, AuthProvider } from './src/context/AuthContext';
import LoginScreen from './src/screens/LoginScreen';
import DashboardScreen from './src/screens/DashboardScreen';

function Root() {
  const { user } = useAuth();
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
