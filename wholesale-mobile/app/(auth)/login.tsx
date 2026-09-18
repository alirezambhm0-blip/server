import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
  KeyboardAvoidingView,
  ActivityIndicator,
} from 'react-native';
import { notify } from '@/utils/notify';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
// توجه: اگر ارور مسیر داشتی، فعلا از مسیر نسبی استفاده کن مثل: ../../src/api/auth
import { requestOtpApi } from "@/api/authApi";


export default function LoginScreen() {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isSendingCode, setIsSendingCode] = useState(false);
  const router = useRouter();

  // اعتبارسنجی Regex
  const phoneRegex = /^09[0-9]{9}$/;
  const isFormValid = phoneRegex.test(phoneNumber);

  const handlePhoneChange = (text: string) => {
    const cleaned = text.replace(/[^0-9]/g, '');
    if (cleaned.length <= 11) {
      setPhoneNumber(cleaned);
    }
  };

  const handleSendCode = async () => {
    if (!isFormValid) {
      notify('خطا', 'لطفاً یک شماره موبایل معتبر وارد کنید.');
      return;
    }

    setIsSendingCode(true);
    
    try {
      // درخواست ارسال کد OTP از بک‌اند (auth entry step واقعی)
      const res = await requestOtpApi(phoneNumber);

      // در حالت dev بک‌اند کد تست را در پاسخ می‌فرستد؛ در این حالت به‌جای
      // پیام کلی پیام، کد را در پیام نشان می‌دهیم و به otp پاس می‌دهیم تا
      // auto-fill یا راحتی توسعه فراهم شود.
      if (res.testCode) {
        notify('تایید (حالت توسعه)', `کد تایید: ${res.testCode}`);
      } else {
        notify('تایید', res.message || 'کد تایید با موفقیت ارسال شد.');
      }

      // هدایت به صفحه OTP
      router.push({
        pathname: '/(auth)/otp',
        params: {
          phone: phoneNumber,
          // در حالت dev کد را به عنوان پارامتر می‌فرستیم (فقط راحتی توسعه)
          ...(res.testCode ? { devCode: res.testCode } : {}),
        },
      });

    } catch (error: any) {
      console.error('Login Error:', error);
      notify('خطا', error.message || 'اتصال به سرور برقرار نشد.');
    } finally {
      setIsSendingCode(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.content}>
          <Text style={styles.title}>ورود به حساب کاربری</Text>
          <Text style={styles.subtitle}>
            شماره موبایل خود را برای دریافت کد تایید وارد کنید.
          </Text>

          <View style={[styles.inputContainer, isFormValid && styles.inputContainerValid]}>
            <Ionicons 
              name="call-outline" 
              size={20} 
              color={isFormValid ? "#2563EB" : "#64748B"} 
              style={styles.inputIcon} 
            />
            <TextInput
              style={styles.input}
              placeholder="۰۹xxxxxxxxx"
              placeholderTextColor="#94A3B8"
              keyboardType="numeric"
              value={phoneNumber}
              onChangeText={handlePhoneChange}
              maxLength={11}
              autoFocus={true}
              textAlign="right"
            />
          </View>

          <TouchableOpacity
            style={[styles.button, !isFormValid && styles.buttonDisabled]}
            onPress={handleSendCode}
            disabled={!isFormValid || isSendingCode}
          >
            {isSendingCode ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>ارسال کد تایید</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.helpLink}>
            <Text style={styles.helpLinkText}>
              مشکل در ورود؟ <Text style={{fontWeight: '700', color: '#2563EB'}}>تماس با پشتیبانی</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F8FAFC' },
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  content: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 28,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
  },
  title: { fontSize: 26, fontWeight: '900', color: '#1E293B', marginBottom: 8, textAlign: 'right' },
  subtitle: { fontSize: 15, color: '#64748B', marginBottom: 32, textAlign: 'right', lineHeight: 22 },
  inputContainer: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 14,
    height: 56,
    paddingHorizontal: 16,
    marginBottom: 24,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  inputContainerValid: { borderColor: '#2563EB', backgroundColor: '#EFF6FF' },
  inputIcon: { marginLeft: 12 },
  input: { flex: 1, fontSize: 18, color: '#1E293B', fontWeight: '600', letterSpacing: 2 },
  button: {
    backgroundColor: '#2563EB',
    borderRadius: 14,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    elevation: 5,
  },
  buttonDisabled: { backgroundColor: '#CBD5E1', elevation: 0 },
  buttonText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  helpLink: { alignSelf: 'center' },
  helpLinkText: { fontSize: 14, color: '#64748B', textAlign: 'center' },
});
