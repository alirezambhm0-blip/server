// app/orders/success.tsx
// صفحه موفقیت ثبت سفارش

import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { formatPrice } from '@/utils/format';

const C = {
  primary: '#2563EB',
  primaryDark: '#1D4ED8',
  primaryLight: '#DBEAFE',
  accent: '#10B981',
  accentLight: '#D1FAE5',
  background: '#F8FAFC',
  textPrimary: '#0F172A',
  textSecondary: '#64748B',
  warning: '#F59E0B',
  warningLight: '#FEF3C7',
  warningText: '#92400E',
  border: '#E2E8F0',
};

const fa = (n: number | string) => String(n).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]);

export default function OrderSuccessScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ orderId?: string; orderNumber?: string }>();
  const orderNumber = params.orderNumber || '—';

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.content}>
        {/* Success icon */}
        <View style={styles.iconCircle}>
          <Ionicons name="checkmark" size={48} color="#FFF" />
        </View>

        <Text style={styles.title}>سفارش شما با موفقیت ثبت شد</Text>
        <Text style={styles.orderNumber}>شماره سفارش: {fa(orderNumber)}</Text>

        {/* Info card */}
        <View style={styles.infoCard}>
          <Ionicons name="information-circle-outline" size={20} color={C.primaryDark} />
          <Text style={styles.infoText}>
            سفارش شما در انتظار بررسی و تایید توسط تیم ماست. پس از تایید، برای هماهنگی ارسال با شما تماس گرفته می‌شود.
          </Text>
        </View>

        {/* Payment reminder */}
        <View style={styles.paymentCard}>
          <Ionicons name="cash-outline" size={20} color={C.warningText} />
          <Text style={styles.paymentText}>
            پرداخت هنگام تحویل کالا انجام می‌شود.
          </Text>
        </View>

        {/* Buttons */}
        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={() => router.push({ pathname: '/orders/[id]', params: { id: params.orderId || '' } })}
        >
          <Text style={styles.primaryBtnText}>پیگیری سفارش</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.outlineBtn}
          onPress={() => router.replace('/(tabs)/home')}
        >
          <Text style={styles.outlineBtnText}>بازگشت به خانه</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F8FAFC' },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  iconCircle: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: '#10B981',
    alignItems: 'center', justifyContent: 'center',
  },
  title: { fontSize: 18, fontWeight: 'bold', color: '#0F172A', marginTop: 20, textAlign: 'center' },
  orderNumber: { fontSize: 14, color: '#64748B', marginTop: 8 },
  infoCard: {
    flexDirection: 'row-reverse', alignItems: 'flex-start', gap: 10,
    backgroundColor: '#DBEAFE', borderRadius: 12, padding: 16, marginTop: 24, width: '100%',
  },
  infoText: { flex: 1, fontSize: 13, color: '#1D4ED8', lineHeight: 20, textAlign: 'right' },
  paymentCard: {
    flexDirection: 'row-reverse', alignItems: 'center', gap: 10,
    backgroundColor: '#FEF3C7', borderRadius: 12, padding: 14, marginTop: 12, width: '100%',
  },
  paymentText: { flex: 1, fontSize: 12, color: '#92400E', textAlign: 'right' },
  primaryBtn: {
    backgroundColor: '#2563EB', height: 48, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center', marginTop: 32, width: '100%',
  },
  primaryBtnText: { color: '#FFF', fontSize: 15, fontWeight: 'bold' },
  outlineBtn: {
    height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: '#2563EB', marginTop: 12, width: '100%',
  },
  outlineBtnText: { color: '#2563EB', fontSize: 15, fontWeight: 'bold' },
});
