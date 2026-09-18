import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../constants/theme';
import { formatNumber } from '../../utils/format';

interface StepperProps {
  value: number;
  max: number;
  onIncrease: () => void;
  onDecrease: () => void;
  loading?: boolean;
}

export default function Stepper({ value, max, onIncrease, onDecrease, loading }: StepperProps) {
  return (
    <View style={styles.container}>
      <TouchableOpacity 
        style={[styles.btn, value >= max && styles.disabled]} 
        onPress={onIncrease} 
        disabled={loading || value >= max}
      >
        <Ionicons name="add" size={18} color={value >= max ? COLORS.disabledText : COLORS.primary} />
      </TouchableOpacity>
      
      <Text style={styles.value}>{formatNumber(value)}</Text>
      
      <TouchableOpacity 
        style={styles.btn} 
        onPress={onDecrease} 
        disabled={loading}
      >
        <Ionicons name={value <= 1 ? "trash-outline" : "remove"} size={18} color={value <= 1 ? COLORS.error : COLORS.primary} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row-reverse', alignItems: 'center', backgroundColor: COLORS.primaryExtraLight, borderRadius: 10, padding: 4, borderWidth: 1, borderColor: COLORS.primaryLight },
  btn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: 8, backgroundColor: '#FFF' },
  disabled: { backgroundColor: COLORS.borderLight },
  value: { minWidth: 30, textAlign: 'center', fontSize: 16, fontWeight: 'bold', color: COLORS.textPrimary }
});
