// /backend/notifications-bg.ts
import * as Notifications from "expo-notifications";
import * as TaskManager from "expo-task-manager";
import { Platform } from "react-native";

// Nome único da task
export const BACKGROUND_NOTIFICATIONS_TASK = "background-notifications-task";

// Executor: precisa ser async para satisfazer a tipagem (Promise<void>)
TaskManager.defineTask(BACKGROUND_NOTIFICATIONS_TASK, async ({ data, error }) => {
  if (error) {
    console.warn("BG notification error:", error);
    return;
  }

  // Dependendo do gatilho, pode vir notification OU response
  const payload: any = data;
  const notif = payload?.notification ?? payload?.response?.notification ?? null;

  if (notif?.request?.content) {
    const { title, body, data: extra } = notif.request.content;
    // Se quiser, persista no seu Storage aqui (tomar cuidado com chaves válidas):
    // await Storage.setItem("ultimaNotif", JSON.stringify({ title, body, extra, ts: Date.now() }));
    console.log("BG notification:", { title, body, extra });
  }
});

// Registrar a task (Android). Em iOS o suporte a background é limitado.
async function registerBackgroundTask() {
  try {
    if (Platform.OS !== "android") return;

    // Apenas registra se ainda não estiver registrada
    const already = await TaskManager.isTaskRegisteredAsync(BACKGROUND_NOTIFICATIONS_TASK);
    if (!already) {
      await Notifications.registerTaskAsync(BACKGROUND_NOTIFICATIONS_TASK);
    }

    // Não existe isRegisteredForRemoteNotificationsAsync — para permissão, use:
    // const { status } = await Notifications.getPermissionsAsync();
    // if (status !== "granted") await Notifications.requestPermissionsAsync();

  } catch (e) {
    console.warn("Falha ao registrar BG notifications task:", e);
  }
}

// Executa no load do módulo
registerBackgroundTask();
