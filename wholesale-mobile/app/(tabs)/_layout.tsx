// app/(tabs)/_layout.tsx

import React from "react";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";

export default function TabsLayout() {
  const { totalItems } = useCart();
  const { isGuest } = useAuth();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#2563EB",
        tabBarInactiveTintColor: "#94A3B8",
        tabBarStyle: {
          height: 64,
          paddingBottom: 8,
          paddingTop: 8,
        },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: "خانه",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="browse"
        options={{
          title: "دسته‌بندی",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="grid-outline" size={size} color={color} />
          ),
        }}
      />

      {/*
        مهمان فقط ۳ تب می‌بیند (خانه/دسته‌بندی/پروفایل)؛
        با ورود به حساب، سبد خرید و سفارش‌ها ظاهر می‌شوند (href: null = پنهان‌سازی تب).
      */}
      <Tabs.Screen
        name="cart"
        options={{
          title: "سبد خرید",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="cart-outline" size={size} color={color} />
          ),
          href: isGuest ? null : undefined,
          tabBarBadge: totalItems > 0 ? totalItems : undefined,
          tabBarBadgeStyle: {
            backgroundColor: "#EF4444",
            color: "white",
            fontSize: 10,
          },
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: "سفارش‌ها",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="receipt-outline" size={size} color={color} />
          ),
          href: isGuest ? null : undefined,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "پروفایل",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-outline" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
