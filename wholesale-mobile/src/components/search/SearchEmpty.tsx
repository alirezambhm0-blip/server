import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { notify } from '@/utils/notify';
import { Ionicons } from '@expo/vector-icons';

interface SearchEmptyProps {
  query: string;
  onViewAll: () => void;
}

export const SearchEmpty: React.FC<SearchEmptyProps> = ({
  query,
  onViewAll,
}) => {
  return (
    <View style={styles.container}>
      <Ionicons name="search-outline" size={72} color="#CBD5E1" />
      <Text style={styles.title}>نتیجه‌ای یافت نشد</Text>
      <Text style={styles.sub}>
        محصولی با عبارت «{query}» پیدا نشد. عبارت دیگری را امتحان کنید.
      </Text>
      
      <View style={styles.actions}>
        <TouchableOpacity style={styles.recoveryBtn} onPress={onViewAll}>
          <Text style={styles.recoveryBtnText}>مشاهده همه محصولات</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.supportBtn} 
          onPress={() => notify("پشتیبانی", "درخواست شما ثبت شد.")}
        >
          <Text style={styles.supportBtnText}>درخواست این محصول از پشتیبانی</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  title: { fontSize: 17, fontWeight: 'bold', color: '#0F172A', marginTop: 16 },
  sub: { fontSize: 13, color: '#64748B', textAlign: 'center', marginTop: 8 },
  actions: { width: '100%', marginTop: 24, gap: 10 },
  recoveryBtn: { 
    height: 48, 
    borderRadius: 12, 
    borderWidth: 1, 
    borderColor: '#2563EB', 
    alignItems: 'center', 
    justifyContent: 'center' 
  },
  recoveryBtnText: { color: '#2563EB', fontWeight: 'bold' },
  supportBtn: { marginTop: 8, alignItems: 'center' },
  supportBtnText: { fontSize: 13, color: '#64748B', fontWeight: '500' },
});
