// app/(tabs)/perfil.tsx

import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import React, {
  useCallback,
  useState,
} from "react";

import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import {
  SafeAreaView,
} from "react-native-safe-area-context";

import * as Storage from "../../backend/lib/storage";

/* =========================================================
   CONFIGURAÇÃO
========================================================= */

const API_BASE =
  "https://www.meufreteiro.com";

/* =========================================================
   TIPOS
========================================================= */

type CaminhoneiroDados = {
  id: string;

  nome: string;
  cpf: string;
  email: string;
  telefone: string;

  cidade: string;
  estado: string;

  status: string;

  aceitaWhatsapp: boolean;
  aceitaLgpd: boolean;

  tipoVeiculo: string | null;
  placaVeiculo: string | null;

  cnhDocumento: string | null;
  documentoVeiculo: string | null;
  comprovanteEndereco: string | null;

  createdAt?: string;
};

const VAZIO: CaminhoneiroDados = {
  id: "",

  nome: "",
  cpf: "",
  email: "",
  telefone: "",

  cidade: "",
  estado: "",

  status: "",

  aceitaWhatsapp: false,
  aceitaLgpd: false,

  tipoVeiculo: null,
  placaVeiculo: null,

  cnhDocumento: null,
  documentoVeiculo: null,
  comprovanteEndereco: null,
};

/* =========================================================
   HELPERS
========================================================= */

function maskCPF(
  value = ""
) {
  const numeros =
    value.replace(
      /\D/g,
      ""
    );

  return numeros
    .replace(
      /(\d{3})(\d)/,
      "$1.$2"
    )
    .replace(
      /(\d{3})(\d)/,
      "$1.$2"
    )
    .replace(
      /(\d{3})(\d{1,2}).*/,
      "$1-$2"
    );
}

function maskPhone(
  value = ""
) {
  const numeros =
    value.replace(
      /\D/g,
      ""
    );

  if (
    numeros.length <= 10
  ) {
    return numeros
      .replace(
        /(\d{2})(\d{4})(\d{0,4}).*/,
        "($1) $2-$3"
      )
      .trim();
  }

  return numeros
    .replace(
      /(\d{2})(\d{5})(\d{0,4}).*/,
      "($1) $2-$3"
    )
    .trim();
}

function formatarPlaca(
  value?: string | null
) {
  if (!value) {
    return "Não informada";
  }

  return value
    .trim()
    .toUpperCase();
}

function formatarVeiculo(
  value?: string | null
) {
  switch (value) {
    case "MOTO":
      return "Moto";

    case "CARRO":
      return "Carro";

    case "FIORINO_UTILITARIO_PEQUENO":
      return "Fiorino / utilitário pequeno";

    case "VAN":
      return "Van";

    case "CAMINHAO_PEQUENO":
      return "Caminhão pequeno";

    case "CAMINHAO_MEDIO":
      return "Caminhão médio";

    case "OUTRO":
      return "Outro";

    default:
      return "Não informado";
  }
}

function statusInfo(
  status?: string
) {
  const normalizado =
    String(
      status || ""
    )
      .trim()
      .toLowerCase();

  switch (normalizado) {
    case "aprovado":
    case "ativo":
      return {
        titulo:
          "Cadastro aprovado",

        descricao:
          "Seu cadastro está liberado para utilizar o Meu Freteiro.",

        icon:
          "checkmark-circle" as const,

        tipo:
          "success" as const,
      };

    case "desaprovado":
    case "reprovado":
      return {
        titulo:
          "Cadastro não aprovado",

        descricao:
          "Seu cadastro precisa de atenção. Entre em contato com o suporte para mais informações.",

        icon:
          "alert-circle" as const,

        tipo:
          "danger" as const,
      };

    case "pendente":
    case "em_analise":
    case "em análise":
    default:
      return {
        titulo:
          "Cadastro em análise",

        descricao:
          "Seus dados e documentos estão sendo analisados.",

        icon:
          "time" as const,

        tipo:
          "warning" as const,
      };
  }
}

/* =========================================================
   COMPONENTE
========================================================= */

export default function Perfil() {
  const router =
    useRouter();

  const [
    dados,
    setDados,
  ] =
    useState<CaminhoneiroDados>(
      VAZIO
    );

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    refreshing,
    setRefreshing,
  ] =
    useState(false);

  const [
    erro,
    setErro,
  ] =
    useState("");

  /* =======================================================
     LIMPAR SESSÃO
  ======================================================= */

  const limparSessao =
    useCallback(
      async () => {
        await Promise.all([
          Storage.deleteItem(
            "authToken"
          ),

          Storage.deleteItem(
            "userRole"
          ),

          Storage.deleteItem(
            "userId"
          ),
        ]);
      },
      []
    );

  /* =======================================================
     VOLTAR PARA LOGIN
  ======================================================= */

  const voltarLogin =
    useCallback(
      async () => {
        await limparSessao();

        router.replace("/");
      },
      [
        limparSessao,
        router,
      ]
    );

  /* =======================================================
     CARREGAR PERFIL
  ======================================================= */

  const carregar =
    useCallback(
      async (
        modoRefresh = false
      ) => {
        try {
          setErro("");

          if (!modoRefresh) {
            setLoading(true);
          }

          const [
            token,
            userId,
          ] =
            await Promise.all([
              Storage.getItem(
                "authToken"
              ),

              Storage.getItem(
                "userId"
              ),
            ]);

          if (!token) {
            await voltarLogin();
            return;
          }

          if (!userId) {
            setErro(
              "Não foi possível identificar sua conta."
            );

            return;
          }

          /*
           * Utilizamos o endpoint que já existe
           * no backend:
           *
           * GET /api/caminhoneiro/[id]
           *
           * O getApiUser() garante que o freteiro
           * somente consiga acessar o próprio cadastro.
           */

          const response =
            await fetch(
              `${API_BASE}/api/caminhoneiro/${encodeURIComponent(
                userId
              )}`,
              {
                method:
                  "GET",

                headers: {
                  Accept:
                    "application/json",

                  Authorization:
                    `Bearer ${token}`,
                },
              }
            );

          if (
            response.status ===
            401
          ) {
            await voltarLogin();

            return;
          }

          if (
            response.status ===
            403
          ) {
            setErro(
              "Você não possui permissão para acessar este perfil."
            );

            return;
          }

          const body =
            await response
              .json()
              .catch(
                () => null
              );

          if (
            !response.ok
          ) {
            throw new Error(
              body?.error ||
                body?.erro ||
                "Não foi possível carregar seu perfil."
            );
          }

          /*
           * Aceita tanto resposta direta:
           *
           * { nome, cpf, ... }
           *
           * quanto:
           *
           * { caminhoneiro: {...} }
           * { data: {...} }
           */

          const perfil =
            body?.caminhoneiro ??
            body?.data ??
            body;

          if (
            !perfil ||
            typeof perfil !==
              "object"
          ) {
            throw new Error(
              "Resposta inválida ao carregar perfil."
            );
          }

          setDados({
            ...VAZIO,
            ...perfil,

            id:
              String(
                perfil.id ||
                  userId
              ),

            aceitaWhatsapp:
              Boolean(
                perfil.aceitaWhatsapp
              ),

            aceitaLgpd:
              Boolean(
                perfil.aceitaLgpd
              ),

            tipoVeiculo:
              perfil.tipoVeiculo ??
              null,

            placaVeiculo:
              perfil.placaVeiculo ??
              null,

            cnhDocumento:
              perfil.cnhDocumento ??
              null,

            documentoVeiculo:
              perfil.documentoVeiculo ??
              null,

            comprovanteEndereco:
              perfil.comprovanteEndereco ??
              null,
          });
        } catch (
          error: any
        ) {
          console.error(
            "[PERFIL]",
            error?.message ||
              error
          );

          setErro(
            error?.message ||
              "Não foi possível carregar seus dados agora."
          );
        } finally {
          setLoading(false);
          setRefreshing(
            false
          );
        }
      },
      [
        voltarLogin,
      ]
    );

  /* =======================================================
     RECARREGAR AO ENTRAR NA ABA
  ======================================================= */

  useFocusEffect(
    useCallback(() => {
      carregar();
    }, [carregar])
  );

  /* =======================================================
     PULL TO REFRESH
  ======================================================= */

  const onRefresh =
    useCallback(
      async () => {
        setRefreshing(
          true
        );

        await carregar(
          true
        );
      },
      [carregar]
    );

  /* =======================================================
     SAIR
  ======================================================= */

  function sair() {
    Alert.alert(
      "Sair da conta",
      "Deseja sair do Meu Freteiro?",
      [
        {
          text:
            "Cancelar",

          style:
            "cancel",
        },

        {
          text:
            "Sair",

          style:
            "destructive",

          onPress:
            async () => {
              await limparSessao();

              router.replace(
                "/"
              );
            },
        },
      ]
    );
  }

  /* =======================================================
     EXCLUIR CONTA
  ======================================================= */

  function excluirConta() {
    Alert.alert(
      "Excluir conta",
      "A exclusão da conta é permanente. Antes de continuar, recomendamos entrar em contato com o suporte caso tenha alguma dúvida.",
      [
        {
          text:
            "Cancelar",

          style:
            "cancel",
        },

        {
          text:
            "Continuar",

          style:
            "destructive",

          onPress:
            excluirContaConfirmada,
        },
      ]
    );
  }

  async function excluirContaConfirmada() {
    try {
      const [
        token,
        userId,
      ] =
        await Promise.all([
          Storage.getItem(
            "authToken"
          ),

          Storage.getItem(
            "userId"
          ),
        ]);

      if (
        !token ||
        !userId
      ) {
        await voltarLogin();

        return;
      }

      const response =
        await fetch(
          `${API_BASE}/api/account`,
          {
            method:
              "DELETE",

            headers: {
              Accept:
                "application/json",

              Authorization:
                `Bearer ${token}`,

              "x-auth-tipo":
                "caminhoneiro",

              "x-auth-id":
                userId,
            },
          }
        );

      if (
        response.status ===
        401
      ) {
        await voltarLogin();

        return;
      }

      const body =
        await response
          .json()
          .catch(
            () => null
          );

      if (!response.ok) {
        throw new Error(
          body?.error ||
            body?.erro ||
            "Não foi possível excluir sua conta."
        );
      }

      await limparSessao();

      Alert.alert(
        "Conta excluída",
        "Sua conta foi excluída.",
        [
          {
            text:
              "OK",

            onPress:
              () =>
                router.replace(
                  "/"
                ),
          },
        ]
      );
    } catch (
      error: any
    ) {
      Alert.alert(
        "Não foi possível excluir",
        error?.message ||
          "Tente novamente mais tarde."
      );
    }
  }

  /* =======================================================
     LOADING
  ======================================================= */

  if (loading) {
    return (
      <SafeAreaView
        style={
          styles.loading
        }
        edges={[
          "top",
          "left",
          "right",
        ]}
      >
        <ActivityIndicator
          size="large"
          color="#111827"
        />

        <Text
          style={
            styles.loadingText
          }
        >
          Carregando perfil...
        </Text>
      </SafeAreaView>
    );
  }

  const status =
    statusInfo(
      dados.status
    );

  const documentos =
    [
      dados.cnhDocumento,
      dados.documentoVeiculo,
      dados.comprovanteEndereco,
    ].filter(Boolean)
      .length;

  /* =======================================================
     TELA
  ======================================================= */

  return (
    <SafeAreaView
      style={styles.safe}
      edges={[
        "top",
        "left",
        "right",
      ]}
    >
      <ScrollView
        style={
          styles.scroll
        }
        contentContainerStyle={
          styles.content
        }
        refreshControl={
          <RefreshControl
            refreshing={
              refreshing
            }
            onRefresh={
              onRefresh
            }
          />
        }
        showsVerticalScrollIndicator={
          false
        }
      >
        {/* ===============================================
            HEADER
        =============================================== */}

        <View
          style={
            styles.header
          }
        >
          <View
            style={
              styles.avatar
            }
          >
            <Ionicons
              name="person"
              size={30}
              color="#111827"
            />
          </View>

          <View
            style={
              styles.headerText
            }
          >
            <Text
              style={
                styles.title
              }
            >
              Meu perfil
            </Text>

            <Text
              style={
                styles.subtitle
              }
              numberOfLines={
                1
              }
            >
              {dados.nome ||
                "Minha conta"}
            </Text>
          </View>
        </View>

        {/* ===============================================
            ERRO
        =============================================== */}

        {!!erro && (
          <View
            style={
              styles.errorBox
            }
          >
            <Ionicons
              name="alert-circle-outline"
              size={22}
              color="#b91c1c"
            />

            <View
              style={{
                flex: 1,
              }}
            >
              <Text
                style={
                  styles.errorTitle
                }
              >
                Não foi possível carregar tudo
              </Text>

              <Text
                style={
                  styles.errorText
                }
              >
                {erro}
              </Text>
            </View>

            <TouchableOpacity
              onPress={() =>
                carregar()
              }
            >
              <Ionicons
                name="refresh"
                size={22}
                color="#b91c1c"
              />
            </TouchableOpacity>
          </View>
        )}

        {/* ===============================================
            STATUS DO CADASTRO
        =============================================== */}

        <View
          style={[
            styles.statusCard,

            status.tipo ===
              "success" &&
              styles.statusSuccess,

            status.tipo ===
              "warning" &&
              styles.statusWarning,

            status.tipo ===
              "danger" &&
              styles.statusDanger,
          ]}
        >
          <View
            style={
              styles.statusIcon
            }
          >
            <Ionicons
              name={
                status.icon
              }
              size={25}
              color="#111827"
            />
          </View>

          <View
            style={{
              flex: 1,
            }}
          >
            <Text
              style={
                styles.statusTitle
              }
            >
              {status.titulo}
            </Text>

            <Text
              style={
                styles.statusDescription
              }
            >
              {
                status.descricao
              }
            </Text>
          </View>
        </View>

        {/* ===============================================
            DADOS PESSOAIS
        =============================================== */}

        <SectionTitle
          titulo="Dados pessoais"
        />

        <View
          style={styles.card}
        >
          <InfoRow
            icon="person-outline"
            label="Nome"
            value={
              dados.nome ||
              "Não informado"
            }
          />

          <Divider />

          <InfoRow
            icon="mail-outline"
            label="E-mail"
            value={
              dados.email ||
              "Não informado"
            }
          />

          <Divider />

          <InfoRow
            icon="card-outline"
            label="CPF"
            value={
              dados.cpf
                ? maskCPF(
                    dados.cpf
                  )
                : "Não informado"
            }
          />

          <Divider />

          <InfoRow
            icon="call-outline"
            label="Telefone"
            value={
              dados.telefone
                ? maskPhone(
                    dados.telefone
                  )
                : "Não informado"
            }
          />

          <Divider />

          <InfoRow
            icon="location-outline"
            label="Localização"
            value={
              dados.cidade
                ? `${dados.cidade}${
                    dados.estado
                      ? ` - ${dados.estado}`
                      : ""
                  }`
                : "Não informada"
            }
          />
        </View>

        {/* ===============================================
            VEÍCULO
        =============================================== */}

        <SectionTitle
          titulo="Meu veículo"
        />

        <View
          style={styles.card}
        >
          <InfoRow
            icon="car-outline"
            label="Tipo de veículo"
            value={formatarVeiculo(
              dados.tipoVeiculo
            )}
          />

          <Divider />

          <InfoRow
            icon="key-outline"
            label="Placa"
            value={formatarPlaca(
              dados.placaVeiculo
            )}
          />
        </View>

        {/* ===============================================
            DOCUMENTOS
        =============================================== */}

        <SectionTitle
          titulo="Documentos"
        />

        <View
          style={styles.card}
        >
          <MenuRow
            icon="documents-outline"
            title="Documentos enviados"
            subtitle={`${documentos} de 3 documentos cadastrados`}
            showArrow={false}
          />

          <View
            style={
              styles.documentList
            }
          >
            <DocumentStatus
              label="CNH"
              enviado={
                !!dados.cnhDocumento
              }
            />

            <DocumentStatus
              label="Documento do veículo"
              enviado={
                !!dados.documentoVeiculo
              }
            />

            <DocumentStatus
              label="Comprovante de endereço"
              enviado={
                !!dados.comprovanteEndereco
              }
            />
          </View>
        </View>

        {/* ===============================================
            PREFERÊNCIAS
        =============================================== */}

        <SectionTitle
          titulo="Preferências"
        />

        <View
          style={styles.card}
        >
          <InfoRow
            icon="logo-whatsapp"
            label="Contato por WhatsApp"
            value={
              dados.aceitaWhatsapp
                ? "Autorizado"
                : "Não autorizado"
            }
          />
        </View>

        {/* ===============================================
            SUPORTE
        =============================================== */}

        <SectionTitle
          titulo="Suporte e informações"
        />

        <View
          style={styles.card}
        >
          <MenuRow
            icon="help-circle-outline"
            title="Ajuda e suporte"
            subtitle="Dúvidas sobre o Meu Freteiro"
            onPress={() =>
              router.push(
                "/(tabs)/ajuda"
              )
            }
          />

          <Divider />

          <MenuRow
            icon="shield-checkmark-outline"
            title="Privacidade"
            subtitle="Política de Privacidade"
            onPress={() =>
              router.push(
                "/politica-privacidade"
              )
            }
          />
        </View>

        {/* ===============================================
            CONTA
        =============================================== */}

        <SectionTitle
          titulo="Conta"
        />

        <View
          style={styles.card}
        >
          <MenuRow
            icon="log-out-outline"
            title="Sair da conta"
            onPress={sair}
          />

          <Divider />

          <MenuRow
            icon="trash-outline"
            title="Excluir conta"
            danger
            onPress={
              excluirConta
            }
          />
        </View>

        <Text
          style={
            styles.footer
          }
        >
          Meu Freteiro
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

/* =========================================================
   COMPONENTES
========================================================= */

function SectionTitle({
  titulo,
}: {
  titulo: string;
}) {
  return (
    <Text
      style={
        styles.sectionTitle
      }
    >
      {titulo}
    </Text>
  );
}

function Divider() {
  return (
    <View
      style={
        styles.divider
      }
    />
  );
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: React.ComponentProps<
    typeof Ionicons
  >["name"];

  label: string;
  value: string;
}) {
  return (
    <View
      style={
        styles.infoRow
      }
    >
      <View
        style={
          styles.smallIcon
        }
      >
        <Ionicons
          name={icon}
          size={19}
          color="#475569"
        />
      </View>

      <View
        style={{
          flex: 1,
        }}
      >
        <Text
          style={
            styles.infoLabel
          }
        >
          {label}
        </Text>

        <Text
          style={
            styles.infoValue
          }
        >
          {value}
        </Text>
      </View>
    </View>
  );
}

function MenuRow({
  icon,
  title,
  subtitle,
  danger = false,
  showArrow = true,
  onPress,
}: {
  icon: React.ComponentProps<
    typeof Ionicons
  >["name"];

  title: string;
  subtitle?: string;

  danger?: boolean;
  showArrow?: boolean;

  onPress?: () => void;
}) {
  const content = (
    <View
      style={
        styles.menuRow
      }
    >
      <View
        style={[
          styles.menuIcon,

          danger &&
            styles.menuIconDanger,
        ]}
      >
        <Ionicons
          name={icon}
          size={20}
          color={
            danger
              ? "#dc2626"
              : "#111827"
          }
        />
      </View>

      <View
        style={{
          flex: 1,
        }}
      >
        <Text
          style={[
            styles.menuTitle,

            danger &&
              styles.menuTitleDanger,
          ]}
        >
          {title}
        </Text>

        {!!subtitle && (
          <Text
            style={
              styles.menuSubtitle
            }
          >
            {subtitle}
          </Text>
        )}
      </View>

      {showArrow &&
        !!onPress && (
          <Ionicons
            name="chevron-forward"
            size={20}
            color="#94a3b8"
          />
        )}
    </View>
  );

  if (!onPress) {
    return content;
  }

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
    >
      {content}
    </TouchableOpacity>
  );
}

function DocumentStatus({
  label,
  enviado,
}: {
  label: string;
  enviado: boolean;
}) {
  return (
    <View
      style={
        styles.documentRow
      }
    >
      <Ionicons
        name={
          enviado
            ? "checkmark-circle"
            : "alert-circle-outline"
        }
        size={18}
        color={
          enviado
            ? "#16a34a"
            : "#d97706"
        }
      />

      <Text
        style={
          styles.documentLabel
        }
      >
        {label}
      </Text>

      <Text
        style={[
          styles.documentStatus,

          enviado
            ? styles.documentSent
            : styles.documentMissing,
        ]}
      >
        {enviado
          ? "Enviado"
          : "Pendente"}
      </Text>
    </View>
  );
}

/* =========================================================
   ESTILOS
========================================================= */

const styles =
  StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor:
        "#f8fafc",
    },

    scroll: {
      flex: 1,
    },

    content: {
      paddingHorizontal:
        20,

      paddingTop: 14,
      paddingBottom: 35,
    },

    loading: {
      flex: 1,

      alignItems:
        "center",

      justifyContent:
        "center",

      backgroundColor:
        "#f8fafc",
    },

    loadingText: {
      marginTop: 10,

      fontSize: 14,

      color: "#64748b",
    },

    /* HEADER */

    header: {
      flexDirection:
        "row",

      alignItems:
        "center",

      marginBottom: 20,
    },

    avatar: {
      width: 58,
      height: 58,

      borderRadius: 18,

      alignItems:
        "center",

      justifyContent:
        "center",

      backgroundColor:
        "#facc15",

      marginRight: 14,
    },

    headerText: {
      flex: 1,
    },

    title: {
      fontSize: 25,

      fontWeight:
        "900",

      color: "#111827",

      letterSpacing:
        -0.5,
    },

    subtitle: {
      marginTop: 2,

      fontSize: 14,

      color: "#64748b",
    },

    /* STATUS */

    statusCard: {
      flexDirection:
        "row",

      alignItems:
        "center",

      gap: 12,

      padding: 15,

      borderRadius: 16,

      borderWidth: 1,

      marginBottom: 24,
    },

    statusSuccess: {
      backgroundColor:
        "#f0fdf4",

      borderColor:
        "#bbf7d0",
    },

    statusWarning: {
      backgroundColor:
        "#fffbeb",

      borderColor:
        "#fde68a",
    },

    statusDanger: {
      backgroundColor:
        "#fef2f2",

      borderColor:
        "#fecaca",
    },

    statusIcon: {
      width: 42,
      height: 42,

      borderRadius: 13,

      alignItems:
        "center",

      justifyContent:
        "center",

      backgroundColor:
        "#facc15",
    },

    statusTitle: {
      fontSize: 15,

      fontWeight:
        "800",

      color: "#111827",
    },

    statusDescription: {
      marginTop: 3,

      fontSize: 12,

      lineHeight: 17,

      color: "#64748b",
    },

    /* ERRO */

    errorBox: {
      flexDirection:
        "row",

      alignItems:
        "center",

      gap: 10,

      backgroundColor:
        "#fef2f2",

      borderWidth: 1,

      borderColor:
        "#fecaca",

      borderRadius: 14,

      padding: 13,

      marginBottom: 18,
    },

    errorTitle: {
      fontSize: 13,

      fontWeight:
        "800",

      color: "#991b1b",
    },

    errorText: {
      marginTop: 2,

      fontSize: 12,

      color: "#b91c1c",
    },

    /* SEÇÕES */

    sectionTitle: {
      marginLeft: 2,
      marginBottom: 8,
      marginTop: 4,

      fontSize: 13,

      fontWeight:
        "800",

      color: "#475569",

      textTransform:
        "uppercase",

      letterSpacing:
        0.4,
    },

    card: {
      backgroundColor:
        "#ffffff",

      borderRadius: 18,

      borderWidth: 1,

      borderColor:
        "#e2e8f0",

      paddingHorizontal:
        15,

      marginBottom: 22,
    },

    divider: {
      height: 1,

      backgroundColor:
        "#f1f5f9",
    },

    /* INFO */

    infoRow: {
      minHeight: 68,

      flexDirection:
        "row",

      alignItems:
        "center",

      gap: 12,

      paddingVertical: 10,
    },

    smallIcon: {
      width: 35,
      height: 35,

      borderRadius: 11,

      alignItems:
        "center",

      justifyContent:
        "center",

      backgroundColor:
        "#f8fafc",
    },

    infoLabel: {
      fontSize: 11,

      fontWeight:
        "700",

      color: "#94a3b8",

      marginBottom: 2,
    },

    infoValue: {
      fontSize: 14,

      fontWeight:
        "600",

      color: "#1e293b",
    },

    /* MENU */

    menuRow: {
      minHeight: 68,

      flexDirection:
        "row",

      alignItems:
        "center",

      gap: 12,

      paddingVertical: 10,
    },

    menuIcon: {
      width: 38,
      height: 38,

      borderRadius: 12,

      alignItems:
        "center",

      justifyContent:
        "center",

      backgroundColor:
        "#fef3c7",
    },

    menuIconDanger: {
      backgroundColor:
        "#fef2f2",
    },

    menuTitle: {
      fontSize: 14,

      fontWeight:
        "700",

      color: "#111827",
    },

    menuTitleDanger: {
      color: "#dc2626",
    },

    menuSubtitle: {
      marginTop: 2,

      fontSize: 12,

      color: "#94a3b8",
    },

    /* DOCUMENTOS */

    documentList: {
      borderTopWidth: 1,

      borderTopColor:
        "#f1f5f9",

      paddingTop: 6,
      paddingBottom: 10,
    },

    documentRow: {
      minHeight: 38,

      flexDirection:
        "row",

      alignItems:
        "center",

      gap: 8,
    },

    documentLabel: {
      flex: 1,

      fontSize: 12,

      color: "#475569",
    },

    documentStatus: {
      fontSize: 11,

      fontWeight:
        "800",
    },

    documentSent: {
      color: "#15803d",
    },

    documentMissing: {
      color: "#b45309",
    },

    /* FOOTER */

    footer: {
      marginTop: 2,

      textAlign:
        "center",

      fontSize: 12,

      fontWeight:
        "700",

      color: "#cbd5e1",
    },
  });