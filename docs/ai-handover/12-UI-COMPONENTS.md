# 12 — UI COMPONENTS

---

## 1. موبایل — موجودی کامپوننت‌ها

`CONFIRMED` از `find wholesale-mobile/src/components -type f`

### ۱-۱. `components/product/` — کاتالوگ

| فایل | خط | نقش |
|---|---|---|
| `ProductCard.tsx` | **517** | ⭐ کارت محصول (بزرگ‌ترین کامپوننت پروژه) |
| `ProductRowCard.tsx` | 324 | نسخهٔ ردیفی (برای لیست) |
| `PriceBox.tsx` | 159 | ⭐ **سه حالت قیمت** — مهم‌ترین کامپوننت کسب‌وکاری |
| `ProductCardSkeleton.tsx` | 109 | placeholder هنگام لود |
| `ItemsPerPackageBadge.tsx` | 75 | برچسب «N عدد در کارتن» |

### ۱-۲. `components/search/`

| فایل | خط | نقش |
|---|---|---|
| `search.tsx` | 226 | کامپوننت اصلی جستجو |
| `SearchSuggestions.tsx` | 117 | پیشنهاد زنده |
| `SearchInput.tsx` | 88 | فیلد ورودی |
| `SearchHistory.tsx` | 65 | تاریخچه |
| `SearchPopular.tsx` | — | جستجوهای محبوب |
| `SearchEmpty.tsx` | — | حالت خالی |
| `index.ts` | — | barrel export |

### ۱-۳. `components/ui/` — عمومی

| فایل | خط | نقش |
|---|---|---|
| `Button.tsx` | — | دکمه |
| `Stepper.tsx` | — | +/- تعداد |
| `Skeleton.tsx` | — | placeholder |
| `LoadingState.tsx` | — | ⚠️ به `react-logo.png` ارجاع می‌دهد (موجود نیست) |
| `EmptyState.tsx` | — | حالت خالی |
| `ErrorState.tsx` | — | حالت خطا |
| `ErrorBoundary.tsx` | 68 | 🔴 IP hardcode + `catch {}` خالی |
| `GuestGuard.tsx` | 68 | ⭐ محافظ مهمان |
| `OfflineBanner.tsx` | 65 | بنر قطع اتصال (NetInfo) |
| `collapsible.tsx` | 65 | آکاردئون |

### ۱-۴. `components/onboarding/`
| فایل | خط | نقش |
|---|---|---|
| `ImageUploadField.tsx` | 324 | ⭐ آپلود مدارک KYC (expo-image-picker → `POST /files/kyc`) |

### ۱-۵. `components/` (ریشه) — ⚠️ بدون زیرپوشه

| فایل | نکته |
|---|---|
| `PriceDisplay.tsx` | ⚠️ **رقیب `PriceBox.tsx`** — دو کامپوننت نمایش قیمت |
| `animated-icon.tsx` + `animated-icon.web.tsx` + `animated-icon.module.css` | جفت پلتفرمی |
| `app-tabs.tsx` + `app-tabs.web.tsx` | جفت پلتفرمی |
| `themed-text.tsx` · `themed-view.tsx` | ⚠️ از تم template اصلی Expo |
| `external-link.tsx` · `hint-row.tsx` · `web-badge.tsx` | ⚠️ باقی‌مانده از template |

⚠️ `CONFIRMED` **پسوند `.web.tsx` = نسخهٔ مخصوص وب.** Metro خودکار انتخاب می‌کند.
جفت‌ها: `animated-icon`, `app-tabs`, `use-color-scheme`
> **اگر یکی را عوض کردید، هر دو را به‌روز کنید.**

---

## 2. ⭐ `PriceBox.tsx` — مهم‌ترین کامپوننت کسب‌وکاری

`CONFIRMED` سه حالت بر اساس `authStatus` و `Customer.status`:

| حالت | شرط | نمایش |
|---|---|---|
| **مهمان** | `!isLoggedIn` | «برای مشاهده قیمت وارد حساب شوید» |
| **در انتظار** | لاگین‌شده ولی `status !== 'APPROVED'` | «تماس برای تایید حساب» |
| **تاییدشده** | `status === 'APPROVED'` | قیمت + قیمت قدیم خط‌خورده + ٪ تخفیف |

🔴 **این تنها جایی است که قانون «قیمت پنهان» اجرا می‌شود.**
API قیمت را به همه می‌دهد → `15-SECURITY.md` §S3.

> **قاعده:** اگر کامپوننت جدیدی می‌سازید که قیمت نشان می‌دهد،
> **همین سه حالت** را پیاده کنید. یا بهتر: از `PriceBox` استفاده کنید.

⚠️ `CONFIRMED` **`PriceDisplay.tsx` هم وجود دارد** و احتمالاً همین کار را می‌کند.
`UNVERIFIED` — قبل از استفاده بررسی کنید کدام یک واقعاً import می‌شود.

---

## 3. 🔴 چهار پالت رنگ موازی

`CONFIRMED` — مقادیر hex **یکسان** هستند ولی **نام کلیدها متفاوت** است:

### ۳-۱. `src/constants/theme.ts` → `COLORS` (۲۴ کلید)
```ts
primary: '#2563EB'          primaryDark: '#1D4ED8'
primaryLight: '#DBEAFE'     primaryExtraLight: '#EFF6FF'
accent: '#10B981'           accentDark: '#059669'      accentLight: '#D1FAE5'
background: '#F8FAFC'       surface: '#FFFFFF'
textPrimary: '#0F172A'      textSecondary: '#64748B'   textTertiary: '#94A3B8'
border: '#E2E8F0'           borderLight: '#F1F5F9'
disabled: '#CBD5E1'         disabledText: '#94A3B8'
warning: '#F59E0B'          warningLight: '#FEF3C7'    warningText: '#92400E'
error: '#EF4444'            errorLight: '#FEE2E2'      errorText: '#991B1B'
success: '#16A34A'          successLight: '#D1FAE5'
```

### ۳-۲. `app/(tabs)/home.tsx:37-55` → `C` (۱۶ کلید)
```ts
// تفاوت‌ها با theme.ts:
card: '#FFFFFF'        ← در theme.ts نامش surface است
warningBg: '#FEF3C7'   ← در theme.ts نامش warningLight است
// ندارد: primaryDark ✓ دارد، ولی accentDark/borderLight/disabledText/
//        errorLight/errorText/successLight/success را ندارد
```

### ۳-۳. `app/(tabs)/browse.tsx:34-45` → `COLORS` (۱۰ کلید)
```ts
// تفاوت‌ها:
primaryXLight: '#EFF6FF'   ← در theme.ts نامش primaryExtraLight است
card: '#FFFFFF'            ← دوباره card
success: '#16A34A'
// ندارد: primaryDark, accentLight, textTertiary, warning*
```

### ۳-۴. `app/(profile)/notification-settings.tsx:8` → `C` (۷ کلید)
```ts
const C = { primary:'#2563EB', accent:'#10B981', border:'#E2E8F0',
            textPrimary:'#0F172A', textSecondary:'#64748B',
            background:'#F8FAFC', disabled:'#CBD5E1' };
```

### ۳-۵. ⚠️ رنگ‌های hardcode بیرون از همهٔ پالت‌ها
`CONFIRMED` نمونه‌ها:
- `app/(tabs)/_layout.tsx:17-18` → `tabBarActiveTintColor: "#2563EB"`, `tabBarInactiveTintColor: "#94A3B8"`
- `app/(tabs)/_layout.tsx:59` → `backgroundColor: "#EF4444"`
- `app/(profile)/notification-settings.tsx:21` → `backgroundColor: '#FFF'`

> **پیامد عملی:** اگر بخواهید رنگ برند را عوض کنید،
> باید **حداقل ۴ فایل + چند hardcode** را بگردید.
> **این را «تمیز» نکنید بدون تأیید کاربر** — ممکن است عمداً برای جداسازی ماژول‌ها باشد.
> ولی بدانید که یک بدهی فنی ثبت‌شده است.

---

## 4. 🔴 دو export با نام `Fonts`

`CONFIRMED` — **ساختار کاملاً متفاوت، نام یکسان:**

### ۴-۱. `src/utils/fonts.ts` → وزن‌ها
```ts
export const Fonts = {
  light:     { fontFamily: 'Vazirmatn-Light' },
  regular:   { fontFamily: 'Vazirmatn' },
  medium:    { fontFamily: 'Vazirmatn-Medium' },
  semiBold:  { fontFamily: 'Vazirmatn-SemiBold' },
  bold:      { fontFamily: 'Vazirmatn-Bold' },
  extraBold: { fontFamily: 'Vazirmatn-ExtraBold' },
};
```

### ۴-۲. `src/constants/theme.ts:72-75` → خانواده‌های پلتفرمی
```ts
export const Fonts = Platform.select({
  ios:     { sans: 'Vazirmatn', serif: 'ui-serif',     rounded: 'ui-rounded', mono: 'ui-monospace' },
  default: { sans: 'Vazirmatn', serif: 'serif',        rounded: 'normal',     mono: 'monospace' },
});
```

🔴 **خطر:** اگر فایلی `import { Fonts } from '@/constants/theme'` داشته باشد
و دیگری `import Fonts from '@/utils/fonts'`، استفاده از `Fonts.bold` در اولی
`undefined` می‌شود — **بدون خطای TypeScript** اگر type درست infer نشود.

### ۴-۳. 🔴 یک `Fonts` سوم: default export از `_layout.tsx`
`CONFIRMED` `app/(tabs)/orders.tsx:15`:
```ts
import Fonts from '../_layout';
```
`app/_layout.tsx` خط ۱۵۱: `export default Sentry.wrap(RootLayout);`

🔴 پس `Fonts` در `orders.tsx` در واقع **یک کامپوننت React پیچیده‌شده با Sentry** است!
`CONFIRMED` `grep -c "Fonts\." "app/(tabs)/orders.tsx"` → **0** — یعنی استفاده نمی‌شود.

> **این یک import مرده است که یک import چرخه‌ای هم ایجاد می‌کند.**
> حذفش بی‌خطر است (`grep` تأیید می‌کند استفاده نمی‌شود) — ولی طبق قوانین،
> **اول از کاربر بپرسید.**

---

## 5. سایر توکن‌های طراحی

`CONFIRMED` از `src/constants/theme.ts`:

### ۵-۱. فاصله‌ها — ⚠️ دو مجموعهٔ موازی
```ts
export const SPACING = { s1:4, s2:8, s3:12, s4:16, s5:20, s6:24, s8:32, s10:40 };
export const Spacing = { ...SPACING, one:4, two:8, three:16, four:24, five:32, six:64, half:2 };
```
⚠️ `Spacing.three = 16` ولی `SPACING.s3 = 12` — **مقادیر متفاوت برای نام‌های مشابه!**

### ۵-۲. گوشه‌ها
```ts
export const RADIUS = { sm: 8, md: 12, lg: 16, xl: 20, full: 999 };
```

### ۵-۳. تم تاریک
```ts
export const Colors = { light: {...}, dark: {...} };
```
⚠️ `CONFIRMED` تم تاریک **تعریف شده** ولی:
- `StatusBar style="dark"` در `_layout.tsx` hardcode است
- `COLORS.background = '#F8FAFC'` (روشن) در همهٔ پالت‌های دیگر استفاده می‌شود

`INFERRED` **تم تاریک عملاً فعال نیست.** `UNVERIFIED`.

### ۵-۴. سایر
```ts
export const MaxContentWidth = 800;
export const BottomTabInset = Platform.select({ ios: 50, android: 60 }) ?? 0;
```

---

## 6. فونت

`CONFIRMED` ۶ وزن Vazirmatn در `src/assets/fonts/`:
```
Vazirmatn-Light.ttf      Vazirmatn-Regular.ttf    Vazirmatn-Medium.ttf
Vazirmatn-SemiBold.ttf   Vazirmatn-Bold.ttf       Vazirmatn-ExtraBold.ttf
```

### ۶-۱. 🔴 مسیر لود اشتباه
`CONFIRMED` `app/_layout.tsx:110-115`:
```ts
require("../assets/fonts/Vazirmatn-Regular.ttf")
//      ↑ یعنی wholesale-mobile/assets/fonts/  ← ✅ موجود (۶ فونت Vazirmatn)
```
فایل‌های واقعی در `wholesale-mobile/src/assets/fonts/` هستند.
→ `17-KNOWN-ISSUES.md` §مسیر assets

### ۶-۲. اعمال سراسری فونت
`CONFIRMED` `_layout.tsx:43-58` → `FontApplied()`:
```ts
RNText.defaultProps.style      = [{ fontFamily: "Vazirmatn" }, RNText.defaultProps.style];
RNTextInput.defaultProps.style = [{ fontFamily: "Vazirmatn" }, RNTextInput.defaultProps.style];
```
⚠️ `defaultProps` در React 19 منسوخ شده. `UNVERIFIED` آیا روی React 19.2.3 کار می‌کند.

---

## 7. الگوهای UI در routeها

`CONFIRMED` الگوی رایج در صفحه‌ها:

```tsx
<SafeAreaView style={{ flex: 1, backgroundColor: C.background }}>
  {/* هدر سفارشی — headerShown: false در Stack */}
  <View style={{ height: 56, flexDirection: 'row-reverse', ... }}>
    <TouchableOpacity onPress={() => router.back()}>
      <Ionicons name="arrow-forward" size={24} />
    </TouchableOpacity>
    <Text>عنوان</Text>
  </View>

  <ScrollView contentContainerStyle={{ padding: 16 }}>
    ...
  </ScrollView>
</SafeAreaView>
```

### ۷-۱. قواعد RTL
`CONFIRMED`
- `flexDirection: 'row-reverse'` برای ردیف‌ها (چون RN پیش‌فرض LTR است)
- `textAlign: 'right'` برای متن
- آیکون «بازگشت» = `arrow-forward` (نه `arrow-back`)
- `marginRight` ↔ `marginLeft` جابه‌جا می‌شوند

⚠️ **هیچ `I18nManager.forceRTL(true)` وجود ندارد.** `INFERRED` RTL دستی با
`row-reverse` پیاده شده.

### ۷-۲. اعداد فارسی
`CONFIRMED` در `app/(tabs)/home.tsx:58`:
```ts
const fa = (n: number | string) => String(n).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]);
```
⚠️ `CONFIRMED` این helper **در هر فایل تکرار شده** (home, browse, orders, ...) —
به `src/utils/format.ts` منتقل نشده.

---

## 8. پنل ادمین — کامپوننت‌ها

`CONFIRMED` **هیچ کامپوننتی وجود ندارد** — همه‌چیز رشتهٔ HTML است.

### ۸-۱. فایل‌ها
| فایل | خط | محتوا |
|---|---|---|
| `index.html` | — | اسکلت + ترتیب `<script>` |
| `styles.css` | — | همهٔ استایل‌ها |
| `core.js` | — | `http()`, auth, `toast()`, `fmt()`, `fa()` |
| `orders.js` | — | view سفارش‌ها + فاکتور |
| `products.js` | — | view محصولات/دسته‌بندی/بنر |
| `visitor-sales.js` | 469 | view فروش حضوری |
| `app.js` | — | router + `renderLayout()` + bootstrap |
| **جمع** | **3,827** | |

### ۸-۲. ۱۱ view
```
dashboard · customers · orders · visitor-sales · products ·
categories · banners · tickets · notifications · security · settings
```

### ۸-۳. الگو
```js
// هر view یک global function است
async function renderOrders() {
  const data = await http('/admin/orders?page=1');
  document.getElementById('content').innerHTML = `...`;
}
```

⚠️ `CONFIRMED` **`innerHTML` با دادهٔ کاربر** → خطر XSS اگر دادهٔ محصول/تیکت
سانیتایز نشود. `UNVERIFIED` — نتوانستم تأیید کنم سانیتایز انجام می‌شود یا نه.

---

## 9. قواعد ساخت کامپوننت جدید

```
☐ ۱. در زیرپوشهٔ درست بگذارید (product/ search/ ui/ onboarding/)
☐ ۲. از @/constants/theme → COLORS استفاده کنید، نه پالت محلی جدید
☐ ۳. اگر نسخهٔ وب متفاوت لازم دارد، فایل .web.tsx بسازید
☐ ۴. RTL را با flexDirection: 'row-reverse' رعایت کنید
☐ ۵. متن‌ها فارسی باشند
☐ ۶. اگر قیمت نشان می‌دهید، سه حالت PriceBox را پیاده کنید
☐ ۷. اعداد را با fa() فارسی کنید
☐ ۸. npx tsc --noEmit && npx expo lint
```
