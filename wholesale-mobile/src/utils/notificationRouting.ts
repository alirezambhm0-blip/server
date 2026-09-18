import { useRouter } from 'expo-router';

// This function processes the incoming push notification data payload
// and routes the app to the appropriate screen securely.
export function handleNotificationRoute(data: any, router: ReturnType<typeof useRouter>) {
  if (!data || !data.route) {
    console.log('[NotificationRouter] No specific route found in push payload. Staying on current screen.');
    return;
  }

  const destination = data.route as string;
  console.log(`[NotificationRouter] Navigating to deep link route: ${destination}`);
  
  try {
    // Navigate safely to the parsed route
    router.push(destination as any);
  } catch (error) {
    console.error(`[NotificationRouter] Navigation failed for route: ${destination}`, error);
    router.push('/(tabs)/home'); // fallback to safe default
  }
}
