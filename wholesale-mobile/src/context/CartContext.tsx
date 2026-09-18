// src/context/CartContext.tsx
import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useCallback,
  useRef,
} from 'react';
import { AppState, AppStateStatus } from 'react-native';

import { Product } from '@/types/product';
import { CartItem, Cart } from '@/types/cart';
import { cartStorage } from '@/storage/cartStorage';
import { useAuth } from '@/context/AuthContext';
import { cartApi, serverCartToLocal } from '@/api/cartApi';

type CartContextValue = {
  items: CartItem[];
  totalItems: number;
  totalPrice: number;
  isLoading: boolean;
  isSyncing: boolean;
  syncError: string | null;
  addToCart: (product: Product, quantity?: number) => Promise<{ ok: boolean; message?: string }>;
  updateQuantity: (productId: string, delta: number) => Promise<{ ok: boolean; message?: string }>;
  setQuantity: (productId: string, quantity: number) => Promise<{ ok: boolean; message?: string }>;
  removeFromCart: (productId: string) => Promise<void>;
  clearCart: () => Promise<void>;
  refreshCart: () => Promise<void>;
};

const CartContext = createContext<CartContextValue | undefined>(undefined);

const generateUniqueId = (): string =>
  `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

function makeLocalItem(product: Product, quantity: number): CartItem {
  const price = product.price || 0;
  return {
    id: generateUniqueId(),
    productId: product.id,
    unitPrice: price,
    totalPrice: price * quantity,
    quantity,
    product,
  };
}

function calcTotals(its: CartItem[]) {
  const totalItems = its.reduce((s, i) => s + i.quantity, 0);
  const totalPrice = its.reduce((s, i) => {
    const p = i.unitPrice ?? i.product?.price ?? 0;
    return s + p * i.quantity;
  }, 0);
  return { totalItems, totalPrice };
}

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isLoggedIn, accessToken } = useAuth();

  const [items, setItems] = useState<CartItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  const taskQueue = useRef<Promise<unknown>>(Promise.resolve());

  // ═══════════════════════════════════════════════════════════════
  // همه‌ی عملیات optimistic با ref زنده (نه closure)
  // ═══════════════════════════════════════════════════════════════
  const itemsRef = useRef(items);
  itemsRef.current = items;

  const applyLocalList = useCallback((list: CartItem[]) => {
    setItems(list);
    cartStorage.saveCart(list).catch(() => {});
  }, []);

  const runOnQueue = useCallback(
    (task: () => Promise<any>, _o: () => void, rollback: () => void): Promise<any> => {
      const prom = taskQueue.current
        .catch(() => {})
        .then(() => task())
        .then((result) => {
          const local = serverCartToLocal(result);
          setItems(local.items);
          cartStorage.saveCart(local.items).catch(() => {});
          setSyncError(null);
          return result;
        })
        .catch((err) => {
          rollback();
          const msg = err?.data?.message || err?.message || 'خطا در به‌روزرسانی سبد';
          setSyncError(typeof msg === 'string' ? msg : 'خطا در به‌روزرسانی سبد');
          console.warn('[Cart] operation failed', err);
          throw err;
        });
      taskQueue.current = prom.catch(() => {});
      return prom;
    },
    [],
  );

  // بارگذاری اولیه
  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      setIsLoading(true);
      try {
        const local = await cartStorage.getCart();
        if (isLoggedIn && accessToken) {
          try {
            const localSlim = local
              .filter((i) => i.productId && i.quantity > 0)
              .map((i) => ({ productId: i.productId, quantity: i.quantity }));
            const remote = await cartApi.merge(localSlim);
            const localCart = serverCartToLocal(remote);
            if (!cancelled) { setItems(localCart.items); await cartStorage.saveCart(localCart.items); }
          } catch (err) {
            console.warn('[Cart] Initial merge failed, using local cache', err);
            if (!cancelled) { setItems(local || []); setSyncError('خطا در همگام‌سازی با سرور'); }
          }
        } else {
          if (!cancelled) { setItems([]); await cartStorage.clearCart(); }
        }
      } catch (e) { console.error('[Cart] Init error', e); }
      finally { if (!cancelled) setIsLoading(false); }
    };
    init();
    return () => { cancelled = true; };
  }, [isLoggedIn, accessToken]);

  // خالی‌کردن سبد بعد از logout
  const prevLoggedIn = useRef(isLoggedIn);
  useEffect(() => {
    if (prevLoggedIn.current && !isLoggedIn) {
      setItems([]); cartStorage.clearCart().catch(() => {});
    }
    prevLoggedIn.current = isLoggedIn;
  }, [isLoggedIn]);

  const refreshCart = useCallback(async () => {
    if (!isLoggedIn) return;
    setIsSyncing(true);
    try {
      const r = await cartApi.get();
      const local = serverCartToLocal(r);
      setItems(local.items); await cartStorage.saveCart(local.items); setSyncError(null);
    } catch (err: any) {
      setSyncError(err?.data?.message || err?.message || 'خطا در به‌روزرسانی سبد');
    } finally { setIsSyncing(false); }
  }, [isLoggedIn]);

  useEffect(() => {
    const onAppState = (state: AppStateStatus) => {
      if (state === 'active' && isLoggedIn) refreshCart().catch(() => {});
    };
    const sub = AppState.addEventListener('change', onAppState);
    return () => sub.remove();
  }, [isLoggedIn, refreshCart]);

  // ──────────────────────────────────────────────────────────────

  const addToCart = useCallback(
    async (product: Product, quantity: number = 1): Promise<{ ok: boolean; message?: string }> => {
      if (!isLoggedIn) return { ok: false, message: 'برای افزودن به سبد باید وارد شوید' };
      if (!product || !product.id) return { ok: false };
      
      // اصلاح شرط موجودی بر اساس تایپ جدید محصول
      if (!product.isActive || product.stock <= 0) {
        return { ok: false, message: 'این محصول در حال حاضر موجود نیست' };
      }

      const prev = itemsRef.current;
      const already = prev.find((i) => i.productId === product.id);
      let next: CartItem[];
      if (already) {
        next = prev.map((i) =>
          i.productId === product.id
            ? { ...i, quantity: i.quantity + quantity, totalPrice: (i.unitPrice || product.price || 0) * (i.quantity + quantity) }
            : i,
        );
      } else {
        next = [...prev, makeLocalItem(product, quantity)];
      }
      applyLocalList(next);
      try {
        await runOnQueue(() => cartApi.add(product.id, quantity), () => {}, () => applyLocalList(prev));
        return { ok: true };
      } catch (err: any) {
        return { ok: false, message: (Array.isArray(err?.data?.message) ? err.data.message.join('، ') : err?.data?.message) || err?.message || 'افزودن به سبد ناموفق بود' };
      }
    },
    [isLoggedIn, applyLocalList, runOnQueue],
  );

  const updateQuantity = useCallback(
    async (productId: string, delta: number): Promise<{ ok: boolean; message?: string }> => {
      if (!isLoggedIn) return { ok: false, message: 'باید وارد شوید' };

      // ═══════════════════════════════════════════════════════
      // کلید حل مشکل: از ref استفاده کن، نه state
      // itemsRef.current همیشه آخرین مقدار را دارد.
      // ═══════════════════════════════════════════════════════
      const cur = itemsRef.current.find((i) => i.productId === productId);

      // اگر آیتم در سبد نیست و delta مثبت → از addToCart استفاده کن
      if (!cur) {
        if (delta > 0) {
          // باید addToCart صدا زده بشه نه اینکه برگرده خطا
          const product = itemsRef.current.find(
            (i) => i.productId === productId,
          )?.product;
          // اگر product نداریم، نمی‌تونیم add کنیم
          return { ok: false, message: 'آیتم در سبد نیست' };
        }
        return { ok: false, message: 'آیتم در سبد نیست' };
      }

      const newQty = cur.quantity + delta;

      if (newQty <= 0) {
        // ── WIPE: حذف کامل (optimistic + no rollback) ──
        const prev = itemsRef.current;
        const next = prev.filter((i) => i.productId !== productId);
        applyLocalList(next);

        // سرور: تلاش برای حذف، ولی در صورت خطا آیتم را زنده نمی‌کنیم
        try {
          await runOnQueue(() => cartApi.remove(productId), () => {}, () => {});
        } catch {
          console.warn('[Cart] remove call failed, item stays removed locally');
        }
        return { ok: true };
      }

      // ── UPDATE: تغییر تعداد عادی ──
      const prev = itemsRef.current;
      const next = prev.map((i) =>
        i.productId === productId
          ? { ...i, quantity: newQty, totalPrice: (i.unitPrice || i.product?.price || 0) * newQty }
          : i,
      );
      applyLocalList(next);

      try {
        await runOnQueue(
          () => cartApi.update(productId, newQty),
          () => {},
          () => applyLocalList(prev),
        );
        return { ok: true };
      } catch (err: any) {
        return {
          ok: false,
          message: (Array.isArray(err?.data?.message) ? err.data.message.join('، ') : err?.data?.message) || err?.message || 'به‌روزرسانی سبد ناموفق بود',
        };
      }
    },
    [isLoggedIn, applyLocalList, runOnQueue],
  );

  const setQuantity = useCallback(
    async (productId: string, quantity: number): Promise<{ ok: boolean; message?: string }> => {
      if (!isLoggedIn) return { ok: false, message: 'باید وارد شوید' };
      const cur = itemsRef.current.find((i) => i.productId === productId);
      if (!cur) return { ok: false, message: 'آیتم در سبد نیست' };
      return updateQuantity(productId, quantity - cur.quantity);
    },
    [isLoggedIn, updateQuantity],
  );

  const removeFromCart = useCallback(
    async (productId: string) => { await setQuantity(productId, 0); },
    [setQuantity],
  );

  const clearCart = useCallback(async () => {
    const prev = itemsRef.current;
    applyLocalList([]);
    if (isLoggedIn) {
      try { await runOnQueue(() => cartApi.clear(), () => {}, () => applyLocalList(prev)); } catch {}
    }
  }, [isLoggedIn, applyLocalList, runOnQueue]);

  const totals = useMemo(() => calcTotals(items), [items]);

  const value: CartContextValue = {
    items, totalItems: totals.totalItems, totalPrice: totals.totalPrice,
    isLoading, isSyncing, syncError,
    addToCart, updateQuantity, setQuantity, removeFromCart, clearCart, refreshCart,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};

export const useCart = () => {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within a CartProvider');
  return ctx;
};
