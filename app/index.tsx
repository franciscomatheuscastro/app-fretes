// app/index.tsx
import * as LocalAuthentication from "expo-local-authentication";
import { useRouter, type Href } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { registerPushTokenOnBackend } from "./backend/lib/push";

import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import * as Storage from "./backend/lib/storage";

// ✅ Base URL dinâmica: em dev (emulador) usa 10.0.2.2; em APK (release) usa produção
// Sempre usar produção (emulador, celular, debug, release)
const API_BASE = "https://app.voucarregar.com.br";


const CADASTRO_ROUTE: Href = "/cadastro";
const FRETES_ROUTE: Href = "/(tabs)/fretes";

type LoginResponse = {
  token: string;
  refreshToken?: string;
  user?: { id?: string | number; role?: string; nome?: string };
  erro?: string;
  message?: string;
};

const INPUT_HEIGHT = 48; // altura idêntica para CPF e Senha

export default function CaminhoneiroLogin() {
  const router = useRouter();

  const [cpf, setCpf] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [loading, setLoading] = useState(false);

  // biometria
  const [bioAvailable, setBioAvailable] = useState(false);
  const [bioEnabled, setBioEnabled] = useState(false);
  const [bioLoading, setBioLoading] = useState(false);
  const triedBioOnce = useRef(false);

  // se já estiver logado, pula pro fretes
  useEffect(() => {
    (async () => {
      const token = await Storage.getItem("authToken");
      const role = await Storage.getItem("userRole");
      if (token && role === "caminhoneiro") {
        router.replace(FRETES_ROUTE);
        return;
      }

      // checa suporte a biometria
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      setBioAvailable(Boolean(hasHardware && enrolled));

      // flag local se o usuário já ativou biometria
      const flag = await Storage.getItem("biometricEnabled");
      setBioEnabled(flag === "1");

      // tenta automaticamente só 1x
      if (!triedBioOnce.current && hasHardware && enrolled && flag === "1") {
        triedBioOnce.current = true;
        tryBiometricLogin();
      }
    })();
  }, []);

  function formatarCpf(v: string) {
    return v
      .replace(/\D/g, "")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})$/, "$1-$2")
      .slice(0, 14);
  }

  async function handleSubmit() {
    setErro("");
    const cpfNumerico = (cpf ?? "").replace(/\D/g, "");
    if (!cpfNumerico || !senha) return setErro("Preencha CPF e senha.");
    if (cpfNumerico.length !== 11) return setErro("CPF inválido (deve ter 11 dígitos).");

    // payload compatível com variações do backend
    const payload = {
      email: cpfNumerico,
      cpf: cpfNumerico,
      password: senha,
      senha: senha,
    };

    try {
      setLoading(true);

      console.log("LOGIN →", { API_BASE, cpf: cpfNumerico, hasSenha: !!senha });

      const res = await fetch(`${API_BASE}/api/mobile/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
        body: JSON.stringify(payload),
      });

      // tenta ler texto e depois JSON (para capturar mensagens de erro do backend)
      let data: LoginResponse | null = null;
      const raw = await res.text().catch(() => "");
      try {
        data = raw ? (JSON.parse(raw) as LoginResponse) : null;
      } catch {
        // mantém o raw para exibir como mensagem se necessário
      }

      if (!res.ok || !data?.token) {
        const msg = data?.erro || data?.message || raw || `Falha no login (HTTP ${res.status})`;
        setErro(msg);
        return;
      }

      if (data.user?.role !== "caminhoneiro") {
        setErro("Acesso não autorizado.");
        return;
      }

      // salva sessão atual
      await Storage.setItem("authToken", data.token);
      await Storage.setItem("userRole", data.user?.role ?? "");
      await Storage.setItem("userId", String(data.user?.id ?? ""));
      if (data.refreshToken) {
        await Storage.setItem("refreshToken", data.refreshToken);
      }

      // registra push token, mas não bloqueia o login se falhar
      try {
        await registerPushTokenOnBackend(API_BASE);
      } catch (e) {
        console.log("Falha ao registrar push token (ignorado para login):", e);
      }

      // Se a biometria já estiver habilitada, só entra
      if (bioAvailable && bioEnabled) {
        router.replace(FRETES_ROUTE);
        return;
      }

      // Se há biometria disponível e AINDA não está habilitada, ofereça ativar
      if (bioAvailable && !bioEnabled) {
        Alert.alert(
          "Entrar com Face ID?",
          "Você quer ativar o login biométrico para entrar sem digitar senha?",
          [
            {
              text: "Agora não",
              onPress: () => {
                router.replace(FRETES_ROUTE);
              },
              style: "cancel",
            },
            {
              text: "Ativar",
              onPress: async () => {
                // Plano ideal: guardar refreshToken. Alternativa: cpf/senha em SecureStore.
                await Storage.setItem("bio_cpf", cpfNumerico);
                await Storage.setItem("bio_pw", senha);
                await Storage.setItem("biometricEnabled", "1");
                setBioEnabled(true);
                router.replace(FRETES_ROUTE);
              },
            },
          ]
        );
      } else {
        router.replace(FRETES_ROUTE);
      }
    } catch (e) {
      console.error(e);
      setErro("Erro ao tentar entrar. Verifique sua conexão e tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  // ====== BIOMETRIA ======
  async function tryBiometricLogin() {
    try {
      setBioLoading(true);

      // checagens com feedback para o usuário
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      if (!hasHardware) {
        Alert.alert("Biometria indisponível", "Seu aparelho não possui hardware biométrico.");
        return;
      }
      if (!enrolled) {
        Alert.alert(
          "Sem Face ID cadastrado",
          "Cadastre seu Face ID/Touch ID nas configurações do aparelho."
        );
        return;
      }
      const enabledFlag = await Storage.getItem("biometricEnabled");
      if (enabledFlag !== "1") {
        Alert.alert(
          "Face ID não configurado",
          "Faça login com CPF e senha e ative o Face ID quando solicitado."
        );
        return;
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: Platform.OS === "ios" ? "Entrar com Face ID" : "Entrar com biometria",
        cancelLabel: "Usar CPF e senha",
        disableDeviceFallback: true, // evita pedir o passcode do iPhone
      });

      if (!result.success) {
        const err = (result as any)?.error;
        if (err === "lockout" || err === "lockout_permanent") {
          Alert.alert(
            "Biometria bloqueada",
            "Desbloqueie o aparelho com sua senha e tente novamente."
          );
        } else if (err && err !== "user_cancel" && err !== "system_cancel") {
          Alert.alert("Não foi possível autenticar", "Tente novamente.");
        }
        return;
      }

      // Tentativa A (preferida): usar refresh token salvo
      const refreshToken = await Storage.getItem("refreshToken");
      if (refreshToken) {
        const res = await fetch(`${API_BASE}/api/mobile/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken }),
        });
        const okRaw = await res.text().catch(() => "");
        let okData: LoginResponse | null = null;
        try { okData = okRaw ? (JSON.parse(okRaw) as LoginResponse) : null; } catch {}
        if (res.ok && okData?.token) {
          await Storage.setItem("authToken", okData.token);
          await Storage.setItem("userRole", okData.user?.role ?? "caminhoneiro");
          await Storage.setItem("userId", String(okData.user?.id ?? ""));
          router.replace(FRETES_ROUTE);
          return;
        }
      }

      // Tentativa B: refazer login com cpf+senha salvos
      const savedCpf = await Storage.getItem("bio_cpf");
      const savedPw = await Storage.getItem("bio_pw");
      if (!savedCpf || !savedPw) {
        Alert.alert(
          "Face ID não configurado",
          "Faça login com CPF e senha e ative o Face ID quando solicitado."
        );
        return;
      }

      const res = await fetch(`${API_BASE}/api/mobile/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: savedCpf,
          cpf: savedCpf,
          password: savedPw,
          senha: savedPw,
        }),
      });
      const raw = await res.text().catch(() => "");
      let data: LoginResponse | null = null;
      try { data = raw ? (JSON.parse(raw) as LoginResponse) : null; } catch {}

      if (res.ok && data?.token) {
        await Storage.setItem("authToken", data.token);
        await Storage.setItem("userRole", data.user?.role ?? "caminhoneiro");
        await Storage.setItem("userId", String(data.user?.id ?? ""));
        router.replace(FRETES_ROUTE);
        return;
      }

      Alert.alert("Falha ao entrar", "Não foi possível reautenticar automaticamente.");
    } catch (e) {
      console.warn(e);
      Alert.alert("Erro", "Falha na autenticação biométrica.");
    } finally {
      setBioLoading(false);
    }
  }

  // ====== UI ======
  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: "#fff" }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.header}>
        <View style={styles.headerBtn} />
        <Text style={styles.brand}>
          vou<Text style={{ color: "#000" }}>carregar</Text>
        </Text>
        <TouchableOpacity
          onPress={() => router.replace(FRETES_ROUTE)}
          style={styles.headerBtn}
          disabled={loading}
        >
          <Text style={[styles.headerBtnText, { color: "#9ca3af" }]}>✕</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.container}>
        <View style={{ marginBottom: 16 }}>
          <Text style={styles.title}>Olá, boas-vindas!</Text>
          <Text style={styles.subtitle}>Digite seu CPF e senha para acessar.</Text>
        </View>

        {/* CPF */}
        <TextInput
          placeholder="CPF"
          value={cpf}
          onChangeText={(v) => setCpf(formatarCpf(v))}
          keyboardType="number-pad"
          autoCapitalize="none"
          autoCorrect={false}
          textContentType="username"
          maxLength={14}
          editable={!loading}
          style={styles.input}
          placeholderTextColor="#9ca3af"
        />

        {/* Senha (altura idêntica, com espaço pro ícone) */}
        <View style={{ position: "relative", width: "100%" }}>
          <TextInput
            placeholder="Senha"
            value={senha}
            onChangeText={setSenha}
            secureTextEntry={!mostrarSenha}
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="password"
            editable={!loading}
            style={[styles.input, { paddingRight: 44 }]}
            placeholderTextColor="#9ca3af"
          />
          <TouchableOpacity
            onPress={() => setMostrarSenha((p) => !p)}
            style={styles.eyeBtn}
            activeOpacity={0.8}
            disabled={loading}
          >
            <Text style={{ fontSize: 16 }}>{mostrarSenha ? "🔒" : "👁️"}</Text>
          </TouchableOpacity>
        </View>

        {!!erro && (
          <Text style={{ color: "#dc2626", textAlign: "center", marginTop: 8 }}>{erro}</Text>
        )}

        <TouchableOpacity onPress={handleSubmit} style={styles.button} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Continuar</Text>}
        </TouchableOpacity>

        {/* Botão Face ID / Biometria */}
        {bioAvailable && bioEnabled && (
          <TouchableOpacity
            onPress={tryBiometricLogin}
            style={[styles.button, { backgroundColor: "#111827", marginTop: 10 }]}
            disabled={bioLoading}
          >
            {bioLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Entrar com Face ID</Text>
            )}
          </TouchableOpacity>
        )}

        <TouchableOpacity
          onPress={() => Alert.alert("Recuperação", "Implemente sua lógica de recuperar senha…")}
          style={{ marginTop: 14 }}
          disabled={loading}
        >
          <Text style={{ color: "#dc2626", fontSize: 13, fontWeight: "600" }}>
            Esqueceu sua senha?
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => router.push(CADASTRO_ROUTE)}
          style={{ marginTop: 14 }}
          disabled={loading}
        >
          <Text style={{ color: "#dc2626", fontSize: 13, fontWeight: "600" }}>
            Ainda não tem conta? Cadastre-se aqui
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: {
    width: "100%",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerBtn: { padding: 6 },
  headerBtnText: { fontSize: 20, color: "#4b5563" },
  brand: {
    position: "absolute",
    left: "50%",
    transform: [{ translateX: -60 }],
    fontSize: 22,
    fontWeight: "800",
    color: "#ea580c",
  },
  container: { flex: 1, padding: 20, alignItems: "center" },
  title: { fontSize: 18, fontWeight: "700", color: "#111827" },
  subtitle: { fontSize: 13, color: "#6b7280", marginTop: 2 },
  input: {
    width: "100%",
    height: INPUT_HEIGHT,
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    paddingHorizontal: 12,
    color: "#111827",
    marginTop: 10,
    fontSize: 14,
    backgroundColor: "#fff",
  },
  eyeBtn: { position: "absolute", right: 10, top: "50%", marginTop: -10 },
  button: {
    width: "100%",
    height: 48,
    backgroundColor: "#ea580c",
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
  },
  buttonText: { color: "#fff", fontWeight: "700" },
});
