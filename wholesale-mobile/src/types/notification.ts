export type NotificationTargetType = 'ALL' | 'STATUS_BASED' | 'SPECIFIC_USERS';

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  targetType: NotificationTargetType;
  createdAt: string;
  isRead?: boolean;
}
