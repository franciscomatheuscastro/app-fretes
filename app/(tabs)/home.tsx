// app/(tabs)/home.tsx
import { useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import {
    ActivityIndicator,
    FlatList,
    Keyboard,
    KeyboardAvoidingView,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import * as Storage from "../backend/lib/storage"; // se o caminho for diferente, ajuste

const API_BASE = "https://app.voucarregar.com.br";

type Frete = {
  id: string;
  cidadeColeta: string;
  cidadeEntrega: string;
  produto: string;
  tipoCarga: string;
  pesoTotal: number;
  valorFrete: number;
  dataColeta?: string | null;
  dataEntrega?: string | null;
  unidadePeso?: "kg" | "toneladas";
};

export default function HomeScreen() {
  const router = useRouter();

  const [cidadeOrigem, setCidadeOrigem] = useState("");
  const [cidadeDestino, setCidadeDestino] = useState("");
  const [fretes, setFretes] = useState<Frete[]>([]);
  const [mensagem, setMensagem] = useState("");
  const [loading, setLoading] = useState(false);

  const buscarFretes = useCallback(async () => {
    setMensagem("");
    setFretes([]);

    const origem = cidadeOrigem.trim();
    const destino = cidadeDestino.trim();

    if (!origem) {
      setMensagem("Informe a cidade de origem.");
      return;
    }

    try {
      setLoading(true);
      Keyboard.dismiss();

      const qs = new URLSearchParams({ origem });
      if (destino) qs.append("destino", destino);

      const token = await Storage.getItem("authToken");
      const headers: Record<string, string> = {
        Accept: "application/json",
      };
      if (token) headers.Authorization = `Bearer ${token}`;

      const res = await fetch(`${API_BASE}/api/fretes/buscar?${qs.toString()}`, {
        method: "GET",
        headers,
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(txt || `Erro ${res.status}`);
      }

      const data = (await res.json()) as Frete[] | { error?: string };
      if (!Array.isArray(data)) {
        setMensagem((data as any)?.error || "Não foi possível carregar os fretes.");
        return;
      }

      setFretes(data);
      setMensagem(data.length ? "" : "Nenhum frete encontrado.");
    } catch (e: any) {
      console.warn(e);
      setMensagem("Erro ao buscar fretes. Verifique sua conexão e tente novamente.");
    } finally {
      setLoading(false);
    }
  }, [cidadeOrigem, cidadeDestino]);

  const limpar = useCallback(() => {
    setCidadeOrigem("");
    setCidadeDestino("");
    setFretes([]);
    setMensagem("");
  }, []);

  const renderItem = ({ item }: { item: Frete }) => {
    const preco =
      item.valorFrete === -1
        ? "A combinar"
        : (item.valorFrete ?? 0).toLocaleString("pt-BR", {
            style: "currency",
            currency: "BRL",
          });

    return (
      <View style={styles.card}>
        <View style={{ flex: 1, paddingRight: 10 }}>
          <Text style={styles.cardTitle} numberOfLines={1} ellipsizeMode="tail">
            {item.cidadeColeta} → {item.cidadeEntrega}
          </Text>
          <Text style={styles.cardSub} numberOfLines={2}>
            {item.tipoCarga} • {item.pesoTotal}{" "}
            {item.unidadePeso === "toneladas" ? "ton" : "kg"} • {item.produto}
          </Text>
        </View>

        <View style={{ alignItems: "flex-end" }}>
          <Text style={styles.price}>{preco}</Text>
          {item.valorFrete > 0 && item.unidadePeso === "toneladas" && (
            <Text style={styles.perTon}>por tonelada</Text>
          )}

          <TouchableOpacity
            style={styles.btn}
            activeOpacity={0.85}
            onPress={() => router.push(`/frete/${encodeURIComponent(String(item.id))}`)}
          >
            <Text style={styles.btnText}>Ver Frete</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: "#f9fafb" }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.page}>
        <Text style={styles.title}>
          🔍 Buscar <Text style={{ color: "#ea580c" }}>Fretes</Text>
        </Text>

        {/* Filtros simples */}
        <View style={styles.filters}>
          <View style={styles.inputCol}>
            <Text style={styles.label}>Origem *</Text>
            <TextInput
              placeholder="Ex: São Paulo"
              value={cidadeOrigem}
              onChangeText={setCidadeOrigem}
              autoCapitalize="words"
              autoCorrect={false}
              style={styles.input}
              placeholderTextColor="#9ca3af"
              returnKeyType="next"
            />
          </View>

          <View style={styles.inputCol}>
            <Text style={styles.label}>Destino (opcional)</Text>
            <TextInput
              placeholder="Ex: Belo Horizonte"
              value={cidadeDestino}
              onChangeText={setCidadeDestino}
              autoCapitalize="words"
              autoCorrect={false}
              style={styles.input}
              placeholderTextColor="#9ca3af"
              returnKeyType="search"
              onSubmitEditing={buscarFretes}
            />
          </View>

          <View style={styles.row}>
            <TouchableOpacity
              onPress={buscarFretes}
              style={[styles.actionBtn, { backgroundColor: "#16a34a" }]}
              activeOpacity={0.85}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.actionBtnText}>Buscar</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={limpar}
              style={[styles.actionBtn, { backgroundColor: "#e5e7eb" }]}
              activeOpacity={0.85}
              disabled={loading}
            >
              <Text style={[styles.actionBtnText, { color: "#111827" }]}>Limpar</Text>
            </TouchableOpacity>
          </View>

          {!!mensagem && <Text style={styles.feedback}>{mensagem}</Text>}
        </View>

        {/* Lista */}
        {fretes.length === 0 && !loading ? (
          <View style={styles.empty}>
            <Text style={{ color: "#6b7280" }}>
              Use os campos acima para procurar fretes.
            </Text>
          </View>
        ) : (
          <FlatList
            data={fretes}
            keyExtractor={(item) => String(item.id)}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 16 }}
            renderItem={renderItem}
          />
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, padding: 14, gap: 10 },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: "#111827",
    textAlign: "center",
    marginBottom: 6,
  },

  // filtros
  filters: {
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    padding: 12,
    gap: 8,
  },
  inputCol: { gap: 4 },
  label: { fontSize: 12, color: "#374151", fontWeight: "600" },
  input: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#111827",
    fontSize: 14,
  },
  row: { flexDirection: "row", gap: 8 },
  actionBtn: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  actionBtnText: { color: "#fff", fontWeight: "800" },

  feedback: { color: "#dc2626", textAlign: "center", marginTop: 2 },

  // lista
  empty: {
    flex: 1,
    minHeight: 120,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    marginTop: 8,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  cardTitle: { fontSize: 16, fontWeight: "700", color: "#111827" },
  cardSub: { color: "#4b5563", marginTop: 2 },
  price: { fontSize: 16, color: "#16a34a", fontWeight: "800", marginTop: 2 },
  perTon: { fontSize: 12, color: "#6b7280" },
  btn: {
    marginTop: 8,
    backgroundColor: "#2563eb",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  btnText: { color: "#fff", fontWeight: "800", fontSize: 12 },
});
