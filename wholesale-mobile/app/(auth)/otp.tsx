// app/(auth)/otp.tsx
import { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { notify } from "@/utils/notify";
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { loginWithOtpApi } from "@/api/authApi";
import { useAuth } from "@/context/AuthContext";

export default function OtpScreen() {
  const router = useRouter();
  const { phone, devCode } = useLocalSearchParams<{
    phone?: string | string[];
    devCode?: string | string[];
  }>();

  const { login } = useAuth();

  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  // auto-fill کد توسعه در صورتی که از لاگین ارسال شده باشد
  useEffect(() => {
    if (devCode) {
      const c = Array.isArray(devCode) ? devCode[0] : devCode;
      if (c && c.length === 6) setCode(c);
    }
  }, [devCode]);

  const handleVerify = async () => {
    const phoneStr = Array.isArray(phone) ? phone[0] : phone;

    if (!phoneStr) {
      notify("خطا", "شماره تلفن معتبری یافت نشد. مجدداً تلاش کنید.");
      return;
    }

    if (code.trim().length !== 6) {
      notify("خطا", "کد تایید باید ۶ رقمی باشد.");
      return;
    }

    try {
      setLoading(true);

      const res = await loginWithOtpApi(phoneStr, code.trim());

      // ذخیره‌ی توکن + customer در SecureStore و بروزرسانی Context
      await login(res.accessToken, res.customer);

      // ریدایرکت بر اساس onboarding
      const destination = res.customer.onboardingCompleted
        ? "/(tabs)/home"
        : "/onboarding";
      router.replace(destination);
    } catch (err: any) {
      const data = err?.data ?? err?.response?.data;
      const message =
        (Array.isArray(data?.message) ? data.message.join("\n") : data?.message) ||
        err?.message ||
        "کد تایید وارد شده نامعتبر است.";
      notify("خطا در تایید کد", message);
    } finally {
      setLoading(false);
    }
  };

  const phoneStr = Array.isArray(phone) ? phone[0] : phone;

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View style={styles.container}>
          <View style={styles.header}>
            <Ionicons name="chatbubble-ellipses-outline" size={56} color="#2563EB" />
            <Text style={styles.title}>تایید شماره موبایل</Text>
            <Text style={styles.subtitle}>
              کد ۶ رقمی ارسال‌شده به شماره {phoneStr || "—"} را وارد کنید.
            </Text>
          </View>

          <TextInput
            style={styles.input}
            placeholder="کد تایید ۶ رقمی"
            placeholderTextColor="#94A3B8"
            keyboardType="number-pad"
            maxLength={6}
            value={code}
            onChangeText={(t) => setCode(t.replace(/\D/g, ""))}
            editable={!loading}
            autoFocus={!devCode}
          />

          {loading ? (
            <ActivityIndicator size="small" color="#2563EB" style={{ marginVertical: 16 }} />
          ) : (
            <TouchableOpacity
              style={[styles.button, code.trim().length !== 6 && styles.buttonDisabled]}
              onPress={handleVerify}
              disabled={code.trim().length !== 6}
              activeOpacity={0.85}
            >
              <Text style={styles.buttonText}>تایید و ورود</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.backLink}
            onPress={() => router.back()}
            disabled={loading}
          >
            <Text style={styles.backLinkText}>بازگشت به صفحه ورود</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F8FAFC" },
  container: {
    flex: 1,
    justifyContent: "center",
    padding: 24,
  },
  header: { alignItems: "center", marginBottom: 28 },
  title: {
    fontSize: 24,
    fontWeight: "900",
    color: "#0F172A",
    marginTop: 14,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: "#64748B",
    textAlign: "center",
    lineHeight: 22,
  },
  input: {
    borderWidth: 1.5,
    borderColor: "#CBD5E1",
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    textAlign: "center",
    fontSize: 24,
    letterSpacing: 8,
    fontWeight: "700",
    color: "#0F172A",
    marginBottom: 20,
  },
  button: {
    backgroundColor: "#2563EB",
    height: 52,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonDisabled: { backgroundColor: "#CBD5E1" },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  backLink: { alignItems: "center", marginTop: 18 },
  backLinkText: { color: "#64748B", fontSize: 13, fontWeight: "600" },
});
