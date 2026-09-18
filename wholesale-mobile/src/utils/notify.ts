import { Alert, AlertButton, AlertOptions, Platform } from 'react-native';

/**
 * نمایش پیام/تأیید سازگار با همهٔ پلتفرم‌ها.
 * چرا؟ Alert.alert از react-native روی وب هیچ کاری نمی‌کند (react-native-web آن را پیاده‌سازی نکرده است)؛
 * در نتیجه هم خطاها روی مرورگر بی‌صدا می‌مانند و هم تأییدهای دارای دکمه (حذف/لغو/خروج) هرگز اجرا نمی‌شوند.
 *
 * روی موبایل: دقیقاً همان Alert.alert با همان آرگومان‌ها (هیچ تغییری در رفتار نیتیو).
 * روی وب:
 *  - پیام ساده (بدون دکمه) → alert مرورگر
 *  - «انصراف + یک عمل» → confirm مرورگر؛ زدن OK همان عمل را اجرا می‌کند
 *  - فقط یک دکمهٔ غیرانصراف (مثل «باشه») → نمایش پیام و سپس اجرای همان یک کال‌بک
 *  - بیش از یک عمل → فقط نمایش پیام (اجرا نشدنِ عملِ اشتباه بهتر از اجرای تصادفی است)
 */
export function notify(title: string, message?: string, buttons?: AlertButton[], options?: AlertOptions): void {
  if (Platform.OS !== 'web') {
    Alert.alert(title, message, buttons, options);
    return;
  }
  const g = globalThis as any;
  const text = message ? `${title}\n\n${message}` : title;
  const list = buttons || [];
  const actions = list.filter((b) => b && b.style !== 'cancel');

  if (list.length === 0) {
    g.alert?.(text);
  } else if (list.length === 2 && actions.length === 1) {
    // الگوی تأیید/انصراف → confirm مرورگر
    if (g.confirm?.(text)) actions[0].onPress?.();
  } else if (list.length === 1 && actions.length === 1) {
    // تک‌دکمه (مثل «باشه» که ناوبری انجام می‌دهد)
    g.alert?.(text);
    actions[0].onPress?.();
  } else {
    g.alert?.(text);
  }
}
