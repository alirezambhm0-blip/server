/**
 * Manual Jest mock برای 'expo-server-sdk'
 *
 * دلیل وجود: expo-server-sdk@6 پکیج ESM-only است ("type": "module" + import.meta.url)
 * و تحت محیط CJSِ Jest اصلاً لود نمی‌شود؛ تبدیل آن هم به علت import.meta شکست می‌خورد.
 * این mock فقط در محیط تست از طریق moduleNameMapper (package.json > jest) جایگزین می‌شود
 * و روی build/محصول هیچ اثری ندارد. تست‌های فعلی منطق push را بررسی نمی‌کنند،
 * بنابراین پیاده‌سازی no-op کافی است — دقیقاً همان سطحی که کد واقعی استفاده می‌کند:
 *   new Expo() / Expo.isExpoPushToken() / chunkPushNotifications() / sendPushNotificationsAsync()
 */
export class Expo {
  static isExpoPushToken(): boolean {
    return false;
  }

  chunkPushNotifications<T>(messages: T[]): T[][] {
    return [messages];
  }

  sendPushNotificationsAsync(): Promise<unknown[]> {
    return Promise.resolve([]);
  }
}

export type ExpoPushMessage = Record<string, unknown>;
