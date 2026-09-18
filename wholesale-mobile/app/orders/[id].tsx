import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Dimensions,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { getOrderDetailApi, cancelOrderApi, reorderApi, type Order } from '@/api/ordersApi';
import { notify } from '@/utils/notify';
import { useAuth } from '@/context/AuthContext';
import { useCart } from '@/context/CartContext';
import { formatPrice } from '@/utils/format';
import { buildUrl } from '@/api/httpClient';

const { width } = Dimensions.get('window');

const fa = (n: number | string) => String(n).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]);

const COLORS = {
  primary: '#2563EB',
  primaryDark: '#1D4ED8',
  primaryLight: '#DBEAFE',
  accent: '#10B981',
  background: '#F8FAFC',
  card: '#FFFFFF',
  textPrimary: '#0F172A',
  textSecondary: '#64748B',
  warning: '#F59E0B',
  error: '#EF4444',
  success: '#16A34A',
  border: '#E2E8F0',
};

// ─── تابع رنگ وضعیت ──────────────────────────────────────────────
function getStatusColor(status: string): string {
  switch (status) {
    case 'DELIVERED': return COLORS.success;
    case 'CANCELLED': return COLORS.error;
    case 'CONFIRMED': return COLORS.accent;
    case 'PROCESSING': return COLORS.primary;
    case 'SHIPPED': return '#7C3AED';
    default: return COLORS.warning;
  }
}

function getStatusBg(status: string): string {
  switch (status) {
    case 'DELIVERED': return '#D1FAE5';
    case 'CANCELLED': return '#FEE2E2';
    case 'CONFIRMED': return '#D1FAE5';
    case 'PROCESSING': return '#DBEAFE';
    case 'SHIPPED': return '#EDE9FE';
    default: return '#FEF3C7';
  }
}

// ═══════════════════════════════════════════════════════════════════
// MAIN SCREEN
// ═══════════════════════════════════════════════════════════════════

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { isLoggedIn } = useAuth();
  const { refreshCart } = useCart();

  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState<Order | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const loadData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await getOrderDetailApi(id);
      setOrder(data);
    } catch (error) {
      console.warn('Failed to load order details', error);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleCancelOrder = () => {
    if (!order) return;
    notify(
      "لغو سفارش",
      `آیا از لغو سفارش #${order.orderNumber} اطمینان دارید؟`,
      [
        { text: "انصراف", style: "cancel" },
        {
          text: "بله، لغو کن",
          style: "destructive",
          onPress: async () => {
            setActionLoading(true);
            try {
              await cancelOrderApi(order.id);
              loadData();
            } catch (e: any) {
              notify("خطا", e?.message || "امکان لغو سفارش وجود ندارد");
            } finally {
              setActionLoading(false);
            }
          }
        }
      ]
    );
  };

  const handleReorder = async () => {
    if (!order || actionLoading) return;
    setActionLoading(true);
    try {
      await reorderApi(order.id, 'replace');
      refreshCart();
      router.push("/(tabs)/cart");
    } catch (e: any) {
      notify("خطا", e?.message || "امکان تکرار سفارش وجود ندارد");
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) return <View style={styles.centered}><ActivityIndicator size="large" color={COLORS.primary} /></View>;
  if (!order) return <View style={styles.centered}><Text>سفارش یافت نشد</Text></View>;

  const statusColor = getStatusColor(order.status);
  const statusBg = getStatusBg(order.status);

  return (
    <SafeAreaView style={styles.container}>
      {/* App Bar */}
      <View style={styles.appBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-forward" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.appBarTitle}>جزئیات سفارش</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

        {/* ── Header Card ── */}
        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <View style={[styles.badge, { backgroundColor: statusBg }]}>
              <Text style={[styles.badgeText, { color: statusColor }]}>{order.status_label_fa}</Text>
            </View>
            <Text style={styles.orderNo}>شماره سفارش #{order.orderNumber}</Text>
          </View>
          <Text style={styles.orderDate}>ثبت شده در {order.placed_at_shamsi}</Text>
        </View>

        {/* ── Timeline Section ── */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>وضعیت سفارش</Text>
          {order.timeline.map((step, index) => {
            const isCurrent = step.is_current;
            return (
              <View key={index} style={styles.timelineStep}>
                <View style={styles.timelineLeft}>
                  <View style={[
                    styles.timelineDot,
                    step.is_completed ? { backgroundColor: COLORS.success } : { borderColor: COLORS.border, borderWidth: 2 },
                    isCurrent && { backgroundColor: statusColor }
                  ]}>
                    {step.is_completed && !isCurrent && <Ionicons name="checkmark" size={12} color="#FFF" />}
                    {isCurrent && <View style={styles.currentDotInner} />}
                  </View>
                  {index < order.timeline.length - 1 && (
                    <View style={[styles.timelineLine, step.is_completed && { backgroundColor: COLORS.success }]} />
                  )}
                </View>
                <View style={styles.timelineRight}>
                  <Text style={[styles.stepLabel, isCurrent && { color: statusColor, fontWeight: 'bold' }]}>
                    {step.label_fa}
                  </Text>
                  <Text style={styles.stepDesc}>{step.description_fa}</Text>
                  {step.timestamp_shamsi && <Text style={styles.stepTime}>{step.timestamp_shamsi}</Text>}
                </View>
              </View>
            );
          })}
        </View>

        {/* ── Items Card ── */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>اقلام سفارش ({order.items.length} قلم)</Text>
          {order.items.map((item) => (
            <View key={item.id} style={styles.itemRow}>
              <View style={styles.itemInfo}>
                <Text style={styles.itemName}>{item.productName}</Text>
                <Text style={styles.itemUnit}>{item.unitLabel} — {fa(item.quantity)} عدد × {formatPrice(item.unitPrice)} تومان</Text>
                {item.originalPrice && item.originalPrice > item.unitPrice ? (
                  <Text style={{ fontSize: 10, color: '#94A3B8', textDecorationLine: 'line-through', marginTop: 2 }}>
                    {formatPrice(item.originalPrice)} تومان
                  </Text>
                ) : null}
                <Text style={styles.itemPrice}>{formatPrice(item.lineTotal)} تومان</Text>
              </View>
              {item.productImageUrl ? (
                <Image source={{ uri: buildUrl(item.productImageUrl) }} style={styles.itemImg} />
              ) : (
                <View style={[styles.itemImg, { alignItems: 'center', justifyContent: 'center' }]}>
                  <Ionicons name="image-outline" size={20} color="#CBD5E1" />
                </View>
              )}
            </View>
          ))}
        </View>

        {/* ── Summary Card ── */}
        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <Text style={styles.summaryValue}>{formatPrice(order.subtotal)} تومان</Text>
            <Text style={styles.summaryLabel}>جمع کالاها</Text>
          </View>
          {order.total_discount > 0 && (
            <View style={[styles.rowBetween, { marginTop: 10 }]}>
              <Text style={[styles.summaryValue, { color: COLORS.success }]}>-{formatPrice(order.total_discount)} تومان</Text>
              <Text style={styles.summaryLabel}>تخفیف کل</Text>
            </View>
          )}
          <View style={styles.divider} />
          <View style={styles.rowBetween}>
            <Text style={[styles.summaryValue, { color: COLORS.primary, fontSize: 18 }]}>{formatPrice(order.final_total)} تومان</Text>
            <Text style={[styles.summaryLabel, { fontWeight: 'bold', color: COLORS.textPrimary }]}>مبلغ نهایی</Text>
          </View>
        </View>

        {/* ── Delivery Info ── */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>اطلاعات ارسال</Text>
          <View style={styles.infoRow}>
            <Ionicons name="location-outline" size={18} color={COLORS.primary} />
            <Text style={styles.infoText}>{order.delivery_address}</Text>
          </View>
          <View style={[styles.infoRow, { marginTop: 12 }]}>
            <Ionicons name="card-outline" size={18} color={COLORS.accent} />
            <Text style={styles.infoText}>روش پرداخت: نقدی هنگام تحویل</Text>
          </View>
        </View>

        {/* ── Action Buttons ── */}
        <View style={styles.actions}>
          <TouchableOpacity style={styles.reorderBtn} onPress={handleReorder} disabled={actionLoading}>
            <Text style={styles.reorderBtnText}>تکرار این سفارش</Text>
            <Ionicons name="refresh" size={20} color="#FFF" style={{ marginLeft: 8 }} />
          </TouchableOpacity>

          {order.can_cancel && (
            <TouchableOpacity style={styles.cancelBtn} onPress={handleCancelOrder} disabled={actionLoading}>
              <Text style={styles.cancelBtnText}>لغو سفارش</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {actionLoading && (
        <View style={styles.overlay}>
          <ActivityIndicator size="large" color="#FFF" />
        </View>
      )}
    </SafeAreaView>
  );
}

// ═══════════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════════

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  appBar: { height: 56, backgroundColor: '#FFF', flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  appBarTitle: { fontSize: 16, fontWeight: 'bold', color: COLORS.textPrimary },
  scrollContent: { padding: 16 },
  card: { backgroundColor: '#FFF', borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: COLORS.border },
  rowBetween: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' },
  orderNo: { fontSize: 16, fontWeight: 'bold', color: COLORS.textPrimary },
  orderDate: { fontSize: 12, color: COLORS.textSecondary, marginTop: 8, textAlign: 'right' },
  badge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 8 },
  badgeText: { fontSize: 12, fontWeight: 'bold' },
  sectionTitle: { fontSize: 15, fontWeight: 'bold', color: COLORS.textPrimary, marginBottom: 16, textAlign: 'right' },
  timelineStep: { flexDirection: 'row-reverse', minHeight: 60 },
  timelineLeft: { alignItems: 'center', width: 30 },
  timelineDot: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', zIndex: 2, backgroundColor: '#FFF' },
  currentDotInner: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#FFF' },
  timelineLine: { position: 'absolute', top: 20, bottom: 0, width: 2, backgroundColor: COLORS.border, zIndex: 1 },
  timelineRight: { flex: 1, paddingRight: 12, paddingBottom: 20, alignItems: 'flex-end' },
  stepLabel: { fontSize: 14, color: COLORS.textPrimary },
  stepDesc: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  stepTime: { fontSize: 11, color: COLORS.textSecondary, marginTop: 4 },
  itemRow: { flexDirection: 'row-reverse', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  itemImg: { width: 56, height: 56, borderRadius: 8, backgroundColor: '#F8FAFC' },
  itemInfo: { flex: 1, paddingRight: 12, alignItems: 'flex-end' },
  itemName: { fontSize: 13, fontWeight: '500', color: COLORS.textPrimary, textAlign: 'right' },
  itemUnit: { fontSize: 11, color: COLORS.textSecondary, marginTop: 2 },
  itemPrice: { fontSize: 12, color: COLORS.primary, marginTop: 4, fontWeight: 'bold' },
  summaryLabel: { fontSize: 14, color: COLORS.textSecondary },
  summaryValue: { fontSize: 14, color: COLORS.textPrimary, fontWeight: 'bold' },
  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: 12 },
  infoRow: { flexDirection: 'row-reverse', alignItems: 'flex-start', gap: 10 },
  infoText: { fontSize: 13, color: COLORS.textPrimary, flex: 1, textAlign: 'right', lineHeight: 20 },
  actions: { marginTop: 10, gap: 10 },
  reorderBtn: { height: 52, backgroundColor: COLORS.accent, borderRadius: 12, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center' },
  reorderBtnText: { color: '#FFF', fontSize: 15, fontWeight: 'bold' },
  cancelBtn: { height: 48, borderRadius: 12, borderWidth: 1, borderColor: COLORS.error, alignItems: 'center', justifyContent: 'center' },
  cancelBtnText: { color: COLORS.error, fontSize: 14, fontWeight: 'bold' },
  overlay: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', zIndex: 10 },
});
