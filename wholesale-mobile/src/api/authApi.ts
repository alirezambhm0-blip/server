// src/api/authApi.ts
import { httpClient } from './httpClient';
import { StoredCustomer } from '../storage/authStorage';

// پاسخ بک‌اند در /auth/verify-otp و /auth/request-otp
export interface RequestOtpResponse {
  message: string;
  testCode?: string; // فقط در development
  cooldown?: number;
}

export interface VerifyOtpResponse {
  accessToken: string;
  user: { id: string; phone: string; role: 'CUSTOMER' | 'ADMIN' };
  customer: StoredCustomer;
}

export interface MeResponse {
  id: string;
  phone: string;
  role: 'CUSTOMER' | 'ADMIN';
  unreadNotificationCount: number;
  customer: StoredCustomer | null;
}

export const requestOtpApi = async (phone: string): Promise<RequestOtpResponse> => {
  const res = await httpClient.post<RequestOtpResponse>('/auth/request-otp', { phone });
  return res.data;
};

export const loginWithOtpApi = async (
  phone: string,
  code: string,
): Promise<VerifyOtpResponse> => {
  const res = await httpClient.post<VerifyOtpResponse>('/auth/verify-otp', {
    phone,
    code,
  });
  return res.data;
};

export const getMeApi = async (): Promise<MeResponse> => {
  const res = await httpClient.get<MeResponse>('/auth/me');
  return res.data;
};
