// src/api/cart.ts
import { Product } from "./product";

export interface CartItem {
  id: string;
  productId: string;

  product: Product;

  quantity: number;

  unitPrice: number;
  totalPrice: number;

  createdAt?: string;
  updatedAt?: string;
}

export interface Cart {
  items: CartItem[];

  totalItems: number;

  subtotal: number;

  discount?: number;

  totalPrice: number;
}

export interface AddToCartPayload {
  productId: string;
  quantity?: number;
}

export interface UpdateCartItemPayload {
  itemId: string;
  quantity: number;
}

export interface RemoveCartItemPayload {
  itemId: string;
}
