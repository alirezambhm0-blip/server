import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Image,
} from 'react-native';
import { notify } from '@/utils/notify';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { notificationsApi } from '@/api/notificationsApi';
import { useAuth } from '@/context/AuthContext';
import Skeleton from '@/components/ui/Skeleton';

const COLORS = {
  primary: '#2563EB',
  background: '#F8FAFC',
  textPrimary: '#0F172A',
  textSecondary: '#64748B',
  border: '#E2E8F0',
  error: '#EF4444',
  success: '#16A34A',
};

export default function NotificationsScreen() {
  const router = useRouter();
  const { isLoggedIn } = useAuth();
  
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeCategory, setActiveCategory] = useState("all");
  const [counts, setCounts] = useState<any>({ all: 0 });

  const loadNotifications = useCallback(async (cat = activeCategory) => {
    if (!isLoggedIn) return;
    setLoading(true);
    try {
      const res = await notificationsApi.getMyNotifications(1, 50); // simplified pagination
      setNotifications(res.data);
      setCounts(res.counts_by_category);
    } catch (e) {
      console.warn('Failed to load notifications', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isLoggedIn, activeCategory]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const onRefresh = () => {
    setRefreshing(true);
    loadNotifications();
  };

  const markAsRead = async (id: string, deepLink: any) => {
    try {
      await notificationsApi.markAsRead(id);
      // Local update
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
      
      // Handle deep link
      if (deepLink && deepLink.screen) {
          if (deepLink.screen === 'order_detail') {
              router.push({ pathname: "/orders/[id]", params: { id: deepLink.params.order_id } });
          } else if (deepLink.screen === 'products_list') {
              router.push("/(tabs)/browse");
          }
          // add more as needed
      }
    } catch (e) {}
  };

  const handleReadAll = async () => {
      try {
          await notificationsApi.markReadAll();
          loadNotifications();
          notify("اعلان‌ها", "تمامی پیام‌ها به عنوان خوانده شده علامت‌گذاری شدند.");
      } catch (e) {}
  };

  if (!isLoggedIn) return (
      <SafeAreaView style={styles.safeArea}>
          <View style={styles.emptyContainer}>
              <Ionicons name="notifications-off-outline" size={64} color="#CBD5E1" />
              <Text style={styles.emptyTitle}>برای مشاهده اعلان‌ها وارد شوید</Text>
              <TouchableOpacity style={styles.loginBtn} onPress={() => router.push("/(auth)/login")}>
                  <Text style={styles.loginBtnText}>ورود / ثبت‌نام</Text>
              </TouchableOpacity>
          </View>
      </SafeAreaView>
  );

  const categories = [
      { id: 'all', label: 'همه' },
      { id: 'order', label: 'سفارش‌ها' },
      { id: 'promotion', label: 'تخفیف‌ها' },
      { id: 'account', label: 'حساب کاربری' }
  ];

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-forward" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>اعلان‌ها و پیام‌ها</Text>
        <TouchableOpacity onPress={handleReadAll}>
            <Ionicons name="checkmark-done-outline" size={22} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      <View style={styles.filterBar}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
              {categories.map(cat => (
                  <TouchableOpacity 
                    key={cat.id} 
                    style={[styles.filterChip, activeCategory === cat.id && styles.filterChipActive]}
                    onPress={() => setActiveCategory(cat.id)}
                  >
                      <Text style={[styles.filterText, activeCategory === cat.id && styles.filterTextActive]}>
                          {cat.label} {counts[cat.id] > 0 ? `(${counts[cat.id]})` : ''}
                      </Text>
                  </TouchableOpacity>
              ))}
          </ScrollView>
      </View>

      {loading && notifications.length === 0 ? (
          <View style={{ padding: 16 }}>{[1,2,3,4].map(i => <View key={i} style={{ marginBottom: 12 }}><Skeleton width="100%" height={80} borderRadius={12} /></View>)}</View>
      ) : (
          <FlatList
            data={activeCategory === 'all' ? notifications : notifications.filter(n => n.category === activeCategory)}
            keyExtractor={item => item.id}
            // Perf ( Phase 5-2 ): کاهش حافظه/رندر — بدون تغییر رفتار
            initialNumToRender={10}
            maxToRenderPerBatch={10}
            windowSize={7}
            removeClippedSubviews
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
            ListEmptyComponent={
                <View style={styles.emptyContainer}>
                    <Ionicons name="notifications-outline" size={64} color="#CBD5E1" />
                    <Text style={styles.emptyTitle}>پیامی یافت نشد</Text>
                </View>
            }
            renderItem={({ item }) => (
                <TouchableOpacity 
                    style={[styles.notifCard, !item.is_read && styles.notifUnread]} 
                    onPress={() => markAsRead(item.id, item.deep_link)}
                >
                    <View style={styles.notifIcon}>
                        <Ionicons 
                            name={item.category === 'order' ? 'cart-outline' : (item.category === 'promotion' ? 'pricetag-outline' : 'notifications-outline')} 
                            size={20} 
                            color={!item.is_read ? COLORS.primary : COLORS.textSecondary} 
                        />
                    </View>
                    <View style={styles.notifContent}>
                        <View style={styles.notifHeader}>
                            <Text style={styles.notifTitle}>{item.title}</Text>
                            <Text style={styles.notifTime}>{item.created_at_relative}</Text>
                        </View>
                        <Text style={styles.notifBody} numberOfLines={2}>{item.body}</Text>
                    </View>
                    {!item.is_read && <View style={styles.unreadDot} />}
                </TouchableOpacity>
            )}
          />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FFF' },
  header: { 
    flexDirection: 'row-reverse', 
    alignItems: 'center', 
    justifyContent: 'space-between',
    height: 56, 
    paddingHorizontal: 16, 
    borderBottomWidth: 1, 
    borderBottomColor: COLORS.border,
    backgroundColor: '#FFF'
  },
  headerTitle: { fontSize: 16, fontWeight: 'bold', color: COLORS.textPrimary },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  filterBar: { backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: COLORS.border },
  filterScroll: { padding: 12, flexDirection: 'row-reverse', gap: 8 },
  filterChip: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20, backgroundColor: '#F1F5F9' },
  filterChipActive: { backgroundColor: COLORS.primary },
  filterText: { fontSize: 13, color: COLORS.textSecondary, fontWeight: '500' },
  filterTextActive: { color: '#FFF' },
  notifCard: { 
    flexDirection: 'row-reverse', 
    padding: 16, 
    borderBottomWidth: 1, 
    borderBottomColor: '#F1F5F9',
    alignItems: 'flex-start'
  },
  notifUnread: { backgroundColor: '#F0F7FF' },
  notifIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.border, marginLeft: 12 },
  notifContent: { flex: 1, alignItems: 'flex-end' },
  notifHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', width: '100%', marginBottom: 4 },
  notifTitle: { fontSize: 14, fontWeight: 'bold', color: COLORS.textPrimary, textAlign: 'right' },
  notifTime: { fontSize: 11, color: '#94A3B8' },
  notifBody: { fontSize: 13, color: COLORS.textSecondary, textAlign: 'right', lineHeight: 20 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.primary, alignSelf: 'center', marginRight: 8 },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyTitle: { fontSize: 16, fontWeight: 'bold', color: COLORS.textPrimary, marginTop: 16, textAlign: 'center' },
  loginBtn: { marginTop: 24, backgroundColor: COLORS.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  loginBtnText: { color: '#FFF', fontWeight: 'bold' },
});
