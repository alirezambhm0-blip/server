// app/(tabs)/home.tsx
// صفحه اصلی اپلیکیشن بنکو مارکت — بازنویسی کامل مطابق اسپک دقیق

import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Image,
  RefreshControl,
  Linking,
  ActivityIndicator,
} from 'react-native';
import { notify } from '@/utils/notify';
import { Ionicons } from '@expo/vector-icons';
import { Fonts } from '@/utils/fonts';
import { useAuth } from '@/context/AuthContext';
import { useCart } from '@/context/CartContext';
import { useRouter } from 'expo-router';
import { productsApi, type Category } from '@/api/productsApi';
import { bannersApi, type Banner } from '@/api/bannersApi';
import { getActiveOrdersApi, getLatestOrderApi, reorderApi, type Order } from '@/api/ordersApi';
import { Product } from '@/types/product';
import Skeleton from '@/components/ui/Skeleton';
import ProductCard from '@/components/product/ProductCard';
import { formatPrice } from '@/utils/format';
import { buildUrl } from '@/api/httpClient';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = 155;
const CARD_GAP = 12;

// ─── Design System ─────────────────────────────────────────────────
const C = {
  primary: '#2563EB',
  primaryDark: '#1D4ED8',
  primaryLight: '#DBEAFE',
  primaryExtraLight: '#EFF6FF',
  background: '#F8FAFC',
  card: '#FFFFFF',
  textPrimary: '#0F172A',
  textSecondary: '#64748B',
  textTertiary: '#94A3B8',
  border: '#E2E8F0',
  disabled: '#CBD5E1',
  error: '#EF4444',
  warning: '#F59E0B',
  warningBg: '#FEF3C7',
  warningText: '#92400E',
  accent: '#10B981',
  accentLight: '#D1FAE5',
};

// ─── Persian numeral helper ────────────────────────────────────────
const fa = (n: number | string) => String(n).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]);

// ─── Banner Slider ─────────────────────────────────────────────────
function BannerSlider({ banners, loading }: { banners: Banner[]; loading: boolean }) {
  const scrollRef = useRef<ScrollView>(null);
  const indexRef = useRef(0);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (banners.length <= 1) return;
    const interval = setInterval(() => {
      indexRef.current = (indexRef.current + 1) % banners.length;
      setCurrentIndex(indexRef.current);
      scrollRef.current?.scrollTo({ x: (SCREEN_WIDTH - 32) * indexRef.current, animated: true });
    }, 4000);
    return () => clearInterval(interval);
  }, [banners.length]);

  if (loading) {
    return (
      <View style={{ paddingHorizontal: 16, marginBottom: 20 }}>
        <Skeleton width={SCREEN_WIDTH - 32} height={170} borderRadius={16} />
      </View>
    );
  }

  if (banners.length === 0) return null;

  return (
    <View style={styles.sliderContainer}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => {
          const idx = Math.round(e.nativeEvent.contentOffset.x / (SCREEN_WIDTH - 32));
          indexRef.current = idx;
          setCurrentIndex(idx);
        }}
      >
        {banners.map((banner) => (
          <TouchableOpacity
            key={banner.id}
            activeOpacity={0.9}
            style={styles.bannerCard}
            onPress={() => banner.linkUrl && Linking.openURL(banner.linkUrl)}
          >
            <Image source={{ uri: buildUrl(banner.imageUrl) }} style={styles.bannerImage} resizeMode="cover" />
          </TouchableOpacity>
        ))}
      </ScrollView>
      {banners.length > 1 ? (
        <View style={styles.pagination}>
          {banners.map((_, i) => (
            <View key={i} style={[styles.dot, i === currentIndex ? styles.dotActive : styles.dotInactive]} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

// ─── Section Header ────────────────────────────────────────────────
function SectionHeader({ title, onSeeAll }: { title: string; onSeeAll?: () => void }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {onSeeAll ? (
        <TouchableOpacity onPress={onSeeAll}>
          <Text style={styles.seeAll}>مشاهده همه</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

// ─── Horizontal Product Row with Skeleton ──────────────────────────
function ProductRow({ products, loading, emptyMessage }: { products: Product[]; loading: boolean; emptyMessage?: string }) {
  if (loading) {
    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalScroll}>
        {[1, 2, 3].map((i) => (
          <View key={i} style={{ width: CARD_WIDTH, marginRight: CARD_GAP }}>
            <Skeleton width={CARD_WIDTH} height={130} borderRadius={10} />
            <Skeleton width={CARD_WIDTH - 20} height={14} borderRadius={4} style={{ marginTop: 8 }} />
            <Skeleton width={80} height={14} borderRadius={4} style={{ marginTop: 4 }} />
            <Skeleton width={60} height={28} borderRadius={6} style={{ marginTop: 8 }} />
          </View>
        ))}
      </ScrollView>
    );
  }

  if (products.length === 0) return null;

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalScroll}>
      {products.map((p) => (
        <View key={p.id} style={{ width: CARD_WIDTH, marginRight: CARD_GAP }}>
          <ProductCard product={p} />
        </View>
      ))}
    </ScrollView>
  );
}

// ─── Reorder Bottom Sheet (inline) ─────────────────────────────────
function ReorderSheet({ visible, summary, onClose, onViewCart }: {
  visible: boolean;
  summary: { added: number; adjusted: number; unavailable: number } | null;
  onClose: () => void;
  onViewCart: () => void;
}) {
  if (!visible || !summary) return null;
  return (
    <View style={styles.sheetOverlay}>
      <View style={styles.sheetContent}>
        <Text style={styles.sheetTitle}>اقلام سفارش قبلی به سبد اضافه شد</Text>
        {summary.added > 0 && (
          <Text style={[styles.sheetLine, { color: C.accent }]}>✓ {fa(summary.added)} قلم به سبد اضافه شد</Text>
        )}
        {summary.adjusted > 0 && (
          <Text style={[styles.sheetLine, { color: C.warning }]}>⚠ {fa(summary.adjusted)} قلم با تعداد کمتر اضافه شد</Text>
        )}
        {summary.unavailable > 0 && (
          <Text style={[styles.sheetLine, { color: C.error }]}>✗ {fa(summary.unavailable)} قلم ناموجود بود</Text>
        )}
        <TouchableOpacity style={styles.sheetPrimaryBtn} onPress={onViewCart}>
          <Text style={styles.sheetPrimaryBtnText}>مشاهده سبد خرید</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.sheetSecondaryBtn} onPress={onClose}>
          <Text style={styles.sheetSecondaryBtnText}>متوجه شدم</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Cart Conflict Dialog (inline) ─────────────────────────────────
function CartConflictDialog({ visible, onAdd, onReplace, onCancel }: {
  visible: boolean;
  onAdd: () => void;
  onReplace: () => void;
  onCancel: () => void;
}) {
  if (!visible) return null;
  return (
    <View style={styles.sheetOverlay}>
      <View style={styles.sheetContent}>
        <Text style={styles.sheetTitle}>سبد خرید شما دارای محصول است</Text>
        <Text style={styles.sheetBody}>می‌خواهید اقلام سفارش قبلی به سبد فعلی اضافه شود یا جایگزین آن شود؟</Text>
        <TouchableOpacity style={[styles.sheetPrimaryBtn, { backgroundColor: C.primary }]} onPress={onAdd}>
          <Text style={styles.sheetPrimaryBtnText}>افزودن به سبد فعلی</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.sheetPrimaryBtn, { backgroundColor: C.warning }]} onPress={onReplace}>
          <Text style={styles.sheetPrimaryBtnText}>جایگزینی سبد</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.sheetSecondaryBtn} onPress={onCancel}>
          <Text style={styles.sheetSecondaryBtnText}>انصراف</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════
// MAIN SCREEN
// ═══════════════════════════════════════════════════════════════════

export default function HomeScreen() {
  const { customer, isApprovedCustomer, isPendingCustomer, isLoggedIn, isGuest, unreadNotificationCount } = useAuth();
  const router = useRouter();
  const { items: cartItems, refreshCart } = useCart();

  // ── State ──
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeOrder, setActiveOrder] = useState<Order | null>(null);
  const [latestOrder, setLatestOrder] = useState<Order | null>(null);
  const [newProducts, setNewProducts] = useState<Product[]>([]);
  const [suggestedProducts, setSuggestedProducts] = useState<Product[]>([]);
  const [discountedProducts, setDiscountedProducts] = useState<Product[]>([]);
  const [error, setError] = useState(false);
  const [reorderLoading, setReorderLoading] = useState(false);
  const [showReorderSheet, setShowReorderSheet] = useState(false);
  const [reorderSummary, setReorderSummary] = useState<{ added: number; adjusted: number; unavailable: number } | null>(null);
  const [showCartConflict, setShowCartConflict] = useState(false);
  const [pendingReorderMode, setPendingReorderMode] = useState<'add' | 'replace' | null>(null);

  // ── Data Loading ──
  const loadData = useCallback(async () => {
    setError(false);
    try {
      const [bannersRes, catsRes, newRes, suggestedRes, discountedRes] = await Promise.all([
        bannersApi.list().catch(() => []),
        productsApi.listCategories().catch(() => []),
        productsApi.list({ isNew: true, pageSize: 8 }).catch(() => ({ items: [] })),
        productsApi.list({ isFeatured: true, pageSize: 8 }).catch(() => ({ items: [] })),
        productsApi.list({ isDiscounted: true, pageSize: 8 }).catch(() => ({ items: [] })),
      ]);

      setBanners(bannersRes);
      setCategories(catsRes);
      setNewProducts(newRes.items || []);
      setSuggestedProducts(suggestedRes.items || []);
      setDiscountedProducts(discountedRes.items || []);

      if (isLoggedIn && isApprovedCustomer) {
        const [activeOrders, latest] = await Promise.all([
          getActiveOrdersApi().catch(() => []),
          getLatestOrderApi().catch(() => null),
        ]);
        setActiveOrder(activeOrders[0] || null);
        setLatestOrder(latest);
        refreshCart();
      }
    } catch (e) {
      console.warn('[Home] Data load failed:', e);
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isLoggedIn, isApprovedCustomer, refreshCart]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  // ── Reorder Logic ──
  const handleReorder = useCallback(async () => {
    if (!latestOrder || reorderLoading) return;

    // اگر سبد خالی نیست → نمایش دیالوگ تعارض
    if (cartItems.length > 0) {
      setShowCartConflict(true);
      return;
    }

    // سبد خالی → مستقیم اضافه کن
    await executeReorder('add');
  }, [latestOrder, cartItems.length, reorderLoading]);

  const executeReorder = useCallback(async (mode: 'add' | 'replace') => {
    if (!latestOrder) return;
    setReorderLoading(true);
    setShowCartConflict(false);
    try {
      const result = await reorderApi(latestOrder.id, mode);
      const summary = result.summary || {};
      setReorderSummary({
        added: (summary.added || []).length,
        adjusted: (summary.adjusted || []).length,
        unavailable: (summary.unavailable || []).length,
      });
      setShowReorderSheet(true);
      refreshCart();
    } catch (e: any) {
      notify('خطا', e?.message || 'خطا در تکرار سفارش');
    } finally {
      setReorderLoading(false);
    }
  }, [latestOrder, refreshCart]);

  // ── بخش‌های محصول: حداکثر ۲ بخش بر اساس اولویت ──
  const productSections = [];
  if (discountedProducts.length > 0) productSections.push({ key: 'discounted', title: '🏷️ تخفیف‌های ویژه', products: discountedProducts, filter: 'discounted' });
  if (suggestedProducts.length > 0) productSections.push({ key: 'suggested', title: '⭐ پیشنهادات ویژه', products: suggestedProducts, filter: 'suggested' });
  if (newProducts.length > 0) productSections.push({ key: 'new', title: '✨ محصولات جدید', products: newProducts, filter: 'new' });
  const visibleSections = productSections.slice(0, 2);

  // ── وضعیت سفارش فعال ──
  const statusConfig: Record<string, { label: string; icon: string; color: string }> = {
    PENDING: { label: 'در انتظار بررسی', icon: 'hourglass-outline', color: C.warning },
    CONFIRMED: { label: 'تأیید شده', icon: 'checkmark-circle-outline', color: C.accent },
    PROCESSING: { label: 'در حال آماده‌سازی', icon: 'cube-outline', color: C.primary },
    SHIPPED: { label: 'ارسال شده', icon: 'car-outline', color: '#7C3AED' },
    DELIVERED: { label: 'تحویل داده شده', icon: 'checkmark-done-circle', color: C.accent },
  };

  // ── تشخیص نمایش reorder card ──
  const showReorderCard = isLoggedIn && isApprovedCustomer && latestOrder && latestOrder.status !== 'PENDING';

  return (
    <View style={styles.safeArea}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={C.primary} />}
      >
        {/* ── Section 1: Header ── */}
        <View style={styles.header}>
          <View style={styles.userInfo}>
            <Text style={styles.greetingText}>سلام،</Text>
            <Text style={styles.storeName}>
              {isGuest ? 'میهمان' : (customer?.firstName || customer?.storeName || 'مشتری عزیز')}
            </Text>
          </View>
          {!isGuest ? (
            <View style={styles.headerActions}>
              <TouchableOpacity
                style={styles.notifButton}
                onPress={() => router.push('/notifications')}
                accessibilityLabel="اعلان‌ها"
              >
                <Ionicons name="notifications-outline" size={24} color={C.textPrimary} />
                {unreadNotificationCount > 0 ? (
                  <View style={styles.notifBadge}>
                    <Text style={styles.notifBadgeText}>
                      {unreadNotificationCount > 9 ? '+۹' : fa(unreadNotificationCount)}
                    </Text>
                  </View>
                ) : null}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.notifButton}
                onPress={() => router.push('/tickets')}
                accessibilityLabel="پشتیبانی"
              >
                <Ionicons name="headset-outline" size={22} color={C.textPrimary} />
              </TouchableOpacity>
            </View>
          ) : null}
        </View>

        {/* ── Section 2: Search Bar ── */}
        <TouchableOpacity
          style={styles.searchBar}
          activeOpacity={0.8}
          onPress={() => router.push('/search')}
          accessibilityLabel="جستجو"
        >
          <Ionicons name="search-outline" size={20} color={C.textTertiary} />
          <Text style={styles.searchPlaceholder}>جستجوی محصول یا دسته‌بندی...</Text>
        </TouchableOpacity>

        {/* ── Section 3: Banner Slider ── */}
        <BannerSlider banners={banners} loading={loading} />

        {/* ── Section 4: Active Order Card ── */}
        {isLoggedIn && isApprovedCustomer && activeOrder ? (() => {
          const cfg = statusConfig[activeOrder.status] || statusConfig.PENDING;
          return (
            <TouchableOpacity
              key="active-order"
              style={[styles.activeOrderCard, { borderRightColor: cfg.color, borderRightWidth: 4 }]}
              activeOpacity={0.8}
              onPress={() => router.push(`/orders/${activeOrder.id}`)}
            >
              <View style={styles.activeOrderIcon}>
                <Ionicons name={cfg.icon as any} size={24} color={cfg.color} />
              </View>
              <View style={styles.activeOrderContent}>
                <Text style={styles.activeOrderTitle}>سفارش شما {cfg.label} است</Text>
                <Text style={styles.activeOrderSubtitle}>
                  شماره سفارش: {fa(activeOrder.orderNumber || (activeOrder as any).order_number || '—')}
                </Text>
              </View>
              <Ionicons name="chevron-back" size={20} color={C.textSecondary} />
            </TouchableOpacity>
          );
        })() : null}

        {/* ── Section 5: Reorder Last Order Card ── */}
        {showReorderCard ? (
          <View style={styles.reorderCard}>
            <Text style={styles.reorderTitle}>آخرین سفارش شما</Text>
            <Text style={styles.reorderInfo}>
              {fa(latestOrder!.items?.length || 0)} قلم کالا | {formatPrice(latestOrder!.totalAmount || (latestOrder as any).final_total || 0)} تومان
            </Text>
            {latestOrder!.createdAt && (
              <Text style={styles.reorderDate}>
                ثبت شده در {new Intl.DateTimeFormat('fa-IR').format(new Date(latestOrder!.createdAt))}
              </Text>
            )}
            <TouchableOpacity
              style={[styles.reorderBtn, reorderLoading && { opacity: 0.6 }]}
              onPress={handleReorder}
              disabled={reorderLoading}
            >
              {reorderLoading ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Text style={styles.reorderBtnText}>🔄 تکرار سفارش</Text>
              )}
            </TouchableOpacity>
          </View>
        ) : null}

        {/* ── Guest Login Invitation ── */}
        {isGuest ? (
          <TouchableOpacity
            style={styles.loginCard}
            activeOpacity={0.8}
            onPress={() => router.push('/(auth)/login')}
          >
            <Ionicons name="storefront-outline" size={40} color={C.primary} />
            <Text style={styles.loginCardTitle}>برای مشاهده قیمت‌ها و ثبت سفارش وارد شوید</Text>
            <Text style={styles.loginCardSubtitle}>
              با ورود به حساب کاربری، قیمت محصولات و امکان سفارش‌گذاری برای شما فعال می‌شود.
            </Text>
            <View style={styles.loginCardBtn}>
              <Text style={styles.loginCardBtnText}>ورود / ثبت‌نام</Text>
            </View>
          </TouchableOpacity>
        ) : null}

        {/* ── Pending Approval Card ── */}
        {isLoggedIn && isPendingCustomer ? (
          <View style={styles.pendingCard}>
            <Ionicons name="hourglass-outline" size={36} color={C.warningText} />
            <Text style={styles.pendingCardTitle}>حساب شما در انتظار تایید است</Text>
            <Text style={styles.pendingCardSubtitle}>
              پس از تایید توسط تیم ما، امکان مشاهده قیمت‌ها و ثبت سفارش فعال می‌شود.
            </Text>
            <TouchableOpacity
              style={styles.pendingCardBtn}
              onPress={() => Linking.openURL('tel:')}
            >
              <Text style={styles.pendingCardBtnText}>تماس با پشتیبانی</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* ── Section 6: Categories ── */}
        <View style={styles.section}>
          <SectionHeader title="دسته‌بندی‌ها" />
          {loading ? (
            <View style={styles.categoriesGrid}>
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <View key={i} style={styles.categoryItem}>
                  <Skeleton width={64} height={64} borderRadius={0} />
                  <Skeleton width={56} height={12} borderRadius={4} style={{ marginTop: 6 }} />
                </View>
              ))}
            </View>
          ) : categories.length > 0 ? (
            <View style={styles.categoriesGrid}>
              {categories.map((cat) => (
                <TouchableOpacity
                  key={cat.id}
                  style={styles.categoryItem}
                  activeOpacity={0.7}
                  onPress={() => router.push(`/(tabs)/browse?categoryId=${cat.id}`)}
                >
                  <View style={styles.categoryImageContainer}>
                    {cat.imageUrl ? (
                      <Image source={{ uri: buildUrl(cat.imageUrl) }} style={styles.categoryImage} />
                    ) : (
                      <View style={[styles.categoryImage, { alignItems: 'center', justifyContent: 'center', backgroundColor: C.background }]}>
                        <Ionicons name="grid-outline" size={24} color={C.textTertiary} />
                      </View>
                    )}
                  </View>
                  <Text style={styles.categoryName}>{cat.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : null}
        </View>

        {/* ── Section 7: Featured Products (max 2 sections) ── */}
        {visibleSections.map((sec) => (
          <View key={sec.key} style={styles.section}>
            <SectionHeader title={sec.title} onSeeAll={() => router.push(`/(tabs)/browse?filter=${sec.filter}`)} />
            <ProductRow products={sec.products} loading={false} />
          </View>
        ))}

        {/* ── Error State ── */}
        {error && !loading ? (
          <View style={styles.errorContainer}>
            <Ionicons name="cloud-offline-outline" size={48} color={C.textTertiary} />
            <Text style={styles.errorTitle}>خطا در بارگذاری اطلاعات</Text>
            <Text style={styles.errorSubtitle}>لطفاً اتصال اینترنت خود را بررسی کنید و دوباره تلاش کنید.</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={loadData}>
              <Text style={styles.retryBtnText}>تلاش مجدد</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <View style={{ height: 20 }} />
      </ScrollView>

      {/* ── Reorder Summary Sheet ── */}
      {showReorderSheet && reorderSummary && (
        <ReorderSheet
          visible={showReorderSheet}
          summary={reorderSummary}
          onClose={() => setShowReorderSheet(false)}
          onViewCart={() => { setShowReorderSheet(false); router.push('/(tabs)/cart'); }}
        />
      )}

      {/* ── Cart Conflict Dialog ── */}
      {showCartConflict && (
        <CartConflictDialog
          visible={showCartConflict}
          onAdd={() => executeReorder('add')}
          onReplace={() => executeReorder('replace')}
          onCancel={() => setShowCartConflict(false)}
        />
      )}
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════════

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: C.background },

  // ── Header ──
  header: {
    flexDirection: 'row-reverse', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 8, marginBottom: 12, alignItems: 'center',
  },
  userInfo: { alignItems: 'flex-end' },
  greetingText: { fontSize: 14, color: C.textSecondary, ...Fonts.regular },
  storeName: { fontSize: 17, color: C.textPrimary, ...Fonts.bold },
  notifButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  notifBadge: {
    position: 'absolute', top: 6, right: 6,
    minWidth: 16, height: 16, borderRadius: 8,
    backgroundColor: C.error, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4,
  },
  notifBadgeText: { color: '#FFF', fontSize: 9, ...Fonts.bold },

  // ── Search ──
  searchBar: {
    flexDirection: 'row-reverse', alignItems: 'center', height: 40,
    backgroundColor: C.card, marginHorizontal: 16, paddingHorizontal: 12,
    borderRadius: 12, borderWidth: 1, borderColor: C.border, marginBottom: 16,
  },
  searchPlaceholder: { marginRight: 10, color: C.textTertiary, fontSize: 14, ...Fonts.regular },

  // ── Banners ──
  sliderContainer: { marginBottom: 20 },
  bannerCard: { width: SCREEN_WIDTH - 32, height: 170, marginHorizontal: 16, borderRadius: 16, overflow: 'hidden' },
  bannerImage: { width: '100%', height: '100%' },
  pagination: { flexDirection: 'row', justifyContent: 'center', marginTop: 8 },
  dot: { height: 6, borderRadius: 3, marginHorizontal: 3 },
  dotActive: { width: 20, backgroundColor: C.primary },
  dotInactive: { width: 8, backgroundColor: C.disabled },

  // ── Active Order Card ──
  activeOrderCard: {
    flexDirection: 'row-reverse', alignItems: 'center',
    backgroundColor: C.primaryLight, marginHorizontal: 16, padding: 16,
    borderRadius: 16, marginBottom: 12,
  },
  activeOrderIcon: { marginLeft: 12 },
  activeOrderContent: { flex: 1, alignItems: 'flex-end' },
  activeOrderTitle: { fontSize: 14, color: C.primaryDark, ...Fonts.semiBold },
  activeOrderSubtitle: { fontSize: 12, color: C.textSecondary, marginTop: 2 },

  // ── Reorder Card ──
  reorderCard: {
    backgroundColor: C.card, marginHorizontal: 16, padding: 16,
    borderRadius: 16, marginBottom: 12,
    borderWidth: 1, borderColor: C.border,
  },
  reorderTitle: { fontSize: 14, color: C.textPrimary, textAlign: 'right', ...Fonts.semiBold },
  reorderInfo: { fontSize: 13, color: C.textSecondary, marginTop: 4, textAlign: 'right' },
  reorderDate: { fontSize: 12, color: C.textTertiary, marginTop: 2, textAlign: 'right' },
  reorderBtn: {
    backgroundColor: C.accent, height: 40, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center', marginTop: 12,
  },
  reorderBtnText: { color: '#FFF', fontSize: 14, ...Fonts.bold },

  // ── Guest Login Card ──
  loginCard: {
    backgroundColor: C.primaryLight, marginHorizontal: 16, padding: 20,
    borderRadius: 16, marginBottom: 12, alignItems: 'center',
  },
  loginCardTitle: { fontSize: 14, color: C.primaryDark, marginTop: 12, textAlign: 'center', ...Fonts.semiBold },
  loginCardSubtitle: { fontSize: 12, color: C.textSecondary, marginTop: 6, textAlign: 'center', lineHeight: 20 },
  loginCardBtn: {
    backgroundColor: C.primary, height: 44, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center', marginTop: 16, width: '100%',
  },
  loginCardBtnText: { color: '#FFF', fontSize: 14, ...Fonts.bold },

  // ── Pending Card ──
  pendingCard: {
    backgroundColor: C.warningBg, marginHorizontal: 16, padding: 20,
    borderRadius: 16, marginBottom: 12, alignItems: 'center',
  },
  pendingCardTitle: { fontSize: 14, color: C.warningText, marginTop: 12, textAlign: 'center', ...Fonts.semiBold },
  pendingCardSubtitle: { fontSize: 12, color: C.warningText, marginTop: 6, textAlign: 'center', lineHeight: 20 },
  pendingCardBtn: {
    borderWidth: 1, borderColor: C.warningText, height: 40, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center', marginTop: 14, paddingHorizontal: 24,
  },
  pendingCardBtnText: { color: C.warningText, fontSize: 13, ...Fonts.bold },

  // ── Sections ──
  section: { marginBottom: 24 },
  sectionHeader: {
    flexDirection: 'row-reverse', justifyContent: 'space-between',
    alignItems: 'center', paddingHorizontal: 16, marginBottom: 12,
  },
  sectionTitle: { fontSize: 16, color: C.textPrimary, ...Fonts.semiBold },
  seeAll: { fontSize: 13, color: C.primary, ...Fonts.medium },

  // ── Categories (responsive 3×2 grid) ──
  categoriesGrid: { paddingHorizontal: 16, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-start' },
  categoryItem: {
    alignItems: 'center', width: (SCREEN_WIDTH - 32 - 16) / 3, marginBottom: 16,
    paddingHorizontal: 4,
  },
  categoryImageContainer: {
    width: 64, height: 64, backgroundColor: C.background, borderRadius: 0,
    borderWidth: 0, overflow: 'hidden',
  },
  categoryImage: { width: '100%', height: '100%' },
  categoryName: { fontSize: 12, color: C.textPrimary, marginTop: 6, textAlign: 'center', lineHeight: 17, ...Fonts.medium },

  // ── Product Row ──
  horizontalScroll: { paddingHorizontal: 16 },

  // ── Error ──
  errorContainer: { alignItems: 'center', paddingVertical: 40, paddingHorizontal: 32 },
  errorTitle: { fontSize: 16, color: C.textPrimary, marginTop: 12, textAlign: 'center', ...Fonts.semiBold },
  errorSubtitle: { fontSize: 13, color: C.textSecondary, marginTop: 6, textAlign: 'center', lineHeight: 20 },
  retryBtn: { backgroundColor: C.primary, paddingHorizontal: 32, paddingVertical: 12, borderRadius: 12, marginTop: 16 },
  retryBtnText: { color: '#FFF', fontSize: 14, ...Fonts.bold },

  // ── Bottom Sheets ──
  sheetOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end', zIndex: 100,
  },
  sheetContent: {
    backgroundColor: C.card, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 24, paddingBottom: 36,
  },
  sheetTitle: { fontSize: 16, color: C.textPrimary, textAlign: 'right', marginBottom: 12, ...Fonts.semiBold },
  sheetBody: { fontSize: 13, color: C.textSecondary, textAlign: 'right', marginBottom: 16, lineHeight: 20 },
  sheetLine: { fontSize: 13, textAlign: 'right', marginBottom: 6, ...Fonts.medium },
  sheetPrimaryBtn: {
    backgroundColor: C.accent, height: 48, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center', marginTop: 12,
  },
  sheetPrimaryBtnText: { color: '#FFF', fontSize: 15, ...Fonts.bold },
  sheetSecondaryBtn: { alignItems: 'center', marginTop: 12, paddingVertical: 8 },
  sheetSecondaryBtnText: { color: C.textSecondary, fontSize: 14 },
});
