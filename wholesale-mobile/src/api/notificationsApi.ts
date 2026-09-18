import { httpClient } from './httpClient';
import { AppNotification } from '@/types/notification';
import { Platform } from 'react-native';

export const notificationsApi = {
  getMyNotifications: (page = 1, pageSize = 20) => 
    httpClient.get<any>('/notifications', { params: { page, pageSize } }).then((r) => r.data),
    
  markAsRead: (id: string) => 
    httpClient.post(`/notifications/${id}/read`).then((r) => r.data),

  markReadAll: (category?: string) =>
    httpClient.post('/notifications/read-all', { category }).then((r) => r.data),

  registerPushToken: (token: string) => 
    httpClient.post('/notifications/push-token', { 
      token, 
      platform: Platform.OS 
    }).then((r) => r.data),

  removePushToken: () => 
    httpClient.delete('/notifications/push-token').then((r) => r.data),
};
