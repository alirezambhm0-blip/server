import React from "react";
import { View, StyleSheet, useColorScheme } from "react-native";

export const ProductCardSkeleton: React.FC = () => {
  // به جای useTheme از خود React Native استفاده می‌کنیم تا به روتر وابسته نباشیم
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  // تعریف رنگ‌های پایه برای اسکلتون (هماهنگ با تم اپلیکیشن)
  const colors = {
    card: isDark ? "#1E1E1E" : "#FFFFFF",
    highlight: isDark ? "#333333" : "#E5E7EB",
  };

  return (
    <View style={[styles.card, { backgroundColor: colors.card }]}>
      {/* تصویر */}
      <View
        style={[
          styles.imagePlaceholder,
          { backgroundColor: colors.highlight, opacity: 0.5 },
        ]}
      />

      {/* عنوان */}
      <View style={styles.textContainer}>
        <View
          style={[
            styles.titleLine,
            { backgroundColor: colors.highlight, opacity: 0.5 },
          ]}
        />
        <View
          style={[
            styles.subtitleLine,
            { backgroundColor: colors.highlight, opacity: 0.3 },
          ]}
        />
      </View>

      {/* قیمت / دکمه */}
      <View style={styles.footer}>
        <View
          style={[
            styles.priceLine,
            { backgroundColor: colors.highlight, opacity: 0.5 },
          ]}
        />
        <View
          style={[
            styles.buttonPlaceholder,
            { backgroundColor: colors.highlight, opacity: 0.4 },
          ]}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    // یک سایه ملایم برای حالت لایت
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  imagePlaceholder: {
    height: 120, // کمی بلندتر برای ظاهر بهتر
    borderRadius: 8,
    marginBottom: 12,
  },
  textContainer: {
    marginBottom: 12,
  },
  titleLine: {
    height: 16,
    width: '90%',
    borderRadius: 4,
    marginBottom: 8,
  },
  subtitleLine: {
    height: 12,
    width: "60%",
    borderRadius: 4,
  },
  footer: {
    flexDirection: "row-reverse", // هماهنگ با استایل فارسی
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
  },
  priceLine: {
    height: 20,
    width: 70,
    borderRadius: 4,
  },
  buttonPlaceholder: {
    height: 35,
    width: 100,
    borderRadius: 10,
  },
});

export default ProductCardSkeleton;
