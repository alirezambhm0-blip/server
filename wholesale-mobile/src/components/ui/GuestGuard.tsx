import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

type Props = {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  message: string;
};

export default function GuestGuard({ icon = "lock-closed-outline", title, message }: Props) {
  const router = useRouter();
  
  return (
    <View style={styles.container}>
      <Ionicons name={icon} size={64} color="#CBD5E1" />
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
      <TouchableOpacity
        style={styles.btn}
        activeOpacity={0.85}
        onPress={() => router.push("/(auth)/login")}
      >
        <Text style={styles.btnText}>ورود به حساب کاربری</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: "#F8FAFC", 
    alignItems: "center", 
    justifyContent: "center", 
    paddingHorizontal: 32 
  },
  title: { 
    fontSize: 18, 
    fontWeight: "800", 
    color: "#0F172A", 
    textAlign: "center", 
    marginBottom: 8, 
    marginTop: 16 
  },
  message: { 
    fontSize: 13, 
    color: "#64748B", 
    textAlign: "center", 
    lineHeight: 22, 
    marginBottom: 20 
  },
  btn: { 
    flexDirection: "row-reverse", 
    alignItems: "center", 
    gap: 8, 
    backgroundColor: "#2563EB", 
    paddingVertical: 12, 
    paddingHorizontal: 24, 
    borderRadius: 14 
  },
  btnText: { 
    color: "#FFFFFF", 
    fontSize: 14, 
    fontWeight: "700" 
  }
});
