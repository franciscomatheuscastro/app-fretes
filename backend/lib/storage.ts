import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

async function secureAvailable() {
  try {
    return (
      Platform.OS !== "web" &&
      (await SecureStore.isAvailableAsync())
    );
  } catch {
    return false;
  }
}

export async function getItem(
  key: string
): Promise<string | null> {
  if (await secureAvailable()) {
    return SecureStore.getItemAsync(key);
  }

  return AsyncStorage.getItem(key);
}

export async function setItem(
  key: string,
  value: string
): Promise<void> {
  if (await secureAvailable()) {
    await SecureStore.setItemAsync(
      key,
      value
    );

    return;
  }

  await AsyncStorage.setItem(
    key,
    value
  );
}

export async function deleteItem(
  key: string
): Promise<void> {
  if (await secureAvailable()) {
    await SecureStore.deleteItemAsync(
      key
    );

    return;
  }

  await AsyncStorage.removeItem(
    key
  );
}