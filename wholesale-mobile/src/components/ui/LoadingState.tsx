import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';

export function LoadingSpinner() {
  return (
    <View style={styles.center}>
      <Animated.Image 
        source={require('../../../assets/images/react-logo.png')} // Replace with a fast spinner if needed
        style={{ width: 40, height: 40, opacity: 0.5 }} 
      />
    </View>
  );
}

export function SkeletonRow() {
  const anim = useRef(new Animated.Value(0.3)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 0.7, duration: 800, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0.3, duration: 800, useNativeDriver: true })
      ])
    ).start();
  }, [anim]);

  return (
    <Animated.View style={[styles.skeletonRow, { opacity: anim }]}>
      <View style={styles.skeletonSquare} />
      <View style={styles.skeletonTextCol}>
        <View style={styles.skeletonLine1} />
        <View style={styles.skeletonLine2} />
      </View>
    </Animated.View>
  );
}

export default function LoadingState() {
  return (
    <View style={styles.container}>
      <SkeletonRow />
      <SkeletonRow />
      <SkeletonRow />
      <SkeletonRow />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  container: { padding: 16, width: '100%' },
  skeletonRow: { flexDirection: 'row-reverse', backgroundColor: '#fff', padding: 16, borderRadius: 14, marginBottom: 12, borderWidth: 1, borderColor: '#F1F5F9' },
  skeletonSquare: { width: 64, height: 64, borderRadius: 12, backgroundColor: '#E2E8F0', marginLeft: 16 },
  skeletonTextCol: { flex: 1, justifyContent: 'center' },
  skeletonLine1: { height: 16, backgroundColor: '#E2E8F0', borderRadius: 4, width: '70%', marginBottom: 12 },
  skeletonLine2: { height: 12, backgroundColor: '#E2E8F0', borderRadius: 4, width: '40%' }
});
