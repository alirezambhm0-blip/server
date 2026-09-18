import AsyncStorage from "@react-native-async-storage/async-storage";
import { CartItem } from "@/types/cart";

const CART_KEY = "CART_ITEMS";

let writeLock: Promise<void> = Promise.resolve();

export const cartStorage = {
  async saveCart(items: CartItem[]): Promise<void> {
    // صف‌بندی write ها برای جلوگیری از race condition
    writeLock = writeLock.then(async () => {
      try {
        const json = JSON.stringify(items);
        await AsyncStorage.setItem(CART_KEY, json);
      } catch (error) {
        console.error("Critical: Failed to save cart to storage", error);
      }
    });

    return writeLock;
  },

  async getCart(): Promise<CartItem[]> {
    try {
      const json = await AsyncStorage.getItem(CART_KEY);

      if (!json) return [];

      const parsed = JSON.parse(json);

      // محافظت در برابر data corruption
      if (!Array.isArray(parsed)) {
        console.warn("Cart storage corrupted, resetting");
        await AsyncStorage.removeItem(CART_KEY);
        return [];
      }

      return parsed;
    } catch (error) {
      console.error("Critical: Failed to get cart from storage", error);
      return [];
    }
  },

  async clearCart(): Promise<void> {
    try {
      await AsyncStorage.removeItem(CART_KEY);
    } catch (error) {
      console.error("Critical: Failed to clear cart storage", error);
    }
  },
};
