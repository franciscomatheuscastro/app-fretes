// backend/lib/expo-environment.ts

import Constants from "expo-constants";

/**
 * Retorna true somente quando o JavaScript
 * está rodando dentro do aplicativo Expo Go.
 *
 * Development Build NÃO entra aqui.
 * APK/AAB de produção NÃO entra aqui.
 */
export function isExpoGo(): boolean {
  return Constants.expoGoConfig != null;
}