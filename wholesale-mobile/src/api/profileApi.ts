// src/api/profileApi.ts
import { httpClient } from './httpClient';

export interface UserProfile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  phone_number: string;
  phone_number_masked: string;
  email: string | null;
  profile_image_url: string | null;
  store: {
    name: string | null;
    type: string | null;
    business_license_number: string | null;
    economic_code: string | null;
    default_address: string | null;
  };
  verification: {
    status: 'guest' | 'pending' | 'verified' | 'rejected';
    status_label_fa: string;
    verified_at: string | null;
    verified_at_shamsi: string | null;
    rejection_reason: string | null;
    can_reapply: boolean;
  };
  stats: {
    total_orders: number;
    total_favorites: number;
    member_since: string;
    member_since_shamsi: string;
  };
  unread_notifications_count: number;
  open_tickets_count: number;
}

export const profileApi = {
    getProfile: () => httpClient.get<UserProfile>('/user/profile').then(r => r.data),
    updateProfile: (data: { firstName?: string; lastName?: string; email?: string; storeName?: string; businessType?: string }) =>
        httpClient.patch('/user/profile', data).then(r => r.data),
    updateAddress: (address: string) =>
        httpClient.patch('/user/address', { default_address: address }).then(r => r.data),
};
