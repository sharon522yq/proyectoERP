import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ERP_NAME } from '../../constants/config';
import { tokens } from '../../theme/tokens';
import AppLogo from './AppLogo';

export default function AppWordmark({ size = 32, showName = true }) {
  return (
    <View style={styles.container}>
      <AppLogo size={size} />
      {showName ? <Text style={[styles.title, { fontSize: size * 0.55 }]}>{ERP_NAME}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.xs,
    backgroundColor: '#f8fafc', padding: 8, borderRadius: 12, alignSelf: 'flex-start'
  },
  title: {
    fontWeight: '700',
    color: '#0f172a',
    letterSpacing: -0.5
  }
});
