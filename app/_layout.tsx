// app/_layout.tsx
import { DarkTheme, DefaultTheme, ThemeProvider } from "@react-navigation/native";
import Constants from "expo-constants";
import { useFonts } from "expo-font";
import * as Notifications from "expo-notifications";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { Platform } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { useColorScheme } from "@/hooks/useColorScheme";

/**
 * Handler global — iOS precisa de shouldShowAlert: true para exibir em foreground.
 * (Não use shouldShowBanner/shouldShowList aqui.)
 */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    // iOS (SDKs antigos): usa shouldShowAlert
    shouldShowAlert: true,

    // iOS (SDKs mais novos): exige banner/list
    shouldShowBanner: true,
    shouldShowList: true,

    // comum
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});


export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [loaded] = useFonts({ SpaceMono: require("../assets/fonts/SpaceMono-Regular.ttf") });

  // Apenas para manter referência e, se quiser, exibir/logar token.
  const [_expoPushToken, setExpoPushToken] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        // 1) Verifica/solicita permissão
        const current = await Notifications.getPermissionsAsync();
        let status = current.status;
        if (status !== "granted") {
          const req = await Notifications.requestPermissionsAsync(
            Platform.OS === "ios"
              ? { ios: { allowAlert: true, allowBadge: true, allowSound: true } as any }
              : {}
          );
          status = req.status;
        }

        if (status !== "granted") {
          // Usuário negou — o app continua, só não registra token
          return;
        }

        // 2) Obtém Expo Push Token — em produção iOS é essencial passar o projectId
        const projectId =
          Constants?.expoConfig?.extra?.eas?.projectId ??
          Constants?.easConfig?.projectId;

        const tokenResp = await Notifications.getExpoPushTokenAsync(
          projectId ? { projectId } : undefined
        );
        const token = tokenResp.data;
        setExpoPushToken(token);

        // TODO: envie esse token ao teu backend:
        // await fetch("https://app.voucarregar.com.br/api/push/salvar-token", {
        //   method: "POST",
        //   headers: { "Content-Type": "application/json" },
        //   body: JSON.stringify({ token }),
        // });

        // 3) Canal Android (iOS ignora)
        if (Platform.OS === "android") {
          await Notifications.setNotificationChannelAsync("default", {
            name: "Notificações",
            importance: Notifications.AndroidImportance.MAX,
            sound: "default",
            vibrationPattern: [0, 250, 250, 250],
            enableVibrate: true,
            showBadge: true,
            lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
          });
        }
      } catch (e) {
        // Evita travar o layout se algo falhar
        console.warn("Falha ao registrar notificações:", e);
      }
    })();
  }, []);

  if (!loaded) return null;

  return (
    <SafeAreaProvider>
      <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="+not-found" />
        </Stack>
        <StatusBar style={colorScheme === "dark" ? "light" : "dark"} />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
