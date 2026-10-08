import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, Button } from '../../design/ui';
import { tokens } from '../../theme/tokens';

export default function ErrorState({ message = 'Ocurrió un error al cargar los datos.', onRetry }) {
  return (
    <View style={styles.container} accessibilityRole="alert">
      <Text style={styles.title}>Error</Text>
      <Text style={styles.message}>{message}</Text>
      {onRetry ? <Button title="Reintentar" onPress={onRetry} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: tokens.spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colors.errorLight,
    borderRadius: tokens.borderRadius.lg,
    borderWidth: 1,
    borderColor: tokens.colors.error,
    marginVertical: tokens.spacing.md
  },
  title: {
    fontSize: tokens.typography.sizes.lg,
    fontWeight: '700',
    color: tokens.colors.error,
    marginBottom: tokens.spacing.xxs
  },
  message: {
    fontSize: tokens.typography.sizes.sm,
    color: tokens.colors.text,
    textAlign: 'center',
    marginBottom: tokens.spacing.md
  }
});
