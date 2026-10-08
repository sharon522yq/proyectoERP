import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, Button } from '../../design/ui';
import { tokens } from '../../theme/tokens';

export default function PageHeader({ title, subtitle, actionTitle, onAction }) {
  return (
    <View style={styles.header}>
      <View style={styles.content}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {actionTitle && onAction ? <Button title={actionTitle} onPress={onAction} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1, minWidth: 220 },
  header: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.spacing.md,
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: tokens.spacing.lg
  },
  title: {
    fontSize: tokens.typography.sizes.display,
    fontWeight: '700',
    color: tokens.colors.text
  },
  subtitle: {
    fontSize: tokens.typography.sizes.sm,
    color: tokens.colors.textSecondary,
    marginTop: 2
  }
});
