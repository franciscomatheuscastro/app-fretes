// app/ajuda.tsx
// ROTA PÚBLICA

import { Ionicons } from "@expo/vector-icons";
import * as Linking from "expo-linking";
import { useRouter } from "expo-router";
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

const COLORS = {
  primary: "#FACC15",
  primarySoft: "#FEF9C3",
  primaryBorder: "#FDE047",

  black: "#111827",
  text: "#111827",
  secondaryText: "#6B7280",

  background: "#F9FAFB",
  surface: "#FFFFFF",

  border: "#E5E7EB",

  whatsapp: "#16A34A",
  email: "#2563EB",
};

const SUPPORT = {
  whatsappE164:
    "5551989133934",

  whatsappMsg:
    "Olá! Preciso de ajuda no app Meu Freteiro.",

  // TODO:
  // alterar quando existir o e-mail oficial
  // @meufreteiro.com
  email:
    "contato@voucarregar.com.br",

  phoneE164:
    "5551989133934",

  phoneDisplay:
    "(51) 9 8913-3934",

  helpCenterUrl:
    "https://www.meufreteiro.com/ajuda",

  horario:
    "Seg–Sex, 08:00 às 18:00 (BRT)",
};

export default function AjudaPublica() {
  const insets =
    useSafeAreaInsets();

  const router =
    useRouter();

  function goBack() {
    try {
      if (
        (router as any).canGoBack?.()
      ) {
        router.back();
      } else {
        router.replace("/");
      }
    } catch {
      router.replace("/");
    }
  }

  async function openUrl(
    url: string
  ) {
    try {
      const can =
        await Linking.canOpenURL(
          url
        );

      if (!can) {
        throw new Error(
          "URL não suportada"
        );
      }

      await Linking.openURL(
        url
      );
    } catch {
      Alert.alert(
        "Não foi possível abrir",
        "Tente novamente mais tarde."
      );
    }
  }

  function openWhatsApp() {
    const text =
      encodeURIComponent(
        SUPPORT.whatsappMsg
      );

    const url =
      `https://wa.me/${SUPPORT.whatsappE164}?text=${text}`;

    openUrl(url);
  }

  function openEmail() {
    const subject =
      encodeURIComponent(
        "Suporte • App Meu Freteiro"
      );

    const body =
      encodeURIComponent(
        [
          "Descreva seu problema aqui.",
          "",
          "—",
          `Sistema: ${Platform.OS}`,
        ].join("\n")
      );

    const url =
      `mailto:${SUPPORT.email}?subject=${subject}&body=${body}`;

    openUrl(url);
  }

  function callPhone() {
    openUrl(
      `tel:${SUPPORT.phoneE164}`
    );
  }

  function openHelpCenter() {
    openUrl(
      SUPPORT.helpCenterUrl
    );
  }

  return (
    <SafeAreaView
      style={styles.safeArea}
      edges={[
        "top",
        "left",
        "right",
      ]}
    >
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingTop:
              (insets.top ?? 0) +
              8,
          },
        ]}
        showsVerticalScrollIndicator={
          false
        }
      >
        {/* HEADER */}

        <View style={styles.header}>
          <View
            style={
              styles.headerIcon
            }
          >
            <Ionicons
              name="help-buoy-outline"
              size={24}
              color={COLORS.black}
            />
          </View>

          <View style={{ flex: 1 }}>
            <Text
              style={styles.title}
            >
              Ajuda & Suporte
            </Text>

            <Text
              style={
                styles.subtitle
              }
            >
              Fale com a equipe Meu
              Freteiro pelos canais
              abaixo.
            </Text>
          </View>
        </View>

        {/* CONTATOS */}

        <View style={styles.card}>
          {/* WHATSAPP */}

          <View style={styles.row}>
            <View
              style={
                styles.contactIcon
              }
            >
              <Ionicons
                name="logo-whatsapp"
                size={22}
                color={
                  COLORS.whatsapp
                }
              />
            </View>

            <View
              style={
                styles.rowContent
              }
            >
              <Text
                style={
                  styles.itemTitle
                }
              >
                WhatsApp
              </Text>

              <Text
                style={
                  styles.itemDesc
                }
              >
                Atendimento rápido
                pelo WhatsApp.
              </Text>
            </View>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={
                openWhatsApp
              }
              activeOpacity={0.85}
            >
              <Text
                style={
                  styles.actionButtonText
                }
              >
                Abrir
              </Text>
            </TouchableOpacity>
          </View>

          <View
            style={styles.divider}
          />

          {/* EMAIL */}

          <View style={styles.row}>
            <View
              style={
                styles.contactIcon
              }
            >
              <Ionicons
                name="mail-outline"
                size={22}
                color={COLORS.black}
              />
            </View>

            <View
              style={
                styles.rowContent
              }
            >
              <Text
                style={
                  styles.itemTitle
                }
              >
                E-mail
              </Text>

              <Text
                style={
                  styles.itemDesc
                }
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
              <Text
                style={
                  styles.actionButtonText
                }
              >
                Enviar
              </Text>
            </TouchableOpacity>
          </View>

          <View
            style={styles.divider}
          />

          {/* TELEFONE */}

          <View style={styles.row}>
            <View
              style={
                styles.contactIcon
              }
            >
              <Ionicons
                name="call-outline"
                size={22}
                color={COLORS.black}
              />
            </View>

            <View
              style={
                styles.rowContent
              }
            >
              <Text
                style={
                  styles.itemTitle
                }
              >
                Telefone
              </Text>

              <Text
                style={
                  styles.itemDesc
                }
              >
                {SUPPORT.phoneDisplay}
              </Text>
            </View>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={callPhone}
              activeOpacity={0.85}
            >
              <Text
                style={
                  styles.actionButtonText
                }
              >
                Ligar
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* HORÁRIO */}

        <View style={styles.note}>
          <Ionicons
            name="time-outline"
            size={19}
            color={COLORS.black}
          />

          <Text
            style={styles.noteText}
          >
            Horário de atendimento:{" "}
            {SUPPORT.horario}
          </Text>
        </View>

        {/* CENTRAL DE AJUDA */}

        <TouchableOpacity
          style={styles.helpCenter}
          onPress={openHelpCenter}
          activeOpacity={0.85}
        >
          <View
            style={
              styles.helpCenterIcon
            }
          >
            <Ionicons
              name="globe-outline"
              size={20}
              color={COLORS.black}
            />
          </View>

          <View style={{ flex: 1 }}>
            <Text
              style={
                styles.helpCenterTitle
              }
            >
              Central de Ajuda
            </Text>

            <Text
              style={
                styles.helpCenterText
              }
            >
              Acesse informações e
              orientações do Meu
              Freteiro.
            </Text>
          </View>

          <Ionicons
            name="chevron-forward"
            size={20}
            color={
              COLORS.secondaryText
            }
          />
        </TouchableOpacity>

        {/* VOLTAR */}

        <TouchableOpacity
          onPress={goBack}
          style={
            styles.backFooterBtn
          }
          activeOpacity={0.8}
        >
          <Ionicons
            name="chevron-back"
            size={18}
            color={COLORS.black}
          />

          <Text
            style={
              styles.backFooterText
            }
          >
            Voltar
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles =
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor:
        COLORS.background,
    },

    content: {
      paddingHorizontal: 18,
      paddingBottom: 32,
    },

    header: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      marginBottom: 18,
    },

    headerIcon: {
      width: 48,
      height: 48,
      borderRadius: 14,

      alignItems: "center",
      justifyContent: "center",

      backgroundColor:
        COLORS.primary,
    },

    title: {
      fontSize: 23,
      fontWeight: "900",
      color: COLORS.text,
    },

    subtitle: {
      color:
        COLORS.secondaryText,

      marginTop: 3,

      fontSize: 13,
      lineHeight: 18,
    },

    card: {
      backgroundColor:
        COLORS.surface,

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
      backgroundColor:
        COLORS.border,

      marginVertical: 12,
    },

    itemTitle: {
      fontSize: 15,
      fontWeight: "800",
      color: COLORS.text,
    },

    itemDesc: {
      color:
        COLORS.secondaryText,

      marginTop: 2,

      fontSize: 12,
      lineHeight: 17,
    },

    actionButton: {
      minWidth: 66,

      paddingHorizontal: 12,
      paddingVertical: 9,

      borderRadius: 9,

      alignItems: "center",
      justifyContent: "center",

      backgroundColor:
        COLORS.primary,
    },

    actionButtonText: {
      color: COLORS.black,
      fontWeight: "800",
      fontSize: 12,
    },

    note: {
      flexDirection: "row",
      alignItems: "center",

      gap: 9,

      marginTop: 14,

      padding: 13,

      borderRadius: 12,

      backgroundColor:
        COLORS.primarySoft,

      borderWidth: 1,
      borderColor:
        COLORS.primaryBorder,
    },

    noteText: {
      flex: 1,

      color: "#374151",

      fontSize: 12,
      lineHeight: 18,

      fontWeight: "600",
    },

    helpCenter: {
      marginTop: 12,

      padding: 14,

      borderRadius: 14,

      borderWidth: 1,
      borderColor: COLORS.border,

      backgroundColor:
        COLORS.surface,

      flexDirection: "row",
      alignItems: "center",

      gap: 12,
    },

    helpCenterIcon: {
      width: 40,
      height: 40,

      borderRadius: 11,

      alignItems: "center",
      justifyContent: "center",

      backgroundColor:
        COLORS.primarySoft,
    },

    helpCenterTitle: {
      color: COLORS.text,
      fontSize: 14,
      fontWeight: "800",
    },

    helpCenterText: {
      color:
        COLORS.secondaryText,

      fontSize: 12,
      lineHeight: 17,

      marginTop: 2,
    },

    backFooterBtn: {
      alignSelf: "center",

      marginTop: 20,

      paddingVertical: 12,
      paddingHorizontal: 14,

      flexDirection: "row",
      alignItems: "center",

      gap: 6,
    },

    backFooterText: {
      color: COLORS.black,
      fontWeight: "700",
    },
  });