// app/backend/lib/push.ts
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import * as Storage from "./storage";

// ===== Config =====
const REGISTER_URL = "/api/mobile/push/register"; // mesma rota que você já criou no Next

// Lê o projectId em runtime (funciona em dev e APK/AAB)
function getExpoProjectId(): string | undefined {
  // Em dev / expo start
  const fromExtra = (Constants?.expoConfig as any)?.extra?.eas?.projectId as string | undefined;
  if (fromExtra) return fromExtra;

  // Em standalone (APK/AAB - EAS Build)
  // @ts-ignore - easConfig só existe em builds
  const fromEas = Constants?.easConfig?.projectId as string | undefined;
  if (fromEas) return fromEas;

  return undefined;
}

// Cria canal Android obrigatório em produção
async function ensureAndroidChannel() {
  if (Platform.OS !== "android") return;
  try {
    await Notifications.setNotificationChannelAsync("default", {
      name: "Notificações",
      importance: Notifications.AndroidImportance.MAX,
      sound: "default",
      vibrationPattern: [0, 250, 250, 250],
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      bypassDnd: false,
      enableVibrate: true,
      showBadge: true,
    });
  } catch (e) {
    console.warn("Falha ao criar canal Android:", e);
  }
}

// Pede permissão e retorna o Expo Push Token (ou null)
export async function getPushTokenAsync(projectId?: string) {
  if (!Device.isDevice) return null;

  // 1) Permissão
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== "granted") return null;

  // 2) Canal Android
  await ensureAndroidChannel();

  // 3) Token
  try {
    // Em APK/AAB, é importante passar { projectId }
    const tokenData = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );
    const token = tokenData?.data ?? null;
    return token;
  } catch (e) {
    console.warn("Erro ao obter Expo push token:", e);
    return null;
  }
}

/**
 * Registra o token no backend.
 * - Evita reenvio se o mesmo token já foi salvo localmente.
 * - Atualiza userId/role quando existirem.
 */
export async function registerPushTokenOnBackend(
  apiBase: string,
  opts?: { userId?: string | number; role?: string }
) {
  try {
    // Detecta o projectId automaticamente (dev e produção)
    const PROJECT_ID = getExpoProjectId();

    const token = await getPushTokenAsync(PROJECT_ID);
    if (!token) return;

    // Evita re-envio repetido desnecessário
    const lastToken = await Storage.getItem("pushToken");
    if (lastToken === token) {
      // Opcional: revalidar no servidor a cada X dias
      const lastAt = await Storage.getItem("pushTokenLastAt");
      const STALE_MS = 1000 * 60 * 60 * 24 * 7; // 7 dias
      if (lastAt && Date.now() - Number(lastAt) < STALE_MS) return;
    }

    const body = {
      token,
      platform: Platform.OS,
      userId: opts?.userId ?? (await Storage.getItem("userId")),
      role: opts?.role ?? (await Storage.getItem("userRole")),
    };

    const res = await fetch(`${apiBase}${REGISTER_URL}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      await Storage.setItem("pushToken", token);
      await Storage.setItem("pushTokenLastAt", String(Date.now()));
    } else {
      const txt = await res.text().catch(() => "");
      console.warn("Falha ao registrar push token:", res.status, txt?.slice(0, 300));
    }
  } catch (e) {
    console.warn("Erro registerPushTokenOnBackend:", e);
  }
}
