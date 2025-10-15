// app/(tabs)/ajuda.tsx
import { Ionicons } from "@expo/vector-icons";
import * as Linking from "expo-linking";
import { Alert, Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

// 🔧 Ajuste estes dados para os seus canais reais
const SUPPORT = {
  whatsappE164: "5551989133934", // DDI 55 + DDD 51 + número
  whatsappMsg: "Olá! Preciso de ajuda no app Vou Carregar.",
  email: "suporte@voucarregar.com.br",
  phoneE164: "5551989133934",
  phoneDisplay: "(51) 9 8913-3934",
  helpCenterUrl: "https://app.voucarregar.com.br/ajuda", // opcional
  horario: "Seg–Sex, 08:00 às 18:00 (BRT)",
};

export default function Ajuda() {
  const insets = useSafeAreaInsets();

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
    // wa.me funciona mesmo sem o app instalado (abre no navegador)
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
    const url = `tel:${SUPPORT.phoneE164}`;
    openUrl(url);
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#f9fafb" }} edges={["top", "left", "right"]}>
      <View style={[styles.page, { paddingTop: (insets.top ?? 0) + 8 }]}>
        <Text style={styles.title}>🛟 Ajuda & Suporte</Text>
        <Text style={styles.subtitle}>Fale com a equipe Vou Carregar pelos canais abaixo.</Text>

        <View style={styles.card}>
          <View style={styles.row}>
            <Ionicons name="logo-whatsapp" size={22} color="#16a34a" />
            <View style={{ flex: 1 }}>
              <Text style={styles.itemTitle}>WhatsApp</Text>
              <Text style={styles.itemDesc}>Atendimento rápido pelo WhatsApp.</Text>
            </View>
            <TouchableOpacity style={[styles.btn, styles.btnWhats]} onPress={openWhatsApp}>
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
            <TouchableOpacity style={[styles.btn, styles.btnEmail]} onPress={openEmail}>
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
            <TouchableOpacity style={[styles.btn, styles.btnPhone]} onPress={callPhone}>
              <Text style={styles.btnText}>Ligar</Text>
            </TouchableOpacity>
          </View>

          
        </View>

        <View style={styles.note}>
          <Ionicons name="time-outline" size={18} color="#6b7280" />
          <Text style={styles.noteText}>Horário de atendimento: {SUPPORT.horario}</Text>
        </View>

        <View style={styles.tips}>
          <Text style={styles.tipsTitle}>Dicas para agilizar o atendimento</Text>
          <Text style={styles.tip}>• Envie prints da tela com o erro.</Text>
          <Text style={styles.tip}>• Informe seu CPF cadastrado e modelo do aparelho.</Text>
          <Text style={styles.tip}>• Descreva o passo a passo até o problema ocorrer.</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, padding: 16, backgroundColor: "#f9fafb" },
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
  btn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 12 },
  btnWhats: { backgroundColor: "#16a34a" },
  btnEmail: { backgroundColor: "#2563eb" },
  btnPhone: { backgroundColor: "#ea580c" },
  btnHelp: { backgroundColor: "#111827" },
  note: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 10,
  },
  noteText: { color: "#6b7280" },
  tips: {
    marginTop: 16,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  tipsTitle: { fontWeight: "800", color: "#111827", marginBottom: 6 },
  tip: { color: "#374151", marginBottom: 4 },
});
