// app/(tabs)/perfil.tsx
import * as Linking from "expo-linking";
import { useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

const API_BASE = "https://app.voucarregar.com.br";

type CaminhoneiroDados = {
  nome: string;
  cpf: string;
  email: string;
  telefone: string;
  cidade: string;
  estado: string;
  bairro: string;
  rua: string;
  cep: string;
  cnh: string;
  aceitaWhatsapp: boolean;
  status: string;
};

const VAZIO: CaminhoneiroDados = {
  nome: "",
  cpf: "",
  email: "",
  telefone: "",
  cidade: "",
  estado: "",
  bairro: "",
  rua: "",
  cep: "",
  cnh: "",
  aceitaWhatsapp: false,
  status: "",
};

function maskCPF(v = "") {
  return v
    .replace(/\D/g, "")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2}).*/, "$1-$2");
}

function maskPhone(v = "") {
  const d = v.replace(/\D/g, "");
  if (d.length <= 10) return d.replace(/(\d{2})(\d{4})(\d{0,4}).*/, "($1) $2-$3").trim();
  return d.replace(/(\d{2})(\d{5})(\d{0,4}).*/, "($1) $2-$3").trim();
}

export default function Perfil() {
  const router = useRouter();
  const insets = useSafeAreaInsets(); // 👈 safe area

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [erro, setErro] = useState("");
  const [dados, setDados] = useState<CaminhoneiroDados>(VAZIO);

  const carregar = useCallback(async () => {
    setErro("");
    setLoading(true);

    try {
      const [token, userId] = await Promise.all([
        Platform.OS === "web" ? null : SecureStore.getItemAsync("authToken"),
        Platform.OS === "web" ? null : SecureStore.getItemAsync("userId"),
      ]);

      if (!token) {
        setErro("Sessão expirada. Faça login novamente.");
        return;
      }

      const tryFetch = async (url: string) => {
        const res = await fetch(url, {
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
          },
        });
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        return (await res.json()) as Partial<CaminhoneiroDados>;
      };

      let perfil: Partial<CaminhoneiroDados> | null = null;
      const urls: string[] = [`${API_BASE}/api/caminhoneiro/me`, `${API_BASE}/api/mobile/me`];
      if (userId) urls.push(`${API_BASE}/api/caminhoneiro/${userId}`);

      for (const u of urls) {
        try {
          perfil = await tryFetch(u);
          break;
        } catch {
          // tenta próxima
        }
      }

      if (!perfil) throw new Error("Não foi possível obter os dados do perfil.");

      setDados({
        ...VAZIO,
        ...perfil,
        aceitaWhatsapp: Boolean(perfil.aceitaWhatsapp),
      });
    } catch (e: any) {
      console.error("Perfil:", e?.message || e);
      setErro("Não foi possível carregar seus dados agora.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await carregar();
    setRefreshing(false);
  }, [carregar]);

  async function sair() {
    if (Platform.OS !== "web") {
      await SecureStore.deleteItemAsync("authToken");
      await SecureStore.deleteItemAsync("userRole");
      await SecureStore.deleteItemAsync("userId");
    }
    Alert.alert("Até logo!", "Você saiu da sua conta.");
    router.replace("/"); // volta pro login
  }

  async function abrirCNH() {
    if (!dados.cnh) {
      Alert.alert("Documento", "CNH não enviada.");
      return;
    }
    const url = dados.cnh;
    const can = await Linking.canOpenURL(url);
    if (can) Linking.openURL(url);
    else Alert.alert("Documento", "Não foi possível abrir o documento.");
  }

  if (loading) {
    return (
      <SafeAreaView style={[styles.center, { paddingTop: (insets.top ?? 0) + 8 }]} edges={["top", "left", "right"]}>
        <ActivityIndicator size="large" />
        <Text style={{ marginTop: 8 }}>Carregando seu perfil…</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <ScrollView
        style={styles.page}
        contentContainerStyle={{ padding: 16, paddingTop: (insets.top ?? 0) + 8 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentInsetAdjustmentBehavior="automatic"
      >
        <Text style={styles.title}>👤 Meu Perfil</Text>

        {!!erro && (
          <View style={styles.alert}>
            <Text style={styles.alertText}>{erro}</Text>
          </View>
        )}

        <View style={styles.card}>
          <Linha rotulo="Nome" valor={dados.nome || "—"} forte />
          <Linha rotulo="E-mail" valor={dados.email || "—"} />
          <Linha rotulo="CPF" valor={dados.cpf ? maskCPF(dados.cpf) : "—"} />
          <Linha rotulo="Telefone" valor={dados.telefone ? maskPhone(dados.telefone) : "—"} />
          <Linha rotulo="Endereço" valor={formatEndereco(dados)} />
          <Linha rotulo="CEP" valor={dados.cep || "—"} />
          <Linha rotulo="Aceita WhatsApp" valor={dados.aceitaWhatsapp ? "Sim" : "Não"} />
          <Linha rotulo="Status" valor={dados.status || "—"} />

          <View style={{ marginTop: 12, gap: 8 }}>
            <TouchableOpacity style={styles.btnDoc} onPress={abrirCNH} activeOpacity={0.9}>
              <Text style={styles.btnDocText}>📄 Visualizar CNH</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.btnSair} onPress={sair} activeOpacity={0.9}>
              <Text style={styles.btnSairText}>Sair</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Linha({ rotulo, valor, forte = false }: { rotulo: string; valor: string; forte?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{rotulo}</Text>
      <Text style={[styles.value, forte && styles.valueStrong]} numberOfLines={2}>
        {valor || "—"}
      </Text>
    </View>
  );
}

function formatEndereco(d: CaminhoneiroDados) {
  const partes = [d.rua, d.bairro, d.cidade && `${d.cidade} - ${d.estado}`].filter(Boolean);
  return partes.length ? partes.join(", ") : "—";
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f9fafb" },
  page: { flex: 1, backgroundColor: "#f9fafb" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#f9fafb" },

  title: { fontSize: 20, fontWeight: "800", color: "#111827", marginBottom: 12 },

  alert: {
    backgroundColor: "#fee2e2",
    borderColor: "#fecaca",
    borderWidth: 1,
    padding: 10,
    borderRadius: 10,
    marginBottom: 10,
  },
  alertText: { color: "#b91c1c", fontWeight: "700", textAlign: "center" },

  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },

  row: { marginBottom: 10 },
  label: { fontSize: 12, color: "#6b7280", marginBottom: 2, fontWeight: "600" },
  value: { fontSize: 15, color: "#111827" },
  valueStrong: { fontWeight: "800" },

  btnDoc: {
    backgroundColor: "#1f2937",
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 10,
  },
  btnDocText: { color: "#fff", fontWeight: "800" },

  btnSair: {
    backgroundColor: "#ef4444",
    paddingVertical: 12,
    alignItems: "center",
    borderRadius: 10,
  },
  btnSairText: { color: "#fff", fontWeight: "800" },
});
