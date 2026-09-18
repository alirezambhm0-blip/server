import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { Ionicons } from '@expo/vector-icons';

const OfflineBanner = () => {
  const [isOffline, setIsOffline] = useState(false);
  const [animation] = useState(new Animated.Value(0));

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      const offline = state.isConnected === false;
      setIsOffline(offline);
      
      Animated.timing(animation, {
        toValue: offline ? 1 : 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    });

    return () => unsubscribe();
  }, []);

  if (!isOffline) return null;

  return (
    <Animated.View style={[styles.container, {
      opacity: animation,
      transform: [{
        translateY: animation.interpolate({
          inputRange: [0, 1],
          outputRange: [-50, 0]
        })
      }]
    }]}>
      <Ionicons name="cloud-offline-outline" size={20} color="#FFFFFF" />
      <Text style={styles.text}>شما به اینترنت متصل نیستید</Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#EF4444',
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    gap: 8,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
  },
  text: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'right',
  },
});

export default OfflineBanner;
