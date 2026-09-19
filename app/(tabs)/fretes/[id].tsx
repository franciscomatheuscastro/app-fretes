// app/frete/[id].tsx

import { Ionicons } from "@expo/vector-icons";
import * as Linking from "expo-linking";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Storage from "../../../backend/lib/storage";

const API_BASE = "https://www.meufreteiro.com";

/* =========================================================
   TIPOS
========================================================= */

type Contato = {
  nome?: string | null;
  telefone?: string | null;
  whatsapp?: string | null;
};

type Frete = {
  id: string;

  cidadeColeta: string;
  cidadeEntrega: string;

  dataColeta?: string | null;
  dataEntrega?: string | null;

  descricao?: string | null;
  observacoes?: string | null;

  fotos?: string[];

  pesoAproximado?: number | null;
  temEscada?: string | null;
  precisaAjudante?: boolean | null;

  createdAt?: string | null;
  status?: string | null;
  ativo?: boolean;

  contatoLiberado?: boolean;
  propostaAceita?: boolean;

  contato?: Contato | null;

  _count?: {
    propostas?: number;
  };
};

type Proposta = {
  id: string;
  freteId?: string;

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

  contato?: Contato | null;
  contatoLiberado?: boolean;
};

type ApiObject = {
  proposta?: Proposta | null;
  data?: Proposta | null;

  mensagem?: string;
  message?: string;
  erro?: string;
  error?: string;

  [key: string]: any;
};

/* =========================================================
   HELPERS
========================================================= */

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

function formatarData(
  valor?: string | null
) {
  if (!valor) {
    return "Não informada";
  }

  const data = new Date(valor);

  if (
    Number.isNaN(
      data.getTime()
    )
  ) {
    return "Não informada";
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

function formatarPeso(
  peso?: number | null
) {
  if (
    peso == null ||
    !Number.isFinite(peso)
  ) {
    return "Não informado";
  }

  return `${peso.toLocaleString(
    "pt-BR"
  )} kg`;
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
    return "";
  }

  const numero =
    typeof valor === "number"
      ? valor
      : Number(
          String(valor)
            .replace(/\./g, "")
            .replace(",", ".")
        );

  if (
    !Number.isFinite(numero)
  ) {
    return "";
  }

  return numero.toLocaleString(
    "pt-BR",
    {
      style: "currency",
      currency: "BRL",
    }
  );
}

function valorParaApi(
  valor: string
) {
  const limpo = valor
    .replace(/[^\d,.-]/g, "")
    .trim();

  if (!limpo) {
    return NaN;
  }

  /*
   * Exemplos:
   * 1500 -> 1500
   * 1500,50 -> 1500.50
   * 1.500,50 -> 1500.50
   */
  const normalizado =
    limpo.includes(",")
      ? limpo
          .replace(/\./g, "")
          .replace(",", ".")
      : limpo;

  return Number(normalizado);
}

function formatarValorDigitado(
  texto: string
) {
  /*
   * Mantém somente números e vírgula.
   * Não força máscara monetária para não
   * atrapalhar a digitação no celular.
   */
  let valor = texto.replace(
    /[^\d,]/g,
    ""
  );

  const primeiraVirgula =
    valor.indexOf(",");

  if (primeiraVirgula >= 0) {
    const antes =
      valor.slice(
        0,
        primeiraVirgula
      );

    const depois =
      valor
        .slice(
          primeiraVirgula + 1
        )
        .replace(/,/g, "")
        .slice(0, 2);

    valor =
      `${antes},${depois}`;
  }

  return valor;
}

function normalizarStatus(
  status?: string | null
) {
  return (
    status || ""
  ).toUpperCase();
}

function labelStatus(
  status?: string | null
) {
  switch (
    normalizarStatus(status)
  ) {
    case "ENVIADA":
      return "Proposta enviada";

    case "ACEITA":
      return "Proposta aceita";

    case "RECUSADA":
      return "Proposta não aceita";

    case "CANCELADA":
      return "Proposta cancelada";

    default:
      return status || "Proposta enviada";
  }
}

function statusIcon(
  status?: string | null
): keyof typeof Ionicons.glyphMap {
  switch (
    normalizarStatus(status)
  ) {
    case "ACEITA":
      return "checkmark-circle";

    case "RECUSADA":
      return "close-circle";

    case "CANCELADA":
      return "ban-outline";

    default:
      return "time-outline";
  }
}

function extrairProposta(
  body: any
): Proposta | null {
  if (!body) {
    return null;
  }

  if (
    body.proposta &&
    typeof body.proposta ===
      "object"
  ) {
    return body.proposta;
  }

  if (
    body.data &&
    typeof body.data ===
      "object"
  ) {
    return body.data;
  }

  if (
    body.id &&
    body.status
  ) {
    return body as Proposta;
  }

  return null;
}

function extrairContato(
  frete: Frete | null,
  proposta: Proposta | null
): Contato | null {
  return (
    proposta?.contato ||
    frete?.contato ||
    null
  );
}

/* =========================================================
   TELA
========================================================= */

export default function FreteDetalheScreen() {
  const router =
    useRouter();

  const {
    id: rawId,
  } =
    useLocalSearchParams<{
      id?:
        | string
        | string[];
    }>();

  const id =
    Array.isArray(rawId)
      ? rawId[0] || ""
      : rawId || "";

  const [
    frete,
    setFrete,
  ] =
    useState<Frete | null>(
      null
    );

  const [
    proposta,
    setProposta,
  ] =
    useState<Proposta | null>(
      null
    );

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    erro,
    setErro,
  ] =
    useState("");

  const [
    modalAberto,
    setModalAberto,
  ] =
    useState(false);

  const [
    valor,
    setValor,
  ] =
    useState("");

  const [
    mensagem,
    setMensagem,
  ] =
    useState("");

  const [
    enviando,
    setEnviando,
  ] =
    useState(false);

  /* =======================================================
     CARREGAR DETALHE
  ======================================================= */

  const carregar =
    useCallback(
      async () => {
        if (!id) {
          setErro(
            "Frete inválido."
          );

          setLoading(false);

          return;
        }

        try {
          setLoading(true);
          setErro("");

          const token =
            await Storage.getItem(
              "authToken"
            );

          if (!token) {
            setErro(
              "Sua sessão expirou. Faça login novamente."
            );

            return;
          }

          /* -------------------------------
             FRETE
          -------------------------------- */

          const responseFrete =
            await fetch(
              `${API_BASE}/api/fretes/buscar/${encodeURIComponent(
                id
              )}`,
              {
                method: "GET",

                headers: {
                  Accept:
                    "application/json",

                  Authorization:
                    `Bearer ${token}`,
                },
              }
            );

          const bodyFrete =
            await lerJsonSeguro(
              responseFrete
            );

          if (
            responseFrete.status ===
            401
          ) {
            setErro(
              "Sua sessão expirou. Faça login novamente."
            );

            return;
          }

          if (
            responseFrete.status ===
            404
          ) {
            setErro(
              "Este frete não está mais disponível."
            );

            return;
          }

          if (
            !responseFrete.ok
          ) {
            throw new Error(
              extrairMensagemErro(
                bodyFrete,
                "Não foi possível carregar o frete."
              )
            );
          }

          const freteRecebido =
            (bodyFrete?.frete ||
              bodyFrete?.data ||
              bodyFrete) as Frete;

          setFrete(
            freteRecebido
          );

          /* -------------------------------
             MINHA PROPOSTA
          -------------------------------- */

          try {
            const responseProposta =
              await fetch(
                `${API_BASE}/api/propostas/minha?freteId=${encodeURIComponent(
                  id
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

            const bodyProposta =
              await lerJsonSeguro(
                responseProposta
              );

            /*
             * 404 pode simplesmente significar:
             * este freteiro ainda não enviou proposta.
             */
            if (
              responseProposta.status ===
              404
            ) {
              setProposta(
                null
              );
            } else if (
              responseProposta.ok
            ) {
              setProposta(
                extrairProposta(
                  bodyProposta
                )
              );
            } else if (
              responseProposta.status ===
              401
            ) {
              setErro(
                "Sua sessão expirou. Faça login novamente."
              );

              return;
            } else {
              console.warn(
                "Não foi possível consultar a proposta:",
                bodyProposta
              );
            }
          } catch (
            propostaError
          ) {
            console.warn(
              "Erro ao consultar proposta:",
              propostaError
            );
          }
        } catch (error) {
          console.error(
            "Erro ao carregar frete:",
            error
          );

          setErro(
            error instanceof Error
              ? error.message
              : "Não foi possível carregar o frete."
          );
        } finally {
          setLoading(false);
        }
      },
      [id]
    );

  useEffect(() => {
    carregar();
  }, [carregar]);

  /* =======================================================
     ENVIAR PROPOSTA
  ======================================================= */

  async function enviarProposta() {
    if (
      !frete ||
      enviando
    ) {
      return;
    }

    const valorNumerico =
      valorParaApi(
        valor
      );

    if (
      !Number.isFinite(
        valorNumerico
      ) ||
      valorNumerico <= 0
    ) {
      Alert.alert(
        "Valor inválido",
        "Informe o valor da sua proposta."
      );

      return;
    }

    try {
      setEnviando(true);

      const token =
        await Storage.getItem(
          "authToken"
        );

      if (!token) {
        Alert.alert(
          "Sessão expirada",
          "Entre novamente para enviar sua proposta."
        );

        return;
      }

      const response =
        await fetch(
          `${API_BASE}/api/propostas`,
          {
            method:
              "POST",

            headers: {
              Accept:
                "application/json",

              "Content-Type":
                "application/json",

              Authorization:
                `Bearer ${token}`,
            },

            body:
              JSON.stringify({
                freteId:
                  String(
                    frete.id
                  ),

                valor:
                  valorNumerico,

                mensagem:
                  mensagem.trim() ||
                  undefined,
              }),
          }
        );

      const body =
        await lerJsonSeguro(
          response
        );

      if (
        response.status ===
        401
      ) {
        Alert.alert(
          "Sessão expirada",
          "Entre novamente para continuar."
        );

        return;
      }

      if (
        response.status ===
          409 ||
        response.status ===
          400
      ) {
        Alert.alert(
          "Proposta",
          extrairMensagemErro(
            body,
            "Não foi possível enviar esta proposta."
          )
        );

        /*
         * Atualiza para verificar se a causa
         * foi proposta já existente.
         */
        await carregar();

        return;
      }

      if (!response.ok) {
        throw new Error(
          extrairMensagemErro(
            body,
            "Não foi possível enviar a proposta."
          )
        );
      }

      const propostaCriada =
        extrairProposta(
          body
        );

      if (
        propostaCriada
      ) {
        setProposta(
          propostaCriada
        );
      } else {
        /*
         * Caso a API retorne somente sucesso,
         * consulta novamente o backend.
         */
        await carregar();
      }

      setModalAberto(
        false
      );

      setValor("");
      setMensagem("");

      Alert.alert(
        "Proposta enviada!",
        "A empresa recebeu sua proposta. Você poderá acompanhar o andamento pelo Meu Freteiro."
      );
    } catch (error) {
      console.error(
        "Erro ao enviar proposta:",
        error
      );

      Alert.alert(
        "Erro",
        error instanceof Error
          ? error.message
          : "Não foi possível enviar a proposta."
      );
    } finally {
      setEnviando(false);
    }
  }

  /* =======================================================
     WHATSAPP
  ======================================================= */

  async function abrirWhatsApp() {
    if (
      !frete ||
      !proposta ||
      normalizarStatus(
        proposta.status
      ) !== "ACEITA"
    ) {
      Alert.alert(
        "Contato indisponível",
        "O contato é liberado somente quando sua proposta for aceita."
      );

      return;
    }

    const contato =
      extrairContato(
        frete,
        proposta
      );

    const raw =
      contato?.whatsapp ||
      contato?.telefone ||
      "";

    const digits =
      String(raw).replace(
        /\D/g,
        ""
      );

    if (!digits) {
      Alert.alert(
        "Contato indisponível",
        "A proposta foi aceita, mas não encontramos um WhatsApp cadastrado para este frete."
      );

      return;
    }

    const phone =
      digits.startsWith(
        "55"
      )
        ? digits
        : `55${digits}`;

    const mensagemWhats =
      `Olá! Minha proposta para o frete de ${frete.cidadeColeta} para ${frete.cidadeEntrega} foi aceita no Meu Freteiro. Podemos conversar?`;

    const encoded =
      encodeURIComponent(
        mensagemWhats
      );

    const urls = [
      `whatsapp://send?phone=${phone}&text=${encoded}`,

      `https://wa.me/${phone}?text=${encoded}`,
    ];

    for (
      const url of urls
    ) {
      try {
        await Linking.openURL(
          url
        );

        return;
      } catch {
        // tenta a próxima opção
      }
    }

    Alert.alert(
      "WhatsApp",
      "Não foi possível abrir o WhatsApp."
    );
  }

  /* =======================================================
     LOADING
  ======================================================= */

  if (loading) {
    return (
      <SafeAreaView
        style={
          styles.center
        }
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
          Carregando frete...
        </Text>
      </SafeAreaView>
    );
  }

  /* =======================================================
     ERRO
  ======================================================= */

  if (
    erro ||
    !frete
  ) {
    return (
      <SafeAreaView
        style={
          styles.center
        }
      >
        <View
          style={
            styles.errorIcon
          }
        >
          <Ionicons
            name="alert-circle-outline"
            size={34}
            color="#b91c1c"
          />
        </View>

        <Text
          style={
            styles.errorTitle
          }
        >
          Não foi possível abrir o frete
        </Text>

        <Text
          style={
            styles.errorText
          }
        >
          {erro ||
            "Frete não encontrado."}
        </Text>

        <TouchableOpacity
          style={
            styles.backErrorButton
          }
          onPress={
            () =>
              router.back()
          }
        >
          <Text
            style={
              styles.backErrorButtonText
            }
          >
            Voltar
          </Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  /* =======================================================
     ESTADOS DA PROPOSTA
  ======================================================= */

  const status =
    normalizarStatus(
      proposta?.status
    );

  const propostaAceita =
    status ===
    "ACEITA";

  const contato =
    extrairContato(
      frete,
      proposta
    );

  const telefoneContato =
    contato?.whatsapp ||
    contato?.telefone ||
    null;

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
        <TouchableOpacity
          style={
            styles.headerButton
          }
          onPress={
            () =>
              router.back()
          }
          activeOpacity={
            0.8
          }
        >
          <Ionicons
            name="arrow-back"
            size={22}
            color="#111827"
          />
        </TouchableOpacity>

        <View
          style={
            styles.headerTextArea
          }
        >
          <Text
            style={
              styles.headerTitle
            }
          >
            Detalhes do frete
          </Text>

          <Text
            style={
              styles.headerSubtitle
            }
          >
            Confira as informações antes de enviar sua proposta
          </Text>
        </View>

        <View
          style={
            styles.headerSpacer
          }
        />
      </View>

      <ScrollView
        style={
          styles.scroll
        }
        contentContainerStyle={
          styles.content
        }
        showsVerticalScrollIndicator={
          false
        }
        keyboardShouldPersistTaps="handled"
      >
        {/* ROTA */}

        <View
          style={
            styles.card
          }
        >
          <Text
            style={
              styles.cardTitle
            }
          >
            Rota
          </Text>

          <View
            style={
              styles.route
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
                    styles.routeCity
                  }
                >
                  {frete.cidadeColeta}
                </Text>

                <Text
                  style={
                    styles.routeDate
                  }
                >
                  {formatarData(
                    frete.dataColeta
                  )}
                </Text>
              </View>

              <View
                style={
                  styles.destinationContent
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
                    styles.routeCity
                  }
                >
                  {frete.cidadeEntrega}
                </Text>

                <Text
                  style={
                    styles.routeDate
                  }
                >
                  {formatarData(
                    frete.dataEntrega
                  )}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* SOBRE O FRETE */}

        <View
          style={
            styles.card
          }
        >
          <Text
            style={
              styles.cardTitle
            }
          >
            Sobre o frete
          </Text>

          {!!frete.descricao && (
            <Text
              style={
                styles.description
              }
            >
              {frete.descricao}
            </Text>
          )}

          <View
            style={
              styles.detailsGrid
            }
          >
            <View
              style={
                styles.detailItem
              }
            >
              <View
                style={
                  styles.detailIcon
                }
              >
                <Ionicons
                  name="cube-outline"
                  size={20}
                  color="#111827"
                />
              </View>

              <View
                style={
                  styles.detailTextArea
                }
              >
                <Text
                  style={
                    styles.detailLabel
                  }
                >
                  Peso aproximado
                </Text>

                <Text
                  style={
                    styles.detailValue
                  }
                >
                  {formatarPeso(
                    frete.pesoAproximado
                  )}
                </Text>
              </View>
            </View>

            <View
              style={
                styles.detailItem
              }
            >
              <View
                style={
                  styles.detailIcon
                }
              >
                <Ionicons
                  name="people-outline"
                  size={20}
                  color="#111827"
                />
              </View>

              <View
                style={
                  styles.detailTextArea
                }
              >
                <Text
                  style={
                    styles.detailLabel
                  }
                >
                  Precisa de ajudante
                </Text>

                <Text
                  style={
                    styles.detailValue
                  }
                >
                  {frete.precisaAjudante ===
                  true
                    ? "Sim"
                    : frete.precisaAjudante ===
                        false
                      ? "Não"
                      : "Não informado"}
                </Text>
              </View>
            </View>

            <View
              style={
                styles.detailItem
              }
            >
              <View
                style={
                  styles.detailIcon
                }
              >
                <Ionicons
                  name="layers-outline"
                  size={20}
                  color="#111827"
                />
              </View>

              <View
                style={
                  styles.detailTextArea
                }
              >
                <Text
                  style={
                    styles.detailLabel
                  }
                >
                  Escadas
                </Text>

                <Text
                  style={
                    styles.detailValue
                  }
                >
                  {frete.temEscada ||
                    "Não informado"}
                </Text>
              </View>
            </View>
          </View>

          {!!frete.observacoes && (
            <View
              style={
                styles.observationBox
              }
            >
              <View
                style={
                  styles.observationHeader
                }
              >
                <Ionicons
                  name="information-circle-outline"
                  size={18}
                  color="#92400e"
                />

                <Text
                  style={
                    styles.observationTitle
                  }
                >
                  Observações
                </Text>
              </View>

              <Text
                style={
                  styles.observationText
                }
              >
                {frete.observacoes}
              </Text>
            </View>
          )}
        </View>

        {/* FOTOS */}

        {!!frete.fotos?.length && (
          <View
            style={
              styles.card
            }
          >
            <Text
              style={
                styles.cardTitle
              }
            >
              Fotos
            </Text>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={
                false
              }
              contentContainerStyle={
                styles.photosRow
              }
            >
              {frete.fotos.map(
                (
                  foto,
                  index
                ) => (
                  <Image
                    key={`${foto}-${index}`}
                    source={{
                      uri:
                        foto,
                    }}
                    style={
                      styles.photo
                    }
                    resizeMode="cover"
                  />
                )
              )}
            </ScrollView>
          </View>
        )}

        {/* PROPOSTA */}

        <View
          style={[
            styles.card,
            styles.proposalCard,
          ]}
        >
          {!proposta ? (
            <>
              <View
                style={
                  styles.proposalHeader
                }
              >
                <View
                  style={
                    styles.proposalIcon
                  }
                >
                  <Ionicons
                    name="cash-outline"
                    size={23}
                    color="#111827"
                  />
                </View>

                <View
                  style={
                    styles.proposalHeaderText
                  }
                >
                  <Text
                    style={
                      styles.proposalTitle
                    }
                  >
                    Interessado neste frete?
                  </Text>

                  <Text
                    style={
                      styles.proposalSubtitle
                    }
                  >
                    Envie seu valor para a empresa analisar.
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                style={
                  styles.primaryButton
                }
                activeOpacity={
                  0.85
                }
                onPress={
                  () =>
                    setModalAberto(
                      true
                    )
                }
              >
                <Ionicons
                  name="paper-plane-outline"
                  size={18}
                  color="#111827"
                />

                <Text
                  style={
                    styles.primaryButtonText
                  }
                >
                  Enviar proposta
                </Text>
              </TouchableOpacity>

              <View
                style={
                  styles.privacyRow
                }
              >
                <Ionicons
                  name="lock-closed-outline"
                  size={14}
                  color="#64748b"
                />

                <Text
                  style={
                    styles.privacyText
                  }
                >
                  O contato da empresa será liberado somente se sua proposta for aceita.
                </Text>
              </View>
            </>
          ) : (
            <>
              <View
                style={
                  styles.statusHeader
                }
              >
                <View
                  style={[
                    styles.statusIcon,

                    propostaAceita &&
                      styles.statusIconAccepted,
                  ]}
                >
                  <Ionicons
                    name={statusIcon(
                      proposta.status
                    )}
                    size={24}
                    color={
                      propostaAceita
                        ? "#166534"
                        : status ===
                            "RECUSADA"
                          ? "#b91c1c"
                          : "#92400e"
                    }
                  />
                </View>

                <View
                  style={
                    styles.proposalHeaderText
                  }
                >
                  <Text
                    style={
                      styles.proposalTitle
                    }
                  >
                    {labelStatus(
                      proposta.status
                    )}
                  </Text>

                  <Text
                    style={
                      styles.proposalSubtitle
                    }
                  >
                    {propostaAceita
                      ? "A empresa aceitou sua proposta."
                      : status ===
                          "RECUSADA"
                        ? "Esta proposta não foi aceita pela empresa."
                        : "Aguarde a análise da empresa."}
                  </Text>
                </View>
              </View>

              <View
                style={
                  styles.proposalValueBox
                }
              >
                <Text
                  style={
                    styles.proposalValueLabel
                  }
                >
                  Sua proposta
                </Text>

                <Text
                  style={
                    styles.proposalValue
                  }
                >
                  {formatarBRL(
                    proposta.valor
                  )}
                </Text>
              </View>

              {!!proposta.mensagem && (
                <View
                  style={
                    styles.sentMessage
                  }
                >
                  <Text
                    style={
                      styles.sentMessageLabel
                    }
                  >
                    Mensagem enviada
                  </Text>

                  <Text
                    style={
                      styles.sentMessageText
                    }
                  >
                    {proposta.mensagem}
                  </Text>
                </View>
              )}

              {propostaAceita && (
                <View
                  style={
                    styles.contactBox
                  }
                >
                  <View
                    style={
                      styles.contactHeader
                    }
                  >
                    <Ionicons
                      name="checkmark-circle"
                      size={22}
                      color="#166534"
                    />

                    <View
                      style={
                        styles.contactHeaderText
                      }
                    >
                      <Text
                        style={
                          styles.contactTitle
                        }
                      >
                        Contato liberado
                      </Text>

                      <Text
                        style={
                          styles.contactSubtitle
                        }
                      >
                        Agora você pode conversar diretamente sobre o frete.
                      </Text>
                    </View>
                  </View>

                  {!!contato?.nome && (
                    <View
                      style={
                        styles.contactInfoRow
                      }
                    >
                      <Ionicons
                        name="business-outline"
                        size={17}
                        color="#475569"
                      />

                      <Text
                        style={
                          styles.contactInfoText
                        }
                      >
                        {contato.nome}
                      </Text>
                    </View>
                  )}

                  {!!telefoneContato && (
                    <View
                      style={
                        styles.contactInfoRow
                      }
                    >
                      <Ionicons
                        name="call-outline"
                        size={17}
                        color="#475569"
                      />

                      <Text
                        style={
                          styles.contactInfoText
                        }
                      >
                        {telefoneContato}
                      </Text>
                    </View>
                  )}

                  <TouchableOpacity
                    style={
                      styles.whatsappButton
                    }
                    activeOpacity={
                      0.85
                    }
                    onPress={
                      abrirWhatsApp
                    }
                  >
                    <Ionicons
                      name="logo-whatsapp"
                      size={20}
                      color="#ffffff"
                    />

                    <Text
                      style={
                        styles.whatsappButtonText
                      }
                    >
                      Conversar pelo WhatsApp
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </>
          )}
        </View>

        <TouchableOpacity
          style={
            styles.bottomBackButton
          }
          onPress={
            () =>
              router.back()
          }
          activeOpacity={
            0.8
          }
        >
          <Ionicons
            name="arrow-back-outline"
            size={17}
            color="#475569"
          />

          <Text
            style={
              styles.bottomBackText
            }
          >
            Voltar aos fretes
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {/* ===================================================
          MODAL DE PROPOSTA
      ==================================================== */}

      <Modal
        visible={
          modalAberto
        }
        transparent
        animationType="slide"
        onRequestClose={
          () => {
            if (
              !enviando
            ) {
              setModalAberto(
                false
              );
            }
          }
        }
      >
        <KeyboardAvoidingView
          style={
            styles.modalBackdrop
          }
          behavior={
            Platform.OS ===
            "ios"
              ? "padding"
              : undefined
          }
        >
          <TouchableOpacity
            style={
              StyleSheet.absoluteFill
            }
            activeOpacity={1}
            onPress={
              () => {
                if (
                  !enviando
                ) {
                  setModalAberto(
                    false
                  );
                }
              }
            }
          />

          <View
            style={
              styles.modalCard
            }
          >
            <View
              style={
                styles.modalHandle
              }
            />

            <View
              style={
                styles.modalHeader
              }
            >
              <View>
                <Text
                  style={
                    styles.modalTitle
                  }
                >
                  Enviar proposta
                </Text>

                <Text
                  style={
                    styles.modalSubtitle
                  }
                >
                  Informe quanto você cobra para realizar este frete.
                </Text>
              </View>

              <TouchableOpacity
                style={
                  styles.modalClose
                }
                onPress={
                  () =>
                    setModalAberto(
                      false
                    )
                }
                disabled={
                  enviando
                }
              >
                <Ionicons
                  name="close"
                  size={21}
                  color="#111827"
                />
              </TouchableOpacity>
            </View>

            <Text
              style={
                styles.fieldLabel
              }
            >
              Valor da proposta
            </Text>

            <View
              style={
                styles.moneyInput
              }
            >
              <Text
                style={
                  styles.currencyPrefix
                }
              >
                R$
              </Text>

              <TextInput
                value={
                  valor
                }
                onChangeText={
                  texto =>
                    setValor(
                      formatarValorDigitado(
                        texto
                      )
                    )
                }
                placeholder="0,00"
                placeholderTextColor="#94a3b8"
                keyboardType={
                  Platform.OS ===
                  "ios"
                    ? "decimal-pad"
                    : "numeric"
                }
                style={
                  styles.moneyTextInput
                }
                editable={
                  !enviando
                }
              />
            </View>

            <Text
              style={[
                styles.fieldLabel,
                {
                  marginTop:
                    16,
                },
              ]}
            >
              Mensagem{" "}
              <Text
                style={
                  styles.optional
                }
              >
                (opcional)
              </Text>
            </Text>

            <TextInput
              value={
                mensagem
              }
              onChangeText={
                setMensagem
              }
              placeholder="Ex.: Tenho disponibilidade para realizar a coleta na data informada."
              placeholderTextColor="#94a3b8"
              multiline
              maxLength={500}
              textAlignVertical="top"
              style={
                styles.messageInput
              }
              editable={
                !enviando
              }
            />

            <Text
              style={
                styles.characterCount
              }
            >
              {mensagem.length}/500
            </Text>

            <TouchableOpacity
              style={[
                styles.modalSubmitButton,

                enviando &&
                  styles.buttonDisabled,
              ]}
              activeOpacity={
                0.85
              }
              onPress={
                enviarProposta
              }
              disabled={
                enviando
              }
            >
              {enviando ? (
                <ActivityIndicator
                  color="#111827"
                />
              ) : (
                <>
                  <Ionicons
                    name="paper-plane-outline"
                    size={18}
                    color="#111827"
                  />

                  <Text
                    style={
                      styles.modalSubmitText
                    }
                  >
                    Enviar proposta
                  </Text>
                </>
              )}
            </TouchableOpacity>

            <Text
              style={
                styles.modalNotice
              }
            >
              Ao enviar, a empresa poderá analisar o valor e aceitar ou recusar sua proposta.
            </Text>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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

    scroll: {
      flex: 1,
    },

    content: {
      padding: 16,
      paddingBottom: 36,
      gap: 12,
    },

    center: {
      flex: 1,
      alignItems:
        "center",
      justifyContent:
        "center",
      padding: 24,
      backgroundColor:
        "#f8fafc",
    },

    loadingText: {
      marginTop: 10,
      color: "#64748b",
      fontSize: 13,
    },

    errorIcon: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor:
        "#fef2f2",
      alignItems:
        "center",
      justifyContent:
        "center",
    },

    errorTitle: {
      marginTop: 14,
      color: "#111827",
      fontSize: 17,
      fontWeight: "900",
    },

    errorText: {
      marginTop: 6,
      color: "#64748b",
      textAlign:
        "center",
      lineHeight: 19,
    },

    backErrorButton: {
      marginTop: 18,
      paddingHorizontal: 20,
      paddingVertical: 11,
      borderRadius: 10,
      backgroundColor:
        "#111827",
    },

    backErrorButtonText: {
      color: "#ffffff",
      fontWeight: "800",
    },

    /* HEADER */

    header: {
      minHeight: 68,
      paddingHorizontal: 14,
      paddingVertical: 10,
      flexDirection: "row",
      alignItems: "center",
      backgroundColor:
        "#ffffff",
      borderBottomWidth: 1,
      borderBottomColor:
        "#f1f5f9",
    },

    headerButton: {
      width: 42,
      height: 42,
      borderRadius: 21,
      alignItems:
        "center",
      justifyContent:
        "center",
      backgroundColor:
        "#f8fafc",
      borderWidth: 1,
      borderColor:
        "#e2e8f0",
    },

    headerTextArea: {
      flex: 1,
      alignItems:
        "center",
      paddingHorizontal: 8,
    },

    headerTitle: {
      color: "#111827",
      fontSize: 16,
      fontWeight: "900",
    },

    headerSubtitle: {
      marginTop: 2,
      color: "#64748b",
      fontSize: 10,
      textAlign: "center",
    },

    headerSpacer: {
      width: 42,
    },

    /* CARDS */

    card: {
      padding: 16,
      borderRadius: 16,
      backgroundColor:
        "#ffffff",
      borderWidth: 1,
      borderColor:
        "#e2e8f0",
    },

    cardTitle: {
      marginBottom: 14,
      color: "#111827",
      fontSize: 15,
      fontWeight: "900",
    },

    /* ROTA */

    route: {
      flexDirection: "row",
    },

    timeline: {
      width: 20,
      alignItems:
        "center",
      paddingTop: 5,
    },

    originDot: {
      width: 11,
      height: 11,
      borderRadius: 6,
      backgroundColor:
        "#facc15",
      borderWidth: 2,
      borderColor:
        "#111827",
    },

    routeLine: {
      width: 2,
      height: 48,
      marginVertical: 4,
      backgroundColor:
        "#cbd5e1",
    },

    destinationDot: {
      width: 11,
      height: 11,
      borderRadius: 2,
      backgroundColor:
        "#111827",
    },

    routeContent: {
      flex: 1,
      marginLeft: 8,
    },

    destinationContent: {
      marginTop: 18,
    },

    routeLabel: {
      color: "#94a3b8",
      fontSize: 9,
      fontWeight: "900",
      letterSpacing: 0.8,
    },

    routeCity: {
      marginTop: 1,
      color: "#111827",
      fontSize: 16,
      fontWeight: "900",
    },

    routeDate: {
      marginTop: 3,
      color: "#64748b",
      fontSize: 11,
    },

    /* DETALHES */

    description: {
      marginBottom: 16,
      color: "#475569",
      fontSize: 13,
      lineHeight: 20,
    },

    detailsGrid: {
      gap: 10,
    },

    detailItem: {
      minHeight: 58,
      flexDirection: "row",
      alignItems: "center",
      padding: 11,
      borderRadius: 11,
      backgroundColor:
        "#f8fafc",
      borderWidth: 1,
      borderColor:
        "#f1f5f9",
    },

    detailIcon: {
      width: 38,
      height: 38,
      borderRadius: 10,
      alignItems:
        "center",
      justifyContent:
        "center",
      backgroundColor:
        "#facc15",
    },

    detailTextArea: {
      flex: 1,
      marginLeft: 11,
    },

    detailLabel: {
      color: "#64748b",
      fontSize: 10,
      fontWeight: "700",
    },

    detailValue: {
      marginTop: 2,
      color: "#111827",
      fontSize: 13,
      fontWeight: "800",
    },

    observationBox: {
      marginTop: 14,
      padding: 12,
      borderRadius: 11,
      backgroundColor:
        "#fffbeb",
      borderWidth: 1,
      borderColor:
        "#fde68a",
    },

    observationHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },

    observationTitle: {
      color: "#92400e",
      fontSize: 12,
      fontWeight: "900",
    },

    observationText: {
      marginTop: 6,
      color: "#78350f",
      fontSize: 12,
      lineHeight: 18,
    },

    /* FOTOS */

    photosRow: {
      gap: 9,
    },

    photo: {
      width: 180,
      height: 125,
      borderRadius: 12,
      backgroundColor:
        "#f1f5f9",
    },

    /* PROPOSTA */

    proposalCard: {
      borderColor:
        "#fde68a",
    },

    proposalHeader: {
      flexDirection: "row",
      alignItems: "center",
    },

    proposalIcon: {
      width: 46,
      height: 46,
      borderRadius: 14,
      alignItems:
        "center",
      justifyContent:
        "center",
      backgroundColor:
        "#facc15",
    },

    proposalHeaderText: {
      flex: 1,
      marginLeft: 11,
    },

    proposalTitle: {
      color: "#111827",
      fontSize: 15,
      fontWeight: "900",
    },

    proposalSubtitle: {
      marginTop: 3,
      color: "#64748b",
      fontSize: 11,
      lineHeight: 16,
    },

    primaryButton: {
      minHeight: 50,
      marginTop: 16,
      borderRadius: 11,
      flexDirection: "row",
      alignItems: "center",
      justifyContent:
        "center",
      gap: 7,
      backgroundColor:
        "#facc15",
    },

    primaryButtonText: {
      color: "#111827",
      fontSize: 13,
      fontWeight: "900",
    },

    privacyRow: {
      marginTop: 11,
      flexDirection: "row",
      alignItems:
        "flex-start",
      gap: 6,
    },

    privacyText: {
      flex: 1,
      color: "#64748b",
      fontSize: 10,
      lineHeight: 15,
    },

    /* STATUS */

    statusHeader: {
      flexDirection: "row",
      alignItems: "center",
    },

    statusIcon: {
      width: 46,
      height: 46,
      borderRadius: 23,
      alignItems:
        "center",
      justifyContent:
        "center",
      backgroundColor:
        "#fffbeb",
    },

    statusIconAccepted: {
      backgroundColor:
        "#f0fdf4",
    },

    proposalValueBox: {
      marginTop: 15,
      padding: 13,
      borderRadius: 11,
      backgroundColor:
        "#f8fafc",
    },

    proposalValueLabel: {
      color: "#64748b",
      fontSize: 10,
      fontWeight: "700",
    },

    proposalValue: {
      marginTop: 3,
      color: "#111827",
      fontSize: 22,
      fontWeight: "900",
    },

    sentMessage: {
      marginTop: 10,
      padding: 12,
      borderRadius: 10,
      backgroundColor:
        "#f8fafc",
    },

    sentMessageLabel: {
      color: "#64748b",
      fontSize: 10,
      fontWeight: "800",
    },

    sentMessageText: {
      marginTop: 4,
      color: "#334155",
      fontSize: 12,
      lineHeight: 18,
    },

    /* CONTATO */

    contactBox: {
      marginTop: 14,
      padding: 14,
      borderRadius: 12,
      backgroundColor:
        "#f0fdf4",
      borderWidth: 1,
      borderColor:
        "#bbf7d0",
    },

    contactHeader: {
      flexDirection: "row",
      alignItems:
        "flex-start",
    },

    contactHeaderText: {
      flex: 1,
      marginLeft: 8,
    },

    contactTitle: {
      color: "#166534",
      fontSize: 13,
      fontWeight: "900",
    },

    contactSubtitle: {
      marginTop: 2,
      color: "#15803d",
      fontSize: 10,
      lineHeight: 15,
    },

    contactInfoRow: {
      marginTop: 10,
      flexDirection: "row",
      alignItems: "center",
      gap: 7,
    },

    contactInfoText: {
      color: "#334155",
      fontSize: 12,
      fontWeight: "700",
    },

    whatsappButton: {
      minHeight: 48,
      marginTop: 14,
      borderRadius: 10,
      flexDirection: "row",
      alignItems: "center",
      justifyContent:
        "center",
      gap: 7,
      backgroundColor:
        "#16a34a",
    },

    whatsappButtonText: {
      color: "#ffffff",
      fontSize: 12,
      fontWeight: "900",
    },

    /* VOLTAR */

    bottomBackButton: {
      minHeight: 44,
      alignItems: "center",
      justifyContent:
        "center",
      flexDirection: "row",
      gap: 6,
    },

    bottomBackText: {
      color: "#475569",
      fontSize: 12,
      fontWeight: "700",
    },

    /* MODAL */

    modalBackdrop: {
      flex: 1,
      justifyContent:
        "flex-end",
      backgroundColor:
        "rgba(15,23,42,0.45)",
    },

    modalCard: {
      paddingHorizontal: 18,
      paddingTop: 9,
      paddingBottom:
        Platform.OS ===
        "ios"
          ? 32
          : 22,
      borderTopLeftRadius: 22,
      borderTopRightRadius: 22,
      backgroundColor:
        "#ffffff",
    },

    modalHandle: {
      width: 44,
      height: 4,
      borderRadius: 999,
      alignSelf:
        "center",
      marginBottom: 14,
      backgroundColor:
        "#cbd5e1",
    },

    modalHeader: {
      flexDirection: "row",
      alignItems:
        "flex-start",
      justifyContent:
        "space-between",
      gap: 12,
      marginBottom: 20,
    },

    modalTitle: {
      color: "#111827",
      fontSize: 19,
      fontWeight: "900",
    },

    modalSubtitle: {
      maxWidth: 280,
      marginTop: 3,
      color: "#64748b",
      fontSize: 11,
      lineHeight: 16,
    },

    modalClose: {
      width: 38,
      height: 38,
      borderRadius: 19,
      alignItems:
        "center",
      justifyContent:
        "center",
      backgroundColor:
        "#f1f5f9",
    },

    fieldLabel: {
      marginBottom: 6,
      color: "#334155",
      fontSize: 12,
      fontWeight: "800",
    },

    optional: {
      color: "#94a3b8",
      fontWeight: "500",
    },

    moneyInput: {
      minHeight: 54,
      paddingHorizontal: 14,
      flexDirection: "row",
      alignItems: "center",
      borderRadius: 11,
      borderWidth: 1,
      borderColor:
        "#cbd5e1",
    },

    currencyPrefix: {
      marginRight: 8,
      color: "#475569",
      fontSize: 15,
      fontWeight: "800",
    },

    moneyTextInput: {
      flex: 1,
      paddingVertical: 10,
      color: "#111827",
      fontSize: 20,
      fontWeight: "900",
    },

    messageInput: {
      minHeight: 105,
      padding: 12,
      borderRadius: 11,
      borderWidth: 1,
      borderColor:
        "#cbd5e1",
      color: "#111827",
      fontSize: 13,
      lineHeight: 19,
    },

    characterCount: {
      marginTop: 5,
      textAlign: "right",
      color: "#94a3b8",
      fontSize: 9,
    },

    modalSubmitButton: {
      minHeight: 52,
      marginTop: 18,
      borderRadius: 11,
      flexDirection: "row",
      alignItems: "center",
      justifyContent:
        "center",
      gap: 7,
      backgroundColor:
        "#facc15",
    },

    modalSubmitText: {
      color: "#111827",
      fontSize: 13,
      fontWeight: "900",
    },

    buttonDisabled: {
      opacity: 0.65,
    },

    modalNotice: {
      marginTop: 9,
      textAlign: "center",
      color: "#64748b",
      fontSize: 9,
      lineHeight: 14,
    },
  });