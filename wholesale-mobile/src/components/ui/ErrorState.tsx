import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type Props = {
  message?: string;
  onRetry?: () => void;
};

export default function ErrorState({ message = 'مشکلی پیش آمد، دوباره تلاش کنید', onRetry }: Props) {
  return (
    <View style={styles.container}>
      <Ionicons name="cloud-offline-outline" size={64} color="#FCA5A5" />
      <Text style={styles.title}>خطا در دریافت اطلاعات</Text>
      <Text style={styles.message}>{message}</Text>
      {onRetry && (
        <TouchableOpacity style={styles.btn} activeOpacity={0.8} onPress={onRetry}>
          <Ionicons name="refresh-outline" size={18} color="#FFF" />
          <Text style={styles.btnText}>تلاش مجدد</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  title: { fontSize: 18, fontWeight: '800', color: '#B91C1C', marginTop: 16, marginBottom: 8, textAlign: 'center' },
  message: { fontSize: 14, color: '#64748B', textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  btn: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8, backgroundColor: '#2563EB', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 12 },
  btnText: { color: '#FFF', fontSize: 14, fontWeight: '700' }
});
