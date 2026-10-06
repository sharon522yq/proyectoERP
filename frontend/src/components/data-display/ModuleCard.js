import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { tokens } from '../../theme/tokens';
import AppLogo from '../branding/AppLogo';

export default function ModuleCard({ title, description, onPress }) {
  return (
    <TouchableOpacity accessibilityRole="button" accessibilityLabel={title} style={[styles.card, tokens.shadows.sm]} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.header}>
        <AppLogo size={36} />
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description} numberOfLines={2}>{description}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: tokens.colors.surface,
    borderRadius: tokens.borderRadius.lg,
    padding: tokens.spacing.md,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    width: 220,
    minHeight: 140,
    justifyContent: 'space-between'
  },
  header: {
    marginBottom: tokens.spacing.xs
  },
  title: {
    fontSize: tokens.typography.sizes.md,
    fontWeight: '600',
    color: tokens.colors.text,
    marginBottom: tokens.spacing.xxs
  },
  description: {
    fontSize: tokens.typography.sizes.sm,
    color: tokens.colors.textSecondary,
    lineHeight: 18
  }
});
