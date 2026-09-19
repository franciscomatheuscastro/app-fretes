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
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

const API_BASE = "https://www.meufreteiro.com";

const COLORS = {
  primary: "#FACC15",
  primaryPressed: "#EAB308",
  black: "#111827",
  text: "#111827",
  secondaryText: "#6B7280",
  placeholder: "#9CA3AF",
  border: "#D1D5DB",
  borderLight: "#E5E7EB",
  background: "#FFFFFF",
};

export default function RecuperarSenha() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  function isEmail(v: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
  }

  async function solicitar() {
    const mail = email.trim().toLowerCase();

    if (!isEmail(mail)) {
      Alert.alert(
        "Atenção",
        "Informe um e-mail válido."
      );
      return;
    }

    setLoading(true);

    try {
      const url = `${API_BASE}/api/esqueci-senha`;

      let resp = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          email: mail,
        }),
      });

      if (!resp.ok && resp.status === 405) {
        resp = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type":
              "application/x-www-form-urlencoded",
            Accept: "application/json",
          },
          body: `email=${encodeURIComponent(mail)}`,
        });
      }

      const raw = await resp
        .text()
        .catch(() => "");

      let data: any = null;

      try {
        data = raw
          ? JSON.parse(raw)
          : null;
      } catch {
        data = null;
      }

      if (resp.ok) {
        Alert.alert(
          "Verifique seu e-mail",
          data?.message ||
            data?.mensagem ||
            "Se o e-mail estiver cadastrado, enviaremos um link para redefinir sua senha.",
          [
            {
              text: "Entendi",
              onPress: () => router.back(),
            },
          ]
        );

        return;
      }

      const detalhe =
        data?.erro ||
        data?.error ||
        data?.message ||
        data?.mensagem ||
        raw ||
        `HTTP ${resp.status}`;

      Alert.alert(
        "Não foi possível",
        detalhe
      );
    } catch (error) {
      console.error(
        "Erro ao solicitar recuperação de senha:",
        error
      );

      Alert.alert(
        "Erro",
        "Falha ao solicitar a redefinição. Tente novamente."
      );
    } finally {
      setLoading(false);
    }
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
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />

      <KeyboardAvoidingView
        style={styles.keyboard}
        behavior={
          Platform.OS === "ios"
            ? "padding"
            : undefined
        }
      >
        <View
          style={[
            styles.wrap,
            {
              paddingTop:
                (insets.top ?? 0) + 8,
            },
          ]}
        >
          <View style={styles.brandContainer}>
            <Text style={styles.brand}>
              Meu Freteiro
            </Text>

            <Text style={styles.brandSubtitle}>
              Encontre oportunidades de frete
            </Text>
          </View>

          <View style={styles.content}>
            <Text style={styles.title}>
              Recuperar senha
            </Text>

            <Text style={styles.sub}>
              Informe o e-mail cadastrado.
              Enviaremos um link para você
              definir uma nova senha.
            </Text>

            <Text style={styles.label}>
              E-mail
            </Text>

            <TextInput
              placeholder="seuemail@exemplo.com"
              placeholderTextColor={
                COLORS.placeholder
              }
              style={styles.input}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              value={email}
              onChangeText={setEmail}
              editable={!loading}
              returnKeyType="send"
              onSubmitEditing={() => {
                if (!loading) {
                  solicitar();
                }
              }}
            />

            <TouchableOpacity
              style={[
                styles.button,
                loading &&
                  styles.buttonDisabled,
              ]}
              onPress={solicitar}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator
                  color={COLORS.black}
                />
              ) : (
                <Text
                  style={
                    styles.buttonText
                  }
                >
                  Enviar link
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() =>
                router.back()
              }
              style={styles.backButton}
              disabled={loading}
              activeOpacity={0.7}
            >
              <Text
                style={
                  styles.backButtonText
                }
              >
                Voltar para o login
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor:
      COLORS.background,
  },

  keyboard: {
    flex: 1,
  },

  wrap: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: "center",
  },

  brandContainer: {
    alignItems: "center",
    marginBottom: 38,
  },

  brand: {
    fontSize: 27,
    fontWeight: "900",
    color: COLORS.black,
    letterSpacing: -0.5,
  },

  brandSubtitle: {
    marginTop: 4,
    fontSize: 13,
    color: COLORS.secondaryText,
  },

  content: {
    width: "100%",
    maxWidth: 520,
    alignSelf: "center",
  },

  title: {
    fontSize: 24,
    fontWeight: "900",
    color: COLORS.text,
    letterSpacing: -0.4,
  },

  sub: {
    color: COLORS.secondaryText,
    marginTop: 6,
    marginBottom: 22,
    fontSize: 14,
    lineHeight: 20,
  },

  label: {
    color: "#374151",
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 6,
  },

  input: {
    width: "100%",
    height: 52,

    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,

    paddingHorizontal: 14,

    color: COLORS.text,
    backgroundColor:
      COLORS.background,

    fontSize: 14,
  },

  button: {
    width: "100%",
    height: 52,

    backgroundColor:
      COLORS.primary,

    borderRadius: 12,

    alignItems: "center",
    justifyContent: "center",

    marginTop: 16,
  },

  buttonDisabled: {
    opacity: 0.6,
  },

  buttonText: {
    color: COLORS.black,
    fontWeight: "800",
    fontSize: 15,
  },

  backButton: {
    alignSelf: "center",
    marginTop: 18,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },

  backButtonText: {
    color: COLORS.black,
    fontSize: 13,
    fontWeight: "700",
  },
});