// app/info-faq.tsx
import React, { useState } from 'react';
import { View, Text, SafeAreaView, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

const C = { primary: '#2563EB', textPrimary: '#0F172A', textSecondary: '#64748B', border: '#E2E8F0', background: '#F8FAFC', card: '#FFFFFF' };

const FAQS = [
  { q: 'چگونه ثبت‌نام کنم؟', a: 'از صفحه ورود، شماره موبایل خود را وارد کنید. کد تایید ارسال می‌شود. پس از ورود، اطلاعات فروشگاه و مدارک خود را تکمیل کنید. پس از تایید توسط تیم ما، امکان مشاهده قیمت‌ها و ثبت سفارش فعال می‌شود.' },
  { q: 'چرا قیمت محصولات را نمی‌بینم؟', a: 'قیمت‌های عمده فقط برای کاربران تایید شده نمایش داده می‌شود. پس از تکمیل احراز هویت و تایید توسط مدیریت، قیمت‌ها فعال می‌شوند.' },
  { q: 'چگونه سفارش ثبت کنم؟', a: 'محصولات مورد نظر را به سبد خرید اضافه کنید. سپس به بخش سبد خرید بروید، آدرس تحویل را بررسی کنید و دکمه ثبت سفارش را بزنید.' },
  { q: 'روش پرداخت چیست؟', a: 'فعلاً فقط پرداخت نقدی هنگام تحویل امکان‌پذیر است. مبلغ سفارش را هنگام دریافت کالا پرداخت می‌کنید.' },
  { q: 'چگونه سفارش قبلی را تکرار کنم؟', a: 'در صفحه سبد خرید (اگر سبد خالی باشد) یا در صفحه حساب کاربری، گزینه تکرار آخرین سفارش را بزنید. اقلام قبلی به سبد اضافه می‌شوند.' },
  { q: 'چگونه سفارش را لغو کنم؟', a: 'سفارش‌هایی که هنوز در وضعیت در انتظار بررسی هستند قابل لغو هستند. از صفحه جزئیات سفارش، دکمه لغو سفارش را بزنید.' },
  { q: 'موجودی محصول تمام شده، چه کنم؟', a: 'محصولات ناموجود به‌زودی شارژ می‌شوند. می‌توانید از بخش پشتیبانی تیکت بزنید تا زمان تامین مجدد اطلاع‌رسانی شود.' },
  { q: 'آیا امکان ارسال به شهرهای دیگر وجود دارد؟', a: 'فعلاً خدمات‌رسانی فقط در استان زنجان (ابهر، خرمه‌دره، هیدج، صائین‌قلعه) فعال است. به‌زودی شهرهای بیشتری اضافه خواهند شد.' },
];

export default function FaqScreen() {
  const router = useRouter();
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.background }}>
      <View style={styles.appBar}>
        <TouchableOpacity onPress={() => router.back()} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="arrow-forward" size={24} color={C.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.appBarTitle}>سوالات متداول</Text>
        <View style={{ width: 44 }} />
      </View>
      <ScrollView style={{ flex: 1, padding: 16 }}>
        {FAQS.map((item, idx) => (
          <View key={idx} style={styles.card}>
            <TouchableOpacity style={styles.qRow} onPress={() => setOpenIdx(openIdx === idx ? null : idx)} activeOpacity={0.7}>
              <Text style={styles.qText}>{item.q}</Text>
              <Ionicons name={openIdx === idx ? 'chevron-up' : 'chevron-down'} size={20} color={C.textSecondary} />
            </TouchableOpacity>
            {openIdx === idx ? <Text style={styles.aText}>{item.a}</Text> : null}
          </View>
        ))}
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  appBar: { height: 56, backgroundColor: C.card, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: C.border },
  appBarTitle: { fontSize: 16, fontWeight: 'bold', color: C.textPrimary },
  card: { backgroundColor: C.card, borderRadius: 14, borderWidth: 1, borderColor: C.border, marginBottom: 10, overflow: 'hidden' },
  qRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', padding: 14 },
  qText: { fontSize: 14, fontWeight: '600', color: C.textPrimary, flex: 1, textAlign: 'right', marginRight: 8 },
  aText: { fontSize: 13, color: C.textSecondary, lineHeight: 22, textAlign: 'right', paddingHorizontal: 14, paddingBottom: 14 },
});
