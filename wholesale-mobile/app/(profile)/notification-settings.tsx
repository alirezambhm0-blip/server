// app/notification-settings.tsx

import React, { useState } from 'react';
import { View, Text, SafeAreaView, TouchableOpacity, Switch, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

const C = { primary: '#2563EB', accent: '#10B981', border: '#E2E8F0', textPrimary: '#0F172A', textSecondary: '#64748B', background: '#F8FAFC', disabled: '#CBD5E1' };

export default function NotificationSettingsScreen() {
  const router = useRouter();
  const [pushEnabled, setPushEnabled] = useState(true);
  const [smsEnabled, setSmsEnabled] = useState(true);
  const [orderUpdates, setOrderUpdates] = useState(true);
  const [promotions, setPromotions] = useState(true);
  const [newProducts, setNewProducts] = useState(true);
  const [systemAnnouncements, setSystemAnnouncements] = useState(true);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.background }}>
      <View style={{ height: 56, backgroundColor: '#FFF', flexDirection: 'row-reverse', alignItems: 'center', paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: C.border }}>
        <TouchableOpacity onPress={() => router.back()} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="arrow-forward" size={24} color={C.textPrimary} />
        </TouchableOpacity>
        <Text style={{ fontSize: 16, fontWeight: 'bold', color: C.textPrimary, marginLeft: 12 }}>تنظیمات اعلان‌ها</Text>
      </View>
      <ScrollView style={{ flex: 1, padding: 16 }}>
        <Text style={{ fontSize: 13, fontWeight: 'bold', color: C.textSecondary, marginBottom: 8 }}>کانال‌های اعلان‌رسانی</Text>
        <View style={{ backgroundColor: '#FFF', borderRadius: 14, borderWidth: 1, borderColor: C.border, overflow: 'hidden' }}>
          <ToggleRow title="اعلان‌های پوش (Push)" subtitle="اعلان‌های داخل اپلیکیشن" value={pushEnabled} onValueChange={setPushEnabled} />
          <ToggleRow title="پیامک (SMS)" subtitle="پیامک به شماره موبایل" value={smsEnabled} onValueChange={setSmsEnabled} last />
        </View>
        <Text style={{ fontSize: 13, fontWeight: 'bold', color: C.textSecondary, marginBottom: 8, marginTop: 20 }}>دسته‌بندی اعلان‌ها</Text>
        <View style={{ backgroundColor: '#FFF', borderRadius: 14, borderWidth: 1, borderColor: C.border, overflow: 'hidden' }}>
          <ToggleRow title="بروزرسانی سفارش‌ها" subtitle="تایید، آماده‌سازی، ارسال، تحویل" value={orderUpdates} onValueChange={setOrderUpdates} />
          <ToggleRow title="تخفیف‌ها و پیشنهادات ویژه" value={promotions} onValueChange={setPromotions} />
          <ToggleRow title="محصولات جدید" value={newProducts} onValueChange={setNewProducts} />
          <ToggleRow title="اطلاعیه‌های سیستم" value={systemAnnouncements} onValueChange={setSystemAnnouncements} last />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function ToggleRow({ title, subtitle, value, onValueChange, last }: {
  title: string; subtitle?: string; value: boolean; onValueChange: (v: boolean) => void; last?: boolean;
}) {
  return (
    <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 14, borderBottomWidth: last ? 0 : 1, borderBottomColor: '#F1F5F9' }}>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 14, fontWeight: '500', color: '#0F172A', textAlign: 'right' }}>{title}</Text>
        {subtitle ? <Text style={{ fontSize: 11, color: '#64748B', marginTop: 2, textAlign: 'right' }}>{subtitle}</Text> : null}
      </View>
      <Switch value={value} onValueChange={onValueChange} trackColor={{ false: '#CBD5E1', true: '#10B981' }} thumbColor="#FFF" />
    </View>
  );
}
