import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  ScrollView,
  Image,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { searchApi, type SearchSuggestion, type SearchResult } from '@/api/searchApi';
import { productsApi, type Category } from '@/api/productsApi';
import { useAuth } from '@/context/AuthContext';
import { buildUrl } from '@/api/httpClient';
import ProductRowCard from '@/components/product/ProductRowCard';
import Skeleton from '@/components/ui/Skeleton';
import { 
  SearchInput, 
  SearchHistory, 
  SearchSuggestions, 
  SearchPopular, 
  SearchEmpty 
} from '@/components/search';

const COLORS = {
  primary: '#2563EB',
  background: '#F8FAFC',
  textPrimary: '#0F172A',
  textSecondary: '#64748B',
  border: '#E2E8F0',
};

export default function SearchScreen() {
  const router = useRouter();
  const { isLoggedIn } = useAuth();

  // --- States ---
  const [query, setQuery] = useState("");
  const [activeState, setActiveState] = useState<'IDLE' | 'TYPING' | 'RESULTS' | 'NO_RESULTS'>('IDLE');
  
  const [history, setHistory] = useState<any[]>([]);
  const [popular, setPopular] = useState<any[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [results, setResults] = useState<SearchResult | null>(null);
  
  const [loading, setLoading] = useState(false);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);

  // --- Initial Load ---
  useEffect(() => {
    searchApi.getPopular().then(res => setPopular(res.popular)).catch(() => {});
    productsApi.listCategories().then(setCategories).catch(() => {});
    
    if (isLoggedIn) {
      searchApi.getHistory().then(res => setHistory(res.history)).catch(() => {});
    }
  }, [isLoggedIn]);

  // --- Autocomplete Logic ---
  useEffect(() => {
    if (query.trim().length < 2 || activeState === 'RESULTS') {
        if (query.trim().length === 0) setActiveState('IDLE');
        return;
    }

    setActiveState('TYPING');
    setSuggestionsLoading(true);

    const timer = setTimeout(async () => {
      try {
        const res = await searchApi.getSuggestions(query);
        setSuggestions(res.suggestions);
      } catch (e) {
      } finally {
        setSuggestionsLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  // --- Search Execution ---
  const executeSearch = async (q = query) => {
    if (q.trim().length < 2) return;
    
    setLoading(true);
    setQuery(q);
    setActiveState('RESULTS');

    try {
      const res = await searchApi.search({ q });
      setResults(res);
      if (!res.has_results) setActiveState('NO_RESULTS');
      if (isLoggedIn) searchApi.addHistory(q, res.total_results).catch(() => {});
    } catch (e) {
      setActiveState('NO_RESULTS');
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
      setQuery("");
      setActiveState('IDLE');
      setResults(null);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <SearchInput 
        query={query}
        setQuery={setQuery}
        onClear={handleClear}
        onSubmit={() => executeSearch()}
        onBack={() => router.back()}
      />

      <View style={styles.body}>
        {activeState === 'IDLE' && (
          <ScrollView style={styles.scrollBody} showsVerticalScrollIndicator={false}>
            <SearchHistory 
              history={history}
              onItemPress={(q) => executeSearch(q)}
              onClearAll={() => searchApi.clearHistory().then(() => setHistory([]))}
            />
            <SearchPopular 
              popular={popular}
              onItemPress={(q) => executeSearch(q)}
            />
            
            <View style={styles.idleBlock}>
              <Text style={styles.blockTitle}>جست‌وجو در دسته‌بندی‌ها</Text>
              <View style={styles.categoryGrid}>
                {categories.map(cat => (
                  <TouchableOpacity 
                    key={cat.id} 
                    style={styles.categoryTile} 
                    onPress={() => router.push(`/(tabs)/browse?categoryId=${cat.id}`)}
                  >
                    <Image source={{ uri: buildUrl(cat.imageUrl || '') }} style={styles.tileImg} />
                    <View style={styles.tileContent}>
                      <Text style={styles.tileName} numberOfLines={1}>{cat.name}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </ScrollView>
        )}

        {activeState === 'TYPING' && (
          <SearchSuggestions 
            suggestions={suggestions as any}
            loading={suggestionsLoading}
            query={query}
            onFullSearch={() => executeSearch()}
            onPress={(s) => {
              if (s.type === 'product') {
                router.push(`/product-detail?id=${s.id}`);
              } else {
                router.push(`/(tabs)/browse?categoryId=${s.id}`);
              }
            }}
          />
        )}

        {activeState === 'RESULTS' && (
          <View style={{ flex: 1 }}>
            {loading ? (
                <View style={{ padding: 16 }}>
                  {[1,2,3,4].map(i => <View key={i} style={{ marginBottom: 12 }}><Skeleton width="100%" height={100} borderRadius={14} /></View>)}
                </View>
            ) : (
                <FlatList
                  data={results?.products.data}
                  keyExtractor={item => item.id}
                  renderItem={({ item }) => <ProductRowCard product={item} />}
                  // Perf ( Phase 5-2 ): کاهش حافظه/رندر — بدون تغییر رفتار
                  initialNumToRender={8}
                  maxToRenderPerBatch={8}
                  windowSize={7}
                  removeClippedSubviews
                  contentContainerStyle={{ paddingVertical: 12 }}
                  showsVerticalScrollIndicator={false}
                />
            )}
          </View>
        )}

        {activeState === 'NO_RESULTS' && (
          <SearchEmpty 
            query={query}
            onViewAll={() => router.push("/(tabs)/browse")}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FFF' },
  body: { flex: 1, backgroundColor: COLORS.background },
  scrollBody: { flex: 1 },
  idleBlock: { padding: 16 },
  blockTitle: { fontSize: 14, fontWeight: 'bold', color: COLORS.textPrimary, textAlign: 'right', marginBottom: 12 },
  categoryGrid: { flexDirection: 'row-reverse', flexWrap: 'wrap', justifyContent: 'space-between', gap: 10 },
  categoryTile: { 
    width: '48%', 
    height: 64, 
    backgroundColor: '#FFF', 
    borderRadius: 12, 
    borderWidth: 1, 
    borderColor: COLORS.border, 
    flexDirection: 'row-reverse', 
    alignItems: 'center', 
    padding: 10 
  },
  tileImg: { width: 40, height: 40, borderRadius: 8 },
  tileContent: { flex: 1, marginRight: 10 },
  tileName: { fontSize: 13, fontWeight: '500', color: COLORS.textPrimary, textAlign: 'right' },
});
