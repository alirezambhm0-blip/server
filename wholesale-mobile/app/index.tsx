import { Redirect } from "expo-router";
import { useAuth } from "@/context/AuthContext";

export default function Index() {
  const { authStatus, needsOnboarding, customer } = useAuth();
  
  // بررسی وضعیت رد شدن مدارک
  const isRejectedCustomer = customer?.status === "REJECTED";

  // اگر در حال بارگذاری وضعیت هستیم، فعلاً چیزی نشان نده
  if (authStatus === "loading") {
    return null;
  }

  // اگر کاربر لاگین کرده ولی نیاز به احراز هویت دارد یا مدارکش رد شده
  if (authStatus === "authenticated" && (needsOnboarding || isRejectedCustomer)) {
    return <Redirect href="/onboarding" />;
  }

  // اگر کاربر لاگین کرده (تایید شده) یا به عنوان مهمان وارد شده
  if (authStatus === "authenticated" || authStatus === "guest") {
    return <Redirect href="/(tabs)/home" />;
  }

  // در غیر این صورت (کاربر جدید) به صفحه خوش‌آمدگویی برو
  return <Redirect href="/welcome" />;
}