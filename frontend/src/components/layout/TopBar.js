import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, useWindowDimensions } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { tokens } from '../../theme/tokens';

export default function TopBar({ onToggleMobileMenu, title }) {
  const { user, logout } = useAuth();
  const compact = useWindowDimensions().width < 640;

  return (
    <View style={[styles.topbar, compact && styles.compact, tokens.shadows.sm]}>
      <View style={styles.left}>
        {onToggleMobileMenu ? (
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Abrir menú de módulos" style={styles.menuButton} onPress={onToggleMobileMenu}>
            <Text style={styles.menuIcon}>☰</Text>
          </TouchableOpacity>
        ) : null}
        <Text numberOfLines={1} style={styles.title}>{title || 'Dashboard'}</Text>
      </View>
      <View style={styles.right}>
        {user ? (
          <View style={styles.userInfo}>
            <Text numberOfLines={1} style={[styles.userName, compact && styles.compactName]}>{user.name}</Text>
            {!compact && <Text style={styles.userRole}>({user.role})</Text>}
          </View>
        ) : null}
        <TouchableOpacity accessibilityRole="button" style={styles.logoutBtn} onPress={logout}>
          <Text style={styles.logoutText}>Salir</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  compact: { paddingHorizontal: 12, gap: 8 },
  compactName: { maxWidth: 100 },
  topbar: {
    height: 64,
    backgroundColor: tokens.colors.surface,
    borderBottomWidth: 1,
    borderColor: tokens.colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: tokens.spacing.lg,
    zIndex: 10
  },
  left: {
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.md
  },
  menuButton: {
    padding: tokens.spacing.xs
  },
  menuIcon: {
    fontSize: 20,
    color: tokens.colors.text
  },
  title: {
    flexShrink: 1,
    fontSize: tokens.typography.sizes.lg,
    fontWeight: '600',
    color: tokens.colors.text
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.md
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.xxs
  },
  userName: {
    fontSize: tokens.typography.sizes.sm,
    fontWeight: '600',
    color: tokens.colors.text
  },
  userRole: {
    fontSize: tokens.typography.sizes.xs,
    color: tokens.colors.textSecondary
  },
  logoutBtn: {
    paddingHorizontal: tokens.spacing.sm,
    paddingVertical: tokens.spacing.xxs,
    borderRadius: tokens.borderRadius.sm,
    backgroundColor: tokens.colors.surfaceVariant
  },
  logoutText: {
    fontSize: tokens.typography.sizes.sm,
    color: tokens.colors.error,
    fontWeight: '600'
  }
});
