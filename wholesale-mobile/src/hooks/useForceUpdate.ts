import { useState, useEffect } from 'react';
import { Linking } from 'react-native';
import { notify } from '@/utils/notify';
import Constants from 'expo-constants';
import axios from 'axios';

// P2-6 — قبلاً اینجا یک آدرس پروداکشن hardcode بود:
//   const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://api.testcompany.ir';
// یعنی یک «منبع حقیقت سوم» برای آدرس API، مستقل از httpClient.ts. اگر دامنه
// عوض می‌شد یا env ست نمی‌شد، این hook بی‌صدا به دامنهٔ اشتباه می‌زد.
//
// حالا از همان buildUrl موجود استفاده می‌شود؛ هیچ سیستم پیکربندی جدیدی ساخته
// نشده و هیچ آدرس پروداکشنی هم hardcode نمانده است.
import { buildUrl } from '@/api/httpClient';

export const useForceUpdate = () => {
  const [isUpdateRequired, setIsUpdateRequired] = useState(false);

  const checkVersion = async () => {
    try {
      const response = await axios.get(buildUrl('/app/version'), {
        timeout: 5000, // ۵ ثانیه تایم‌اوت برای جلوگیری از فریز شدن
      });
      const { minVersion, updateUrl, message } = response.data;
      
      const currentVersion = Constants.expoConfig?.version || '1.0.0';

      if (isVersionLower(currentVersion, minVersion)) {
        setIsUpdateRequired(true);
        notify(
          'به‌روزرسانی اجباری',
          message || 'لطفاً برای ادامه استفاده از اپلیکیشن، آن را به آخرین نسخه به‌روزرسانی کنید.',
          [
            {
              text: 'به‌روزرسانی',
              onPress: () => Linking.openURL(updateUrl),
            },
          ],
          { cancelable: false }
        );
      }
    } catch (error: any) {
  // در صورت خطا در شبکه یا سرور، اپلیکیشن به کار خود ادامه می‌دهد
  console.warn('Failed to check app version (Fallback active):', error?.message || error);
    }
  };

  const isVersionLower = (current: string, required: string) => {
    const currentParts = current.split('.').map(Number);
    const requiredParts = required.split('.').map(Number);

    for (let i = 0; i < Math.max(currentParts.length, requiredParts.length); i++) {
      const c = currentParts[i] || 0;
      const r = requiredParts[i] || 0;
      if (c < r) return true;
      if (c > r) return false;
    }
    return false;
  };

  useEffect(() => {
    checkVersion();
  }, []);

  return { isUpdateRequired };
};
