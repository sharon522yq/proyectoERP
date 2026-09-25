import React from 'react';
import { View, Text, StyleSheet, Button } from 'react-native';
import { tokens } from '../../theme/tokens';

export default function PageHeader({ title, subtitle, actionTitle, onAction }) {
  return (
    <View style={styles.header}>
      <View>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {actionTitle && onAction ? <Button title={actionTitle} onPress={onAction} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: tokens.spacing.lg
  },
  title: {
    fontSize: tokens.typography.sizes.xl,
    fontWeight: '700',
    color: tokens.colors.text
  },
  subtitle: {
    fontSize: tokens.typography.sizes.sm,
    color: tokens.colors.textSecondary,
    marginTop: 2
  }
});
