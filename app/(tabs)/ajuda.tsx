// app/(tabs)/ajuda.tsx

import { Ionicons } from "@expo/vector-icons";
import * as Linking from "expo-linking";
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

/* ========================================================= */
/* CORES */
/* ========================================================= */

const COLORS = {
  primary: "#FACC15",
  primarySoft: "#FEF9C3",
  primaryBorder: "#FDE047",

  black: "#111827",
  text: "#111827",

  secondaryText: "#6B7280",
  mutedText: "#9CA3AF",

  background: "#F9FAFB",
  surface: "#FFFFFF",

  border: "#E5E7EB",

  whatsapp: "#16A34A",
};

/* ========================================================= */
/* SUPORTE */
/* ========================================================= */

const SUPPORT = {
  whatsappE164: "5551989133934",

  whatsappMsg:
    "Olá! Preciso de ajuda no app Meu Freteiro.",

  // Manter até existir um e-mail oficial @meufreteiro.com
  email: "contato@voucarregar.com.br",

  phoneE164: "5551989133934",

  phoneDisplay: "(51) 9 8913-3934",

  helpCenterUrl: "https://www.meufreteiro.com/ajuda",

  horario: "Seg–Sex, 08:00 às 18:00 (BRT)",
};

/* ========================================================= */
/* COMPONENTE */
/* ========================================================= */

export default function Ajuda() {
  const insets = useSafeAreaInsets();

  /* ======================================================= */
  /* ABRIR URL */
/* ======================================================= */

  async function openUrl(url: string) {
    try {
      const can = await Linking.canOpenURL(url);

      if (!can) {
        throw new Error("URL não suportada");
      }

      await Linking.openURL(url);
    } catch {
      Alert.alert(
        "Não foi possível abrir",
        "Tente novamente mais tarde."
      );
    }
  }

  /* ======================================================= */
  /* WHATSAPP */
/* ======================================================= */

  function openWhatsApp() {
    const text = encodeURIComponent(SUPPORT.whatsappMsg);

    const url =
      `https://wa.me/${SUPPORT.whatsappE164}?text=${text}`;

    openUrl(url);
  }

  /* ======================================================= */
  /* E-MAIL */
/* ======================================================= */

  function openEmail() {
    const subject = encodeURIComponent(
      "Suporte • App Meu Freteiro"
    );

    const body = encodeURIComponent(
      [
        "Olá! Preciso de ajuda com o Meu Freteiro.",
        "",
        "Descreva seu problema aqui:",
        "",
        "",
        "—",
        `Sistema: ${Platform.OS}`,
      ].join("\n")
    );

    const url =
      `mailto:${SUPPORT.email}?subject=${subject}&body=${body}`;

    openUrl(url);
  }

  /* ======================================================= */
  /* TELEFONE */
/* ======================================================= */

  function callPhone() {
    const url = `tel:${SUPPORT.phoneE164}`;

    openUrl(url);
  }

  /* ======================================================= */
  /* TELA */
/* ======================================================= */

  return (
    <SafeAreaView
      style={styles.safeArea}
      edges={["top", "left", "right"]}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.page,
          {
            paddingTop: (insets.top ?? 0) + 8,
          },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ================================================= */}
        {/* CABEÇALHO */}
        {/* ================================================= */}

        <View style={styles.header}>
          <View style={styles.headerIcon}>
            <Ionicons
              name="help-buoy-outline"
              size={25}
              color={COLORS.black}
            />
          </View>

          <View style={styles.headerContent}>
            <Text style={styles.title}>
              Ajuda & Suporte
            </Text>

            <Text style={styles.subtitle}>
              Fale com a equipe Meu Freteiro pelos canais
              abaixo.
            </Text>
          </View>
        </View>

        {/* ================================================= */}
        {/* CONTATOS */}
        {/* ================================================= */}

        <View style={styles.card}>
          {/* WHATSAPP */}

          <View style={styles.row}>
            <View style={styles.contactIcon}>
              <Ionicons
                name="logo-whatsapp"
                size={23}
                color={COLORS.whatsapp}
              />
            </View>

            <View style={styles.rowContent}>
              <Text style={styles.itemTitle}>
                WhatsApp
              </Text>

              <Text style={styles.itemDesc}>
                Atendimento rápido pelo WhatsApp.
              </Text>
            </View>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={openWhatsApp}
              activeOpacity={0.85}
            >
              <Text style={styles.actionButtonText}>
                Abrir
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.divider} />

          {/* E-MAIL */}

          <View style={styles.row}>
            <View style={styles.contactIcon}>
              <Ionicons
                name="mail-outline"
                size={23}
                color={COLORS.black}
              />
            </View>

            <View style={styles.rowContent}>
              <Text style={styles.itemTitle}>
                E-mail
              </Text>

              <Text
                style={styles.itemDesc}
                numberOfLines={1}
              >
                {SUPPORT.email}
              </Text>
            </View>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={openEmail}
              activeOpacity={0.85}
            >
              <Text style={styles.actionButtonText}>
                Enviar
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.divider} />

          {/* TELEFONE */}

          <View style={styles.row}>
            <View style={styles.contactIcon}>
              <Ionicons
                name="call-outline"
                size={23}
                color={COLORS.black}
              />
            </View>

            <View style={styles.rowContent}>
              <Text style={styles.itemTitle}>
                Telefone
              </Text>

              <Text style={styles.itemDesc}>
                {SUPPORT.phoneDisplay}
              </Text>
            </View>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={callPhone}
              activeOpacity={0.85}
            >
              <Text style={styles.actionButtonText}>
                Ligar
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ================================================= */}
        {/* HORÁRIO */}
        {/* ================================================= */}

        <View style={styles.note}>
          <View style={styles.noteIcon}>
            <Ionicons
              name="time-outline"
              size={19}
              color={COLORS.black}
            />
          </View>

          <View style={styles.noteContent}>
            <Text style={styles.noteTitle}>
              Horário de atendimento
            </Text>

            <Text style={styles.noteText}>
              {SUPPORT.horario}
            </Text>
          </View>
        </View>

        {/* ================================================= */}
        {/* DICAS */}
        {/* ================================================= */}

        <View style={styles.tips}>
          <View style={styles.tipsHeader}>
            <View style={styles.tipsIcon}>
              <Ionicons
                name="bulb-outline"
                size={20}
                color={COLORS.black}
              />
            </View>

            <Text style={styles.tipsTitle}>
              Dicas para agilizar o atendimento
            </Text>
          </View>

          <View style={styles.tipRow}>
            <Ionicons
              name="checkmark-circle-outline"
              size={18}
              color={COLORS.black}
            />

            <Text style={styles.tip}>
              Envie prints da tela quando houver uma mensagem
              de erro.
            </Text>
          </View>

          <View style={styles.tipRow}>
            <Ionicons
              name="checkmark-circle-outline"
              size={18}
              color={COLORS.black}
            />

            <Text style={styles.tip}>
              Informe seu CPF cadastrado e o modelo do
              aparelho.
            </Text>
          </View>

          <View style={styles.tipRow}>
            <Ionicons
              name="checkmark-circle-outline"
              size={18}
              color={COLORS.black}
            />

            <Text style={styles.tip}>
              Descreva o passo a passo realizado até o
              problema acontecer.
            </Text>
          </View>
        </View>

        {/* ================================================= */}
        {/* AVISO */}
        {/* ================================================= */}

        <View style={styles.securityCard}>
          <Ionicons
            name="shield-checkmark-outline"
            size={21}
            color={COLORS.black}
          />

          <Text style={styles.securityText}>
            Para sua segurança, nunca envie sua senha durante
            um atendimento.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

/* ========================================================= */
/* ESTILOS */
/* ========================================================= */

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  scroll: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  page: {
    flexGrow: 1,
    paddingHorizontal: 18,
    paddingBottom: 32,
  },

  /* ======================================================= */
  /* CABEÇALHO */
  /* ======================================================= */

  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 18,
  },

  headerIcon: {
    width: 50,
    height: 50,

    borderRadius: 15,

    alignItems: "center",
    justifyContent: "center",

    backgroundColor: COLORS.primary,
  },

  headerContent: {
    flex: 1,
  },

  title: {
    fontSize: 23,
    fontWeight: "900",
    color: COLORS.text,
    letterSpacing: -0.3,
  },

  subtitle: {
    color: COLORS.secondaryText,
    marginTop: 3,
    fontSize: 13,
    lineHeight: 18,
  },

  /* ======================================================= */
  /* CARD DE CONTATOS */
  /* ======================================================= */

  card: {
    backgroundColor: COLORS.surface,

    borderRadius: 16,

    padding: 14,

    borderWidth: 1,
    borderColor: COLORS.border,
  },

  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },

  rowContent: {
    flex: 1,
    minWidth: 0,
  },

  contactIcon: {
    width: 42,
    height: 42,

    borderRadius: 12,

    backgroundColor: "#F9FAFB",

    alignItems: "center",
    justifyContent: "center",
  },

  divider: {
    height: 1,

    backgroundColor: COLORS.border,

    marginVertical: 12,
  },

  itemTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: COLORS.text,
  },

  itemDesc: {
    color: COLORS.secondaryText,

    marginTop: 2,

    fontSize: 12,
    lineHeight: 17,
  },

  /* ======================================================= */
  /* BOTÕES */
  /* ======================================================= */

  actionButton: {
    minWidth: 66,

    paddingHorizontal: 12,
    paddingVertical: 9,

    borderRadius: 9,

    alignItems: "center",
    justifyContent: "center",

    backgroundColor: COLORS.primary,
  },

  actionButtonText: {
    color: COLORS.black,

    fontWeight: "800",

    fontSize: 12,
  },

  /* ======================================================= */
  /* HORÁRIO */
  /* ======================================================= */

  note: {
    flexDirection: "row",
    alignItems: "center",

    gap: 11,

    marginTop: 14,

    padding: 14,

    borderRadius: 14,

    backgroundColor: COLORS.primarySoft,

    borderWidth: 1,
    borderColor: COLORS.primaryBorder,
  },

  noteIcon: {
    width: 38,
    height: 38,

    borderRadius: 11,

    backgroundColor: COLORS.primary,

    alignItems: "center",
    justifyContent: "center",
  },

  noteContent: {
    flex: 1,
  },

  noteTitle: {
    color: COLORS.black,

    fontSize: 13,
    fontWeight: "800",
  },

  noteText: {
    color: "#4B5563",

    fontSize: 12,

    marginTop: 2,
  },

  /* ======================================================= */
  /* DICAS */
  /* ======================================================= */

  tips: {
    marginTop: 14,

    backgroundColor: COLORS.surface,

    borderRadius: 16,

    padding: 14,

    borderWidth: 1,
    borderColor: COLORS.border,
  },

  tipsHeader: {
    flexDirection: "row",
    alignItems: "center",

    gap: 9,

    marginBottom: 12,
  },

  tipsIcon: {
    width: 34,
    height: 34,

    borderRadius: 10,

    backgroundColor: COLORS.primarySoft,

    alignItems: "center",
    justifyContent: "center",
  },

  tipsTitle: {
    flex: 1,

    fontSize: 14,
    fontWeight: "800",

    color: COLORS.text,
  },

  tipRow: {
    flexDirection: "row",
    alignItems: "flex-start",

    gap: 8,

    marginBottom: 9,
  },

  tip: {
    flex: 1,

    color: "#374151",

    fontSize: 13,
    lineHeight: 19,
  },

  /* ======================================================= */
  /* SEGURANÇA */
  /* ======================================================= */

  securityCard: {
    flexDirection: "row",
    alignItems: "flex-start",

    gap: 9,

    marginTop: 14,

    paddingHorizontal: 12,
    paddingVertical: 11,

    borderRadius: 12,

    backgroundColor: "#FFFFFF",

    borderWidth: 1,
    borderColor: COLORS.border,
  },

  securityText: {
    flex: 1,

    color: COLORS.secondaryText,

    fontSize: 12,
    lineHeight: 18,
  },
});