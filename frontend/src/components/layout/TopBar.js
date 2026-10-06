import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { tokens } from '../../theme/tokens';

export default function TopBar({ onToggleMobileMenu, title }) {
  const { user, logout } = useAuth();

  return (
    <View style={[styles.topbar, tokens.shadows.sm]}>
      <View style={styles.left}>
        {onToggleMobileMenu ? (
          <TouchableOpacity style={styles.menuButton} onPress={onToggleMobileMenu}>
            <Text style={styles.menuIcon}>☰</Text>
          </TouchableOpacity>
        ) : null}
        <Text style={styles.title}>{title || 'Dashboard'}</Text>
      </View>
      <View style={styles.right}>
        {user ? (
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{user.name}</Text>
            <Text style={styles.userRole}>({user.role})</Text>
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
