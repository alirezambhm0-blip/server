// src/constants/customerStatus.ts

// این enum باید دقیقا با schema.prisma هم‌خوان باشد.
export enum CustomerStatus {
  PENDING = "PENDING",
  APPROVED = "APPROVED",
  REJECTED = "REJECTED",
  BLOCKED = "BLOCKED",
}

export const ALL_CUSTOMER_STATUSES: CustomerStatus[] = [
  CustomerStatus.PENDING,
  CustomerStatus.APPROVED,
  CustomerStatus.REJECTED,
  CustomerStatus.BLOCKED,
];