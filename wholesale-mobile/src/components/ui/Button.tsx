import React from 'react';
import { TouchableOpacity, Text, ActivityIndicator, StyleSheet, ViewStyle } from 'react-native';
import { COLORS } from '../../constants/theme';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'accent' | 'danger';
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
}

export default function Button({ title, onPress, variant = 'primary', loading, disabled, style }: ButtonProps) {
  const getStyles = () => {
    switch (variant) {
      case 'secondary': return styles.secondary;
      case 'accent': return styles.accent;
      case 'danger': return styles.danger;
      default: return styles.primary;
    }
  };

  return (
    <TouchableOpacity 
      style={[styles.base, getStyles(), (disabled || loading) && styles.disabled, style]} 
      onPress={onPress} 
      disabled={disabled || loading}
    >
      {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.text}>{title}</Text>}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: { height: 50, borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  primary: { backgroundColor: COLORS.primary },
  secondary: { backgroundColor: 'transparent', borderWidth: 1, borderColor: COLORS.primary },
  accent: { backgroundColor: COLORS.accent },
  danger: { backgroundColor: COLORS.error },
  disabled: { backgroundColor: COLORS.disabled },
  text: { color: '#FFF', fontSize: 15, fontWeight: 'bold' }
});
