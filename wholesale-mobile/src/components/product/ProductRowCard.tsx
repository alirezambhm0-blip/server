import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
  Platform,
} from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";

import { Product } from "@/types/product";
import { useAuth } from "@/context/AuthContext";
import { useCart } from "@/context/CartContext";
import { useFavorites } from "@/context/FavoritesContext";
import { useRouter } from "expo-router";
import { formatPrice } from "@/utils/format";
import { buildUrl } from "@/api/httpClient";

type Props = {
  product: Product;
};

export default function ProductRowCard({ product }: Props) {
  const router = useRouter();
  const { isLoggedIn, isApprovedCustomer, isPendingCustomer } = useAuth();
  const { items, addToCart, updateQuantity, removeFromCart } = useCart();
  const { isFavorite, toggleFavorite } = useFavorites();

  const [busy, setBusy] = useState(false);
  
  const isFav = isFavorite(product.id);
  const cartItem = items.find((i) => i.productId === product.id);
  const qty = cartItem?.quantity ?? 0;

  const handleToggleFav = async () => {
    if (!isLoggedIn) {
      router.push("/(auth)/login");
      return;
    }
    try {
      await toggleFavorite(product);
    } catch (e) {}
  };

  const handleAdd = async () => {
    if (!isLoggedIn) {
      router.push("/(auth)/login");
      return;
    }
    if (!isApprovedCustomer || busy || product.stock <= 0) return;
    setBusy(true);
    try {
      await addToCart(product);
    } finally {
      setBusy(false);
    }
  };

  const handleIncrease = async () => {
    if (busy || qty >= product.stock) return;
    setBusy(true);
    try {
      await updateQuantity(product.id, +1);
    } finally {
      setBusy(false);
    }
  };

  const handleDecrease = async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (qty <= 1) {
        await removeFromCart(product.id);
      } else {
        await updateQuantity(product.id, -1);
      }
    } finally {
      setBusy(false);
    }
  };

  const isOutOfStock = product.stock <= 0;

  return (
    <TouchableOpacity 
      style={[styles.card, isOutOfStock && styles.dimmed]} 
      activeOpacity={0.8}
      onPress={() => router.push({ pathname: "/product-detail", params: { id: product.id } })}
    >
      {/* Right Side: Image */}
      <View style={styles.imageArea}>
        <Image 
          source={{ uri: buildUrl(product.imageUrl || '') }} 
          style={styles.image} 
          resizeMode="cover"
        />
        
        {/* Badge */}
        {product.isDiscounted ? (
          <View style={[styles.badge, styles.discountBadge]}>
            <Text style={styles.badgeText}>تخفیف</Text>
          </View>
        ) : product.isNew ? (
          <View style={[styles.badge, styles.newBadge]}>
            <Text style={styles.badgeText}>جدید</Text>
          </View>
        ) : product.isFeatured ? (
          <View style={[styles.badge, styles.suggestedBadge]}>
            <Text style={styles.badgeText}>پیشنهادی</Text>
          </View>
        ) : null}

        {/* Favorite */}
        <TouchableOpacity style={styles.favBtn} onPress={handleToggleFav}>
          <Ionicons 
            name={isFav ? "heart" : "heart-outline"} 
            size={18} 
            color={isFav ? "#EF4444" : "#94A3B8"} 
          />
        </TouchableOpacity>
      </View>

      {/* Middle: Info */}
      <View style={styles.infoArea}>
        <Text style={styles.name} numberOfLines={2}>{product.name}</Text>
        <Text style={styles.unit}>{product.unit === 'CARTON' ? 'کارتن' : product.unit}</Text>
        
        <View style={styles.priceRow}>
          {isLoggedIn && isApprovedCustomer ? (
            <View style={styles.priceContainer}>
              {product.isDiscounted && product.oldPrice && (
                <Text style={styles.oldPrice}>{formatPrice(product.oldPrice)}</Text>
              )}
              <Text style={styles.price}>{formatPrice(product.price)} تومان</Text>
            </View>
          ) : (
            <Text style={styles.restrictedPrice}>
                {isPendingCustomer ? "در انتظار تایید حساب" : "برای مشاهده قیمت وارد شوید"}
            </Text>
          )}
        </View>

        {product.stock > 0 && product.stock <= 5 && (
          <View style={styles.stockWarning}>
            <Ionicons name="warning-outline" size={12} color="#F59E0B" />
            <Text style={styles.stockWarningText}>فقط {formatPrice(product.stock)} عدد باقی مانده</Text>
          </View>
        )}
      </View>

      {/* Left: Actions */}
      <View style={styles.actionArea}>
        {isLoggedIn && isApprovedCustomer ? (
          isOutOfStock ? (
            <Text style={styles.outOfStockText}>ناموجود</Text>
          ) : qty === 0 ? (
            <TouchableOpacity style={styles.addBtn} onPress={handleAdd} disabled={busy}>
                <Ionicons name="add" size={24} color="#FFF" />
            </TouchableOpacity>
          ) : (
            <View style={styles.stepper}>
                <TouchableOpacity style={styles.stepBtn} onPress={handleIncrease} disabled={busy || qty >= product.stock}>
                    <Ionicons name="add" size={16} color="#FFF" />
                </TouchableOpacity>
                <Text style={styles.qtyText}>{formatPrice(qty)}</Text>
                <TouchableOpacity style={styles.stepBtn} onPress={handleDecrease} disabled={busy}>
                    <Ionicons name={qty === 1 ? "trash-outline" : "remove"} size={16} color="#FFF" />
                </TouchableOpacity>
            </View>
          )
        ) : !isLoggedIn ? (
          <TouchableOpacity style={styles.loginBtn} onPress={() => router.push("/(auth)/login")}>
            <Text style={styles.loginBtnText}>ورود</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row-reverse',
    backgroundColor: '#FFF',
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    alignItems: 'center',
  },
  dimmed: { opacity: 0.6 },
  imageArea: {
    width: 80,
    height: 80,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    position: 'relative',
    overflow: 'hidden',
  },
  image: { width: '100%', height: '100%' },
  badge: {
    position: 'absolute',
    top: 0,
    right: 0,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderBottomLeftRadius: 8,
  },
  discountBadge: { backgroundColor: '#EF4444' },
  newBadge: { backgroundColor: '#2563EB' },
  suggestedBadge: { backgroundColor: '#10B981' },
  badgeText: { color: '#FFF', fontSize: 9, fontWeight: 'bold' },
  favBtn: {
    position: 'absolute',
    top: 4,
    left: 4,
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderRadius: 10,
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoArea: {
    flex: 1,
    paddingRight: 12,
    alignItems: 'flex-end',
  },
  name: {
    fontSize: 14,
    fontWeight: '500',
    color: '#0F172A',
    textAlign: 'right',
  },
  unit: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  priceRow: {
    marginTop: 6,
  },
  priceContainer: {
    alignItems: 'flex-end',
  },
  oldPrice: {
    fontSize: 11,
    color: '#94A3B8',
    textDecorationLine: 'line-through',
  },
  price: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  restrictedPrice: {
    fontSize: 12,
    color: '#2563EB',
  },
  stockWarning: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    marginTop: 4,
    gap: 4,
  },
  stockWarningText: {
    fontSize: 11,
    color: '#F59E0B',
  },
  actionArea: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 40,
  },
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepper: {
    alignItems: 'center',
    gap: 4,
  },
  stepBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#0F172A',
    textAlign: 'center',
    minWidth: 24,
  },
  outOfStockText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#94A3B8',
  },
  loginBtn: {
    borderWidth: 1,
    borderColor: '#2563EB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  loginBtnText: {
    fontSize: 12,
    color: '#2563EB',
    fontWeight: '500',
  },
});
