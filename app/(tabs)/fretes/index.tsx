// app/(tabs)/fretes.tsx
import { Ionicons } from "@expo/vector-icons";
import { Picker } from "@react-native-picker/picker";
import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
    ActivityIndicator,
    FlatList,
    Image,
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
  unidadePeso: "toneladas" | "quilos" | string; // <-- igual ao site
  valorFrete: number | null; // -1 ou null => "A combinar"
  tipoCarga: "completa" | "complemento" | string;
  veiculos: string[];
  carrocerias: string[];
  pagaPedagio?: boolean | null;                 // <-- novo
  empresa?: { logo?: string | null } | null;
  createdAt?: string | null;
};

type EstadoIBGE = {
  id: number;
  sigla: string;
  nome: string;
  regiao: { id: number; sigla: string; nome: string };
};

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

const coordenadasCache = new Map<string, { lat: number; lon: number }>();
async function buscarCoordenadas(cidade: string, estado: string) {
  const chave = `${cidade},${estado}`;
  if (coordenadasCache.has(chave)) return coordenadasCache.get(chave)!;
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
    `${cidade},${estado},Brasil`
  )}`;
  const res = await fetchWithTimeout(url, {}, 8000);
  const data = await res.json();
  if (!Array.isArray(data) || data.length === 0) return null;
  const coords = { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
  coordenadasCache.set(chave, coords);
  return coords;
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

/* ================= UI util ================= */
function Chip({ text, onPress, active }: { text: string; onPress: () => void; active?: boolean }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.9}
      style={[styles.chip, active && styles.chipActive]}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{text}</Text>
    </TouchableOpacity>
  );
}

function Tag({ text, selected, onPress }: { text: string; selected: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity style={[styles.tag, selected && styles.tagSelected]} onPress={onPress} activeOpacity={0.9}>
      <Text style={[styles.tagText, selected && styles.tagTextSelected]}>{text}</Text>
    </TouchableOpacity>
  );
}

/* ================= Tela ================= */
export default function FretesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Dados
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [fretes, setFretes] = useState<Frete[]>([]);
  const [estados, setEstados] = useState<EstadoIBGE[]>([]);

  // Filtros rápidos
  const [cidadeOrigem, setCidadeOrigem] = useState("");
  const [cidadeDestino, setCidadeDestino] = useState("");

  // País/Região/Estado (ORIGEM)
  const [paisOrigem, setPaisOrigem] = useState<string>("Brasil");
  const [regiaoOrigem, setRegiaoOrigem] = useState<string>("");
  const [estadoOrigem, setEstadoOrigem] = useState<string>(""); // sigla

  // Menus suspensos
  const [openOrder, setOpenOrder] = useState(false);
  const [openVehicle, setOpenVehicle] = useState(false);
  const [openRadius, setOpenRadius] = useState(false);

  // Outros filtros
  const [filtroVeiculos, setFiltroVeiculos] = useState<string[]>([]);
  const [raioKm, setRaioKm] = useState<number | null>(null);
  const [coordsOrigem, setCoordsOrigem] = useState<{ lat: number; lon: number } | null>(null);

  // Mostrar/ocultar filtros
  const [filtersCollapsed, setFiltersCollapsed] = useState(false);

  // Ordenação
  type OrderBy = "padrao" | "preco" | "recente";
  const [orderBy, setOrderBy] = useState<OrderBy>("padrao");

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
        const resUF = await fetchWithTimeout(
          "https://servicodados.ibge.gov.br/api/v1/localidades/estados", {}, 8000
        );
        const estadosJson: EstadoIBGE[] = await resUF.json();
        setEstados(estadosJson);
      } catch {
        setEstados([
          { id: 35, sigla: "SP", nome: "São Paulo", regiao: { id: 3, sigla: "SE", nome: "Sudeste" } },
          { id: 33, sigla: "RJ", nome: "Rio de Janeiro", regiao: { id: 3, sigla: "SE", nome: "Sudeste" } },
          { id: 31, sigla: "MG", nome: "Minas Gerais", regiao: { id: 3, sigla: "SE", nome: "Sudeste" } },
          { id: 32, sigla: "ES", nome: "Espírito Santo", regiao: { id: 3, sigla: "SE", nome: "Sudeste" } },
          { id: 41, sigla: "PR", nome: "Paraná", regiao: { id: 4, sigla: "S", nome: "Sul" } },
          { id: 42, sigla: "SC", nome: "Santa Catarina", regiao: { id: 4, sigla: "S", nome: "Sul" } },
          { id: 43, sigla: "RS", nome: "Rio Grande do Sul", regiao: { id: 4, sigla: "S", nome: "Sul" } },
        ]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Regiões únicas
  const regioes = useMemo(
    () => Array.from(new Set(estados.map((e) => e.regiao.nome))).sort(),
    [estados]
  );

  // Coordenadas para RAIO
  useEffect(() => {
    (async () => {
      const uf = estadoOrigem || (cidadeOrigem.match(/-\s*([A-Z]{2})$/)?.[1] || "");
      const cidade = cidadeOrigem.split("-")[0]?.trim() || "";
      if (paisOrigem === "Brasil" && uf && cidade && raioKm) {
        const c = await buscarCoordenadas(cidade, uf);
        setCoordsOrigem(c);
      } else {
        setCoordsOrigem(null);
      }
    })();
  }, [paisOrigem, estadoOrigem, cidadeOrigem, raioKm]);

  // Auxiliares de filtro
  function matchEstadoNomeOuSigla(busca: string, alvo: string) {
    if (!busca || !alvo) return false;
    if (busca === alvo) return true; // sigla exata
    const estBusca = estados.find((e) => e.sigla === busca);
    if (!estBusca) return false;
    return toLowerNoAccent(estBusca.nome) === toLowerNoAccent(alvo);
  }
  function toggle<T extends string>(arr: T[], setArr: (v: T[]) => void, item: T) {
    setArr(arr.includes(item) ? arr.filter((i) => i !== item) : [...arr, item]);
  }
  function limparTudo() {
    setPaisOrigem("Brasil");
    setRegiaoOrigem("");
    setEstadoOrigem("");
    setCidadeOrigem("");
    setCidadeDestino("");
    setFiltroVeiculos([]);
    setRaioKm(null);
    setOpenOrder(false); setOpenVehicle(false); setOpenRadius(false);
  }

  // Filtro base
  const fretesFiltradosBase = useMemo(() => {
    return fretes.filter((f) => {
      const [cidadeC, estadoC, paisC] = (f.cidadeColeta || "").split(" - ").map((s) => (s || "").trim());
      const [cidadeE] = (f.cidadeEntrega || "").split(" - ").map((s) => (s || "").trim());

      if (paisOrigem && paisC && paisC !== paisOrigem) return false;

      if (paisOrigem === "Brasil" && regiaoOrigem) {
        const estObj = estados.find((e) => e.sigla === estadoC || toLowerNoAccent(e.nome) === toLowerNoAccent(estadoC || ""));
        if (estObj?.regiao.nome !== regiaoOrigem) return false;
      }

      if (paisOrigem === "Brasil" && estadoOrigem && !matchEstadoNomeOuSigla(estadoOrigem, estadoC || "")) {
        return false;
      }

      if (cidadeOrigem) {
        const cidadeTxt = cidadeOrigem.split("-")[0]?.trim() || "";
        if (toLowerNoAccent(cidadeC || "") !== toLowerNoAccent(cidadeTxt)) return false;
      }

      if (cidadeDestino) {
        const cidadeTxt = cidadeDestino.split("-")[0]?.trim() || "";
        const cidadeEntregaTxt = toLowerNoAccent(cidadeE || "");
        if (cidadeEntregaTxt !== toLowerNoAccent(cidadeTxt)) return false;
      }

      if (f.veiculos && filtroVeiculos.length && !filtroVeiculos.some((v) => (f.veiculos || []).includes(v))) {
        return false;
      }

      return true;
    });
  }, [fretes, paisOrigem, regiaoOrigem, estadoOrigem, cidadeOrigem, cidadeDestino, filtroVeiculos, estados]);

  // Aplica RAIO
  const fretesFinal = useMemo(() => {
    if (!(paisOrigem === "Brasil" && raioKm && coordsOrigem)) return fretesFiltradosBase;
    return fretesFiltradosBase.filter((f) => {
      const [cidadeC, estadoC] = (f.cidadeColeta || "").split(" - ").map((s) => (s || "").trim());
      const key = `${cidadeC},${estadoC}`;
      const coords = coordenadasCache.get(key);
      if (!coords) return true;
      const d = haversineKm(coordsOrigem, coords);
      return d <= (raioKm || 0);
    });
  }, [fretesFiltradosBase, paisOrigem, raioKm, coordsOrigem]);

  // Ordenação
  const fretesOrdenados = useMemo(() => {
    const arr = [...fretesFinal];
    if (orderBy === "preco") {
      // crescente; "A combinar" (<=0 ou null) vai pro final
      arr.sort((a, b) => {
        const va = a.valorFrete && a.valorFrete > 0 ? a.valorFrete : Number.POSITIVE_INFINITY;
        const vb = b.valorFrete && b.valorFrete > 0 ? b.valorFrete : Number.POSITIVE_INFINITY;
        return va - vb;
      });
    } else if (orderBy === "recente") {
      arr.sort((a, b) => {
        const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return tb - ta; // mais novo primeiro
      });
    }
    return arr;
  }, [fretesFinal, orderBy]);

  /* --------- Render item (alinhado ao site) --------- */
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
        {/* Esquerda: origem/destino + chips */}
        <View style={{ flex: 1 }}>
          <View style={styles.cityBlock}>
  <View style={styles.cityRow}>
    <Text style={styles.cityDot}>⬤</Text>
    <View style={{ flex: 1 }}>
      <Text style={styles.cityStrong}>{item.cidadeColeta}</Text>
      <Text style={styles.cityMuted}>{item.cidadeEntrega}</Text>
    </View>
  </View>
</View>


          <View style={styles.wrap}>
            {!!item.produto && (
              <View style={styles.badge}><Text style={styles.badgeText}>{item.produto}</Text></View>
            )}
            <View style={styles.badge}>
              <Text style={styles.badgeText}>
                {item.pesoTotal} {isTonelada ? "ton" : "kg"}
              </Text>
            </View>
            {!!item.tipoCarga && (
              <View style={styles.badge}><Text style={styles.badgeText}>{item.tipoCarga}</Text></View>
            )}
          </View>

          {item.createdAt && (
            <View style={styles.datePill}>
              <Text style={styles.datePillText}>
                {new Date(item.createdAt).toLocaleDateString("pt-BR")}
              </Text>
            </View>
          )}
        </View>

        {/* Direita: logo + preço com regras do site */}
        <View style={styles.side}>
          {item.empresa?.logo ? (
            <Image source={{ uri: item.empresa.logo }} style={styles.logo} resizeMode="contain" />
          ) : null}

          <View style={{ alignItems: "flex-end" }}>
            <Text style={styles.price}>{precoFmt}</Text>

            {/* observação de unidade/pedágio (igual ao Next) */}
            {!precoACombinar && (
              isTonelada ? (
                <Text style={styles.perNote}>por tonelada{pedagio}</Text>
              ) : isQuilos ? (
                item.pagaPedagio ? <Text style={styles.perNote}>{pedagio.trim()}</Text> : null
              ) : null
            )}

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

      {/* === Header de filtros === */}
      {!filtersCollapsed ? (
        <View style={styles.headerFilters}>
          <TouchableOpacity
            onPress={() => setFiltersCollapsed(true)}
            style={styles.collapseBtn}
            activeOpacity={0.9}
          >
            <Ionicons name="chevron-up" size={18} color="#111827" />
          </TouchableOpacity>

          <View style={styles.searchRow}>
            <TextInput
              placeholder="Origem (ex: Porto Alegre - RS)"
              value={cidadeOrigem}
              onChangeText={setCidadeOrigem}
              style={[styles.input, { flex: 1 }]}
              placeholderTextColor="#9ca3af"
            />
            <TextInput
              placeholder="Destino (opcional)"
              value={cidadeDestino}
              onChangeText={setCidadeDestino}
              style={[styles.input, { flex: 1 }]}
              placeholderTextColor="#9ca3af"
            />
          </View>

          <View style={[styles.wrap, { marginTop: 6 }]}>
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
                  }
                }}
              />
            ))}
            <Tag text="Limpar" selected={false} onPress={limparTudo} />
          </View>

          {paisOrigem === "Brasil" && (
            <View style={[styles.wrap, { marginTop: 8 }]}>
              {Array.from(new Set(estados.map((e) => e.regiao.nome))).sort().map((r) => (
                <Tag
                  key={r}
                  text={r}
                  selected={regiaoOrigem === r}
                  onPress={() => {
                    const next = regiaoOrigem === r ? "" : r;
                    setRegiaoOrigem(next);
                    setEstadoOrigem("");
                  }}
                />
              ))}
            </View>
          )}

          {paisOrigem === "Brasil" && (
            <View style={[styles.wrap, { marginTop: 8 }]}>
              {estados
                .filter((e) => !regiaoOrigem || e.regiao.nome === regiaoOrigem)
                .sort((a, b) => a.sigla.localeCompare(b.sigla))
                .map((e) => (
                  <Tag
                    key={e.sigla}
                    text={e.sigla}
                    selected={estadoOrigem === e.sigla}
                    onPress={() => setEstadoOrigem((prev) => (prev === e.sigla ? "" : e.sigla))}
                  />
                ))}
            </View>
          )}

          <View style={[styles.wrap, { marginTop: 12 }]}>
            <Chip
              text={`Ordenar${orderBy !== "padrao" ? `: ${orderBy === "preco" ? "Preço" : "Recentes"}` : ""}`}
              active={openOrder}
              onPress={() => { setOpenOrder((p) => !p); setOpenVehicle(false); setOpenRadius(false); }}
            />
            <Chip
              text="Veículo"
              active={openVehicle}
              onPress={() => { setOpenVehicle((p) => !p); setOpenOrder(false); setOpenRadius(false); }}
            />
            <Chip
              text="Raio"
              active={openRadius}
              onPress={() => { setOpenRadius((p) => !p); setOpenOrder(false); setOpenVehicle(false); }}
            />
          </View>

          {openOrder && (
            <View style={styles.dropdown}>
              <Text style={styles.dropdownTitle}>Ordenar por</Text>
              <View style={styles.wrap}>
                <Tag text="Padrão" selected={orderBy === "padrao"} onPress={() => { setOrderBy("padrao"); setOpenOrder(false); }} />
                <Tag text="Preço"  selected={orderBy === "preco"}  onPress={() => { setOrderBy("preco");  setOpenOrder(false); }} />
                <Tag text="Mais recentes" selected={orderBy === "recente"} onPress={() => { setOrderBy("recente"); setOpenOrder(false); }} />
              </View>
            </View>
          )}


          {openVehicle && (
            <View style={styles.dropdown}>
              <Text style={styles.dropdownTitle}>Veículos (selecione 1 ou mais)</Text>
              <View style={styles.wrap}>
                {VEICULOS.map((v) => (
                  <Tag
                    key={v}
                    text={v}
                    selected={filtroVeiculos.includes(v)}
                    onPress={() => toggle(filtroVeiculos, (arr) => setFiltroVeiculos(arr), v)}
                  />
                ))}
              </View>
            </View>
          )}

          {openRadius && (
            <View style={styles.dropdown}>
              <Text style={styles.dropdownTitle}>Raio de busca a partir da ORIGEM</Text>
              <Picker
                selectedValue={raioKm ?? 0}
                onValueChange={(v) => setRaioKm(v ? Number(v) : null)}
                style={styles.picker}
              >
                <Picker.Item label="Sem filtro" value={0} />
                <Picker.Item label="50 km" value={50} />
                <Picker.Item label="100 km" value={100} />
                <Picker.Item label="200 km" value={200} />
                <Picker.Item label="300 km" value={300} />
              </Picker>
              {!!raioKm && (
                <Text style={{ color: "#6b7280", fontSize: 12 }}>
                  Dica: preencha a origem como “Cidade - UF” para melhor precisão.
                </Text>
              )}
            </View>
          )}
        </View>
      ) : (
        <View style={styles.headerCollapsed}>
          <Text style={styles.headerCollapsedText}>Filtros ocultos</Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Tag text={paisOrigem} selected={false} onPress={() => {}} />
            {!!estadoOrigem && <Tag text={estadoOrigem} selected={false} onPress={() => {}} />}
            {!!cidadeOrigem && <Tag text={cidadeOrigem.split("-")[0].trim()} selected={false} onPress={() => {}} />}
            {orderBy !== "padrao" && <Tag text={orderBy === "preco" ? "Preço" : "Recentes"} selected={false} onPress={() => {}} />}
          </View>
          <TouchableOpacity onPress={() => setFiltersCollapsed(false)} style={styles.expandBtn} activeOpacity={0.9}>
            <Ionicons name="chevron-down" size={18} color="#111827" />
          </TouchableOpacity>
        </View>
      )}

      {/* === Lista === */}
      {fretesOrdenados.length === 0 ? (
        <View style={[styles.center, { paddingVertical: 24 }]}>
          <Text style={{ color: "#6b7280" }}>Nenhum frete encontrado.</Text>
        </View>
      ) : (
        <FlatList
          data={fretesOrdenados}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{ padding: 12, paddingBottom: 16 }}
          renderItem={renderFrete}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

/* ================= Estilos ================= */
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f9fafb" },

  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#f9fafb" },

  alert: {
    margin: 12, padding: 10, backgroundColor: "#fee2e2",
    borderColor: "#fecaca", borderWidth: 1, borderRadius: 10,
  },
  alertText: { color: "#b91c1c", textAlign: "center", fontWeight: "700" },

  headerFilters: {
    margin: 12, padding: 12, borderRadius: 12,
    borderWidth: 1, borderColor: "#e5e7eb", backgroundColor: "#fff",
    position: "relative",
  },
  collapseBtn: {
    position: "absolute",
    right: 8,
    bottom: 8,
    width: 32, height: 32, borderRadius: 16,
    borderWidth: 1, borderColor: "#e5e7eb", backgroundColor: "#fff",
    alignItems: "center", justifyContent: "center",
  },

  headerCollapsed: {
    margin: 12, padding: 12, borderRadius: 12,
    borderWidth: 1, borderColor: "#e5e7eb", backgroundColor: "#fff",
    gap: 8, position: "relative",
  },
  headerCollapsedText: { color: "#6b7280", fontSize: 12 },
  expandBtn: {
    position: "absolute",
    right: 8, bottom: 8, width: 32, height: 32, borderRadius: 16,
    borderWidth: 1, borderColor: "#e5e7eb", backgroundColor: "#fff",
    alignItems: "center", justifyContent: "center",
  },

  searchRow: { flexDirection: "row", gap: 8, marginBottom: 8 },
  input: {
    backgroundColor: "#fff", borderRadius: 10, borderColor: "#e5e7eb",
    borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10, color: "#111827",
  },

  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },

  chip: {
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 999,
    backgroundColor: "#fff", borderWidth: 1, borderColor: "#e5e7eb",
  },
  chipActive: { backgroundColor: "#111827", borderColor: "#111827" },
  chipText: { color: "#111827", fontWeight: "700" },
  chipTextActive: { color: "#fff" },

  dropdown: {
    marginTop: 10, padding: 12, borderRadius: 12,
    borderWidth: 1, borderColor: "#e5e7eb", backgroundColor: "#fff",
  },
  dropdownTitle: { fontWeight: "800", color: "#111827", marginBottom: 8 },

  tag: {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999,
    backgroundColor: "#f3f4f6", borderWidth: 1, borderColor: "#e5e7eb",
  },
  tagSelected: { backgroundColor: "#111827", borderColor: "#111827" },
  tagText: { color: "#111827", fontSize: 12, fontWeight: "700" },
  tagTextSelected: { color: "#fff" },

  picker: {
    backgroundColor: "#fff", borderRadius: 10, borderColor: "#e5e7eb",
    borderWidth: 1, marginBottom: 8,
  },

  card: {
    backgroundColor: "#fff", borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: "#e5e7eb", marginVertical: 6,
    flexDirection: "row", gap: 12, alignItems: "center",
  },
  cardTitle: { fontSize: 16, fontWeight: "700", color: "#1f2937", marginBottom: 6, maxWidth: 240 },
  badge: { backgroundColor: "#f3f4f6", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  badgeText: { fontSize: 12, color: "#374151" },

  datePill: { backgroundColor: "#e5e7eb", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, alignSelf: "flex-start" },
  datePillText: { fontSize: 12, color: "#b91c1c", fontWeight: "700" },

  side: { marginLeft: "auto", alignItems: "flex-end", gap: 8 },
  logo: { width: 48, height: 48, borderRadius: 6, borderColor: "#e5e7eb", borderWidth: 1 },
  price: { fontSize: 18, color: "#16a34a", fontWeight: "800" },
  perNote: { fontSize: 12, color: "#6b7280", marginTop: 2 },
  btn: { marginTop: 6, backgroundColor: "#ea7713ff", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 12 },

  cityBlock: { marginBottom: 6 },
  cityRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  cityDot: { marginTop: 4 }, // posiciona o pontinho alinhado
  cityStrong: { fontSize: 16, fontWeight: "700", color: "#1f2937" },   // linha de cima (origem)
  cityMuted:  { fontSize: 16, color: "#374151" },                      // linha de baixo (destino)

});
