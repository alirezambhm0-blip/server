// app/(tabs)/cart.tsx
// صفحه سبد خرید — بازنویسی کامل مطابق اسپک

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
  Image,
  RefreshControl,
  ActivityIndicator,
  TextInput,
  Modal,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';

import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import { cartApi } from '@/api/cartApi';
import { placeOrderApi, getLatestOrderApi, reorderApi } from '@/api/ordersApi';
import { formatPrice } from '@/utils/format';
import { buildUrl } from '@/api/httpClient';
import { notify } from '@/utils/notify';
import Skeleton from '@/components/ui/Skeleton';
import { Product } from '@/types/product';

const C = {
  primary: '#2563EB',
  primaryDark: '#1D4ED8',
  primaryLight: '#DBEAFE',
  background: '#F8FAFC',
  card: '#FFFFFF',
  textPrimary: '#0F172A',
  textSecondary: '#64748B',
  textTertiary: '#94A3B8',
  border: '#E2E8F0',
  disabled: '#CBD5E1',
  error: '#EF4444',
  errorLight: '#FEE2E2',
  warning: '#F59E0B',
  warningLight: '#FEF3C7',
  warningText: '#92400E',
  accent: '#10B981',
  accentLight: '#D1FAE5',
};

const fa = (n: number | string) => String(n).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]);

// ─── Skeleton Loader ────────────────────────────────────────────────
function CartSkeleton() {
  return (
    <View style={{ padding: 16 }}>
      {[1, 2, 3].map(i => (
        <View key={i} style={styles.itemCard}>
          <Skeleton width={72} height={72} borderRadius={10} />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Skeleton width="80%" height={14} borderRadius={4} />
            <Skeleton width="50%" height={12} borderRadius={4} style={{ marginTop: 6 }} />
            <Skeleton width="40%" height={16} borderRadius={4} style={{ marginTop: 8 }} />
          </View>
        </View>
      ))}
    </View>
  );
}

/**
 * B19 — کلید یکتا برای هر تلاش واقعی checkout.
 * سمت کلاینت ساخته می‌شود و تا «موفقیت همان attempt» ثابت می‌ماند تا Double Tap
 * یا Retry به‌جای ساخت سفارش دوم، همان سفارش اول را از سرور برگرداند.
 */
function generateIdempotencyKey(): string {
  const rand = () => Math.random().toString(36).slice(2, 10);
  return `chk-${Date.now().toString(36)}-${rand()}${rand()}`;
}

// ═══════════════════════════════════════════════════════════════════
// MAIN SCREEN
// ═══════════════════════════════════════════════════════════════════

export default function CartScreen() {
  const router = useRouter();
  const { isLoggedIn, isApprovedCustomer, isPendingCustomer, isGuest, customer } = useAuth();
  const { items, updateQuantity, removeFromCart, clearCart, isLoading, refreshCart } = useCart();

  // ── Order flow state ──
  const [orderNote, setOrderNote] = useState('');
  const [altAddress, setAltAddress] = useState('');
  const [useAltAddress, setUseAltAddress] = useState(false);
  const [showAddressSheet, setShowAddressSheet] = useState(false);
  const [showConfirmSheet, setShowConfirmSheet] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [latestOrder, setLatestOrder] = useState<any>(null);
  const [reorderLoading, setReorderLoading] = useState(false);
  // B19 — کلید attempt جاری؛ null یعنی attempt معلقی وجود ندارد
  const idempotencyKeyRef = useRef<string | null>(null);

  // ── Load latest order for empty state ──
  useEffect(() => {
    if (isLoggedIn && isApprovedCustomer) {
      getLatestOrderApi().then(setLatestOrder).catch(() => {});
    }
  }, [isLoggedIn, isApprovedCustomer]);

  useFocusEffect(
    useCallback(() => {
      refreshCart();
    }, [refreshCart])
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshCart();
    setRefreshing(false);
  }, [refreshCart]);

  // ── Address ──
  const defaultAddress = customer?.address || '';
  const currentAddress = useAltAddress ? altAddress : defaultAddress;

  // ── Derived ──
  const validItems = items.filter(i => i.product?.isActive !== false);
  const outOfStockItems = items.filter(i => i.product?.isActive === false || (i.product?.stock ?? 0) <= 0);
  const unitPriceOf = (i: (typeof items)[number]) => i.unitPrice || i.product?.price || 0;
  const originalPriceOf = (i: (typeof items)[number]) => i.product?.oldPrice || i.product?.price || i.unitPrice || 0;
  const summary = {
    items_count: validItems.length,
    total_quantity: validItems.reduce((s, i) => s + i.quantity, 0),
    subtotal: validItems.reduce((s, i) => s + originalPriceOf(i) * i.quantity, 0),
    total_discount: validItems.reduce((s, i) => s + Math.max(0, originalPriceOf(i) - unitPriceOf(i)) * i.quantity, 0),
    final_total: validItems.reduce((s, i) => s + unitPriceOf(i) * i.quantity, 0),
  };
  const hasOutOfStock = outOfStockItems.length > 0;
  const canPlaceOrder = validItems.length > 0 && !hasOutOfStock && isApprovedCustomer && currentAddress.length >= 10;

  // ── Place order ──
  const handlePlaceOrder = useCallback(async () => {
    // B19 — محافظ Double Tap سمت کلاینت (جایگزین Idempotency سمت سرور نیست، هر دو لازم‌اند)
    if (placing) return;
    if (!canPlaceOrder) return;
    // اگر کلید معلقی از تلاش قبلی مانده، همان نگه داشته می‌شود تا Retry با همان کلید برود
    if (!idempotencyKeyRef.current) idempotencyKeyRef.current = generateIdempotencyKey();
    setShowConfirmSheet(false);
    setPlacing(true);
    try {
      const result = await placeOrderApi({
        delivery_address: currentAddress,
        is_alternative_address: useAltAddress,
        customer_note: orderNote || undefined,
        idempotency_key: idempotencyKeyRef.current,
      });
      // موفقیت ⇒ این attempt تمام شد؛ checkout بعدی کلید تازه می‌گیرد
      idempotencyKeyRef.current = null;
      await clearCart();
      router.push({ pathname: '/orders/success', params: { orderId: result.id, orderNumber: result.orderNumber || (result as any).order_number || '' } });
    } catch (err: any) {
      // کلید عمداً پاک نمی‌شود: اگر سفارش سمت سرور ساخته شده ولی پاسخ در راه گم شده
      // باشد، تلاش بعدی با همان کلید به همان سفارش می‌رسد و سفارش دوم ساخته نمی‌شود.
      notify('خطا در ثبت سفارش', err?.data?.message || err?.message || 'لطفاً دوباره تلاش کنید');
    } finally {
      setPlacing(false);
    }
  }, [placing, canPlaceOrder, currentAddress, useAltAddress, orderNote, clearCart, router]);

  // ── Reorder ──
  const handleReorder = useCallback(async () => {
    if (!latestOrder || reorderLoading) return;
    setReorderLoading(true);
    try {
      await reorderApi(latestOrder.id, 'replace');
      await refreshCart();
    } catch (e: any) {
      notify('خطا', e?.message || 'خطا در تکرار سفارش');
    } finally {
      setReorderLoading(false);
    }
  }, [latestOrder, reorderLoading, refreshCart]);

  // ── Quantity handlers ──
  const handleQtyChange = useCallback(async (productId: string, delta: number, currentQty: number, stock: number) => {
    const newQty = currentQty + delta;
    if (newQty > stock) {
      notify('محدودیت موجودی', `حداکثر موجودی: ${fa(stock)} عدد`);
      return;
    }
    if (newQty <= 0) {
      notify('حذف محصول', 'آیا می‌خواهید این محصول را از سبد حذف کنید?', [
        { text: 'انصراف', style: 'cancel' },
        { text: 'حذف', style: 'destructive', onPress: () => removeFromCart(productId) },
      ]);
      return;
    }
    await updateQuantity(productId, delta);
  }, [updateQuantity, removeFromCart]);

  // ═══════════════════════════════════════════════════════════════
  // STATE A: Guest
  // ═══════════════════════════════════════════════════════════════
  if (isGuest) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centerWrap}>
          <Ionicons name="lock-closed-outline" size={80} color={C.disabled} />
          <Text style={styles.centerTitle}>برای مشاهده سبد خرید وارد شوید</Text>
          <Text style={styles.centerSub}>با ورود به حساب کاربری می‌توانید محصولات را به سبد اضافه کرده و سفارش ثبت کنید.</Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={() => router.push('/(auth)/login')}>
            <Text style={styles.primaryBtnText}>ورود / ثبت‌نام</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // STATE C: Pending
  // ═══════════════════════════════════════════════════════════════
  if (isPendingCustomer) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centerWrap}>
          <Ionicons name="hourglass-outline" size={80} color={C.warning} />
          <Text style={styles.centerTitle}>حساب شما در انتظار تایید است</Text>
          <Text style={styles.centerSub}>پس از تایید توسط تیم پشتیبانی، امکان ثبت سفارش برای شما فعال می‌شود.</Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={() => {}}>
            <Text style={styles.primaryBtnText}>تماس با پشتیبانی</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // STATE A: Empty Cart
  // ═══════════════════════════════════════════════════════════════
  if (!isLoading && items.length === 0) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centerWrap}>
          <Ionicons name="cart-outline" size={80} color={C.disabled} />
          <Text style={styles.centerTitle}>سبد خرید شما خالی است</Text>
          <Text style={styles.centerSub}>محصولات موردنیاز فروشگاه خود را انتخاب کنید و سفارش دهید.</Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={() => router.push('/(tabs)/browse')}>
            <Text style={styles.primaryBtnText}>مشاهده محصولات</Text>
          </TouchableOpacity>
          {latestOrder ? (
            <TouchableOpacity
              style={[styles.outlineBtn, { borderColor: C.accent, marginTop: 12 }]}
              onPress={handleReorder}
              disabled={reorderLoading}
            >
              {reorderLoading ? (
                <ActivityIndicator size="small" color={C.accent} />
              ) : (
                <Text style={[styles.outlineBtnText, { color: C.accent }]}>🔄 تکرار آخرین سفارش</Text>
              )}
            </TouchableOpacity>
          ) : null}
        </View>
      </SafeAreaView>
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // STATE D: Cart with Items
  // ═══════════════════════════════════════════════════════════════
  return (
    <SafeAreaView style={styles.safe}>
      {/* Section 1: App Bar */}
      <View style={styles.appBar}>
        <Text style={styles.appBarTitle}>سبد خرید</Text>
        {items.length > 0 ? (
          <TouchableOpacity
            onPress={() => {
              notify('خالی کردن سبد خرید', 'آیا مطمئن هستید که می‌خواهید تمام اقلام را از سبد خرید حذف کنید?', [
                { text: 'انصراف', style: 'cancel' },
                { text: 'خالی کردن', style: 'destructive', onPress: () => clearCart() },
              ]);
            }}
            accessibilityLabel="خالی کردن سبد"
          >
            <Ionicons name="trash-outline" size={22} color={C.error} />
          </TouchableOpacity>
        ) : null}
      </View>

      {isLoading ? (
        <CartSkeleton />
      ) : (
        <FlatList
          data={items}
          keyExtractor={item => item.id}
          // Perf ( Phase 5-2 ): کاهش حافظه/رندر — بدون تغییر رفتار
          initialNumToRender={8}
          maxToRenderPerBatch={8}
          windowSize={7}
          removeClippedSubviews
          contentContainerStyle={{ paddingBottom: 300 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={C.primary} />}
          ListHeaderComponent={
            <View>
              {/* Section 2: Items Count */}
              <Text style={styles.itemsCount}>{fa(summary.items_count)} قلم کالا در سبد خرید</Text>

              {/* Section 3: Warnings */}
              {hasOutOfStock ? (
                <View style={styles.warningBanner}>
                  <Ionicons name="warning-outline" size={20} color={C.warningText} />
                  <Text style={styles.warningText}>برخی از محصولات ناموجود شده‌اند. لطفاً قبل از ثبت سفارش حذف کنید.</Text>
                </View>
              ) : null}
            </View>
          }
          renderItem={({ item }) => {
            const p = item.product;
            const price = item.unitPrice ?? p?.price ?? 0;
            const originalPrice = p?.oldPrice ?? p?.price ?? price;
            const discountPercent = originalPrice > price && price > 0
              ? Math.round(((originalPrice - price) / originalPrice) * 100)
              : 0;
            const isOutOfStock = !p?.isActive || (p?.stock ?? 0) <= 0;
            const stockWarning = item.quantity > (p?.stock ?? 0) ? 'quantity_exceeds_stock' : null;

            return (
              <View style={[styles.itemCard, isOutOfStock && { opacity: 0.6 }]}>
                {/* Image */}
                <TouchableOpacity onPress={() => p?.id && router.push({ pathname: '/product-detail', params: { id: p.id } })}>
                  {p?.imageUrl ? (
                    <Image source={{ uri: buildUrl(p.imageUrl) }} style={styles.itemImage} resizeMode="cover" />
                  ) : (
                    <View style={[styles.itemImage, { alignItems: 'center', justifyContent: 'center', backgroundColor: C.background }]}>
                      <Ionicons name="image-outline" size={24} color={C.disabled} />
                    </View>
                  )}
                </TouchableOpacity>

                {/* Info */}
                <View style={styles.itemInfo}>
                  <TouchableOpacity onPress={() => p?.id && router.push({ pathname: '/product-detail', params: { id: p.id } })}>
                    <Text style={styles.itemName} numberOfLines={2}>{p?.name || 'محصول نامشخص'}</Text>
                  </TouchableOpacity>
                  {p?.unit ? <Text style={styles.itemUnit}>{p.unit === 'CARTON' ? 'کارتن' : p.unit}</Text> : null}

                  {/* Price */}
                  <View style={styles.priceRow}>
                    {discountPercent > 0 ? (
                      <>
                        <View style={styles.itemDiscountBadge}>
                          <Text style={styles.itemDiscountBadgeText}>٪{fa(discountPercent)}</Text>
                        </View>
                        <Text style={styles.oldPrice}>{formatPrice(originalPrice)} تومان</Text>
                        <Text style={styles.itemPrice}>{formatPrice(price)} تومان</Text>
                      </>
                    ) : (
                      <Text style={styles.itemPrice}>{formatPrice(price)} تومان</Text>
                    )}
                  </View>

                  {/* Stock warning */}
                  {isOutOfStock ? (
                    <View style={styles.stockWarnRow}>
                      <Ionicons name="close-circle-outline" size={14} color={C.textTertiary} />
                      <Text style={[styles.stockWarnText, { color: C.textTertiary }]}>ناموجود شده</Text>
                    </View>
                  ) : stockWarning === 'quantity_exceeds_stock' ? (
                    <View style={styles.stockWarnRow}>
                      <Ionicons name="warning-outline" size={14} color={C.error} />
                      <Text style={[styles.stockWarnText, { color: C.error }]}>موجودی محدود: فقط {fa(p?.stock ?? 0)} عدد</Text>
                    </View>
                  ) : null}
                </View>

                {/* Actions */}
                <View style={styles.itemActions}>
                  <Text style={styles.lineTotal}>{formatPrice(price * item.quantity)} تومان</Text>
                  <View style={styles.stepper}>
                    <TouchableOpacity
                      style={[styles.stepBtn, item.quantity === 1 && { backgroundColor: C.errorLight, borderColor: C.error }]}
                      onPress={() => handleQtyChange(item.productId, -1, item.quantity, p?.stock ?? 0)}
                    >
                      <Ionicons name={item.quantity === 1 ? 'trash-outline' : 'remove'} size={16} color={item.quantity === 1 ? C.error : C.textPrimary} />
                    </TouchableOpacity>
                    <Text style={styles.qtyText}>{fa(item.quantity)}</Text>
                    <TouchableOpacity
                      style={[styles.stepBtn, item.quantity >= (p?.stock ?? 0) && { opacity: 0.4 }]}
                      onPress={() => handleQtyChange(item.productId, +1, item.quantity, p?.stock ?? 0)}
                      disabled={item.quantity >= (p?.stock ?? 0)}
                    >
                      <Ionicons name="add" size={16} color={C.textPrimary} />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            );
          }}
          ListFooterComponent={
            <View>
              {/* Section 5: Order Summary */}
              <View style={styles.summaryCard}>
                <Text style={styles.summaryTitle}>خلاصه سفارش</Text>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>تعداد اقلام</Text>
                  <Text style={styles.summaryValue}>{fa(summary.items_count)} قلم</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>جمع کالاها</Text>
                  <Text style={styles.summaryValue}>{formatPrice(summary.subtotal)} تومان</Text>
                </View>
                {summary.total_discount > 0 ? (
                  <View style={styles.summaryRow}>
                    <Text style={[styles.summaryLabel, { color: C.accent }]}>تخفیف کالاها</Text>
                    <Text style={[styles.summaryValue, { color: C.accent, fontWeight: 'bold' }]}>−‌{formatPrice(summary.total_discount)} تومان</Text>
                  </View>
                ) : null}
                <View style={styles.divider} />
                <View style={styles.summaryRow}>
                  <Text style={[styles.summaryLabel, { fontWeight: 'bold', fontSize: 15 }]}>مبلغ نهایی</Text>
                  <Text style={styles.finalTotal}>{formatPrice(summary.final_total)} تومان</Text>
                </View>
              </View>

              {/* Section 6: Delivery Address */}
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={styles.cardHeaderRight}>
                    <Ionicons name="location-outline" size={18} color={C.primary} />
                    <Text style={styles.cardTitle}>آدرس تحویل</Text>
                  </View>
                  <TouchableOpacity onPress={() => setShowAddressSheet(true)}>
                    <Text style={styles.changeLink}>{useAltAddress ? 'استفاده از آدرس پیش‌فرض' : 'استفاده از آدرس دیگر'}</Text>
                  </TouchableOpacity>
                </View>
                {useAltAddress ? <Text style={styles.altBadge}>آدرس جایگزین</Text> : null}
                <View style={styles.addressBox}>
                  <Text style={styles.addressText}>{currentAddress || 'آدرسی ثبت نشده — لطفاً آدرس تحویل را وارد کنید'}</Text>
                </View>
              </View>

              {/* Section 7: Customer Note */}
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={styles.cardHeaderRight}>
                    <Ionicons name="document-text-outline" size={18} color={C.textSecondary} />
                    <Text style={[styles.cardTitle, { fontSize: 13 }]}>توضیحات سفارش (اختیاری)</Text>
                  </View>
                </View>
                <TextInput
                  style={styles.noteInput}
                  placeholder="توضیحات یا درخواست خاصی دارید? (مثلاً: قبل از ارسال تماس بگیرید)"
                  placeholderTextColor={C.textTertiary}
                  value={orderNote}
                  onChangeText={setOrderNote}
                  maxLength={500}
                  multiline
                  textAlignVertical="top"
                />
                <Text style={styles.charCount}>{fa(orderNote.length)}/۵۰۰</Text>
              </View>

              {/* Section 8: Payment Method */}
              <View style={styles.paymentCard}>
                <Ionicons name="cash-outline" size={24} color={C.accent} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.paymentLabel}>روش پرداخت</Text>
                  <Text style={styles.paymentValue}>پرداخت هنگام تحویل (نقدی)</Text>
                  <Text style={styles.paymentSub}>مبلغ سفارش را هنگام تحویل کالا پرداخت کنید.</Text>
                </View>
              </View>
            </View>
          }
        />
      )}

      {/* Section 9: Bottom Action Bar */}
      {items.length > 0 ? (
        <View style={styles.bottomBar}>
          <View style={styles.bottomTotal}>
            <Text style={styles.bottomTotalLabel}>مبلغ نهایی</Text>
            <Text style={styles.bottomTotalValue}>{formatPrice(summary.final_total)} تومان</Text>
            {summary.total_discount > 0 ? (
              <Text style={styles.bottomDiscountText}>شامل {formatPrice(summary.total_discount)} تومان تخفیف</Text>
            ) : null}
          </View>
          <TouchableOpacity
            style={[styles.placeOrderBtn, !canPlaceOrder && { backgroundColor: C.disabled }]}
            onPress={() => {
              if (!isApprovedCustomer) return;
              if (hasOutOfStock) {
                notify('توجه', 'لطفاً محصولات ناموجود را از سبد حذف کنید.');
                return;
              }
              if (!currentAddress || currentAddress.length < 10) {
                notify('آدرس تحویل', 'لطفاً آدرس تحویل را وارد کنید (حداقل ۱۰ کاراکتر).');
                return;
              }
              // B19 — شروع یک attempt واقعی checkout: اگر کلید معلق نیست، کلید تازه بساز
              if (!idempotencyKeyRef.current) idempotencyKeyRef.current = generateIdempotencyKey();
              setShowConfirmSheet(true);
            }}
            disabled={!canPlaceOrder || placing}
          >
            {placing ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.placeOrderBtnText}>ثبت سفارش</Text>
            )}
          </TouchableOpacity>
        </View>
      ) : null}

      {/* ── Alternative Address Sheet ── */}
      <Modal visible={showAddressSheet} transparent animationType="fade" onRequestClose={() => setShowAddressSheet(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowAddressSheet(false)}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ justifyContent: 'flex-end', flex: 1 }}>
            <Pressable style={styles.sheet} onPress={e => e.stopPropagation()}>
              <Text style={styles.sheetTitle}>آدرس تحویل جایگزین</Text>
              <Text style={styles.sheetSub}>این آدرس فقط برای این سفارش استفاده می‌شود و در پروفایل شما ذخیره نمی‌شود.</Text>
              <TextInput
                style={styles.addressInput}
                placeholder="آدرس کامل خود را وارد کنید..."
                placeholderTextColor={C.textTertiary}
                value={altAddress}
                onChangeText={setAltAddress}
                multiline
                textAlignVertical="top"
              />
              {altAddress.length > 0 && altAddress.length < 10 ? (
                <Text style={{ color: C.error, fontSize: 12, marginTop: 4 }}>حداقل ۱۰ کاراکتر وارد کنید</Text>
              ) : null}
              <View style={styles.sheetActions}>
                <TouchableOpacity onPress={() => { setUseAltAddress(false); setShowAddressSheet(false); setAltAddress(''); }}>
                  <Text style={styles.sheetCancel}>انصراف</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.sheetConfirmBtn, altAddress.length < 10 && { backgroundColor: C.disabled }]}
                  disabled={altAddress.length < 10}
                  onPress={() => { setUseAltAddress(true); setShowAddressSheet(false); }}
                >
                  <Text style={styles.sheetConfirmText}>استفاده از این آدرس</Text>
                </TouchableOpacity>
              </View>
            </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>

      {/* ── Order Confirmation Sheet ── */}
      <Modal visible={showConfirmSheet} transparent animationType="fade" onRequestClose={() => setShowConfirmSheet(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowConfirmSheet(false)}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>تایید نهایی سفارش</Text>
            <Text style={styles.sheetSub}>لطفاً اطلاعات سفارش خود را بررسی کنید</Text>

            <View style={styles.confirmRow}>
              <Text style={styles.confirmLabel}>تعداد اقلام</Text>
              <Text style={styles.confirmValue}>{fa(summary.items_count)} قلم</Text>
            </View>
            {summary.total_discount > 0 ? (
              <>
                <View style={styles.confirmRow}>
                  <Text style={styles.confirmLabel}>جمع کالاها</Text>
                  <Text style={styles.confirmValue}>{formatPrice(summary.subtotal)} تومان</Text>
                </View>
                <View style={styles.confirmRow}>
                  <Text style={[styles.confirmLabel, { color: C.accent }]}>تخفیف کالاها</Text>
                  <Text style={[styles.confirmValue, { color: C.accent, fontWeight: 'bold' }]}>−‌{formatPrice(summary.total_discount)} تومان</Text>
                </View>
              </>
            ) : null}
            <View style={styles.confirmRow}>
              <Text style={styles.confirmLabel}>مبلغ نهایی</Text>
              <Text style={[styles.confirmValue, { fontWeight: 'bold', color: C.primary }]}>{formatPrice(summary.final_total)} تومان</Text>
            </View>
            <View style={styles.divider} />
            <Text style={styles.confirmSectionLabel}>آدرس تحویل</Text>
            <Text style={styles.confirmAddress}>{currentAddress}</Text>
            {useAltAddress ? <Text style={styles.altBadge}>آدرس جایگزین</Text> : null}
            <Text style={styles.confirmSectionLabel}>روش پرداخت</Text>
            <Text style={{ color: C.accent, fontSize: 13, fontWeight: '500' }}>پرداخت هنگام تحویل</Text>
            {orderNote ? (
              <>
                <Text style={styles.confirmSectionLabel}>توضیحات</Text>
                <Text style={{ color: C.textPrimary, fontSize: 13 }}>{orderNote}</Text>
              </>
            ) : null}

            <View style={styles.sheetActions}>
              <TouchableOpacity onPress={() => setShowConfirmSheet(false)}>
                <Text style={styles.sheetCancel}>بازگشت</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.sheetConfirmBtn, placing && { opacity: 0.6 }]}
                onPress={handlePlaceOrder}
                disabled={placing}
              >
                <Text style={styles.sheetConfirmText}>✓ تایید و ثبت نهایی</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Pressable>
      </Modal>

      {/* ── Full-screen loading overlay ── */}
      {placing ? (
        <View style={styles.placingOverlay}>
          <ActivityIndicator size="large" color={C.primary} />
          <Text style={styles.placingText}>در حال ثبت سفارش...</Text>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

// ═══════════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════════

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.background },

  // ── Center states (empty/guest/pending) ──
  centerWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  centerTitle: { fontSize: 18, fontWeight: 'bold', color: C.textPrimary, marginTop: 16, textAlign: 'center' },
  centerSub: { fontSize: 13, color: C.textSecondary, marginTop: 8, textAlign: 'center', lineHeight: 20 },
  primaryBtn: { backgroundColor: C.primary, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 24, paddingHorizontal: 32, width: 240 },
  primaryBtnText: { color: '#FFF', fontSize: 15, fontWeight: 'bold' },
  outlineBtn: { height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1, paddingHorizontal: 32, width: 240 },
  outlineBtnText: { fontSize: 15, fontWeight: 'bold' },

  // ── App Bar ──
  appBar: {
    height: 56, flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, backgroundColor: C.card, borderBottomWidth: 1, borderBottomColor: C.border,
  },
  appBarTitle: { fontSize: 18, fontWeight: 'bold', color: C.textPrimary },

  // ── Items count ──
  itemsCount: { fontSize: 14, color: C.textSecondary, paddingHorizontal: 16, paddingVertical: 12 },

  // ── Warning banner ──
  warningBanner: {
    flexDirection: 'row-reverse', alignItems: 'center', gap: 8,
    backgroundColor: C.warningLight, marginHorizontal: 16, marginBottom: 12,
    padding: 12, borderRadius: 10, borderRightWidth: 4, borderRightColor: C.warning,
  },
  warningText: { flex: 1, fontSize: 12, color: C.warningText, textAlign: 'right' },

  // ── Cart item card ──
  itemCard: {
    flexDirection: 'row-reverse', backgroundColor: C.card, marginHorizontal: 16, marginBottom: 10,
    padding: 12, borderRadius: 14, borderWidth: 1, borderColor: C.border, gap: 12,
  },
  itemImage: { width: 72, height: 72, borderRadius: 10, backgroundColor: C.background },
  itemInfo: { flex: 1, justifyContent: 'center' },
  itemName: { fontSize: 14, fontWeight: '600', color: C.textPrimary, textAlign: 'right' },
  itemUnit: { fontSize: 12, color: C.textSecondary, marginTop: 2, textAlign: 'right' },
  priceRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6, marginTop: 6 },
  oldPrice: { fontSize: 12, color: C.textTertiary, textDecorationLine: 'line-through' },
  itemDiscountBadge: { backgroundColor: C.error, borderRadius: 6, paddingHorizontal: 4, paddingVertical: 1 },
  itemDiscountBadgeText: { color: '#FFF', fontSize: 10, fontWeight: 'bold' },
  itemPrice: { fontSize: 14, fontWeight: 'bold', color: C.textPrimary },
  stockWarnRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 4, marginTop: 4 },
  stockWarnText: { fontSize: 11, fontWeight: '500' },

  // ── Item actions ──
  itemActions: { alignItems: 'flex-end', justifyContent: 'space-between', marginLeft: 8 },
  lineTotal: { fontSize: 13, fontWeight: 'bold', color: C.textPrimary, marginBottom: 8 },
  stepper: { flexDirection: 'row-reverse', alignItems: 'center', gap: 4 },
  stepBtn: {
    width: 30, height: 30, borderRadius: 8, borderWidth: 1, borderColor: C.border,
    backgroundColor: C.background, alignItems: 'center', justifyContent: 'center',
  },
  qtyText: { fontSize: 14, fontWeight: 'bold', color: C.textPrimary, minWidth: 32, textAlign: 'center' },

  // ── Summary card ──
  summaryCard: {
    backgroundColor: C.card, marginHorizontal: 16, marginTop: 16, padding: 16,
    borderRadius: 14, borderWidth: 1, borderColor: C.border,
  },
  summaryTitle: { fontSize: 15, fontWeight: 'bold', color: C.textPrimary, marginBottom: 12, textAlign: 'right' },
  summaryRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 8 },
  summaryLabel: { fontSize: 13, color: C.textSecondary },
  summaryValue: { fontSize: 13, color: C.textPrimary },
  finalTotal: { fontSize: 18, fontWeight: 'bold', color: C.primary },
  divider: { height: 1, backgroundColor: C.border, marginVertical: 12 },

  // ── Address card ──
  card: {
    backgroundColor: C.card, marginHorizontal: 16, marginTop: 12, padding: 16,
    borderRadius: 14, borderWidth: 1, borderColor: C.border,
  },
  cardHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' },
  cardHeaderRight: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6 },
  cardTitle: { fontSize: 15, fontWeight: 'bold', color: C.textPrimary },
  changeLink: { fontSize: 12, color: C.primary, fontWeight: '500' },
  altBadge: {
    fontSize: 11, color: C.warning, fontWeight: '600', marginTop: 8,
    backgroundColor: C.warningLight, alignSelf: 'flex-end', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4,
  },
  addressBox: { backgroundColor: C.background, borderRadius: 8, padding: 12, marginTop: 10 },
  addressText: { fontSize: 13, color: C.textPrimary, lineHeight: 20, textAlign: 'right' },

  // ── Note ──
  noteInput: {
    minHeight: 80, borderWidth: 1, borderColor: C.border, borderRadius: 10,
    padding: 12, fontSize: 13, color: C.textPrimary, marginTop: 10, textAlign: 'right',
  },
  charCount: { fontSize: 11, color: C.textTertiary, textAlign: 'right', marginTop: 4 },

  // ── Payment ──
  paymentCard: {
    flexDirection: 'row-reverse', alignItems: 'center', gap: 12,
    backgroundColor: '#F0FDF4', marginHorizontal: 16, marginTop: 12, padding: 14,
    borderRadius: 14, borderWidth: 1, borderColor: C.accent,
  },
  paymentLabel: { fontSize: 12, color: C.textSecondary },
  paymentValue: { fontSize: 14, fontWeight: 'bold', color: C.accent },
  paymentSub: { fontSize: 11, color: C.textSecondary, marginTop: 2 },

  // ── Bottom bar ──
  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: C.card, borderTopWidth: 1, borderTopColor: C.border,
    flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: Platform.OS === 'ios' ? 28 : 12,
  },
  bottomTotal: { alignItems: 'flex-end' },
  bottomTotalLabel: { fontSize: 11, color: C.textSecondary },
  bottomTotalValue: { fontSize: 18, fontWeight: 'bold', color: C.textPrimary },
  bottomDiscountText: { fontSize: 10, color: C.accent, fontWeight: '600', marginTop: 2 },
  placeOrderBtn: {
    backgroundColor: C.primary, height: 52, borderRadius: 12,
    paddingHorizontal: 24, alignItems: 'center', justifyContent: 'center',
  },
  placeOrderBtnText: { color: '#FFF', fontSize: 15, fontWeight: 'bold' },

  // ── Modals ──
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: C.card, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 24, paddingBottom: 36,
  },
  sheetTitle: { fontSize: 16, fontWeight: 'bold', color: C.textPrimary, textAlign: 'right' },
  sheetSub: { fontSize: 12, color: C.textSecondary, marginTop: 4, textAlign: 'right', lineHeight: 18 },
  addressInput: {
    minHeight: 100, borderWidth: 1, borderColor: C.border, borderRadius: 10,
    padding: 12, fontSize: 14, color: C.textPrimary, marginTop: 16, textAlign: 'right',
  },
  sheetActions: { flexDirection: 'row-reverse', justifyContent: 'space-between', marginTop: 20, alignItems: 'center' },
  sheetCancel: { color: C.textSecondary, fontSize: 14, padding: 8 },
  sheetConfirmBtn: { backgroundColor: C.primary, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12 },
  sheetConfirmText: { color: '#FFF', fontSize: 14, fontWeight: 'bold' },

  // ── Confirmation sheet ──
  confirmRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', marginTop: 8 },
  confirmLabel: { fontSize: 13, color: C.textSecondary },
  confirmValue: { fontSize: 13, color: C.textPrimary },
  confirmSectionLabel: { fontSize: 12, color: C.textSecondary, marginTop: 12 },
  confirmAddress: { fontSize: 13, color: C.textPrimary, marginTop: 4, textAlign: 'right' },

  // ── Placing overlay ──
  placingOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(255,255,255,0.9)', alignItems: 'center', justifyContent: 'center', zIndex: 200,
  },
  placingText: { fontSize: 14, color: C.textSecondary, marginTop: 12 },
});
