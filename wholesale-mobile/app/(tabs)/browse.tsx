import React, { useCallback, useEffect, useState, useRef } from "react";
import {
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  RefreshControl,
  ActivityIndicator,
  Modal,
  Pressable,
  Animated,
  Dimensions,
  Image,
  ScrollView,
} from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from "expo-router";

import ProductCard from "@/components/product/ProductCard";
import { productsApi, type Category } from "@/api/productsApi";
import { useAuth } from "@/context/AuthContext";
import { useCart } from "@/context/CartContext";
import { Product } from "@/types/product";
import Skeleton from "@/components/ui/Skeleton";
import { formatPrice } from "@/utils/format";
import { buildUrl } from "@/api/httpClient";

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const PAGE_SIZE = 24;

const COLORS = {
  primary: '#2563EB',
  primaryLight: '#DBEAFE',
  primaryXLight: '#EFF6FF',
  background: '#F8FAFC',
  card: '#FFFFFF',
  textPrimary: '#0F172A',
  textSecondary: '#64748B',
  border: '#E2E8F0',
  error: '#EF4444',
  success: '#16A34A',
};

const SORT_OPTIONS = [
  { id: 'default', label: 'پیش‌فرض' },
  { id: 'newest', label: 'جدیدترین' },
  { id: 'price_asc', label: 'ارزان‌ترین' },
  { id: 'price_desc', label: 'گران‌ترین' },
  { id: 'discounted', label: 'تخفیف‌دار' },
];

export default function BrowseScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { isLoggedIn, isApprovedCustomer, isPendingCustomer } = useAuth();
  const { totalItems: cartTotalItems } = useCart();

  // --- Filtering & Sorting States ---
  const [search, setSearch] = useState("");
  const [activeSearch, setActiveSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [activeFilterChip, setActiveFilterChip] = useState<string>("all"); // "all", "discounted", "new", "suggested", "favorited"
  const [activeSort, setActiveSort] = useState<string>("default");

  // --- Data States ---
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalProducts, setTotalProducts] = useState(0);

  // --- UI States ---
  const [showCategorySheet, setShowCategorySheet] = useState(false);
  const [showSortSheet, setShowSortSheet] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);

  // --- Sync with External Params (e.g. from Home) ---
  useEffect(() => {
    if (params.categoryId) {
        // We'll wait for categories to load then find it
    }
    if (params.filter) {
        setActiveFilterChip(params.filter as string);
    }
  }, [params]);

  // --- Initial Load ---
  useEffect(() => {
    productsApi.listCategories().then(setCategories).catch(console.warn);
  }, []);

  // Sync category if ID passed from params
  useEffect(() => {
    if (params.categoryId && categories.length > 0) {
        const found = categories.find(c => c.id === params.categoryId);
        if (found) setSelectedCategory(found);
    }
  }, [params.categoryId, categories]);

  // --- Fetch Logic ---
  const fetchProducts = useCallback(async (pageNum: number, append: boolean) => {
    if (!append) setLoading(true);
    else setLoadingMore(true);

    try {
      const res = await productsApi.list({
        page: pageNum,
        pageSize: PAGE_SIZE,
        categoryId: selectedCategory?.id,
        search: activeSearch || undefined,
        filter: activeFilterChip !== 'all' ? activeFilterChip : undefined,
        sort: activeSort !== 'default' ? activeSort : undefined,
      });

      setProducts(prev => append ? [...prev, ...res.items] : res.items);
      setTotalProducts(res.total);
      setPage(pageNum);
      // Backend returns total, but not total_pages explicitly in res.page style. 
      // Assuming res.page and res.pageSize are used to calc
      setTotalPages(Math.ceil(res.total / PAGE_SIZE));
    } catch (e) {
      console.warn('Failed to fetch products', e);
    } finally {
      setLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
      setSearchLoading(false);
    }
  }, [selectedCategory, activeSearch, activeFilterChip, activeSort]);

  useEffect(() => {
    fetchProducts(1, false);
  }, [fetchProducts]);

  // --- Handlers ---
  const handleRefresh = () => {
    setRefreshing(true);
    fetchProducts(1, false);
  };

  const handleLoadMore = () => {
    if (loading || loadingMore || page >= totalPages) return;
    fetchProducts(page + 1, true);
  };

  const handleSearchChange = (text: string) => {
    setSearch(text);
    setSearchLoading(true);
  };

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setActiveSearch(search.length >= 2 ? search : "");
    }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  const clearAllFilters = () => {
    setSelectedCategory(null);
    setActiveFilterChip("all");
    setSearch("");
    setActiveSearch("");
    setActiveSort("default");
  };

  // --- UI Components ---

  const renderFilterChips = () => {
    const chips = [
      { id: 'all', label: 'همه' },
      { id: 'discounted', label: 'تخفیف‌دار' },
      { id: 'new', label: 'جدید' },
      { id: 'suggested', label: 'پیشنهادی' },
      { id: 'favorited', label: 'علاقه‌مندی‌ها' },
    ];

    return (
      <View style={styles.chipsContainer}>
        <FlatList
          horizontal
          data={chips}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsContent}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.chip, activeFilterChip === item.id && styles.chipActive]}
              onPress={() => setActiveFilterChip(item.id)}
            >
              <Text style={[styles.chipText, activeFilterChip === item.id && styles.chipTextActive]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>
    );
  };

  const renderActiveFiltersSummary = () => {
    const hasActive = selectedCategory || activeFilterChip !== 'all' || activeSearch;
    if (!hasActive) return null;

    let text = `نمایش ${totalProducts} محصول`;
    if (selectedCategory) text += ` در دسته «${selectedCategory.name}»`;
    if (activeFilterChip !== 'all') {
        const chip = SORT_OPTIONS.find(o => o.id === activeFilterChip) || { label: activeFilterChip };
        text += ` — ${chip.label}`;
    }
    if (activeSearch) text = `نتایج جست‌وجو برای «${activeSearch}» — ${totalProducts} محصول`;

    return (
      <View style={styles.summaryContainer}>
        <Text style={styles.summaryText}>{text}</Text>
        <TouchableOpacity onPress={clearAllFilters}>
          <Text style={styles.clearAllText}>حذف فیلترها</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderSkeleton = () => (
    <View style={styles.gridContent}>
      <View style={styles.gridRow}>
        {[1,2,3,4].map(i => (
          <View key={i} style={styles.gridItem}>
            <Skeleton width="100%" height={160} borderRadius={16} />
            <Skeleton width="80%" height={14} borderRadius={4} style={{ marginTop: 8 }} />
            <Skeleton width="50%" height={14} borderRadius={4} style={{ marginTop: 4 }} />
            <Skeleton width="60%" height={28} borderRadius={8} style={{ marginTop: 8 }} />
          </View>
        ))}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>محصولات</Text>
        <TouchableOpacity style={styles.cartBtn} onPress={() => router.push("/(tabs)/cart")}>
          <Ionicons name="cart-outline" size={24} color={COLORS.textPrimary} />
          {cartTotalItems > 0 && (
            <View style={styles.cartBadge}>
              <Text style={styles.cartBadgeText}>{cartTotalItems}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Sticky Filters Section */}
      <View style={styles.stickySection}>
        {/* Search */}
        <View style={styles.searchContainer}>
          <Ionicons name="search-outline" size={20} color="#94A3B8" />
          <TextInput
            placeholder="جست‌وجوی محصول یا دسته‌بندی..."
            placeholderTextColor="#94A3B8"
            style={styles.searchInput}
            value={search}
            onChangeText={handleSearchChange}
          />
          {searchLoading ? (
            <ActivityIndicator size="small" color={COLORS.primary} />
          ) : search.length > 0 ? (
            <TouchableOpacity onPress={() => setSearch("")}>
              <Ionicons name="close-circle" size={18} color="#94A3B8" />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Category Dropdown */}
        <TouchableOpacity 
            style={[styles.dropdown, selectedCategory && styles.dropdownActive]} 
            onPress={() => setShowCategorySheet(true)}
        >
          <View style={styles.dropdownLeft}>
            {selectedCategory && (
                <TouchableOpacity onPress={(e) => { e.stopPropagation(); setSelectedCategory(null); }}>
                    <Ionicons name="close" size={18} color={COLORS.primary} />
                </TouchableOpacity>
            )}
            <Ionicons name="chevron-down" size={18} color="#64748B" />
          </View>
          <View style={styles.dropdownRight}>
            <Ionicons name="grid-outline" size={18} color="#64748B" style={{ marginLeft: 8 }} />
            <Text style={[styles.dropdownText, selectedCategory && styles.dropdownTextActive]}>
              {selectedCategory ? selectedCategory.name : "همه دسته‌بندی‌ها"}
            </Text>
          </View>
        </TouchableOpacity>

        {/* Filter Chips */}
        {renderFilterChips()}
      </View>

      {/* Scrollable Content */}
      <FlatList
        data={products}
        keyExtractor={item => item.id}
        numColumns={2}
        // Perf ( Phase 5-2 ): کاهش حافظه/رندر — بدون تغییر رفتار
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={7}
        removeClippedSubviews
        columnWrapperStyle={styles.gridRow}
        contentContainerStyle={styles.gridContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={COLORS.primary} />}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.4}
        ListHeaderComponent={
          <View>
            <View style={styles.sortContainer}>
                <TouchableOpacity style={styles.sortBtn} onPress={() => setShowSortSheet(true)}>
                    <Ionicons name="swap-vertical" size={18} color="#64748B" />
                    <Text style={styles.sortText}>{SORT_OPTIONS.find(o => o.id === activeSort)?.label || "پیش‌فرض"}</Text>
                </TouchableOpacity>
            </View>
            {renderActiveFiltersSummary()}
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.gridItem}>
            <ProductCard product={item} />
          </View>
        )}
        ListEmptyComponent={
            loading ? renderSkeleton() : (
                <View style={styles.emptyState}>
                    <Ionicons name="cube-outline" size={64} color="#CBD5E1" />
                    <Text style={styles.emptyTitle}>محصولی یافت نشد</Text>
                    <Text style={styles.emptySubtitle}>عبارت دیگری را امتحان کنید یا فیلترها را حذف کنید.</Text>
                    <TouchableOpacity style={styles.resetBtn} onPress={clearAllFilters}>
                        <Text style={styles.resetBtnText}>حذف فیلترها</Text>
                    </TouchableOpacity>
                </View>
            )
        }
        ListFooterComponent={
            loadingMore ? (
                <View style={styles.footerLoader}>
                    <ActivityIndicator color={COLORS.primary} />
                    <Text style={styles.footerText}>در حال بارگذاری...</Text>
                </View>
            ) : products.length > 0 && page >= totalPages ? (
                <Text style={styles.allLoadedText}>همه محصولات نمایش داده شد</Text>
            ) : <View style={{ height: 40 }} />
        }
      />

      {/* --- Modals --- */}

      {/* Category Bottom Sheet */}
      <Modal visible={showCategorySheet} transparent animationType="fade" onRequestClose={() => setShowCategorySheet(false)}>
          <Pressable style={styles.modalOverlay} onPress={() => setShowCategorySheet(false)}>
              <Animated.View style={styles.bottomSheet}>
                  <View style={styles.sheetHeader}>
                      <Text style={styles.sheetTitle}>انتخاب دسته‌بندی</Text>
                      <TouchableOpacity onPress={() => setShowCategorySheet(false)}>
                          <Ionicons name="close" size={24} color={COLORS.textPrimary} />
                      </TouchableOpacity>
                  </View>
                  <ScrollView style={styles.sheetContent}>
                      <TouchableOpacity 
                        style={styles.sheetItem} 
                        onPress={() => { setSelectedCategory(null); setShowCategorySheet(false); }}
                      >
                          <Text style={[styles.sheetItemText, !selectedCategory && styles.sheetItemActive]}>همه دسته‌بندی‌ها</Text>
                          {!selectedCategory && <Ionicons name="checkmark" size={20} color={COLORS.primary} />}
                      </TouchableOpacity>
                      {categories.map(cat => (
                          <TouchableOpacity 
                            key={cat.id} 
                            style={styles.sheetItem} 
                            onPress={() => { setSelectedCategory(cat); setShowCategorySheet(false); }}
                          >
                              <View style={{ flexDirection: 'row-reverse', alignItems: 'center' }}>
                                  <Image source={{ uri: buildUrl(cat.imageUrl || '') }} style={styles.sheetItemImg} />
                                  <Text style={[styles.sheetItemText, selectedCategory?.id === cat.id && styles.sheetItemActive]}>
                                      {cat.name}
                                  </Text>
                              </View>
                              {selectedCategory?.id === cat.id && <Ionicons name="checkmark" size={20} color={COLORS.primary} />}
                          </TouchableOpacity>
                      ))}
                      <View style={{ height: 40 }} />
                  </ScrollView>
              </Animated.View>
          </Pressable>
      </Modal>

      {/* Sort Bottom Sheet */}
      <Modal visible={showSortSheet} transparent animationType="fade" onRequestClose={() => setShowSortSheet(false)}>
          <Pressable style={styles.modalOverlay} onPress={() => setShowSortSheet(false)}>
              <Animated.View style={[styles.bottomSheet, { height: 'auto', maxHeight: 400 }]}>
                  <View style={styles.sheetHeader}>
                      <Text style={styles.sheetTitle}>مرتب‌سازی</Text>
                      <TouchableOpacity onPress={() => setShowSortSheet(false)}>
                          <Ionicons name="close" size={24} color={COLORS.textPrimary} />
                      </TouchableOpacity>
                  </View>
                  <View style={{ padding: 16 }}>
                      {SORT_OPTIONS.map(opt => (
                          <TouchableOpacity 
                            key={opt.id} 
                            style={styles.sortOption} 
                            onPress={() => { setActiveSort(opt.id); setShowSortSheet(false); }}
                          >
                              <Text style={[styles.sortOptionText, activeSort === opt.id && styles.sortOptionActive]}>{opt.label}</Text>
                              <View style={[styles.radio, activeSort === opt.id && styles.radioSelected]}>
                                  {activeSort === opt.id && <View style={styles.radioInner} />}
                              </View>
                          </TouchableOpacity>
                      ))}
                  </View>
              </Animated.View>
          </Pressable>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  header: { 
    flexDirection: 'row-reverse', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    paddingHorizontal: 16, 
    height: 56, 
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: COLORS.textPrimary },
  cartBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  cartBadge: { 
    position: 'absolute', top: 4, right: 4, 
    backgroundColor: COLORS.error, width: 16, height: 16, 
    borderRadius: 8, alignItems: 'center', justifyContent: 'center' 
  },
  cartBadgeText: { color: '#FFF', fontSize: 10, fontWeight: 'bold' },
  stickySection: { 
    backgroundColor: '#FFF', 
    paddingVertical: 12, 
    borderBottomWidth: 1, 
    borderBottomColor: COLORS.border,
    zIndex: 10
  },
  searchContainer: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    height: 46,
    backgroundColor: '#F1F5F9',
    marginHorizontal: 16,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  searchInput: { flex: 1, textAlign: 'right', marginHorizontal: 10, color: COLORS.textPrimary, fontSize: 14, fontFamily: 'Vazirmatn' },
  dropdown: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    height: 44,
    backgroundColor: '#FFF',
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  dropdownActive: { backgroundColor: COLORS.primaryXLight, borderColor: COLORS.primary },
  dropdownRight: { flexDirection: 'row-reverse', alignItems: 'center' },
  dropdownLeft: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8 },
  dropdownText: { fontSize: 14, color: COLORS.textPrimary },
  dropdownTextActive: { color: COLORS.primary, fontWeight: '500' },
  chipsContainer: { marginTop: 12 },
  chipsContent: { paddingHorizontal: 16, gap: 8, flexDirection: 'row-reverse' },
  chip: {
    height: 36,
    paddingHorizontal: 16,
    borderRadius: 18,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { fontSize: 13, color: COLORS.textSecondary, fontWeight: '500' },
  chipTextActive: { color: '#FFF' },
  sortContainer: { paddingHorizontal: 16, marginTop: 12, alignItems: 'flex-start' },
  sortBtn: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6 },
  sortText: { fontSize: 12, color: COLORS.textSecondary, fontWeight: '500' },
  summaryContainer: { 
    flexDirection: 'row-reverse', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    paddingHorizontal: 16, 
    marginTop: 8, 
    marginBottom: 4 
  },
  summaryText: { fontSize: 12, color: COLORS.textSecondary },
  clearAllText: { fontSize: 12, color: COLORS.error, fontWeight: '500' },
  listContent: { paddingBottom: 24 },
  gridContent: { paddingHorizontal: 12, paddingBottom: 24 },
  gridRow: { justifyContent: 'space-between' },
  gridItem: { width: '49%', marginBottom: 12 },
  skeletonCard: { flexDirection: 'row-reverse', padding: 16, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  emptyState: { padding: 40, alignItems: 'center', marginTop: 40 },
  emptyTitle: { fontSize: 16, fontWeight: 'bold', color: COLORS.textPrimary, marginTop: 16 },
  emptySubtitle: { fontSize: 13, color: COLORS.textSecondary, textAlign: 'center', marginTop: 8 },
  resetBtn: { marginTop: 20, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: COLORS.primary },
  resetBtnText: { color: COLORS.primary, fontWeight: 'bold' },
  footerLoader: { padding: 20, alignItems: 'center', gap: 8 },
  footerText: { fontSize: 12, color: COLORS.textSecondary },
  allLoadedText: { textAlign: 'center', color: '#94A3B8', fontSize: 12, padding: 20 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  bottomSheet: { backgroundColor: '#FFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, height: SCREEN_HEIGHT * 0.7 },
  sheetHeader: { 
    flexDirection: 'row-reverse', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    padding: 16, 
    borderBottomWidth: 1, 
    borderBottomColor: '#F1F5F9' 
  },
  sheetTitle: { fontSize: 16, fontWeight: 'bold', color: COLORS.textPrimary },
  sheetContent: { flex: 1 },
  sheetItem: { 
    flexDirection: 'row-reverse', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    padding: 16, 
    borderBottomWidth: 1, 
    borderBottomColor: '#F8FAFC' 
  },
  sheetItemImg: { width: 36, height: 36, borderRadius: 8, marginLeft: 12, backgroundColor: '#F1F5F9' },
  sheetItemText: { fontSize: 14, color: COLORS.textPrimary },
  sheetItemActive: { color: COLORS.primary, fontWeight: 'bold' },
  sortOption: { 
    flexDirection: 'row-reverse', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    paddingVertical: 14 
  },
  sortOptionText: { fontSize: 14, color: COLORS.textPrimary },
  sortOptionActive: { color: COLORS.primary, fontWeight: '500' },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#CBD5E1', alignItems: 'center', justifyContent: 'center' },
  radioSelected: { borderColor: COLORS.primary },
  radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.primary },
});
