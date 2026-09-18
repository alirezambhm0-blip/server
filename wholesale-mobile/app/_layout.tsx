// app/_layout.tsx
// Root layout — نسخه نهایی

import React, { useEffect, useRef, useCallback, useMemo } from "react";
import { Slot, Stack, useRouter, useSegments, useRootNavigationState } from "expo-router";
import { View, Text as RNText, TextInput as RNTextInput, StyleSheet } from "react-native";
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import * as Sentry from "@sentry/react-native";

import { AuthProvider, useAuth } from "@/context/AuthContext";
import { CartProvider } from "@/context/CartContext";
import { FavoritesProvider } from "@/context/FavoritesContext";
import OfflineBanner from "@/components/ui/OfflineBanner";
import { useForceUpdate } from "@/hooks/useForceUpdate";
import { CustomFallback } from "@/components/ui/ErrorBoundary";

// نگه داشتن اسپلش تا فونت لود شود
SplashScreen.preventAutoHideAsync();

Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN || "",
  tracesSampleRate: 1.0,
  enabled: !__DEV__,
  integrations: [Sentry.reactNavigationIntegration()],
});

// ─── فونت پیش‌فرض ─────────────────────────────────────────────────

const FONT_FAMILY = "Vazirmatn";
const defaultFontStyle = { fontFamily: FONT_FAMILY };

/**
 * اعمال فونت وزیرمتن با وزن‌های مختلف بر اساس context
 * - Light: متن‌های فرعی، توضیحات
 * - Regular: متن اصلی
 * - Medium: دکمه‌ها، لیبل‌ها
 * - SemiBold: عنوان بخش‌ها
 * - Bold: عنوان صفحات، اعداد مهم
 */
function FontApplied() {
  useMemo(() => {
    try {
      // @ts-ignore
      if (RNText.defaultProps === undefined) RNText.defaultProps = {};
      // @ts-ignore
      RNText.defaultProps.style = [{ fontFamily: "Vazirmatn" }, RNText.defaultProps.style];

      // @ts-ignore
      if (RNTextInput.defaultProps === undefined) RNTextInput.defaultProps = {};
      // @ts-ignore
      RNTextInput.defaultProps.style = [{ fontFamily: "Vazirmatn" }, RNTextInput.defaultProps.style];
    } catch {}
  }, []);
  return null;
}

/** توابع کمکی برای استفاده از وزن‌های مختلف فونت */
// ─── Navigator ─────────────────────────────────────────────────────

function RootNavigator() {
  const { authStatus, needsOnboarding } = useAuth();
  const router = useRouter();
  const segments = useSegments();
  const rootNavigationState = useRootNavigationState();
  const lastRedirectRef = useRef<string | null>(null);

  useEffect(() => {
    if (!rootNavigationState?.key || authStatus === "loading") return;
    const rootSegment = segments[0];
    let redirectTo: string | null = null;

    if (authStatus === "unauthenticated" && (rootSegment === "(tabs)" || rootSegment === "onboarding")) {
      redirectTo = "/welcome";
    } else if (authStatus === "authenticated" && needsOnboarding && rootSegment !== "onboarding") {
      redirectTo = "/onboarding";
    } else if (authStatus === "authenticated" && !needsOnboarding && (rootSegment === "welcome" || rootSegment === "(auth)")) {
      redirectTo = "/(tabs)/home";
    }

    if (redirectTo !== null && lastRedirectRef.current !== redirectTo) {
      lastRedirectRef.current = redirectTo;
      router.replace(redirectTo as any);
    }
  }, [authStatus, needsOnboarding, rootNavigationState?.key, segments]);

  return (
    <Stack screenOptions={{ headerShown: false }} initialRouteName="(tabs)">
      <Stack.Screen name="index" />
      <Stack.Screen name="welcome" />
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="onboarding" />
      <Stack.Screen name="(tabs)" />
    </Stack>
  );
}

// ─── Error Boundary Fallback ───────────────────────────────────────

const SentryFallback = (props: any) => (
  <CustomFallback error={props.error} resetError={props.resetError} />
);

// ─── Root Layout ───────────────────────────────────────────────────

function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    "Vazirmatn": require("../assets/fonts/Vazirmatn-Regular.ttf"),
    "Vazirmatn-Light": require("../assets/fonts/Vazirmatn-Light.ttf"),
    "Vazirmatn-Medium": require("../assets/fonts/Vazirmatn-Medium.ttf"),
    "Vazirmatn-SemiBold": require("../assets/fonts/Vazirmatn-SemiBold.ttf"),
    "Vazirmatn-Bold": require("../assets/fonts/Vazirmatn-Bold.ttf"),
    "Vazirmatn-ExtraBold": require("../assets/fonts/Vazirmatn-ExtraBold.ttf"),
  });

  const onLayoutRootView = useCallback(async () => {
    if (fontsLoaded || fontError) {
      await SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  // اگر فونت هنوز لود نشده، چیزی نمایش نده
  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <>
      <StatusBar style="dark" />
      <Sentry.ErrorBoundary fallback={SentryFallback}>
        <AuthProvider>
          <CartProvider>
            <FavoritesProvider>
              <SafeAreaProvider>
              <SafeAreaView edges={['top', 'left', 'right', 'bottom']} style={{ flex: 1 }} onLayout={onLayoutRootView}>
              <FontApplied />
              <OfflineBanner />
              <RootNavigator />
            </SafeAreaView>
            </SafeAreaProvider>
          </FavoritesProvider>
        </CartProvider>
      </AuthProvider>
    </Sentry.ErrorBoundary>
    </>
  );
}

export default Sentry.wrap(RootLayout);
