// app/favorites.tsx
import React from 'react';
import { View, Text, SafeAreaView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

export default function FavoritesScreen() {
    const router = useRouter();
    return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
        <View style={{ height: 56, backgroundColor: '#FFF', flexDirection: 'row-reverse', alignItems: 'center', paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: '#E2E8F0' }}>
        <TouchableOpacity onPress={() => router.back()} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="arrow-forward" size={24} color="#0F172A" />
        </TouchableOpacity>
        <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#0F172A', marginLeft: 12 }}>علاقه‌مندی‌ها</Text>
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
        <Ionicons name="heart-outline" size={80} color="#CBD5E1" />
        <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#0F172A', marginTop: 16, textAlign: 'center' }}>علاقه‌مندی‌ها</Text>
        <Text style={{ fontSize: 13, color: '#64748B', marginTop: 8, textAlign: 'center' }}>محصولات مورد علاقه خود را اینجا مشاهده کنید.</Text>
      </View>
    </SafeAreaView>
  );
}
