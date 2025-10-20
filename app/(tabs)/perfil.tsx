// app/(tabs)/perfil.tsx
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
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
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

  async function limparSessao() {
    if (Platform.OS !== "web") {
      await SecureStore.deleteItemAsync("authToken");
      await SecureStore.deleteItemAsync("userRole");
      await SecureStore.deleteItemAsync("userId");
    }
  }

  async function sair() {
    await limparSessao();
    Alert.alert("Até logo!", "Você saiu da sua conta.");
    router.replace("/"); // volta pro login
  }

  async function excluirContaConfirmada() {
    try {
      setExcluindo(true);

      const [token, userId, userRole] = await Promise.all([
        Platform.OS === "web" ? null : SecureStore.getItemAsync("authToken"),
        Platform.OS === "web" ? null : SecureStore.getItemAsync("userId"),
        Platform.OS === "web" ? null : SecureStore.getItemAsync("userRole"),
      ]);

      if (!token || !userId) {
        Alert.alert("Sessão expirada", "Faça login novamente para excluir a conta.");
        return;
      }

      // Por padrão, este app é do caminhoneiro
      const tipo = (userRole || "caminhoneiro") as "caminhoneiro" | "empresa";

      const res = await fetch(`${API_BASE}/api/account`, {
        method: "DELETE",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
          "x-auth-tipo": tipo,
          "x-auth-id": userId,
        },
      });

      if (!res.ok) {
        const msg = await res.json().catch(() => ({}));
        throw new Error(msg?.error || "Falha ao excluir a conta.");
      }

      await limparSessao();

      Alert.alert(
        "Conta excluída",
        "Sua conta foi excluída com sucesso. Sentiremos sua falta!",
        [{ text: "OK", onPress: () => router.replace("/") }]
      );
    } catch (e: any) {
      console.error("Excluir conta:", e?.message || e);
      Alert.alert("Erro", e?.message || "Não foi possível excluir sua conta agora.");
    } finally {
      setExcluindo(false);
    }
  }

  function excluirConta() {
    Alert.alert(
      "Excluir conta",
      "Esta ação é permanente e não pode ser desfeita. Seus dados de conta serão removidos. Alguns registros mínimos podem ser retidos apenas para cumprimento de obrigações legais (por exemplo, documentos fiscais), mas seus dados pessoais de perfil serão excluídos/anonimizados.\n\nDeseja continuar?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Excluir definitivamente",
          style: "destructive",
          onPress: excluirContaConfirmada,
        },
      ]
    );
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

        {/* Selo de privacidade */}
        <TouchableOpacity
          onPress={() => router.push("/politica-privacidade")}
          activeOpacity={0.9}
          style={styles.privacyTag}
          accessibilityRole="link"
          accessibilityLabel="Abrir Política de Privacidade"
        >
          <Text style={styles.privacyTagText}>🔒 Seus dados estão seguros na Vou Carregar</Text>
        </TouchableOpacity>

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

          <View style={{ marginTop: 12, gap: 8 }}>
            {/* Excluir conta */}
            <TouchableOpacity
              style={[styles.btnExcluir, excluindo && styles.btnDisabled]}
              onPress={excluirConta}
              activeOpacity={0.9}
              disabled={excluindo}
              accessibilityRole="button"
              accessibilityLabel="Excluir conta"
            >
              {excluindo ? (
                <ActivityIndicator />
              ) : (
                <Text style={styles.btnExcluirText}>Excluir conta</Text>
              )}
            </TouchableOpacity>

            {/* Sair */}
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

  title: { fontSize: 20, fontWeight: "800", color: "#111827", marginBottom: 8 },

  privacyTag: {
    alignSelf: "flex-start",
    backgroundColor: "#ecfeff",
    borderColor: "#a5f3fc",
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    marginBottom: 12,
  },
  privacyTagText: { color: "#0e7490", fontWeight: "800", fontSize: 12 },

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

  btnExcluir: {
    backgroundColor: "#fff",
    borderWidth: 2,
    borderColor: "#ef4444",
    paddingVertical: 12,
    alignItems: "center",
    borderRadius: 10,
  },
  btnExcluirText: { color: "#ef4444", fontWeight: "800" },

  btnDisabled: {
    opacity: 0.6,
  },

  btnSair: {
    backgroundColor: "#ef4444",
    paddingVertical: 12,
    alignItems: "center",
    borderRadius: 10,
  },
  btnSairText: { color: "#fff", fontWeight: "800" },
});
