// app/(tabs)/_layout.tsx

import { Ionicons } from "@expo/vector-icons";
import { Tabs, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  View,
} from "react-native";

import * as Storage from "../../backend/lib/storage";

/* =========================================================
   CORES
========================================================= */

const COLORS = {
  primary: "#FACC15",

  black: "#111827",

  background: "#F8FAFC",
  surface: "#FFFFFF",

  inactive: "#94A3B8",

  border: "#E5E7EB",
};

/* =========================================================
   LAYOUT DAS TABS
========================================================= */

export default function TabsLayout() {
  const router = useRouter();

  const [ready, setReady] = useState(false);

  /* =======================================================
     PROTEÇÃO DA ÁREA LOGADA
  ======================================================= */

  useEffect(() => {
    let mounted = true;

    async function verificarSessao() {
      try {
        const [token, role] = await Promise.all([
          Storage.getItem("authToken"),
          Storage.getItem("userRole"),
        ]);

        if (!token || role !== "caminhoneiro") {
          router.replace("/");
          return;
        }

        if (mounted) {
          setReady(true);
        }
      } catch (error) {
        console.warn(
          "Erro ao verificar sessão:",
          error
        );

        if (mounted) {
          router.replace("/");
        }
      }
    }

    verificarSessao();

    return () => {
      mounted = false;
    };
  }, [router]);

  /* =======================================================
     CARREGANDO
  ======================================================= */

  if (!ready) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator
          size="large"
          color={COLORS.primary}
        />
      </View>
    );
  }

  /* =======================================================
     TABS
  ======================================================= */

  return (
    <Tabs
      initialRouteName="fretes"
      screenOptions={{
        headerShown: false,

        tabBarActiveTintColor: COLORS.black,
        tabBarInactiveTintColor: COLORS.inactive,

        tabBarHideOnKeyboard: true,

        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "700",
        },

        /*
         * Não definimos height nem paddingBottom.
         *
         * O React Navigation calcula automaticamente
         * a altura da barra considerando a safe area
         * do Android e do iPhone.
         */
        tabBarStyle: {
          backgroundColor: COLORS.surface,

          borderTopWidth: 1,
          borderTopColor: COLORS.border,

          elevation: 8,

          shadowColor: "#000000",
          shadowOffset: {
            width: 0,
            height: -1,
          },
          shadowOpacity: 0.05,
          shadowRadius: 4,
        },

        tabBarItemStyle: {
          paddingTop: 4,
        },
      }}
    >
      {/* =================================================
          FRETES
      ================================================= */}

      <Tabs.Screen
        name="fretes"
        options={{
          title: "Fretes",

          tabBarIcon: ({
            color,
            focused,
          }) => (
            <View
              style={[
                styles.iconBox,
                focused &&
                  styles.iconBoxActive,
              ]}
            >
              <Ionicons
                name={
                  focused
                    ? "car"
                    : "car-outline"
                }
                size={20}
                color={color}
              />
            </View>
          ),
        }}
      />

      {/* =================================================
          PROPOSTAS
      ================================================= */}

      <Tabs.Screen
        name="propostas"
        options={{
          title: "Propostas",

          tabBarIcon: ({
            color,
            focused,
          }) => (
            <View
              style={[
                styles.iconBox,
                focused &&
                  styles.iconBoxActive,
              ]}
            >
              <Ionicons
                name={
                  focused
                    ? "document-text"
                    : "document-text-outline"
                }
                size={20}
                color={color}
              />
            </View>
          ),
        }}
      />

      {/* =================================================
          PERFIL
      ================================================= */}

      <Tabs.Screen
        name="perfil"
        options={{
          title: "Perfil",

          tabBarIcon: ({
            color,
            focused,
          }) => (
            <View
              style={[
                styles.iconBox,
                focused &&
                  styles.iconBoxActive,
              ]}
            >
              <Ionicons
                name={
                  focused
                    ? "person"
                    : "person-outline"
                }
                size={20}
                color={color}
              />
            </View>
          ),
        }}
      />

      {/* =================================================
          ROTAS INTERNAS OCULTAS
      ================================================= */}

      {/*
       * NOTIFICAÇÕES
       *
       * A tela continua dentro do grupo (tabs),
       * mas não aparece como botão no menu inferior.
       *
       * Ela pode ser aberta pelo sino da tela de Fretes.
       */}
      <Tabs.Screen
        name="notificacoes"
        options={{
          href: null,
        }}
      />

      {/*
       * AJUDA
       *
       * Também é uma tela interna da área autenticada,
       * porém não deve aparecer como uma quarta aba.
       *
       * O acesso deve acontecer através de:
       *
       * Perfil > Ajuda e Suporte
       */}
      <Tabs.Screen
        name="ajuda"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}

/* =========================================================
   ESTILOS
========================================================= */

const styles = StyleSheet.create({
  /* =======================================================
     LOADING
  ======================================================= */

  loading: {
    flex: 1,

    alignItems: "center",
    justifyContent: "center",

    backgroundColor: COLORS.background,
  },

  /* =======================================================
     ÍCONES DA TAB BAR
  ======================================================= */

  iconBox: {
    width: 36,
    height: 28,

    alignItems: "center",
    justifyContent: "center",

    borderRadius: 9,
  },

  iconBoxActive: {
    backgroundColor: COLORS.primary,
  },
});