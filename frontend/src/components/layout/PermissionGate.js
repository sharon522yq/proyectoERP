import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from '../../design/ui';
import { useAuth } from '../../context/AuthContext';
import { tokens } from '../../theme/tokens';

export default function PermissionGate({ permission, children }) {
  const { has } = useAuth();

  if (permission && !has(permission)) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Acceso Restringido</Text>
        <Text style={styles.text}>No tienes permisos suficientes ({permission}) para ver este contenido.</Text>
      </View>
    );
  }

  return children;
}

const styles = StyleSheet.create({
  container: {
    padding: tokens.spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colors.surfaceVariant,
    borderRadius: tokens.borderRadius.lg,
    marginVertical: tokens.spacing.lg
  },
  title: {
    fontSize: tokens.typography.sizes.lg,
    fontWeight: '700',
    color: tokens.colors.error,
    marginBottom: tokens.spacing.xs
  },
  text: {
    fontSize: tokens.typography.sizes.sm,
    color: tokens.colors.textSecondary,
    textAlign: 'center'
  }
});
