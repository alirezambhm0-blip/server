import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { buildUrl } from '@/api/httpClient';
import Skeleton from '@/components/ui/Skeleton';

interface Suggestion {
  id: string;
  text: string;
  type: 'product' | 'category';
  image_url?: string;
  category_name?: string;
}

interface SearchSuggestionsProps {
  suggestions: Suggestion[];
  loading: boolean;
  onPress: (suggestion: Suggestion) => void;
  onFullSearch: () => void;
  query: string;
}

export const SearchSuggestions: React.FC<SearchSuggestionsProps> = ({
  suggestions,
  loading,
  onPress,
  onFullSearch,
  query,
}) => {
  if (loading) {
    return (
      <View style={styles.container}>
        {[1, 2, 3, 4, 5].map(i => (
          <View key={i} style={styles.suggestionSkeleton}>
            <Skeleton width="100%" height={20} />
          </View>
        ))}
      </View>
    );
  }

  if (suggestions.length === 0 && query.trim().length > 0) {
    return (
      <View style={styles.emptySuggestions}>
        <Text style={styles.emptyText}>نتیجه‌ای یافت نشد</Text>
        <TouchableOpacity style={styles.fullSearchBtn} onPress={onFullSearch}>
          <Text style={styles.fullSearchBtnText}>جست‌وجوی کامل «{query}»</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {suggestions.map((s, i) => (
        <TouchableOpacity 
          key={i} 
          style={styles.suggestionRow} 
          onPress={() => onPress(s)}
        >
          <View style={styles.suggestionRight}>
            <View style={styles.suggestionIcon}>
              {s.image_url ? (
                <Image source={{ uri: buildUrl(s.image_url) }} style={styles.suggestionImg} />
              ) : (
                <Ionicons 
                  name={s.type === 'category' ? "grid-outline" : "cube-outline"} 
                  size={16} 
                  color="#2563EB" 
                />
              )}
            </View>
            <View>
              <Text style={styles.suggestionText}>{s.text}</Text>
              <Text style={styles.suggestionSub}>
                {s.type === 'category' ? "دسته‌بندی" : s.category_name}
              </Text>
            </View>
          </View>
          <Ionicons name="return-up-back" size={16} color="#CBD5E1" />
        </TouchableOpacity>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { backgroundColor: '#FFF', flex: 1 },
  suggestionRow: { 
    flexDirection: 'row-reverse', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    height: 52, 
    paddingHorizontal: 16, 
    borderBottomWidth: 1, 
    borderBottomColor: '#F1F5F9' 
  },
  suggestionRight: { flexDirection: 'row-reverse', alignItems: 'center' },
  suggestionIcon: { 
    width: 32, 
    height: 32, 
    borderRadius: 8, 
    backgroundColor: '#F1F5F9', 
    alignItems: 'center', 
    justifyContent: 'center', 
    marginLeft: 12, 
    overflow: 'hidden' 
  },
  suggestionImg: { width: '100%', height: '100%' },
  suggestionText: { fontSize: 14, color: '#0F172A', textAlign: 'right' },
  suggestionSub: { fontSize: 11, color: '#94A3B8', textAlign: 'right' },
  emptySuggestions: { padding: 40, alignItems: 'center' },
  emptyText: { fontSize: 13, color: '#94A3B8' },
  fullSearchBtn: { marginTop: 12 },
  fullSearchBtnText: { color: '#2563EB', fontWeight: 'bold' },
  suggestionSkeleton: { height: 52, justifyContent: 'center', paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
});
