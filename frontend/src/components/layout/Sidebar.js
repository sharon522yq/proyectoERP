import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { MENU_BY_PERMISSION } from '../../constants/config';
import { tokens } from '../../theme/tokens';
import AppWordmark from '../branding/AppWordmark';

export default function Sidebar({ currentRoute, onSelectRoute, hasPermission, onCloseMobile, visibleRoutes }) {
  const menu = MENU_BY_PERMISSION.filter((m) => (!m.permission || hasPermission(m.permission)) && (!visibleRoutes || visibleRoutes.includes(m.route)));

  return (
    <View style={styles.sidebar}>
      <View style={styles.brandContainer}>
        <AppWordmark size={32} />
      </View>
      <ScrollView contentContainerStyle={styles.menuList}>
        {menu.map((item) => {
          const isActive = currentRoute === item.route;
          return (
            <TouchableOpacity
              key={item.route}
              style={[styles.menuItem, isActive && styles.menuItemActive]}
              onPress={() => {
                onSelectRoute(item.route);
                if (onCloseMobile) onCloseMobile();
              }}
            >
              <Text style={[styles.menuText, isActive && styles.menuTextActive]}>{item.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  sidebar: {
    width: 260,
    backgroundColor: tokens.colors.surface,
    borderRightWidth: 1,
    borderColor: tokens.colors.border,
    height: '100%',
    paddingVertical: tokens.spacing.md
  },
  brandContainer: {
    paddingHorizontal: tokens.spacing.lg,
    marginBottom: tokens.spacing.lg
  },
  menuList: {
    paddingHorizontal: tokens.spacing.sm,
    gap: tokens.spacing.xxs
  },
  menuItem: {
    paddingVertical: tokens.spacing.sm,
    paddingHorizontal: tokens.spacing.md,
    borderRadius: tokens.borderRadius.md
  },
  menuItemActive: {
    backgroundColor: tokens.colors.primaryLight
  },
  menuText: {
    fontSize: tokens.typography.sizes.sm,
    color: tokens.colors.textSecondary,
    fontWeight: '500'
  },
  menuTextActive: {
    color: tokens.colors.primary,
    fontWeight: '600'
  }
});
