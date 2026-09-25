import React from 'react';
import { View, StyleSheet } from 'react-native';
import { tokens } from '../../theme/tokens';

export default function AppLogo({ size = 32 }) {
  return (
    <View style={[styles.container, { width: size, height: size, borderRadius: size / 4 }]}>
      {/* Node graph representation in clean geometric shapes / SVG style */}
      <View style={[styles.node, styles.nodeTop]} />
      <View style={[styles.node, styles.nodeLeft]} />
      <View style={[styles.node, styles.nodeRight]} />
      <View style={[styles.node, styles.nodeBottom]} />
      <View style={styles.line1} />
      <View style={styles.line2} />
      <View style={styles.line3} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: tokens.colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden'
  },
  node: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: tokens.colors.primary
  },
  nodeTop: { top: 6, left: 13 },
  nodeLeft: { top: 16, left: 6 },
  nodeRight: { top: 16, right: 6 },
  nodeBottom: { bottom: 6, left: 13 },
  line1: {
    position: 'absolute',
    width: 14,
    height: 2,
    backgroundColor: tokens.colors.primary,
    top: 10,
    left: 9,
    transform: [{ rotate: '45deg' }]
  },
  line2: {
    position: 'absolute',
    width: 14,
    height: 2,
    backgroundColor: tokens.colors.primary,
    top: 10,
    right: 9,
    transform: [{ rotate: '-45deg' }]
  },
  line3: {
    position: 'absolute',
    width: 14,
    height: 2,
    backgroundColor: tokens.colors.primary,
    bottom: 10,
    left: 9,
    transform: [{ rotate: '-45deg' }]
  }
});
