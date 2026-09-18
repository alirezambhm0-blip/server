# 13 — STATE MANAGEMENT

---

## 1. اصل کلی

`CONFIRMED` **هیچ Redux / Zustand / MobX / React Query نصب نیست.**
همهٔ state با **سه React Context** مدیریت می‌شود:

```
AuthProvider        (272 خط)  ← هویت کاربر، توکن، وضعیت KYC
  └─ CartProvider   (303 خط)  ← سبد خرید + همگام‌سازی با سرور
       └─ FavoritesProvider (72 خط) ← علاقه‌مندی‌ها
```

⚠️ `CONFIRMED` **ترتیب اجباری است** — `CartProvider` و `FavoritesProvider`
هر دو `useAuth()` را صدا می‌زنند.

### ۱-۱. state محلی صفحه
`CONFIRMED` بقیهٔ state (فیلترها، اسکرول، فرم‌ها) با `useState`/`useRef` محلی در هر route.

---

## 2. `AuthContext`

`CONFIRMED` از `src/context/AuthContext.tsx`

### ۲-۱. state داخلی
```ts
const [customer, setCustomer]         = useState<StoredCustomer | null>(null);
const [accessToken, setAccessToken]   = useState<string | null>(null);
const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
const [loading, setLoading]           = useState(true);
const [authStatus, setAuthStatus]     = useState<AuthStatus>("loading");
```

### ۲-۲. ⭐ `authStatus` — چهار حالت
`CONFIRMED` `AuthContext.tsx:22-27` (با کامنت اصلی):
```ts
// سه وضعیت اصلی auth طبق نیازمندی محصول:
// loading         -> در حال restore کردن session از storage
// unauthenticated -> هیچ session و هیچ guest mode ای فعال نیست (باید Welcome را ببیند)
// guest           -> کاربر مهمان، هنوز احراز هویت نشده اما وارد اپ شده
// authenticated   -> کاربر واقعی با accessToken و customer معتبر
export type AuthStatus = "loading" | "unauthenticated" | "guest" | "authenticated";
```

### ۲-۳. مقادیر derived (computed)
`CONFIRMED` از `AuthContextType`:
```ts
isLoggedIn          // authStatus === "authenticated"
isGuest             // authStatus === "guest"
isApprovedCustomer  // customer?.status === APPROVED
isPendingCustomer   // customer?.status === PENDING
isRejectedCustomer  // customer?.status === REJECTED
isBlockedCustomer   // customer?.status === BLOCKED
needsOnboarding     // کاربر واقعی است ولی onboardingCompleted === false
```

⚠️ `CONFIRMED` `CustomerStatus` از `@/constants/customerStatus` import می‌شود
(کامنت: «منبع واحد enum»).

### ۲-۴. توابع
| تابع | رفتار |
|---|---|
| `login(token, customer)` | ذخیره در SecureStore → `authenticated` → `await getMeApi()` → push token |
| `completeOnboarding(customer)` | فقط `customer` ذخیره‌شده را جایگزین می‌کند؛ **توکن ثابت می‌ماند** |
| `logout()` | `removePushToken()` → `clearAll()` → `unauthenticated` 🔴 **بدون `POST /auth/logout`** |
| `refreshAuth()` | `getMeApi()` و به‌روزرسانی |
| `continueAsGuest()` | `setGuestModeActive(true)` → `guest` |
| `exitGuestMode()` | برگشت از حالت مهمان |

### ۲-۵. ⚠️ رفتار مهم: `authenticated` قبل از اعتبارسنجی
`CONFIRMED` در `syncAuthState()` خط ۸۶:
```ts
setAuthStatus("authenticated");     // ← قبل از اینکه توکن چک شود
void getMeApi().then(...).catch(...);   // async، منتظر نمی‌ماند
```
> **پیامد:** کاربر با توکن منقضی لحظه‌ای UI لاگین‌شده می‌بیند،
> تا اینکه اولین درخواست 401 بگیرد و interceptor او را خارج کند.

---

## 3. `CartContext` — پیچیده‌ترین state پروژه

`CONFIRMED` از `src/context/CartContext.tsx` (303 خط)

### ۳-۱. state
```ts
const [items, setItems]         = useState<CartItem[]>([]);
const [isLoading, setIsLoading] = useState(true);
const [isSyncing, setIsSyncing] = useState(false);
const [syncError, setSyncError] = useState<string | null>(null);
```

### ۳-۲. ⭐ دو ref حیاتی

#### `itemsRef` — حل stale closure
`CONFIRMED` `CartContext.tsx:70-74`:
```ts
// ═══════════════════════════════════════════════════════════════
// همه‌ی عملیات optimistic با ref زنده (نه closure)
// ═══════════════════════════════════════════════════════════════
const itemsRef = useRef(items);
itemsRef.current = items;
```

و کامنت صریح در `updateQuantity` (خط ۱۹۹-۲۰۳):
```ts
// ═══════════════════════════════════════════════════════
// کلید حل مشکل: از ref استفاده کن، نه state
// itemsRef.current همیشه آخرین مقدار را دارد.
// ═══════════════════════════════════════════════════════
const cur = itemsRef.current.find((i) => i.productId === productId);
```

🔒 **این الگو را «تمیز» نکنید.** `useCallback` با `[]` یا deps محدود
اگر از `items` (state) استفاده کند، مقدار کهنه می‌گیرد.

#### `taskQueue` — سریالی‌کردن عملیات
`CONFIRMED` `CartContext.tsx:68`:
```ts
const taskQueue = useRef<Promise<unknown>>(Promise.resolve());
```
`runOnQueue(task, _o, rollback)`:
```
taskQueue.current
  .catch(() => {})
  .then(() => task())                    ← اجرای درخواست سرور
  .then(result => setItems(serverCartToLocal(result).items))   ← ⭐ سرور منبع حقیقت است
  .catch(err => { rollback(); setSyncError(...) })
taskQueue.current = prom.catch(() => {})
```

✅ **بعد از هر عملیات موفق، state از پاسخ سرور بازنویسی می‌شود** — نه از حدس محلی.

### ۳-۳. الگوی optimistic update

```
۱. prev = itemsRef.current
۲. next = محاسبهٔ محلی
۳. applyLocalList(next)        ← UI فوراً به‌روز می‌شود + ذخیره در cartStorage
۴. await runOnQueue(
      () => cartApi.xxx(...),
      () => {},                 ← onSuccess (استفاده نمی‌شود)
      () => applyLocalList(prev)  ← rollback در صورت خطا
   )
```

### ۳-۴. ⚠️ استثنای مهم: حذف آیتم rollback ندارد
`CONFIRMED` `CartContext.tsx:229-240`:
```ts
if (newQty <= 0) {
  // ── WIPE: حذف کامل (optimistic + no rollback) ──
  applyLocalList(next);
  try {
    await runOnQueue(() => cartApi.remove(productId), () => {}, () => {});
  } catch {
    console.warn('[Cart] remove call failed, item stays removed locally');
  }
  return { ok: true };      // ← ⚠️ حتی در صورت خطا ok:true برمی‌گرداند
}
```
🔴 **این عمدی است** (کامنت صریح) ولی یک ناسازگاری state ایجاد می‌کند:
اگر حذف سمت سرور شکست بخورد، آیتم محلی حذف‌شده می‌ماند ولی در DB هست.
> در `refreshCart()` بعدی (مثلاً وقتی اپ active می‌شود) اصلاح می‌شود.

### ۳-۵. `addToCart` برای مهمان
`CONFIRMED` `CartContext.tsx:167`:
```ts
if (!isLoggedIn) return { ok: false, message: 'برای افزودن به سبد باید وارد شوید' };
```
🔴 **مهمان سبد خرید ندارد.** `cartStorage` هم در حالت لاگین‌نکرده پاک می‌شود (خط ۱۲۶).

### ۳-۶. همگام‌سازی خودکار
`CONFIRMED` دو مکانیزم:

**الف) هنگام mount / تغییر `isLoggedIn`** (خط ۱۰۷-۱۳۳)
```
local = cartStorage.getCart()
remote = cartApi.merge(local.filter(i => i.productId && i.quantity > 0)
                            .map(i => ({productId, quantity})))
```

**ب) هنگام فعال‌شدن اپ** (خط ۱۵۶-۱۶۲)
```ts
const onAppState = (state) => {
  if (state === 'active' && isLoggedIn) refreshCart().catch(() => {});
};
AppState.addEventListener('change', onAppState);
```

**ج) هنگام logout** (خط ۱۳۶-۱۴۲)
```ts
if (prevLoggedIn.current && !isLoggedIn) {
  setItems([]); cartStorage.clearCart().catch(() => {});
}
```

### ۳-۷. `setQuantity` و `removeFromCart`
`CONFIRMED` هر دو به `updateQuantity` واگذار می‌کنند:
```ts
setQuantity(productId, quantity) → updateQuantity(productId, quantity - cur.quantity)
removeFromCart(productId)        → setQuantity(productId, 0)
```

⚠️ `CONFIRMED` `setQuantity` اگر آیتم در سبد نباشد → `{ ok: false, message: 'آیتم در سبد نیست' }`
(نه افزودن).

### ۳-۸. totals
`CONFIRMED` `CartContext.tsx:51-58` + `useMemo`:
```ts
totalItems = items.reduce((s, i) => s + i.quantity, 0);
totalPrice = items.reduce((s, i) => s + (i.unitPrice ?? i.product?.price ?? 0) * i.quantity, 0);
```

⚠️ **این مبلغ فقط برای نمایش است.** مبلغ واقعی سفارش در
`orders.service.ts` از قیمت DB محاسبه می‌شود.

---

## 4. `FavoritesContext`

`CONFIRMED` از `src/context/FavoritesContext.tsx` (72 خط) — ساده‌ترین context.

### ۴-۱. state
```ts
const [favorites, setFavorites] = useState<string[]>([]);   // فقط IDها
```

### ۴-۲. توابع
```ts
refreshFavorites()  → اگر !isLoggedIn → []; وگرنه productsApi.getFavorites()
toggleFavorite(p)   → optimistic + rollback در catch
isFavorite(id)      → favorites.includes(id)
```

### ۴-۳. الگوی optimistic با rollback
`CONFIRMED` `FavoritesContext.tsx:36-57`:
```ts
const isCurrentlyFav = favorites.includes(product.id);
// optimistic
if (isCurrentlyFav) setFavorites(prev => prev.filter(id => id !== product.id));
else                setFavorites(prev => [...prev, product.id]);

try { await productsApi.toggleFavorite(product.id); }
catch (e) { /* rollback */ }
```

⚠️ `CONFIRMED` **بدون `useCallback`** — هر render توابع جدید می‌سازد.
`INFERRED` برای ۷۲ خط مشکلی ایجاد نمی‌کند، ولی با `CartContext` ناسازگار است.

### ۴-۴. ⚠️ خطای خاموش
`CONFIRMED` `toggleFavorite` اگر `!isLoggedIn` باشد، **بی‌صدا `return` می‌کند**.
کاربر هیچ پیامی نمی‌بیند. (مقایسه کنید با `addToCart` که پیام می‌دهد.)

### ۴-۵. 🔴 صفحهٔ علاقه‌مندی‌ها stub است
`CONFIRMED` `app/(profile)/favorites.tsx` از `useFavorites` استفاده **نمی‌کند**
(`grep -c "useFavorites"` → 0). پس این context عملاً فقط برای آیکون قلب در
`ProductCard` استفاده می‌شود.

---

## 5. لایهٔ API به‌عنوان state

`CONFIRMED` **هیچ cache لایهٔ API وجود ندارد** (بدون React Query / SWR).
هر صفحه خودش `useEffect` + `useState` + `await api.xxx()` می‌نویسد.

### ۵-۱. الگوی رایج در routeها
```tsx
const [data, setData]     = useState<T[]>([]);
const [loading, setLoading] = useState(true);
const [error, setError]   = useState<string | null>(null);

const loadData = useCallback(async () => {
  setLoading(true);
  try { setData(await someApi.list()); setError(null); }
  catch (e) { setError(e?.message || 'خطا'); }
  finally { setLoading(false); }
}, []);

useEffect(() => { loadData(); }, [loadData]);
useFocusEffect(useCallback(() => { loadData(); }, [loadData]));
```

⚠️ `INFERRED` این الگو در `home.tsx`, `browse.tsx`, `orders.tsx`, `profile.tsx`
تکرار شده. **هیچ dedup یا cache نیست** → هر بار صفحه باز شود، درخواست تازه می‌رود.

### ۵-۲. `useForceUpdate` — مرده
`CONFIRMED` `src/hooks/useForceUpdate.ts` وجود دارد ولی:
- در `app/_layout.tsx:17` فقط **import** شده
- `grep -rn "useForceUpdate("` → **هیچ فراخوانی‌ای نیست**

🔴 **کد مرده.** احتمالاً برای force update اجباری اپ در نظر گرفته شده بود.

---

## 6. ذخیره‌سازی پایدار

| فایل | مکانیزم | داده |
|---|---|---|
| `src/storage/authStorage.ts` (326) | **expo-secure-store** | `accessToken`, `customer` |
| | **AsyncStorage** | `guestModeActive`, `hasSeenWelcome` |
| `src/storage/cartStorage.ts` | AsyncStorage | سبد (فقط cache) |

`CONFIRMED` `authStorage.clearAll()` هر دو را پاک می‌کند.

⚠️ `CONFIRMED` **تنظیمات اعلان‌ها هیچ‌جا ذخیره نمی‌شوند** —
`app/(profile)/notification-settings.tsx` فقط `useState` دارد.

---

## 7. state سمت بک‌اند

`CONFIRMED` **بک‌اند stateless است** — هیچ cache در حافظه ندارد.

تنها state غیر-DB:
| مورد | محل | نکته |
|---|---|---|
| فایل‌های آپلودشده | `uploads/{kyc,products,categories}/` | filesystem |
| بکاپ‌ها | `backups/` | filesystem |
| اتصال Prisma | `PrismaService` (singleton) | connection pool |

⚠️ `INFERRED` چون هیچ cache در حافظه نیست، **افقی‌سازی (چند instance) آسان است** —
به‌جز فایل‌های آپلودشده که روی دیسک محلی‌اند و بین instanceها به اشتراک گذاشته نمی‌شوند.

---

## 8. state پنل ادمین

`CONFIRMED` **هیچ state مرکزی ندارد** — هر view خودش داده را می‌گیرد و در DOM می‌ریزد.

تنها state پایدار:
| داده | محل |
|---|---|
| توکن | `localStorage` (fallback) / کوکی HttpOnly (غیرقابل خواندن) |
| view فعلی | `location.hash` |

---

## 9. قواعد تغییر state

```
☐ ۱. state جدید سراسری واقعاً لازم است؟ (اگر فقط یک صفحه است → useState محلی)
☐ ۲. اگر به context اضافه می‌کنید، ترتیب providerها را نشکنید
☐ ۳. در CartContext از itemsRef استفاده کنید، نه items
☐ ۴. optimistic update + rollback بنویسید
☐ ۵. بعد از عملیات موفق، state را از پاسخ سرور بازنویسی کنید
     (الگوی runOnQueue)
☐ ۶. اگر فیلد جدیدی به CartItem اضافه می‌کنید، serverCartToLocal را هم به‌روز کنید
☐ ۷. npx tsc --noEmit && npx expo lint
```

### ۹-۱. ⚠️ تله‌های شناخته‌شده

| تله | نتیجه |
|---|---|
| استفاده از `items` به‌جای `itemsRef.current` در `useCallback` | مقدار کهنه → آپدیت اشتباه |
| حذف `taskQueue` | شرط race بین درخواست‌های سریع |
| تغییر `setAuthStatus("authenticated")` به بعد از `getMeApi()` | UI برای چند ثانیه `loading` می‌ماند |
| افزودن rollback به مسیر حذف آیتم | با کامنت «no rollback» تضاد دارد — اول بپرسید |
| `useFavorites` در یک صفحهٔ جدید | ✅ امن است، provider در ریشه هست |
