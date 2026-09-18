// app/edit-address.tsx

import React, { useState } from 'react';
import { View, Text, SafeAreaView, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { notify } from '@/utils/notify';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { profileApi } from '@/api/profileApi';

export default function EditAddressScreen() {
  const router = useRouter();
  const { customer, refreshAuth } = useAuth();
  const [address, setAddress] = useState(customer?.address || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (address.trim().length < 15) {
      notify('خطا', 'آدرس باید حداقل ۱۵ کاراکتر باشد.');
      return;
    }
    setSaving(true);
    try {
      await profileApi.updateAddress(address.trim());
      await refreshAuth();
      notify('موفق', 'آدرس با موفقیت به‌روزرسانی شد');
      router.back();
    } catch (e: any) {
      notify('خطا', e?.message || 'خطا در ذخیره آدرس');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
      <View style={{ height: 56, backgroundColor: '#FFF', flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: '#E2E8F0' }}>
        <View style={{ flexDirection: 'row-reverse', alignItems: 'center' }}>
          <TouchableOpacity onPress={() => router.back()} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="arrow-forward" size={24} color="#0F172A" />
          </TouchableOpacity>
          <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#0F172A', marginLeft: 12 }}>آدرس تحویل</Text>
        </View>
      </View>
      <View style={{ flex: 1, padding: 16 }}>
        <View style={{ backgroundColor: '#DBEAFE', borderRadius: 10, padding: 12, marginBottom: 16, flexDirection: 'row-reverse', alignItems: 'center', gap: 8 }}>
          <Ionicons name="information-circle" size={18} color="#2563EB" />
          <Text style={{ flex: 1, fontSize: 12, color: '#1D4ED8', textAlign: 'right', lineHeight: 18 }}>
            آدرس دقیق فروشگاه خود را وارد کنید. این آدرس برای تحویل سفارش‌ها استفاده می‌شود.
          </Text>
        </View>
        <Text style={{ fontSize: 12, fontWeight: '600', color: '#64748B', marginBottom: 8, textAlign: 'right' }}>آدرس کامل</Text>
        <TextInput
          style={{ minHeight: 120, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10, padding: 12, fontSize: 14, color: '#0F172A', textAlign: 'right', textAlignVertical: 'top' }}
          placeholder="استان، شهر، خیابان، پلاک، طبقه..."
          placeholderTextColor="#94A3B8"
          value={address}
          onChangeText={setAddress}
          multiline
        />
        <TouchableOpacity
          style={{ backgroundColor: '#2563EB', height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 24, opacity: saving ? 0.6 : 1 }}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? <ActivityIndicator color="#FFF" /> : <Text style={{ color: '#FFF', fontSize: 15, fontWeight: 'bold' }}>ذخیره آدرس</Text>}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
