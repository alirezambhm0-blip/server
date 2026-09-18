// components/product/ProductCard.tsx

import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Platform,
} from "react-native";
import { notify } from "@/utils/notify";
import { Ionicons } from "@expo/vector-icons";
import { Fonts } from '@/utils/fonts';
import ItemsPerPackageBadge from './ItemsPerPackageBadge';

import { Product } from "@/types/product";
import { buildUrl } from "@/api/httpClient";
import { useAuth } from "@/context/AuthContext";
import { useCart } from "@/context/CartContext";
import { useFavorites } from "@/context/FavoritesContext";
import type { CartItem } from "@/types/cart";
import { useRouter } from "expo-router";

type Props = {
  product: Product;
  onLoginPress?: () => void;
};

const TITLE_LINE_HEIGHT = 20;
const TITLE_MAX_LINES = 2;

export default function ProductCard({ product, onLoginPress }: Props) {
  const router = useRouter();
  const { isLoggedIn, isApprovedCustomer, isRejectedCustomer } = useAuth();
  const { items, addToCart, updateQuantity, removeFromCart } = useCart();
  const { isFavorite, toggleFavorite } = useFavorites();

  const [imgError, setImgError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [favBusy, setFavBusy] = useState(false);

  const isFav = isFavorite(product.id);

  const handleToggleFav = async () => {
    if (!isLoggedIn) {
      onLoginPress?.();
      return;
    }
    if (favBusy) return;
    setFavBusy(true);
    try {
      await toggleFavorite(product);
    } finally {
      setFavBusy(false);
    }
  };

  // ═══════════════════════════════════════════════════════════════════
  // راه‌حل قطعی مشکل stale-closure: استفاده از useRef برای همه
  // مقادیر داخل handlerها. تابع فقط یک بار ساخته می‌شود و همیشه
  // آخرین مقادیر را از ref می‌خواند.
  // ═══════════════════════════════════════════════════════════════════

  const busyRef = useRef(false);
  busyRef.current = busy;

  const itemsRef = useRef(items);
  itemsRef.current = items;

  const isLoggedInRef = useRef(isLoggedIn);
  isLoggedInRef.current = isLoggedIn;

  const isApprovedRef = useRef(isApprovedCustomer);
  isApprovedRef.current = isApprovedCustomer;

  const addToCartRef = useRef(addToCart);
  addToCartRef.current = addToCart;

  const updateQuantityRef = useRef(updateQuantity);
  updateQuantityRef.current = updateQuantity;

  const removeFromCartRef = useRef(removeFromCart);
  removeFromCartRef.current = removeFromCart;

  const onLoginPressRef = useRef(onLoginPress);
  onLoginPressRef.current = onLoginPress;

  // ── cartItem / qty (خواندنی صرفاً برای UI) ──
  const cartItem = useMemo(
    () => items.find((i: CartItem) => i.productId === product.id),
    [items, product.id],
  );
  const qty = cartItem?.quantity ?? 0;

  const handleRestrictedClick = () => {
    if (!isLoggedIn) {
      if (Platform.OS === "web") {
        const ok = window.confirm(
          "تایید حساب کاربری\n\nبرای دسترسی به قیمت‌های عمده و افزودن محصول به سبد خرید، ابتدا باید وارد حساب خود شوید.\n\nآیا مایل به ورود یا ثبت‌نام هستید؟"
        );
        if (ok) router.push("/(auth)/login");
      } else {
        notify(
          "تایید حساب کاربری",
          "برای دسترسی به قیمت‌های عمده و افزودن محصول به سبد خرید، ابتدا باید وارد حساب خود شوید.",
          [
            { text: "انصراف", style: "cancel" },
            { text: "ورود / ثبت‌نام", onPress: () => router.push("/(auth)/login") },
          ]
        );
      }
    } else if (isRejectedCustomer) {
      if (Platform.OS === "web") {
        const ok = window.confirm(
          "حساب تایید نشد\n\nمتاسفانه اطلاعات قبلی شما تایید نشد. برای خرید باید مجدداً احراز هویت کنید.\n\nآیا مایل به ورود به پنل احراز هویت هستید؟"
        );
        if (ok) router.push("/onboarding");
      } else {
        notify(
          "حساب تایید نشد",
          "متاسفانه اطلاعات قبلی شما تایید نشد. برای خرید باید مجدداً احراز هویت کنید.",
          [
            { text: "انصراف", style: "cancel" },
            { text: "احراز هویت مجدد", onPress: () => router.push("/onboarding") },
          ]
        );
      }
    } else if (!isApprovedCustomer) {
      if (Platform.OS === "web") {
        window.alert(
          "حساب در انتظار تایید\n\nمدارک شما در حال بررسی توسط مدیریت است. برای پیگیری وضعیت به پروفایل خود مراجعه کنید."
        );
        router.push("/(tabs)/profile");
      } else {
        notify(
          "حساب در انتظار تایید",
          "مدارک شما در حال بررسی توسط مدیریت است. برای پیگیری وضعیت به پروفایل خود مراجعه کنید.",
          [{ text: "متوجه شدم", onPress: () => router.push("/(tabs)/profile") }]
        );
      }
    }
  };

  // ═══════════════════════════════════════════════════════════════════
  // handlerها با dependency ثابت [product.id]
  // همه مقادیر متغیر از ref خوانده می‌شوند — stale-closure غیرممکن.
  // ═══════════════════════════════════════════════════════════════════

  const handleAdd = useCallback(async () => {
    if (!isLoggedInRef.current) {
      onLoginPressRef.current?.();
      return;
    }
    if (!isApprovedRef.current || busyRef.current) return;
    setBusy(true);
    try {
      await addToCartRef.current(product);
    } finally {
      setBusy(false);
    }
  }, [product]);

  const handleDecrease = useCallback(async () => {
    console.log("[ProductCard] handleDecrease START, productId=", product.id);
    if (busyRef.current) {
      console.log("[ProductCard] handleDecrease blocked by busy");
      return;
    }

    // پیدا کردن qty واقعی در همین لحظه از ref
    const currentItems = itemsRef.current;
    const found = currentItems.find((i: CartItem) => i.productId === product.id);
    const currentQty = found?.quantity ?? 0;

    console.log("[ProductCard] handleDecrease currentQty=", currentQty);

    if (currentQty <= 0) {
      console.log("[ProductCard] handleDecrease qty already 0, nothing to do");
      return;
    }

    setBusy(true);
    try {
      if (currentQty <= 1) {
        // حذف کامل
        console.log("[ProductCard] handleDecrease → calling removeFromCart");
        await removeFromCartRef.current(product.id);
        console.log("[ProductCard] handleDecrease removeFromCart SUCCESS");
      } else {
        // کم کردن یک عدد
        console.log("[ProductCard] handleDecrease → calling updateQuantity -1");
        const r = await updateQuantityRef.current(product.id, -1);
        console.log("[ProductCard] handleDecrease updateQuantity result:", r.ok);
      }
    } catch (e: any) {
      console.error("[ProductCard] handleDecrease ERROR:", e?.message || e);
      notify("خطا", "عملیات با مشکل مواجه شد. لطفاً دوباره تلاش کنید.");
    } finally {
      setBusy(false);
      console.log("[ProductCard] handleDecrease END");
    }
  }, [product.id]);

  const handleIncrease = useCallback(async () => {
    if (busyRef.current) return;
    const currentItems = itemsRef.current;
    const found = currentItems.find((i: CartItem) => i.productId === product.id);
    const currentQty = found?.quantity ?? 0;

    setBusy(true);
    try {
      if (currentQty === 0) {
        await addToCartRef.current(product);
      } else {
        await updateQuantityRef.current(product.id, +1);
      }
    } catch (e: any) {
      console.error("[ProductCard] handleIncrease ERROR:", e?.message || e);
    } finally {
      setBusy(false);
    }
  }, [product]);

  // ── قیمت ──
  const priceLabel = useMemo(() => {
    if (!isLoggedIn) return "ورود برای مشاهده قیمت";
    if (!isApprovedCustomer) return "تماس برای تایید حساب";
    return `${product.price?.toLocaleString("fa-IR") || 0} تومان`;
  }, [isLoggedIn, isApprovedCustomer, product.price]);

  const oldPriceLabel = useMemo(() => {
    if (product.isDiscounted && product.oldPrice) {
      return `${product.oldPrice.toLocaleString("fa-IR")} تومان`;
    }
    return null;
  }, [product.isDiscounted, product.oldPrice]);

  const hasImage = !!product.imageUrl && !imgError;
  const canBuy = isLoggedIn && isApprovedCustomer;

  return (
    <TouchableOpacity 
      style={styles.card} 
      activeOpacity={0.9} 
      onPress={() => router.push({ pathname: "/product-detail", params: { id: product.id } })}
    >
      <View style={styles.imageWrapper}>
        {hasImage ? (
          <Image
            source={{ uri: buildUrl(product.imageUrl || '') }}
            style={styles.image}
            resizeMode="contain"
            onError={() => setImgError(true)}
          />
        ) : (
          <View style={[styles.image, styles.imgPlaceholder]}>
            <Ionicons name="image-outline" size={28} color="#CBD5E1" />
          </View>
        )}

        {/* بج‌های تبلیغاتی — بالا راست */}
        <View style={styles.badgeContainer}>
          {product.isDiscounted && (
            <View style={[styles.badge, styles.discountBadge]}>
              <Text style={styles.badgeText}>تخفیف</Text>
            </View>
          )}
          {product.isNew && (
            <View style={[styles.badge, styles.newBadge]}>
              <Text style={styles.badgeText}>جدید</Text>
            </View>
          )}
          {product.isFeatured && (
            <View style={[styles.badge, styles.featuredBadge]}>
              <Text style={styles.badgeText}>پیشنهاد</Text>
            </View>
          )}
        </View>

        {/* دکمه علاقه‌مندی — پایین راست */}
        <TouchableOpacity 
          style={styles.favBtn} 
          onPress={handleToggleFav}
          activeOpacity={0.7}
        >
          <Ionicons 
            name={isFav ? "heart" : "heart-outline"} 
            size={18} 
            color={isFav ? "#EF4444" : "#94A3B8"} 
          />
        </TouchableOpacity>
      </View>

      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={TITLE_MAX_LINES}>
          {product.name}
        </Text>
        {product.items_per_package_label ? (
          <View style={styles.itemsBadgeInline}>
            <ItemsPerPackageBadge text={product.items_per_package_label} size="small" />
          </View>
        ) : null}

        <View style={styles.priceContainer}>
          {oldPriceLabel !== null && isApprovedCustomer ? (
            <Text style={styles.oldPrice}>{oldPriceLabel}</Text>
          ) : null}
          <Text
            style={[styles.price, !isApprovedCustomer && styles.priceRestricted]}
            numberOfLines={1}
          >
            {priceLabel}
          </Text>
        </View>

        {canBuy ? (
          <Text style={styles.stock}>
            {product.stock > 0
              ? `${product.stock.toLocaleString("fa-IR")} عدد در انبار`
              : "ناموجود"}
          </Text>
        ) : null}

        <View style={styles.action}>
          {!canBuy ? (
            !isLoggedIn ? (
              /* مهمان: دعوت شفاف به ورود — قیمت/سفارش پشت ورود است */
              <TouchableOpacity
                style={styles.guestLoginBtn}
                activeOpacity={0.7}
                onPress={handleRestrictedClick}
                accessibilityLabel="ورود برای مشاهده قیمت و سفارش"
              >
                <Ionicons name="lock-closed-outline" size={14} color="#2563EB" />
                <Text style={styles.guestLoginBtnText}>ورود / ثبت‌نام</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.disabledBtn}
                activeOpacity={0.7}
                onPress={handleRestrictedClick}
              >
                <Ionicons name="lock-closed-outline" size={14} color="#94A3B8" />
                <Text style={styles.disabledBtnText}>
                  {isRejectedCustomer ? 'احراز هویت مجدد' : 'در انتظار تایید حساب'}
                </Text>
              </TouchableOpacity>
            )
          ) : qty === 0 ? (
            <TouchableOpacity
              style={styles.addBtn}
              activeOpacity={0.7}
              onPress={handleAdd}
              disabled={busy || product.stock <= 0}
            >
              <Ionicons name="add" size={16} color="#fff" />
              <Text style={styles.addBtnText}>افزودن به سبد</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.stepper}>
              <TouchableOpacity
                style={[styles.stepBtn, qty === 1 && styles.stepBtnTrash]}
                activeOpacity={0.6}
                onPress={handleDecrease}
                disabled={busy}
              >
                <Ionicons
                  name={qty === 1 ? "trash-outline" : "remove"}
                  size={15}
                  color={qty === 1 ? "#DC2626" : "#2563EB"}
                />
              </TouchableOpacity>

              <Text style={styles.stepQty}>
                {qty.toLocaleString("fa-IR")}
              </Text>

              <TouchableOpacity
                style={styles.stepBtn}
                activeOpacity={0.6}
                onPress={handleIncrease}
                disabled={busy || qty >= product.stock}
              >
                <Ionicons name="add" size={15} color="#2563EB" />
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1, margin: 8, borderRadius: 14, backgroundColor: "#fff",
    overflow: "hidden",
    shadowColor: "#0F172A", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  imageWrapper: {
    position: 'relative',
    width: "100%", 
    height: 130, 
    backgroundColor: "#F8FAFC"
  },
  image: { width: "100%", height: "100%" },
  imgPlaceholder: { alignItems: "center", justifyContent: "center" },
  badgeContainer: {
    position: 'absolute',
    top: 4,
    left: 4,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 2,
    maxWidth: '70%',
  },
  badge: {
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
  },
  discountBadge: {
    backgroundColor: '#EF4444',
  },
  newBadge: {
    backgroundColor: '#10B981',
  },
  featuredBadge: {
    backgroundColor: '#F59E0B',
  },
  badgeText: {
    color: '#FFF',
    fontSize: 8,
    ...Fonts.bold,
  },
  itemsBadgeInline: {
    alignSelf: 'flex-end',
    marginBottom: 4,
  },
  favBtn: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
    zIndex: 3,
  },
  info: {
    flex: 1, paddingHorizontal: 10, paddingTop: 10, paddingBottom: 10,
    justifyContent: "space-between",
  },
  title: {
    fontSize: 12, ...Fonts.bold, color: "#0F172A", textAlign: "right",
    lineHeight: TITLE_LINE_HEIGHT,
    height: TITLE_LINE_HEIGHT * TITLE_MAX_LINES, overflow: "hidden",
  },
  priceContainer: {
    marginTop: 6,
    alignItems: 'flex-end',
  },
  oldPrice: {
    fontSize: 11,
    color: '#94A3B8',
    textDecorationLine: 'line-through',
    marginBottom: -2,
  },
  price: {
    fontSize: 14, ...Fonts.extraBold, color: "#2563EB", textAlign: "right",
    height: 20,
  },
  priceRestricted: { color: "#94A3B8", fontSize: 11, ...Fonts.semiBold },
  stock: {
    fontSize: 10, color: "#94A3B8", textAlign: "right", marginTop: 2, height: 14,
  },
  action: { marginTop: 8, height: 34, justifyContent: "center" },
  addBtn: {
    flexDirection: "row-reverse", alignItems: "center", justifyContent: "center",
    backgroundColor: "#2563EB", paddingVertical: 7, borderRadius: 10, gap: 6, height: 34,
  },
  addBtnText: { fontSize: 12, ...Fonts.bold, color: "#fff" },
  disabledBtn: {
    flexDirection: "row-reverse", alignItems: "center", justifyContent: "center",
    backgroundColor: "#F1F5F9", borderWidth: 1, borderColor: "#E2E8F0",
    paddingVertical: 7, borderRadius: 10, gap: 4, height: 34,
  },
  disabledBtnText: { fontSize: 11, ...Fonts.semiBold, color: "#94A3B8" },
  guestLoginBtn: {
    flexDirection: "row-reverse", alignItems: "center", justifyContent: "center",
    backgroundColor: "#EFF6FF", borderWidth: 1, borderColor: "#BFDBFE",
    paddingVertical: 7, borderRadius: 10, gap: 4, height: 34,
  },
  guestLoginBtnText: { fontSize: 12, ...Fonts.bold, color: "#2563EB" },
  stepper: {
    flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between",
    backgroundColor: "#EFF6FF", borderRadius: 10, borderWidth: 1,
    borderColor: "#BFDBFE", height: 34, paddingHorizontal: 4,
  },
  stepBtn: {
    width: 34, height: 28, alignItems: "center", justifyContent: "center", borderRadius: 8,
  },
  stepBtnTrash: { backgroundColor: "#FEE2E2" },
  stepQty: {
    fontSize: 14, ...Fonts.extraBold, color: "#1E40AF",
    minWidth: 28, textAlign: "center",
  },
});
