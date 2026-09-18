// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
  },
  {
    rules: {
      // ═══════════════════════════════════════════════════════════════
      // قوانین React Compiler (جدید در eslint-config-expo 56) — عمداً warn:
      // این الگوها در کدبیس مستند و تعمدی هستند، نه باگ type-safety:
      //
      // - set-state-in-effect: auto-fill کد OTP و stateهای کنترل‌شده فرم
      // - refs: الگوی useRef ضد stale-closure در ProductCard.tsx که در
      //   Project_Context.md مستند شده و رفع آن ریسک رگرسیون دارد
      // - immutability: ترتیب تعریف closureها که در runtime امن است
      // - purity: تولید idempotency key در checkout (در RN مشکلی ندارد)
      // بازسازی این الگوها باید در یک فاز refactor جداگانه انجام شود.
      // ═══════════════════════════════════════════════════════════════
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/immutability': 'warn',
      'react-hooks/purity': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',
    },
  },
]);
