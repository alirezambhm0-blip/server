// app/store-info.tsx
import React from 'react';
import { View, Text, SafeAreaView, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';

export default function StoreInfoScreen() {
  const router = useRouter();
  const { customer } = useAuth();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
      <View style={{ height: 56, backgroundColor: '#FFF', flexDirection: 'row-reverse', alignItems: 'center', paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: '#E2E8F0' }}>
        <TouchableOpacity onPress={() => router.back()} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="arrow-forward" size={24} color="#0F172A" />
        </TouchableOpacity>
        <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#0F172A', marginLeft: 12 }}>اطلاعات فروشگاه</Text>
      </View>
      <ScrollView style={{ flex: 1, padding: 16 }}>
        <View style={{ backgroundColor: '#FFF', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#E2E8F0' }}>
          <InfoRow label="نام فروشگاه" value={customer?.storeName || '—'} />
          <InfoRow label="نوع کسب‌وکار" value={customer?.businessType || '—'} />
          <InfoRow label="استان" value={customer?.province || '—'} />
          <InfoRow label="شهر" value={customer?.city || '—'} />
          <InfoRow label="آدرس" value={customer?.address || '—'} />
          <InfoRow label="کد پستی" value={customer?.postalCode || '—'} />
        </View>
        <Text style={{ fontSize: 12, color: '#64748B', textAlign: 'center', marginTop: 16 }}>برای تغییر این اطلاعات با پشتیبانی تماس بگیرید.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' }}>
      <Text style={{ fontSize: 12, color: '#64748B' }}>{label}</Text>
      <Text style={{ fontSize: 14, fontWeight: '500', color: '#0F172A', maxWidth: '60%', textAlign: 'left' }}>{value}</Text>
    </View>
  );
}
