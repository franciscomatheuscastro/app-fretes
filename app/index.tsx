// app/index.tsx
import * as LocalAuthentication from "expo-local-authentication";
import { useRouter, type Href } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  AppState,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import "react-native-get-random-values";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { v4 as uuidv4 } from "uuid";
import { registerPushTokenOnBackend } from "../backend/lib/push";
import * as Storage from "../backend/lib/storage";

const API_BASE = "https://app.voucarregar.com.br";
const FRETES_ROUTE: Href = "/(tabs)/fretes";
const GATE_CHECK_URL = `${API_BASE}/api/mobile/gate/check`;
const OFFLINE_GRACE_DAYS = 3; // tolerância offline após última validação OK

type GateCheckResponse = {
  ok: boolean;
  active: boolean;
  message?: string;
  intervalSec?: number;
};

type LoginResponse = {
  token: string;
  refreshToken?: string;
  user?: { id?: string | number; role?: string; nome?: string };
  erro?: string;
  message?: string;
};

const INPUT_HEIGHT = 48;
const STORAGE_KEYS = {
  deviceId: "global_device_id",
  lastGateOkAt: "global_gate_last_ok_at",
};

function withinDays(iso: string | null, days: number): boolean {
  if (!iso) return false;
  const last = new Date(iso).getTime();
  if (Number.isNaN(last)) return false;
  const now = Date.now();
  return now - last <= days * 24 * 60 * 60 * 1000;
}

export default function CaminhoneiroLogin() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [cpf, setCpf] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);

  // estados de boot / carregamento
  const [booting, setBooting] = useState(true); // controla “piscar” da tela
  const [loading, setLoading] = useState(false);

  // biometria
  const [bioAvailable, setBioAvailable] = useState(false);
  const [bioEnabled, setBioEnabled] = useState(false);
  const [bioLoading, setBioLoading] = useState(false);
  const triedBioOnce = useRef(false);

  // kill switch global
  const [gateChecking, setGateChecking] = useState(true);
  const [gateActive, setGateActive] = useState<boolean>(false);
  const [gateMessage, setGateMessage] = useState<string>("");

  const [deviceId, setDeviceId] = useState<string | null>(null);

  // --- Boot inicial
  useEffect(() => {
    (async () => {
      // 1) Garante deviceId
      let did = await Storage.getItem(STORAGE_KEYS.deviceId);
      if (!did) {
        did = uuidv4();
        await Storage.setItem(STORAGE_KEYS.deviceId, did);
      }
      setDeviceId(did);

      // 2) Valida gate
      const allowed = await checkGate({ requireOnlineIfNeverValidated: true });
      if (!allowed) {
        setBooting(false);
        return;
      }

      // 3) Tenta auto-login silencioso (sem pedir nada ao usuário)
      const autoOk = await tryAutoLoginSilencioso();
      if (!autoOk) {
        // Prepara biometria para próxima tentativa (sem bloquear UI)
        const hasHardware = await LocalAuthentication.hasHardwareAsync();
        const enrolled = await LocalAuthentication.isEnrolledAsync();
        setBioAvailable(Boolean(hasHardware && enrolled));
        const flag = await Storage.getItem("biometricEnabled");
        setBioEnabled(flag === "1");
      }
      setBooting(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Revalida gate ao voltar para foreground (mantém sessão fluída)
  useEffect(() => {
    const sub = AppState.addEventListener("change", async (state) => {
      if (state === "active") {
        const allowed = await checkGate();
        if (allowed) {
          // se já há token e role, garante que permanece logado
          const token = await Storage.getItem("authToken");
          const role = await Storage.getItem("userRole");
          if (token && role === "caminhoneiro") {
            // opcionalmente, poderíamos tentar refresh em background
            return;
          }
          // se perdeu sessão, tenta refresh silencioso
          await tryAutoLoginSilencioso();
        }
      }
    });
    return () => sub.remove();
  }, []);

  // --------- Gate ----------
  async function checkGate(opts?: { requireOnlineIfNeverValidated?: boolean }) {
    const requireOnlineIfNeverValidated = opts?.requireOnlineIfNeverValidated ?? false;
    setGateChecking(true);
    try {
      const lastOkIso = (await Storage.getItem(STORAGE_KEYS.lastGateOkAt)) || null;
      const neverValidated = !lastOkIso;

      let ok = false;
      let active = false;
      let message = "";

      try {
        const res = await fetch(GATE_CHECK_URL, { method: "POST" });
        const data = (await res.json()) as GateCheckResponse;
        ok = Boolean(data?.ok);
        active = Boolean(data?.active);
        message = (data?.message ?? "") || (active ? "" : "Aplicativo bloqueado.");
      } catch {
        // offline — decide pelo cache
      }

      if (ok) {
        setGateActive(active);
        setGateMessage(message);
        setGateChecking(false);
        if (active) {
          await Storage.setItem(STORAGE_KEYS.lastGateOkAt, new Date().toISOString());
        }
        return active;
      }

      // offline: política de grace
      if (neverValidated && requireOnlineIfNeverValidated) {
        setGateActive(false);
        setGateMessage("Sem conexão para validar. Tente novamente com internet.");
        setGateChecking(false);
        return false;
      }

      const allowByGrace = withinDays(lastOkIso, OFFLINE_GRACE_DAYS);
      setGateActive(allowByGrace);
      setGateMessage(
        allowByGrace ? "" : "Não foi possível validar. Conecte-se à internet para continuar."
      );
      setGateChecking(false);
      return allowByGrace;
    } catch {
      setGateActive(false);
      setGateMessage("Erro ao validar o aplicativo.");
      setGateChecking(false);
      return false;
    }
  }

  // --------- Auto-login silencioso ----------
  async function tryAutoLoginSilencioso(): Promise<boolean> {
    try {
      // 1) Se já há token + role, entra direto
      const [token, role] = await Promise.all([
        Storage.getItem("authToken"),
        Storage.getItem("userRole"),
      ]);
      if (token && role === "caminhoneiro") {
        router.replace(FRETES_ROUTE);
        return true;
      }

      // 2) Caso tenha refreshToken, tenta refresh e entra
      const refreshToken = await Storage.getItem("refreshToken");
      if (refreshToken) {
        const res = await fetch(`${API_BASE}/api/mobile/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken }),
        });
        const raw = await res.text().catch(() => "");
        let data: LoginResponse | null = null;
        try {
          data = raw ? (JSON.parse(raw) as LoginResponse) : null;
        } catch {}
        if (res.ok && data?.token) {
          await Storage.setItem("authToken", data.token);
          await Storage.setItem("userRole", data.user?.role ?? "caminhoneiro");
          await Storage.setItem("userId", String(data.user?.id ?? ""));
          if (data.refreshToken) await Storage.setItem("refreshToken", data.refreshToken);
          // registra push no backend
          registerPushTokenOnBackend(API_BASE).catch(() => {});
          router.replace(FRETES_ROUTE);
          return true;
        }
      }

      // 3) Se biometria estiver habilitada, tenta silenciosamente
      const enabledFlag = await Storage.getItem("biometricEnabled");
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      if (enabledFlag === "1" && hasHardware && enrolled && !triedBioOnce.current) {
        triedBioOnce.current = true;
        const ok = await tryBiometricLogin({ silent: true });
        if (ok) return true;
      }

      // sem sessão válida
      return false;
    } catch {
      return false;
    }
  }

  // --------- Login manual ----------
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
    if (!gateActive) {
      setErro("Aplicativo bloqueado no momento.");
      return;
    }

    const cpfNumerico = (cpf ?? "").replace(/\D/g, "");
    if (!cpfNumerico || !senha) return setErro("Preencha CPF e senha.");
    if (cpfNumerico.length !== 11) return setErro("CPF inválido (deve ter 11 dígitos).");

    const payload = { email: cpfNumerico, cpf: cpfNumerico, password: senha, senha: senha };

    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/api/mobile/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(payload),
      });

      let data: LoginResponse | null = null;
      const raw = await res.text().catch(() => "");
      try {
        data = raw ? (JSON.parse(raw) as LoginResponse) : null;
      } catch {}

      if (!res.ok || !data?.token) {
        const msg = data?.erro || data?.message || raw || `Falha no login (HTTP ${res.status})`;
        setErro(msg);
        return;
      }

      if (data.user?.role !== "caminhoneiro") {
        setErro("Acesso não autorizado.");
        return;
      }

      await Storage.setItem("authToken", data.token);
      await Storage.setItem("userRole", data.user?.role ?? "");
      await Storage.setItem("userId", String(data.user?.id ?? ""));
      if (data.refreshToken) await Storage.setItem("refreshToken", data.refreshToken);

      // registra push
      registerPushTokenOnBackend(API_BASE).catch(() => {});

      // pergunta biometria apenas como comodidade (não é necessária para auto-login)
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      setBioAvailable(Boolean(hasHardware && enrolled));
      if (hasHardware && enrolled) {
        const flag = await Storage.getItem("biometricEnabled");
        if (flag !== "1") {
          Alert.alert(
            Platform.OS === "ios" ? "Ativar Face ID?" : "Ativar biometria?",
            "Você quer entrar sem digitar senha nas próximas vezes?",
            [
              { text: "Agora não", onPress: () => router.replace(FRETES_ROUTE), style: "cancel" },
              {
                text: "Ativar",
                onPress: async () => {
                  await Storage.setItem("bio_cpf", cpfNumerico);
                  await Storage.setItem("bio_pw", senha);
                  await Storage.setItem("biometricEnabled", "1");
                  setBioEnabled(true);
                  router.replace(FRETES_ROUTE);
                },
              },
            ]
          );
          return;
        }
      }

      router.replace(FRETES_ROUTE);
    } catch (e) {
      console.error(e);
      setErro("Erro ao tentar entrar. Verifique sua conexão e tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  // --------- Biometria (opcional) ----------
  async function tryBiometricLogin(opts: { silent?: boolean } = {}) {
    const { silent } = opts;
    try {
      setBioLoading(true);

      if (!gateActive) {
        if (!silent) Alert.alert("Bloqueado", "Aplicativo bloqueado no momento.");
        return false;
      }

      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      if (!hasHardware || !enrolled) {
        if (!silent) {
          Alert.alert(
            "Biometria indisponível",
            !hasHardware
              ? "Seu aparelho não possui hardware biométrico."
              : "Cadastre sua biometria nas configurações do aparelho."
          );
        }
        return false;
      }

      const enabledFlag = await Storage.getItem("biometricEnabled");
      if (enabledFlag !== "1") {
        if (!silent) {
          Alert.alert(
            Platform.OS === "ios" ? "Face ID não configurado" : "Biometria não configurada",
            "Faça login com CPF e senha e ative a biometria quando solicitado."
          );
        }
        return false;
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: Platform.OS === "android" ? "Entrar com biometria" : "Entrar com Face ID",
        cancelLabel: "Usar CPF e senha",
        disableDeviceFallback: true,
      });

      if (!result.success) {
        const err = (result as any)?.error;
        if (!silent) {
          if (err === "lockout" || err === "lockout_permanent") {
            Alert.alert("Biometria bloqueada", "Desbloqueie o aparelho com sua senha e tente novamente.");
          } else if (err && err !== "user_cancel" && err !== "system_cancel") {
            Alert.alert("Não foi possível autenticar", "Tente novamente.");
          }
        }
        return false;
      }

      // tenta refresh
      const refreshToken = await Storage.getItem("refreshToken");
      if (refreshToken) {
        const res = await fetch(`${API_BASE}/api/mobile/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken }),
        });
        const okRaw = await res.text().catch(() => "");
        let okData: LoginResponse | null = null;
        try {
          okData = okRaw ? (JSON.parse(okRaw) as LoginResponse) : null;
        } catch {}
        if (res.ok && okData?.token) {
          await Storage.setItem("authToken", okData.token);
          await Storage.setItem("userRole", okData.user?.role ?? "caminhoneiro");
          await Storage.setItem("userId", String(okData.user?.id ?? ""));
          if (okData.refreshToken) await Storage.setItem("refreshToken", okData.refreshToken);
          registerPushTokenOnBackend(API_BASE).catch(() => {});
          router.replace(FRETES_ROUTE);
          return true;
        }
      }

      // fallback: credenciais salvas (apenas se usuário optou por biometria)
      const savedCpf = await Storage.getItem("bio_cpf");
      const savedPw = await Storage.getItem("bio_pw");
      if (!savedCpf || !savedPw) {
        if (!silent) {
          Alert.alert(
            Platform.OS === "ios" ? "Face ID não configurado" : "Biometria não configurada",
            "Faça login com CPF e senha e ative a biometria quando solicitado."
          );
        }
        return false;
      }

      const res = await fetch(`${API_BASE}/api/mobile/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: savedCpf, cpf: savedCpf, password: savedPw, senha: savedPw }),
      });
      const raw = await res.text().catch(() => "");
      let data: LoginResponse | null = null;
      try {
        data = raw ? (JSON.parse(raw) as LoginResponse) : null;
      } catch {}

      if (res.ok && data?.token) {
        await Storage.setItem("authToken", data.token);
        await Storage.setItem("userRole", data.user?.role ?? "caminhoneiro");
        await Storage.setItem("userId", String(data.user?.id ?? ""));
        if (data.refreshToken) await Storage.setItem("refreshToken", data.refreshToken);
        registerPushTokenOnBackend(API_BASE).catch(() => {});
        router.replace(FRETES_ROUTE);
        return true;
      }

      if (!silent) Alert.alert("Falha ao entrar", "Não foi possível reautenticar automaticamente.");
      return false;
    } catch (e) {
      console.warn(e);
      if (!silent) Alert.alert("Erro", "Falha na autenticação biométrica.");
      return false;
    } finally {
      setBioLoading(false);
    }
  }

  // --------- UI ----------
  if (booting || gateChecking) {
    return (
      <SafeAreaView style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator />
        <Text style={{ marginTop: 8 }}>
          {gateChecking ? "Validando aplicativo..." : "Carregando..."}
        </Text>
      </SafeAreaView>
    );
  }

  if (!gateActive) {
    return (
      <SafeAreaView style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }}>
        <Text style={{ fontSize: 20, fontWeight: "800", marginBottom: 8 }}>Aplicativo bloqueado</Text>
        <Text style={{ textAlign: "center", color: "#6b7280" }}>
          {gateMessage || "Este aplicativo está temporariamente indisponível."}
        </Text>
        <TouchableOpacity
          style={[styles.button, { marginTop: 16 }]}
          onPress={() => checkGate({ requireOnlineIfNeverValidated: false })}
        >
          <Text style={styles.buttonText}>Tentar novamente</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }} edges={["top", "left", "right"]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={[styles.header, { paddingTop: (insets.top ?? 0) + 12 }]}>
          <Text style={styles.brand}>
            vou<Text style={{ color: "#000" }}>carregar</Text>
          </Text>
        </View>

        <View style={styles.container}>
          <View style={{ marginBottom: 16 }}>
            <Text style={styles.title}>Olá, boas-vindas!</Text>
            <Text style={styles.subtitle}>Digite seu CPF e senha para acessar.</Text>
          </View>

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
              accessibilityRole="button"
              accessibilityLabel={mostrarSenha ? "Ocultar senha" : "Mostrar senha"}
            >
              <Text style={{ fontSize: 16 }}>{mostrarSenha ? "🔒" : "👁️"}</Text>
            </TouchableOpacity>
          </View>

          {!!erro && <Text style={{ color: "#dc2626", textAlign: "center", marginTop: 8 }}>{erro}</Text>}

          <TouchableOpacity onPress={handleSubmit} style={styles.button} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Continuar</Text>}
          </TouchableOpacity>

          {bioAvailable && bioEnabled && (
            <TouchableOpacity
              onPress={() => tryBiometricLogin()}
              style={[styles.button, { backgroundColor: "#111827", marginTop: 10 }]}
              disabled={bioLoading}
            >
              {bioLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>
                  {Platform.OS === "ios" ? "Entrar com Face ID" : "Entrar com biometria"}
                </Text>
              )}
            </TouchableOpacity>
          )}

          <TouchableOpacity onPress={() => router.push("/recuperar-senha")} style={{ marginTop: 14 }} disabled={loading}>
            <Text style={{ color: "#dc2626", fontSize: 13, fontWeight: "600" }}>Esqueceu sua senha?</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.push("/cadastro")} style={{ marginTop: 14 }} disabled={loading}>
            <Text style={{ color: "#dc2626", fontSize: 13, fontWeight: "600" }}>
              Ainda não tem conta? Cadastre-se aqui
            </Text>
          </TouchableOpacity>

          {/* Link interno para Política de Privacidade (requisito Apple 5.1.1) */}
          <View style={{ width: "100%", marginTop: 22, alignItems: "center" }}>
            <Text style={{ fontSize: 12, color: "#6b7280", textAlign: "center", paddingHorizontal: 8 }}>
              Ao continuar, você declara que leu e concorda com nossa
            </Text>
            <TouchableOpacity
              onPress={() => router.push("/politica-privacidade")}
              style={{ paddingVertical: 6 }}
              accessibilityRole="link"
              accessibilityLabel="Abrir Política de Privacidade"
            >
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: "700",
                  color: "#dc2626",
                  textDecorationLine: "underline",
                }}
              >
                Política de Privacidade
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    width: "100%",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  brand: { fontSize: 22, fontWeight: "800", color: "#ea580c" },

  container: { flex: 1, padding: 20, alignItems: "center", backgroundColor: "#fff" },
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
