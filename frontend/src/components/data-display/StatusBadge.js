import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from '../../design/ui';
import { tokens } from '../../theme/tokens';

export default function StatusBadge({ status, type = 'default' }) {
  let bg = tokens.colors.surfaceVariant;
  let fg = tokens.colors.textSecondary;

  const s = String(status || '').toUpperCase();
  if (['ACTIVE', 'APPROVED', 'PAID', 'COMPLETED', 'CONFIRMED', 'SUCCESS'].includes(s)) {
    bg = tokens.colors.successLight;
    fg = tokens.colors.success;
  } else if (['DRAFT', 'PENDING', 'IN_PROGRESS', 'PROCESSING'].includes(s)) {
    bg = tokens.colors.warningLight;
    fg = tokens.colors.warning;
  } else if (['CANCELLED', 'REJECTED', 'FAILED', 'INACTIVE', 'ERROR'].includes(s)) {
    bg = tokens.colors.errorLight;
    fg = tokens.colors.error;
  }

  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[styles.text, { color: fg }]}>{status}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: tokens.borderRadius.full,
    alignSelf: 'flex-start'
  },
  text: {
    fontSize: tokens.typography.sizes.xs,
    fontWeight: '600',
    textTransform: 'uppercase'
  }
});
