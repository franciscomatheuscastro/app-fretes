import * as LocalAuthentication from "expo-local-authentication";
import { useCallback, useEffect, useState } from "react";
import { Alert, Platform } from "react-native";
import * as Storage from "../backend/lib/storage"; // <- caminho CORRETO

const BIO_KEY = "bioEnabled";

export function useBiometricLogin() {
  const [ready, setReady] = useState(false);
  const [isAvailable, setIsAvailable] = useState(false);
  const [isEnabled, setIsEnabled] = useState(false);

  useEffect(() => {
    (async () => {
      const [hw, enrolled, flag] = await Promise.all([
        LocalAuthentication.hasHardwareAsync(),
        LocalAuthentication.isEnrolledAsync(),
        Storage.getItem(BIO_KEY),
      ]);
      setIsAvailable(Boolean(hw && enrolled));
      setIsEnabled(flag === "1");
      setReady(true);
    })();
  }, []);

  const tryBiometricLogin = useCallback(async () => {
    if (!isAvailable) return false;

    // precisa já ter sessão salva (primeiro login foi com senha)
    const [token, role] = await Promise.all([
      Storage.getItem("authToken"),
      Storage.getItem("userRole"),
    ]);
    if (!(token && role === "caminhoneiro")) return false;

    const res = await LocalAuthentication.authenticateAsync({
      // ANDROID
      promptMessage: Platform.OS === "android" ? "Entrar com biometria" : "Entrar com Face ID",
      cancelLabel: Platform.OS === "android" ? "Usar CPF e senha" : undefined,
      requireConfirmation: Platform.OS === "android" ? false : undefined,
      // iOS
      disableDeviceFallback: Platform.OS === "ios" ? true : undefined, // evita senha do aparelho
      fallbackLabel: Platform.OS === "ios" ? "" : undefined, // deixa sem rótulo de fallback
    });

    return res.success === true;
  }, [isAvailable]);

  const enableBiometrics = useCallback(async () => {
    if (!isAvailable) return false;
    await Storage.setItem(BIO_KEY, "1");
    setIsEnabled(true);
    return true;
  }, [isAvailable]);

  const disableBiometrics = useCallback(async () => {
    await Storage.deleteItem(BIO_KEY); // <- deleteItem (NÃO removeItem)
    setIsEnabled(false);
  }, []);

  // chama isso logo após um login por senha bem-sucedido
  const askToEnableAfterPasswordLogin = useCallback(async () => {
    const [hw, enrolled] = await Promise.all([
      LocalAuthentication.hasHardwareAsync(),
      LocalAuthentication.isEnrolledAsync(),
    ]);
    if (!(hw && enrolled)) return;

    Alert.alert(
      "Ativar login por biometria?",
      Platform.OS === "ios"
        ? "Use Face ID para entrar sem digitar senha."
        : "Use a biometria para entrar sem digitar senha.",
      [
        { text: "Agora não" },
        {
          text: "Ativar",
          onPress: async () => {
            await enableBiometrics();
          },
        },
      ]
    );
  }, [enableBiometrics]);

  return {
    ready,
    isAvailable,
    isEnabled,
    tryBiometricLogin,
    enableBiometrics,
    disableBiometrics,
    askToEnableAfterPasswordLogin,
  };
}
