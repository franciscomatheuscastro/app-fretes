// app/(tabs)/fretes.tsx

import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import React, {
  useCallback,
  useMemo,
  useState,
} from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import * as Storage from "../../../backend/lib/storage";

/* =========================================================
   CONFIGURAÇÃO
========================================================= */

const API_BASE = "https://www.meufreteiro.com";

const COLORS = {
  primary: "#FACC15",
  primarySoft: "#FEF9C3",
  primaryBorder: "#FDE047",

  black: "#111827",

  background: "#F8FAFC",
  surface: "#FFFFFF",

  text: "#111827",
  secondaryText: "#64748B",
  mutedText: "#94A3B8",

  border: "#E2E8F0",
  borderLight: "#F1F5F9",

  danger: "#B91C1C",
  dangerBackground: "#FEF2F2",
  dangerBorder: "#FECACA",
};

/* =========================================================
   TIPOS
========================================================= */

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

  _count?: {
    propostas?: number;
  };
};

type RespostaFretes =
  | Frete[]
  | {
      fretes?: Frete[];
      data?: Frete[];

      mensagem?: string;
      message?: string;

      erro?: string;
      error?: string;
    };

type FiltroAjudante =
  | "TODOS"
  | "SIM"
  | "NAO";

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

function normalizarTexto(valor: string) {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function formatarData(
  valor?: string | null
) {
  if (!valor) {
    return null;
  }

  const data = new Date(valor);

  if (Number.isNaN(data.getTime())) {
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

function dataParaFiltro(
  valor?: string | null
) {
  if (!valor) {
    return "";
  }

  const data = new Date(valor);

  if (Number.isNaN(data.getTime())) {
    return "";
  }

  const dia = String(
    data.getDate()
  ).padStart(2, "0");

  const mes = String(
    data.getMonth() + 1
  ).padStart(2, "0");

  const ano = data.getFullYear();

  return `${dia}/${mes}/${ano}`;
}

function formatarPeso(
  peso?: number | null
) {
  if (
    peso == null ||
    !Number.isFinite(peso)
  ) {
    return null;
  }

  return `${peso.toLocaleString(
    "pt-BR"
  )} kg`;
}

function tempoRelativo(
  iso?: string | null
) {
  if (!iso) {
    return "";
  }

  const data = new Date(iso);

  const agora = Date.now();

  const diferenca =
    agora - data.getTime();

  if (
    Number.isNaN(diferenca) ||
    diferenca < 0
  ) {
    return "";
  }

  const minutos = Math.floor(
    diferenca / 60_000
  );

  if (minutos < 1) {
    return "agora";
  }

  if (minutos < 60) {
    return `há ${minutos} min`;
  }

  const horas = Math.floor(
    minutos / 60
  );

  if (horas < 24) {
    return `há ${horas} ${
      horas === 1
        ? "hora"
        : "horas"
    }`;
  }

  const dias = Math.floor(
    horas / 24
  );

  if (dias < 30) {
    return `há ${dias} ${
      dias === 1
        ? "dia"
        : "dias"
    }`;
  }

  return formatarData(iso) || "";
}

/* =========================================================
   TELA
========================================================= */

export default function FretesScreen() {
  const router = useRouter();

  /* =======================================================
     FRETES RECEBIDOS DA API
  ======================================================= */

  const [
    todosFretes,
    setTodosFretes,
  ] = useState<Frete[]>([]);

  /* =======================================================
     CAMPOS DOS FILTROS
  ======================================================= */

  const [
    origem,
    setOrigem,
  ] = useState("");

  const [
    destino,
    setDestino,
  ] = useState("");

  const [
    dataColeta,
    setDataColeta,
  ] = useState("");

  const [
    filtroAjudante,
    setFiltroAjudante,
  ] =
    useState<FiltroAjudante>(
      "TODOS"
    );

  /* =======================================================
     FILTROS APLICADOS
  ======================================================= */

  const [
    filtrosAplicados,
    setFiltrosAplicados,
  ] = useState({
    origem: "",
    destino: "",
    dataColeta: "",
    ajudante:
      "TODOS" as FiltroAjudante,
  });

  /* =======================================================
     ESTADOS
  ======================================================= */

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    refreshing,
    setRefreshing,
  ] = useState(false);

  const [
    erro,
    setErro,
  ] = useState("");

  const [
    filtrosAbertos,
    setFiltrosAbertos,
  ] = useState(false);

  /* =======================================================
     CARREGAR TODOS OS FRETES
  ======================================================= */

  const carregarFretes =
    useCallback(
      async (
        silencioso = false
      ) => {
        try {
          setErro("");

          if (!silencioso) {
            setLoading(true);
          }

          const token =
            await Storage.getItem(
              "authToken"
            );

          if (!token) {
            setTodosFretes([]);

            setErro(
              "Sua sessão expirou. Entre novamente."
            );

            return;
          }

          /*
           * IMPORTANTE:
           *
           * Agora chamamos a API SEM exigir origem.
           *
           * A API deve retornar todos os fretes
           * ativos quando não houver parâmetros.
           */
          const response =
            await fetch(
              `${API_BASE}/api/fretes/buscar`,
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

          const raw =
            await response
              .text()
              .catch(() => "");

          let body:
            | RespostaFretes
            | null = null;

          try {
            body = raw
              ? JSON.parse(raw)
              : null;
          } catch {
            body = null;
          }

          if (
            response.status === 401
          ) {
            setTodosFretes([]);

            setErro(
              "Sua sessão expirou. Faça login novamente."
            );

            return;
          }

          if (
            response.status === 403
          ) {
            setTodosFretes([]);

            setErro(
              "Seu usuário não possui acesso aos fretes."
            );

            return;
          }

          if (!response.ok) {
            throw new Error(
              extrairMensagemErro(
                body,
                `Não foi possível carregar os fretes. HTTP ${response.status}.`
              )
            );
          }

          let lista: Frete[] = [];

          if (Array.isArray(body)) {
            lista = body;
          } else if (
            Array.isArray(
              body?.fretes
            )
          ) {
            lista = body.fretes;
          } else if (
            Array.isArray(
              body?.data
            )
          ) {
            lista = body.data;
          }

          setTodosFretes(lista);
        } catch (error) {
          console.error(
            "Erro ao carregar fretes:",
            error
          );

          setTodosFretes([]);

          setErro(
            error instanceof Error
              ? error.message
              : "Não foi possível carregar os fretes."
          );
        } finally {
          setLoading(false);

          setRefreshing(false);
        }
      },
      []
    );

  /* =======================================================
     CARREGAR AO ENTRAR / VOLTAR PARA ABA
  ======================================================= */

  useFocusEffect(
    useCallback(() => {
      carregarFretes(
        todosFretes.length > 0
      );
    }, [
      carregarFretes,
      todosFretes.length,
    ])
  );

  /* =======================================================
     FILTRAR LOCALMENTE
  ======================================================= */

  const fretesFiltrados =
    useMemo(() => {
      const origemFiltro =
        normalizarTexto(
          filtrosAplicados.origem
        );

      const destinoFiltro =
        normalizarTexto(
          filtrosAplicados.destino
        );

      const dataFiltro =
        filtrosAplicados.dataColeta.trim();

      return todosFretes.filter(
        frete => {
          /* ORIGEM */

          if (origemFiltro) {
            const cidade =
              normalizarTexto(
                frete.cidadeColeta
              );

            if (
              !cidade.includes(
                origemFiltro
              )
            ) {
              return false;
            }
          }

          /* DESTINO */

          if (destinoFiltro) {
            const cidade =
              normalizarTexto(
                frete.cidadeEntrega
              );

            if (
              !cidade.includes(
                destinoFiltro
              )
            ) {
              return false;
            }
          }

          /* DATA */

          if (dataFiltro) {
            const data =
              dataParaFiltro(
                frete.dataColeta
              );

            if (
              !data.includes(
                dataFiltro
              )
            ) {
              return false;
            }
          }

          /* AJUDANTE */

          if (
            filtrosAplicados.ajudante ===
              "SIM" &&
            frete.precisaAjudante !==
              true
          ) {
            return false;
          }

          if (
            filtrosAplicados.ajudante ===
              "NAO" &&
            frete.precisaAjudante ===
              true
          ) {
            return false;
          }

          return true;
        }
      );
    }, [
      todosFretes,
      filtrosAplicados,
    ]);

  /* =======================================================
     QUANTIDADE DE FILTROS
  ======================================================= */

  const quantidadeFiltros =
    useMemo(() => {
      let quantidade = 0;

      if (
        filtrosAplicados.origem
      ) {
        quantidade++;
      }

      if (
        filtrosAplicados.destino
      ) {
        quantidade++;
      }

      if (
        filtrosAplicados.dataColeta
      ) {
        quantidade++;
      }

      if (
        filtrosAplicados.ajudante !==
        "TODOS"
      ) {
        quantidade++;
      }

      return quantidade;
    }, [filtrosAplicados]);

  /* =======================================================
     APLICAR FILTROS
  ======================================================= */

  function aplicarFiltros() {
    setFiltrosAplicados({
      origem: origem.trim(),

      destino: destino.trim(),

      dataColeta:
        dataColeta.trim(),

      ajudante:
        filtroAjudante,
    });

    setFiltrosAbertos(false);
  }

  /* =======================================================
     LIMPAR FILTROS
  ======================================================= */

  function limparFiltros() {
    setOrigem("");

    setDestino("");

    setDataColeta("");

    setFiltroAjudante(
      "TODOS"
    );

    setFiltrosAplicados({
      origem: "",
      destino: "",
      dataColeta: "",
      ajudante: "TODOS",
    });
  }

  /* =======================================================
     REFRESH
  ======================================================= */

  const atualizar =
    useCallback(() => {
      setRefreshing(true);

      carregarFretes(true);
    }, [carregarFretes]);

  /* =======================================================
     ABRIR FRETE
  ======================================================= */

  function abrirFrete(
    id: string
  ) {
    router.push({
      pathname:
        "/(tabs)/fretes/[id]",

      params: {
        id: String(id),
      },
    });
  }

  /* =======================================================
     CARD
  ======================================================= */

  const renderFrete =
    useCallback(
      ({
        item,
      }: {
        item: Frete;
      }) => {
        const dataColetaFormatada =
          formatarData(
            item.dataColeta
          );

        const dataEntrega =
          formatarData(
            item.dataEntrega
          );

        const peso =
          formatarPeso(
            item.pesoAproximado
          );

        const propostas =
          item._count?.propostas ??
          0;

        return (
          <TouchableOpacity
            style={styles.card}
            activeOpacity={0.85}
            onPress={() =>
              abrirFrete(item.id)
            }
          >
            {/* ROTA */}

            <View
              style={
                styles.routeArea
              }
            >
              <View
                style={
                  styles.routeTimeline
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
                  styles.routeTextArea
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
                    style={styles.city}
                    numberOfLines={2}
                  >
                    {
                      item.cidadeColeta
                    }
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
                    style={styles.city}
                    numberOfLines={2}
                  >
                    {
                      item.cidadeEntrega
                    }
                  </Text>
                </View>
              </View>
            </View>

            {/* DESCRIÇÃO */}

            {!!item.descricao && (
              <Text
                style={
                  styles.description
                }
                numberOfLines={2}
              >
                {item.descricao}
              </Text>
            )}

            {/* INFORMAÇÕES */}

            <View
              style={
                styles.infoRow
              }
            >
              {peso && (
                <View
                  style={
                    styles.infoChip
                  }
                >
                  <Ionicons
                    name="cube-outline"
                    size={15}
                    color={
                      COLORS.secondaryText
                    }
                  />

                  <Text
                    style={
                      styles.infoChipText
                    }
                  >
                    {peso}
                  </Text>
                </View>
              )}

              {dataColetaFormatada && (
                <View
                  style={
                    styles.infoChip
                  }
                >
                  <Ionicons
                    name="calendar-outline"
                    size={15}
                    color={
                      COLORS.secondaryText
                    }
                  />

                  <Text
                    style={
                      styles.infoChipText
                    }
                  >
                    {
                      dataColetaFormatada
                    }
                  </Text>
                </View>
              )}

              {item.precisaAjudante ===
                true && (
                <View
                  style={
                    styles.infoChip
                  }
                >
                  <Ionicons
                    name="people-outline"
                    size={15}
                    color={
                      COLORS.secondaryText
                    }
                  />

                  <Text
                    style={
                      styles.infoChipText
                    }
                  >
                    Precisa de ajudante
                  </Text>
                </View>
              )}
            </View>

            {/* ENTREGA */}

            {dataEntrega && (
              <View
                style={
                  styles.deliveryRow
                }
              >
                <Ionicons
                  name="flag-outline"
                  size={14}
                  color={
                    COLORS.secondaryText
                  }
                />

                <Text
                  style={
                    styles.deliveryText
                  }
                >
                  Previsão de
                  entrega:{" "}
                  {dataEntrega}
                </Text>
              </View>
            )}

            {/* FOOTER */}

            <View
              style={
                styles.cardFooter
              }
            >
              <View
                style={
                  styles.footerLeft
                }
              >
                {!!item.createdAt && (
                  <Text
                    style={
                      styles.createdAt
                    }
                  >
                    {tempoRelativo(
                      item.createdAt
                    )}
                  </Text>
                )}

                <View
                  style={
                    styles.proposalInfo
                  }
                >
                  <Ionicons
                    name="document-text-outline"
                    size={14}
                    color={
                      COLORS.secondaryText
                    }
                  />

                  <Text
                    style={
                      styles.proposalText
                    }
                  >
                    {propostas}{" "}
                    {propostas === 1
                      ? "proposta"
                      : "propostas"}
                  </Text>
                </View>
              </View>

              <View
                style={
                  styles.viewButton
                }
              >
                <Text
                  style={
                    styles.viewButtonText
                  }
                >
                  Ver frete
                </Text>

                <Ionicons
                  name="chevron-forward"
                  size={16}
                  color="#FFFFFF"
                />
              </View>
            </View>
          </TouchableOpacity>
        );
      },
      []
    );

  /* =======================================================
     HEADER DA LISTA
  ======================================================= */

  const ListHeader = (
    <View>
      {/* APRESENTAÇÃO */}

      <View style={styles.hero}>
        <View
          style={styles.heroIcon}
        >
          <Ionicons
            name="car-outline"
            size={23}
            color={COLORS.black}
          />
        </View>

        <View
          style={
            styles.heroTextArea
          }
        >
          <Text
            style={
              styles.heroTitle
            }
          >
            Fretes disponíveis
          </Text>

          <Text
            style={
              styles.heroSubtitle
            }
          >
            Veja todas as oportunidades
            ou use os filtros para
            encontrar o frete ideal para
            sua rota.
          </Text>
        </View>
      </View>

      {/* BOTÃO FILTROS */}

      <View
        style={
          styles.filterBar
        }
      >
        <View>
          <Text
            style={
              styles.resultsTitle
            }
          >
            Oportunidades
          </Text>

          <Text
            style={
              styles.resultsCount
            }
          >
            {fretesFiltrados.length}{" "}
            {fretesFiltrados.length ===
            1
              ? "frete disponível"
              : "fretes disponíveis"}
          </Text>
        </View>

        <TouchableOpacity
          style={[
            styles.filterButton,

            quantidadeFiltros > 0 &&
              styles.filterButtonActive,
          ]}
          onPress={() =>
            setFiltrosAbertos(
              atual => !atual
            )
          }
          activeOpacity={0.85}
        >
          <Ionicons
            name="options-outline"
            size={18}
            color={
              COLORS.black
            }
          />

          <Text
            style={
              styles.filterButtonText
            }
          >
            Filtros
          </Text>

          {quantidadeFiltros >
            0 && (
            <View
              style={
                styles.filterBadge
              }
            >
              <Text
                style={
                  styles.filterBadgeText
                }
              >
                {
                  quantidadeFiltros
                }
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* FILTROS */}

      {filtrosAbertos && (
        <View
          style={
            styles.searchBox
          }
        >
          <View
            style={
              styles.filterHeader
            }
          >
            <View>
              <Text
                style={
                  styles.filterTitle
                }
              >
                Filtrar fretes
              </Text>

              <Text
                style={
                  styles.filterSubtitle
                }
              >
                Preencha somente o que
                quiser filtrar.
              </Text>
            </View>

            <Pressable
              onPress={() =>
                setFiltrosAbertos(
                  false
                )
              }
              hitSlop={10}
            >
              <Ionicons
                name="close"
                size={22}
                color={
                  COLORS.secondaryText
                }
              />
            </Pressable>
          </View>

          {/* ORIGEM */}

          <Text
            style={
              styles.inputLabel
            }
          >
            Origem
          </Text>

          <View
            style={
              styles.inputWrapper
            }
          >
            <Ionicons
              name="location-outline"
              size={20}
              color={
                COLORS.secondaryText
              }
            />

            <TextInput
              value={origem}
              onChangeText={
                setOrigem
              }
              placeholder="Ex.: Porto Alegre"
              placeholderTextColor={
                COLORS.mutedText
              }
              style={styles.input}
              autoCorrect={false}
              autoCapitalize="words"
            />

            {!!origem && (
              <Pressable
                onPress={() =>
                  setOrigem("")
                }
                hitSlop={10}
              >
                <Ionicons
                  name="close-circle"
                  size={19}
                  color={
                    COLORS.mutedText
                  }
                />
              </Pressable>
            )}
          </View>

          {/* DESTINO */}

          <Text
            style={[
              styles.inputLabel,
              styles.fieldSpacing,
            ]}
          >
            Destino
          </Text>

          <View
            style={
              styles.inputWrapper
            }
          >
            <Ionicons
              name="flag-outline"
              size={20}
              color={
                COLORS.secondaryText
              }
            />

            <TextInput
              value={destino}
              onChangeText={
                setDestino
              }
              placeholder="Ex.: Curitiba"
              placeholderTextColor={
                COLORS.mutedText
              }
              style={styles.input}
              autoCorrect={false}
              autoCapitalize="words"
            />

            {!!destino && (
              <Pressable
                onPress={() =>
                  setDestino("")
                }
                hitSlop={10}
              >
                <Ionicons
                  name="close-circle"
                  size={19}
                  color={
                    COLORS.mutedText
                  }
                />
              </Pressable>
            )}
          </View>

          {/* DATA */}

          <Text
            style={[
              styles.inputLabel,
              styles.fieldSpacing,
            ]}
          >
            Data de coleta
          </Text>

          <View
            style={
              styles.inputWrapper
            }
          >
            <Ionicons
              name="calendar-outline"
              size={20}
              color={
                COLORS.secondaryText
              }
            />

            <TextInput
              value={dataColeta}
              onChangeText={
                setDataColeta
              }
              placeholder="DD/MM/AAAA"
              placeholderTextColor={
                COLORS.mutedText
              }
              style={styles.input}
              keyboardType="numbers-and-punctuation"
            />

            {!!dataColeta && (
              <Pressable
                onPress={() =>
                  setDataColeta("")
                }
                hitSlop={10}
              >
                <Ionicons
                  name="close-circle"
                  size={19}
                  color={
                    COLORS.mutedText
                  }
                />
              </Pressable>
            )}
          </View>

          {/* AJUDANTE */}

          <Text
            style={[
              styles.inputLabel,
              styles.fieldSpacing,
            ]}
          >
            Ajudante
          </Text>

          <View
            style={
              styles.optionRow
            }
          >
            <TouchableOpacity
              style={[
                styles.optionButton,

                filtroAjudante ===
                  "TODOS" &&
                  styles.optionButtonActive,
              ]}
              onPress={() =>
                setFiltroAjudante(
                  "TODOS"
                )
              }
            >
              <Text
                style={[
                  styles.optionText,

                  filtroAjudante ===
                    "TODOS" &&
                    styles.optionTextActive,
                ]}
              >
                Todos
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.optionButton,

                filtroAjudante ===
                  "SIM" &&
                  styles.optionButtonActive,
              ]}
              onPress={() =>
                setFiltroAjudante(
                  "SIM"
                )
              }
            >
              <Text
                style={[
                  styles.optionText,

                  filtroAjudante ===
                    "SIM" &&
                    styles.optionTextActive,
                ]}
              >
                Precisa
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.optionButton,

                filtroAjudante ===
                  "NAO" &&
                  styles.optionButtonActive,
              ]}
              onPress={() =>
                setFiltroAjudante(
                  "NAO"
                )
              }
            >
              <Text
                style={[
                  styles.optionText,

                  filtroAjudante ===
                    "NAO" &&
                    styles.optionTextActive,
                ]}
              >
                Não precisa
              </Text>
            </TouchableOpacity>
          </View>

          {/* AÇÕES */}

          <TouchableOpacity
            style={
              styles.searchButton
            }
            onPress={
              aplicarFiltros
            }
            activeOpacity={0.85}
          >
            <Ionicons
              name="search"
              size={18}
              color={
                COLORS.black
              }
            />

            <Text
              style={
                styles.searchButtonText
              }
            >
              Filtrar fretes
            </Text>
          </TouchableOpacity>

          {quantidadeFiltros >
            0 && (
            <TouchableOpacity
              style={
                styles.clearButton
              }
              onPress={
                limparFiltros
              }
              activeOpacity={0.8}
            >
              <Ionicons
                name="refresh-outline"
                size={17}
                color={
                  COLORS.secondaryText
                }
              />

              <Text
                style={
                  styles.clearButtonText
                }
              >
                Limpar filtros
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* FILTROS ATIVOS */}

      {quantidadeFiltros >
        0 && (
        <View
          style={
            styles.activeFilters
          }
        >
          <View
            style={
              styles.activeFilterHeader
            }
          >
            <Text
              style={
                styles.activeFilterTitle
              }
            >
              Filtros ativos
            </Text>

            <TouchableOpacity
              onPress={
                limparFiltros
              }
            >
              <Text
                style={
                  styles.clearText
                }
              >
                Limpar
              </Text>
            </TouchableOpacity>
          </View>

          <View
            style={
              styles.activeFilterChips
            }
          >
            {!!filtrosAplicados.origem && (
              <View
                style={
                  styles.activeChip
                }
              >
                <Ionicons
                  name="location-outline"
                  size={13}
                  color={
                    COLORS.black
                  }
                />

                <Text
                  style={
                    styles.activeChipText
                  }
                >
                  {
                    filtrosAplicados.origem
                  }
                </Text>
              </View>
            )}

            {!!filtrosAplicados.destino && (
              <View
                style={
                  styles.activeChip
                }
              >
                <Ionicons
                  name="flag-outline"
                  size={13}
                  color={
                    COLORS.black
                  }
                />

                <Text
                  style={
                    styles.activeChipText
                  }
                >
                  {
                    filtrosAplicados.destino
                  }
                </Text>
              </View>
            )}

            {!!filtrosAplicados.dataColeta && (
              <View
                style={
                  styles.activeChip
                }
              >
                <Ionicons
                  name="calendar-outline"
                  size={13}
                  color={
                    COLORS.black
                  }
                />

                <Text
                  style={
                    styles.activeChipText
                  }
                >
                  {
                    filtrosAplicados.dataColeta
                  }
                </Text>
              </View>
            )}

            {filtrosAplicados.ajudante !==
              "TODOS" && (
              <View
                style={
                  styles.activeChip
                }
              >
                <Ionicons
                  name="people-outline"
                  size={13}
                  color={
                    COLORS.black
                  }
                />

                <Text
                  style={
                    styles.activeChipText
                  }
                >
                  {filtrosAplicados.ajudante ===
                  "SIM"
                    ? "Precisa de ajudante"
                    : "Sem ajudante"}
                </Text>
              </View>
            )}
          </View>
        </View>
      )}

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
            color={
              COLORS.danger
            }
          />

          <Text
            style={
              styles.errorText
            }
          >
            {erro}
          </Text>
        </View>
      )}
    </View>
  );

  /* =======================================================
     EMPTY
  ======================================================= */

  const EmptyComponent =
    !loading &&
    !erro ? (
      <View
        style={styles.empty}
      >
        <View
          style={
            styles.emptyIcon
          }
        >
          <Ionicons
            name="file-tray-outline"
            size={32}
            color={
              COLORS.secondaryText
            }
          />
        </View>

        <Text
          style={
            styles.emptyTitle
          }
        >
          {quantidadeFiltros >
          0
            ? "Nenhum frete encontrado"
            : "Nenhum frete disponível"}
        </Text>

        <Text
          style={
            styles.emptyText
          }
        >
          {quantidadeFiltros >
          0
            ? "Não encontramos oportunidades com esses filtros. Tente alterar ou limpar os filtros."
            : "Ainda não existem fretes disponíveis. Puxe a tela para baixo para atualizar."}
        </Text>

        {quantidadeFiltros >
          0 && (
          <TouchableOpacity
            style={
              styles.emptyClearButton
            }
            onPress={
              limparFiltros
            }
          >
            <Text
              style={
                styles.emptyClearText
              }
            >
              Ver todos os fretes
            </Text>
          </TouchableOpacity>
        )}
      </View>
    ) : null;

  /* =======================================================
     UI
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
      {/* TOP BAR */}

      <View
        style={styles.topBar}
      >
        <View>
          <Text
            style={styles.brand}
          >
            Meu Freteiro
          </Text>

          <Text
            style={
              styles.topSubtitle
            }
          >
            Encontre oportunidades
          </Text>
        </View>

        <TouchableOpacity
          style={
            styles.notificationButton
          }
          activeOpacity={0.8}
          onPress={() =>
            router.push(
              "/(tabs)/notificacoes"
            )
          }
        >
          <Ionicons
            name="notifications-outline"
            size={23}
            color={COLORS.black}
          />
        </TouchableOpacity>
      </View>

      {/* LOADING INICIAL */}

      {loading ? (
        <View
          style={
            styles.loadingContainer
          }
        >
          <ActivityIndicator
            size="large"
            color={
              COLORS.primary
            }
          />

          <Text
            style={
              styles.loadingText
            }
          >
            Carregando fretes...
          </Text>
        </View>
      ) : (
        <FlatList
          data={
            fretesFiltrados
          }
          keyExtractor={item =>
            String(item.id)
          }
          renderItem={
            renderFrete
          }
          ListHeaderComponent={
            ListHeader
          }
          ListEmptyComponent={
            EmptyComponent
          }
          contentContainerStyle={
            styles.listContent
          }
          showsVerticalScrollIndicator={
            false
          }
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={
                refreshing
              }
              onRefresh={
                atualizar
              }
              tintColor={
                COLORS.primary
              }
            />
          }
        />
      )}
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
        COLORS.background,
    },

    listContent: {
      paddingBottom: 30,
    },

    /* TOP */

    topBar: {
      minHeight: 70,

      paddingHorizontal: 18,
      paddingVertical: 12,

      flexDirection: "row",

      alignItems: "center",

      justifyContent:
        "space-between",

      backgroundColor:
        COLORS.surface,

      borderBottomWidth: 1,

      borderBottomColor:
        COLORS.borderLight,
    },

    brand: {
      color: COLORS.black,

      fontSize: 20,

      fontWeight: "900",
    },

    topSubtitle: {
      marginTop: 2,

      color:
        COLORS.secondaryText,

      fontSize: 12,
    },

    notificationButton: {
      width: 42,
      height: 42,

      borderRadius: 21,

      alignItems: "center",
      justifyContent:
        "center",

      backgroundColor:
        COLORS.primary,

      borderWidth: 1,

      borderColor:
        COLORS.primaryBorder,
    },

    /* LOADING */

    loadingContainer: {
      flex: 1,

      alignItems: "center",

      justifyContent:
        "center",

      gap: 12,
    },

    loadingText: {
      color:
        COLORS.secondaryText,

      fontSize: 13,
    },

    /* HERO */

    hero: {
      marginHorizontal: 16,

      marginTop: 18,

      padding: 15,

      flexDirection: "row",

      alignItems: "center",

      gap: 12,

      backgroundColor:
        COLORS.surface,

      borderRadius: 16,

      borderWidth: 1,

      borderColor:
        COLORS.border,
    },

    heroIcon: {
      width: 48,
      height: 48,

      borderRadius: 14,

      alignItems: "center",

      justifyContent:
        "center",

      backgroundColor:
        COLORS.primary,
    },

    heroTextArea: {
      flex: 1,
    },

    heroTitle: {
      color: COLORS.black,

      fontSize: 17,

      fontWeight: "900",
    },

    heroSubtitle: {
      marginTop: 3,

      color:
        COLORS.secondaryText,

      fontSize: 12,

      lineHeight: 17,
    },

    /* FILTER BAR */

    filterBar: {
      marginHorizontal: 16,

      marginTop: 20,

      marginBottom: 2,

      flexDirection: "row",

      alignItems: "center",

      justifyContent:
        "space-between",

      gap: 12,
    },

    resultsTitle: {
      color: COLORS.black,

      fontSize: 17,

      fontWeight: "900",
    },

    resultsCount: {
      marginTop: 2,

      color:
        COLORS.secondaryText,

      fontSize: 12,
    },

    filterButton: {
      minHeight: 42,

      paddingHorizontal: 12,

      borderRadius: 10,

      flexDirection: "row",

      alignItems: "center",

      justifyContent:
        "center",

      gap: 6,

      backgroundColor:
        COLORS.surface,

      borderWidth: 1,

      borderColor:
        COLORS.border,
    },

    filterButtonActive: {
      backgroundColor:
        COLORS.primarySoft,

      borderColor:
        COLORS.primaryBorder,
    },

    filterButtonText: {
      color: COLORS.black,

      fontSize: 12,

      fontWeight: "800",
    },

    filterBadge: {
      minWidth: 20,
      height: 20,

      paddingHorizontal: 5,

      borderRadius: 10,

      alignItems: "center",

      justifyContent:
        "center",

      backgroundColor:
        COLORS.primary,
    },

    filterBadgeText: {
      color: COLORS.black,

      fontSize: 10,

      fontWeight: "900",
    },

    /* SEARCH */

    searchBox: {
      marginHorizontal: 16,

      marginTop: 12,

      padding: 16,

      borderRadius: 16,

      backgroundColor:
        COLORS.surface,

      borderWidth: 1,

      borderColor:
        COLORS.border,
    },

    filterHeader: {
      marginBottom: 16,

      flexDirection: "row",

      alignItems:
        "flex-start",

      justifyContent:
        "space-between",

      gap: 12,
    },

    filterTitle: {
      color: COLORS.black,

      fontSize: 16,

      fontWeight: "900",
    },

    filterSubtitle: {
      marginTop: 2,

      color:
        COLORS.secondaryText,

      fontSize: 11,
    },

    inputLabel: {
      marginBottom: 6,

      color: "#334155",

      fontSize: 12,

      fontWeight: "800",
    },

    fieldSpacing: {
      marginTop: 14,
    },

    inputWrapper: {
      minHeight: 50,

      paddingHorizontal: 13,

      flexDirection: "row",

      alignItems: "center",

      gap: 9,

      borderWidth: 1,

      borderColor:
        "#CBD5E1",

      borderRadius: 11,

      backgroundColor:
        COLORS.surface,
    },

    input: {
      flex: 1,

      color: COLORS.text,

      fontSize: 14,

      paddingVertical: 10,
    },

    /* AJUDANTE */

    optionRow: {
      flexDirection: "row",

      gap: 7,
    },

    optionButton: {
      flex: 1,

      minHeight: 40,

      paddingHorizontal: 6,

      borderRadius: 9,

      alignItems: "center",

      justifyContent:
        "center",

      backgroundColor:
        COLORS.background,

      borderWidth: 1,

      borderColor:
        COLORS.border,
    },

    optionButtonActive: {
      backgroundColor:
        COLORS.primary,

      borderColor:
        COLORS.primary,
    },

    optionText: {
      color:
        COLORS.secondaryText,

      fontSize: 11,

      fontWeight: "700",

      textAlign: "center",
    },

    optionTextActive: {
      color: COLORS.black,

      fontWeight: "900",
    },

    /* BOTÕES */

    searchButton: {
      minHeight: 50,

      marginTop: 18,

      borderRadius: 11,

      flexDirection: "row",

      alignItems: "center",

      justifyContent:
        "center",

      gap: 8,

      backgroundColor:
        COLORS.primary,
    },

    searchButtonText: {
      color: COLORS.black,

      fontSize: 14,

      fontWeight: "900",
    },

    clearButton: {
      minHeight: 42,

      marginTop: 8,

      flexDirection: "row",

      alignItems: "center",

      justifyContent:
        "center",

      gap: 6,
    },

    clearButtonText: {
      color:
        COLORS.secondaryText,

      fontSize: 12,

      fontWeight: "700",
    },

    /* FILTROS ATIVOS */

    activeFilters: {
      marginHorizontal: 16,

      marginTop: 12,

      padding: 12,

      borderRadius: 12,

      backgroundColor:
        COLORS.primarySoft,

      borderWidth: 1,

      borderColor:
        COLORS.primaryBorder,
    },

    activeFilterHeader: {
      flexDirection: "row",

      alignItems: "center",

      justifyContent:
        "space-between",
    },

    activeFilterTitle: {
      color: COLORS.black,

      fontSize: 11,

      fontWeight: "900",
    },

    clearText: {
      color: "#854D0E",

      fontSize: 11,

      fontWeight: "800",
    },

    activeFilterChips: {
      marginTop: 8,

      flexDirection: "row",

      flexWrap: "wrap",

      gap: 6,
    },

    activeChip: {
      paddingHorizontal: 8,

      paddingVertical: 5,

      borderRadius: 7,

      flexDirection: "row",

      alignItems: "center",

      gap: 4,

      backgroundColor:
        COLORS.surface,
    },

    activeChipText: {
      color: COLORS.black,

      fontSize: 10,

      fontWeight: "700",
    },

    /* ERROR */

    errorBox: {
      marginHorizontal: 16,

      marginTop: 14,

      padding: 13,

      borderRadius: 12,

      flexDirection: "row",

      alignItems: "center",

      gap: 9,

      backgroundColor:
        COLORS.dangerBackground,

      borderWidth: 1,

      borderColor:
        COLORS.dangerBorder,
    },

    errorText: {
      flex: 1,

      color: COLORS.danger,

      fontSize: 12,

      lineHeight: 17,

      fontWeight: "600",
    },

    /* CARD */

    card: {
      marginHorizontal: 16,

      marginTop: 10,

      padding: 16,

      borderRadius: 16,

      backgroundColor:
        COLORS.surface,

      borderWidth: 1,

      borderColor:
        COLORS.border,
    },

    routeArea: {
      flexDirection: "row",
    },

    routeTimeline: {
      width: 20,

      alignItems: "center",

      paddingTop: 5,
    },

    originDot: {
      width: 10,
      height: 10,

      borderRadius: 5,

      backgroundColor:
        COLORS.primary,

      borderWidth: 2,

      borderColor:
        COLORS.black,
    },

    routeLine: {
      width: 2,

      height: 31,

      marginVertical: 3,

      backgroundColor:
        "#CBD5E1",
    },

    destinationDot: {
      width: 10,
      height: 10,

      borderRadius: 2,

      backgroundColor:
        COLORS.black,
    },

    routeTextArea: {
      flex: 1,

      marginLeft: 7,
    },

    destinationArea: {
      marginTop: 17,
    },

    routeLabel: {
      color:
        COLORS.mutedText,

      fontSize: 9,

      fontWeight: "900",

      letterSpacing: 0.8,
    },

    city: {
      marginTop: 1,

      color: COLORS.black,

      fontSize: 15,

      fontWeight: "800",
    },

    description: {
      marginTop: 15,

      color: "#475569",

      fontSize: 13,

      lineHeight: 19,
    },

    infoRow: {
      marginTop: 14,

      flexDirection: "row",

      flexWrap: "wrap",

      gap: 7,
    },

    infoChip: {
      paddingHorizontal: 9,

      paddingVertical: 6,

      borderRadius: 8,

      flexDirection: "row",

      alignItems: "center",

      gap: 5,

      backgroundColor:
        COLORS.background,

      borderWidth: 1,

      borderColor:
        COLORS.border,
    },

    infoChipText: {
      color: "#475569",

      fontSize: 11,

      fontWeight: "700",
    },

    deliveryRow: {
      marginTop: 10,

      flexDirection: "row",

      alignItems: "center",

      gap: 5,
    },

    deliveryText: {
      color:
        COLORS.secondaryText,

      fontSize: 11,
    },

    /* FOOTER */

    cardFooter: {
      marginTop: 16,

      paddingTop: 13,

      borderTopWidth: 1,

      borderTopColor:
        COLORS.borderLight,

      flexDirection: "row",

      alignItems: "center",

      justifyContent:
        "space-between",

      gap: 10,
    },

    footerLeft: {
      flex: 1,

      gap: 5,
    },

    createdAt: {
      color:
        COLORS.mutedText,

      fontSize: 10,
    },

    proposalInfo: {
      flexDirection: "row",

      alignItems: "center",

      gap: 4,
    },

    proposalText: {
      color:
        COLORS.secondaryText,

      fontSize: 11,

      fontWeight: "600",
    },

    viewButton: {
      minHeight: 38,

      paddingHorizontal: 13,

      borderRadius: 9,

      flexDirection: "row",

      alignItems: "center",

      justifyContent:
        "center",

      gap: 4,

      backgroundColor:
        COLORS.black,
    },

    viewButtonText: {
      color: "#FFFFFF",

      fontSize: 11,

      fontWeight: "800",
    },

    /* EMPTY */

    empty: {
      marginHorizontal: 16,

      marginTop: 28,

      padding: 28,

      alignItems: "center",
    },

    emptyIcon: {
      width: 62,
      height: 62,

      borderRadius: 31,

      alignItems: "center",

      justifyContent:
        "center",

      backgroundColor:
        "#F1F5F9",
    },

    emptyTitle: {
      marginTop: 13,

      color: COLORS.black,

      fontSize: 16,

      fontWeight: "900",
    },

    emptyText: {
      marginTop: 5,

      maxWidth: 290,

      textAlign: "center",

      color:
        COLORS.secondaryText,

      fontSize: 12,

      lineHeight: 18,
    },

    emptyClearButton: {
      marginTop: 15,

      minHeight: 42,

      paddingHorizontal: 18,

      borderRadius: 10,

      alignItems: "center",

      justifyContent:
        "center",

      backgroundColor:
        COLORS.primary,
    },

    emptyClearText: {
      color: COLORS.black,

      fontSize: 12,

      fontWeight: "900",
    },
  });