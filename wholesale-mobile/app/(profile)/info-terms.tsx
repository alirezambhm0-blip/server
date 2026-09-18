// app/info-terms.tsx
import React from 'react';
import { View, Text, SafeAreaView, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

export default function TermsScreen() {
  const router = useRouter();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
      <View style={styles.appBar}>
        <TouchableOpacity onPress={() => router.back()} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="arrow-forward" size={24} color="#0F172A" />
        </TouchableOpacity>
        <Text style={styles.appBarTitle}>قوانین و مقررات</Text>
        <View style={{ width: 44 }} />
      </View>
      <ScrollView style={{ flex: 1, padding: 16 }}>
        <Text style={styles.updateDate}>آخرین به‌روزرسانی: ۱۴۰۴/۰۵/۰۱</Text>

        <Section title="۱. شرایط عمومی">
          استفاده از اپلیکیشن بنکو مارکت به معنای پذیرش تمامی قوانین و مقررات ذکر شده در این صفحه است. این اپلیکیشن ویژه فروشگاه‌داران و صاحبان کسب‌وکارهای خرده‌فروشی طراحی شده است.
        </Section>

        <Section title="۲. ثبت‌نام و احراز هویت">
          • ثبت‌نام با شماره موبایل معتبر انجام می‌شود.{'\n'}
          • احراز هویت شامل ارسال مدارک کسب‌وکار و بررسی توسط تیم ماست.{'\n'}
          • اطلاعات ارسالی محرمانه تلقی شده و فقط برای تایید هویت استفاده می‌شود.{'\n'}
          • در صورت رد مدارک، امکان ارسال مجدد وجود دارد.
        </Section>

        <Section title="۳. ثبت سفارش">
          • ثبت سفارش فقط برای کاربران تایید شده امکان‌پذیر است.{'\n'}
          • قیمت‌ها به‌صورت عمده و به تومان اعلام می‌شوند.{'\n'}
          • حداقل مبلغ سفارش طبق تنظیمات سیستم اعمال می‌شود.{'\n'}
          • موجودی محصولات لحظه‌ای به‌روزرسانی می‌شود.
        </Section>

        <Section title="۴. پرداخت">
          • فعلاً فقط پرداخت نقدی هنگام تحویل امکان‌پذیر است.{'\n'}
          • مبلغ فاکتور باید به‌صورت کامل هنگام دریافت کالا پرداخت شود.
        </Section>

        <Section title="۵. ارسال و تحویل">
          • ارسال سفارش‌ها به آدرس ثبت‌شده در پروفایل انجام می‌شود.{'\n'}
          • زمان ارسال پس از تایید سفارش توسط تیم ما اطلاع‌رسانی می‌شود.{'\n'}
          • مسئولیت بررسی کالا هنگام تحویل بر عهده خریدار است.
        </Section>

        <Section title="۶. لغو سفارش">
          • سفارش‌های در وضعیت «در انتظار بررسی» قابل لغو هستند.{'\n'}
          • پس از تایید سفارش، لغو فقط از طریق تماس با پشتیبانی امکان‌پذیر است.
        </Section>

        <Section title="۷. مسئولیت‌ها">
          • بنکو مارکت متعهد به ارائه محصولات با کیفیت و قیمت اعلام شده است.{'\n'}
          • خریدار مسئول صحت اطلاعات ثبت‌شده در پروفایل خود است.{'\n'}
          • هرگونه سوءاستفاده از حساب کاربری منجر به مسدود شدن حساب می‌شود.
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
