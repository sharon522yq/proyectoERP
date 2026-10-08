import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from '../../design/ui';
import { tokens } from '../../theme/tokens';

export default function MetricCard({ title, value, subtitle, color = tokens.colors.primary }) {
  return (
    <View style={[styles.card, tokens.shadows.sm]}>
      <Text style={styles.title}>{title}</Text>
      <Text style={[styles.value, { color }]}>{value}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: tokens.colors.surface,
    borderRadius: tokens.borderRadius.lg,
    padding: tokens.spacing.md,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    minWidth: 180, maxWidth: '100%',
    flex: 1
  },
  title: {
    fontSize: tokens.typography.sizes.sm,
    color: tokens.colors.textSecondary,
    marginBottom: tokens.spacing.xxs,
    fontWeight: '500'
  },
  value: {
    fontSize: tokens.typography.sizes.display,
    fontWeight: '700',
    marginBottom: tokens.spacing.xxs
  },
  subtitle: {
    fontSize: tokens.typography.sizes.xs,
    color: tokens.colors.textMuted
  }
});
