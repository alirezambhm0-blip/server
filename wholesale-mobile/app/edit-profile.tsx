import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from "react-native";
import { notify } from "@/utils/notify";
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import { httpClient } from "@/api/httpClient";


export default function EditProfileScreen() {
  const router = useRouter();
  const { customer, refreshAuth, login } = useAuth(); // We might need a refresh function in AuthContext
  
  const [loading, setLoading] = useState(false);
  const [pendingChanges, setPendingChanges] = useState<any[]>([]);

  // Local state for non-sensitive fields
  const [firstName, setFirstName] = useState(customer?.firstName || "");
  const [lastName, setLastName] = useState(customer?.lastName || "");
  const [landline, setLandline] = useState(customer?.landline || "");
  const [address, setAddress] = useState(customer?.address || "");

  // Local state for sensitive fields
  const [storeName, setStoreName] = useState(customer?.storeName || "");
  const [nationalCode, setNationalCode] = useState(customer?.nationalCode || "");

  useEffect(() => {
   const fetchPending = async () => {
      try {
        // تغییر از axios به httpClient
        const response = await httpClient.get("/auth/profile/pending-changes");
        setPendingChanges(response.data);
      } catch (e) {
        console.warn("Failed to fetch pending changes", e);
      }
    };
    fetchPending();
  }, []);

  const isPending = (field: string) => pendingChanges.some(p => p.field === field);


    const handleUpdateProfile = async () => {
    setLoading(true);
    try {
      // به‌روزرسانی فیلدهای عادی
      await httpClient.patch("/auth/profile", {
        firstName,
        lastName,
        landline,
        address,
      });
      
      // بررسی و ارسال درخواست فیلدهای حساس
      if (storeName !== customer?.storeName) {
        await httpClient.post("/auth/profile/sensitive-change", {
          field: "storeName",
          newValue: storeName,
        });
      }
      
      if (nationalCode !== customer?.nationalCode) {
        await httpClient.post("/auth/profile/sensitive-change", {
          field: "nationalCode",
          newValue: nationalCode,
        });
      }

      // ۲. بسیار مهم: دریافت اطلاعات جدید از سرور و به‌روزرسانی حافظه اپلیکیشن
      await refreshAuth();

      // ۳. نمایش پیام موفقیت متناسب با پلتفرم
      if (Platform.OS === 'web') {
        window.alert("تغییرات با موفقیت ثبت شد. فیلدهای حساس پس از تایید مدیریت اعمال می‌شوند.");
        router.back();
      } else {
        notify(
          "موفقیت", 
          "تغییرات با موفقیت ثبت شد. فیلدهای حساس پس از تایید مدیریت اعمال می‌شوند.",
          [{ text: "باشه", onPress: () => router.back() }]
        );
      }
    } catch (e: any) {
      console.error("Profile update error:", e);
      const errorMsg = e.response?.data?.message || "مشکلی در ثبت تغییرات به وجود آمد.";
      notify("خطا", Array.isArray(errorMsg) ? errorMsg[0] : errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-forward" size={24} color="#1E293B" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>ویرایش پروفایل</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>اطلاعات فردی</Text>
          <InputField label="نام" value={firstName} onChangeText={setFirstName} />
          <InputField label="نام خانوادگی" value={lastName} onChangeText={setLastName} />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>اطلاعات تماس و آدرس</Text>
          <InputField label="تلفن ثابت" value={landline} onChangeText={setLandline} keyboardType="phone-pad" />
          <InputField label="آدرس فروشگاه" value={address} onChangeText={setAddress} multiline />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>اطلاعات حساس (نیاز به تایید ادمین)</Text>
          <InputField 
            label="نام فروشگاه" 
            value={storeName} 
            onChangeText={setStoreName} 
            isPending={isPending("storeName")} 
          />
          <InputField 
            label="کد ملی" 
            value={nationalCode} 
            onChangeText={setNationalCode} 
            isPending={isPending("nationalCode")}
            keyboardType="numeric"
          />
        </View>

        <TouchableOpacity 
          style={styles.saveBtn} 
          onPress={handleUpdateProfile}
          disabled={loading}
        >
          {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.saveBtnText}>ذخیره تغییرات</Text>}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const InputField = ({ label, value, onChangeText, isPending, ...props }: any) => (
  <View style={styles.inputContainer}>
    <View style={styles.labelRow}>
      <Text style={styles.label}>{label}</Text>
      {isPending && (
        <View style={styles.pendingBadge}>
          <Text style={styles.pendingText}>در انتظار تایید</Text>
        </View>
      )}
    </View>
    <TextInput
      style={[styles.input, isPending && styles.inputDisabled]}
      value={value}
      onChangeText={onChangeText}
      textAlign="right"
      {...props}
    />
  </View>
);

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F8FAFC" },
  header: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    backgroundColor: "#FFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  headerTitle: { fontSize: 18, fontWeight: "800", color: "#1E293B" },
  content: { padding: 16 },
  section: { marginBottom: 24 },
  sectionLabel: { fontSize: 14, fontWeight: "700", color: "#64748B", marginBottom: 12, textAlign: "right" },
  inputContainer: { marginBottom: 16 },
  labelRow: { flexDirection: "row-reverse", justifyContent: "space-between", marginBottom: 8 },
  label: { fontSize: 13, color: "#475569" },
  pendingBadge: { backgroundColor: "#FEF3C7", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  pendingText: { fontSize: 11, color: "#92400E", fontWeight: "600" },
  input: {
    backgroundColor: "#FFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    padding: 12,
    fontSize: 15,
    color: "#1E293B",
  },
  inputDisabled: {
    backgroundColor: "#F1F5F9",
  },
  saveBtn: {
    backgroundColor: "#2563EB",
    padding: 16,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 8,
  },
  saveBtnText: { color: "#FFF", fontSize: 16, fontWeight: "700" },
});
