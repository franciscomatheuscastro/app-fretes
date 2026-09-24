// backend/notifications-bg.ts

import Constants from "expo-constants";
import * as TaskManager from "expo-task-manager";
import { Platform } from "react-native";

export const BACKGROUND_NOTIFICATIONS_TASK =
  "background-notifications-task";

/* =========================================================
   AMBIENTE
========================================================= */

function isExpoGo() {
  return (
    Constants.expoGoConfig != null
  );
}

/* =========================================================
   TASK
========================================================= */

/*
 * A definição da task pode existir normalmente.
 *
 * O expo-notifications só será carregado
 * fora do Expo Go.
 */
TaskManager.defineTask(
  BACKGROUND_NOTIFICATIONS_TASK,
  async ({
    data,
    error,
  }) => {
    if (error) {
      console.warn(
        "BG notification error:",
        error
      );

      return;
    }

    const payload: any =
      data;

    const notif =
      payload?.notification ??
      payload?.response
        ?.notification ??
      null;

    if (
      notif?.request?.content
    ) {
      const {
        title,
        body,
        data: extra,
      } =
        notif.request.content;

      console.log(
        "BG notification:",
        {
          title,
          body,
          extra,
        }
      );
    }
  }
);

/* =========================================================
   REGISTRO
========================================================= */

async function registerBackgroundTask() {
  try {
    /*
     * Push remoto não é registrado
     * quando estamos no Expo Go.
     */
    if (isExpoGo()) {
      if (__DEV__) {
        console.log(
          "[PUSH BG] Ignorado no Expo Go."
        );
      }

      return;
    }

    if (
      Platform.OS !==
      "android"
    ) {
      return;
    }

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

    const already =
      await TaskManager
        .isTaskRegisteredAsync(
          BACKGROUND_NOTIFICATIONS_TASK
        );

    if (!already) {
      await Notifications
        .registerTaskAsync(
          BACKGROUND_NOTIFICATIONS_TASK
        );
    }
  } catch (error) {
    console.warn(
      "Falha ao registrar BG notifications task:",
      error
    );
  }
}

/* =========================================================
   INICIALIZAÇÃO
========================================================= */

registerBackgroundTask();