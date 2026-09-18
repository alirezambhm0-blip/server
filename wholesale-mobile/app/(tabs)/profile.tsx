// app/(tabs)/profile.tsx
// صفحه حساب کاربری — بازنویسی کامل مطابق اسپک

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Platform,
  Linking,
  RefreshControl,
  ActivityIndicator,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Fonts } from '@/utils/fonts';
import { notify } from '@/utils/notify';
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { useCart } from '@/context/CartContext';
import { profileApi, type UserProfile } from '@/api/profileApi';
import { getLatestOrderApi, reorderApi } from '@/api/ordersApi';
import { formatPrice } from '@/utils/format';
import Skeleton from '@/components/ui/Skeleton';

const C = {
  primary: '#2563EB', primaryDark: '#1D4ED8', primaryLight: '#DBEAFE',
  accent: '#10B981', accentLight: '#D1FAE5',
  background: '#F8FAFC', card: '#FFFFFF',
  textPrimary: '#0F172A', textSecondary: '#64748B', textTertiary: '#94A3B8',
  border: '#E2E8F0', disabled: '#CBD5E1',
  error: '#EF4444', errorLight: '#FEE2E2',
  warning: '#F59E0B', warningLight: '#FEF3C7', warningText: '#92400E',
  success: '#16A34A', successLight: '#D1FAE5',
  purple: '#7C3AED', purpleLight: '#E9D5FF',
};

const fa = (n: number | string) => String(n).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]);

// ─── Skeleton ──────────────────────────────────────────────────────
function ProfileSkeleton() {
  return (
    <View style={{ padding: 16, gap: 16 }}>
      <Skeleton width="100%" height={200} borderRadius={16} />
      <Skeleton width="100%" height={200} borderRadius={14} />
      <Skeleton width="100%" height={160} borderRadius={14} />
    </View>
  );
}

// ─── Menu Item ─────────────────────────────────────────────────────
function MenuItem({ icon, iconBg, iconColor, title, subtitle, badge, badgeColor, onPress, chevron = true, danger = false }: {
  icon: keyof typeof Ionicons.glyphMap; iconBg: string; iconColor: string;
  title: string; subtitle?: string | null;
  badge?: string; badgeColor?: string;
  onPress?: () => void; chevron?: boolean; danger?: boolean;
}) {
  return (
    <TouchableOpacity style={styles.menuItem} onPress={onPress} activeOpacity={0.7} disabled={!onPress}>
      <View style={styles.menuItemRight}>
        <View style={[styles.menuIconBox, { backgroundColor: iconBg }]}>
          <Ionicons name={icon} size={20} color={iconColor} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.menuTitle, danger && { color: C.error }]}>{title}</Text>
          {subtitle ? <Text style={styles.menuSubtitle}>{subtitle}</Text> : null}
        </View>
      </View>
      <View style={styles.menuItemLeft}>
        {badge ? (
          <View style={[styles.badge, { backgroundColor: badgeColor || C.error }]}>
            <Text style={styles.badgeText}>{badge}</Text>
          </View>
        ) : null}
        {chevron ? <Ionicons name="chevron-back" size={18} color={C.textTertiary} /> : null}
      </View>
    </TouchableOpacity>
  );
}

// ─── Menu Group ────────────────────────────────────────────────────
function MenuGroup({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <View style={{ marginBottom: 16 }}>
      {title ? <Text style={styles.groupTitle}>{title}</Text> : null}
      <View style={styles.menuCard}>{children}</View>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════
// MAIN SCREEN
// ═══════════════════════════════════════════════════════════════════

export default function ProfileScreen() {
  const router = useRouter();
  const { authStatus, isGuest, isPendingCustomer, isApprovedCustomer, isRejectedCustomer, customer, logout } = useAuth();
  const { refreshCart } = useCart();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [reorderLoading, setReorderLoading] = useState(false);

  const loadProfile = useCallback(async () => {
    try {
      const data = await profileApi.getProfile();
      setProfile(data);
    } catch (e) {
      console.warn('[Profile] Failed to load', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadProfile(); }, [loadProfile]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadProfile();
  }, [loadProfile]);

  const handleLogout = useCallback(() => {
    notify('خروج از حساب', 'آیا مطمئن هستید که می‌خواهید از حساب خود خارج شوید?', [
      { text: 'انصراف', style: 'cancel' },
      { text: 'خروج', style: 'destructive', onPress: async () => { await logout(); } },
    ]);
  }, [logout]);

  const handleReorder = useCallback(async () => {
    if (reorderLoading) return;
    setReorderLoading(true);
    try {
      const latest = await getLatestOrderApi();
      if (!latest) { notify('خطا', 'سفارش قبلی یافت نشد'); return; }
      await reorderApi(latest.id, 'replace');
      await refreshCart();
      notify('موفق', 'اقلام سفارش قبلی به سبد اضافه شد');
      router.push('/(tabs)/cart');
    } catch (e: any) {
      notify('خطا', e?.message || 'خطا در تکرار سفارش');
    } finally {
      setReorderLoading(false);
    }
  }, [reorderLoading, refreshCart, router]);

  // ── Guest State ──
  if (isGuest) {
    return (
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.centerWrap}>
          <Ionicons name="storefront-outline" size={80} color={C.disabled} />
          <Text style={styles.centerTitle}>به حساب کاربری خود وارد شوید</Text>
          <Text style={styles.centerSub}>با ورود به حساب کاربری، می‌توانید سفارش ثبت کنید، فاکتورها را ببینید و از قابلیت‌های اپ استفاده کنید.</Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={() => router.push('/(auth)/login')}>
            <Text style={styles.primaryBtnText}>ورود / ثبت‌نام</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Loading ──
  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.appBar}><Text style={styles.appBarTitle}>حساب کاربری</Text></View>
        <ProfileSkeleton />
      </SafeAreaView>
    );
  }

  const p = profile;
  const v = p?.verification;
  const store = p?.store;
  const stats = p?.stats;

  const verificationColors: Record<string, { bg: string; text: string; icon: keyof typeof Ionicons.glyphMap }> = {
    verified: { bg: C.successLight, text: C.success, icon: 'checkmark-circle' },
    pending: { bg: C.warningLight, text: C.warningText, icon: 'hourglass' },
    rejected: { bg: C.errorLight, text: C.error, icon: 'close-circle' },
    guest: { bg: '#F1F5F9', text: '#94A3B8', icon: 'person-outline' },
  };
  const vc = verificationColors[v?.status || 'pending'] || verificationColors.pending;

  return (
    <SafeAreaView style={styles.safe}>
      {/* App Bar */}
      <View style={styles.appBar}>
        <Text style={styles.appBarTitle}>حساب کاربری</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={C.primary} />}
      >
        {/* ── Profile Header Card ── */}
        <View style={styles.profileCard}>
          <View style={styles.profileRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {(p?.store?.name || p?.full_name || '?')[0]?.toUpperCase() || '?'}
              </Text>
            </View>
            <View style={{ flex: 1, marginLeft: 14 }}>
              <Text style={styles.profileName}>{p?.full_name || '—'}</Text>
              <Text style={styles.profileStore}>{store?.name || '—'}</Text>
              <Text style={styles.profilePhone}>{p?.phone_number_masked || '—'}</Text>
            </View>
            <TouchableOpacity style={styles.editBtn} onPress={() => router.push('/edit-profile')}>
              <Ionicons name="create-outline" size={20} color="rgba(255,255,255,0.8)" />
            </TouchableOpacity>
          </View>

          {/* Verification Badge */}
          <View style={styles.verifBadge}>
            <Ionicons name={vc.icon} size={20} color="#FFF" />
            <Text style={styles.verifText}>{v?.status_label_fa || '—'}</Text>
            <Text style={styles.verifDate}>
              {v?.verified_at_shamsi || (v?.status === 'pending' ? 'منتظر بررسی' : '')}
            </Text>
          </View>

          {/* Stats Grid */}
          <View style={styles.statsRow}>
            <View style={styles.statCol}>
              <Text style={styles.statNum}>{fa(stats?.total_orders || 0)}</Text>
              <Text style={styles.statLabel}>سفارش</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statCol}>
              <Text style={styles.statNum}>{fa(stats?.total_favorites || 0)}</Text>
              <Text style={styles.statLabel}>علاقه‌مندی</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statCol}>
              <Text style={styles.statNum}>{stats?.member_since_shamsi?.split('/')[0] || '—'}</Text>
              <Text style={styles.statLabel}>عضو از</Text>
            </View>
          </View>
        </View>

        {/* ── Pending Info Card ── */}
        {isPendingCustomer ? (
          <View style={styles.pendingCard}>
            <Ionicons name="information-circle" size={20} color={C.warningText} />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={styles.pendingTitle}>حساب شما در انتظار تایید است</Text>
              <Text style={styles.pendingSub}>پس از تایید، امکان ثبت سفارش و مشاهده قیمت‌ها فعال می‌شود.</Text>
            </View>
          </View>
        ) : null}

        {/* ── Rejected Info Card ── */}
        {isRejectedCustomer ? (
          <View style={[styles.pendingCard, { backgroundColor: C.errorLight, borderRightColor: C.error }]}>
            <Ionicons name="close-circle" size={20} color={C.error} />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={[styles.pendingTitle, { color: C.error }]}>احراز هویت شما رد شد</Text>
              {v?.rejection_reason ? <Text style={[styles.pendingSub, { color: C.error }]}>{v.rejection_reason}</Text> : null}
            </View>
          </View>
        ) : null}

        {/* ── Group 1: Orders & Shopping ── */}
        <MenuGroup title="خرید و سفارش‌ها">
          <MenuItem icon="clipboard-outline" iconBg={C.primaryLight} iconColor={C.primary}
            title="سفارش‌های من" subtitle={stats ? `${fa(stats.total_orders)} سفارش ثبت شده` : null}
            onPress={() => router.push('/(tabs)/orders')} />
          <MenuItem icon="heart" iconBg={C.errorLight} iconColor={C.error}
            title="علاقه‌مندی‌ها" subtitle={stats ? `${fa(stats.total_favorites)} محصول ذخیره شده` : null}
            onPress={() => router.push('/favorites')} />
          {stats && stats.total_orders > 0 ? (
            <MenuItem icon="repeat" iconBg={C.accentLight} iconColor={C.accent}
              title="تکرار آخرین سفارش" subtitle="خرید سریع همان اقلام قبلی"
              onPress={handleReorder} />
          ) : null}
        </MenuGroup>

        {/* ── Group 2: Store Info ── */}
        <MenuGroup title="اطلاعات فروشگاه">
          <MenuItem icon="storefront" iconBg={C.primaryLight} iconColor={C.primary}
            title="اطلاعات فروشگاه" subtitle={store?.type || null}
            onPress={() => router.push('/store-info')} />
          <MenuItem icon="location" iconBg={C.warningLight} iconColor={C.warning}
            title="آدرس تحویل" subtitle={store?.default_address ? store.default_address.slice(0, 40) + '...' : null}
            onPress={() => router.push('/edit-address')} />
          <MenuItem icon="person" iconBg={C.purpleLight} iconColor={C.purple}
            title="اطلاعات حساب" subtitle="نام، ایمیل، شماره تماس"
            onPress={() => router.push('/edit-profile')} />
        </MenuGroup>

        {/* ── Group 3: Communication ── */}
        <MenuGroup title="ارتباط و پشتیبانی">
          <MenuItem icon="notifications" iconBg={C.primaryLight} iconColor={C.primary}
            title="اعلان‌ها" subtitle="همه اعلان‌ها را مشاهده کنید"
            badge={p && p.unread_notifications_count > 0 ? `${fa(p.unread_notifications_count)} جدید` : undefined}
            badgeColor={C.error}
            onPress={() => router.push('/notifications')} />
          <MenuItem icon="chatbubbles" iconBg={C.accentLight} iconColor={C.accent}
            title="پشتیبانی" subtitle="ارسال پیام یا تماس با پشتیبانی"
            badge={p && p.open_tickets_count > 0 ? `${fa(p.open_tickets_count)} تیکت باز` : undefined}
            badgeColor={C.warning}
            onPress={() => router.push('/tickets')} />
          <MenuItem icon="call" iconBg={C.primaryLight} iconColor={C.primary}
            title="تماس مستقیم" subtitle="021-12345678"
            onPress={() => Linking.openURL('tel:02112345678')} />
        </MenuGroup>

        {/* ── Group 4: Help & Info ── */}
        <MenuGroup title="راهنما و اطلاعات">
          <MenuItem icon="help-circle" iconBg={C.primaryLight} iconColor={C.primary} title="سوالات متداول" onPress={() => router.push('/info-faq')} />
          <MenuItem icon="book" iconBg={C.accentLight} iconColor={C.accent} title="راهنمای استفاده از اپلیکیشن" onPress={() => router.push('/info-guide')} />
          <MenuItem icon="information-circle" iconBg={C.purpleLight} iconColor={C.purple} title="درباره ما" onPress={() => router.push('/info-about')} />
          <MenuItem icon="document-text" iconBg={C.warningLight} iconColor={C.warning} title="قوانین و مقررات" onPress={() => router.push('/info-terms')} />
          <MenuItem icon="shield" iconBg={C.successLight} iconColor={C.success} title="حریم خصوصی" onPress={() => router.push('/info-privacy')} />
        </MenuGroup>

        {/* ── Group 5: Settings ── */}
        <MenuGroup title="تنظیمات">
          <MenuItem icon="notifications" iconBg={C.primaryLight} iconColor={C.primary}
            title="تنظیمات اعلان‌ها" subtitle="مدیریت اعلان‌های دریافتی"
            onPress={() => router.push('/notification-settings')} />
          <MenuItem icon="phone-portrait" iconBg="#F1F5F9" iconColor={C.textSecondary}
            title="نسخه اپلیکیشن" subtitle="نسخه ۱.۰.۰" chevron={false} />
        </MenuGroup>

        {/* ── Logout ── */}
        <View style={styles.logoutCard}>
          <MenuItem icon="log-out" iconBg={C.errorLight} iconColor={C.error}
            title="خروج از حساب کاربری" onPress={handleLogout} chevron={false} danger />
        </View>

        {/* ── Footer ── */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>بنکو مارکت</Text>
          <Text style={styles.footerVersion}>نسخه ۱.۰.۰</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ═══════════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════════

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.background },
  appBar: { height: 56, backgroundColor: C.card, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: C.border },
  appBarTitle: { fontSize: 18, color: C.textPrimary, ...Fonts.bold },

  // ── Center states ──
  centerWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  centerTitle: { fontSize: 18, fontWeight: 'bold', color: C.textPrimary, marginTop: 16, textAlign: 'center' },
  centerSub: { fontSize: 13, color: C.textSecondary, marginTop: 8, textAlign: 'center', lineHeight: 20 },
  primaryBtn: { backgroundColor: C.primary, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 24, width: 240 },
  primaryBtnText: { color: '#FFF', fontSize: 15, fontWeight: 'bold' },

  // ── Profile Card ──
  profileCard: { margin: 16, backgroundColor: C.primary, borderRadius: 16, padding: 20 },
  profileRow: { flexDirection: 'row-reverse', alignItems: 'center' },
  avatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'rgba(255,255,255,0.4)' },
  avatarText: { fontSize: 24, fontWeight: 'bold', color: '#FFF' },
  profileName: { fontSize: 16, color: '#FFF', textAlign: 'right', ...Fonts.bold },
  profileStore: { fontSize: 13, color: 'rgba(255,255,255,0.8)', marginTop: 2, textAlign: 'right', ...Fonts.regular },
  profilePhone: { fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 2, textAlign: 'right', ...Fonts.light },
  editBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },

  // ── Verification ──
  verifBadge: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 10, padding: 10, marginTop: 16 },
  verifText: { fontSize: 13, fontWeight: 'bold', color: '#FFF', flex: 1 },
  verifDate: { fontSize: 11, color: 'rgba(255,255,255,0.8)' },

  // ── Stats ──
  statsRow: { flexDirection: 'row-reverse', marginTop: 16 },
  statCol: { flex: 1, alignItems: 'center' },
  statNum: { fontSize: 18, fontWeight: 'bold', color: '#FFF' },
  statLabel: { fontSize: 11, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  statDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.2)', marginVertical: 4 },

  // ── Pending Card ──
  pendingCard: { flexDirection: 'row-reverse', alignItems: 'flex-start', gap: 10, backgroundColor: C.warningLight, marginHorizontal: 16, padding: 14, borderRadius: 14, marginBottom: 16, borderRightWidth: 4, borderRightColor: C.warning },
  pendingTitle: { fontSize: 14, fontWeight: 'bold', color: C.warningText, textAlign: 'right' },
  pendingSub: { fontSize: 12, color: C.warningText, marginTop: 4, lineHeight: 18, textAlign: 'right' },

  // ── Menu Groups ──
  groupTitle: { fontSize: 13, color: C.textSecondary, marginHorizontal: 16, marginBottom: 8, textAlign: 'right', ...Fonts.semiBold },
  menuCard: { backgroundColor: C.card, marginHorizontal: 16, borderRadius: 14, borderWidth: 1, borderColor: C.border, overflow: 'hidden' },
  menuItem: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, height: 56, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  menuItemRight: { flexDirection: 'row-reverse', alignItems: 'center', flex: 1, gap: 12 },
  menuItemLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  menuIconBox: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  menuTitle: { fontSize: 14, color: C.textPrimary, textAlign: 'right', ...Fonts.medium },
  menuSubtitle: { fontSize: 11, color: C.textSecondary, marginTop: 2, textAlign: 'right', ...Fonts.light },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  badgeText: { color: '#FFF', fontSize: 11, fontWeight: 'bold' },

  // ── Logout ──
  logoutCard: { marginHorizontal: 16, marginBottom: 16, borderRadius: 14, borderWidth: 1, borderColor: C.errorLight, backgroundColor: C.card, overflow: 'hidden' },

  // ── Footer ──
  footer: { alignItems: 'center', marginTop: 24, marginBottom: 16 },
  footerText: { fontSize: 12, color: C.textTertiary, textAlign: 'center' },
  footerVersion: { fontSize: 11, color: C.textTertiary, marginTop: 4, textAlign: 'center' },
});
