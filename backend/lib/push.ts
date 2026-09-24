// backend/lib/push.ts

import Constants from "expo-constants";
import * as Device from "expo-device";
import { Platform } from "react-native";

import { isExpoGo } from "./expo-environment";
import * as Storage from "./storage";

const REGISTER_URL = "/api/mobile/push/register";

/* =========================================================
   NOTIFICATIONS
========================================================= */

/**
 * Carrega expo-notifications somente fora do Expo Go.
 *
 * No Expo Go Android, push remoto não está disponível.
 * Em Development Build e Production Build funciona normalmente.
 */
function getNotifications() {
  if (isExpoGo()) {
    return null;
  }

  try {
    return require("expo-notifications") as typeof import("expo-notifications");
  } catch (error) {
    console.warn(
      "Não foi possível carregar expo-notifications:",
      error
    );

    return null;
  }
}

/* =========================================================
   PROJECT ID
========================================================= */

function getExpoProjectId(): string | undefined {
  const fromExtra =
    (Constants?.expoConfig as any)?.extra?.eas
      ?.projectId as string | undefined;

  if (fromExtra) {
    return fromExtra;
  }

  const fromEas =
    Constants?.easConfig?.projectId as
      | string
      | undefined;

  if (fromEas) {
    return fromEas;
  }

  return undefined;
}

/* =========================================================
   CANAL ANDROID
========================================================= */

async function ensureAndroidChannel() {
  if (Platform.OS !== "android") {
    return;
  }

  const Notifications =
    getNotifications();

  if (!Notifications) {
    return;
  }

  try {
    await Notifications.setNotificationChannelAsync(
      "default",
      {
        name: "Notificações",

        importance:
          Notifications.AndroidImportance.MAX,

        sound: "default",

        vibrationPattern: [
          0,
          250,
          250,
          250,
        ],

        lockscreenVisibility:
          Notifications
            .AndroidNotificationVisibility
            .PUBLIC,

        bypassDnd: false,
        enableVibrate: true,
        showBadge: true,
      }
    );
  } catch (error) {
    console.warn(
      "Falha ao criar canal Android:",
      error
    );
  }
}

/* =========================================================
   OBTER PUSH TOKEN
========================================================= */

export async function getPushTokenAsync(
  projectId?: string
) {
  /*
   * Expo Go:
   *
   * Não tenta inicializar push remoto.
   * O restante do aplicativo continua funcionando.
   */
  if (isExpoGo()) {
    if (__DEV__) {
      console.log(
        "[PUSH] Ignorado no Expo Go."
      );
    }

    return null;
  }

  if (!Device.isDevice) {
    return null;
  }

  const Notifications =
    getNotifications();

  if (!Notifications) {
    return null;
  }

  /* -------------------------------------------------------
     PERMISSÃO
  ------------------------------------------------------- */

  const { status: existingStatus } =
    await Notifications.getPermissionsAsync();

  let finalStatus =
    existingStatus;

  if (
    existingStatus !==
    "granted"
  ) {
    const { status } =
      await Notifications.requestPermissionsAsync();

    finalStatus = status;
  }

  if (
    finalStatus !==
    "granted"
  ) {
    return null;
  }

  /* -------------------------------------------------------
     CANAL ANDROID
  ------------------------------------------------------- */

  await ensureAndroidChannel();

  /* -------------------------------------------------------
     TOKEN
  ------------------------------------------------------- */

  try {
    const tokenData =
      await Notifications.getExpoPushTokenAsync(
        projectId
          ? {
              projectId,
            }
          : undefined
      );

    return (
      tokenData?.data ??
      null
    );
  } catch (error) {
    console.warn(
      "Erro ao obter Expo push token:",
      error
    );

    return null;
  }
}

/* =========================================================
   REGISTRAR TOKEN NO BACKEND
========================================================= */

export async function registerPushTokenOnBackend(
  apiBase: string,
  opts?: {
    userId?: string | number;
    role?: string;
  }
) {
  try {
    /*
     * No Expo Go não há push remoto.
     * Portanto nem tentamos registrar.
     */
    if (isExpoGo()) {
      if (__DEV__) {
        console.log(
          "[PUSH] Registro ignorado no Expo Go."
        );
      }

      return;
    }

    const PROJECT_ID =
      getExpoProjectId();

    const token =
      await getPushTokenAsync(
        PROJECT_ID
      );

    if (!token) {
      return;
    }

    /* -----------------------------------------------------
       EVITAR REENVIO
    ----------------------------------------------------- */

    const lastToken =
      await Storage.getItem(
        "pushToken"
      );

    if (
      lastToken === token
    ) {
      const lastAt =
        await Storage.getItem(
          "pushTokenLastAt"
        );

      const STALE_MS =
        1000 *
        60 *
        60 *
        24 *
        7;

      if (
        lastAt &&
        Date.now() -
          Number(lastAt) <
          STALE_MS
      ) {
        return;
      }
    }

    /* -----------------------------------------------------
       BODY
    ----------------------------------------------------- */

    const body = {
      token,

      platform:
        Platform.OS,

      userId:
        opts?.userId ??
        (await Storage.getItem(
          "userId"
        )),

      role:
        opts?.role ??
        (await Storage.getItem(
          "userRole"
        )),
    };

    /* -----------------------------------------------------
       BACKEND
    ----------------------------------------------------- */

    const res =
      await fetch(
        `${apiBase}${REGISTER_URL}`,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify(
            body
          ),
        }
      );

    if (res.ok) {
      await Storage.setItem(
        "pushToken",
        token
      );

      await Storage.setItem(
        "pushTokenLastAt",
        String(Date.now())
      );

      return;
    }

    const txt =
      await res
        .text()
        .catch(() => "");

    console.warn(
      "Falha ao registrar push token:",
      res.status,
      txt?.slice(0, 300)
    );
  } catch (error) {
    console.warn(
      "Erro registerPushTokenOnBackend:",
      error
    );
  }
}