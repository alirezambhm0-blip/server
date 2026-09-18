import React from "react"
import { View, Text, StyleSheet } from "react-native"

type Props = {
  price: number
  originalPrice?: number
  unitLabel: string

  isLoggedIn: boolean
  isApprovedCustomer: boolean
}

type CardState = "guest" | "pending" | "approved"

const formatPrice = (price: number) => {
  return new Intl.NumberFormat("fa-IR").format(price)
}

export default function PriceBox({
  price,
  originalPrice,
  unitLabel,
  isLoggedIn,
  isApprovedCustomer,
}: Props) {
  // ---------------------------
  // determine state
  // ---------------------------

  let state: CardState = "guest"

  if (isLoggedIn && !isApprovedCustomer) {
    state = "pending"
  }

  if (isLoggedIn && isApprovedCustomer) {
    state = "approved"
  }

  // ---------------------------
  // guest state
  // ---------------------------

  if (state === "guest") {
    return (
      <View style={styles.lockBox}>
        <Text style={styles.lockTitle}>
          برای مشاهده قیمت وارد حساب شوید
        </Text>

        <Text style={styles.lockDesc}>
          قیمت‌های عمده فقط برای مشتریان ثبت شده نمایش داده می‌شود
        </Text>
      </View>
    )
  }

  // ---------------------------
  // pending state
  // ---------------------------

  if (state === "pending") {
    return (
      <View style={styles.pendingBox}>
        <Text style={styles.pendingText}>
          در انتظار تایید حساب
        </Text>
      </View>
    )
  }

  // ---------------------------
  // approved state
  // ---------------------------

  return (
    <View style={styles.priceContainer}>
      <View style={styles.priceRow}>
        <Text style={styles.price}>
          {formatPrice(price)} تومان
        </Text>

        <Text style={styles.unit}>
          / {unitLabel}
        </Text>
      </View>

      {originalPrice && originalPrice > price && (
        <Text style={styles.oldPrice}>
          {formatPrice(originalPrice)} تومان
        </Text>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  priceContainer: {
    marginTop: 6,
  },

  priceRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  price: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
  },

  unit: {
    fontSize: 13,
    marginLeft: 4,
    color: "#6B7280",
  },

  oldPrice: {
    fontSize: 12,
    color: "#9CA3AF",
    textDecorationLine: "line-through",
    marginTop: 2,
  },

  lockBox: {
    backgroundColor: "#EEF2FF",
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    marginTop: 6,
  },

  lockTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#3730A3",
  },

  lockDesc: {
    fontSize: 11,
    color: "#6366F1",
    marginTop: 2,
  },

  pendingBox: {
    backgroundColor: "#FEF3C7",
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    marginTop: 6,
  },

  pendingText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#92400E",
  },
})
