// =========================
// USER ROLE
// =========================

export const UserRole = {
  CUSTOMER: 'CUSTOMER',
  ADMIN: 'ADMIN',
} as const;

export type UserRole =
  (typeof UserRole)[keyof typeof UserRole];

// =========================
// CUSTOMER STATUS
// =========================

export const CustomerStatus = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  BLOCKED: 'BLOCKED',
} as const;

export type CustomerStatus =
  (typeof CustomerStatus)[keyof typeof CustomerStatus];

// =========================
// ORDER STATUS
// =========================

export const OrderStatus = {
  PENDING: 'PENDING',
  CONFIRMED: 'CONFIRMED',
  PROCESSING: 'PROCESSING',
  SHIPPED: 'SHIPPED',
  DELIVERED: 'DELIVERED',
  CANCELLED: 'CANCELLED',
} as const;

export type OrderStatus =
  (typeof OrderStatus)[keyof typeof OrderStatus];

// =========================
// PAYMENT METHOD
// =========================

export const PaymentMethod = {
  CARD_TO_CARD: 'CARD_TO_CARD',
  ZARRINPAL: 'ZARRINPAL',
  ZIBAL: 'ZIBAL',
} as const;

export type PaymentMethod =
  (typeof PaymentMethod)[keyof typeof PaymentMethod];

// =========================
// PAYMENT STATUS
// =========================

export const PaymentStatus = {
  UNPAID: 'UNPAID',
  PENDING: 'PENDING',
  PAID: 'PAID',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
} as const;

export type PaymentStatus =
  (typeof PaymentStatus)[keyof typeof PaymentStatus];

// =========================
// PRODUCT UNIT
// =========================

export const ProductUnit = {
  CARTON: 'CARTON',
  KG: 'KG',
  PACK: 'PACK',
  PIECE: 'PIECE',
  GRAM: 'GRAM',
  LITER: 'LITER',
  BOX: 'BOX',
} as const;

export type ProductUnit =
  (typeof ProductUnit)[keyof typeof ProductUnit];
