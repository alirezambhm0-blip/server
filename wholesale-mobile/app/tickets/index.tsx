import React, { useEffect, useState, useCallback } from "react";
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl } from "react-native";
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/context/AuthContext";
import { ticketsApi } from "@/api/ticketsApi";
import { Ticket } from "@/types/ticket";
import GuestGuard from "@/components/ui/GuestGuard";
import LoadingState from "@/components/ui/LoadingState";
import EmptyState from "@/components/ui/EmptyState";
import { formatNumber } from "@/utils/format";

export default function TicketsListScreen() {
  const { isLoggedIn } = useAuth();
  const router = useRouter();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchTickets = useCallback(async () => {
    if (!isLoggedIn) return;
    try {
      const data = await ticketsApi.getMyTickets();
      setTickets(data);
    } catch (e) {
      console.warn("Failed to fetch tickets", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isLoggedIn]);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchTickets();
  };

  if (!isLoggedIn) {
    return (
      <GuestGuard 
        icon="chatbubbles-outline" 
        title="تیکت‌های پشتیبانی" 
        message="برای ارسال تیکت و ارتباط با پشتیبانی باید وارد حساب کاربری خود شوید." 
      />
    );
  }

  const renderBadge = (status: string) => {
    switch (status) {
      case 'OPEN': return <View style={[styles.badge, { backgroundColor: '#FEF3C7' }]}><Text style={[styles.badgeText, { color: '#92400E' }]}>در انتظار پاسخ</Text></View>;
      case 'ANSWERED': return <View style={[styles.badge, { backgroundColor: '#DBEAFE' }]}><Text style={[styles.badgeText, { color: '#1E40AF' }]}>پاسخ داده شده</Text></View>;
      case 'CLOSED': return <View style={[styles.badge, { backgroundColor: '#F1F5F9' }]}><Text style={[styles.badgeText, { color: '#475569' }]}>بسته شده</Text></View>;
      default: return null;
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="arrow-back" size={24} color="#0F172A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>تیکت‌های پشتیبانی</Text>
        <View style={{ width: 24 }} />
      </View>

      {loading ? (
        <LoadingState />
      ) : (
        <FlatList
          data={tickets}
          keyExtractor={(t) => t.id}
          // Perf ( Phase 5-2 ): کاهش حافظه/رندر — بدون تغییر رفتار
          initialNumToRender={8}
          maxToRenderPerBatch={8}
          windowSize={7}
          removeClippedSubviews
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <EmptyState message="هیچ تیکتی ثبت نکرده‌اید." icon="chatbox-ellipses-outline" />
          }
          renderItem={({ item }) => (
            <TouchableOpacity 
              style={styles.card} 
              activeOpacity={0.7} 
              onPress={() => router.push(`/tickets/${item.id}`)}
            >
              <View style={styles.cardHeader}>
                <Text style={styles.subject} numberOfLines={1}>{item.subject}</Text>
                {renderBadge(item.status)}
              </View>
              <View style={styles.cardFooter}>
                <Text style={styles.date}>{new Date(item.updatedAt).toLocaleString("fa-IR")}</Text>
                <Text style={styles.msgCount}>{formatNumber(item._count?.messages || 0)} پیام</Text>
              </View>
            </TouchableOpacity>
          )}
        />
      )}

      <TouchableOpacity 
        style={styles.fab} 
        activeOpacity={0.8} 
        onPress={() => router.push('/tickets/new')}
      >
        <Ionicons name="add" size={24} color="#fff" />
        <Text style={styles.fabText}>تیکت جدید</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F8FAFC" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, backgroundColor: "#fff", borderBottomWidth: 1, borderColor: "#E2E8F0" },
  headerTitle: { fontSize: 18, fontWeight: "800", color: "#0F172A" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  list: { padding: 16, paddingBottom: 100 },
  empty: { alignItems: "center", marginTop: 60 },
  emptyText: { marginTop: 12, color: "#64748B", fontSize: 14 },
  card: { backgroundColor: "#fff", padding: 16, borderRadius: 14, marginBottom: 12, borderWidth: 1, borderColor: "#E2E8F0", elevation: 2, shadowColor: "#000", shadowOpacity: 0.05, shadowOffset: { width:0, height:2 } },
  cardHeader: { flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  subject: { flex: 1, fontSize: 15, fontWeight: "800", color: "#1E293B", textAlign: "right", marginLeft: 12 },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  badgeText: { fontSize: 11, fontWeight: "700" },
  cardFooter: { flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center" },
  date: { fontSize: 12, color: "#64748B" },
  msgCount: { fontSize: 12, color: "#94A3B8", fontWeight: "600" },
  fab: { position: "absolute", bottom: 24, right: 24, backgroundColor: "#2563EB", flexDirection: "row-reverse", alignItems: "center", paddingVertical: 14, paddingHorizontal: 20, borderRadius: 100, elevation: 4, shadowColor: "#2563EB", shadowOpacity: 0.3, shadowOffset: { width:0, height:4 } },
  fabText: { color: "#fff", fontWeight: "800", fontSize: 15, marginRight: 8 }
});
