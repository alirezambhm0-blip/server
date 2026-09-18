// src/api/onboardingApi.ts
import { httpClient } from './httpClient';
import { StoredCustomer } from '../storage/authStorage';

export interface OnboardingPayload {
  // ۱. اطلاعات فردی و هویتی
  firstName: string;
  lastName: string;
  nationalCode: string;

  // ۲. اطلاعات کسب‌وکار و صنف
  businessName: string;
  businessType: string;
  landlinePhone: string;

  // ۳. آدرس و موقعیت
  province: string;
  city: string;
  exactAddress: string;
  postalCode: string;
  locationCoordinates?: { lat: number; lng: number };

  // ۴. مدارک (فایل‌نیم‌های KYC که از POST /files/kyc برگشته‌اند)
  // مثال: nationalCardImage_1720000000000_abc12345.jpg
  nationalCardImage: string;
  businessLicenseImage: string;
  selfieWithIdCardImage?: string;
  storefrontImage: string;
}

type OnboardingResponse = {
  user: { id: string; phone: string; role: 'CUSTOMER' | 'ADMIN' };
  customer: StoredCustomer;
};

// پاسخ بک‌اند { user, customer } است؛ ما customer را برمی‌گردانیم.
export const submitOnboardingApi = async (
  payload: OnboardingPayload,
): Promise<StoredCustomer> => {
  const res = await httpClient.post<OnboardingResponse>('/auth/onboarding', payload);
  return res.data.customer;
};
