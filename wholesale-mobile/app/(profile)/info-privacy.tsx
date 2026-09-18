// app/info-privacy.tsx
import React from 'react';
import { View, Text, SafeAreaView, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

export default function PrivacyScreen() {
  const router = useRouter();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
      <View style={styles.appBar}>
        <TouchableOpacity onPress={() => router.back()} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="arrow-forward" size={24} color="#0F172A" />
        </TouchableOpacity>
        <Text style={styles.appBarTitle}>حریم خصوصی</Text>
        <View style={{ width: 44 }} />
      </View>
      <ScrollView style={{ flex: 1, padding: 16 }}>
        <Text style={styles.updateDate}>آخرین به‌روزرسانی: ۱۴۰۴/۰۵/۰۱</Text>

        <Section title="اطلاعاتی که جمع‌آوری می‌کنیم">
          • شماره موبایل: برای ثبت‌نام و احراز هویت{'\n'}
          • اطلاعات فروشگاه: نام، نوع کسب‌وکار، آدرس{'\n'}
          • مدارک احراز هویت: تصاویر کارت ملی، پروانه کسب{'\n'}
          • اطلاعات سفارشات: تاریخچه خرید و ترجیحات{'\n'}
          • اطلاعات دستگاه: نوع دستگاه و نسخه سیستم‌عامل (برای بهبود تجربه کاربری)
        </Section>

        <Section title="نحوه استفاده از اطلاعات">
          • احراز هویت و تایید صلاحیت کسب‌وکار{'\n'}
          • پردازش و پیگیری سفارشات{'\n'}
          • ارسال اعلان‌های مرتبط با سفارشات{'\n'}
          • بهبود خدمات و تجربه کاربری{'\n'}
          • ارتباط با پشتیبانی
        </Section>

        <Section title="اشتراک‌گذاری اطلاعات">
          اطلاعات شما با اشخاص ثالث به اشتراک گذاشته نمی‌شود، مگر در موارد زیر:{'\n'}
          • الزام قانونی{'\n'}
          • ارائه‌دهندگان خدمات لجستیک (فقط آدرس تحویل){'\n'}
          • با رضایت صریح شما
        </Section>

        <Section title="امنیت اطلاعات">
          • اطلاعات شما با رمزنگاری SSL منتقل می‌شود{'\n'}
          • رمزهای عبور به‌صورت یک‌طرفه ذخیره می‌شوند{'\n'}
          • دسترسی به اطلاعات محدود به تیم فنی مجاز است{'\n'}
          • مدارک احراز هویت فقط برای تایید هویت استفاده شده و پس از تایید محفوظ می‌ماند
        </Section>

        <Section title="حقوق شما">
          • مشاهده اطلاعات ذخیره‌شده خود{'\n'}
          • درخواست اصلاح اطلاعات نادرست{'\n'}
          • درخواست حذف حساب کاربری{'\n'}
          • لغو رضایت دریافت اعلان‌ها
        </Section>

        <Section title="کوکی‌ها و ردیابی">
          اپلیکیشن از کوکی‌ها یا ردیاب‌های تبلیغاتی استفاده نمی‌کند. اطلاعات دستگاه فقط برای عملکرد صحیح اپلیکیشن جمع‌آوری می‌شود.
        </Section>

        <Section title="تماس با ما">
          برای سوالات مربوط به حریم خصوصی:{'\n'}
          ایمیل: privacy@bonkomarket.ir{'\n'}
          تلفن: ۰۲۱-۱۲۳۴۵۶۷۸
        </Section>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.bodyText}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  appBar: { height: 56, backgroundColor: '#FFF', flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  appBarTitle: { fontSize: 16, fontWeight: 'bold', color: '#0F172A' },
  updateDate: { fontSize: 11, color: '#94A3B8', textAlign: 'right', marginBottom: 16 },
  card: { backgroundColor: '#FFF', borderRadius: 14, borderWidth: 1, borderColor: '#E2E8F0', padding: 16, marginBottom: 12 },
  sectionTitle: { fontSize: 14, fontWeight: 'bold', color: '#0F172A', textAlign: 'right', marginBottom: 8 },
  bodyText: { fontSize: 13, color: '#64748B', textAlign: 'right', lineHeight: 24 },
});
