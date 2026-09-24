// app/_layout.tsx

import Constants from "expo-constants";
import { useFonts } from "expo-font";
import {
  DarkTheme,
  DefaultTheme,
  Stack,
  ThemeProvider,
} from "expo-router";
import { StatusBar } from "expo-status-bar";
import {
  useEffect,
  useState,
} from "react";
import { Platform } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { useColorScheme } from "@/hooks/useColorScheme";

/* =========================================================
   AMBIENTE
========================================================= */

function isExpoGo() {
  return (
    Constants.expoGoConfig != null
  );
}

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
      /*
       * Expo Go:
       *
       * Não inicializamos push remoto.
       * O restante do aplicativo continua funcionando.
       */
      if (isExpoGo()) {
        if (__DEV__) {
          console.log(
            "[PUSH] Inicialização ignorada no Expo Go."
          );
        }

        return;
      }

      try {
        /*
         * Carrega expo-notifications somente
         * em Development/Production Build.
         */
        const Notifications =
          require(
            "expo-notifications"
          ) as typeof import(
            "expo-notifications"
          );

        /* -----------------------------------------------
           HANDLER GLOBAL
        ------------------------------------------------ */

        Notifications.setNotificationHandler(
          {
            handleNotification:
              async () => ({
                shouldShowAlert:
                  true,

                shouldShowBanner:
                  true,

                shouldShowList:
                  true,

                shouldPlaySound:
                  true,

                shouldSetBadge:
                  false,
              }),
          }
        );

        /* -----------------------------------------------
           ANDROID
        ------------------------------------------------ */

        if (
          Platform.OS ===
          "android"
        ) {
          await Notifications
            .setNotificationChannelAsync(
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

                vibrationPattern:
                  [
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
          await Notifications
            .getPermissionsAsync();

        let status =
          current.status;

        if (
          status !==
          "granted"
        ) {
          const request =
            await Notifications
              .requestPermissionsAsync(
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

        if (
          status !==
          "granted"
        ) {
          return;
        }

        /* -----------------------------------------------
           PROJECT ID
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
           PUSH TOKEN
        ------------------------------------------------ */

        const tokenResponse =
          await Notifications
            .getExpoPushTokenAsync(
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
         * Não enviamos para o backend daqui.
         *
         * O fluxo de login continua responsável
         * por registerPushTokenOnBackend(...).
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
          <Stack.Screen
            name="index"
          />

          <Stack.Screen
            name="(tabs)"
          />

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