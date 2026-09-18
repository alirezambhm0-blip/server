// app/welcome.tsx
//
// Welcome Screen - صفحه تصمیم‌گیری ورود.
// این صفحه route جداگانه دارد و اولین چیزی است که کاربرِ بدون session معتبر می‌بیند.
// اگر کاربر از قبل authenticated باشد، هرگز اینجا رندر نمی‌شود چون root layout
// با Stack.Protected مسیر را قبل از رسیدن به این صفحه هدایت می‌کند.

import React from "react";
import {
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { useAuth } from "@/context/AuthContext";


export default function WelcomeScreen() {
  const router = useRouter();
  const { continueAsGuest } = useAuth();

  const handleContinueAsGuest = async () => {
    try {
      router.replace("/(tabs)/home");
      await continueAsGuest();
    // نیازی به router.replace نیست.
    // RootNavigator با تغییر authStatus به guest، کاربر را به tabs می‌برد.
  } catch (error) {
    console.error("[Welcome] Failed to continue as guest:", error);
  }
};

  const handleAuthenticate = () => {
    router.push("/(auth)/login");
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.content}>
        <View style={styles.logoWrapper}>
          <Image
            source={require("../assets/images/expo-logo.png")}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>

        <Text style={styles.title}>به بنکو مارکت عمده خوش آمدید</Text>
        <Text style={styles.subtitle}>
          محصولات متنوع را مرور کنید و برای مشاهده قیمت، سفارش‌گذاری و پیگیری
          سفارش‌ها، حساب کاربری خود را فعال کنید.
        </Text>

        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handleAuthenticate}
            activeOpacity={0.85}
          >
            <Ionicons name="log-in-outline" size={20} color="#fff" />
            <Text style={styles.primaryButtonText}>ورود / ثبت‌نام</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={handleContinueAsGuest}
            activeOpacity={0.85}
          >
            <Text style={styles.secondaryButtonText}>ادامه به‌عنوان مهمان</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#F8FAFC" },
  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 28,
  },
  logoWrapper: {
    width: 96,
    height: 96,
    borderRadius: 24,
    backgroundColor: "#EFF6FF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 28,
  },
  logo: { width: 56, height: 56 },
  title: {
    fontSize: 24,
    fontWeight: "900",
    color: "#1E293B",
    textAlign: "center",
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 14,
    color: "#64748B",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 40,
  },
  actions: { width: "100%", gap: 12 },
  primaryButton: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#2563EB",
    borderRadius: 14,
    height: 56,
  },
  primaryButtonText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  secondaryButton: {
    justifyContent: "center",
    alignItems: "center",
    height: 56,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
  },
  secondaryButtonText: { color: "#334155", fontSize: 15, fontWeight: "700" },
});
