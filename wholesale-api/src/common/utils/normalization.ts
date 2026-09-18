/**
 * ابزار نرمال‌سازی متن برای زبان فارسی
 * کاربرد: یکسان‌سازی کاراکترها در هنگام ایندکس‌گذاری و جست‌وجو
 */

export function normalizePersian(text: string): string {
  if (!text) return '';

  let normalized = text;

  // ۱. یکسان‌سازی «ی» و «ک» (عربی به فارسی)
  normalized = normalized.replace(/\u064A/g, '\u06CC'); // ي -> ی
  normalized = normalized.replace(/\u064B/g, '\u06CC'); // ئ -> ی (تقریبی برای جست‌وجو)
  normalized = normalized.replace(/\u0643/g, '\u06A9'); // ك -> ک

  // ۲. تبدیل همزه و الف‌های مختلف به «ا»
  normalized = normalized.replace(/[\u0622\u0623\u0625\u0671]/g, '\u0627'); // آ أ إ ٱ -> ا
  normalized = normalized.replace(/\u0624/g, '\u0648'); // ؤ -> و
  normalized = normalized.replace(/\u0626/g, '\u06CC'); // ئ -> ی
  normalized = normalized.replace(/\u0629/g, '\u0647'); // ة -> ه

  // ۳. حذف اعراب و حرکت‌ها (Harakat)
  normalized = normalized.replace(/[\u064B-\u065F\u0670\u0640]/g, '');

  // ۴. مدیریت نیم‌فاصله (ZWNJ)
  // جایگزینی نیم‌فاصله با فاصله معمولی برای بهبود تطابق کلمات
  normalized = normalized.replace(/\u200C/g, ' ');

  // ۵. یکسان‌سازی اعداد (فارسی و عربی به انگلیسی)
  const persianDigits = [/۰/g, /۱/g, /۲/g, /۳/g, /۴/g, /۵/g, /۶/g, /۷/g, /۸/g, /۹/g];
  const arabicDigits = [/٠/g, /١/g, /٢/g, /٣/g, /٤/g, /٥/g, /٦/g, /٧/g, /٨/g, /٩/g];
  for (let i = 0; i < 10; i++) {
    normalized = normalized.replace(persianDigits[i], i.toString());
    normalized = normalized.replace(arabicDigits[i], i.toString());
  }

  // ۶. نرمال‌سازی حروف لاتین (بسیار مهم برای برندها)
  normalized = normalized.toLowerCase();

  // ۷. پاکسازی فواصل اضافی
  normalized = normalized.replace(/\s+/g, ' ').trim();

  return normalized;
}
