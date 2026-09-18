import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface HistoryItem {
  id: string;
  query: string;
}

interface SearchHistoryProps {
  history: HistoryItem[];
  onItemPress: (query: string) => void;
  onClearAll: () => void;
}

export const SearchHistory: React.FC<SearchHistoryProps> = ({
  history,
  onItemPress,
  onClearAll,
}) => {
  if (history.length === 0) return null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>جست‌وجوهای اخیر</Text>
        <TouchableOpacity onPress={onClearAll}>
          <Text style={styles.clearAllText}>پاک کردن همه</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.chipsRow}>
        {history.map(item => (
          <TouchableOpacity 
            key={item.id} 
            style={styles.historyChip} 
            onPress={() => onItemPress(item.query)}
          >
            <Ionicons name="time-outline" size={14} color="#94A3B8" />
            <Text style={styles.chipText} numberOfLines={1}>{item.query}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { padding: 16 },
  header: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  title: { fontSize: 14, fontWeight: 'bold', color: '#0F172A', textAlign: 'right' },
  clearAllText: { fontSize: 12, color: '#EF4444' },
  chipsRow: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8 },
  historyChip: { 
    flexDirection: 'row-reverse', 
    alignItems: 'center', 
    backgroundColor: '#F1F5F9', 
    paddingHorizontal: 12, 
    height: 34, 
    borderRadius: 17, 
    borderWidth: 1, 
    borderColor: '#E2E8F0',
    maxWidth: 150
  },
  chipText: { fontSize: 13, color: '#64748B', marginRight: 6 },
});
