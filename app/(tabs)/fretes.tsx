// app/(tabs)/fretes.tsx
import { Picker } from "@react-native-picker/picker";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import * as Storage from "../backend/lib/storage";

const API_BASE = "https://app.voucarregar.com.br"; // sua URL

type Frete = {
  id: string;
  cidadeColeta: string;   // "Cuiabá - MT - Brasil"
  cidadeEntrega: string;  // "São Paulo - SP - Brasil"
  produto: string;
  pesoTotal: number;
  unidadePeso: "kg" | "toneladas";
  valorFrete: number;
  tipoCarga: "completa" | "complemento" | string;
  veiculos: string[];
  carrocerias: string[];
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

const VEICULOS = ["3/4", "Fiorino", "Toco", "VLC", "Bitruck", "Truck", "Bitrem", "Carreta", "Carreta LS", "Rodotrem", "Vanderléia"];
const CARROCERIAS = [
  "Baú","Baú Frigorífico","Baú Refrigerado","Sider","Caçamba","Grade Baixa","Graneleiro",
  "Plataforma","Prancha","Apenas Cavalo","Bug Porta Container","Cavaqueira",
  "Cegonheiro","Gaiola","Hopper","Munck","Silo","Tanque"
];

// ----------------------
// Helpers (timeout + cache)
// ----------------------
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

// ----------------------
// Fallback offline dos ESTADOS (com região)
// ----------------------
const REGIOES = {
  NORTE:       { id: 1, sigla: "N",  nome: "Norte" },
  NORDESTE:    { id: 2, sigla: "NE", nome: "Nordeste" },
  SUDESTE:     { id: 3, sigla: "SE", nome: "Sudeste" },
  SUL:         { id: 4, sigla: "S",  nome: "Sul" },
  CENTRO_OESTE:{ id: 5, sigla: "CO", nome: "Centro-Oeste" },
};

const ESTADOS_BR: EstadoIBGE[] = [
  { id: 12, sigla: "AC", nome: "Acre", regiao: REGIOES.NORTE },
  { id: 27, sigla: "AL", nome: "Alagoas", regiao: REGIOES.NORDESTE },
  { id: 16, sigla: "AP", nome: "Amapá", regiao: REGIOES.NORTE },
  { id: 13, sigla: "AM", nome: "Amazonas", regiao: REGIOES.NORTE },
  { id: 29, sigla: "BA", nome: "Bahia", regiao: REGIOES.NORDESTE },
  { id: 23, sigla: "CE", nome: "Ceará", regiao: REGIOES.NORDESTE },
  { id: 53, sigla: "DF", nome: "Distrito Federal", regiao: REGIOES.CENTRO_OESTE },
  { id: 32, sigla: "ES", nome: "Espírito Santo", regiao: REGIOES.SUDESTE },
  { id: 52, sigla: "GO", nome: "Goiás", regiao: REGIOES.CENTRO_OESTE },
  { id: 21, sigla: "MA", nome: "Maranhão", regiao: REGIOES.NORDESTE },
  { id: 51, sigla: "MT", nome: "Mato Grosso", regiao: REGIOES.CENTRO_OESTE },
  { id: 50, sigla: "MS", nome: "Mato Grosso do Sul", regiao: REGIOES.CENTRO_OESTE },
  { id: 31, sigla: "MG", nome: "Minas Gerais", regiao: REGIOES.SUDESTE },
  { id: 15, sigla: "PA", nome: "Pará", regiao: REGIOES.NORTE },
  { id: 25, sigla: "PB", nome: "Paraíba", regiao: REGIOES.NORDESTE },
  { id: 41, sigla: "PR", nome: "Paraná", regiao: REGIOES.SUL },
  { id: 26, sigla: "PE", nome: "Pernambuco", regiao: REGIOES.NORDESTE },
  { id: 22, sigla: "PI", nome: "Piauí", regiao: REGIOES.NORDESTE },
  { id: 33, sigla: "RJ", nome: "Rio de Janeiro", regiao: REGIOES.SUDESTE },
  { id: 24, sigla: "RN", nome: "Rio Grande do Norte", regiao: REGIOES.NORDESTE },
  { id: 43, sigla: "RS", nome: "Rio Grande do Sul", regiao: REGIOES.SUL },
  { id: 11, sigla: "RO", nome: "Rondônia", regiao: REGIOES.NORTE },
  { id: 14, sigla: "RR", nome: "Roraima", regiao: REGIOES.NORTE },
  { id: 42, sigla: "SC", nome: "Santa Catarina", regiao: REGIOES.SUL },
  { id: 35, sigla: "SP", nome: "São Paulo", regiao: REGIOES.SUDESTE },
  { id: 28, sigla: "SE", nome: "Sergipe", regiao: REGIOES.NORDESTE },
  { id: 17, sigla: "TO", nome: "Tocantins", regiao: REGIOES.NORTE },
];

function Tag({
  text,
  selected,
  onPress,
}: { text: string; selected: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity style={[styles.tag, selected && styles.tagSelected]} onPress={onPress} activeOpacity={0.9}>
      <Text style={[styles.tagText, selected && styles.tagTextSelected]}>{text}</Text>
    </TouchableOpacity>
  );
}

export default function FretesScreen() {
  const router = useRouter();

  // Dados
  const [loading, setLoading] = useState(true);
  const [fretes, setFretes] = useState<Frete[]>([]);
  const [estados, setEstados] = useState<EstadoIBGE[]>([]);
  const [erro, setErro] = useState<string>("");
  const [ibgeOffline, setIbgeOffline] = useState<boolean>(false);

  // Filtros
  const [mostrarFiltros, setMostrarFiltros] = useState<boolean>(false);
  const [paisOrigem, setPaisOrigem] = useState("Brasil");
  const [regiaoOrigem, setRegiaoOrigem] = useState("");
  const [estadoOrigem, setEstadoOrigem] = useState("");
  const [cidadeOrigem, setCidadeOrigem] = useState("");
  const [cidadeOrigemManual, setCidadeOrigemManual] = useState("");
  const [cidadesOrigem, setCidadesOrigem] = useState<string[]>([]);

  const [paisDestino, setPaisDestino] = useState("Brasil");
  const [regiaoDestino, setRegiaoDestino] = useState("");
  const [estadoDestino, setEstadoDestino] = useState("");
  const [cidadeDestino, setCidadeDestino] = useState("");
  const [cidadeDestinoManual, setCidadeDestinoManual] = useState("");
  const [cidadesDestino, setCidadesDestino] = useState<string[]>([]);

  const [filtroTipoCarga, setFiltroTipoCarga] = useState<"todos" | "completa" | "complemento">("todos");
  const [filtroVeiculos, setFiltroVeiculos] = useState<string[]>([]);
  const [filtroCarrocerias, setFiltroCarrocerias] = useState<string[]>([]);
  const [raioKm, setRaioKm] = useState<number | null>(null);
  const [coordsOrigem, setCoordsOrigem] = useState<{ lat: number; lon: number } | null>(null);

  const didLoadRef = useRef(false); // evita duplo fetch em dev/StrictMode

  // --- Carrega fretes e estados ---
  useEffect(() => {
    if (didLoadRef.current) return;
    didLoadRef.current = true;

    let mounted = true;
    (async () => {
      setErro("");
      setLoading(true);

      // 1) Fretes (com token; se falhar, tenta sem token)
      try {
        const token = await Storage.getItem("authToken");

        const fetchFretes = async (useAuth: boolean) => {
          const res = await fetchWithTimeout(`${API_BASE}/api/fretes/todos`, {
            method: "GET",
            headers: {
              Accept: "application/json",
              ...(useAuth && token ? { Authorization: `Bearer ${token}` } : {}),
            },
          }, 12000);
          if (!res.ok) {
            const text = await res.text().catch(() => "");
            throw new Error(`Fretes ${res.status} ${res.statusText} ${text}`);
          }
          return (await res.json()) as Frete[];
        };

        let dados: Frete[] = [];
        try {
          dados = await fetchFretes(true);
        } catch (errAuth) {
          try {
            dados = await fetchFretes(false);
          } catch (errPublic) {
            throw errPublic;
          }
        }

        if (mounted) setFretes(Array.isArray(dados) ? dados : []);
      } catch (e: any) {
        if (mounted) setErro("Não foi possível carregar os fretes.");
      }

      // 2) Estados IBGE (com timeout + fallback local)
      try {
        const resUF = await fetchWithTimeout(
          "https://servicodados.ibge.gov.br/api/v1/localidades/estados",
          {},
          8000
        );
        const estadosJson: EstadoIBGE[] = await resUF.json();
        if (mounted) {
          setEstados(estadosJson || ESTADOS_BR);
          setIbgeOffline(false);
        }
      } catch {
        if (mounted) {
          setEstados(ESTADOS_BR);
          setIbgeOffline(true);
        }
      }

      if (mounted) setLoading(false);
    })();

    return () => {
      mounted = false;
    };
  }, []);

  // Cidades origem/destino (com timeout; se falhar, deixa campo manual)
  useEffect(() => {
    (async () => {
      if (estadoOrigem && paisOrigem === "Brasil") {
        try {
          const res = await fetchWithTimeout(
            `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${estadoOrigem}/municipios`,
            {},
            8000
          );
          const data: MunicipioIBGE[] = await res.json();
          setCidadesOrigem(data.map((c) => c.nome));
        } catch {
          setCidadesOrigem([]); // fallback -> input manual
        }
      } else {
        setCidadesOrigem([]);
      }
    })();
  }, [estadoOrigem, paisOrigem]);

  useEffect(() => {
    (async () => {
      if (estadoDestino && paisDestino === "Brasil") {
        try {
          const res = await fetchWithTimeout(
            `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${estadoDestino}/municipios`,
            {},
            8000
          );
          const data: MunicipioIBGE[] = await res.json();
          setCidadesDestino(data.map((c) => c.nome));
        } catch {
          setCidadesDestino([]); // fallback -> input manual
        }
      } else {
        setCidadesDestino([]);
      }
    })();
  }, [estadoDestino, paisDestino]);

  // Coordenadas para filtro por raio
  useEffect(() => {
    (async () => {
      const cidadeFiltro = (cidadesOrigem.length ? cidadeOrigem : cidadeOrigemManual).trim();
      if (cidadeFiltro && estadoOrigem && paisOrigem === "Brasil") {
        const c = await buscarCoordenadas(cidadeFiltro, estadoOrigem);
        setCoordsOrigem(c);
      } else {
        setCoordsOrigem(null);
      }
    })();
  }, [cidadeOrigem, cidadeOrigemManual, estadoOrigem, paisOrigem, cidadesOrigem.length]);

  // Regiões únicas
  const regioes = useMemo(
    () => Array.from(new Set(estados.map((e) => e.regiao.nome))).sort(),
    [estados]
  );

  // Utils
  function toggle<T extends string>(arr: T[], setArr: (v: T[]) => void, item: T) {
    setArr(arr.includes(item) ? arr.filter((i) => i !== item) : [...arr, item]);
  }

  function limparFiltros() {
    setPaisOrigem("Brasil"); setRegiaoOrigem(""); setEstadoOrigem(""); setCidadeOrigem(""); setCidadeOrigemManual("");
    setPaisDestino("Brasil"); setRegiaoDestino(""); setEstadoDestino(""); setCidadeDestino(""); setCidadeDestinoManual("");
    setFiltroTipoCarga("todos"); setFiltroVeiculos([]); setFiltroCarrocerias([]); setRaioKm(null);
  }

  function matchEstadoNomeOuSigla(busca: string, alvo: string) {
    const est = estados.find((e) => e.sigla === busca);
    return busca === alvo || est?.nome?.toLowerCase() === alvo?.toLowerCase();
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

  const cidadeFiltroOrigem = (cidadesOrigem.length ? cidadeOrigem : cidadeOrigemManual).trim();
  const cidadeFiltroDestino = (cidadesDestino.length ? cidadeDestino : cidadeDestinoManual).trim();

  const fretesFiltrados = useMemo(() => {
    return fretes.filter((f) => {
      const [cidadeC, estadoC, paisC] = (f.cidadeColeta || "").split(" - ").map((s) => (s || "").trim());
      const [cidadeE, estadoE, paisE] = (f.cidadeEntrega || "").split(" - ").map((s) => (s || "").trim());

      // País
      if (paisOrigem && paisC && paisC !== paisOrigem) return false;
      if (paisDestino && paisE && paisE !== paisDestino) return false;

      // Região (via IBGE/fallback)
      const estOrigemObj = estados.find(
        (e) => e.sigla === estadoC || e.nome.toLowerCase() === (estadoC || "").toLowerCase()
      );
      const estDestinoObj = estados.find(
        (e) => e.sigla === estadoE || e.nome.toLowerCase() === (estadoE || "").toLowerCase()
      );
      if (paisOrigem === "Brasil" && regiaoOrigem && estOrigemObj?.regiao.nome !== regiaoOrigem) return false;
      if (paisDestino === "Brasil" && regiaoDestino && estDestinoObj?.regiao.nome !== regiaoDestino) return false;

      // Estado/Cidade
      if (paisOrigem === "Brasil" && !raioKm) {
        if (estadoOrigem && !matchEstadoNomeOuSigla(estadoOrigem, estadoC || "")) return false;
        if (cidadeFiltroOrigem && (cidadeC || "").toLowerCase() !== cidadeFiltroOrigem.toLowerCase()) return false;
      }
      if (paisDestino === "Brasil") {
        if (estadoDestino && !matchEstadoNomeOuSigla(estadoDestino, estadoE || "")) return false;
        if (cidadeFiltroDestino && (cidadeE || "").toLowerCase() !== cidadeFiltroDestino.toLowerCase()) return false;
      }

      // Tipo de carga
      if (filtroTipoCarga !== "todos" && (f.tipoCarga || "") !== filtroTipoCarga) return false;

      // Veículos / Carrocerias
      if (filtroVeiculos.length && !filtroVeiculos.some((v) => (f.veiculos || []).includes(v))) return false;
      if (filtroCarrocerias.length && !filtroCarrocerias.some((c) => (f.carrocerias || []).includes(c))) return false;

      return true;
    });
  }, [
    fretes,
    estados,
    paisOrigem,
    regiaoOrigem,
    estadoOrigem,
    cidadeFiltroOrigem,
    paisDestino,
    regiaoDestino,
    estadoDestino,
    cidadeFiltroDestino,
    filtroTipoCarga,
    filtroVeiculos,
    filtroCarrocerias,
    raioKm,
    coordsOrigem,
  ]);

  // Pré-carrega coordenadas quando há raio
  useEffect(() => {
    (async () => {
      if (!(paisOrigem === "Brasil" && raioKm && coordsOrigem)) return;
      await Promise.all(
        fretesFiltrados.map(async (f) => {
          const [cidadeC, estadoC] = (f.cidadeColeta || "").split(" - ").map((s) => (s || "").trim());
          if (!coordenadasCache.has(`${cidadeC},${estadoC}`)) {
            await buscarCoordenadas(cidadeC, estadoC);
          }
        })
      );
    })();
  }, [fretesFiltrados, paisOrigem, raioKm, coordsOrigem]);

  const fretesFinal = useMemo(() => {
    if (!(paisOrigem === "Brasil" && raioKm && coordsOrigem)) return fretesFiltrados;
    return fretesFiltrados.filter((f) => {
      const [cidadeC, estadoC] = (f.cidadeColeta || "").split(" - ").map((s) => (s || "").trim());
      const coordsFrete = coordenadasCache.get(`${cidadeC},${estadoC}`) || null;
      if (!coordsFrete) return true; // enquanto não chega, não bloqueia
      const d = haversineKm(coordsOrigem, coordsFrete);
      return d <= (raioKm || 0);
    });
  }, [fretesFiltrados, paisOrigem, raioKm, coordsOrigem]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
        <Text style={{ marginTop: 8 }}>Carregando fretes...</Text>
      </View>
    );
  }

  return (
    <View style={styles.page}>
      {!!erro && (
        <View style={styles.alert}>
          <Text style={styles.alertText}>{erro}</Text>
        </View>
      )}

      {/* Cabeçalho compacto de filtros */}
      <View style={styles.filtersHeader}>
        <TouchableOpacity onPress={() => setMostrarFiltros((v) => !v)} style={styles.filtersToggle} activeOpacity={0.9}>
          <Text style={styles.filtersToggleText}>{mostrarFiltros ? "Ocultar filtros" : "Mostrar filtros"}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={limparFiltros} style={styles.clearBtn} activeOpacity={0.9}>
          <Text style={styles.clearBtnText}>Limpar</Text>
        </TouchableOpacity>
      </View>

      {mostrarFiltros && (
        <ScrollView style={styles.filters} contentContainerStyle={{ paddingBottom: 12 }}>
          <Text style={styles.title}>🚛 Fretes <Text style={{ color: "#ea580c" }}>disponíveis</Text></Text>

          {/* Origem */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Origem</Text>
            <Text style={styles.label}>País</Text>
            <Picker selectedValue={paisOrigem} onValueChange={setPaisOrigem} style={styles.picker}>
              <Picker.Item label="Brasil" value="Brasil" />
              <Picker.Item label="Argentina" value="Argentina" />
              <Picker.Item label="Uruguai" value="Uruguai" />
              <Picker.Item label="Chile" value="Chile" />
            </Picker>

            {paisOrigem === "Brasil" && (
              <>
                <Text style={styles.label}>Região</Text>
                <Picker selectedValue={regiaoOrigem} onValueChange={setRegiaoOrigem} style={styles.picker}>
                  <Picker.Item label="Todas" value="" />
                  {regioes.map((r) => <Picker.Item key={r} label={r} value={r} />)}
                </Picker>

                <Text style={styles.label}>Estado</Text>
                <Picker selectedValue={estadoOrigem} onValueChange={(v) => { setEstadoOrigem(v); setCidadeOrigem(""); setCidadeOrigemManual(""); }} style={styles.picker}>
                  <Picker.Item label="Todos" value="" />
                  {estados.map((e) => <Picker.Item key={e.sigla} label={e.sigla} value={e.sigla} />)}
                </Picker>

                <Text style={styles.label}>Cidade</Text>
                {cidadesOrigem.length > 0 ? (
                  <Picker selectedValue={cidadeOrigem} onValueChange={setCidadeOrigem} style={styles.picker}>
                    <Picker.Item label="Todas" value="" />
                    {cidadesOrigem.map((c) => <Picker.Item key={c} label={c} value={c} />)}
                  </Picker>
                ) : (
                  <TextInput
                    value={cidadeOrigemManual}
                    onChangeText={setCidadeOrigemManual}
                    placeholder={ibgeOffline ? "Digite a cidade (IBGE offline)" : "Digite a cidade"}
                    style={styles.input}
                    placeholderTextColor="#9ca3af"
                  />
                )}
              </>
            )}

            <Text style={styles.label}>Raio (km)</Text>
            <Picker selectedValue={raioKm ?? 0} onValueChange={(v) => setRaioKm(v ? Number(v) : null)} style={styles.picker}>
              <Picker.Item label="Sem filtro" value={0} />
              <Picker.Item label="100 km" value={100} />
              <Picker.Item label="200 km" value={200} />
              <Picker.Item label="300 km" value={300} />
            </Picker>
          </View>

          {/* Destino */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Destino</Text>
            <Text style={styles.label}>País</Text>
            <Picker selectedValue={paisDestino} onValueChange={setPaisDestino} style={styles.picker}>
              <Picker.Item label="Brasil" value="Brasil" />
              <Picker.Item label="Argentina" value="Argentina" />
              <Picker.Item label="Uruguai" value="Uruguai" />
              <Picker.Item label="Chile" value="Chile" />
            </Picker>

            {paisDestino === "Brasil" && (
              <>
                <Text style={styles.label}>Região</Text>
                <Picker selectedValue={regiaoDestino} onValueChange={setRegiaoDestino} style={styles.picker}>
                  <Picker.Item label="Todas" value="" />
                  {regioes.map((r) => <Picker.Item key={r} label={r} value={r} />)}
                </Picker>

                <Text style={styles.label}>Estado</Text>
                <Picker selectedValue={estadoDestino} onValueChange={(v) => { setEstadoDestino(v); setCidadeDestino(""); setCidadeDestinoManual(""); }} style={styles.picker}>
                  <Picker.Item label="Todos" value="" />
                  {estados.map((e) => <Picker.Item key={e.sigla} label={e.sigla} value={e.sigla} />)}
                </Picker>

                <Text style={styles.label}>Cidade</Text>
                {cidadesDestino.length > 0 ? (
                  <Picker selectedValue={cidadeDestino} onValueChange={setCidadeDestino} style={styles.picker}>
                    <Picker.Item label="Todas" value="" />
                    {cidadesDestino.map((c) => <Picker.Item key={c} label={c} value={c} />)}
                  </Picker>
                ) : (
                  <TextInput
                    value={cidadeDestinoManual}
                    onChangeText={setCidadeDestinoManual}
                    placeholder={ibgeOffline ? "Digite a cidade (IBGE offline)" : "Digite a cidade"}
                    style={styles.input}
                    placeholderTextColor="#9ca3af"
                  />
                )}
              </>
            )}
          </View>

          {/* Tipo de carga */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Tipo de Carga</Text>
            <View style={styles.wrap}>
              {(["todos", "completa", "complemento"] as const).map((tipo) => (
                <Tag key={tipo} text={tipo} selected={filtroTipoCarga === tipo} onPress={() => setFiltroTipoCarga(tipo)} />
              ))}
            </View>
          </View>

          {/* Veículos */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Veículos</Text>
            <View style={styles.wrap}>
              {VEICULOS.map((v) => (
                <Tag key={v} text={v} selected={filtroVeiculos.includes(v)} onPress={() => toggle(filtroVeiculos, (arr) => setFiltroVeiculos(arr), v)} />
              ))}
            </View>
          </View>

          {/* Carrocerias */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Carrocerias</Text>
            <View style={styles.wrap}>
              {CARROCERIAS.map((c) => (
                <Tag key={c} text={c} selected={filtroCarrocerias.includes(c)} onPress={() => toggle(filtroCarrocerias, (arr) => setFiltroCarrocerias(arr), c)} />
              ))}
            </View>
          </View>
        </ScrollView>
      )}

      {/* Lista */}
      {fretesFinal.length === 0 ? (
        <View style={styles.center}>
          <Text style={{ color: "#6b7280" }}>Nenhum frete encontrado.</Text>
        </View>
      ) : (
        <FlatList
          data={fretesFinal}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{ padding: 12 }}
          renderItem={({ item }) => {
            const preco = item.valorFrete > 0
              ? item.valorFrete.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
              : "A combinar";

            return (
              <View style={styles.card}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>{item.cidadeColeta} → {item.cidadeEntrega}</Text>
                  <View style={styles.wrap}>
                    {!!item.produto && <View style={styles.badge}><Text style={styles.badgeText}>{item.produto}</Text></View>}
                    <View style={styles.badge}><Text style={styles.badgeText}>{item.pesoTotal} {item.unidadePeso === "toneladas" ? "ton" : "kg"}</Text></View>
                    {!!item.tipoCarga && <View style={styles.badge}><Text style={styles.badgeText}>{item.tipoCarga}</Text></View>}
                  </View>
                </View>

                {item.createdAt && (
                  <View style={styles.datePill}>
                    <Text style={styles.datePillText}>{new Date(item.createdAt).toLocaleDateString("pt-BR")}</Text>
                  </View>
                )}

                <View style={styles.side}>
                  {item.empresa?.logo ? (
                    <Image source={{ uri: item.empresa.logo }} style={styles.logo} resizeMode="contain" />
                  ) : null}
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={styles.price}>{preco}</Text>
                    {item.valorFrete > 0 && item.unidadePeso === "toneladas" && <Text style={styles.perTon}>por tonelada</Text>}
                    <TouchableOpacity
                      style={styles.btn}
                      activeOpacity={0.85}
                      onPress={() => router.push({ pathname: "/frete/[id]", params: { id: String(item.id) } })}
                    >
                      <Text style={styles.btnText}>Ver Frete</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#f9fafb" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },

  alert: { margin: 12, padding: 10, backgroundColor: "#fee2e2", borderColor: "#fecaca", borderWidth: 1, borderRadius: 10 },
  alertText: { color: "#b91c1c", textAlign: "center", fontWeight: "700" },

  filtersHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingTop: 10 },
  filtersToggle: { backgroundColor: "#111827", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999 },
  filtersToggleText: { color: "#fff", fontWeight: "700" },
  clearBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: "#e5e7eb", backgroundColor: "#fff" },
  clearBtnText: { color: "#111827", fontWeight: "700" },

  filters: { paddingHorizontal: 12, paddingTop: 10 },
  title: { fontSize: 22, fontWeight: "800", textAlign: "center", marginBottom: 10, color: "#111827" },
  section: { backgroundColor: "#fff", borderRadius: 12, padding: 12, borderWidth: 1, borderColor: "#e5e7eb", marginBottom: 10 },
  sectionTitle: { fontSize: 14, fontWeight: "800", color: "#111827", marginBottom: 6 },

  label: { fontSize: 12, color: "#374151", marginBottom: 4, fontWeight: "600" },
  picker: { backgroundColor: "#fff", borderRadius: 10, borderColor: "#e5e7eb", borderWidth: 1, marginBottom: 8 },
  input: { backgroundColor: "#fff", borderRadius: 10, borderColor: "#e5e7eb", borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10, color: "#111827", marginBottom: 8 },

  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tag: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: "#f3f4f6", borderWidth: 1, borderColor: "#e5e7eb" },
  tagSelected: { backgroundColor: "#111827", borderColor: "#111827" },
  tagText: { color: "#111827", fontSize: 12, fontWeight: "700" },
  tagTextSelected: { color: "#fff" },

  card: { backgroundColor: "#fff", borderRadius: 12, padding: 12, borderWidth: 1, borderColor: "#e5e7eb", margin: 6, flexDirection: "row", gap: 12, alignItems: "center" },
  cardTitle: { fontSize: 16, fontWeight: "700", color: "#1f2937", marginBottom: 6, maxWidth: 240 },
  badge: { backgroundColor: "#f3f4f6", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  badgeText: { fontSize: 12, color: "#374151" },

  datePill: { backgroundColor: "#e5e7eb", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, alignSelf: "flex-start" },
  datePillText: { fontSize: 12, color: "#b91c1c", fontWeight: "700" },

  side: { marginLeft: "auto", alignItems: "flex-end", gap: 8 },
  logo: { width: 48, height: 48, borderRadius: 6, borderColor: "#e5e7eb", borderWidth: 1 },
  price: { fontSize: 18, color: "#16a34a", fontWeight: "800" },
  perTon: { fontSize: 12, color: "#6b7280" },
  btn: { marginTop: 6, backgroundColor: "#2563eb", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 12 },
});
