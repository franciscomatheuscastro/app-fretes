// app/_layout.tsx

import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import Constants from "expo-constants";
import { useFonts } from "expo-font";
import * as Notifications from "expo-notifications";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { Platform } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { useColorScheme } from "@/hooks/useColorScheme";

/* =========================================================
   NOTIFICAÇÕES EM FOREGROUND
========================================================= */

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/* =========================================================
   ROOT LAYOUT
========================================================= */

export default function RootLayout() {
  const colorScheme =
    useColorScheme();

  const [loaded] =
    useFonts({
      SpaceMono: require(
        "../assets/fonts/SpaceMono-Regular.ttf"
      ),
    });

  /*
   * Mantemos o token em memória por enquanto.
   *
   * O login já possui o fluxo responsável
   * por registrar o push token no backend.
   *
   * Portanto NÃO vamos fazer outro POST
   * diretamente daqui.
   */
  const [
    _expoPushToken,
    setExpoPushToken,
  ] =
    useState<string | null>(
      null
    );

  /* =======================================================
     PREPARAR NOTIFICAÇÕES
  ======================================================= */

  useEffect(() => {
    let ativo = true;

    async function prepararNotificacoes() {
      try {
        /*
         * Android:
         * cria o canal antes de trabalhar
         * com as notificações.
         */
        if (
          Platform.OS ===
          "android"
        ) {
          await Notifications.setNotificationChannelAsync(
            "default",
            {
              name:
                "Notificações",

              importance:
                Notifications
                  .AndroidImportance
                  .MAX,

              sound:
                "default",

              vibrationPattern: [
                0,
                250,
                250,
                250,
              ],

              enableVibrate:
                true,

              showBadge:
                true,

              lockscreenVisibility:
                Notifications
                  .AndroidNotificationVisibility
                  .PUBLIC,
            }
          );
        }

        /* -----------------------------------------------
           PERMISSÃO
        ------------------------------------------------ */

        const current =
          await Notifications.getPermissionsAsync();

        let status =
          current.status;

        if (
          status !==
          "granted"
        ) {
          const request =
            await Notifications.requestPermissionsAsync(
              Platform.OS ===
                "ios"
                ? {
                    ios: {
                      allowAlert:
                        true,

                      allowBadge:
                        true,

                      allowSound:
                        true,
                    },
                  }
                : {}
            );

          status =
            request.status;
        }

        /*
         * Usuário não autorizou.
         * O aplicativo continua normalmente.
         */
        if (
          status !==
          "granted"
        ) {
          return;
        }

        /* -----------------------------------------------
           EAS PROJECT ID
        ------------------------------------------------ */

        const projectId =
          Constants
            ?.expoConfig
            ?.extra
            ?.eas
            ?.projectId ??
          Constants
            ?.easConfig
            ?.projectId;

        /* -----------------------------------------------
           EXPO PUSH TOKEN
        ------------------------------------------------ */

        const tokenResponse =
          await Notifications.getExpoPushTokenAsync(
            projectId
              ? {
                  projectId,
                }
              : undefined
          );

        if (!ativo) {
          return;
        }

        setExpoPushToken(
          tokenResponse.data
        );

        /*
         * IMPORTANTE:
         *
         * Não enviamos o token ao backend daqui.
         *
         * O fluxo de login do Meu Freteiro já chama:
         *
         * registerPushTokenOnBackend(...)
         *
         * Assim evitamos registrar o mesmo token
         * em dois lugares diferentes.
         */
      } catch (error) {
        console.warn(
          "Falha ao preparar notificações:",
          error
        );
      }
    }

    prepararNotificacoes();

    return () => {
      ativo = false;
    };
  }, []);

  /* =======================================================
     FONTES
  ======================================================= */

  if (!loaded) {
    return null;
  }

  /* =======================================================
     UI
  ======================================================= */

  return (
    <SafeAreaProvider>
      <ThemeProvider
        value={
          colorScheme ===
          "dark"
            ? DarkTheme
            : DefaultTheme
        }
      >
        <Stack
          screenOptions={{
            headerShown:
              false,

            animation:
              "fade",
          }}
        >
          {/* LOGIN */}

          <Stack.Screen
            name="index"
          />

          {/* ÁREA LOGADA */}

          <Stack.Screen
            name="(tabs)"
          />

          {/* 404 */}

          <Stack.Screen
            name="+not-found"
          />
        </Stack>

        <StatusBar
          style={
            colorScheme ===
            "dark"
              ? "light"
              : "dark"
          }
        />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}