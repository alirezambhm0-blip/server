// src/context/authcontext

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";

import { CustomerStatus } from "@/constants/customerStatus"; // منبع واحد enum
import { authStorage, StoredCustomer } from "@/storage/authStorage";
import { getMeApi } from "@/api/authApi";
import { notificationsApi } from "@/api/notificationsApi";
import { Platform } from "react-native";
// expo-notifications: در Expo Go SDK 53+ حذف شده — فقط در dev build کار می‌کند
let Notifications: any = null;
try {
  Notifications = require("expo-notifications");
} catch {}

// سه وضعیت اصلی auth طبق نیازمندی محصول:
// loading         -> در حال restore کردن session از storage
// unauthenticated -> هیچ session و هیچ guest mode ای فعال نیست (باید Welcome را ببیند)
// guest           -> کاربر مهمان، هنوز احراز هویت نشده اما وارد اپ شده
// authenticated   -> کاربر واقعی با accessToken و customer معتبر
export type AuthStatus = "loading" | "unauthenticated" | "guest" | "authenticated";

type AuthContextType = {
  customer: StoredCustomer | null;
  accessToken: string | null;
  loading: boolean;

  authStatus: AuthStatus;
  isLoggedIn: boolean;
  isGuest: boolean;
  isApprovedCustomer: boolean;
  isPendingCustomer: boolean;
  isRejectedCustomer: boolean;
  isBlockedCustomer: boolean;
  unreadNotificationCount: number;

  // کاربر واقعی است اما هنوز فرم احراز هویت (onboarding) را تکمیل نکرده.
  needsOnboarding: boolean;

  login: (accessToken: string, customer: StoredCustomer) => Promise<void>;
  // به‌روزرسانی پروفایل مشتری پس از تکمیل onboarding (یا هر تغییر پروفایل).
  // توکن ثابت می‌ماند و فقط customer ذخیره‌شده جایگزین می‌شود.
  completeOnboarding: (customer: StoredCustomer) => Promise<void>;
  logout: () => Promise<void>;
  refreshAuth: () => Promise<void>;
  continueAsGuest: () => Promise<void>;
  exitGuestMode: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [customer, setCustomer] = useState<StoredCustomer | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [authStatus, setAuthStatus] = useState<AuthStatus>("loading");

  const syncAuthState = async () => {
    setLoading(true);
    setAuthStatus("loading");

    try {
      const stored = await authStorage.getTokensAndCustomer();

      if (!stored) {
        setCustomer(null);
        setAccessToken(null);
        setUnreadNotificationCount(0);

        // اگر token/customer معتبر نیست، کاربر authenticated فرض نمی‌شود.
        // در این حالت فقط guestModeActive تعیین می‌کند که guest است یا unauthenticated.
        const guestActive = await authStorage.getGuestModeActive();
        setAuthStatus(guestActive ? "guest" : "unauthenticated");
        return;
      }

      setCustomer(stored.customer);
      setAccessToken(stored.accessToken);
      setAuthStatus("authenticated");

      // کاربر واقعی است؛ اگر قبلا guest flag روشن بوده، پاکش کن (state consistency)
      await authStorage.setGuestModeActive(false);

      // رفرش وضعیت مشتری از سرور (تا تغییر status توسط ادمین به گوشی برسد)
      // این کار async و best-effort است؛ اگر خطا خورد state ذخیره‌شده باقی می‌ماند.
      void getMeApi()
        .then((me) => {
          if (me.customer) {
            setCustomer(me.customer);
            setUnreadNotificationCount(me.unreadNotificationCount || 0);
            authStorage
              .saveTokensAndCustomer(stored.accessToken, me.customer)
              .catch(() => {});
          }
        })
        .catch((e) => {
          console.warn("[Auth] getMe refresh failed:", e?.message || e);
        });

      // همگام‌سازی پوش‌توکن (مخصوص موبایل) در حالت cold start
      if (Platform.OS !== "web" && Notifications) {
        Notifications.getExpoPushTokenAsync()
          .then((tokenData: any) => {
            if (tokenData?.data) {
              notificationsApi.registerPushToken(tokenData.data).catch(() => {});
            }
          })
          .catch((err: any) => console.warn("Failed to get Expo push token:", err));
      }
    } catch (error) {
      console.error("Failed to initialize auth state:", error);
      await authStorage.clearAll();
      setCustomer(null);
      setAccessToken(null);
      setUnreadNotificationCount(0);
      setAuthStatus("unauthenticated");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    syncAuthState();
  }, []);

  const login = async (token: string, customerData: StoredCustomer) => {
    setLoading(true);

    try {
      // ابتدا داده‌های اولیه را سریع ذخیره می‌کنیم تا UI زودتر بالا بیاید
      await authStorage.saveTokensAndCustomer(token, customerData);
      await authStorage.setGuestModeActive(false);
      setAccessToken(token);
      setCustomer(customerData);
      setAuthStatus("authenticated");

      // در پس‌زمینه وضعیت به‌روز را از /auth/me می‌گیریم
      // (اگر verifyOtp به هر دلیلی داده‌ی کهنه برگردانده باشد، این جایگزین می‌شود)
      try {
        const me = await getMeApi();
        if (me.customer) {
          setCustomer(me.customer);
          setUnreadNotificationCount(me.unreadNotificationCount || 0);
          await authStorage.saveTokensAndCustomer(token, me.customer);
        }
      } catch (e: any) {
        console.warn("[Auth] post-login getMe failed:", e?.message || e);
      }

      // بعد از لاگین صراحتا توکن رو چک کرده و ثبت میکنیم (بدون ایجاد کرش)
      if (Platform.OS !== "web" && Notifications) {
        Notifications.getPermissionsAsync().then((status: any) => {
          if (status.granted) {
            Notifications.getExpoPushTokenAsync()
              .then((tokenData: any) => {
                if (tokenData?.data) {
                  notificationsApi.registerPushToken(tokenData.data).catch(() => {});
                }
              })
              .catch(() => {});
          }
        }).catch(() => {});
      }
    } catch (error) {
      console.error("Login failed:", error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setLoading(true);

    try {
      // حذف توکن پوش از سرور
      if (customer?.id) {
        await notificationsApi.removePushToken().catch(() => {});
      }
      
      // logout یعنی خروج کامل: توکن + اطلاعات customer از SecureStore
      // و همچنین فلگ‌های AsyncStorage (guestModeActive, hasSeenWelcome)
      // همگی توسط clearAll پاک می‌شوند. کاربر به unauthenticated برمی‌گردد.
      await authStorage.clearAll();
      setCustomer(null);
      setAccessToken(null);
      setUnreadNotificationCount(0);
      setAuthStatus("unauthenticated");
    } finally {
      setLoading(false);
    }
  };

  const completeOnboarding = async (updatedCustomer: StoredCustomer) => {
    if (!accessToken) {
      throw new Error("completeOnboarding called without a session");
    }
    // توکن ثابت می‌ماند؛ فقط پروفایل customer به‌روزرسانی و ذخیره می‌شود.
    await authStorage.saveTokensAndCustomer(accessToken, updatedCustomer);
    setCustomer(updatedCustomer);
    // authStatus روی authenticated باقی می‌ماند؛ حالا needsOnboarding=false می‌شود.
  };

  const continueAsGuest = async () => {
    await authStorage.setGuestModeActive(true);
    await authStorage.setHasSeenWelcome(true);
    setAuthStatus("guest");
    setUnreadNotificationCount(0);
  };

  const exitGuestMode = async () => {
    await authStorage.setGuestModeActive(false);
    setAuthStatus("unauthenticated");
    setUnreadNotificationCount(0);
  };

  // ---- این ۵ تا فلگ، همون‌ چیزیه که لازم داری ----
  const isLoggedIn = authStatus === "authenticated" && !!accessToken && !!customer;
  const isGuest = authStatus === "guest";
  const isApprovedCustomer = customer?.status === CustomerStatus.APPROVED;
  const isPendingCustomer = customer?.status === CustomerStatus.PENDING;
  const isRejectedCustomer = customer?.status === CustomerStatus.REJECTED;
  const isBlockedCustomer = customer?.status === CustomerStatus.BLOCKED;

  // کاربر لاگین کرده ولی هنوز فرم احراز هویت (KYC) را تکمیل نکرده است.
  // این فلگ سیگنال routing است: تا زمان true بودن، باید صفحه onboarding ببیند.
  const needsOnboarding = isLoggedIn && !customer?.onboardingCompleted;

  return (
    <AuthContext.Provider
      value={{
        customer,
        accessToken,
        unreadNotificationCount,
        loading,
        authStatus,
        isLoggedIn,
        isGuest,
        isApprovedCustomer,
        isPendingCustomer,
        isRejectedCustomer,
        isBlockedCustomer,
        needsOnboarding,
        login,
        completeOnboarding,
        logout,
        refreshAuth: syncAuthState,
        continueAsGuest,
        exitGuestMode,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }

  return context;
};
