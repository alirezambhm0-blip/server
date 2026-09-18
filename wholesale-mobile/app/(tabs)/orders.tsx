import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
} from "react-native";
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import  Fonts  from '../_layout';

import { useAuth } from "@/context/AuthContext";
import { getOrdersApi, Order } from "@/api/ordersApi";
import { formatPrice } from "@/utils/format";
import Skeleton from "@/components/ui/Skeleton";

const COLORS = {
  primary: '#2563EB',
  background: '#F8FAFC',
  textPrimary: '#0F172A',
  textSecondary: '#64748B',
  border: '#E2E8F0',
  warning: '#F59E0B',
  success: '#16A34A',
  error: '#EF4444',
  info: '#2563EB',
};

const STATUS_MAP: any = {
  PENDING: { label: 'در انتظار بررسی', color: COLORS.warning, bg: '#FEF3C7' },
  CONFIRMED: { label: 'تایید شده', color: COLORS.info, bg: '#DBEAFE' },
  PROCESSING: { label: 'در حال آماده‌سازی', color: COLORS.warning, bg: '#FEF3C7' },
  SHIPPED: { label: 'ارسال شده', color: COLORS.info, bg: '#DBEAFE' },
  DELIVERED: { label: 'تحویل شده', color: COLORS.success, bg: '#D1FAE5' },
  CANCELLED: { label: 'لغو شده', color: COLORS.error, bg: '#FEE2E2' },
};

export default function OrdersScreen() {
  const router = useRouter();
  const { isLoggedIn, isApprovedCustomer, isPendingCustomer, isRejectedCustomer, accessToken } = useAuth();
  
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState("all");
  const [counts, setCounts] = useState<any>({ all: 0, active: 0, delivered: 0, cancelled: 0 });

  const loadOrders = useCallback(async (filter = activeFilter) => {
    if (!isLoggedIn) return;
    try {
      const res = await getOrdersApi(filter);
      // Ensure we are accessing data field correctly
      setOrders(res.data || res);
      if (res.meta) setCounts(res.meta.counts_by_filter);
    } catch (e) {
      console.warn('Failed to load orders', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isLoggedIn, activeFilter]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const onRefresh = () => {
    setRefreshing(true);
    loadOrders();
  };

  if (!isLoggedIn || !accessToken) {
      return (
        <View style={styles.centered}>
            <Ionicons name="lock-closed-outline" size={64} color="#CBD5E1" />
            <Text style={styles.emptyTitle}>برای مشاهده سفارش‌ها وارد شوید</Text>
            <TouchableOpacity style={styles.loginBtn} onPress={() => router.push("/(auth)/login")}>
                <Text style={styles.loginBtnText}>ورود / ثبت‌نام</Text>
            </TouchableOpacity>
        </View>
      );
  }

  const tabs = [
      { id: 'all', label: 'همه', key: 'all' },
      { id: 'active', label: 'جاری', key: 'active' },
      { id: 'delivered', label: 'تحویل شده', key: 'delivered' },
      { id: 'cancelled', label: 'لغو شده', key: 'cancelled' },
  ];

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>سفارش‌های من</Text>
      </View>

      <View style={styles.filterBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
            {tabs.map(tab => (
                <TouchableOpacity 
                    key={tab.id} 
                    style={[styles.filterChip, activeFilter === tab.id && styles.filterChipActive]}
                    onPress={() => {
                        setActiveFilter(tab.id);
                        setLoading(true);
                        loadOrders(tab.id);
                    }}
                >
                    <Text style={[styles.filterText, activeFilter === tab.id && styles.filterTextActive]}>
                        {tab.label} {counts[tab.key] ? `(${counts[tab.key]})` : ''}
                    </Text>
                </TouchableOpacity>
            ))}
        </ScrollView>
      </View>

      {loading && !refreshing ? (
          <View style={{ padding: 16 }}>
              {[1,2,3].map(i => <View key={i} style={{ marginBottom: 12 }}><Skeleton width="100%" height={120} borderRadius={14} /></View>)}
          </View>
      ) : (
          <FlatList
            data={orders}
            keyExtractor={item => item.id}
            // Perf ( Phase 5-2 ): کاهش حافظه/رندر — بدون تغییر رفتار
            initialNumToRender={8}
            maxToRenderPerBatch={8}
            windowSize={7}
            removeClippedSubviews
            contentContainerStyle={styles.listContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
            ListEmptyComponent={
                <View style={styles.centered}>
                    <Ionicons name="clipboard-outline" size={64} color="#CBD5E1" />
                    <Text style={styles.emptyTitle}>سفارشی یافت نشد</Text>
                </View>
            }
            renderItem={({ item }) => {
                const status = STATUS_MAP[item.status] || STATUS_MAP.PENDING;
                return (
                    <TouchableOpacity 
                        style={styles.orderCard} 
                        onPress={() => router.push(`/orders/${item.id}`)}
                    >
                        <View style={styles.cardHeader}>
                            <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
                                <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
                            </View>
                            <Text style={styles.orderNumber}>سفارش #{item.orderNumber || (item as any).order_number}</Text>
                        </View>
                        
                        <View style={styles.divider} />
                        
                        <View style={styles.cardBody}>
                            <View style={styles.infoRow}>
                                <Text style={styles.infoValue}>{(item as any).placed_at_shamsi || ''}</Text>
                                <Ionicons name="calendar-outline" size={14} color={COLORS.textSecondary} />
                            </View>
                            <View style={styles.infoRow}>
                                <Text style={styles.infoValue}>{(item as any).items_count || 0} قلم کالا</Text>
                                <Ionicons name="bag-handle-outline" size={14} color={COLORS.textSecondary} />
                            </View>
                        </View>

                        <View style={styles.cardFooter}>
                            <Text style={styles.totalAmount}>{formatPrice((item as any).final_total || 0)} تومان</Text>
                            <TouchableOpacity 
                                style={styles.detailsBtn}
                                onPress={() => router.push(`/orders/${item.id}`)}
                            >
                                <Text style={styles.detailsBtnText}>مشاهده جزئیات</Text>
                                <Ionicons name="chevron-back" size={16} color={COLORS.primary} />
                            </TouchableOpacity>
                        </View>
                    </TouchableOpacity>
                );
            }}
          />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  header: { height: 56, backgroundColor: '#FFF', justifyContent: 'center', alignItems: 'flex-end', paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.textPrimary },
  filterBar: { backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: COLORS.border },
  filterScroll: { padding: 12, flexDirection: 'row-reverse', gap: 8 },
  filterChip: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20, backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: COLORS.border },
  filterChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  filterText: { fontSize: 13, color: COLORS.textSecondary, fontWeight: '500' },
  filterTextActive: { color: '#FFF' },
  listContent: { padding: 16, paddingBottom: 100 },
  orderCard: { backgroundColor: '#FFF', borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: COLORS.border },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  orderNumber: { fontSize: 14, fontWeight: 'bold', color: COLORS.textPrimary },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  statusText: { fontSize: 11, fontWeight: 'bold' },
  divider: { height: 1, backgroundColor: '#F1F5F9', marginBottom: 12 },
  cardBody: { flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 16 },
  infoRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6 },
  infoValue: { fontSize: 12, color: COLORS.textSecondary },
  cardFooter: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' },
  totalAmount: { fontSize: 15, fontWeight: 'bold', color: COLORS.textPrimary },
  detailsBtn: { flexDirection: 'row-reverse', alignItems: 'center', gap: 4 },
  detailsBtnText: { fontSize: 13, color: COLORS.primary, fontWeight: 'bold' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  emptyTitle: { fontSize: 16, fontWeight: 'bold', color: COLORS.textPrimary, marginTop: 16 },
  loginBtn: { marginTop: 24, backgroundColor: COLORS.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  loginBtnText: { color: '#FFF', fontWeight: 'bold' },
});
