// app/(tabs)/propostas.tsx

import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import {
    ActivityIndicator,
    FlatList,
    RefreshControl,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Storage from "../../backend/lib/storage";

const API_BASE = "https://www.meufreteiro.com";

/* =========================================================
   TIPOS
========================================================= */

type FreteDaProposta = {
  id: string;

  cidadeColeta?: string | null;
  cidadeEntrega?: string | null;

  dataColeta?: string | null;
  dataEntrega?: string | null;

  descricao?: string | null;
  pesoAproximado?: number | null;

  status?: string | null;
  ativo?: boolean | null;
};

type Proposta = {
  id: string;

  freteId: string;

  valor: string | number;

  mensagem?: string | null;

  status:
    | "ENVIADA"
    | "ACEITA"
    | "RECUSADA"
    | "CANCELADA"
    | string;

  createdAt?: string | null;
  updatedAt?: string | null;
  aceitaEm?: string | null;

  frete?: FreteDaProposta | null;
};

type RespostaApi =
  | Proposta[]
  | {
      propostas?: Proposta[];
      data?: Proposta[];

      mensagem?: string;
      message?: string;
      erro?: string;
      error?: string;
    };

/* =========================================================
   HELPERS
========================================================= */

function normalizarStatus(
  status?: string | null
) {
  return String(
    status || ""
  ).toUpperCase();
}

function extrairMensagemErro(
  body: any,
  fallback: string
) {
  return (
    body?.mensagem ||
    body?.message ||
    body?.erro ||
    body?.error ||
    fallback
  );
}

async function lerJsonSeguro(
  response: Response
) {
  const texto = await response
    .text()
    .catch(() => "");

  if (!texto) {
    return null;
  }

  try {
    return JSON.parse(texto);
  } catch {
    return null;
  }
}

function extrairLista(
  body: RespostaApi | null
): Proposta[] {
  if (!body) {
    return [];
  }

  if (Array.isArray(body)) {
    return body;
  }

  if (
    Array.isArray(
      body.propostas
    )
  ) {
    return body.propostas;
  }

  if (
    Array.isArray(
      body.data
    )
  ) {
    return body.data;
  }

  return [];
}

function formatarBRL(
  valor:
    | string
    | number
    | null
    | undefined
) {
  if (
    valor === null ||
    valor === undefined ||
    valor === ""
  ) {
    return "—";
  }

  /*
   * O backend retorna Decimal como string.
   * Ex.: "850.00"
   */
  const numero =
    typeof valor === "number"
      ? valor
      : Number(valor);

  if (
    !Number.isFinite(numero)
  ) {
    return "—";
  }

  return numero.toLocaleString(
    "pt-BR",
    {
      style: "currency",
      currency: "BRL",
    }
  );
}

function formatarData(
  valor?: string | null
) {
  if (!valor) {
    return null;
  }

  const data = new Date(
    valor
  );

  if (
    Number.isNaN(
      data.getTime()
    )
  ) {
    return null;
  }

  return new Intl.DateTimeFormat(
    "pt-BR",
    {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }
  ).format(data);
}

function tempoRelativo(
  valor?: string | null
) {
  if (!valor) {
    return "";
  }

  const data =
    new Date(valor);

  const diferenca =
    Date.now() -
    data.getTime();

  if (
    Number.isNaN(diferenca) ||
    diferenca < 0
  ) {
    return "";
  }

  const minutos =
    Math.floor(
      diferenca / 60_000
    );

  if (minutos < 1) {
    return "agora";
  }

  if (minutos < 60) {
    return `há ${minutos} min`;
  }

  const horas =
    Math.floor(
      minutos / 60
    );

  if (horas < 24) {
    return `há ${horas} ${
      horas === 1
        ? "hora"
        : "horas"
    }`;
  }

  const dias =
    Math.floor(
      horas / 24
    );

  if (dias < 30) {
    return `há ${dias} ${
      dias === 1
        ? "dia"
        : "dias"
    }`;
  }

  return (
    formatarData(valor) ||
    ""
  );
}

/* =========================================================
   STATUS VISUAL
========================================================= */

function configuracaoStatus(
  statusOriginal?: string | null
) {
  const status =
    normalizarStatus(
      statusOriginal
    );

  switch (status) {
    case "ACEITA":
      return {
        label:
          "Proposta aceita",

        descricao:
          "Contato liberado",

        icon:
          "checkmark-circle" as const,

        textColor:
          "#166534",

        backgroundColor:
          "#f0fdf4",

        borderColor:
          "#bbf7d0",
      };

    case "RECUSADA":
      return {
        label:
          "Não aceita",

        descricao:
          "A empresa escolheu outra proposta",

        icon:
          "close-circle" as const,

        textColor:
          "#b91c1c",

        backgroundColor:
          "#fef2f2",

        borderColor:
          "#fecaca",
      };

    case "CANCELADA":
      return {
        label:
          "Cancelada",

        descricao:
          "Esta proposta foi cancelada",

        icon:
          "ban-outline" as const,

        textColor:
          "#475569",

        backgroundColor:
          "#f8fafc",

        borderColor:
          "#e2e8f0",
      };

    default:
      return {
        label:
          "Aguardando análise",

        descricao:
          "Sua proposta foi enviada",

        icon:
          "time-outline" as const,

        textColor:
          "#92400e",

        backgroundColor:
          "#fffbeb",

        borderColor:
          "#fde68a",
      };
  }
}

/* =========================================================
   TELA
========================================================= */

export default function PropostasScreen() {
  const router =
    useRouter();

  const [
    propostas,
    setPropostas,
  ] =
    useState<Proposta[]>([]);

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
     CARREGAR PROPOSTAS
  ======================================================= */

  const carregarPropostas =
    useCallback(
      async (
        silencioso =
          false
      ) => {
        try {
          if (!silencioso) {
            setLoading(true);
          }

          setErro("");

          const token =
            await Storage.getItem(
              "authToken"
            );

          if (!token) {
            setPropostas([]);

            setErro(
              "Sua sessão expirou. Entre novamente."
            );

            return;
          }

          const response =
            await fetch(
              `${API_BASE}/api/propostas/minhas`,
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

          const body =
            (await lerJsonSeguro(
              response
            )) as RespostaApi | null;

          if (
            response.status ===
            401
          ) {
            setPropostas([]);

            setErro(
              "Sua sessão expirou. Entre novamente."
            );

            return;
          }

          if (
            response.status ===
            403
          ) {
            setPropostas([]);

            setErro(
              "Seu usuário não possui acesso às propostas."
            );

            return;
          }

          if (!response.ok) {
            throw new Error(
              extrairMensagemErro(
                body,
                "Não foi possível carregar suas propostas."
              )
            );
          }

          setPropostas(
            extrairLista(
              body
            )
          );
        } catch (error) {
          console.error(
            "Erro ao carregar propostas:",
            error
          );

          setPropostas([]);

          setErro(
            error instanceof Error
              ? error.message
              : "Não foi possível carregar suas propostas."
          );
        } finally {
          setLoading(false);
          setRefreshing(false);
        }
      },
      []
    );

  /*
   * Atualiza sempre que o usuário entra
   * novamente nesta aba.
   *
   * Isso é importante porque a empresa pode
   * ter aceitado uma proposta enquanto o
   * freteiro estava em outra tela.
   */
  useFocusEffect(
    useCallback(() => {
      carregarPropostas();
    }, [
      carregarPropostas,
    ])
  );

  /* =======================================================
     REFRESH
  ======================================================= */

  function atualizar() {
    setRefreshing(true);

    carregarPropostas(
      true
    );
  }

  /* =======================================================
     ABRIR FRETE
  ======================================================= */

  function abrirFrete(
    proposta: Proposta
  ) {
    const freteId =
      proposta.frete?.id ||
      proposta.freteId;

    if (!freteId) {
      return;
    }

    router.push({
      pathname:
        "/(tabs)/fretes/[id]",

      params: {
        id:
          String(
            freteId
          ),
      },
    });
  }

  /* =======================================================
     RENDER
  ======================================================= */

  const renderProposta =
    useCallback(
      ({
        item,
      }: {
        item: Proposta;
      }) => {
        const frete =
          item.frete;

        const config =
          configuracaoStatus(
            item.status
          );

        const aceita =
          normalizarStatus(
            item.status
          ) === "ACEITA";

        const origem =
          frete?.cidadeColeta ||
          "Origem não informada";

        const destino =
          frete?.cidadeEntrega ||
          "Destino não informado";

        const dataColeta =
          formatarData(
            frete?.dataColeta
          );

        return (
          <TouchableOpacity
            style={
              styles.card
            }
            activeOpacity={
              0.85
            }
            onPress={
              () =>
                abrirFrete(
                  item
                )
            }
          >
            {/* STATUS */}

            <View
              style={
                styles.cardTop
              }
            >
              <View
                style={[
                  styles.statusBadge,

                  {
                    backgroundColor:
                      config.backgroundColor,

                    borderColor:
                      config.borderColor,
                  },
                ]}
              >
                <Ionicons
                  name={
                    config.icon
                  }
                  size={15}
                  color={
                    config.textColor
                  }
                />

                <Text
                  style={[
                    styles.statusText,

                    {
                      color:
                        config.textColor,
                    },
                  ]}
                >
                  {config.label}
                </Text>
              </View>

              {!!item.createdAt && (
                <Text
                  style={
                    styles.createdText
                  }
                >
                  {tempoRelativo(
                    item.createdAt
                  )}
                </Text>
              )}
            </View>

            {/* ROTA */}

            <View
              style={
                styles.routeArea
              }
            >
              <View
                style={
                  styles.timeline
                }
              >
                <View
                  style={
                    styles.originDot
                  }
                />

                <View
                  style={
                    styles.routeLine
                  }
                />

                <View
                  style={
                    styles.destinationDot
                  }
                />
              </View>

              <View
                style={
                  styles.routeContent
                }
              >
                <View>
                  <Text
                    style={
                      styles.routeLabel
                    }
                  >
                    COLETA
                  </Text>

                  <Text
                    style={
                      styles.city
                    }
                    numberOfLines={
                      2
                    }
                  >
                    {origem}
                  </Text>
                </View>

                <View
                  style={
                    styles.destinationArea
                  }
                >
                  <Text
                    style={
                      styles.routeLabel
                    }
                  >
                    ENTREGA
                  </Text>

                  <Text
                    style={
                      styles.city
                    }
                    numberOfLines={
                      2
                    }
                  >
                    {destino}
                  </Text>
                </View>
              </View>
            </View>

            {/* DATA */}

            {dataColeta && (
              <View
                style={
                  styles.dateRow
                }
              >
                <Ionicons
                  name="calendar-outline"
                  size={15}
                  color="#64748b"
                />

                <Text
                  style={
                    styles.dateText
                  }
                >
                  Coleta:{" "}
                  {dataColeta}
                </Text>
              </View>
            )}

            {/* VALOR */}

            <View
              style={
                styles.valueArea
              }
            >
              <View>
                <Text
                  style={
                    styles.valueLabel
                  }
                >
                  Sua proposta
                </Text>

                <Text
                  style={
                    styles.value
                  }
                >
                  {formatarBRL(
                    item.valor
                  )}
                </Text>
              </View>

              <View
                style={
                  styles.statusDescriptionArea
                }
              >
                <Text
                  style={[
                    styles.statusDescription,

                    {
                      color:
                        config.textColor,
                    },
                  ]}
                >
                  {config.descricao}
                </Text>
              </View>
            </View>

            {/* MENSAGEM */}

            {!!item.mensagem && (
              <View
                style={
                  styles.messageBox
                }
              >
                <Text
                  style={
                    styles.messageLabel
                  }
                >
                  Sua mensagem
                </Text>

                <Text
                  style={
                    styles.messageText
                  }
                  numberOfLines={
                    2
                  }
                >
                  {item.mensagem}
                </Text>
              </View>
            )}

            {/* FOOTER */}

            <View
              style={
                styles.cardFooter
              }
            >
              <Text
                style={
                  styles.footerHint
                }
              >
                {aceita
                  ? "Acesse para ver o contato"
                  : "Acesse para ver os detalhes"}
              </Text>

              <View
                style={[
                  styles.openButton,

                  aceita &&
                    styles.openButtonAccepted,
                ]}
              >
                <Text
                  style={[
                    styles.openButtonText,

                    aceita &&
                      styles.openButtonTextAccepted,
                  ]}
                >
                  {aceita
                    ? "Ver contato"
                    : "Ver frete"}
                </Text>

                <Ionicons
                  name="chevron-forward"
                  size={16}
                  color={
                    aceita
                      ? "#166534"
                      : "#ffffff"
                  }
                />
              </View>
            </View>
          </TouchableOpacity>
        );
      },
      []
    );

  /* =======================================================
     LOADING
  ======================================================= */

  if (loading) {
    return (
      <SafeAreaView
        style={
          styles.center
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
          Carregando propostas...
        </Text>
      </SafeAreaView>
    );
  }

  /* =======================================================
     UI
  ======================================================= */

  return (
    <SafeAreaView
      style={
        styles.safe
      }
      edges={[
        "top",
        "left",
        "right",
      ]}
    >
      {/* HEADER */}

      <View
        style={
          styles.header
        }
      >
        <View>
          <Text
            style={
              styles.headerTitle
            }
          >
            Minhas propostas
          </Text>

          <Text
            style={
              styles.headerSubtitle
            }
          >
            Acompanhe as propostas que você enviou
          </Text>
        </View>

        <View
          style={
            styles.headerIcon
          }
        >
          <Ionicons
            name="document-text-outline"
            size={22}
            color="#111827"
          />
        </View>
      </View>

      {/* ERRO */}

      {!!erro && (
        <View
          style={
            styles.errorBox
          }
        >
          <Ionicons
            name="alert-circle-outline"
            size={20}
            color="#b91c1c"
          />

          <View
            style={
              styles.errorContent
            }
          >
            <Text
              style={
                styles.errorText
              }
            >
              {erro}
            </Text>

            <TouchableOpacity
              onPress={
                () =>
                  carregarPropostas()
              }
            >
              <Text
                style={
                  styles.retryText
                }
              >
                Tentar novamente
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <FlatList
        data={
          propostas
        }
        keyExtractor={
          item =>
            String(
              item.id
            )
        }
        renderItem={
          renderProposta
        }
        contentContainerStyle={[
          styles.listContent,

          propostas.length ===
            0 &&
            !erro
            ? styles.emptyListContent
            : null,
        ]}
        showsVerticalScrollIndicator={
          false
        }
        refreshControl={
          <RefreshControl
            refreshing={
              refreshing
            }
            onRefresh={
              atualizar
            }
          />
        }
        ListHeaderComponent={
          propostas.length >
            0 &&
          !erro ? (
            <View
              style={
                styles.listHeader
              }
            >
              <Text
                style={
                  styles.listTitle
                }
              >
                {propostas.length}{" "}
                {propostas.length ===
                1
                  ? "proposta enviada"
                  : "propostas enviadas"}
              </Text>

              <Text
                style={
                  styles.listSubtitle
                }
              >
                Puxe a tela para baixo para atualizar.
              </Text>
            </View>
          ) : null
        }
        ListEmptyComponent={
          !erro ? (
            <View
              style={
                styles.empty
              }
            >
              <View
                style={
                  styles.emptyIcon
                }
              >
                <Ionicons
                  name="document-text-outline"
                  size={34}
                  color="#64748b"
                />
              </View>

              <Text
                style={
                  styles.emptyTitle
                }
              >
                Nenhuma proposta ainda
              </Text>

              <Text
                style={
                  styles.emptyText
                }
              >
                Encontre um frete interessante e envie sua primeira proposta.
              </Text>

              <TouchableOpacity
                style={
                  styles.findButton
                }
                activeOpacity={
                  0.85
                }
                onPress={
                  () =>
                    router.push(
                      "/(tabs)/fretes"
                    )
                }
              >
                <Ionicons
                  name="search-outline"
                  size={18}
                  color="#111827"
                />

                <Text
                  style={
                    styles.findButtonText
                  }
                >
                  Encontrar fretes
                </Text>
              </TouchableOpacity>
            </View>
          ) : null
        }
      />
    </SafeAreaView>
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

    center: {
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
      color: "#64748b",
      fontSize: 13,
    },

    /* HEADER */

    header: {
      minHeight: 74,
      paddingHorizontal: 18,
      paddingVertical: 12,
      flexDirection: "row",
      alignItems: "center",
      justifyContent:
        "space-between",
      backgroundColor:
        "#ffffff",
      borderBottomWidth: 1,
      borderBottomColor:
        "#f1f5f9",
    },

    headerTitle: {
      color: "#111827",
      fontSize: 20,
      fontWeight: "900",
    },

    headerSubtitle: {
      marginTop: 2,
      color: "#64748b",
      fontSize: 11,
    },

    headerIcon: {
      width: 44,
      height: 44,
      borderRadius: 14,
      alignItems:
        "center",
      justifyContent:
        "center",
      backgroundColor:
        "#facc15",
    },

    /* ERRO */

    errorBox: {
      marginHorizontal: 16,
      marginTop: 14,
      padding: 13,
      borderRadius: 12,
      flexDirection: "row",
      alignItems:
        "flex-start",
      gap: 9,
      backgroundColor:
        "#fef2f2",
      borderWidth: 1,
      borderColor:
        "#fecaca",
    },

    errorContent: {
      flex: 1,
    },

    errorText: {
      color: "#b91c1c",
      fontSize: 12,
      lineHeight: 17,
      fontWeight: "600",
    },

    retryText: {
      marginTop: 5,
      color: "#991b1b",
      fontSize: 11,
      fontWeight: "900",
    },

    /* LISTA */

    listContent: {
      paddingHorizontal: 16,
      paddingTop: 14,
      paddingBottom: 32,
    },

    emptyListContent: {
      flexGrow: 1,
      justifyContent:
        "center",
    },

    listHeader: {
      marginBottom: 5,
    },

    listTitle: {
      color: "#334155",
      fontSize: 13,
      fontWeight: "800",
    },

    listSubtitle: {
      marginTop: 2,
      marginBottom: 4,
      color: "#94a3b8",
      fontSize: 10,
    },

    /* CARD */

    card: {
      marginTop: 10,
      padding: 16,
      borderRadius: 16,
      backgroundColor:
        "#ffffff",
      borderWidth: 1,
      borderColor:
        "#e2e8f0",
    },

    cardTop: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent:
        "space-between",
      gap: 8,
    },

    statusBadge: {
      minHeight: 29,
      paddingHorizontal: 9,
      paddingVertical: 5,
      borderRadius: 999,
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      borderWidth: 1,
    },

    statusText: {
      fontSize: 10,
      fontWeight: "900",
    },

    createdText: {
      color: "#94a3b8",
      fontSize: 9,
    },

    /* ROTA */

    routeArea: {
      marginTop: 16,
      flexDirection: "row",
    },

    timeline: {
      width: 20,
      alignItems:
        "center",
      paddingTop: 5,
    },

    originDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor:
        "#facc15",
      borderWidth: 2,
      borderColor:
        "#111827",
    },

    routeLine: {
      width: 2,
      height: 31,
      marginVertical: 3,
      backgroundColor:
        "#cbd5e1",
    },

    destinationDot: {
      width: 10,
      height: 10,
      borderRadius: 2,
      backgroundColor:
        "#111827",
    },

    routeContent: {
      flex: 1,
      marginLeft: 7,
    },

    destinationArea: {
      marginTop: 16,
    },

    routeLabel: {
      color: "#94a3b8",
      fontSize: 9,
      fontWeight: "900",
      letterSpacing: 0.8,
    },

    city: {
      marginTop: 1,
      color: "#111827",
      fontSize: 14,
      fontWeight: "800",
    },

    /* DATA */

    dateRow: {
      marginTop: 13,
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },

    dateText: {
      color: "#64748b",
      fontSize: 11,
      fontWeight: "600",
    },

    /* VALOR */

    valueArea: {
      marginTop: 15,
      paddingTop: 14,
      borderTopWidth: 1,
      borderTopColor:
        "#f1f5f9",
      flexDirection: "row",
      alignItems:
        "center",
      justifyContent:
        "space-between",
      gap: 12,
    },

    valueLabel: {
      color: "#64748b",
      fontSize: 10,
      fontWeight: "700",
    },

    value: {
      marginTop: 2,
      color: "#111827",
      fontSize: 20,
      fontWeight: "900",
    },

    statusDescriptionArea: {
      flex: 1,
      alignItems:
        "flex-end",
    },

    statusDescription: {
      textAlign: "right",
      fontSize: 10,
      fontWeight: "700",
    },

    /* MENSAGEM */

    messageBox: {
      marginTop: 12,
      padding: 11,
      borderRadius: 10,
      backgroundColor:
        "#f8fafc",
    },

    messageLabel: {
      color: "#64748b",
      fontSize: 9,
      fontWeight: "800",
    },

    messageText: {
      marginTop: 4,
      color: "#475569",
      fontSize: 11,
      lineHeight: 16,
    },

    /* FOOTER */

    cardFooter: {
      marginTop: 14,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor:
        "#f1f5f9",
      flexDirection: "row",
      alignItems: "center",
      justifyContent:
        "space-between",
      gap: 10,
    },

    footerHint: {
      flex: 1,
      color: "#94a3b8",
      fontSize: 9,
    },

    openButton: {
      minHeight: 37,
      paddingHorizontal: 12,
      borderRadius: 9,
      flexDirection: "row",
      alignItems: "center",
      justifyContent:
        "center",
      gap: 3,
      backgroundColor:
        "#111827",
    },

    openButtonAccepted: {
      backgroundColor:
        "#f0fdf4",
      borderWidth: 1,
      borderColor:
        "#bbf7d0",
    },

    openButtonText: {
      color: "#ffffff",
      fontSize: 10,
      fontWeight: "900",
    },

    openButtonTextAccepted: {
      color: "#166534",
    },

    /* EMPTY */

    empty: {
      alignItems:
        "center",
      paddingHorizontal: 28,
    },

    emptyIcon: {
      width: 68,
      height: 68,
      borderRadius: 34,
      alignItems:
        "center",
      justifyContent:
        "center",
      backgroundColor:
        "#f1f5f9",
    },

    emptyTitle: {
      marginTop: 15,
      color: "#111827",
      fontSize: 17,
      fontWeight: "900",
    },

    emptyText: {
      maxWidth: 280,
      marginTop: 6,
      color: "#64748b",
      textAlign: "center",
      fontSize: 12,
      lineHeight: 18,
    },

    findButton: {
      minHeight: 48,
      marginTop: 18,
      paddingHorizontal: 18,
      borderRadius: 10,
      flexDirection: "row",
      alignItems: "center",
      justifyContent:
        "center",
      gap: 7,
      backgroundColor:
        "#facc15",
    },

    findButtonText: {
      color: "#111827",
      fontSize: 12,
      fontWeight: "900",
    },
  });