import * as LocalAuthentication from "expo-local-authentication";
import {
  useRouter,
  type Href,
} from "expo-router";
import {
  useEffect,
  useRef,
  useState,
} from "react";
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
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import {
  v4 as uuidv4,
} from "uuid";

import {
  registerPushTokenOnBackend,
} from "../backend/lib/push";

import * as Storage from "../backend/lib/storage";

/* ========================================================= */
/* CONFIGURAÇÃO */
/* ========================================================= */

const API_BASE = "https://www.meufreteiro.com";

const FRETES_ROUTE: Href =
  "/(tabs)/fretes";

const GATE_CHECK_URL =
  `${API_BASE}/api/mobile/gate/check`;

const OFFLINE_GRACE_DAYS =
  3;

const INPUT_HEIGHT =
  48;

/* ========================================================= */
/* TIPOS */
/* ========================================================= */

type GateCheckResponse = {
  ok: boolean;
  active: boolean;
  message?: string;
  intervalSec?: number;
};

type LoginResponse = {
  token?: string;

  user?: {
    id?: string | number;
    role?: string;
    nome?: string;
  };

  erro?: string;
  error?: string;
  message?: string;
};

/* ========================================================= */
/* STORAGE */
/* ========================================================= */

const STORAGE_KEYS = {
  deviceId:
    "global_device_id",

  lastGateOkAt:
    "global_gate_last_ok_at",

  authToken:
    "authToken",

  userRole:
    "userRole",

  userId:
    "userId",

  biometricEnabled:
    "biometricEnabled",

  biometricCpf:
    "bio_cpf",

  biometricPassword:
    "bio_pw",
};

/* ========================================================= */
/* HELPERS */
/* ========================================================= */

function withinDays(
  iso: string | null,
  days: number
): boolean {
  if (!iso) {
    return false;
  }

  const last =
    new Date(
      iso
    ).getTime();

  if (
    Number.isNaN(
      last
    )
  ) {
    return false;
  }

  return (
    Date.now() -
      last <=
    days *
      24 *
      60 *
      60 *
      1000
  );
}

function formatarCpf(
  valor: string
) {
  return valor
    .replace(
      /\D/g,
      ""
    )
    .replace(
      /(\d{3})(\d)/,
      "$1.$2"
    )
    .replace(
      /(\d{3})(\d)/,
      "$1.$2"
    )
    .replace(
      /(\d{3})(\d{1,2})$/,
      "$1-$2"
    )
    .slice(
      0,
      14
    );
}

/* ========================================================= */
/* COMPONENTE */
/* ========================================================= */

export default function FreteiroLogin() {
  const router =
    useRouter();

  const insets =
    useSafeAreaInsets();

  /* ======================================================= */
  /* LOGIN */
  /* ======================================================= */

  const [
    cpf,
    setCpf,
  ] =
    useState("");

  const [
    senha,
    setSenha,
  ] =
    useState("");

  const [
    erro,
    setErro,
  ] =
    useState("");

  const [
    mostrarSenha,
    setMostrarSenha,
  ] =
    useState(false);

  const [
    loading,
    setLoading,
  ] =
    useState(false);

  /* ======================================================= */
  /* BOOT */
  /* ======================================================= */

  const [
    booting,
    setBooting,
  ] =
    useState(true);

  /* ======================================================= */
  /* BIOMETRIA */
  /* ======================================================= */

  const [
    bioAvailable,
    setBioAvailable,
  ] =
    useState(false);

  const [
    bioEnabled,
    setBioEnabled,
  ] =
    useState(false);

  const [
    bioLoading,
    setBioLoading,
  ] =
    useState(false);

  const triedBioOnce =
    useRef(false);

  /* ======================================================= */
  /* GLOBAL GATE */
  /* ======================================================= */

  const [
    gateChecking,
    setGateChecking,
  ] =
    useState(true);

  const [
    gateActive,
    setGateActive,
  ] =
    useState(false);

  const [
    gateMessage,
    setGateMessage,
  ] =
    useState("");

  /* ======================================================= */
  /* BOOT INICIAL */
  /* ======================================================= */

  useEffect(
    () => {
      void (
        async () => {
          /*
           * Mantemos um identificador local
           * do dispositivo.
           */
          let deviceId =
            await Storage.getItem(
              STORAGE_KEYS.deviceId
            );

          if (!deviceId) {
            deviceId =
              uuidv4();

            await Storage.setItem(
              STORAGE_KEYS.deviceId,
              deviceId
            );
          }

          /*
           * Verifica se o aplicativo
           * está liberado.
           */
          const allowed =
            await checkGate({
              requireOnlineIfNeverValidated:
                true,
            });

          if (!allowed) {
            setBooting(
              false
            );

            return;
          }

          /*
           * Se existe sessão local,
           * entra diretamente.
           */
          const autoOk =
            await tryAutoLoginSilencioso();

          if (!autoOk) {
            await prepararBiometria();
          }

          setBooting(
            false
          );
        }
      )();

      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    []
  );

  /* ======================================================= */
  /* RETORNO AO FOREGROUND */
  /* ======================================================= */

  useEffect(
    () => {
      const sub =
        AppState.addEventListener(
          "change",
          async (
            state
          ) => {
            if (
              state !==
              "active"
            ) {
              return;
            }

            const allowed =
              await checkGate();

            if (!allowed) {
              return;
            }

            const token =
              await Storage.getItem(
                STORAGE_KEYS.authToken
              );

            const role =
              await Storage.getItem(
                STORAGE_KEYS.userRole
              );

            if (
              token &&
              role ===
                "caminhoneiro"
            ) {
              return;
            }

            await prepararBiometria();
          }
        );

      return () =>
        sub.remove();

      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    []
  );

  /* ======================================================= */
  /* PREPARAR BIOMETRIA */
  /* ======================================================= */

  async function prepararBiometria() {
    try {
      const [
        hasHardware,
        enrolled,
        flag,
      ] =
        await Promise.all([
          LocalAuthentication.hasHardwareAsync(),

          LocalAuthentication.isEnrolledAsync(),

          Storage.getItem(
            STORAGE_KEYS.biometricEnabled
          ),
        ]);

      setBioAvailable(
        Boolean(
          hasHardware &&
            enrolled
        )
      );

      setBioEnabled(
        flag ===
          "1"
      );
    } catch {
      setBioAvailable(
        false
      );

      setBioEnabled(
        false
      );
    }
  }

  /* ======================================================= */
  /* GLOBAL GATE */
  /* ======================================================= */

  async function checkGate(
    opts?: {
      requireOnlineIfNeverValidated?: boolean;
    }
  ) {
    const requireOnlineIfNeverValidated =
      opts
        ?.requireOnlineIfNeverValidated ??
      false;

    setGateChecking(
      true
    );

    try {
      const lastOkIso =
        (await Storage.getItem(
          STORAGE_KEYS.lastGateOkAt
        )) ||
        null;

      const neverValidated =
        !lastOkIso;

      let ok =
        false;

      let active =
        false;

      let message =
        "";

      try {
        const res =
          await fetch(
            GATE_CHECK_URL,
            {
              method:
                "POST",
            }
          );

        const data =
          (await res.json()) as GateCheckResponse;

        ok =
          Boolean(
            data?.ok
          );

        active =
          Boolean(
            data?.active
          );

        message =
          data?.message ??
          "";

        if (
          !active &&
          !message
        ) {
          message =
            "Aplicativo temporariamente indisponível.";
        }
      } catch {
        /*
         * Sem internet:
         * utiliza a tolerância local.
         */
      }

      if (ok) {
        setGateActive(
          active
        );

        setGateMessage(
          message
        );

        if (active) {
          await Storage.setItem(
            STORAGE_KEYS.lastGateOkAt,
            new Date().toISOString()
          );
        }

        return active;
      }

      if (
        neverValidated &&
        requireOnlineIfNeverValidated
      ) {
        setGateActive(
          false
        );

        setGateMessage(
          "Sem conexão para validar. Conecte-se à internet e tente novamente."
        );

        return false;
      }

      const allowByGrace =
        withinDays(
          lastOkIso,
          OFFLINE_GRACE_DAYS
        );

      setGateActive(
        allowByGrace
      );

      setGateMessage(
        allowByGrace
          ? ""
          : "Não foi possível validar. Conecte-se à internet para continuar."
      );

      return allowByGrace;
    } catch {
      setGateActive(
        false
      );

      setGateMessage(
        "Erro ao validar o aplicativo."
      );

      return false;
    } finally {
      setGateChecking(
        false
      );
    }
  }

  /* ======================================================= */
  /* AUTOLOGIN */
  /* ======================================================= */

  async function tryAutoLoginSilencioso(): Promise<boolean> {
    try {
      const [
        token,
        role,
      ] =
        await Promise.all([
          Storage.getItem(
            STORAGE_KEYS.authToken
          ),

          Storage.getItem(
            STORAGE_KEYS.userRole
          ),
        ]);

      /*
       * O JWT atual possui validade própria.
       *
       * A validade real será confirmada pelas
       * APIs protegidas quando utilizadas.
       */
      if (
        token &&
        role ===
          "caminhoneiro"
      ) {
        router.replace(
          FRETES_ROUTE
        );

        return true;
      }

      /*
       * Sem token:
       * biometria pode fazer uma nova
       * autenticação utilizando as credenciais
       * previamente autorizadas pelo usuário.
       */
      const enabledFlag =
        await Storage.getItem(
          STORAGE_KEYS.biometricEnabled
        );

      const hasHardware =
        await LocalAuthentication.hasHardwareAsync();

      const enrolled =
        await LocalAuthentication.isEnrolledAsync();

      if (
        enabledFlag ===
          "1" &&
        hasHardware &&
        enrolled &&
        !triedBioOnce.current
      ) {
        triedBioOnce.current =
          true;

        return await tryBiometricLogin({
          silent:
            true,
        });
      }

      return false;
    } catch {
      return false;
    }
  }

  /* ======================================================= */
  /* SALVAR SESSÃO */
  /* ======================================================= */

  async function salvarSessao(
    data: LoginResponse
  ) {
    if (
      !data.token ||
      !data.user?.id ||
      data.user.role !==
        "caminhoneiro"
    ) {
      throw new Error(
        "Sessão inválida."
      );
    }

    await Promise.all([
      Storage.setItem(
        STORAGE_KEYS.authToken,
        data.token
      ),

      Storage.setItem(
        STORAGE_KEYS.userRole,
        data.user.role
      ),

      Storage.setItem(
        STORAGE_KEYS.userId,
        String(
          data.user.id
        )
      ),
    ]);

    /*
     * Registra o dispositivo para
     * notificações push.
     */
    registerPushTokenOnBackend(
      API_BASE
    ).catch(
      () => {}
    );
  }

  /* ======================================================= */
  /* LOGIN NA API */
  /* ======================================================= */

  async function fazerLogin(
    cpfNumerico: string,
    senhaInformada: string
  ): Promise<LoginResponse> {
    const res =
      await fetch(
        `${API_BASE}/api/mobile/login`,
        {
          method:
            "POST",

          headers: {
            "Content-Type":
              "application/json",

            Accept:
              "application/json",
          },

          body:
            JSON.stringify({
              email:
                cpfNumerico,

              password:
                senhaInformada,
            }),
        }
      );

    const raw =
      await res
        .text()
        .catch(
          () => ""
        );

    let data:
      | LoginResponse
      | null =
      null;

    try {
      data =
        raw
          ? (JSON.parse(
              raw
            ) as LoginResponse)
          : null;
    } catch {
      data =
        null;
    }

    if (
      !res.ok ||
      !data?.token
    ) {
      throw new Error(
        data?.error ||
          data?.erro ||
          data?.message ||
          "CPF ou senha inválidos."
      );
    }

    if (
      data.user?.role !==
      "caminhoneiro"
    ) {
      throw new Error(
        "Acesso não autorizado."
      );
    }

    return data;
  }

  /* ======================================================= */
  /* LOGIN MANUAL */
  /* ======================================================= */

  async function handleSubmit() {
    setErro(
      ""
    );

    if (!gateActive) {
      setErro(
        "Aplicativo bloqueado no momento."
      );

      return;
    }

    const cpfNumerico =
      cpf.replace(
        /\D/g,
        ""
      );

    if (
      !cpfNumerico ||
      !senha
    ) {
      setErro(
        "Preencha CPF e senha."
      );

      return;
    }

    if (
      cpfNumerico.length !==
      11
    ) {
      setErro(
        "CPF inválido."
      );

      return;
    }

    try {
      setLoading(
        true
      );

      const data =
        await fazerLogin(
          cpfNumerico,
          senha
        );

      await salvarSessao(
        data
      );

      /* =================================================== */
      /* BIOMETRIA */
      /* =================================================== */

      const [
        hasHardware,
        enrolled,
      ] =
        await Promise.all([
          LocalAuthentication.hasHardwareAsync(),

          LocalAuthentication.isEnrolledAsync(),
        ]);

      setBioAvailable(
        Boolean(
          hasHardware &&
            enrolled
        )
      );

      if (
        hasHardware &&
        enrolled
      ) {
        const flag =
          await Storage.getItem(
            STORAGE_KEYS.biometricEnabled
          );

        if (
          flag !==
          "1"
        ) {
          Alert.alert(
            Platform.OS ===
              "ios"
              ? "Ativar Face ID?"
              : "Ativar biometria?",

            "Você quer usar a biometria para entrar mais rapidamente nas próximas vezes?",

            [
              {
                text:
                  "Agora não",

                style:
                  "cancel",

                onPress:
                  () =>
                    router.replace(
                      FRETES_ROUTE
                    ),
              },

              {
                text:
                  "Ativar",

                onPress:
                  async () => {
                    await Promise.all([
                      Storage.setItem(
                        STORAGE_KEYS.biometricCpf,
                        cpfNumerico
                      ),

                      Storage.setItem(
                        STORAGE_KEYS.biometricPassword,
                        senha
                      ),

                      Storage.setItem(
                        STORAGE_KEYS.biometricEnabled,
                        "1"
                      ),
                    ]);

                    setBioEnabled(
                      true
                    );

                    router.replace(
                      FRETES_ROUTE
                    );
                  },
              },
            ]
          );

          return;
        }
      }

      router.replace(
        FRETES_ROUTE
      );
    } catch (error) {
      console.error(
        error
      );

      setErro(
        error instanceof
          Error
          ? error.message
          : "Erro ao tentar entrar. Verifique sua conexão."
      );
    } finally {
      setLoading(
        false
      );
    }
  }

  /* ======================================================= */
  /* BIOMETRIA */
  /* ======================================================= */

  async function tryBiometricLogin(
    opts: {
      silent?: boolean;
    } = {}
  ) {
    const {
      silent =
        false,
    } =
      opts;

    try {
      setBioLoading(
        true
      );

      if (!gateActive) {
        if (!silent) {
          Alert.alert(
            "Aplicativo indisponível",
            "O aplicativo está temporariamente indisponível."
          );
        }

        return false;
      }

      const [
        hasHardware,
        enrolled,
      ] =
        await Promise.all([
          LocalAuthentication.hasHardwareAsync(),

          LocalAuthentication.isEnrolledAsync(),
        ]);

      if (
        !hasHardware ||
        !enrolled
      ) {
        if (!silent) {
          Alert.alert(
            "Biometria indisponível",
            !hasHardware
              ? "Seu aparelho não possui biometria disponível."
              : "Cadastre uma biometria nas configurações do aparelho."
          );
        }

        return false;
      }

      const enabledFlag =
        await Storage.getItem(
          STORAGE_KEYS.biometricEnabled
        );

      if (
        enabledFlag !==
        "1"
      ) {
        if (!silent) {
          Alert.alert(
            Platform.OS ===
              "ios"
              ? "Face ID não configurado"
              : "Biometria não configurada",

            "Entre com CPF e senha e ative a biometria quando solicitado."
          );
        }

        return false;
      }

      const result =
        await LocalAuthentication.authenticateAsync({
          promptMessage:
            Platform.OS ===
            "ios"
              ? "Entrar no Meu Freteiro"
              : "Entrar com biometria",

          cancelLabel:
            "Usar CPF e senha",

          disableDeviceFallback:
            true,
        });

      if (
        !result.success
      ) {
        if (!silent) {
          const biometricError =
            "error" in result
              ? result.error
              : undefined;

          if (
            biometricError ===
              "lockout" ||
            biometricError ===
              "lockout_permanent"
          ) {
            Alert.alert(
              "Biometria bloqueada",
              "Desbloqueie o aparelho com sua senha e tente novamente."
            );
          } else if (
            biometricError &&
            biometricError !==
              "user_cancel" &&
            biometricError !==
              "system_cancel"
          ) {
            Alert.alert(
              "Não foi possível autenticar",
              "Tente novamente."
            );
          }
        }

        return false;
      }

      const [
        savedCpf,
        savedPassword,
      ] =
        await Promise.all([
          Storage.getItem(
            STORAGE_KEYS.biometricCpf
          ),

          Storage.getItem(
            STORAGE_KEYS.biometricPassword
          ),
        ]);

      if (
        !savedCpf ||
        !savedPassword
      ) {
        if (!silent) {
          Alert.alert(
            "Biometria não configurada",
            "Entre novamente com CPF e senha para configurar a biometria."
          );
        }

        return false;
      }

      const data =
        await fazerLogin(
          savedCpf,
          savedPassword
        );

      await salvarSessao(
        data
      );

      router.replace(
        FRETES_ROUTE
      );

      return true;
    } catch (error) {
      console.warn(
        error
      );

      if (!silent) {
        Alert.alert(
          "Não foi possível entrar",
          error instanceof
            Error
            ? error.message
            : "Falha na autenticação biométrica."
        );
      }

      return false;
    } finally {
      setBioLoading(
        false
      );
    }
  }

  /* ======================================================= */
  /* CARREGAMENTO */
  /* ======================================================= */

  if (
    booting ||
    gateChecking
  ) {
    return (
      <SafeAreaView
        style={
          styles.centered
        }
      >
        <ActivityIndicator
          size="large"
          color="#FACC15"
        />

        <Text
          style={
            styles.loadingText
          }
        >
          {gateChecking
            ? "Validando aplicativo..."
            : "Carregando..."}
        </Text>
      </SafeAreaView>
    );
  }

  /* ======================================================= */
  /* GATE BLOQUEADO */
  /* ======================================================= */

  if (!gateActive) {
    return (
      <SafeAreaView
        style={
          styles.blockedContainer
        }
      >
        <Text
          style={
            styles.blockedTitle
          }
        >
          Aplicativo indisponível
        </Text>

        <Text
          style={
            styles.blockedText
          }
        >
          {gateMessage ||
            "O Meu Freteiro está temporariamente indisponível."}
        </Text>

        <TouchableOpacity
          style={[
            styles.button,
            {
              marginTop:
                20,
            },
          ]}
          onPress={
            () =>
              checkGate({
                requireOnlineIfNeverValidated:
                  false,
              })
          }
        >
          <Text
            style={
              styles.buttonText
            }
          >
            Tentar novamente
          </Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  /* ======================================================= */
  /* LOGIN */
  /* ======================================================= */

  return (
    <SafeAreaView
      style={
        styles.safeArea
      }
      edges={[
        "top",
        "left",
        "right",
      ]}
    >
      <KeyboardAvoidingView
        style={{
          flex:
            1,
        }}
        behavior={
          Platform.OS ===
          "ios"
            ? "padding"
            : undefined
        }
      >
        {/* ================================================= */}
        {/* MARCA */}
        {/* ================================================= */}

        <View
          style={[
            styles.header,
            {
              paddingTop:
                (insets.top ??
                  0) +
                12,
            },
          ]}
        >
          <Text
            style={
              styles.brand
            }
          >
            Meu Freteiro
          </Text>

          <Text
            style={
              styles.brandSubtitle
            }
          >
            Encontre oportunidades de frete
          </Text>
        </View>

        {/* ================================================= */}
        {/* FORMULÁRIO */}
        {/* ================================================= */}

        <View
          style={
            styles.container
          }
        >
          <View
            style={
              styles.intro
            }
          >
            <Text
              style={
                styles.title
              }
            >
              Olá, freteiro!
            </Text>

            <Text
              style={
                styles.subtitle
              }
            >
              Entre com seu CPF e senha para acessar sua conta.
            </Text>
          </View>

          {/* CPF */}

          <TextInput
            placeholder="CPF"
            value={
              cpf
            }
            onChangeText={
              (
                value
              ) =>
                setCpf(
                  formatarCpf(
                    value
                  )
                )
            }
            keyboardType="number-pad"
            autoCapitalize="none"
            autoCorrect={
              false
            }
            textContentType="username"
            maxLength={
              14
            }
            editable={
              !loading
            }
            style={
              styles.input
            }
            placeholderTextColor="#9ca3af"
          />

          {/* SENHA */}

          <View
            style={
              styles.passwordContainer
            }
          >
            <TextInput
              placeholder="Senha"
              value={
                senha
              }
              onChangeText={
                setSenha
              }
              secureTextEntry={
                !mostrarSenha
              }
              autoCapitalize="none"
              autoCorrect={
                false
              }
              textContentType="password"
              editable={
                !loading
              }
              style={[
                styles.input,
                styles.passwordInput,
              ]}
              placeholderTextColor="#9ca3af"
            />

            <TouchableOpacity
              onPress={
                () =>
                  setMostrarSenha(
                    (
                      atual
                    ) =>
                      !atual
                  )
              }
              style={
                styles.eyeBtn
              }
              activeOpacity={
                0.8
              }
              disabled={
                loading
              }
              accessibilityRole="button"
              accessibilityLabel={
                mostrarSenha
                  ? "Ocultar senha"
                  : "Mostrar senha"
              }
            >
              <Text
                style={
                  styles.eyeText
                }
              >
                {mostrarSenha
                  ? "Ocultar"
                  : "Ver"}
              </Text>
            </TouchableOpacity>
          </View>

          {/* ERRO */}

          {!!erro && (
            <Text
              style={
                styles.errorText
              }
            >
              {erro}
            </Text>
          )}

          {/* ENTRAR */}

          <TouchableOpacity
            onPress={
              handleSubmit
            }
            style={
              styles.button
            }
            disabled={
              loading
            }
            activeOpacity={
              0.85
            }
          >
            {loading ? (
              <ActivityIndicator
                color="#111827"
              />
            ) : (
              <Text
                style={
                  styles.buttonText
                }
              >
                Entrar
              </Text>
            )}
          </TouchableOpacity>

          {/* BIOMETRIA */}

          {bioAvailable &&
            bioEnabled && (
              <TouchableOpacity
                onPress={
                  () =>
                    tryBiometricLogin()
                }
                style={
                  styles.biometricButton
                }
                disabled={
                  bioLoading
                }
                activeOpacity={
                  0.85
                }
              >
                {bioLoading ? (
                  <ActivityIndicator
                    color="#111827"
                  />
                ) : (
                  <Text
                    style={
                      styles.biometricButtonText
                    }
                  >
                    {Platform.OS ===
                    "ios"
                      ? "Entrar com Face ID"
                      : "Entrar com biometria"}
                  </Text>
                )}
              </TouchableOpacity>
            )}

          {/* LINKS */}

          <TouchableOpacity
            onPress={
              () =>
                router.push(
                  "/recuperar-senha"
                )
            }
            style={
              styles.linkButton
            }
            disabled={
              loading
            }
          >
            <Text
              style={
                styles.linkText
              }
            >
              Esqueceu sua senha?
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={
              () =>
                router.push(
                  "/cadastro"
                )
            }
            style={
              styles.linkButton
            }
            disabled={
              loading
            }
          >
            <Text
              style={
                styles.linkText
              }
            >
              Ainda não tem conta? Cadastre-se
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={
              () =>
                router.push(
                  "/ajuda"
                )
            }
            style={
              styles.linkButton
            }
            accessibilityRole="link"
            accessibilityLabel="Abrir Ajuda e Suporte"
            disabled={
              loading
            }
          >
            <Text
              style={
                styles.secondaryLink
              }
            >
              Precisa de ajuda?
            </Text>
          </TouchableOpacity>

          {/* POLÍTICA */}

          <View
            style={
              styles.policyContainer
            }
          >
            <Text
              style={
                styles.policyText
              }
            >
              Ao continuar, você declara que leu e concorda com nossa
            </Text>

            <TouchableOpacity
              onPress={
                () =>
                  router.push(
                    "/politica-privacidade"
                  )
              }
              accessibilityRole="link"
              accessibilityLabel="Abrir Política de Privacidade"
            >
              <Text
                style={
                  styles.policyLink
                }
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

/* ========================================================= */
/* ESTILOS */
/* ========================================================= */

const styles =
  StyleSheet.create({
    safeArea: {
      flex:
        1,

      backgroundColor:
        "#ffffff",
    },

    centered: {
      flex:
        1,

      alignItems:
        "center",

      justifyContent:
        "center",

      backgroundColor:
        "#ffffff",
    },

    loadingText: {
      marginTop:
        10,

      color:
        "#6b7280",

      fontSize:
        14,
    },

    blockedContainer: {
      flex:
        1,

      alignItems:
        "center",

      justifyContent:
        "center",

      padding:
        24,

      backgroundColor:
        "#ffffff",
    },

    blockedTitle: {
      fontSize:
        22,

      fontWeight:
        "800",

      color:
        "#111827",

      marginBottom:
        8,
    },

    blockedText: {
      textAlign:
        "center",

      color:
        "#6b7280",

      fontSize:
        14,

      lineHeight:
        20,
    },

    header: {
      width:
        "100%",

      paddingHorizontal:
        20,

      paddingBottom:
        18,

      alignItems:
        "center",

      justifyContent:
        "center",

      borderBottomWidth:
        1,

      borderBottomColor:
        "#f1f5f9",

      backgroundColor:
        "#ffffff",
    },

    brand: {
      fontSize:
        27,

      fontWeight:
        "900",

      color:
        "#111827",

      letterSpacing:
        -0.5,
    },

    brandSubtitle: {
      marginTop:
        3,

      fontSize:
        12,

      color:
        "#6b7280",
    },

    container: {
      flex:
        1,

      paddingHorizontal:
        24,

      paddingTop:
        34,

      alignItems:
        "center",

      backgroundColor:
        "#ffffff",
    },

    intro: {
      width:
        "100%",

      marginBottom:
        18,
    },

    title: {
      fontSize:
        22,

      fontWeight:
        "800",

      color:
        "#111827",
    },

    subtitle: {
      fontSize:
        14,

      color:
        "#6b7280",

      marginTop:
        5,

      lineHeight:
        20,
    },

    input: {
      width:
        "100%",

      height:
        INPUT_HEIGHT,

      borderWidth:
        1,

      borderColor:
        "#d1d5db",

      borderRadius:
        12,

      paddingHorizontal:
        14,

      color:
        "#111827",

      marginTop:
        10,

      fontSize:
        14,

      backgroundColor:
        "#ffffff",
    },

    passwordContainer: {
      position:
        "relative",

      width:
        "100%",
    },

    passwordInput: {
      paddingRight:
        70,
    },

    eyeBtn: {
      position:
        "absolute",

      right:
        14,

      top:
        10,

      height:
        INPUT_HEIGHT,

      alignItems:
        "center",

      justifyContent:
        "center",
    },

    eyeText: {
      fontSize:
        12,

      fontWeight:
        "700",

      color:
        "#6b7280",
    },

    errorText: {
      width:
        "100%",

      color:
        "#dc2626",

      textAlign:
        "center",

      marginTop:
        12,

      fontSize:
        13,
    },

    button: {
      width:
        "100%",

      height:
        52,

      backgroundColor:
        "#FACC15",

      borderRadius:
        12,

      alignItems:
        "center",

      justifyContent:
        "center",

      marginTop:
        16,
    },

    buttonText: {
      color:
        "#111827",

      fontWeight:
        "800",

      fontSize:
        15,
    },

    biometricButton: {
      width:
        "100%",

      height:
        50,

      borderRadius:
        12,

      alignItems:
        "center",

      justifyContent:
        "center",

      marginTop:
        10,

      borderWidth:
        1,

      borderColor:
        "#d1d5db",

      backgroundColor:
        "#ffffff",
    },

    biometricButtonText: {
      color:
        "#111827",

      fontWeight:
        "700",

      fontSize:
        14,
    },

    linkButton: {
      marginTop:
        15,

      paddingVertical:
        3,
    },

    linkText: {
      color:
        "#111827",

      fontSize:
        13,

      fontWeight:
        "700",
    },

    secondaryLink: {
      color:
        "#4b5563",

      fontSize:
        13,

      fontWeight:
        "600",
    },

    policyContainer: {
      width:
        "100%",

      marginTop:
        25,

      alignItems:
        "center",
    },

    policyText: {
      fontSize:
        12,

      color:
        "#6b7280",

      textAlign:
        "center",

      paddingHorizontal:
        8,
    },

    policyLink: {
      marginTop:
        5,

      fontSize:
        13,

      fontWeight:
        "700",

      color:
        "#111827",

      textDecorationLine:
        "underline",
    },
  });