import React, { useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, SafeAreaView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
// P2-6 — قبلاً اینجا یک IP توسعه به‌صورت hardcode بود:
//   const API_URL = 'http://10.75.109.83:3000';
// یعنی دو منبع حقیقت متناقض برای آدرس API وجود داشت: httpClient.ts (که
// EXPO_PUBLIC_API_URL و تشخیص خودکار Expo را رعایت می‌کرد) و این فایل (که هیچ‌کدام
// را رعایت نمی‌کرد). در build پروداکشن این لاگ هرگز به سرور نمی‌رسید.
//
// حالا از همان buildUrl موجود در httpClient استفاده می‌شود — هیچ سیستم
// پیکربندی جدیدی ساخته نشده و URL پروداکشن هم hardcode نشده است.
import { buildUrl } from '@/api/httpClient';

interface Props {
  error: Error;
  resetError: () => void;
}

export const CustomFallback = (props: Props) => {
  
  useEffect(() => {
    // به محض بروز خطا، گزارش آن را به پنل ادمین بفرست
    const sendLog = async () => {
      try {
        await axios.post(buildUrl('/app/log-error'), {
          message: props.error.message,
          stack: props.error.stack,
          deviceInfo: `${Platform.OS} - Version ${Platform.Version}`,
          userId: 'Anonymous' // می‌توان در صورت نیاز ID کاربر را هم فرستاد
        });
        console.log('Error logged to admin panel successfully');
      } catch (e) {
        // اگر اینترنت قطع بود یا سرور در دسترس نبود، نادیده بگیر
      }
    };

    if (props.error) {
      sendLog();
    }
  }, [props.error]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.iconWrapper}>
          <Ionicons name="alert-circle-outline" size={64} color="#EF4444" />
        </View>
        
        <Text style={styles.title}>خطای غیرمنتظره رخ داد</Text>
        <Text style={styles.message}>
          گزارش این خطا برای تیم فنی ارسال شد. لطفاً دوباره تلاش کنید.
        </Text>

        <TouchableOpacity 
          style={styles.button} 
          onPress={props.resetError}
          activeOpacity={0.8}
        >
          <Text style={styles.buttonText}>تلاش مجدد</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  iconWrapper: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#FEE2E2', alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  title: { fontSize: 20, fontWeight: '800', color: '#1E293B', textAlign: 'center', marginBottom: 12 },
  message: { fontSize: 14, color: '#64748B', textAlign: 'center', lineHeight: 22, marginBottom: 32 },
  button: { backgroundColor: '#2563EB', paddingHorizontal: 32, paddingVertical: 14, borderRadius: 12, width: '100%' },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700', textAlign: 'center' },
});