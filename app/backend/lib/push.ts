// app/lib/push.ts
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import * as Storage from "./storage"; // seu wrapper

// Handler global — agora com os campos exigidos pelo tipo NotificationBehavior
Notifications.setNotificationHandler({
  handleNotification: async (): Promise<Notifications.NotificationBehavior> => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
    // 👇 campos novos exigidos pelo tipo na sua versão do pacote
    shouldShowBanner: true, // iOS: mostrar como banner
    shouldShowList: true,   // iOS: incluir na Notification List
  }),
});

export async function ensurePushPermission(): Promise<boolean> {
  if (Platform.OS === "web") return false;

  const settings = await Notifications.getPermissionsAsync();
  let granted = settings.granted || settings.ios?.status === Notifications.IosAuthorizationStatus.AUTHORIZED;

  if (!granted) {
    const req = await Notifications.requestPermissionsAsync();
    granted = req.granted || req.ios?.status === Notifications.IosAuthorizationStatus.AUTHORIZED;
  }
  return granted;
}

/**
 * Pega o Expo Push Token e envia para seu backend.
 * Chame depois do login (temos userId/token já salvos).
 */
export async function registerPushTokenOnBackend(API_BASE: string) {
  const ok = await ensurePushPermission();
  if (!ok) return;

  // ❗ projectId precisa existir (app.json -> extra.eas.projectId)
  const projectId = Constants?.expoConfig?.extra?.eas?.projectId
    || Constants?.easConfig?.projectId;

  const { data: expoPushToken } = await Notifications.getExpoPushTokenAsync({
    projectId, // "fe5fc4e2-2c05-4624-957b-611c19613195"
  });

  if (!expoPushToken) return;

  await Storage.setItem("expoPushToken", expoPushToken);

  const userId = await Storage.getItem("userId");
  const authToken = await Storage.getItem("authToken");

  // manda pro backend salvar
  await fetch(`${API_BASE}/api/mobile/register-push-token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    },
    body: JSON.stringify({
      userId,
      token: expoPushToken,
      platform: Platform.OS,
    }),
  }).catch(() => {});
}
