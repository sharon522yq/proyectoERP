import React from 'react';
import { useAuth, AuthProvider } from './src/context/AuthContext';
import LoginScreen from './src/screens/LoginScreen';
import DashboardScreen from './src/screens/DashboardScreen';

function Root() {
  const { user } = useAuth();
  return user ? <DashboardScreen /> : <LoginScreen />;
}

export default function App() {
  return <AuthProvider><Root /></AuthProvider>;
}
