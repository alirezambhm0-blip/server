import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface PopularItem {
  text: string;
}

interface SearchPopularProps {
  popular: PopularItem[];
  onItemPress: (text: string) => void;
}

export const SearchPopular: React.FC<SearchPopularProps> = ({
  popular,
  onItemPress,
}) => {
  if (popular.length === 0) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>جست‌وجوهای پرطرفدار</Text>
      <View style={styles.chipsRow}>
        {popular.map((item, i) => (
          <TouchableOpacity 
            key={i} 
            style={styles.popularChip} 
            onPress={() => onItemPress(item.text)}
          >
            <Ionicons name="trending-up" size={14} color="#2563EB" />
            <Text style={styles.chipText}>{item.text}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { padding: 16 },
  title: { fontSize: 14, fontWeight: 'bold', color: '#0F172A', textAlign: 'right', marginBottom: 12 },
  chipsRow: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8 },
  popularChip: { 
    flexDirection: 'row-reverse', 
    alignItems: 'center', 
    backgroundColor: '#DBEAFE', 
    paddingHorizontal: 14, 
    height: 34, 
    borderRadius: 17,
    gap: 6
  },
  chipText: { fontSize: 13, color: '#1D4ED8', marginRight: 6 },
});
