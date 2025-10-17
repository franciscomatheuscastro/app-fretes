// app/(tabs)/fretes.tsx
import { Ionicons } from "@expo/vector-icons";
import { Picker } from "@react-native-picker/picker";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import * as Storage from "../../../backend/lib/storage";

const API_BASE = "https://app.voucarregar.com.br";

/* ================= Tipos ================= */
type Frete = {
  id: string | number;
  cidadeColeta: string;     // "Cidade - UF - País"
  cidadeEntrega: string;    // "Cidade - UF - País"
  produto: string;
  pesoTotal: number;
  unidadePeso: "toneladas" | "quilos" | string;
  valorFrete: number | null; // -1 ou null => "A combinar"
  tipoCarga: "completa" | "complemento" | string;
  veiculos: string[];
  carrocerias: string[];
  pagaPedagio?: boolean | null;
  empresa?: { logo?: string | null } | null;
  createdAt?: string | null;
};

type EstadoIBGE = {
  id: number;
  sigla: string;
  nome: string;
  regiao: { id: number; sigla: string; nome: string };
};
type MunicipioIBGE = { id: number; nome: string };

/* ================= Helpers ================= */
function toLowerNoAccent(v: string) {
  return (v || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

async function fetchWithTimeout(url: string, opts: RequestInit = {}, timeoutMs = 8000) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...opts, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(t);
  }
}

/** ===== Geocodificação segura + cache ===== */
const coordenadasCache = new Map<string, { lat: number; lon: number }>();

async function buscarCoordenadas(cidade: string, estado: string) {
  const chave = `${cidade},${estado}`;
  if (coordenadasCache.has(chave)) return coordenadasCache.get(chave)!;

  const url =
    `https://nominatim.openstreetmap.org/search?format=json&q=` +
    encodeURIComponent(`${cidade},${estado},Brasil`);

  try {
    const headers: any = { Accept: "application/json" };
    if (Platform.OS === "android") {
      headers["User-Agent"] = "VouCarregarApp/1.0 (contato@voucarregar.com.br)";
    }

    const res = await fetchWithTimeout(url, { headers }, 10000);
    if (!res.ok) return null;

    const ct = (res.headers.get("content-type") || "").toLowerCase();
    if (!ct.includes("application/json")) return null;

    const data = await res.json().catch(() => null);
    if (!Array.isArray(data) || data.length === 0) return null;

    const coords = { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
    coordenadasCache.set(chave, coords);
    return coords;
  } catch {
    return null;
  }
}

function haversineKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const toRad = (v: number) => (v * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

/* ================= Listas ================= */
const PAISES = ["Brasil", "Argentina", "Uruguai", "Chile"];
const VEICULOS = [
  "3/4", "Fiorino", "Toco", "VLC", "Bitruck", "Truck",
  "Bitrem", "Carreta", "Carreta LS", "Rodotrem", "Vanderléia",
];

/* ====== Parser da busca ====== */
function parseBusca(txt: string): { cidade: string; uf: string } {
  const clean = (txt || "").trim();
  if (!clean) return { cidade: "", uf: "" };
  const m = clean.match(/^(.+?)(?:,\s*([A-Za-z]{2}))?$/);
  if (!m) return { cidade: clean, uf: "" };
  return { cidade: (m[1] || "").trim(), uf: (m[2] || "").toUpperCase().trim() };
}

/* ================= Componentes reutilizáveis ================= */

const Tag = React.memo(function Tag({
  text, selected, onPress,
}: { text: string; selected: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      style={[styles.tag, selected && styles.tagSelected]}
      onPress={onPress}
      activeOpacity={0.9}
    >
      <Text style={[styles.tagText, selected && styles.tagTextSelected]}>{text}</Text>
    </TouchableOpacity>
  );
});

type FiltrosSheetProps = {
  visible: boolean;
  onClose: () => void;

  // dados auxiliares
  estados: EstadoIBGE[];
  regioes: string[];
  cidadesOrigem: string[];

  // valores
  paisOrigem: string;
  regiaoOrigem: string;
  estadoOrigem: string;
  cidadeOrigem: string;
  filtroVeiculos: string[];
  filtroTipoCarga: "todos" | "completa" | "complemento";
  raioKm: number | null;

  // setters
  setPaisOrigem: (v: string) => void;
  setRegiaoOrigem: (v: string) => void;
  setEstadoOrigem: (v: string) => void;
  setCidadeOrigem: (v: string) => void;
  setFiltroVeiculos: (v: string[]) => void;
  setFiltroTipoCarga: (v: "todos" | "completa" | "complemento") => void;
  setRaioKm: (v: number | null) => void;

  // ações
  onBuscar: () => void;
  onLimpar: () => void;
};

const FiltrosSheet = React.memo(function FiltrosSheet(props: FiltrosSheetProps) {
  const insets = useSafeAreaInsets();

  const {
    visible, onClose,
    estados, regioes, cidadesOrigem,
    paisOrigem, regiaoOrigem, estadoOrigem, cidadeOrigem,
    filtroVeiculos, filtroTipoCarga, raioKm,
    setPaisOrigem, setRegiaoOrigem, setEstadoOrigem, setCidadeOrigem,
    setFiltroVeiculos, setFiltroTipoCarga, setRaioKm,
    onBuscar, onLimpar,
  } = props;

  const toggle = useCallback(function toggle<T extends string>(
    arr: T[], setArr: (v: T[]) => void, item: T
  ) {
    setArr(arr.includes(item) ? arr.filter((i) => i !== item) : [...arr, item]);
  }, []);

  return (
    <Modal
      visible={visible}
      // Transparência e estilo diferentes por plataforma para evitar glitches no Android
      transparent={Platform.OS === "ios"}
      statusBarTranslucent={Platform.OS === "android"}
      presentationStyle={
        Platform.select({ ios: "overFullScreen", android: "fullScreen" }) as any
      }
      animationType={Platform.select({ ios: "slide", android: "fade" })}
      hardwareAccelerated
      onRequestClose={onClose}
    >
      <View style={styles.sheetBackdrop}>
        {/* Backdrop - só fecha ao tocar fora */}
        <Pressable style={StyleSheet.absoluteFillObject} onPress={onClose} />

        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={{ width: "100%" }}
        >
          {/* Corpo do sheet - consome toques para não vazar para o backdrop */}
          <Pressable
            onPress={() => {}}
            onStartShouldSetResponder={() => true}
            style={[styles.sheetBody, { paddingBottom: Math.max(insets.bottom, 16) }]}
          >
            <View style={styles.sheetHandle} />

            <ScrollView
              style={{ maxHeight: "100%" }}
              contentContainerStyle={{ paddingBottom: 12, gap: 10 }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {/* País */}
              <Text style={styles.sectionTitle}>Origem</Text>
              <View style={styles.wrap}>
                {PAISES.map((p) => (
                  <Tag
                    key={p}
                    text={p}
                    selected={paisOrigem === p}
                    onPress={() => {
                      setPaisOrigem(p);
                      if (p !== "Brasil") {
                        setRegiaoOrigem("");
                        setEstadoOrigem("");
                        setCidadeOrigem("");
                      }
                    }}
                  />
                ))}
              </View>

              {/* Região */}
              {paisOrigem === "Brasil" && (
                <>
                  <Text style={styles.sectionTitle}>Região</Text>
                  <View style={styles.wrap}>
                    {regioes.map((r) => (
                      <Tag
                        key={r}
                        text={r}
                        selected={regiaoOrigem === r}
                        onPress={() => {
                          const next = regiaoOrigem === r ? "" : r;
                          setRegiaoOrigem(next);
                          setEstadoOrigem("");
                          setCidadeOrigem("");
                        }}
                      />
                    ))}
                  </View>
                </>
              )}

              {/* Estados (só quando região escolhida) */}
              {paisOrigem === "Brasil" && !!regiaoOrigem && (
                <>
                  <Text style={styles.sectionTitle}>Estado</Text>
                  <View style={styles.wrap}>
                    {estados
                      .filter((e) => e.regiao.nome === regiaoOrigem)
                      .sort((a, b) => a.sigla.localeCompare(b.sigla))
                      .map((e) => (
                        <Tag
                          key={e.sigla}
                          text={e.sigla}
                          selected={estadoOrigem === e.sigla}
                          onPress={() => {
                            const next = estadoOrigem === e.sigla ? "" : e.sigla;
                            setEstadoOrigem(next);
                            setCidadeOrigem("");
                          }}
                        />
                      ))}
                  </View>
                </>
              )}

              {/* Cidade da UF */}
              {paisOrigem === "Brasil" && !!estadoOrigem && (
                <>
                  <Text style={styles.sectionTitle}>Cidade</Text>
                  <View style={styles.picker}>
                    <Picker
                      selectedValue={cidadeOrigem || ""}
                      onValueChange={(v) => setCidadeOrigem(String(v))}
                    >
                      <Picker.Item label="Selecione a cidade" value="" />
                      {cidadesOrigem.map((c) => (
                        <Picker.Item key={c} label={c} value={c} />
                      ))}
                    </Picker>
                  </View>
                </>
              )}

              {/* Veículos */}
              <Text style={styles.sectionTitle}>Veículos</Text>
              <View style={styles.wrap}>
                {VEICULOS.map((v) => (
                  <Tag
                    key={v}
                    text={v}
                    selected={filtroVeiculos.includes(v)}
                    onPress={() =>
                      toggle(filtroVeiculos, (arr) => setFiltroVeiculos(arr), v)
                    }
                  />
                ))}
              </View>

              {/* Tipo de carga */}
              <Text style={styles.sectionTitle}>Tipo de carga</Text>
              <View style={styles.wrap}>
                <Tag text="Todos"       selected={filtroTipoCarga === "todos"}       onPress={() => setFiltroTipoCarga("todos")} />
                <Tag text="completa"    selected={filtroTipoCarga === "completa"}    onPress={() => setFiltroTipoCarga("completa")} />
                <Tag text="complemento" selected={filtroTipoCarga === "complemento"} onPress={() => setFiltroTipoCarga("complemento")} />
              </View>

              {/* Raio */}
              <Text style={styles.sectionTitle}>Raio (a partir da origem)</Text>
              <View style={styles.picker}>
                <Picker
                  selectedValue={raioKm ?? 0}
                  onValueChange={(v) => (v ? setRaioKm(Number(v)) : setRaioKm(null))}
                >
                  <Picker.Item label="Sem filtro" value={0} />
                  <Picker.Item label="50 km"  value={50} />
                  <Picker.Item label="100 km" value={100} />
                  <Picker.Item label="200 km" value={200} />
                  <Picker.Item label="300 km" value={300} />
                </Picker>
              </View>
              {!!raioKm && (
                <Text style={styles.helper}>
                  Dica: selecione UF e cidade (ou digite “Cidade, UF”) para a distância ficar precisa.
                </Text>
              )}
            </ScrollView>

            {/* Botões fixos */}
            <View style={{ flexDirection: "row", gap: 8 }}>
              <TouchableOpacity
                style={[styles.btnPrimary, { flex: 1 }]}
                activeOpacity={0.9}
                onPress={onBuscar}
              >
                <Text style={styles.btnPrimaryText}>Buscar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btnSecondary, { flex: 1 }]}
                activeOpacity={0.9}
                onPress={onLimpar}
              >
                <Text style={styles.btnSecondaryText}>Limpar</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
});

/* ================= Tela ================= */
export default function FretesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Dados
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [fretes, setFretes] = useState<Frete[]>([]);
  const [estados, setEstados] = useState<EstadoIBGE[]>([]);
  const [cidadesOrigem, setCidadesOrigem] = useState<string[]>([]);

  // Busca (digitação x aplicado)
  const [inputBusca, setInputBusca] = useState("");
  const [buscaAplicada, setBuscaAplicada] = useState("");

  // Filtros estruturados (modal)
  const [paisOrigem, setPaisOrigem] = useState<string>("Brasil");
  const [regiaoOrigem, setRegiaoOrigem] = useState<string>("");
  const [estadoOrigem, setEstadoOrigem] = useState<string>(""); // sigla
  const [cidadeOrigem, setCidadeOrigem] = useState<string>("");
  const [cidadeDestino] = useState<string>("");

  const [filtroVeiculos, setFiltroVeiculos] = useState<string[]>([]);
  const [filtroTipoCarga, setFiltroTipoCarga] = useState<"todos" | "completa" | "complemento">("todos");
  const [raioKm, setRaioKm] = useState<number | null>(null);
  const [coordsOrigem, setCoordsOrigem] = useState<{ lat: number; lon: number } | null>(null);

  // UI state
  const [filtersSheetOpen, setFiltersSheetOpen] = useState(false);

  // Prefetch de coordenadas (raio)
  const [prefetchingRaio, setPrefetchingRaio] = useState(false);
  const [prefetchTick, setPrefetchTick] = useState(0);

  // Carregamento inicial
  const didLoadRef = useRef(false);
  useEffect(() => {
    if (didLoadRef.current) return;
    didLoadRef.current = true;

    (async () => {
      try {
        setLoading(true);
        setErro("");

        const token = await Storage.getItem("authToken");
        const fetchFretes = async (useAuth: boolean) => {
          const res = await fetchWithTimeout(`${API_BASE}/api/fretes/todos`, {
            headers: {
              Accept: "application/json",
              ...(useAuth && token ? { Authorization: `Bearer ${token}` } : {}),
            },
          }, 12000);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return (await res.json()) as Frete[];
        };

        let dados: Frete[] = [];
        try { dados = await fetchFretes(true); } catch { dados = await fetchFretes(false); }
        setFretes(Array.isArray(dados) ? dados : []);
      } catch {
        setErro("Não foi possível carregar os fretes.");
      }

      try {
        const resUF = await fetchWithTimeout("https://servicodados.ibge.gov.br/api/v1/localidades/estados", {}, 8000);
        const estadosJson: EstadoIBGE[] = await resUF.json();
        setEstados(estadosJson);
      } catch {
        setEstados([
          { id: 35, sigla: "SP", nome: "São Paulo", regiao: { id: 3, sigla: "SE", nome: "Sudeste" } },
          { id: 41, sigla: "PR", nome: "Paraná",    regiao: { id: 4, sigla: "S",  nome: "Sul" } },
          { id: 43, sigla: "RS", nome: "Rio Grande do Sul", regiao: { id: 4, sigla: "S", nome: "Sul" } },
        ]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Regiões únicas
  const regioes = useMemo(() => Array.from(new Set(estados.map((e) => e.regiao.nome))).sort(), [estados]);

  // Carrega cidades da UF
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (paisOrigem === "Brasil" && estadoOrigem) {
        try {
          const res = await fetchWithTimeout(
            `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${estadoOrigem}/municipios`, {}, 8000
          );
          const data: MunicipioIBGE[] = await res.json();
          if (!cancelled) setCidadesOrigem(data.map((m) => m.nome));
        } catch {
          if (!cancelled) setCidadesOrigem([]);
        }
      } else {
        setCidadesOrigem([]);
      }
      setCidadeOrigem("");
    })();
    return () => { cancelled = true; };
  }, [paisOrigem, estadoOrigem]);

  // Coordenadas da ORIGEM para o raio (só quando houver UF)
  useEffect(() => {
    (async () => {
      const parsed = parseBusca(buscaAplicada); // cidade pode vir do texto aplicado
      const cidadeTxt = parsed.cidade || cidadeOrigem;
      const ufTxt     = parsed.uf     || estadoOrigem;

      if (paisOrigem === "Brasil" && ufTxt && cidadeTxt && raioKm) {
        const c = await buscarCoordenadas(cidadeTxt, ufTxt);
        setCoordsOrigem(c);
      } else {
        setCoordsOrigem(null);
      }
    })();
  }, [paisOrigem, estadoOrigem, cidadeOrigem, buscaAplicada, raioKm]);

  // Filtro base (sem raio)
  const fretesFiltradosBase = useMemo(() => {
    const parsed = parseBusca(buscaAplicada); // "Cidade" ou "Cidade, UF"
    const cidadeBusca = parsed.cidade || cidadeOrigem;
    const ufBusca     = parsed.uf     || estadoOrigem;

    return fretes.filter((f) => {
      const [cidadeC, estadoC, paisC] = (f.cidadeColeta || "").split(" - ").map((s) => (s || "").trim());
      const [cidadeE] = (f.cidadeEntrega || "").split(" - ").map((s) => (s || "").trim());

      if (paisOrigem && paisC && paisC !== paisOrigem) return false;

      if (paisOrigem === "Brasil" && regiaoOrigem) {
        const estObj = estados.find((e) => e.sigla === estadoC || toLowerNoAccent(e.nome) === toLowerNoAccent(estadoC || ""));
        if (estObj?.regiao.nome !== regiaoOrigem) return false;
      }

      if (paisOrigem === "Brasil" && ufBusca) {
        const ok =
          estadoC === ufBusca ||
          toLowerNoAccent(estados.find((e) => e.sigla === ufBusca)?.nome || "") === toLowerNoAccent(estadoC || "");
        if (!ok) return false;
      }

      if (cidadeBusca) {
        if (toLowerNoAccent(cidadeC || "") !== toLowerNoAccent(cidadeBusca)) return false;
      }

      if (cidadeDestino) {
        const cidadeTxt = cidadeDestino.split("-")[0]?.trim() || "";
        if (toLowerNoAccent(cidadeE || "") !== toLowerNoAccent(cidadeTxt)) return false;
      }

      if (filtroVeiculos.length && !filtroVeiculos.some((v) => (f.veiculos || []).includes(v))) return false;

      if (filtroTipoCarga !== "todos") {
        const tipo = (f.tipoCarga || "").toLowerCase();
        if (tipo !== filtroTipoCarga) return false;
      }

      return true;
    });
  }, [fretes, buscaAplicada, paisOrigem, regiaoOrigem, estadoOrigem, cidadeOrigem, cidadeDestino, filtroVeiculos, filtroTipoCarga, estados]);

  // Prefetch coordenadas (com limite/pausa) para raio
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!(paisOrigem === "Brasil" && raioKm && coordsOrigem)) return;

      setPrefetchingRaio(true);
      try {
        const keys: string[] = [];
        const seen = new Set<string>();
        for (const f of fretesFiltradosBase) {
          const [cidadeC, estadoC] = (f.cidadeColeta || "").split(" - ").map((s) => (s || "").trim());
          const k = `${cidadeC},${estadoC}`;
          if (cidadeC && estadoC && !seen.has(k)) {
            seen.add(k);
            keys.push(k);
          }
        }

        for (const key of keys.slice(0, 80)) {
          if (cancelled) break;
          if (!coordenadasCache.has(key)) {
            const [city, uf] = key.split(",");
            await buscarCoordenadas(city, uf);
            await sleep(350);
          }
        }

        if (!cancelled) setPrefetchTick((t) => t + 1);
      } finally {
        if (!cancelled) setPrefetchingRaio(false);
      }
    })();

    return () => { cancelled = true; };
  }, [fretesFiltradosBase, paisOrigem, raioKm, coordsOrigem]);

  // Aplica RAIO
  const fretesParaListar = useMemo(() => {
    if (!(paisOrigem === "Brasil" && raioKm && coordsOrigem)) return fretesFiltradosBase;
    return fretesFiltradosBase.filter((f) => {
      const [cidadeC, estadoC] = (f.cidadeColeta || "").split(" - ").map((s) => (s || "").trim());
      const key = `${cidadeC},${estadoC}`;
      const coords = coordenadasCache.get(key);
      if (!coords) return false; // regra igual ao site
      const d = haversineKm(coordsOrigem, coords);
      return d <= (raioKm || 0);
    });
  }, [fretesFiltradosBase, paisOrigem, raioKm, coordsOrigem, prefetchTick]);

  /* === Ações === */
  const aplicarBusca = useCallback(() => {
    setBuscaAplicada(inputBusca.trim());
  }, [inputBusca]);

  const limparTudo = useCallback(() => {
    setInputBusca("");
    setBuscaAplicada("");
    setPaisOrigem("Brasil");
    setRegiaoOrigem("");
    setEstadoOrigem("");
    setCidadeOrigem("");
    // setCidadeDestino("") // reservado
    setFiltroVeiculos([]);
    setFiltroTipoCarga("todos");
    setRaioKm(null);
    setFiltersSheetOpen(false); // fecha o modal ao limpar
  }, []);

  const aplicarEBuscar = useCallback(() => {
    aplicarBusca();
    setFiltersSheetOpen(false);
  }, [aplicarBusca]);

  /* --------- Render de cada frete --------- */
  const renderFrete = ({ item }: { item: Frete }) => {
    const precoACombinar = item.valorFrete == null || item.valorFrete < 0;
    const precoFmt =
      !precoACombinar && item.valorFrete
        ? item.valorFrete.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
        : "A combinar";

    const isTonelada = (item.unidadePeso || "").toLowerCase() === "toneladas";
    const isQuilos = (item.unidadePeso || "").toLowerCase() === "quilos";
    const pedagio = item.pagaPedagio ? " + pedágio" : "";

    return (
      <View style={styles.card}>
        <View style={{ flex: 1 }}>
          <View style={styles.cityRow}>
            <Text style={styles.cityDot}>⬤</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.cityStrong}>{item.cidadeColeta}</Text>
              <Text style={styles.cityMuted}>{item.cidadeEntrega}</Text>
            </View>
          </View>

          <View style={styles.wrap}>
            {!!item.produto && <View style={styles.badge}><Text style={styles.badgeText}>{item.produto}</Text></View>}
            <View style={styles.badge}><Text style={styles.badgeText}>{item.pesoTotal} {isTonelada ? "ton" : "kg"}</Text></View>
            {!!item.tipoCarga && <View style={styles.badge}><Text style={styles.badgeText}>{item.tipoCarga}</Text></View>}
          </View>

          {item.createdAt && (
            <Text style={styles.dateText}>Há {tempoRelativo(item.createdAt)}</Text>
          )}
        </View>

        <View style={styles.side}>
          {item.empresa?.logo ? (
            <Image source={{ uri: item.empresa.logo }} style={styles.logo} resizeMode="contain" />
          ) : null}

          <View style={{ alignItems: "flex-end" }}>
            <Text style={styles.price}>{precoFmt}</Text>
            {!precoACombinar &&
              (isTonelada ? (
                <Text style={styles.perNote}>Preço por tonelada{pedagio}</Text>
              ) : isQuilos ? (
                item.pagaPedagio ? <Text style={styles.perNote}>Pedágio incluso</Text> : null
              ) : null)}

            <TouchableOpacity
              style={styles.btn}
              activeOpacity={0.85}
              onPress={() => router.push({ pathname: "../fretes/[id]", params: { id: String(item.id) } })}
            >
              <Text style={styles.btnText}>Ver Frete</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  /* --------- Header fixo --------- */
  const Header = (
    <View style={{ gap: 12, paddingTop: 8, paddingBottom: 4 }}>
      <View style={styles.searchCard}>
        <TextInput
          placeholder="Cidade ou Cidade, UF (ex.: Seberi, RS)"
          placeholderTextColor="#9ca3af"
          value={inputBusca}
          onChangeText={setInputBusca}
          style={styles.searchInput}
          returnKeyType="search"
          blurOnSubmit={false}
          autoCorrect={false}
          onSubmitEditing={aplicarBusca}
        />
        <Pressable onPress={() => setFiltersSheetOpen(true)} style={styles.searchIconBtn}>
          <Ionicons name="options-outline" size={18} color="#111827" />
        </Pressable>
        <Pressable onPress={aplicarBusca} style={styles.searchIconBtn}>
          <Ionicons name="search" size={18} color="#111827" />
        </Pressable>
      </View>

      {prefetchingRaio && (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginHorizontal: 12 }}>
          <ActivityIndicator />
          <Text style={{ color: "#6b7280" }}>Calculando distâncias…</Text>
        </View>
      )}
    </View>
  );

  /* ===== filtros ativos? mostrar chip “limpar” ===== */
  const hasActiveFilters =
    (buscaAplicada?.length ?? 0) > 0 ||
    paisOrigem !== "Brasil" ||
    !!regiaoOrigem ||
    !!estadoOrigem ||
    !!cidadeOrigem ||
    !!filtroVeiculos.length ||
    filtroTipoCarga !== "todos" ||
    !!raioKm;

  /* ================= UI ================= */
  if (loading) {
    return (
      <SafeAreaView style={[styles.center, { paddingTop: (insets.top ?? 0) + 8 }]} edges={["top", "left", "right"]}>
        <ActivityIndicator size="large" />
        <Text style={{ marginTop: 8 }}>Carregando fretes...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      {!!erro && (
        <View style={styles.alert}>
          <Text style={styles.alertText}>{erro}</Text>
        </View>
      )}

      {Header}

      {hasActiveFilters && (
        <View style={{ paddingHorizontal: 12, marginBottom: 8 }}>
          <TouchableOpacity style={styles.clearFiltersBtn} onPress={limparTudo} activeOpacity={0.9}>
            <Ionicons name="close-circle-outline" size={16} color="#111827" />
            <Text style={styles.clearFiltersText}>Limpar filtros</Text>
          </TouchableOpacity>
        </View>
      )}

      <FlatList
        data={fretesParaListar}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={{ paddingBottom: 16 }}
        renderItem={renderFrete}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="always"
        keyboardDismissMode="on-drag"
        removeClippedSubviews={false}
      />

      {/* Modal de Filtros — componente externo estável */}
      <FiltrosSheet
        visible={filtersSheetOpen}
        onClose={() => setFiltersSheetOpen(false)}
        estados={estados}
        regioes={regioes}
        cidadesOrigem={cidadesOrigem}
        paisOrigem={paisOrigem}
        regiaoOrigem={regiaoOrigem}
        estadoOrigem={estadoOrigem}
        cidadeOrigem={cidadeOrigem}
        filtroVeiculos={filtroVeiculos}
        filtroTipoCarga={filtroTipoCarga}
        raioKm={raioKm}
        setPaisOrigem={setPaisOrigem}
        setRegiaoOrigem={setRegiaoOrigem}
        setEstadoOrigem={setEstadoOrigem}
        setCidadeOrigem={setCidadeOrigem}
        setFiltroVeiculos={setFiltroVeiculos}
        setFiltroTipoCarga={setFiltroTipoCarga}
        setRaioKm={setRaioKm}
        onBuscar={aplicarEBuscar}
        onLimpar={limparTudo}
      />
    </SafeAreaView>
  );
}

/* ===== util de data “Há X horas/dias” ===== */
function tempoRelativo(iso?: string | null) {
  if (!iso) return "";
  const ms = Date.now() - new Date(iso).getTime();
  const h = Math.floor(ms / 3_600_000);
  if (h < 24) return `${h} hora${h === 1 ? "" : "s"}`;
  const d = Math.floor(h / 24);
  return `${d} dia${d === 1 ? "" : "s"}`;
}

/* ================= Estilos ================= */
const styles = StyleSheet.create({
  // Botões do bottom-sheet
  btnPrimary: {
    backgroundColor: "#16a34a",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  btnPrimaryText: { color: "#fff", fontWeight: "800" },
  btnSecondary: {
    backgroundColor: "#e5e7eb",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  btnSecondaryText: { color: "#111827", fontWeight: "800" },

  safe: { flex: 1, backgroundColor: "#f9fafb" },

  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#f9fafb" },

  alert: { margin: 12, padding: 10, backgroundColor: "#fee2e2", borderColor: "#fecaca", borderWidth: 1, borderRadius: 10 },
  alertText: { color: "#b91c1c", textAlign: "center", fontWeight: "700" },

  // Header compacto
  searchCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderWidth: 1, borderColor: "#e5e7eb",
    borderRadius: 14,
    paddingHorizontal: 12, paddingVertical: 10,
    gap: 10,
    marginHorizontal: 12,
  },
  searchInput: { flex: 1, color: "#111827" },
  searchIconBtn: {
    width: 34, height: 34, borderRadius: 17,
    alignItems: "center", justifyContent: "center",
    backgroundColor: "#F3F4F6"
  },

  clearFiltersBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#e5e7eb",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    alignSelf: "flex-start",
  },
  clearFiltersText: { color: "#111827", fontWeight: "700", fontSize: 12 },

  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },

  tag: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: "#f3f4f6", borderWidth: 1, borderColor: "#e5e7eb" },
  tagSelected: { backgroundColor: "#111827", borderColor: "#111827" },
  tagText: { color: "#111827", fontSize: 12, fontWeight: "700" },
  tagTextSelected: { color: "#fff" },

  picker: { backgroundColor: "#fff", borderRadius: 10, borderColor: "#e5e7eb", borderWidth: 1 },

  // Card de frete
  card: {
    marginHorizontal: 12,
    backgroundColor: "#fff",
    borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: "#e5e7eb",
    marginVertical: 6,
    flexDirection: "row", gap: 12, alignItems: "center",
  },
  badge: { backgroundColor: "#f3f4f6", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  badgeText: { fontSize: 12, color: "#374151" },
  dateText: { marginTop: 4, fontSize: 12, color: "#6b7280" },

  side: { marginLeft: "auto", alignItems: "flex-end", gap: 8 },
  logo: { width: 48, height: 48, borderRadius: 6, borderColor: "#e5e7eb", borderWidth: 1 },
  price: { fontSize: 18, color: "#16a34a", fontWeight: "800" },
  perNote: { fontSize: 12, color: "#6b7280", marginTop: 2 },
  btn: { marginTop: 6, backgroundColor: "#ea7713ff", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 12 },

  // Bottom-sheet
  sheetBackdrop: {
    position: "absolute",
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "flex-end"
  },
  sheetBody: {
    maxHeight: "85%",
    backgroundColor: "#fff",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 14,
    paddingTop: 8,
    gap: 10,
    elevation: 8,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: -2 },
  },
  sheetHandle: { alignSelf: "center", width: 48, height: 4, borderRadius: 999, backgroundColor: "#e5e7eb", marginBottom: 6 },
  sectionTitle: { fontWeight: "800", color: "#111827", marginTop: 2, marginBottom: 4 },
  helper: { color: "#6b7280", fontSize: 12, marginTop: 6 },

  // Linhas cidade
  cityRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  cityDot: { marginTop: 4 },
  cityStrong: { fontSize: 16, fontWeight: "700", color: "#1f2937" },
  cityMuted:  { fontSize: 16, color: "#374151" },
});
