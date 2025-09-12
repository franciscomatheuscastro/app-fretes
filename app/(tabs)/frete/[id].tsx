// app/frete/[id].tsx
import * as Linking from "expo-linking";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store"; // ⬅️ adicionar
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const API_BASE = "https://app.voucarregar.com.br";
const WEB_BASE: string | null = null;

type Frete = {
  id: string;
  cidadeColeta: string;
  cidadeEntrega: string;
  dataColeta?: string | null;
  dataEntrega?: string | null;
  tipoCarga: string;
  produto: string;
  precisaRastreador: boolean;
  pesoTotal: number;
  valorFrete: number;
  observacoes?: string | null;
  referenciaCliente?: string | null;
  veiculos: string[];
  carrocerias: string[];
  unidadePeso?: "kg" | "toneladas";
  empresa?: {
    nome?: string;
    telefone?: string | null;
    aceitaWhatsapp?: boolean | null;
    logo?: string | null;
  };
  colaborador?: { whatsapp?: string | null } | null;
};

export default function FreteDetalheScreen() {
  const router = useRouter();
  const { id: rawId } = useLocalSearchParams<{ id?: string | string[] }>();
  const id = Array.isArray(rawId) ? rawId[0] ?? "" : rawId ?? "";

  const [frete, setFrete] = useState<Frete | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        if (!id) throw new Error("ID inválido");

        const token = await SecureStore.getItemAsync("authToken");

        const fetchDetalhe = async (useAuth: boolean) => {
          const res = await fetch(
            `${API_BASE}/api/fretes/${encodeURIComponent(id)}`,
            {
              headers: {
                Accept: "application/json",
                "User-Agent": "VouCarregarApp/1.0",
                ...(useAuth && token ? { Authorization: `Bearer ${token}` } : {}),
              },
            }
          );
          if (!res.ok) {
            const text = await res.text().catch(() => "");
            throw new Error(`DETALHE ${res.status} ${res.statusText} ${text}`);
          }
          return (await res.json()) as Frete;
        };

        let data: Frete;
        try {
          data = await fetchDetalhe(true);
        } catch (eAuth) {
          console.warn("Falha com token, tentando público:", String(eAuth));
          data = await fetchDetalhe(false);
        }

        if (mounted) setFrete(data);
      } catch (e: any) {
        console.error("Erro ao carregar frete:", e?.message || e);
        const msg = String(e?.message || "");
        if (mounted)
          setErro(msg.includes("404") ? "Frete não encontrado." : "Erro ao carregar frete.");
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [id]);

  function formatBRL(v: number) {
    return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }

  async function abrirWhatsApp() {
    if (!frete) return;
    const numeroRaw = frete.colaborador?.whatsapp ?? frete.empresa?.telefone ?? "";
    const numero = typeof numeroRaw === "string" ? numeroRaw.replace(/\D/g, "") : "";
    if (!numero) {
      Alert.alert("WhatsApp não disponível", "Nenhum contato cadastrado.");
      return;
    }

    const origem = (frete.cidadeColeta || "").split(" - ")[0] || frete.cidadeColeta;
    const destino = (frete.cidadeEntrega || "").split(" - ")[0] || frete.cidadeEntrega;
    const webBaseNormalized =
      typeof WEB_BASE === "string" && WEB_BASE.length > 0 ? WEB_BASE.replace(/\/$/, "") : "";
    const linkFrete = webBaseNormalized ? `${webBaseNormalized}/fretes/${frete.id}` : "";
    const mensagem = `Olá, vi seu frete no Vou Carregar! ${origem} x ${destino}${
      linkFrete ? `, link: ${linkFrete}` : ""
    }\nPodemos conversar?`;

    const url = `https://wa.me/55${numero}?text=${encodeURIComponent(mensagem)}`;
    const supported = await Linking.canOpenURL(url);
    if (supported) Linking.openURL(url);
    else Alert.alert("Erro", "Não foi possível abrir o WhatsApp.");
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
        <Text style={{ marginTop: 8 }}>Carregando frete...</Text>
      </View>
    );
  }

  if (erro || !frete) {
    return (
      <View style={styles.center}>
        <Text style={{ color: "#b91c1c", marginBottom: 12 }}>{erro || "Frete não encontrado"}</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.btnSecondary}>
          <Text style={styles.btnSecondaryText}>Voltar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const valorTxt =
    frete.valorFrete === -1
      ? "A combinar"
      : `${formatBRL(frete.valorFrete)}${frete.unidadePeso === "toneladas" ? " por tonelada" : ""}`;

  return (
    <ScrollView style={styles.page} contentContainerStyle={{ padding: 16 }}>
      <View style={styles.card}>
        <Text style={styles.title}>🚚 Detalhes do Frete</Text>

        <View style={styles.row}>
          <View style={styles.col}>
            <Text style={styles.label}>Origem</Text>
            <Text style={styles.value}>{frete.cidadeColeta}</Text>
          </View>
          <View style={styles.col}>
            <Text style={styles.label}>Destino</Text>
            <Text style={styles.value}>{frete.cidadeEntrega}</Text>
          </View>
        </View>

        <View style={styles.row}>
          <View style={styles.col}>
            <Text style={styles.label}>Produto</Text>
            <Text style={styles.value}>{frete.produto || "N/A"}</Text>
          </View>
          <View style={styles.col}>
            <Text style={styles.label}>Tipo de Carga</Text>
            <Text style={styles.value}>{frete.tipoCarga || "N/A"}</Text>
          </View>
        </View>

        <View style={styles.row}>
          <View style={styles.col}>
            <Text style={styles.label}>Peso Total</Text>
            <Text style={styles.value}>
              {frete.pesoTotal} {frete.unidadePeso === "toneladas" ? "toneladas" : "kg"}
            </Text>
          </View>
          <View style={styles.col}>
            <Text style={styles.label}>Rastreamento</Text>
            <Text style={styles.value}>{frete.precisaRastreador ? "Sim" : "Não"}</Text>
          </View>
        </View>

        <View style={styles.row}>
          <View style={styles.col}>
            <Text style={styles.label}>Valor do Frete</Text>
            <Text style={[styles.value, styles.price]}>{valorTxt}</Text>
          </View>
          <View style={styles.col}>
            <Text style={styles.label}>Ref. Cliente</Text>
            <Text style={styles.value}>{frete.referenciaCliente || "N/A"}</Text>
          </View>
        </View>

        <View style={{ marginTop: 10 }}>
          <Text style={styles.label}>Veículos</Text>
          <Text style={styles.value}>
            {frete.veiculos?.length ? frete.veiculos.join(", ") : "N/A"}
          </Text>
        </View>
        <View style={{ marginTop: 10 }}>
          <Text style={styles.label}>Carrocerias</Text>
          <Text style={styles.value}>
            {frete.carrocerias?.length ? frete.carrocerias.join(", ") : "N/A"}
          </Text>
        </View>

        <View style={styles.row}>
          <View style={styles.col}>
            <Text style={styles.label}>Data Coleta</Text>
            <Text style={styles.value}>
              {frete.dataColeta
                ? new Date(frete.dataColeta).toLocaleDateString("pt-BR")
                : "N/A"}
            </Text>
          </View>
          <View style={styles.col}>
            <Text style={styles.label}>Data Entrega</Text>
            <Text style={styles.value}>
              {frete.dataEntrega
                ? new Date(frete.dataEntrega).toLocaleDateString("pt-BR")
                : "N/A"}
            </Text>
          </View>
        </View>

        <View style={{ marginTop: 10 }}>
          <Text style={styles.label}>Observações</Text>
          <Text style={styles.value}>{frete.observacoes || "N/A"}</Text>
        </View>

        <View style={styles.transportadora}>
          <View style={{ flex: 1 }}>
            <Text style={styles.transportTitle}>Transportadora</Text>
            <Text style={styles.value}>
              <Text style={styles.labelInline}>Nome: </Text>
              {frete.empresa?.nome || "—"}
            </Text>
            <Text style={styles.value}>
              <Text style={styles.labelInline}>WhatsApp/Telefone: </Text>
              {frete.colaborador?.whatsapp || frete.empresa?.telefone || "—"}
            </Text>

            <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
              <TouchableOpacity
                style={styles.btnPrimary}
                onPress={abrirWhatsApp}
                activeOpacity={0.85}
              >
                <Text style={styles.btnPrimaryText}>Contatar via WhatsApp</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.btnSecondary}
                onPress={() => router.back()}
                activeOpacity={0.85}
              >
                <Text style={styles.btnSecondaryText}>Voltar</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={{ width: 120, alignItems: "center" }}>
            {frete.empresa?.logo ? (
              <Image
                source={{ uri: frete.empresa.logo }}
                style={styles.logo}
                resizeMode="contain"
              />
            ) : (
              <View style={styles.logoPlaceholder}>
                <Text style={{ color: "#9ca3af" }}>Sem logo</Text>
              </View>
            )}
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#f3f4f6" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 16 },
  card: { backgroundColor: "#fff", borderRadius: 12, padding: 16, borderWidth: 1, borderColor: "#e5e7eb" },
  title: { fontSize: 22, fontWeight: "800", marginBottom: 12, color: "#111827", textAlign: "center" },
  row: { flexDirection: "row", gap: 12, marginTop: 8 },
  col: { flex: 1 },
  label: { fontSize: 12, color: "#374151", marginBottom: 4, fontWeight: "600" },
  labelInline: { fontWeight: "700", color: "#374151" },
  value: { fontSize: 14, color: "#111827" },
  price: { color: "#16a34a", fontWeight: "800" },
  transportadora: {
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    paddingTop: 12,
    flexDirection: "row",
    gap: 12,
  },
  transportTitle: { fontSize: 16, fontWeight: "700", color: "#111827", marginBottom: 6 },
  btnPrimary: { backgroundColor: "#16a34a", paddingHorizontal: 12, paddingVertical: 10, borderRadius: 8 },
  btnPrimaryText: { color: "#fff", fontWeight: "800" },
  btnSecondary: { backgroundColor: "#e5e7eb", paddingHorizontal: 12, paddingVertical: 10, borderRadius: 8 },
  btnSecondaryText: { color: "#111827", fontWeight: "800" },
  logo: { width: 120, height: 80, borderRadius: 8, borderWidth: 1, borderColor: "#e5e7eb", backgroundColor: "#fff" },
  logoPlaceholder: {
    width: 120,
    height: 80,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "#f9fafb",
    alignItems: "center",
    justifyContent: "center",
  },
});
