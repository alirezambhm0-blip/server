// src/components/product/ItemsPerPackageBadge.tsx
// بج "تعداد در بسته" — نمایش روی کارت محصول

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

type BadgeSize = 'small' | 'medium' | 'large';

interface Props {
  text: string | null | undefined;
  size?: BadgeSize;
}

/** استخراج متن فشرده: "۱۲ عدد در بسته" → "۱۲ عدد" */
function getCompactText(fullLabel: string): string {
  const match = fullLabel.match(/^([۰-۹0-9]+)\s*عدد/);
  if (match) return match[1] + ' عدد';
  return fullLabel;
}

export default function ItemsPerPackageBadge({ text, size = 'medium' }: Props) {
  if (!text) return null;

  const displayText = size === 'small' ? getCompactText(text) : text;

  return (
    <View style={[styles.base, styles[size]]}>
      <Text style={[styles.text, styles[`${size}Text`]]} numberOfLines={1}>
        {displayText}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: '#2563EB',
    borderRadius: 8,
    alignSelf: 'flex-start',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  text: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  // ── Small: کارت‌های کوچک صفحه خانه ──
  small: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    maxWidth: 90,
  },
  smallText: {
    fontSize: 10,
  },
  // ── Medium: لیست محصولات ──
  medium: {
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  mediumText: {
    fontSize: 11,
  },
  // ── Large: صفحه جزئیات محصول ──
  large: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  largeText: {
    fontSize: 13,
  },
});
