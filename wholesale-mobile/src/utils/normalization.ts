export function normalizePersian(text: string): string {
  if (!text) return '';

  let normalized = text;

  // 1. Unified Yeh and Kaf
  normalized = normalized.replace(/\u064A/g, '\u06CC'); // ي -> ی
  normalized = normalized.replace(/\u0643/g, '\u06A9'); // ك -> ک

  // 2. Alif variations
  normalized = normalized.replace(/[\u0622\u0623\u0625\u0671]/g, '\u0627'); // آ أ إ ٱ -> ا

  // 3. Digits
  const persianDigits = [/۰/g, /۱/g, /۲/g, /۳/g, /۴/g, /۵/g, /۶/g, /۷/g, /۸/g, /۹/g];
  const arabicDigits = [/٠/g, /١/g, /٢/g, /٣/g, /٤/g, /٥/g, /٦/g, /٧/g, /٨/g, /٩/g];
  for (let i = 0; i < 10; i++) {
    normalized = normalized.replace(persianDigits[i], i.toString());
    normalized = normalized.replace(arabicDigits[i], i.toString());
  }

  return normalized.toLowerCase().trim();
}
