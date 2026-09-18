import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

import { CustomerStatus } from "@/constants/customerStatus";

const ACCESS_TOKEN_KEY = "accessToken";
const CUSTOMER_DATA_KEY = "customerData";

// فلگ‌های غیرحساس:
// این مقادیر در AsyncStorage ذخیره می‌شوند، نه SecureStore.
const HAS_SEEN_WELCOME_KEY = "hasSeenWelcome";
const GUEST_MODE_KEY = "guestModeActive";

const isWeb = Platform.OS === "web";

export interface StoredCustomer {
  id: string;
  userId: string;
  phone: string;

  firstName?: string | null;
  lastName?: string | null;
  storeName?: string | null;
  nationalCode?: string | null;
  landline?: string | null;

  province?: string | null;
  city?: string | null;
  address?: string | null;
  postalCode?: string | null;

  latitude?: number | null;
  longitude?: number | null;

  // KYC / onboarding
  businessType?: string | null;
  nationalCardImage?: string | null;
  businessLicenseImage?: string | null;
  selfieWithIdCardImage?: string | null;
  storefrontImage?: string | null;

  onboardingCompleted: boolean;
  status: CustomerStatus;

  notes?: string | null;

  createdAt: string;
  updatedAt: string;
}

export interface AuthData {
  accessToken: string;
  customer: StoredCustomer;
}

/**
 * حذف امن اطلاعات session.
 *
 * نکته:
 * این تابع فقط token و customer را پاک می‌کند و به فلگ‌های
 * guestModeActive و hasSeenWelcome دست نمی‌زند.
 */
const clearStoredSession = async (): Promise<void> => {
  if (isWeb) {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(CUSTOMER_DATA_KEY);
    return;
  }

  await Promise.all([
    SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY),
    SecureStore.deleteItemAsync(CUSTOMER_DATA_KEY),
  ]);
};

/**
 * تلاش برای پاک‌سازی داده‌های ناقص بدون اینکه خطای cleanup
 * جای خطای اصلی storage را بگیرد.
 */
const safelyClearStoredSession = async (): Promise<void> => {
  try {
    await clearStoredSession();
  } catch (cleanupError) {
    console.error(
      "[AuthStorage] Failed to clean up stored session:",
      cleanupError,
    );
  }
};

export const authStorage = {
  /**
   * ذخیره اتمیک منطقی توکن و customer.
   *
   * SecureStore عملیات transaction واقعی ارائه نمی‌دهد؛ بنابراین اگر
   * ذخیره یکی از مقادیر موفق و دیگری ناموفق باشد، هر دو مقدار پاک می‌شوند
   * تا session ناقص در storage باقی نماند.
   *
   * مهم:
   * خطای ذخیره‌سازی دوباره throw می‌شود تا AuthContext متوجه شکست login شود.
   */
  saveTokensAndCustomer: async (
    accessToken: string,
    customer: StoredCustomer,
  ): Promise<void> => {
    try {
      if (!accessToken.trim()) {
        throw new Error("Cannot save an empty access token");
      }

      const customerStr = JSON.stringify(customer);

      if (isWeb) {
        localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
        localStorage.setItem(CUSTOMER_DATA_KEY, customerStr);
        return;
      }

      await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken);
      await SecureStore.setItemAsync(CUSTOMER_DATA_KEY, customerStr);
    } catch (error) {
      console.error("[AuthStorage] Error saving auth data:", error);

      // اگر فقط یکی از مقادیر ذخیره شده باشد، session ناقص را پاک می‌کنیم.
      await safelyClearStoredSession();

      // بسیار مهم:
      // اجازه نمی‌دهیم login تصور کند ذخیره‌سازی موفق بوده است.
      throw error;
    }
  },

  /**
   * دریافت access token معتبر همراه با بررسی وجود customer.
   *
   * عمداً از getTokensAndCustomer استفاده می‌شود تا session ناقص
   * به‌عنوان session معتبر شناخته نشود.
   */
  getAccessToken: async (): Promise<string | null> => {
    const authData = await authStorage.getTokensAndCustomer();
    return authData?.accessToken ?? null;
  },

  /**
   * بازیابی session ذخیره‌شده.
   *
   * اگر token یا customer وجود نداشته باشد، session نامعتبر است.
   * اگر JSON مربوط به customer خراب باشد نیز session پاک می‌شود.
   */
  getTokensAndCustomer: async (): Promise<AuthData | null> => {
    try {
      let accessToken: string | null;
      let customerData: string | null;

      if (isWeb) {
        accessToken = localStorage.getItem(ACCESS_TOKEN_KEY);
        customerData = localStorage.getItem(CUSTOMER_DATA_KEY);
      } else {
        [accessToken, customerData] = await Promise.all([
          SecureStore.getItemAsync(ACCESS_TOKEN_KEY),
          SecureStore.getItemAsync(CUSTOMER_DATA_KEY),
        ]);
      }

      // هیچ داده‌ای ذخیره نشده؛ این حالت خطا نیست.
      if (!accessToken && !customerData) {
        return null;
      }

      // فقط یکی از مقادیر وجود دارد؛ session ناقص است و باید پاک شود.
      if (!accessToken || !customerData) {
        console.warn(
          "[AuthStorage] Incomplete auth session found. Clearing storage.",
        );

        await safelyClearStoredSession();
        return null;
      }

      const customer = JSON.parse(customerData) as StoredCustomer;

      // حداقل اعتبارسنجی runtime برای جلوگیری از پذیرش داده خراب.
      if (
        !customer ||
        typeof customer !== "object" ||
        typeof customer.id !== "string" ||
        typeof customer.userId !== "string" ||
        typeof customer.phone !== "string"
      ) {
        console.warn(
          "[AuthStorage] Stored customer data has an invalid shape.",
        );

        await safelyClearStoredSession();
        return null;
      }

      return {
        accessToken,
        customer,
      };
    } catch (error) {
      console.error(
        "[AuthStorage] Failed to retrieve or parse auth data:",
        error,
      );

      // داده خراب یا session ناقص نباید در storage باقی بماند.
      await safelyClearStoredSession();

      return null;
    }
  },

  /**
   * خروج کامل از session احرازشده.
   *
   * پاک می‌شوند:
   * - accessToken
   * - customerData
   * - guestModeActive
   *
   * عمداً پاک نمی‌شود:
   * - hasSeenWelcome
   *
   * چون hasSeenWelcome بیان می‌کند کاربر قبلاً Welcome را دیده است،
   * نه اینکه اکنون authenticated است.
   */
  clearAll: async (): Promise<void> => {
    try {
      await clearStoredSession();

      // logout نباید کاربر را در guest mode باقی بگذارد.
      await AsyncStorage.removeItem(GUEST_MODE_KEY);
    } catch (error) {
      console.error("[AuthStorage] Error clearing auth storage:", error);

      // AuthContext باید بداند پاک‌سازی کامل storage شکست خورده است.
      throw error;
    }
  },

  // -------------------------------------------------------------------
  // Non-sensitive flags — AsyncStorage
  // -------------------------------------------------------------------

  /**
   * آیا کاربر قبلاً صفحه Welcome را دیده است؟
   */
  getHasSeenWelcome: async (): Promise<boolean> => {
    try {
      const value = await AsyncStorage.getItem(HAS_SEEN_WELCOME_KEY);
      return value === "true";
    } catch (error) {
      console.error(
        "[AuthStorage] Error reading hasSeenWelcome flag:",
        error,
      );

      // مقدار امن پیش‌فرض
      return false;
    }
  },

  /**
   * ثبت وضعیت مشاهده Welcome.
   *
   * خطا throw می‌شود، چون فراخواننده ممکن است بخواهد درباره شکست
   * persistence تصمیم بگیرد.
   */
  setHasSeenWelcome: async (value: boolean): Promise<void> => {
    try {
      if (value) {
        await AsyncStorage.setItem(HAS_SEEN_WELCOME_KEY, "true");
      } else {
        await AsyncStorage.removeItem(HAS_SEEN_WELCOME_KEY);
      }
    } catch (error) {
      console.error(
        "[AuthStorage] Error saving hasSeenWelcome flag:",
        error,
      );

      throw error;
    }
  },

  /**
   * آیا guest mode به‌صورت پایدار فعال شده است؟
   */
  getGuestModeActive: async (): Promise<boolean> => {
    try {
      const value = await AsyncStorage.getItem(GUEST_MODE_KEY);
      return value === "true";
    } catch (error) {
      console.error(
        "[AuthStorage] Error reading guestModeActive flag:",
        error,
      );

      // در صورت شکست storage، نباید خودسرانه کاربر را guest فرض کنیم.
      return false;
    }
  },

  /**
   * فعال یا غیرفعال کردن guest mode.
   */
  setGuestModeActive: async (value: boolean): Promise<void> => {
    try {
      if (value) {
        await AsyncStorage.setItem(GUEST_MODE_KEY, "true");
      } else {
        await AsyncStorage.removeItem(GUEST_MODE_KEY);
      }
    } catch (error) {
      console.error(
        "[AuthStorage] Error saving guestModeActive flag:",
        error,
      );

      throw error;
    }
  },
};
