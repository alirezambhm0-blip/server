import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform } from "react-native";
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { ticketsApi } from "@/api/ticketsApi";
import { notify } from "@/utils/notify";

export default function NewTicketScreen() {
  const router = useRouter();
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const handleSubmit = async () => {
    if (!subject.trim() || !message.trim()) {
      notify("خطا", "لطفاً موضوع و متن پیام را وارد کنید.");
      return;
    }
    setBusy(true);
    try {
      await ticketsApi.createTicket(subject.trim(), message.trim());
      notify("موفق", "تیکت شما با موفقیت ثبت شد.", [
        { text: "باشه", onPress: () => router.replace("/tickets") }
      ]);
    } catch (e: any) {
      notify("خطا", e?.data?.message || e?.message || "ثبت تیکت با خطا مواجه شد.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={10}>
            <Ionicons name="arrow-back" size={24} color="#0F172A" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>تیکت جدید</Text>
          <View style={{ width: 24 }} />
        </View>

        <View style={styles.content}>
          <View style={styles.field}>
            <Text style={styles.label}>موضوع تیکت</Text>
            <TextInput
              style={styles.input}
              placeholder="مثال: پیگیری سفارش..."
              placeholderTextColor="#94A3B8"
              value={subject}
              onChangeText={setSubject}
              textAlign="right"
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>متن پیام</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="توضیحات خود را کامل بنویسید..."
              placeholderTextColor="#94A3B8"
              value={message}
              onChangeText={setMessage}
              textAlign="right"
              multiline
              textAlignVertical="top"
            />
          </View>

          <TouchableOpacity 
            style={[styles.btn, busy && styles.btnDisabled]} 
            activeOpacity={0.8} 
            onPress={handleSubmit}
            disabled={busy}
          >
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>ثبت تیکت</Text>}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F8FAFC" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, backgroundColor: "#fff", borderBottomWidth: 1, borderColor: "#E2E8F0" },
  headerTitle: { fontSize: 18, fontWeight: "800", color: "#0F172A" },
  content: { padding: 16, flex: 1 },
  field: { marginBottom: 16 },
  label: { fontSize: 14, fontWeight: "700", color: "#334155", marginBottom: 8, textAlign: "right" },
  input: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#CBD5E1", borderRadius: 12, paddingHorizontal: 14, height: 52, fontSize: 14, color: "#0F172A" },
  textArea: { height: 160, paddingTop: 14 },
  btn: { backgroundColor: "#2563EB", height: 52, borderRadius: 12, justifyContent: "center", alignItems: "center", marginTop: 12 },
  btnDisabled: { backgroundColor: "#94A3B8" },
  btnText: { color: "#fff", fontSize: 15, fontWeight: "800" },
});
