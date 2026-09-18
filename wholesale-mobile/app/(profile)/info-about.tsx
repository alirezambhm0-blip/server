// app/info-about.tsx
import React from 'react';
import { View, Text, SafeAreaView, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

export default function AboutScreen() {
  const router = useRouter();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
      <View style={styles.appBar}>
        <TouchableOpacity onPress={() => router.back()} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="arrow-forward" size={24} color="#0F172A" />
        </TouchableOpacity>
        <Text style={styles.appBarTitle}>درباره ما</Text>
        <View style={{ width: 44 }} />
      </View>
      <ScrollView style={{ flex: 1, padding: 16 }}>
        <View style={styles.logoWrap}>
          <Ionicons name="storefront" size={48} color="#2563EB" />
          <Text style={styles.brand}>بنکو مارکت</Text>
          <Text style={styles.tagline}>توزیع عمده محصولات غذایی و بهداشتی</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>درباره ما</Text>
          <Text style={styles.bodyText}>
            بنکو مارکت یک پلتفرم توزیع عمده محصولات غذایی، بهداشتی و مصرفی ویژه فروشگاه‌داران و مغازه‌داران است. هدف ما تسهیل فرآیند خرید عمده برای صاحبان کسب‌وکارهای خرده‌فروشی است.
          </Text>
          <Text style={styles.bodyText}>
            با استفاده از بنکو مارکت، می‌توانید محصولات مورد نیاز فروشگاه خود را به‌صورت آنلاین سفارش دهید و درب فروشگاه تحویل بگیرید.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>مزایای استفاده</Text>
          <Feature icon="pricetag" text="قیمت‌های عمده رقابتی" />
          <Feature icon="car" text="ارسال سریع به درب فروشگاه" />
          <Feature icon="cart" text="سفارش‌گذاری آسان از موبایل" />
          <Feature icon="receipt" text="پیگیری لحظه‌ای سفارشات" />
          <Feature icon="chatbubbles" text="پشتیبانی اختصاصی" />
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>منطقه خدمات‌رسانی</Text>
          <Text style={styles.bodyText}>
            فعلاً خدمات‌رسانی در استان زنجان (شهرهای ابهر، خرمه‌دره، هیدج، صائین‌قلعه) فعال است. به‌زودی شهرهای بیشتری اضافه خواهند شد.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>تماس با ما</Text>
          <InfoRow icon="call" label="تلفن" value="۰۲۱-۱۲۳۴۵۶۷۸" />
          <InfoRow icon="mail" label="ایمیل" value="info@bonkomarket.ir" />
          <InfoRow icon="globe" label="وبسایت" value="www.bonkomarket.ir" />
        </View>

        <Text style={styles.version}>نسخه ۱.۰.۰</Text>
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function Feature({ icon, text }: { icon: string; text: string }) {
  return (
    <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 10, marginBottom: 10 }}>
      <Ionicons name={icon as any} size={18} color="#2563EB" />
      <Text style={{ fontSize: 13, color: '#0F172A', textAlign: 'right' }}>{text}</Text>
    </View>
  );
}

function InfoRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 10, marginBottom: 10 }}>
      <Ionicons name={icon as any} size={18} color="#64748B" />
      <Text style={{ fontSize: 12, color: '#64748B' }}>{label}:</Text>
      <Text style={{ fontSize: 13, fontWeight: '500', color: '#0F172A' }}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  appBar: { height: 56, backgroundColor: '#FFF', flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  appBarTitle: { fontSize: 16, fontWeight: 'bold', color: '#0F172A' },
  logoWrap: { alignItems: 'center', paddingVertical: 24 },
  brand: { fontSize: 22, fontWeight: 'bold', color: '#0F172A', marginTop: 12 },
  tagline: { fontSize: 13, color: '#64748B', marginTop: 4 },
  card: { backgroundColor: '#FFF', borderRadius: 14, borderWidth: 1, borderColor: '#E2E8F0', padding: 16, marginBottom: 12 },
  sectionTitle: { fontSize: 15, fontWeight: 'bold', color: '#0F172A', textAlign: 'right', marginBottom: 12 },
  bodyText: { fontSize: 13, color: '#64748B', textAlign: 'right', lineHeight: 22, marginBottom: 8 },
  version: { fontSize: 12, color: '#94A3B8', textAlign: 'center', marginTop: 16 },
});
