import React from 'react';
import { View, Text, StyleSheet, Button } from 'react-native';
import { tokens } from '../../theme/tokens';

export default function EmptyState({ title = 'No hay registros', description, actionTitle, onAction }) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      {description ? <Text style={styles.description}>{description}</Text> : null}
      {actionTitle && onAction ? <Button title={actionTitle} onPress={onAction} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: tokens.spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colors.surface,
    borderRadius: tokens.borderRadius.lg,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    marginVertical: tokens.spacing.md
  },
  title: {
    fontSize: tokens.typography.sizes.lg,
    fontWeight: '600',
    color: tokens.colors.text,
    marginBottom: tokens.spacing.xxs,
    textAlign: 'center'
  },
  description: {
    fontSize: tokens.typography.sizes.sm,
    color: tokens.colors.textSecondary,
    textAlign: 'center',
    marginBottom: tokens.spacing.md
  }
});
