// app/cadastro/index.tsx
import * as DocumentPicker from "expo-document-picker";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

const API_BASE = "https://app.voucarregar.com.br";

// 🔧 Cloudinary (preencha com seus dados; o upload preset precisa ser UNSIGNED)
const CLOUDINARY_CLOUD_NAME = "dm8jg5l59";
const CLOUDINARY_UPLOAD_PRESET = "voucarregar";

type TipoCadastro = "caminhoneiro";

type FormularioCadastro = {
  nome: string;
  cpf: string;
  cidade: string;
  estado: string;
  bairro: string;
  rua: string;
  cep: string;
  email: string;
  celular: string;
  senha: string;
  confirmarSenha: string;
  aceitaWhatsapp: boolean;
  aceitaLgpd: boolean;
};

function formatarCpf(v: string) {
  return v
    .replace(/\D/g, "")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2")
    .slice(0, 14);
}
function formatarCep(v: string) {
  return v.replace(/\D/g, "").replace(/^(\d{5})(\d)/, "$1-$2").slice(0, 9);
}
function formatarCelular(v: string) {
  return v
    .replace(/\D/g, "")
    .replace(/^(\d{2})(\d)/, "($1) $2")
    .replace(/(\d{5})(\d)/, "$1-$2")
    .slice(0, 15);
}

// 🔼 Upload da CNH para Cloudinary; retorna URL segura
async function uploadCnhParaCloudinary(asset: DocumentPicker.DocumentPickerAsset) {
  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_UPLOAD_PRESET) {
    throw new Error(
      "Cloudinary não configurado. Defina CLOUDINARY_CLOUD_NAME e CLOUDINARY_UPLOAD_PRESET no código."
    );
  }

  const fd = new FormData();
  // @ts-expect-error RN file
  fd.append("file", {
    uri: asset.uri,
    name:
      asset.name ??
      (asset.mimeType?.includes("pdf") ? "cnh.pdf" : "cnh.jpg"),
    type:
      asset.mimeType ??
      (asset.name?.toLowerCase().endsWith(".pdf")
        ? "application/pdf"
        : "image/jpeg"),
  });
  fd.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
  fd.append("folder", "voucarregar");

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/auto/upload`,
    { method: "POST", body: fd }
  );
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json?.secure_url) {
    throw new Error(json?.error?.message || "Falha no upload da CNH.");
  }
  return String(json.secure_url) as string;
}

export default function CadastroCaminhoneiro() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [etapa, setEtapa] = useState<1 | 2 | 3>(1);
  const [enviando, setEnviando] = useState(false);
  const [mensagem, setMensagem] = useState("");

  const tipo: TipoCadastro = "caminhoneiro";

  const [form, setForm] = useState<FormularioCadastro>({
    nome: "",
    cpf: "",
    cidade: "",
    estado: "",
    bairro: "",
    rua: "",
    cep: "",
    email: "",
    celular: "",
    senha: "",
    confirmarSenha: "",
    aceitaWhatsapp: false,
    aceitaLgpd: false,
  });

  const [cnh, setCnh] = useState<DocumentPicker.DocumentPickerAsset | null>(null);

  function atualizar<K extends keyof FormularioCadastro>(k: K, v: FormularioCadastro[K]) {
    setForm((p) => ({ ...p, [k]: v }));
  }

  async function escolherCNH() {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ["image/*", "application/pdf"],
        multiple: false,
        copyToCacheDirectory: true,
      });
      if (!res.canceled && res.assets?.[0]) {
        setCnh(res.assets[0]);
      }
    } catch {
      Alert.alert("Erro", "Não foi possível selecionar o arquivo.");
    }
  }

  async function buscarPorCEP(cepMascarado: string) {
    const cepLimpo = cepMascarado.replace(/\D/g, "");
    if (cepLimpo.length !== 8) return;
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`);
      const data = await res.json();
      if (data?.erro) return;
      atualizar("rua", data.logradouro || "");
      atualizar("bairro", data.bairro || "");
      atualizar("cidade", data.localidade || "");
      atualizar("estado", data.uf || "");
    } catch {}
  }

  async function enviarFormulario() {
    try {
      setMensagem("");

      if (form.senha !== form.confirmarSenha) {
        setMensagem("As senhas não coincidem.");
        return;
      }

      if (
        !form.nome ||
        !form.cpf ||
        !form.email ||
        !form.cidade ||
        !form.estado ||
        !form.rua ||
        !form.bairro ||
        !form.cep ||
        !form.celular ||
        !cnh
      ) {
        setMensagem("Preencha todos os campos obrigatórios e anexe a CNH.");
        return;
      }

      // limite local 10MB
      const LIM_MB = 10;
      if (cnh.size && cnh.size > LIM_MB * 1024 * 1024) {
        setMensagem(`O arquivo da CNH excede ${LIM_MB}MB.`);
        return;
      }

      setEnviando(true);

      // 1) Sobe a CNH e obtém URL
      const cnhUrl = await uploadCnhParaCloudinary(cnh);

      // 2) Monta payload JSON (igual ao site)
      const payload = {
        tipo,
        aceitaLgpd: form.aceitaLgpd,
        nome: form.nome, // no caso de caminhoneiro, é o próprio nome
        nomeFantasia: "", // não usado para caminhoneiro
        email: form.email,
        celular: form.celular.replace(/\D/g, ""),
        cep: form.cep.replace(/\D/g, ""),
        rua: form.rua,
        bairro: form.bairro,
        cidade: form.cidade,
        estado: form.estado,
        senha: form.senha,
        cnpjtexto: undefined, // não se aplica
        cpf: form.cpf.replace(/\D/g, ""),
        aceitaWhatsapp: form.aceitaWhatsapp,
        arquivos: {
          cnh: cnhUrl, // ✅ URL já hospedada
          logo: "",
          comprovanteEndereco: "",
          cartaoCnpj: "",
          registroAnttArquivo: "",
        },
      };

      // 3) Envia ao backend como JSON
      const res = await fetch(`${API_BASE}/api/cadastro`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(payload),
      });

      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        // a sua API costuma mandar .mensagem
        throw new Error(body?.mensagem || body?.erro || `Erro ${res.status}`);
      }

      Alert.alert("Sucesso", "Cadastro concluído! Enviamos seus dados por e-mail.");
      router.replace("/"); // 👈 envia para index.tsx
    } catch (e: any) {
      Alert.alert("Erro", e?.message || "Falha ao enviar cadastro.");
    } finally {
      setEnviando(false);
    }
  }

  useEffect(() => {
    const cepLimpo = form.cep.replace(/\D/g, "");
    if (cepLimpo.length === 8) buscarPorCEP(form.cep);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.cep]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }} edges={["top", "left", "right"]}>
      <ScrollView
        style={{ flex: 1, backgroundColor: "#fff" }}
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
      >
        {/* Header com Safe Area */}
        <View style={[styles.header, { paddingTop: (insets.top ?? 0) + 8 }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
            <Text style={styles.headerBtnText}>←</Text>
          </TouchableOpacity>
          <Text style={styles.brand}>
            vou<Text style={{ color: "#000" }}>carregar</Text>
          </Text>
          <View style={styles.headerBtn} />
        </View>

        {/* Passos */}
        <View style={styles.steps}>
          {["Dados", "Documento", "Acesso"].map((t, i) => {
            const ativo = etapa === (i + 1);
            return (
              <View key={t} style={[styles.step, ativo && styles.stepActive]}>
                <Text style={[styles.stepText, ativo && styles.stepTextActive]}>{t}</Text>
              </View>
            );
          })}
        </View>

        {/* Etapa 1 - Dados */}
        {etapa === 1 && (
          <View style={{ gap: 10 }}>
            <Text style={styles.title}>Cadastro do Caminhoneiro</Text>

            <TextInput
              placeholder="CPF"
              value={form.cpf}
              onChangeText={(v) => atualizar("cpf", formatarCpf(v))}
              style={styles.input}
              placeholderTextColor="#9ca3af"
              keyboardType="number-pad"
            />

            <TextInput
              placeholder="Nome completo"
              value={form.nome}
              onChangeText={(v) => atualizar("nome", v)}
              style={styles.input}
              placeholderTextColor="#9ca3af"
            />

            <TextInput
              placeholder="E-mail"
              value={form.email}
              onChangeText={(v) => atualizar("email", v)}
              style={styles.input}
              placeholderTextColor="#9ca3af"
              autoCapitalize="none"
              keyboardType="email-address"
            />

            <TextInput
              placeholder="Celular"
              value={form.celular}
              onChangeText={(v) => atualizar("celular", formatarCelular(v))}
              style={styles.input}
              placeholderTextColor="#9ca3af"
              keyboardType="phone-pad"
            />

            <TextInput
              placeholder="CEP"
              value={form.cep}
              onChangeText={(v) => atualizar("cep", formatarCep(v))}
              style={styles.input}
              placeholderTextColor="#9ca3af"
              keyboardType="number-pad"
            />

            <TextInput
              placeholder="Rua"
              value={form.rua}
              onChangeText={(v) => atualizar("rua", v)}
              style={styles.input}
              placeholderTextColor="#9ca3af"
            />
            <TextInput
              placeholder="Bairro"
              value={form.bairro}
              onChangeText={(v) => atualizar("bairro", v)}
              style={styles.input}
              placeholderTextColor="#9ca3af"
            />
            <TextInput
              placeholder="Cidade"
              value={form.cidade}
              onChangeText={(v) => atualizar("cidade", v)}
              style={styles.input}
              placeholderTextColor="#9ca3af"
            />
            <TextInput
              placeholder="Estado (UF)"
              value={form.estado}
              onChangeText={(v) => atualizar("estado", v)}
              style={styles.input}
              placeholderTextColor="#9ca3af"
              autoCapitalize="characters"
              maxLength={2}
            />

            <TouchableOpacity
              style={styles.checkbox}
              onPress={() => atualizar("aceitaWhatsapp", !form.aceitaWhatsapp)}
              activeOpacity={0.7}
            >
              <View style={[styles.checkBoxSquare, form.aceitaWhatsapp && styles.checkBoxSquareOn]} />
              <Text style={styles.checkboxText}>Aceito receber comunicações via WhatsApp.</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.primaryBtn} onPress={() => setEtapa(2)}>
              <Text style={styles.primaryBtnText}>Avançar</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Etapa 2 - Documento (CNH) */}
        {etapa === 2 && (
          <View style={{ gap: 10 }}>
            <Text style={styles.title}>Documento CNH</Text>

            <TouchableOpacity style={styles.upload} onPress={escolherCNH} activeOpacity={0.8}>
              <Text style={{ color: "#374151" }}>
                {cnh ? `Selecionado: ${cnh.name || "arquivo"}` : "Selecionar CNH (imagem ou PDF)"}
              </Text>
            </TouchableOpacity>

            <View style={styles.rowBetween}>
              <TouchableOpacity onPress={() => setEtapa(1)}>
                <Text style={{ color: "#dc2626", fontWeight: "600" }}>Voltar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.primaryBtn} onPress={() => setEtapa(3)}>
                <Text style={styles.primaryBtnText}>Avançar</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Etapa 3 - Senha & LGPD */}
        {etapa === 3 && (
          <View style={{ gap: 10 }}>
            <Text style={styles.title}>Acesso e LGPD</Text>

            <TextInput
              placeholder="Senha"
              value={form.senha}
              onChangeText={(v) => atualizar("senha", v)}
              style={styles.input}
              placeholderTextColor="#9ca3af"
              secureTextEntry
              autoCapitalize="none"
            />
            <TextInput
              placeholder="Confirmar senha"
              value={form.confirmarSenha}
              onChangeText={(v) => atualizar("confirmarSenha", v)}
              style={styles.input}
              placeholderTextColor="#9ca3af"
              secureTextEntry
              autoCapitalize="none"
            />

            <View style={styles.lgpdBox}>
              <Text style={styles.lgpdTitle}>LGPD – Proteção de Dados Pessoais</Text>
              <Text style={styles.lgpdText}>
                Ao criar sua conta, você concorda que é responsável pela segurança de seus dados
                de acesso (senha), pela veracidade das informações e pela guarda de acesso.
              </Text>
            </View>

            <TouchableOpacity
              style={styles.checkbox}
              onPress={() => atualizar("aceitaLgpd", !form.aceitaLgpd)}
              activeOpacity={0.7}
            >
              <View style={[styles.checkBoxSquare, form.aceitaLgpd && styles.checkBoxSquareOn]} />
              <Text style={styles.checkboxText}>
                Li e concordo com os termos de uso e política de privacidade (LGPD).
              </Text>
            </TouchableOpacity>

            {!!mensagem && <Text style={{ textAlign: "center", color: "#111827" }}>{mensagem}</Text>}

            <View style={styles.rowBetween}>
              <TouchableOpacity onPress={() => setEtapa(2)}>
                <Text style={{ color: "#dc2626", fontWeight: "600" }}>Voltar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.primaryBtn, !form.aceitaLgpd && { opacity: 0.6 }]}
                onPress={enviarFormulario}
                disabled={!form.aceitaLgpd || enviando}
              >
                {enviando ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Criar cadastro</Text>}
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    width: "100%",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#fff",
  },
  headerBtn: { padding: 6 },
  headerBtnText: { fontSize: 20, color: "#4b5563" },
  brand: { fontSize: 22, fontWeight: "800", color: "#ea580c" },

  steps: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginVertical: 12,
    gap: 8,
  },
  step: {
    flex: 1,
    borderBottomWidth: 4,
    borderBottomColor: "#e5e7eb",
    paddingVertical: 6,
    alignItems: "center",
  },
  stepActive: { borderBottomColor: "#ea580c" },
  stepText: { color: "#6b7280", fontWeight: "600" },
  stepTextActive: { color: "#ea580c" },

  title: { fontSize: 18, fontWeight: "800", color: "#111827", marginBottom: 6 },

  input: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === "ios" ? 12 : 10,
    color: "#111827",
  },

  checkbox: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 },
  checkBoxSquare: {
    width: 18,
    height: 18,
    borderWidth: 1,
    borderColor: "#9ca3af",
    borderRadius: 4,
    backgroundColor: "#fff",
  },
  checkBoxSquareOn: { backgroundColor: "#111827", borderColor: "#111827" },
  checkboxText: { color: "#374151", flex: 1 },

  upload: {
    padding: 14,
    backgroundColor: "#f3f4f6",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    alignItems: "center",
  },

  lgpdBox: { backgroundColor: "#f3f4f6", padding: 12, borderRadius: 8 },
  lgpdTitle: { fontSize: 14, fontWeight: "700", color: "#111827", marginBottom: 4 },
  lgpdText: { fontSize: 13, color: "#374151" },

  primaryBtn: {
    backgroundColor: "#ea580c",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: "center",
    alignSelf: "flex-end",
    minWidth: 140,
  },
  primaryBtnText: { color: "#fff", fontWeight: "800" },

  rowBetween: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
});
