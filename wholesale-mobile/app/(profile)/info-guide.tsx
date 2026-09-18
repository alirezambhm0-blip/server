// app/info-guide.tsx
import React from 'react';
import { View, Text, SafeAreaView, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

const C = { primary: '#2563EB', accent: '#10B981', textPrimary: '#0F172A', textSecondary: '#64748B', border: '#E2E8F0', background: '#F8FAFC', card: '#FFFFFF' };

const STEPS = [
  { icon: 'person-add', title: 'ثبت‌نام و ورود', desc: 'شماره موبایل خود را وارد کنید و با کد تایید وارد شوید. سپس اطلاعات فروشگاه و مدارک خود را تکمیل کنید.' },
  { icon: 'shield-checkmark', title: 'احراز هویت', desc: 'پس از ارسال مدارک، تیم ما آن‌ها را بررسی می‌کند. پس از تایید، دسترسی کامل به قیمت‌ها و سفارش‌گذاری فعال می‌شود.' },
  { icon: 'grid', title: 'مرور محصولات', desc: 'محصولات را بر اساس دسته‌بندی مرور کنید. از فیلترها و جستجو برای پیدا کردن سریع محصول استفاده کنید.' },
  { icon: 'cart', title: 'سبد خرید و سفارش', desc: 'محصولات را به سبد اضافه کنید. آدرس تحویل و توضیحات سفارش را وارد کنید و سفارش ثبت کنید.' },
  { icon: 'receipt', title: 'پیگیری سفارش', desc: 'وضعیت سفارش خود را از بخش سفارش‌ها پیگیری کنید. اعلان‌های لحظه‌ای برای هر تغییر وضعیت دریافت می‌کنید.' },
  { icon: 'heart', title: 'علاقه‌مندی‌ها', desc: 'محصولات پرمصرف خود را ذخیره کنید تا سریع‌تر به آن‌ها دسترسی داشته باشید.' },
  { icon: 'chatbubbles', title: 'پشتیبانی', desc: 'از بخش تیکت‌ها سوالات و مشکلات خود را مطرح کنید. تیم پشتیبانی در اسرع وقت پاسخ می‌دهد.' },
];

export default function GuideScreen() {
  const router = useRouter();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.background }}>
      <View style={styles.appBar}>
        <TouchableOpacity onPress={() => router.back()} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="arrow-forward" size={24} color={C.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.appBarTitle}>راهنمای استفاده</Text>
        <View style={{ width: 44 }} />
      </View>
      <ScrollView style={{ flex: 1, padding: 16 }}>
        <Text style={styles.intro}>با این راهنما، نحوه استفاده از اپلیکیشن بنکو مارکت را به‌صورت گام‌به‌گام یاد بگیرید.</Text>
        {STEPS.map((step, idx) => (
          <View key={idx} style={styles.stepCard}>
            <View style={styles.stepLeft}>
              <View style={styles.stepCircle}>
                <Ionicons name={step.icon as any} size={22} color={C.primary} />
              </View>
              {idx < STEPS.length - 1 ? <View style={styles.stepLine} /> : null}
            </View>
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>{`${idx + 1}. ${step.title}`}</Text>
              <Text style={styles.stepDesc}>{step.desc}</Text>
            </View>
          </View>
        ))}
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  appBar: { height: 56, backgroundColor: '#FFF', flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  appBarTitle: { fontSize: 16, fontWeight: 'bold', color: '#0F172A' },
  intro: { fontSize: 13, color: '#64748B', textAlign: 'right', lineHeight: 20, marginBottom: 20 },
  stepCard: { flexDirection: 'row-reverse', marginBottom: 8 },
  stepLeft: { alignItems: 'center', width: 44 },
  stepCircle: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#DBEAFE', alignItems: 'center', justifyContent: 'center' },
  stepLine: { width: 2, flex: 1, backgroundColor: '#E2E8F0', marginTop: 4 },
  stepContent: { flex: 1, backgroundColor: '#FFF', borderRadius: 14, borderWidth: 1, borderColor: '#E2E8F0', padding: 14, marginBottom: 8, marginLeft: 12 },
  stepTitle: { fontSize: 14, fontWeight: 'bold', color: '#0F172A', textAlign: 'right', marginBottom: 4 },
  stepDesc: { fontSize: 13, color: '#64748B', textAlign: 'right', lineHeight: 20 },
});
