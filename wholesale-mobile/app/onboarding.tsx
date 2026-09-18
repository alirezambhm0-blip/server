// app/onboarding.tsx
// فرم چندمرحله‌ای احراز هویت (KYC) که پس از تایید OTP نمایش داده می‌شود.
// تا تکمیل این فرم، پروفایل در وضعیت pending_manual_approval باقی می‌ماند.
import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Platform,
  TouchableOpacity,
  Modal,
  FlatList,
} from "react-native";
import { notify } from "@/utils/notify";

import { useRouter } from "expo-router";

import { useAuth } from "@/context/AuthContext";
import {
  submitOnboardingApi,
  OnboardingPayload,
} from "@/api/onboardingApi";
import { StoredCustomer } from "@/storage/authStorage";
import ImageUploadField from "@/components/onboarding/ImageUploadField";

const TOTAL_STEPS = 4;

// پیشنهادهای رایج صنف/نوع کسب‌وکار
const BUSINESS_TYPES = [
  "سوپرمارکت",
  "لوازم‌سازی / ابزار",
  "پوشاک",
  "رستوران / کافه",
  "لوازم خانگی",
  "نوشت‌افزار",
  "سایر",
];

type FormState = {
  firstName: string;
  lastName: string;
  nationalCode: string;
  businessName: string;
  businessType: string;
  landlinePhone: string;
  province: string;
  city: string;
  exactAddress: string;
  postalCode: string;
  locationCoordinates?: { lat: number; lng: number };
  nationalCardImage: string;
  businessLicenseImage: string;
  selfieWithIdCardImage?: string;
  storefrontImage: string;
};

const emptyForm: FormState = {
  firstName: "",
  lastName: "",
  nationalCode: "",
  businessName: "",
  businessType: "",
  landlinePhone: "",
  province: "",
  city: "",
  exactAddress: "",
  postalCode: "",
  nationalCardImage: "",
  businessLicenseImage: "",
  storefrontImage: "",
};

// ثابت بودن استان و محدودیت شهرها:
export const ALLOWED_PROVINCE = "زنجان" as const;

export const ALLOWED_CITIES = [
  "ابهر",
  "خرمدره",
  "هیدج",
  "صائین‌قلعه",
] as const;

export type AllowedCity = typeof ALLOWED_CITIES[number];

export default function OnboardingScreen() {
  const router = useRouter();
  const { customer, completeOnboarding } = useAuth();

  const [step, setStep] = useState(1);

  const [form, setForm] = useState<FormState>({
    ...emptyForm,
    province: ALLOWED_PROVINCE,
    city: "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  // شماره موبایل از پروفایل تاییدشده (OTP) — از قبل پر و قفل شده.
  const phone = customer?.phone ?? "";

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const validateStep = (s: number): Record<string, string> => {
    const errs: Record<string, string> = {};
    if (s === 1) {
      if (form.firstName.trim().length < 2) errs.firstName = "نام را کامل وارد کنید";
      if (form.lastName.trim().length < 2) errs.lastName = "نام خانوادگی را کامل وارد کنید";
      if (!/^\d{10}$/.test(form.nationalCode)) errs.nationalCode = "کد ملی باید ۱۰ رقم باشد";
    } else if (s === 2) {
      if (form.businessName.trim().length < 2) errs.businessName = "نام فروشگاه/عنوان تجاری الزامی است";
      if (!form.businessType.trim()) errs.businessType = "نوع کسب‌وکار را انتخاب کنید";
      
      if (form.landlinePhone.trim() && !/^\d{8,15}$/.test(form.landlinePhone.trim())) {
        errs.landlinePhone = "شماره تلفن ثابت باید بین ۸ تا ۱۵ رقم باشد";
      }
    } else if (s === 3) {
      if (!form.province.trim()) errs.province = "استان الزامی است";
      if (!form.city.trim()) errs.city = "شهر الزامی است";
      if (form.exactAddress.trim().length < 10) errs.exactAddress = "آدرس دقیق را کامل وارد کنید (حداقل ۱۰ نویسه)";
      if (!/^\d{10}$/.test(form.postalCode)) errs.postalCode = "کد پستی باید ۱۰ رقم باشد";
    } else if (s === 4) {
      if (!form.nationalCardImage) errs.nationalCardImage = "تصویر کارت ملی الزامی است";
      else if (form.nationalCardImage.startsWith("data:")) errs.nationalCardImage = "لطفاً تا پایان آپلود کارت ملی صبر کنید";
      
      if (!form.businessLicenseImage) errs.businessLicenseImage = "تصویر پروانه کسب/اجاره‌نامه الزامی است";
      else if (form.businessLicenseImage.startsWith("data:")) errs.businessLicenseImage = "لطفاً تا پایان آپلود پروانه کسب صبر کنید";
      
      if (!form.storefrontImage) errs.storefrontImage = "تصویر نما/داخل فروشگاه الزامی است";
      else if (form.storefrontImage.startsWith("data:")) errs.storefrontImage = "لطفاً تا پایان آپلود تصویر فروشگاه صبر کنید";
      
      if (form.selfieWithIdCardImage && form.selfieWithIdCardImage.startsWith("data:")) errs.selfieWithIdCardImage = "لطفاً تا پایان آپلود سلفی صبر کنید";
    }
    return errs;
  };

  const goNext = () => {
    const e = validateStep(step);
    if (Object.keys(e).length > 0) {
      setErrors(e);
      return;
    }
    setErrors({});
    setStep((s) => Math.min(TOTAL_STEPS, s + 1));
  };

  const goBack = () => {
    setErrors({});
    setStep((s) => Math.max(1, s - 1));
  };

  const detectLocation = () => {
    if (Platform.OS === "web") {
      const geo = (navigator as any).geolocation;
      if (!geo) {
        notify("خطا", "دسترسی به موقعیت مکانی روی این مرورگر ممکن نیست");
        return;
      }
      geo.getCurrentPosition(
        (pos: any) =>
          set("locationCoordinates", {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          }),
        () => notify("خطا", "دریافت موقعیت مکانی ناموفق بود"),
        { enableHighAccuracy: false, timeout: 10000 },
      );
    } else {
      notify(
        "موقعیت مکانی",
        "دریافت GPS روی دستگاه نیازمند نصب expo-location است.",
      );
    }
  };

  const handleSubmit = async () => {
    const e = validateStep(4);
    if (Object.keys(e).length > 0) {
      setErrors(e);
      return;
    }
    const trimmedLandline = form.landlinePhone ? form.landlinePhone.trim() : "";;

    const payload: OnboardingPayload = {
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      nationalCode: form.nationalCode.trim(),
      businessName: form.businessName.trim(),
      businessType: form.businessType.trim(),
      landlinePhone: form.landlinePhone.trim(),
      ...(trimmedLandline ? { landlinePhone: trimmedLandline } : {}),

      province: form.province.trim(),
      city: form.city.trim(),
      exactAddress: form.exactAddress.trim(),
      postalCode: form.postalCode.trim(),
      ...(form.locationCoordinates
        ? { locationCoordinates: form.locationCoordinates }
        : {}),
      nationalCardImage: form.nationalCardImage,
      businessLicenseImage: form.businessLicenseImage,
      ...(form.selfieWithIdCardImage
        ? { selfieWithIdCardImage: form.selfieWithIdCardImage }
        : {}),
      storefrontImage: form.storefrontImage,
    };

    try {
    setSubmitting(true);
    const updated = await submitOnboardingApi(payload);
    await completeOnboarding(updated as StoredCustomer);
    router.replace("/(tabs)/home");
  } catch (err: any) {
    const data = err?.data ?? err?.response?.data;
    const message =
      (Array.isArray(data?.message) ? data.message.join("\n") : data?.message) ||
      err?.message ||
      "ارسال اطلاعات ناموفق بود";
    notify("خطا در ثبت اطلاعات", message);
  } finally {
    setSubmitting(false);
  }
};

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      {/* سرآیند + شماره موبایل قفل‌شده */}
      <Text style={styles.title}>تکمیل اطلاعات احراز هویت</Text>
      <Text style={styles.subtitle}>
        برای دسترسی به قیمت‌های عمده، اطلاعات زیر را تکمیل کنید. پس از ثبت،
        پروفایل شما در انتظار تایید دستی مدیر قرار می‌گیرد.
      </Text>

      <View style={styles.phoneRow}>
        <Text style={styles.phoneLabel}>شماره موبایل (تاییدشده):</Text>
        <Text style={styles.phoneValue}>{phone || "—"}</Text>
      </View>

      {/* نوار پیشرفت */}
      <View style={styles.progress}>
        {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
          <View
            key={i}
            style={[styles.dot, i + 1 <= step ? styles.dotActive : null]}
          />
        ))}
      </View>
      <Text style={styles.stepLabel}>
        مرحله {step} از {TOTAL_STEPS}
      </Text>

      {/* مرحله ۱: اطلاعات فردی و هویتی */}
      {step === 1 && (
        <View style={styles.step}>
          <Field label="نام" required error={errors.firstName}>
            <TextInput
              style={styles.input}
              value={form.firstName}
              onChangeText={(v) => set("firstName", v)}
              placeholder="مطابق کارت شناسایی"
            />
          </Field>
          <Field label="نام خانوادگی" required error={errors.lastName}>
            <TextInput
              style={styles.input}
              value={form.lastName}
              onChangeText={(v) => set("lastName", v)}
              placeholder="مطابق کارت شناسایی"
            />
          </Field>
          <Field
            label="کد ملی"
            required
            helper="۱۰ رقم — برای تطبیق مالکیت خط از طریق سامانه شاهکار"
            error={errors.nationalCode}
          >
            <TextInput
              style={styles.input}
              value={form.nationalCode}
              onChangeText={(v) => set("nationalCode", v.replace(/\D/g, ""))}
              placeholder="۰۰۰۰۰۰۰۰۰۰"
              keyboardType="number-pad"
              maxLength={10}
            />
          </Field>
        </View>
      )}

      {/* مرحله ۲: کسب‌وکار و صنف */}
      {step === 2 && (
        <View style={styles.step}>
          <Field label="نام فروشگاه / عنوان تجاری" required error={errors.businessName}>
            <TextInput
              style={styles.input}
              value={form.businessName}
              onChangeText={(v) => set("businessName", v)}
              placeholder="مثلاً سوپرمارکت رضا"
            />
          </Field>

          <Field label="نوع کسب‌وکار / صنف" required error={errors.businessType}>
            <View style={styles.chips}>
              {BUSINESS_TYPES.map((bt) => {
                const active = form.businessType === bt;
                return (
                  <Pressable
                    key={bt}
                    onPress={() => set("businessType", bt)}
                    style={[styles.chip, active ? styles.chipActive : null]}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        active ? styles.chipTextActive : null,
                      ]}
                    >
                      {bt}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <TextInput
              style={[styles.input, { marginTop: 8 }]}
              value={form.businessType}
              onChangeText={(v) => set("businessType", v)}
              placeholder="یا نوع کسب‌وکار را تایپ کنید"
            />
          </Field>

          <Field 
            label="تلفن ثابت" 
            helper="اختیاری — برای راستی‌آزمایی مکان کسب‌وکار" 
            error={errors.landlinePhone}
          >
            <TextInput
              style={styles.input}
              value={form.landlinePhone}
              onChangeText={(v) => set("landlinePhone", v.replace(/\D/g, ""))}
              placeholder="مثلاً ۰۲۱۱۲۳۴۵۶۷۸"
              placeholderTextColor="#94A3B8"
              keyboardType="number-pad"
              maxLength={15}
            />
          </Field>
        </View>
      )}

      {/* مرحله ۳: آدرس و موقعیت */}
      {step === 3 && (
        <View style={styles.step}>
          <View style={styles.row}>
            {/* Dropdown استان (قفل شده) */}
            <Field label="استان" required style={styles.col}>
              <DropdownSelect
                value={ALLOWED_PROVINCE}
                options={[ALLOWED_PROVINCE]}
                onSelect={() => {}}
                disabled={true}
              />
            </Field>

            {/* Dropdown شهر (انتخابی) */}
            <Field label="شهر" required error={errors.city} style={styles.col}>
              <DropdownSelect
                value={form.city}
                options={ALLOWED_CITIES}
                onSelect={(selectedCity) => set("city", selectedCity)}
                placeholder="انتخاب شهر"
                hasError={!!errors.city}
              />
            </Field>
          </View>

          <Field label="آدرس دقیق" required helper="آدرس کامل تحویل سفارش‌های عمده" error={errors.exactAddress}>
            <TextInput
              style={[styles.input, { minHeight: 80, textAlignVertical: "top" }]}
              value={form.exactAddress}
              onChangeText={(v) => set("exactAddress", v)}
              placeholder="خیابان، کوچه، پلاک، واحد ..."
              multiline
              numberOfLines={3}
            />
          </Field>

          <Field label="کد پستی" required error={errors.postalCode}>
            <TextInput
              style={styles.input}
              value={form.postalCode}
              onChangeText={(v) => set("postalCode", v.replace(/\D/g, ""))}
              placeholder="۱۰ رقم"
              keyboardType="number-pad"
              maxLength={10}
            />
          </Field>

          <Field
            label="موقعیت مکانی (GPS)"
            helper="اختیاری — برای بهینه‌سازی مسیر تحویل"
          >
            <Pressable style={styles.locBtn} onPress={detectLocation}>
              <Text style={styles.locBtnText}>
                {form.locationCoordinates
                  ? `موقعیت ثبت شد: ${form.locationCoordinates.lat.toFixed(
                      5,
                    )}, ${form.locationCoordinates.lng.toFixed(5)}`
                  : "دریافت موقعیت فعلی"}
              </Text>
            </Pressable>
          </Field>
        </View>
      )}

      {/* مرحله ۴: مدارک و پیوست‌ها */}
      {step === 4 && (
        <View style={styles.step}>
          <ImageUploadField
            label="تصویر کارت ملی مالک"
            required
            docType="nationalCardImage"
            value={form.nationalCardImage}
            onChange={(v) => set("nationalCardImage", v ?? "")}
            error={errors.nationalCardImage}
          />
          <ImageUploadField
            label="پروانه کسب / اجاره‌نامه / سند مکان"
            required
            helper="تایید صلاحیت عمده‌فروشی و جلوگیری از دسترسی خرده‌فروشان به قیمت عمده"
            docType="businessLicenseImage"
            value={form.businessLicenseImage}
            onChange={(v) => set("businessLicenseImage", v ?? "")}
            error={errors.businessLicenseImage}
          />
          <ImageUploadField
            label="سلفی با کارت ملی"
            helper="اختیاری"
            docType="selfieWithIdCardImage"
            value={form.selfieWithIdCardImage}
            onChange={(v) => set("selfieWithIdCardImage", v ?? undefined)}
            error={errors.selfieWithIdCardImage}
          />
          <ImageUploadField
            label="تصویر نما / داخل فروشگاه"
            required
            helper="نشان‌دهنده فعالیت تجاری"
            docType="storefrontImage"
            value={form.storefrontImage}
            onChange={(v) => set("storefrontImage", v ?? "")}
            error={errors.storefrontImage}
          />
        </View>
      )}

      {/* ناوبری مراحل */}
      <View style={styles.nav}>
        {step > 1 ? (
          <Pressable style={[styles.btn, styles.btnGhost]} onPress={goBack}>
            <Text style={styles.btnGhostText}>قبلی</Text>
          </Pressable>
        ) : (
          <View />
        )}

        {step < TOTAL_STEPS ? (
          <Pressable style={styles.btn} onPress={goNext}>
            <Text style={styles.btnText}>بعدی</Text>
          </Pressable>
        ) : (
          <Pressable
            style={[styles.btn, submitting ? styles.btnDisabled : null]}
            onPress={handleSubmit}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.btnText}>ثبت و ارسال برای تایید</Text>
            )}
          </Pressable>
        )}
      </View>
    </ScrollView>
  );
}

// ---------- کامپوننت اختصاصی Dropdown ----------
function DropdownSelect({
  value,
  options,
  onSelect,
  placeholder = "انتخاب کنید",
  disabled = false,
  hasError = false,
}: {
  value: string;
  options: readonly string[];
  onSelect: (val: string) => void;
  placeholder?: string;
  disabled?: boolean;
  hasError?: boolean;
}) {
  const [modalVisible, setModalVisible] = useState(false);

  return (
    <View style={styles.dropdownContainer}>
      <TouchableOpacity
        style={[
          styles.dropdownTrigger,
          disabled ? styles.disabledInput : null,
          hasError ? styles.dropdownError : null,
        ]}
        onPress={() => !disabled && setModalVisible(true)}
        activeOpacity={disabled ? 1 : 0.7}
      >
        <Text
          style={[
            styles.dropdownValueText,
            !value && styles.placeholderText,
            disabled && styles.disabledText,
          ]}
        >
          {value || placeholder}
        </Text>
        <Text style={styles.dropdownArrow}>{disabled ? "🔒" : "▾"}</Text>
      </TouchableOpacity>

      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setModalVisible(false)}
        >
          <View style={styles.modalContent}>
            <FlatList
              data={options as unknown as string[]}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.optionItem,
                    item === value && styles.optionItemSelected,
                  ]}
                  onPress={() => {
                    onSelect(item);
                    setModalVisible(false);
                  }}
                >
                  <Text
                    style={[
                      styles.optionText,
                      item === value && styles.optionTextSelected,
                    ]}
                  >
                    {item}
                  </Text>
                  {item === value && <Text style={styles.checkIcon}>✓</Text>}
                </TouchableOpacity>
              )}
            />
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

// ---------- زیرکامپوننت فیلد ----------
function Field({
  label,
  required,
  helper,
  error,
  children,
  style,
}: {
  label: string;
  required?: boolean;
  helper?: string;
  error?: string;
  children: React.ReactNode;
  style?: any;
}) {
  return (
    <View style={[styles.field, style]}>
      <Text style={styles.label}>
        {label}
        {required ? <Text style={styles.required}> *</Text> : null}
      </Text>
      {helper ? <Text style={styles.helper}>{helper}</Text> : null}
      {children}
      {error ? (
        <Text style={{ color: "#B91C1C", fontSize: 12, marginTop: 4, textAlign: "right" }}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  content: { padding: 20, paddingBottom: 60, maxWidth: 640, width: "100%", alignSelf: "center" },
  title: { fontSize: 22, fontWeight: "800", color: "#0F172A", textAlign: "right" },
  subtitle: {
    fontSize: 13,
    color: "#64748B",
    textAlign: "right",
    marginTop: 6,
    lineHeight: 20,
    marginBottom: 16,
  },
  disabledInput: {
    backgroundColor: "#F1F5F9",
    borderColor: "#E2E8F0",
  },
  disabledText: {
    color: "#64748B",
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 14,
    color: "#0F172A",
    textAlign: "right",
    backgroundColor: "#fff",
  },
  // Dropdown Styles
  dropdownContainer: {
    width: "100%",
  },
  dropdownTrigger: {
    height: 48,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 8,
    paddingHorizontal: 12,
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
  },
  dropdownError: {
    borderColor: "#EF4444",
  },
  dropdownValueText: {
    fontSize: 14,
    color: "#0F172A",
    textAlign: "right",
  },
  placeholderText: {
    color: "#94A3B8",
  },
  dropdownArrow: {
    fontSize: 14,
    color: "#64748B",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalContent: {
    width: "100%",
    maxHeight: 280,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 12,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  optionItem: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "center",
  },
  optionItemSelected: {
    backgroundColor: "#EFF6FF",
    borderRadius: 6,
  },
  optionText: {
    fontSize: 14,
    color: "#334155",
    textAlign: "right",
  },
  optionTextSelected: {
    color: "#2563EB",
    fontWeight: "700",
  },
  checkIcon: {
    color: "#2563EB",
    fontWeight: "bold",
  },
  phoneRow: {
    flexDirection: "row-reverse",
    justifyContent: "flex-start",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
    backgroundColor: "#F1F5F9",
    padding: 12,
    borderRadius: 10,
    marginTop: 14,
  },
  phoneLabel: { fontSize: 13, color: "#475569", textAlign: "right", writingDirection: "rtl" },
  phoneValue: { fontSize: 14, fontWeight: "700", color: "#0F172A", textAlign: "right", writingDirection: "rtl" },
  progress: { flexDirection: "row", gap: 6, marginTop: 18 },
  dot: { flex: 1, height: 4, borderRadius: 2, backgroundColor: "#E2E8F0" },
  dotActive: { backgroundColor: "#2563EB" },
  stepLabel: { fontSize: 12, color: "#94A3B8", marginTop: 6, textAlign: "right" },
  step: { marginTop: 16 },
  field: { marginBottom: 14 },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1F2937",
    textAlign: "right",
    marginBottom: 6,
  },
  required: { color: "#EF4444" },
  helper: {
    fontSize: 11,
    color: "#94A3B8",
    textAlign: "right",
    marginTop: -2,
    marginBottom: 8,
  },
  row: { flexDirection: "row", gap: 10 },
  col: { flex: 1 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: "#fff",
  },
  chipActive: { borderColor: "#2563EB", backgroundColor: "#EFF6FF" },
  chipText: { fontSize: 12, color: "#475569" },
  chipTextActive: { color: "#2563EB", fontWeight: "700" },
  locBtn: {
    borderWidth: 1,
    borderColor: "#2563EB",
    borderRadius: 10,
    padding: 12,
    alignItems: "center",
    backgroundColor: "#EFF6FF",
  },
  locBtnText: { color: "#2563EB", fontSize: 13, fontWeight: "600" },
  nav: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 24,
  },
  btn: {
    backgroundColor: "#2563EB",
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    minWidth: 140,
    alignItems: "center",
  },
  btnDisabled: { opacity: 0.6 },
  btnGhost: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "#CBD5E1",
  },
  btnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  btnGhostText: { color: "#475569", fontSize: 15, fontWeight: "600" },
});
