import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { tokens } from '../../theme/tokens';

export default function LoadingSkeleton() {
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={tokens.colors.primary} />
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
