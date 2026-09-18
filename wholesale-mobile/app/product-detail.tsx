import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Dimensions,
  ActivityIndicator,
  SafeAreaView,
  Platform,
  Modal,
  Pressable,
  Clipboard,
} from 'react-native';
import { notify } from '@/utils/notify';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { productsApi, type ProductDetail } from '@/api/productsApi';
import { useAuth } from '@/context/AuthContext';
import { useCart } from '@/context/CartContext';
import { useFavorites } from '@/context/FavoritesContext';
import { formatPrice } from '@/utils/format';
import { buildUrl } from '@/api/httpClient';
import Skeleton from '@/components/ui/Skeleton';
import ProductCard from '@/components/product/ProductCard';
import { Product } from '@/types/product';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// ─── Design System Colors ───────────────────────────────────────────
const C = {
  primary: '#2563EB',
  primaryDark: '#1D4ED8',
  primaryLight: '#DBEAFE',
  accent: '#10B981',
  accentLight: '#D1FAE5',
  background: '#F8FAFC',
  card: '#FFFFFF',
  textPrimary: '#0F172A',
  textSecondary: '#64748B',
  textTertiary: '#94A3B8',
  border: '#E2E8F0',
  disabled: '#CBD5E1',
  warning: '#F59E0B',
  warningBg: '#FEF3C7',
  warningText: '#92400E',
  error: '#EF4444',
  errorLight: '#FEE2E2',
  success: '#16A34A',
};

// ─── Helper: Persian numerals ───────────────────────────────────────
const fa = (n: number) => n.toLocaleString('fa-IR');

// ─── Full-Screen Image Viewer ───────────────────────────────────────
function ImageViewerModal({
  visible,
  images,
  initialIndex,
  onClose,
}: {
  visible: boolean;
  images: string[];
  initialIndex: number;
  onClose: () => void;
}) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    setCurrentIndex(initialIndex);
  }, [initialIndex]);

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={viewerStyles.container}>
        {/* Close button */}
        <TouchableOpacity style={viewerStyles.closeBtn} onPress={onClose} accessibilityLabel="بستن">
          <Ionicons name="close" size={28} color="#FFF" />
        </TouchableOpacity>

        {/* Counter */}
        {images.length > 1 && (
          <View style={viewerStyles.counter}>
            <Text style={viewerStyles.counterText}>
              {fa(currentIndex + 1)} / {fa(images.length)}
            </Text>
          </View>
        )}

        {/* Image carousel */}
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(e) => {
            const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
            setCurrentIndex(idx);
          }}
        >
          {images.map((img, i) => (
            <View key={i} style={{ width: SCREEN_WIDTH, height: SCREEN_HEIGHT * 0.7, justifyContent: 'center', alignItems: 'center' }}>
              <Image
                source={{ uri: buildUrl(img) }}
                style={{ width: SCREEN_WIDTH * 0.9, height: SCREEN_WIDTH * 0.9 }}
                resizeMode="contain"
              />
            </View>
          ))}
        </ScrollView>

        {/* Dots */}
        {images.length > 1 && (
          <View style={viewerStyles.dots}>
            {images.map((_, i) => (
              <View
                key={i}
                style={[viewerStyles.dot, i === currentIndex ? viewerStyles.dotActive : viewerStyles.dotInactive]}
              />
            ))}
          </View>
        )}
      </View>
    </Modal>
  );
}

const viewerStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', justifyContent: 'center' },
  closeBtn: { position: 'absolute', top: 50, left: 16, zIndex: 10, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  counter: { position: 'absolute', top: 56, alignSelf: 'center', zIndex: 10, backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
  counterText: { color: '#FFF', fontSize: 13, fontWeight: '600' },
  dots: { position: 'absolute', bottom: 40, flexDirection: 'row', justifyContent: 'center', alignSelf: 'center', gap: 6 },
  dot: { height: 6, borderRadius: 3 },
  dotActive: { width: 20, backgroundColor: '#FFF' },
  dotInactive: { width: 8, backgroundColor: 'rgba(255,255,255,0.3)' },
});

// ─── Skeleton Loader ────────────────────────────────────────────────
function ProductDetailSkeleton() {
  return (
    <View style={skeletonStyles.container}>
      {/* Image skeleton */}
      <Skeleton width={SCREEN_WIDTH} height={SCREEN_WIDTH * 0.85} borderRadius={0} />
      {/* Info card skeleton */}
      <View style={skeletonStyles.infoCard}>
        <View style={skeletonStyles.row}>
          <Skeleton width={80} height={14} borderRadius={4} />
          <Skeleton width={60} height={14} borderRadius={4} />
        </View>
        <Skeleton width="90%" height={20} borderRadius={4} style={{ marginTop: 12 }} />
        <Skeleton width="60%" height={20} borderRadius={4} style={{ marginTop: 6 }} />
        <Skeleton width={120} height={14} borderRadius={4} style={{ marginTop: 8 }} />
        <View style={[skeletonStyles.row, { marginTop: 16 }]}>
          <Skeleton width="100%" height={60} borderRadius={10} />
        </View>
        <Skeleton width="50%" height={28} borderRadius={4} style={{ marginTop: 16 }} />
        <Skeleton width="30%" height={14} borderRadius={4} style={{ marginTop: 8 }} />
      </View>
      {/* Description skeleton */}
      <View style={skeletonStyles.descCard}>
        <Skeleton width={120} height={18} borderRadius={4} />
        <Skeleton width="100%" height={14} borderRadius={4} style={{ marginTop: 12 }} />
        <Skeleton width="95%" height={14} borderRadius={4} style={{ marginTop: 6 }} />
        <Skeleton width="80%" height={14} borderRadius={4} style={{ marginTop: 6 }} />
        <Skeleton width="60%" height={14} borderRadius={4} style={{ marginTop: 6 }} />
      </View>
      {/* Similar skeleton */}
      <View style={skeletonStyles.similarCard}>
        <Skeleton width={120} height={18} borderRadius={4} />
        <View style={skeletonStyles.similarRow}>
          {[1, 2, 3].map(i => (
            <View key={i} style={skeletonStyles.similarItem}>
              <Skeleton width={140} height={120} borderRadius={10} />
              <Skeleton width={120} height={14} borderRadius={4} style={{ marginTop: 8 }} />
              <Skeleton width={80} height={14} borderRadius={4} style={{ marginTop: 4 }} />
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

const skeletonStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  infoCard: { padding: 20, backgroundColor: C.card },
  descCard: { marginTop: 8, padding: 20, backgroundColor: C.card },
  similarCard: { marginTop: 8, padding: 20, backgroundColor: C.card },
  row: { flexDirection: 'row-reverse', justifyContent: 'space-between' },
  similarRow: { flexDirection: 'row-reverse', marginTop: 12, gap: 12 },
  similarItem: { alignItems: 'flex-end' },
});

// ─── Error State ────────────────────────────────────────────────────
function ErrorState({ isNotFound, onRetry, onBack }: { isNotFound: boolean; onRetry?: () => void; onBack: () => void }) {
  return (
    <View style={errorStyles.container}>
      <Ionicons
        name={isNotFound ? 'search-outline' : 'cloud-offline-outline'}
        size={64}
        color={C.disabled}
      />
      <Text style={errorStyles.title}>
        {isNotFound ? 'محصول پیدا نشد' : 'خطا در بارگذاری محصول'}
      </Text>
      <Text style={errorStyles.subtitle}>
        {isNotFound
          ? 'این محصول ممکن است حذف شده یا در دسترس نباشد.'
          : 'لطفاً اتصال اینترنت خود را بررسی کنید.'}
      </Text>
      <View style={errorStyles.actions}>
        {!isNotFound && onRetry && (
          <TouchableOpacity style={errorStyles.retryBtn} onPress={onRetry} accessibilityLabel="تلاش مجدد">
            <Text style={errorStyles.retryBtnText}>تلاش مجدد</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity onPress={onBack} style={errorStyles.backLink} accessibilityLabel="بازگشت">
          <Text style={errorStyles.backLinkText}>
            {isNotFound ? 'بازگشت به محصولات' : 'بازگشت'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const errorStyles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, backgroundColor: C.background },
  title: { fontSize: 16, fontWeight: 'bold', color: C.textPrimary, marginTop: 16, textAlign: 'center' },
  subtitle: { fontSize: 13, color: C.textSecondary, marginTop: 8, textAlign: 'center', lineHeight: 20 },
  actions: { marginTop: 24, alignItems: 'center', gap: 12 },
  retryBtn: { backgroundColor: C.primary, paddingHorizontal: 32, paddingVertical: 12, borderRadius: 12 },
  retryBtnText: { color: '#FFF', fontSize: 14, fontWeight: 'bold' },
  backLink: { paddingVertical: 8 },
  backLinkText: { color: C.textSecondary, fontSize: 13, fontWeight: '600' },
});

// ─── Toast (simple inline) ──────────────────────────────────────────
function Toast({ message, visible }: { message: string; visible: boolean }) {
  if (!visible) return null;
  return (
    <View style={toastStyles.container}>
      <Text style={toastStyles.text}>{message}</Text>
    </View>
  );
}

const toastStyles = StyleSheet.create({
  container: {
    position: 'absolute', bottom: 100, alignSelf: 'center',
    backgroundColor: C.textPrimary, paddingHorizontal: 20, paddingVertical: 10,
    borderRadius: 10, zIndex: 999, elevation: 5,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4,
  },
  text: { color: '#FFF', fontSize: 13, fontWeight: '600' },
});

// ═══════════════════════════════════════════════════════════════════
// MAIN SCREEN
// ═══════════════════════════════════════════════════════════════════

export default function ProductDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { isLoggedIn, isApprovedCustomer, isPendingCustomer, isGuest } = useAuth();
  const { addToCart, updateQuantity, removeFromCart, items, totalItems: cartTotalItems } = useCart();
  const { isFavorite, toggleFavorite } = useFavorites();

  // ── State ──
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isNotFound, setIsNotFound] = useState(false);
  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [similarProducts, setSimilarProducts] = useState<Product[]>([]);
  const [similarLoading, setSimilarLoading] = useState(true);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [favLoading, setFavLoading] = useState(false);
  const [selectedQty, setSelectedQty] = useState(1);
  const [imageViewerVisible, setImageViewerVisible] = useState(false);
  const [imageViewerIndex, setImageViewerIndex] = useState(0);
  const [toastMsg, setToastMsg] = useState('');
  const [toastVisible, setToastVisible] = useState(false);

  // ── Cart sync ──
  const cartItem = useMemo(() => items.find(i => i.productId === product?.id), [items, product?.id]);
  const currentQty = cartItem?.quantity ?? 0;

  useEffect(() => {
    if (currentQty > 0) setSelectedQty(currentQty);
  }, [currentQty]);

  // ── Toast helper ──
  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 2500);
  }, []);

  // ── Load data ──
  const loadData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    setIsNotFound(false);
    try {
      const pData = await productsApi.getOne(id);
      if (!pData) {
        setIsNotFound(true);
        setLoading(false);
        return;
      }
      setProduct(pData);
      setLoading(false);

      // Load similar products separately (non-blocking)
      setSimilarLoading(true);
      try {
        const similar = await productsApi.getSimilar(id);
        setSimilarProducts(similar);
      } catch {
        setSimilarProducts([]);
      } finally {
        setSimilarLoading(false);
      }
    } catch (err: any) {
      if (err?.status === 404) {
        setIsNotFound(true);
      } else {
        setError('network');
      }
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Handlers ──
  const handleToggleFavorite = useCallback(async () => {
    if (!isLoggedIn) {
      showToast('برای افزودن به علاقه‌مندی‌ها وارد شوید');
      router.push('/(auth)/login');
      return;
    }
    if (!product || favLoading) return;

    // Optimistic update
    const prev = product.isFavorited;
    setProduct({ ...product, isFavorited: !prev });
    setFavLoading(true);
    try {
      await productsApi.toggleFavorite(product.id);
      // Sync with FavoritesContext
      toggleFavorite(product as any);
    } catch {
      // Revert
      setProduct({ ...product, isFavorited: prev });
      showToast('خطا در ذخیره علاقه‌مندی');
    } finally {
      setFavLoading(false);
    }
  }, [product, isLoggedIn, favLoading, toggleFavorite, router, showToast]);

  const handleAddToCart = useCallback(async () => {
    if (!isLoggedIn) {
      router.push('/(auth)/login');
      return;
    }
    if (!product || actionLoading) return;

    setActionLoading(true);
    try {
      if (currentQty === 0) {
        await addToCart(product, selectedQty);
      } else {
        await updateQuantity(product.id, selectedQty - currentQty);
      }
      showToast('به سبد خرید اضافه شد');
    } catch (err: any) {
      const msg = err?.data?.message || err?.message || 'خطا در افزودن به سبد';
      notify('خطا', typeof msg === 'string' ? msg : 'خطا در افزودن به سبد');
    } finally {
      setActionLoading(false);
    }
  }, [product, isLoggedIn, actionLoading, currentQty, selectedQty, addToCart, updateQuantity, router, showToast]);

  const handleRemoveFromCart = useCallback(async () => {
    if (!product || actionLoading) return;
    setActionLoading(true);
    try {
      await removeFromCart(product.id);
      setSelectedQty(1);
      showToast('از سبد خرید حذف شد');
    } catch {
      showToast('خطا در حذف از سبد');
    } finally {
      setActionLoading(false);
    }
  }, [product, actionLoading, removeFromCart, showToast]);

  const adjustQty = useCallback((delta: number) => {
    if (!product) return;
    const next = selectedQty + delta;
    if (next < 1) return;
    if (next > product.stock) {
      showToast('موجودی این محصول محدود است');
      return;
    }
    setSelectedQty(next);
  }, [product, selectedQty, showToast]);

  const handleCopyProductCode = useCallback(() => {
    if (!product?.productCode) return;
    Clipboard.setString(product.productCode);
    showToast('کد محصول کپی شد');
  }, [product, showToast]);

  const handleImageTap = useCallback((index: number) => {
    setImageViewerIndex(index);
    setImageViewerVisible(true);
  }, []);

  const handleCategoryTap = useCallback(() => {
    if (!product) return;
    router.push({ pathname: '/(tabs)/browse', params: { categoryId: product.category.id } });
  }, [product, router]);

  // ── Derived values ──
  const images = useMemo(() => {
    if (!product) return [];
    return product.images && product.images.length > 0 ? product.images : [product.imageUrl || ''];
  }, [product]);

  const isOutOfStock = product?.stock === 0;
  const isLowStock = product ? product.stock > 0 && product.stock <= 5 : false;
  const isFavorited = product ? (isFavorite(product.id) || product.isFavorited) : false;

  const discountPercentage = useMemo(() => {
    if (!product || !product.isDiscounted || !product.oldPrice || product.price == null) return null;
    return Math.round(((product.oldPrice - product.price) / product.oldPrice) * 100);
  }, [product]);

  // ── Loading state ──
  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.appBar}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} accessibilityLabel="بازگشت">
            <Ionicons name="arrow-forward" size={24} color={C.textPrimary} />
          </TouchableOpacity>
          <View style={styles.appBarActions}>
            <View style={styles.iconBtnPlaceholder} />
            <View style={styles.iconBtnPlaceholder} />
          </View>
        </View>
        <ProductDetailSkeleton />
      </SafeAreaView>
    );
  }

  // ── Error states ──
  if (isNotFound) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.appBar}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} accessibilityLabel="بازگشت">
            <Ionicons name="arrow-forward" size={24} color={C.textPrimary} />
          </TouchableOpacity>
        </View>
        <ErrorState isNotFound onBack={() => router.back()} />
      </SafeAreaView>
    );
  }

  if (error || !product) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.appBar}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} accessibilityLabel="بازگشت">
            <Ionicons name="arrow-forward" size={24} color={C.textPrimary} />
          </TouchableOpacity>
        </View>
        <ErrorState isNotFound={false} onRetry={loadData} onBack={() => router.back()} />
      </SafeAreaView>
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════
  return (
    <SafeAreaView style={styles.container}>
      {/* ── Section 1: Custom App Bar ── */}
      <View style={styles.appBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} accessibilityLabel="بازگشت">
          <Ionicons name="arrow-forward" size={24} color={C.textPrimary} />
        </TouchableOpacity>
        <View style={styles.appBarActions}>
          <TouchableOpacity
            style={styles.cartBtn}
            onPress={() => router.push('/(tabs)/cart')}
            accessibilityLabel="رفتن به سبد خرید"
          >
            <View>
              <Ionicons name="cart-outline" size={22} color={C.textPrimary} />
              {cartTotalItems > 0 && (
                <View style={styles.cartBadge}>
                  <Text style={styles.cartBadgeText}>{fa(cartTotalItems)}</Text>
                </View>
              )}
            </View>
            <Text style={styles.cartBtnText}>سبد خرید</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn} onPress={handleToggleFavorite} accessibilityLabel={isFavorited ? 'حذف از علاقه‌مندی‌ها' : 'افزودن به علاقه‌مندی‌ها'}>
            <View>
              <Ionicons
                name={isFavorited ? 'heart' : 'heart-outline'}
                size={22}
                color={isFavorited ? C.error : C.textSecondary}
              />
            </View>
            <Text style={styles.cartBtnText}>علاقه‌مندی</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* ── Section 2: Product Images ── */}
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => handleImageTap(activeImageIndex)}
          style={styles.imageSection}
        >
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={(e) => {
              const x = e.nativeEvent.contentOffset.x;
              setActiveImageIndex(Math.round(x / SCREEN_WIDTH));
            }}
            scrollEventThrottle={16}
          >
            {images.map((img, i) => (
              <View key={i} style={styles.imageWrapper}>
                <Image source={{ uri: buildUrl(img) }} style={styles.mainImage} resizeMode="contain" />
              </View>
            ))}
          </ScrollView>

          {/* Pagination dots */}
          {images.length > 1 && (
            <View style={styles.pagination}>
              {images.map((_, i) => (
                <View key={i} style={[styles.dot, i === activeImageIndex ? styles.dotActive : styles.dotInactive]} />
              ))}
            </View>
          )}

          {/* Image counter */}
          {images.length > 1 && (
            <View style={styles.imageCounter}>
              <Text style={styles.imageCounterText}>{fa(activeImageIndex + 1)} / {fa(images.length)}</Text>
            </View>
          )}

          {/* Badges (top-right, single most relevant) */}
          <View style={styles.badgeOverlay}>
            {product.isDiscounted && discountPercentage ? (
              <View style={[styles.badge, { backgroundColor: C.error }]}>
                <Text style={styles.badgeText}>{fa(discountPercentage)}٪ تخفیف</Text>
              </View>
            ) : product.isNew ? (
              <View style={[styles.badge, { backgroundColor: C.primary }]}>
                <Text style={styles.badgeText}>جدید</Text>
              </View>
            ) : product.isFeatured ? (
              <View style={[styles.badge, { backgroundColor: C.accent }]}>
                <Text style={styles.badgeText}>پیشنهادی</Text>
              </View>
            ) : null}
          </View>

          {/* Out of stock overlay */}
          {isOutOfStock && (
            <View style={styles.outOfStockOverlay}>
              <View style={styles.outOfStockPill}>
                <Text style={styles.outOfStockText}>ناموجود</Text>
              </View>
            </View>
          )}
        </TouchableOpacity>

        {/* ── Section 3: Product Info Card ── */}
        <View style={styles.infoCard}>
          {/* 3.1: Category + Product Code */}
          <View style={styles.categoryRow}>
            <TouchableOpacity style={styles.categoryBadge} onPress={handleCategoryTap} accessibilityLabel={`دسته‌بندی ${product.category.name}`}>
              <Ionicons name="pricetag-outline" size={14} color={C.textSecondary} />
              <Text style={styles.categoryName}>{product.category.name}</Text>
            </TouchableOpacity>
            {product.productCode ? (
              <TouchableOpacity onLongPress={handleCopyProductCode} accessibilityLabel="کد محصول">
                <Text style={styles.productCode}>کد: {product.productCode}</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          {/* 3.2: Product Name */}
          <Text style={styles.productName} numberOfLines={3}>{product.name}</Text>

          {/* 3.3: Brand */}
          {product.brand ? (
            <Text style={styles.brandName}>برند: {product.brand}</Text>
          ) : null}

          {/* 3.4: Unit Info Box */}
          <View style={styles.unitBox}>
            <View style={styles.unitRow}>
              <Ionicons name="cube-outline" size={16} color={C.primary} />
              <Text style={styles.unitLabel}>واحد فروش:</Text>
              <Text style={styles.unitValue}>{product.unit}</Text>
            </View>
            {product.unitDetails ? (
              <Text style={styles.unitDetails}>{product.unitDetails}</Text>
            ) : null}
          </View>

          {/* 3.5: Price Section */}
          <View style={styles.priceSection}>
            {isLoggedIn && isApprovedCustomer ? (
              <View>
                {/* Old price row (if discounted) */}
                {product.isDiscounted && product.oldPrice ? (
                  <View style={styles.oldPriceRow}>
                    <Text style={styles.oldPriceLabel}>قیمت قبلی:</Text>
                    <Text style={styles.oldPriceValue}>{formatPrice(product.oldPrice)} تومان</Text>
                    <View style={styles.discountPill}>
                      <Text style={styles.discountPillText}>{fa(discountPercentage || 0)}٪ تخفیف</Text>
                    </View>
                  </View>
                ) : null}

                {/* Main price */}
                <View style={styles.mainPriceRow}>
                  <Text style={styles.mainPriceLabel}>قیمت واحد:</Text>
                  <Text style={styles.mainPriceValue}>{formatPrice(product.price)} تومان</Text>
                </View>

                {/* Savings */}
                {product.isDiscounted && product.oldPrice ? (
                  <Text style={styles.savingsText}>
                    شما {formatPrice(product.oldPrice - (product.price ?? 0))} تومان صرفه‌جویی می‌کنید
                  </Text>
                ) : null}
              </View>
            ) : isLoggedIn && isPendingCustomer ? (
              <View style={styles.pendingPriceBox}>
                <Ionicons name="hourglass-outline" size={20} color={C.warningText} />
                <View style={{ marginRight: 10, flex: 1 }}>
                  <Text style={styles.pendingPriceTitle}>حساب شما در انتظار تایید است</Text>
                  <Text style={styles.pendingPriceSub}>پس از تایید، قیمت محصولات نمایش داده می‌شود.</Text>
                </View>
              </View>
            ) : (
              <View style={styles.guestPriceBox}>
                <Ionicons name="lock-closed-outline" size={20} color={C.primary} />
                <View style={{ flex: 1, marginRight: 10 }}>
                  <Text style={styles.guestPriceTitle}>برای مشاهده قیمت وارد حساب کاربری شوید</Text>
                  <TouchableOpacity onPress={() => router.push('/(auth)/login')} accessibilityLabel="ورود / ثبت‌نام">
                    <Text style={styles.guestPriceLink}>ورود / ثبت‌نام</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>

          {/* 3.6: Stock Status */}
          {product.stock === 0 ? (
            <View style={styles.stockStatus}>
              <Ionicons name="close-circle-outline" size={16} color={C.textTertiary} />
              <Text style={[styles.stockText, { color: C.textTertiary }]}>این محصول در حال حاضر ناموجود است</Text>
            </View>
          ) : isLowStock ? (
            <View style={styles.stockStatus}>
              <Ionicons name="warning-outline" size={16} color={C.warning} />
              <Text style={[styles.stockText, { color: C.warning }]}>فقط {fa(product.stock)} عدد باقی مانده</Text>
            </View>
          ) : null}
        </View>

        {/* ── Section 4: Description ── */}
        {product.description ? (
          <View style={styles.descriptionSection}>
            <Text style={styles.sectionTitle}>توضیحات محصول</Text>
            <Text
              style={styles.descriptionText}
              numberOfLines={isDescriptionExpanded ? undefined : 5}
            >
              {product.description}
            </Text>
            {product.description.length > 200 && (
              <TouchableOpacity onPress={() => setIsDescriptionExpanded(!isDescriptionExpanded)}>
                <Text style={styles.expandBtn}>{isDescriptionExpanded ? 'بستن' : 'مشاهده بیشتر'}</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : null}

        {/* ── Section 5: Similar Products ── */}
        {similarLoading ? (
          <View style={styles.similarSection}>
            <View style={styles.sectionHeader}>
              <Skeleton width={120} height={18} borderRadius={4} />
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.similarScroll}>
              {[1, 2, 3, 4].map(i => (
                <View key={i} style={{ width: 155, marginRight: 12 }}>
                  <Skeleton width={155} height={130} borderRadius={10} />
                  <Skeleton width={130} height={14} borderRadius={4} style={{ marginTop: 8 }} />
                  <Skeleton width={80} height={14} borderRadius={4} style={{ marginTop: 4 }} />
                </View>
              ))}
            </ScrollView>
          </View>
        ) : similarProducts.length > 0 ? (
          <View style={styles.similarSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>محصولات مشابه</Text>
              <TouchableOpacity onPress={handleCategoryTap}>
                <Text style={styles.seeAll}>مشاهده همه</Text>
              </TouchableOpacity>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.similarScroll}>
              {similarProducts.filter(p => p && p.id).map(p => (
                <View key={p.id} style={{ width: 155 }}>
                  <ProductCard product={p} />
                </View>
              ))}
            </ScrollView>
          </View>
        ) : null}

        {/* Bottom spacer */}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* ── Section 6: Bottom Action Bar ── */}
      <View style={styles.bottomBar}>
        {isLoggedIn && isApprovedCustomer ? (
          isOutOfStock ? (
            /* State B: Out of stock */
            <View style={styles.fullWidthBtnDisabled}>
              <Text style={styles.fullWidthBtnTextDisabled}>ناموجود</Text>
            </View>
          ) : (
            /* State A: Verified + in stock */
            <View style={styles.actionRow}>
              <View style={styles.qtyContainer}>
                <Text style={styles.qtyLabel}>تعداد</Text>
                <View style={styles.stepper}>
                  <TouchableOpacity
                    style={styles.stepBtn}
                    onPress={() => adjustQty(1)}
                    disabled={selectedQty >= product.stock}
                    accessibilityLabel="افزایش تعداد"
                  >
                    <Ionicons name="add" size={20} color={selectedQty >= product.stock ? C.disabled : C.textPrimary} />
                  </TouchableOpacity>
                  <Text style={styles.qtyValue}>{fa(selectedQty)}</Text>
                  <TouchableOpacity
                    style={styles.stepBtn}
                    onPress={() => adjustQty(-1)}
                    disabled={selectedQty <= 1}
                    accessibilityLabel="کاهش تعداد"
                  >
                    <Ionicons name="remove" size={20} color={selectedQty <= 1 ? C.disabled : C.textPrimary} />
                  </TouchableOpacity>
                </View>
              </View>
              <View style={{ flex: 1 }}>
                <TouchableOpacity
                  style={[styles.mainActionBtn, actionLoading && { opacity: 0.7 }]}
                  onPress={handleAddToCart}
                  disabled={actionLoading}
                  accessibilityLabel={currentQty === 0 ? 'افزودن به سبد خرید' : 'به‌روزرسانی سبد'}
                >
                  {actionLoading ? (
                    <ActivityIndicator color="#FFF" size="small" />
                  ) : (
                    <>
                      <Ionicons name="cart-outline" size={18} color="#FFF" style={{ marginLeft: 6 }} />
                      <Text style={styles.mainActionText}>
                        {currentQty === 0
                          ? 'افزودن به سبد خرید'
                          : `به‌روزرسانی (${fa(currentQty)} در سبد)`}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
                {currentQty > 0 && !actionLoading && (
                  <TouchableOpacity onPress={handleRemoveFromCart} style={styles.removeBtn} accessibilityLabel="حذف از سبد">
                    <Text style={styles.removeBtnText}>حذف از سبد</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )
        ) : !isLoggedIn ? (
          /* State C: Guest */
          <TouchableOpacity
            style={styles.mainActionBtn}
            onPress={() => router.push('/(auth)/login')}
            accessibilityLabel="ورود برای مشاهده قیمت و سفارش"
          >
            <Text style={styles.mainActionText}>ورود برای مشاهده قیمت و سفارش</Text>
          </TouchableOpacity>
        ) : isPendingCustomer ? (
          /* State D: Pending */
          <View style={[styles.fullWidthBtnDisabled, { backgroundColor: C.warningBg }]}>
            <Text style={[styles.fullWidthBtnTextDisabled, { color: C.warningText }]}>حساب شما در انتظار تایید است</Text>
          </View>
        ) : null}
      </View>

      {/* ── Image Viewer Modal ── */}
      <ImageViewerModal
        visible={imageViewerVisible}
        images={images}
        initialIndex={imageViewerIndex}
        onClose={() => setImageViewerVisible(false)}
      />

      {/* ── Toast ── */}
      <Toast message={toastMsg} visible={toastVisible} />
    </SafeAreaView>
  );
}

// ═══════════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════════

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.card },

  // ── App Bar ──
  appBar: {
    height: 56,
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    backgroundColor: C.card,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: C.background, borderRadius: 22 },
  appBarActions: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8 },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  iconBtnPlaceholder: { width: 44, height: 44 },
  cartBtn: { minWidth: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  cartBadge: {
    position: 'absolute', top: -4, right: -8,
    backgroundColor: C.error, minWidth: 16, height: 16,
    borderRadius: 8, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3,
  },
  cartBadgeText: { color: '#FFF', fontSize: 9, fontWeight: 'bold' },
  cartBtnText: { fontSize: 9, fontWeight: '600', color: C.textSecondary, marginTop: 1 },

  // ── Scroll ──
  scrollContent: { paddingBottom: 0 },

  // ── Image Section ──
  imageSection: { width: SCREEN_WIDTH, height: SCREEN_WIDTH * 0.85, backgroundColor: C.background, position: 'relative' },
  imageWrapper: { width: SCREEN_WIDTH, height: SCREEN_WIDTH * 0.85, justifyContent: 'center', alignItems: 'center' },
  mainImage: { width: '90%', height: '90%' },
  pagination: {
    position: 'absolute', bottom: 16, width: '100%',
    flexDirection: 'row', justifyContent: 'center', gap: 6,
  },
  dot: { height: 6, borderRadius: 3 },
  dotActive: { width: 20, backgroundColor: C.primary },
  dotInactive: { width: 8, backgroundColor: 'rgba(255,255,255,0.3)' },
  imageCounter: {
    position: 'absolute', top: 16, left: 16,
    backgroundColor: 'rgba(0,0,0,0.4)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10,
  },
  imageCounterText: { color: '#FFF', fontSize: 12, fontWeight: '600' },
  badgeOverlay: { position: 'absolute', top: 16, right: 16 },
  badge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  badgeText: { color: '#FFF', fontSize: 12, fontWeight: 'bold' },
  outOfStockOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(148, 163, 184, 0.4)',
    justifyContent: 'center', alignItems: 'center',
  },
  outOfStockPill: { backgroundColor: C.textTertiary, paddingHorizontal: 20, paddingVertical: 8, borderRadius: 12 },
  outOfStockText: { color: '#FFF', fontSize: 20, fontWeight: 'bold' },

  // ── Info Card ──
  infoCard: { padding: 20, backgroundColor: C.card },
  categoryRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' },
  categoryBadge: { flexDirection: 'row-reverse', alignItems: 'center', gap: 4 },
  categoryName: { fontSize: 12, color: C.textSecondary },
  productCode: { fontSize: 12, color: C.textTertiary },
  productName: { fontSize: 18, fontWeight: 'bold', color: C.textPrimary, marginTop: 8, textAlign: 'right', lineHeight: 26 },
  brandName: { fontSize: 13, color: C.textSecondary, marginTop: 4, textAlign: 'right' },
  unitBox: { backgroundColor: C.background, borderRadius: 10, padding: 12, marginTop: 16 },
  unitRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6 },
  unitLabel: { fontSize: 12, color: C.textSecondary },
  unitValue: { fontSize: 13, fontWeight: 'bold', color: C.textPrimary },
  unitDetails: { fontSize: 12, color: C.textSecondary, marginTop: 4, textAlign: 'right', lineHeight: 18 },

  // ── Price Section ──
  priceSection: { marginTop: 16 },
  oldPriceRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8, marginBottom: 4 },
  oldPriceLabel: { fontSize: 11, color: C.textTertiary },
  oldPriceValue: { fontSize: 14, color: C.textTertiary, textDecorationLine: 'line-through' },
  discountPill: { backgroundColor: C.errorLight, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  discountPillText: { color: C.error, fontSize: 11, fontWeight: 'bold' },
  mainPriceRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8, marginTop: 6 },
  mainPriceLabel: { fontSize: 12, color: C.textSecondary },
  mainPriceValue: { fontSize: 22, fontWeight: 'bold', color: C.textPrimary },
  savingsText: { fontSize: 12, color: C.accent, marginTop: 4, textAlign: 'right' },
  guestPriceBox: { backgroundColor: C.primaryLight, borderRadius: 10, padding: 14, flexDirection: 'row-reverse', alignItems: 'center' },
  guestPriceTitle: { fontSize: 13, fontWeight: '500', color: C.primaryDark, textAlign: 'right' },
  guestPriceLink: { fontSize: 14, fontWeight: 'bold', color: C.primary, marginTop: 4, textAlign: 'right' },
  pendingPriceBox: { backgroundColor: C.warningBg, borderRadius: 10, padding: 14, flexDirection: 'row-reverse', alignItems: 'center' },
  pendingPriceTitle: { fontSize: 13, fontWeight: 'bold', color: C.warningText, textAlign: 'right' },
  pendingPriceSub: { fontSize: 12, color: C.warningText, textAlign: 'right', marginTop: 2 },

  // ── Stock Status ──
  stockStatus: { flexDirection: 'row-reverse', alignItems: 'center', marginTop: 12, gap: 6 },
  stockText: { fontSize: 13, fontWeight: '500' },

  // ── Description ──
  descriptionSection: { marginTop: 8, padding: 20, backgroundColor: C.card },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: C.textPrimary, marginBottom: 12, textAlign: 'right' },
  descriptionText: { fontSize: 14, color: '#334155', textAlign: 'right', lineHeight: 24 },
  expandBtn: { color: C.primary, fontSize: 13, fontWeight: '500', marginTop: 8, textAlign: 'right' },

  // ── Similar Products ──
  similarSection: { marginTop: 8, backgroundColor: C.card, paddingVertical: 20 },
  sectionHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 12 },
  seeAll: { fontSize: 13, color: C.primary, fontWeight: '500' },
  similarScroll: { paddingHorizontal: 14 },

  // ── Bottom Action Bar ──
  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: C.card, borderTopWidth: 1, borderTopColor: C.border,
    paddingHorizontal: 16, paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 28 : 12,
  },
  actionRow: { flexDirection: 'row-reverse', alignItems: 'flex-end', gap: 16 },
  qtyContainer: { width: 130 },
  qtyLabel: { fontSize: 11, color: C.textSecondary, textAlign: 'right', marginBottom: 6, marginRight: 4 },
  stepper: {
    flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: C.background, borderWidth: 1, borderColor: C.border,
    borderRadius: 12, height: 48, paddingHorizontal: 4,
  },
  stepBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  qtyValue: { fontSize: 18, fontWeight: 'bold', color: C.textPrimary },
  mainActionBtn: {
    flex: 1, backgroundColor: C.primary, height: 52, borderRadius: 12,
    flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center',
  },
  mainActionText: { color: '#FFF', fontSize: 15, fontWeight: 'bold' },
  removeBtn: { marginTop: 4, alignItems: 'center' },
  removeBtnText: { color: C.error, fontSize: 12 },
  fullWidthBtnDisabled: {
    backgroundColor: C.disabled, height: 52, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  fullWidthBtnTextDisabled: { color: C.textSecondary, fontSize: 14, fontWeight: 'bold' },
});
