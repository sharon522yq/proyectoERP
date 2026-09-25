import React, { useState } from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { tokens } from '../../theme/tokens';
import Sidebar from './Sidebar';
import TopBar from './TopBar';

export default function AppShell({ currentRoute, onSelectRoute, children }) {
  const { has } = useAuth();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <View style={styles.container}>
      {isDesktop ? (
        <Sidebar currentRoute={currentRoute} onSelectRoute={onSelectRoute} hasPermission={has} />
      ) : mobileOpen ? (
        <View style={styles.mobileDrawer}>
          <Sidebar
            currentRoute={currentRoute}
            onSelectRoute={onSelectRoute}
            hasPermission={has}
            onCloseMobile={() => setMobileOpen(false)}
          />
        </View>
      ) : null}

      <View style={styles.main}>
        <TopBar
          onToggleMobileMenu={!isDesktop ? () => setMobileOpen(!mobileOpen) : null}
          title={currentRoute.toUpperCase()}
        />
        <View style={styles.content}>{children}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: tokens.colors.background
  },
  mobileDrawer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    zIndex: 100,
    elevation: 10
  },
  main: {
    flex: 1,
    flexDirection: 'column',
    height: '100%'
  },
  content: {
    flex: 1,
    padding: tokens.spacing.lg
  }
});
