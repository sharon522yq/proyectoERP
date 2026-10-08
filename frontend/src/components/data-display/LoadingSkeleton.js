import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';

import { Text } from '../../design/ui';
import { tokens } from '../../theme/tokens';

export default function LoadingSkeleton() {
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={tokens.colors.primary} accessibilityLabel="Cargando datos" /><Text style={{ color: tokens.colors.textSecondary, marginTop: 12 }}>Cargando datos…</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: tokens.spacing.xxl,
    alignItems: 'center',
    justifyContent: 'center'
  }
});
