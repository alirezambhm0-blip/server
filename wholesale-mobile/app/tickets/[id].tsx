import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { notify } from "@/utils/notify";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/context/AuthContext";
import { ticketsApi } from "@/api/ticketsApi";
import { Ticket, TicketMessage } from "@/types/ticket";
import GuestGuard from "@/components/ui/GuestGuard";
import LoadingState from "@/components/ui/LoadingState";
import EmptyState from "@/components/ui/EmptyState";

export default function TicketDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { isLoggedIn } = useAuth();

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<ScrollView | null>(null);

  const fetchTicket = useCallback(async () => {
    if (!id) return;
    try {
      const data = await ticketsApi.getTicketDetails(id);
      setTicket(data);
    } catch (e) {
      console.warn("Failed to load ticket details", e);
      setTicket(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useEffect(() => {
    if (isLoggedIn) fetchTicket();
  }, [fetchTicket, isLoggedIn]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchTicket();
  };

  const handleSendReply = async () => {
    const text = reply.trim();
    if (!text || sending || !ticket) return;
    setSending(true);
    try {
      await ticketsApi.replyToTicket(ticket.id, text);
      setReply("");
      await fetchTicket(); // پیام جدید + وضعیت به‌روز (سرور وضعیت را OPEN می‌کند)
    } catch (e: any) {
      notify("خطا", e?.message || "ارسال پاسخ ناموفق بود. دوباره تلاش کنید.");
    } finally {
      setSending(false);
    }
  };

  if (!isLoggedIn) {
    return (
      <GuestGuard
        icon="chatbubbles-outline"
        title="جزئیات تیکت"
        message="برای مشاهده تیکت و گفتگو با پشتیبانی باید وارد حساب کاربری خود شوید."
      />
    );
  }

  const renderBadge = (status: string) => {
    switch (status) {
      case 'OPEN':
        return <View style={[styles.badge, { backgroundColor: '#FEF3C7' }]}><Text style={[styles.badgeText, { color: '#92400E' }]}>در انتظار پاسخ</Text></View>;
      case 'ANSWERED':
        return <View style={[styles.badge, { backgroundColor: '#DBEAFE' }]}><Text style={[styles.badgeText, { color: '#1E40AF' }]}>پاسخ داده شده</Text></View>;
      case 'CLOSED':
        return <View style={[styles.badge, { backgroundColor: '#F1F5F9' }]}><Text style={[styles.badgeText, { color: '#475569' }]}>بسته شده</Text></View>;
      default:
        return null;
    }
  };

  const renderMessage = (m: TicketMessage) => {
    const mine = m.senderType === 'CUSTOMER';
    return (
      <View key={m.id} style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleAdmin]}>
        <Text style={[styles.bubbleSender, mine ? styles.bubbleSenderMine : styles.bubbleSenderAdmin]}>
          {mine ? 'شما' : 'پشتیبانی'}
        </Text>
        <Text style={[styles.bubbleBody, mine ? styles.bubbleTextMine : styles.bubbleTextAdmin]}>{m.body}</Text>
        <Text style={[styles.bubbleTime, mine ? styles.bubbleTimeMine : styles.bubbleTimeAdmin]}>
          {new Date(m.createdAt).toLocaleString("fa-IR")}
        </Text>
      </View>
    );
  };

  const messages = ticket?.messages ?? [];
  const isClosed = ticket?.status === 'CLOSED';

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="arrow-back" size={24} color="#0F172A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>جزئیات تیکت</Text>
        <View style={{ width: 24 }} />
      </View>

      {loading ? (
        <LoadingState />
      ) : !ticket ? (
        <View style={styles.center}>
          <EmptyState message="تیکت یافت نشد" icon="alert-circle-outline" />
        </View>
      ) : (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            ref={scrollRef}
            onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          >
            {/* کارت اطلاعات تیکت */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.subject}>{ticket.subject}</Text>
                {renderBadge(ticket.status)}
              </View>
              <Text style={styles.date}>ثبت شده در {new Date(ticket.createdAt).toLocaleString("fa-IR")}</Text>
            </View>

            {/* رشته گفتگو */}
            {messages.length === 0 ? (
              <EmptyState message="پیامی ثبت نشده است." icon="chatbox-ellipses-outline" />
            ) : (
              messages.map(renderMessage)
            )}
          </ScrollView>

          {/* جعبه پاسخ / نوار بسته‌شده */}
          {isClosed ? (
            <View style={styles.closedBar}>
              <Ionicons name="lock-closed-outline" size={16} color="#475569" />
              <Text style={styles.closedText}>این تیکت بسته شده است. در صورت نیاز، تیکت جدیدی ثبت کنید.</Text>
            </View>
          ) : (
            <View style={styles.composer}>
              <TextInput
                style={styles.input}
                placeholder="پاسخ خود را بنویسید..."
                placeholderTextColor="#94A3B8"
                value={reply}
                onChangeText={setReply}
                multiline
                textAlign="right"
                textAlignVertical="top"
                editable={!sending}
              />
              <TouchableOpacity
                style={[styles.sendBtn, (!reply.trim() || sending) && styles.sendBtnDisabled]}
                onPress={handleSendReply}
                disabled={!reply.trim() || sending}
                activeOpacity={0.8}
              >
                {sending ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Ionicons name="send" size={18} color="#fff" />
                )}
              </TouchableOpacity>
            </View>
          )}
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F8FAFC" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, backgroundColor: "#fff", borderBottomWidth: 1, borderColor: "#E2E8F0" },
  headerTitle: { fontSize: 18, fontWeight: "800", color: "#0F172A" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  scrollContent: { padding: 16, paddingBottom: 24 },
  card: { backgroundColor: "#fff", padding: 16, borderRadius: 14, marginBottom: 16, borderWidth: 1, borderColor: "#E2E8F0" },
  cardHeader: { flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center", marginBottom: 8, gap: 12 },
  subject: { flex: 1, fontSize: 15, fontWeight: "800", color: "#1E293B", textAlign: "right" },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  badgeText: { fontSize: 11, fontWeight: "700" },
  date: { fontSize: 12, color: "#64748B", textAlign: "right" },
  bubble: { maxWidth: "82%", borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 10 },
  bubbleMine: { alignSelf: "flex-end", backgroundColor: "#2563EB", borderBottomLeftRadius: 4 },
  bubbleAdmin: { alignSelf: "flex-start", backgroundColor: "#fff", borderWidth: 1, borderColor: "#E2E8F0", borderBottomRightRadius: 4 },
  bubbleSender: { fontSize: 11, fontWeight: "700", marginBottom: 4, textAlign: "right" },
  bubbleSenderMine: { color: "#DBEAFE" },
  bubbleSenderAdmin: { color: "#2563EB" },
  bubbleBody: { fontSize: 14, lineHeight: 22, textAlign: "right", writingDirection: "rtl" },
  bubbleTextMine: { color: "#fff" },
  bubbleTextAdmin: { color: "#0F172A" },
  bubbleTime: { fontSize: 10, marginTop: 6, textAlign: "left" },
  bubbleTimeMine: { color: "#BFDBFE" },
  bubbleTimeAdmin: { color: "#94A3B8" },
  composer: { flexDirection: "row", alignItems: "flex-end", gap: 8, padding: 10, backgroundColor: "#fff", borderTopWidth: 1, borderColor: "#E2E8F0" },
  input: { flex: 1, minHeight: 44, maxHeight: 120, backgroundColor: "#F1F5F9", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: "#0F172A" },
  sendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#2563EB", alignItems: "center", justifyContent: "center" },
  sendBtnDisabled: { backgroundColor: "#93C5FD" },
  closedBar: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 8, padding: 14, backgroundColor: "#F1F5F9", borderTopWidth: 1, borderColor: "#E2E8F0" },
  closedText: { fontSize: 12, color: "#475569", fontWeight: "600" },
});
