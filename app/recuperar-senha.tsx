// app/recuperar-senha.tsx
import { Stack, useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

const API_BASE = "https://app.voucarregar.com.br";

export default function RecuperarSenha() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  function isEmail(v: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
  }

  async function solicitar() {
    const mail = email.trim();
    if (!isEmail(mail)) {
      Alert.alert("Atenção", "Informe um e-mail válido.");
      return;
    }

    setLoading(true);
    try {
      const url = `${API_BASE}/api/esqueci-senha`;

      // 1) POST JSON — mesma lógica do Next
      let resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ email: mail }),
      });

      // 2) Fallback (alguns backends só aceitam form-urlencoded)
      if (!resp.ok && resp.status === 405) {
        resp = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Accept: "application/json",
          },
          body: `email=${encodeURIComponent(mail)}`,
        });
      }

      const raw = await resp.text().catch(() => "");
      let data: any = null;
      try { data = raw ? JSON.parse(raw) : null; } catch {}

      if (resp.ok) {
        Alert.alert(
          "Verifique seu e-mail",
          data?.message || "Se o e-mail estiver cadastrado, enviamos um link para redefinição de senha."
        );
        router.back();
      } else {
        const detalhe = data?.erro || data?.message || raw || `HTTP ${resp.status}`;
        Alert.alert("Não foi possível", detalhe);
      }
    } catch {
      Alert.alert("Erro", "Falha ao solicitar redefinição. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }} edges={["top", "left", "right"]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <Stack.Screen options={{ headerShown: false }} />
        <View style={[styles.wrap, { paddingTop: (insets.top ?? 0) + 8 }]}>
          <Text style={styles.title}>Recuperar senha</Text>
          <Text style={styles.sub}>
            Informe seu e-mail. Enviaremos um link para redefinição no sistema.
          </Text>

          <TextInput
            placeholder="E-mail"
            placeholderTextColor="#9ca3af"
            style={styles.input}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            value={email}
            onChangeText={setEmail}
            editable={!loading}
          />

          <TouchableOpacity style={styles.button} onPress={solicitar} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Enviar link</Text>}
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 12 }}>
            <Text style={{ color: "#111827" }}>Voltar</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, padding: 20, gap: 10, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 20, fontWeight: "800", color: "#111827" },
  sub: { color: "#6b7280", marginBottom: 6, textAlign: "center" },
  input: {
    width: "100%",
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 48,
    color: "#111827",
  },
  button: {
    width: "100%",
    height: 48,
    backgroundColor: "#ea580c",
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 6,
  },
  buttonText: { color: "#fff", fontWeight: "700" },
});
