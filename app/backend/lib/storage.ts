import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

async function secureAvailable() {
  try {
    return Platform.OS !== "web" && (await SecureStore.isAvailableAsync());
  } catch {
    return false;
  }
}

export async function getItem(key: string) {
  if (await secureAvailable()) return SecureStore.getItemAsync(key);
  return AsyncStorage.getItem(key);
}

export async function setItem(key: string, value: string) {
  if (await secureAvailable()) return SecureStore.setItemAsync(key, value);
  return AsyncStorage.setItem(key, value);
}

export async function deleteItem(key: string) {
  if (await secureAvailable()) return SecureStore.deleteItemAsync(key);
  return AsyncStorage.removeItem(key);
}
