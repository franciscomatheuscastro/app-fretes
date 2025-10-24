// app/ajuda.tsx  (ROTA PÚBLICA)
import { Ionicons } from "@expo/vector-icons";
import * as Linking from "expo-linking";
import { useRouter } from "expo-router";
import { Alert, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

const SUPPORT = {
  whatsappE164: "5551989133934",
  whatsappMsg: "Olá! Preciso de ajuda no app Vou Carregar.",
  email: "contato@voucarregar.com.br",
  phoneE164: "5551989133934",
  phoneDisplay: "(51) 9 8913-3934",
  helpCenterUrl: "https://app.voucarregar.com.br/ajuda",
  horario: "Seg–Sex, 08:00 às 18:00 (BRT)",
};

export default function AjudaPublica() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const goBack = () => {
    try {
      if ((router as any).canGoBack?.()) router.back();
      else router.replace("/");
    } catch {
      router.replace("/");
    }
  };

  async function openUrl(url: string) {
    try {
      const can = await Linking.canOpenURL(url);
      if (!can) throw new Error("URL não suportada");
      await Linking.openURL(url);
    } catch {
      Alert.alert("Não foi possível abrir", "Tente novamente mais tarde.");
    }
  }

  function openWhatsApp() {
    const text = encodeURIComponent(SUPPORT.whatsappMsg);
    const url = `https://wa.me/${SUPPORT.whatsappE164}?text=${text}`;
    openUrl(url);
  }

  function openEmail() {
    const subject = encodeURIComponent("Suporte • App Vou Carregar");
    const body = encodeURIComponent(
      ["Descreva seu problema aqui.", "", "—", `Sistema: ${Platform.OS}`].join("\n")
    );
    const url = `mailto:${SUPPORT.email}?subject=${subject}&body=${body}`;
    openUrl(url);
  }

  function callPhone() {
    openUrl(`tel:${SUPPORT.phoneE164}`);
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#f9fafb" }} edges={["top", "left", "right"]}>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: (insets.top ?? 0) + 8, paddingBottom: 28 }}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>🛟 Ajuda & Suporte</Text>
        <Text style={styles.subtitle}>Fale com a equipe Vou Carregar pelos canais abaixo.</Text>

        <View style={styles.card}>
          <View style={styles.row}>
            <Ionicons name="logo-whatsapp" size={22} color="#16a34a" />
            <View style={{ flex: 1 }}>
              <Text style={styles.itemTitle}>WhatsApp</Text>
              <Text style={styles.itemDesc}>Atendimento rápido pelo WhatsApp.</Text>
            </View>
            <TouchableOpacity style={[styles.btn, styles.btnWhats]} onPress={openWhatsApp} activeOpacity={0.9}>
              <Text style={styles.btnText}>Abrir</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.divider} />

          <View style={styles.row}>
            <Ionicons name="mail-outline" size={22} color="#2563eb" />
            <View style={{ flex: 1 }}>
              <Text style={styles.itemTitle}>E-mail</Text>
              <Text style={styles.itemDesc}>{SUPPORT.email}</Text>
            </View>
            <TouchableOpacity style={[styles.btn, styles.btnEmail]} onPress={openEmail} activeOpacity={0.9}>
              <Text style={styles.btnText}>Enviar</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.divider} />

          <View style={styles.row}>
            <Ionicons name="call-outline" size={22} color="#ea580c" />
            <View style={{ flex: 1 }}>
              <Text style={styles.itemTitle}>Telefone</Text>
              <Text style={styles.itemDesc}>{SUPPORT.phoneDisplay}</Text>
            </View>
            <TouchableOpacity style={[styles.btn, styles.btnPhone]} onPress={callPhone} activeOpacity={0.9}>
              <Text style={styles.btnText}>Ligar</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.note}>
          <Ionicons name="time-outline" size={18} color="#6b7280" />
          <Text style={styles.noteText}>Horário de atendimento: {SUPPORT.horario}</Text>
        </View>

        {/* Botão Voltar no rodapé (padronizado) */}
        <TouchableOpacity onPress={goBack} style={styles.backFooterBtn} activeOpacity={0.9}>
          <Ionicons name="chevron-back" size={18} color="#6b7280" />
          <Text style={styles.backFooterText}>Voltar</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 22, fontWeight: "800", color: "#111827" },
  subtitle: { color: "#6b7280", marginTop: 4, marginBottom: 12 },

  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    gap: 10,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  divider: { height: 1, backgroundColor: "#e5e7eb", marginVertical: 4 },
  itemTitle: { fontSize: 15, fontWeight: "700", color: "#111827" },
  itemDesc: { color: "#6b7280", marginTop: 2, fontSize: 12 },

  btn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 12 },
  btnWhats: { backgroundColor: "#16a34a" },
  btnEmail: { backgroundColor: "#2563eb" },
  btnPhone: { backgroundColor: "#ea580c" },

  note: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10 },
  noteText: { color: "#6b7280" },

  // Botão voltar no rodapé (igual padrão da política)
  backFooterBtn: {
    alignSelf: "center",
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  backFooterText: { color: "#6b7280", fontWeight: "600" },
});
