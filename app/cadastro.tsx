// app/cadastro/index.tsx

import * as DocumentPicker from "expo-document-picker";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

/* ========================================================= */
/* CONFIGURAÇÃO */
/* ========================================================= */

const API_BASE = "https://www.meufreteiro.com";

const LIMITE_ARQUIVO_MB =
  10;

/* ========================================================= */
/* TIPOS */
/* ========================================================= */

type Etapa =
  | 1
  | 2
  | 3
  | 4;

type TipoVeiculo =
  | "MOTO"
  | "CARRO"
  | "FIORINO_UTILITARIO_PEQUENO"
  | "VAN"
  | "CAMINHAO_PEQUENO"
  | "CAMINHAO_MEDIO"
  | "OUTRO";

type TipoDocumento =
  | "cnh"
  | "documento-veiculo"
  | "comprovante-endereco";

type FormularioCadastro = {
  nome: string;
  cpf: string;
  email: string;
  celular: string;
  cidade: string;
  estado: string;

  tipoVeiculo:
    | TipoVeiculo
    | "";

  placaVeiculo: string;

  aceitaWhatsapp: boolean;
  aceitaLgpd: boolean;
};

type DocumentoSelecionado =
  DocumentPicker.DocumentPickerAsset | null;

type UploadResponse = {
  key?: string;
  url?: string;
  error?: string;
  erro?: string;
  mensagem?: string;
};

type CadastroResponse = {
  ok?: boolean;
  id?: string;
  mensagem?: string;
  message?: string;
  error?: string;
  erro?: string;
};

/* ========================================================= */
/* VEÍCULOS */
/* ========================================================= */

const TIPOS_VEICULO: Array<{
  value: TipoVeiculo;
  label: string;
}> = [
  {
    value:
      "MOTO",
    label:
      "Moto",
  },
  {
    value:
      "CARRO",
    label:
      "Carro",
  },
  {
    value:
      "FIORINO_UTILITARIO_PEQUENO",
    label:
      "Fiorino / Utilitário pequeno",
  },
  {
    value:
      "VAN",
    label:
      "Van",
  },
  {
    value:
      "CAMINHAO_PEQUENO",
    label:
      "Caminhão pequeno",
  },
  {
    value:
      "CAMINHAO_MEDIO",
    label:
      "Caminhão médio",
  },
  {
    value:
      "OUTRO",
    label:
      "Outro",
  },
];

/* ========================================================= */
/* HELPERS */
/* ========================================================= */

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

function formatarCelular(
  valor: string
) {
  const numeros =
    valor
      .replace(
        /\D/g,
        ""
      )
      .slice(
        0,
        11
      );

  if (
    numeros.length <=
    10
  ) {
    return numeros
      .replace(
        /^(\d{2})(\d)/,
        "($1) $2"
      )
      .replace(
        /(\d{4})(\d)/,
        "$1-$2"
      );
  }

  return numeros
    .replace(
      /^(\d{2})(\d)/,
      "($1) $2"
    )
    .replace(
      /(\d{5})(\d)/,
      "$1-$2"
    );
}

function formatarPlaca(
  valor: string
) {
  return valor
    .replace(
      /[^a-zA-Z0-9]/g,
      ""
    )
    .toUpperCase()
    .slice(
      0,
      7
    );
}

function normalizarTexto(
  valor: string
) {
  return valor
    .trim()
    .replace(
      /\s+/g,
      " "
    );
}

function emailValido(
  email: string
) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    email.trim()
  );
}

function placaValida(
  placa: string
) {
  const valor =
    placa
      .replace(
        /[^A-Z0-9]/gi,
        ""
      )
      .toUpperCase();

  /*
   * Padrão antigo:
   * ABC1234
   *
   * Mercosul:
   * ABC1D23
   */
  return (
    /^[A-Z]{3}[0-9]{4}$/.test(
      valor
    ) ||
    /^[A-Z]{3}[0-9][A-Z][0-9]{2}$/.test(
      valor
    )
  );
}

function nomeArquivo(
  documento: DocumentoSelecionado
) {
  if (!documento) {
    return "";
  }

  return (
    documento.name ||
    "arquivo selecionado"
  );
}

function tamanhoValido(
  documento: DocumentoSelecionado
) {
  if (
    !documento ||
    !documento.size
  ) {
    return true;
  }

  return (
    documento.size <=
    LIMITE_ARQUIVO_MB *
      1024 *
      1024
  );
}

function tipoMimeArquivo(
  asset: DocumentPicker.DocumentPickerAsset
) {
  if (
    asset.mimeType
  ) {
    return asset.mimeType;
  }

  const nome =
    asset.name
      ?.toLowerCase() ||
    "";

  if (
    nome.endsWith(
      ".pdf"
    )
  ) {
    return "application/pdf";
  }

  if (
    nome.endsWith(
      ".png"
    )
  ) {
    return "image/png";
  }

  return "image/jpeg";
}

/* ========================================================= */
/* COMPONENTE */
/* ========================================================= */

export default function CadastroFreteiro() {
  const router =
    useRouter();

  const insets =
    useSafeAreaInsets();

  /* ======================================================= */
  /* ESTADO GERAL */
  /* ======================================================= */

  const [
    etapa,
    setEtapa,
  ] =
    useState<Etapa>(
      1
    );

  const [
    enviando,
    setEnviando,
  ] =
    useState(false);

  const [
    mensagem,
    setMensagem,
  ] =
    useState("");

  const [
    seletorVeiculoAberto,
    setSeletorVeiculoAberto,
  ] =
    useState(false);

  /* ======================================================= */
  /* FORMULÁRIO */
  /* ======================================================= */

  const [
    form,
    setForm,
  ] =
    useState<FormularioCadastro>({
      nome:
        "",

      cpf:
        "",

      email:
        "",

      celular:
        "",

      cidade:
        "",

      estado:
        "",

      tipoVeiculo:
        "",

      placaVeiculo:
        "",

      aceitaWhatsapp:
        false,

      aceitaLgpd:
        false,
    });

  /* ======================================================= */
  /* DOCUMENTOS */
  /* ======================================================= */

  const [
    cnh,
    setCnh,
  ] =
    useState<DocumentoSelecionado>(
      null
    );

  const [
    documentoVeiculo,
    setDocumentoVeiculo,
  ] =
    useState<DocumentoSelecionado>(
      null
    );

  const [
    comprovanteEndereco,
    setComprovanteEndereco,
  ] =
    useState<DocumentoSelecionado>(
      null
    );

  /* ======================================================= */
  /* FORM HELPERS */
  /* ======================================================= */

  function atualizar<
    K extends keyof FormularioCadastro
  >(
    campo: K,
    valor: FormularioCadastro[K]
  ) {
    setForm(
      (
        anterior
      ) => ({
        ...anterior,
        [campo]:
          valor,
      })
    );
  }

  /* ======================================================= */
  /* DOCUMENT PICKER */
  /* ======================================================= */

  async function selecionarDocumento(
    destino:
      | "cnh"
      | "documentoVeiculo"
      | "comprovanteEndereco"
  ) {
    try {
      const resultado =
        await DocumentPicker.getDocumentAsync({
          type: [
            "application/pdf",
            "image/jpeg",
            "image/png",
          ],

          multiple:
            false,

          copyToCacheDirectory:
            true,
        });

      if (
        resultado.canceled ||
        !resultado.assets?.[0]
      ) {
        return;
      }

      const asset =
        resultado.assets[0];

      if (
        !tamanhoValido(
          asset
        )
      ) {
        Alert.alert(
          "Arquivo muito grande",
          `O arquivo deve ter no máximo ${LIMITE_ARQUIVO_MB} MB.`
        );

        return;
      }

      if (
        destino ===
        "cnh"
      ) {
        setCnh(
          asset
        );

        return;
      }

      if (
        destino ===
        "documentoVeiculo"
      ) {
        setDocumentoVeiculo(
          asset
        );

        return;
      }

      setComprovanteEndereco(
        asset
      );
    } catch (
      error
    ) {
      console.error(
        "Erro ao selecionar documento:",
        error
      );

      Alert.alert(
        "Erro",
        "Não foi possível selecionar o arquivo."
      );
    }
  }

  /* ======================================================= */
  /* VALIDAÇÃO ETAPA 1 */
  /* ======================================================= */

  function validarDadosPessoais() {
    setMensagem(
      ""
    );

    const cpfNumerico =
      form.cpf.replace(
        /\D/g,
        ""
      );

    const celularNumerico =
      form.celular.replace(
        /\D/g,
        ""
      );

    if (
      !normalizarTexto(
        form.nome
      )
    ) {
      setMensagem(
        "Informe seu nome completo."
      );

      return false;
    }

    if (
      cpfNumerico.length !==
      11
    ) {
      setMensagem(
        "Informe um CPF válido com 11 dígitos."
      );

      return false;
    }

    if (
      !emailValido(
        form.email
      )
    ) {
      setMensagem(
        "Informe um e-mail válido."
      );

      return false;
    }

    if (
      celularNumerico.length <
      10
    ) {
      setMensagem(
        "Informe um celular válido."
      );

      return false;
    }

    if (
      !normalizarTexto(
        form.cidade
      )
    ) {
      setMensagem(
        "Informe sua cidade."
      );

      return false;
    }

    if (
      form.estado
        .trim()
        .length !==
      2
    ) {
      setMensagem(
        "Informe a UF do seu estado."
      );

      return false;
    }

    return true;
  }

  /* ======================================================= */
  /* VALIDAÇÃO ETAPA 2 */
  /* ======================================================= */

  function validarVeiculo() {
    setMensagem(
      ""
    );

    if (
      !form.tipoVeiculo
    ) {
      setMensagem(
        "Selecione o tipo do veículo."
      );

      return false;
    }

    if (
      !placaValida(
        form.placaVeiculo
      )
    ) {
      setMensagem(
        "Informe uma placa válida."
      );

      return false;
    }

    return true;
  }

  /* ======================================================= */
  /* VALIDAÇÃO ETAPA 3 */
  /* ======================================================= */

  function validarDocumentos() {
    setMensagem(
      ""
    );

    if (!cnh) {
      setMensagem(
        "Anexe sua CNH."
      );

      return false;
    }

    if (
      !documentoVeiculo
    ) {
      setMensagem(
        "Anexe o documento do veículo."
      );

      return false;
    }

    if (
      !comprovanteEndereco
    ) {
      setMensagem(
        "Anexe o comprovante de endereço."
      );

      return false;
    }

    if (
      !tamanhoValido(
        cnh
      ) ||
      !tamanhoValido(
        documentoVeiculo
      ) ||
      !tamanhoValido(
        comprovanteEndereco
      )
    ) {
      setMensagem(
        `Cada arquivo deve ter no máximo ${LIMITE_ARQUIVO_MB} MB.`
      );

      return false;
    }

    return true;
  }

  /* ======================================================= */
  /* NAVEGAÇÃO ENTRE ETAPAS */
  /* ======================================================= */

  function avancarEtapa1() {
    if (
      !validarDadosPessoais()
    ) {
      return;
    }

    setMensagem(
      ""
    );

    setEtapa(
      2
    );
  }

  function avancarEtapa2() {
    if (
      !validarVeiculo()
    ) {
      return;
    }

    setMensagem(
      ""
    );

    setEtapa(
      3
    );
  }

  function avancarEtapa3() {
    if (
      !validarDocumentos()
    ) {
      return;
    }

    setMensagem(
      ""
    );

    setEtapa(
      4
    );
  }

  /* ======================================================= */
  /* UPLOAD */
  /* ======================================================= */

  async function uploadDocumento(
    asset: DocumentPicker.DocumentPickerAsset,
    tipoDocumento: TipoDocumento
  ) {
    const formData =
      new FormData();

    /*
     * React Native utiliza este formato para
     * anexar arquivos ao FormData.
     */
    formData.append(
      "arquivo",
      {
        uri:
          asset.uri,

        name:
          asset.name ||
          `${tipoDocumento}.jpg`,

        type:
          tipoMimeArquivo(
            asset
          ),
      } as any
    );

    formData.append(
      "tipoDocumento",
      tipoDocumento
    );

    const response =
      await fetch(
        `${API_BASE}/api/uploads/cadastro`,
        {
          method:
            "POST",

          /*
           * NÃO definir Content-Type manualmente.
           *
           * O React Native adicionará automaticamente
           * multipart/form-data com o boundary correto.
           */
          body:
            formData,
        }
      );

    const raw =
      await response
        .text()
        .catch(
          () => ""
        );

    let body:
      | UploadResponse
      | null =
      null;

    try {
      body =
        raw
          ? (JSON.parse(
              raw
            ) as UploadResponse)
          : null;
    } catch {
      body =
        null;
    }

    if (
      !response.ok ||
      !body?.url
    ) {
      throw new Error(
        body?.error ||
          body?.erro ||
          body?.mensagem ||
          `Não foi possível enviar o documento. HTTP ${response.status}.`
      );
    }

    return body.url;
  }

  /* ======================================================= */
  /* CADASTRO */
/* ======================================================= */

  async function enviarCadastro() {
    if (
      enviando
    ) {
      return;
    }

    setMensagem(
      ""
    );

    if (
      !validarDadosPessoais() ||
      !validarVeiculo() ||
      !validarDocumentos()
    ) {
      return;
    }

    if (
      !form.aceitaLgpd
    ) {
      setMensagem(
        "Você precisa aceitar os Termos de Uso e a Política de Privacidade."
      );

      return;
    }

    if (
      !cnh ||
      !documentoVeiculo ||
      !comprovanteEndereco
    ) {
      setMensagem(
        "Selecione todos os documentos obrigatórios."
      );

      return;
    }

    try {
      setEnviando(
        true
      );

      /* =================================================== */
      /* 1. UPLOAD DOS DOCUMENTOS */
      /* =================================================== */

      setMensagem(
        "Enviando CNH..."
      );

      const cnhUrl =
        await uploadDocumento(
          cnh,
          "cnh"
        );

      setMensagem(
        "Enviando documento do veículo..."
      );

      const documentoVeiculoUrl =
        await uploadDocumento(
          documentoVeiculo,
          "documento-veiculo"
        );

      setMensagem(
        "Enviando comprovante de endereço..."
      );

      const comprovanteEnderecoUrl =
        await uploadDocumento(
          comprovanteEndereco,
          "comprovante-endereco"
        );

      /* =================================================== */
      /* 2. CRIAÇÃO DA CONTA */
      /* =================================================== */

      setMensagem(
        "Criando seu cadastro..."
      );

      const payload = {
        /*
         * A API normaliza "prestador"
         * para o cadastro do freteiro.
         */
        tipo:
          "prestador",

        tipoPessoa:
          "PF",

        nome:
          normalizarTexto(
            form.nome
          ),

        nomeFantasia:
          "",

        cpf:
          form.cpf.replace(
            /\D/g,
            ""
          ),

        email:
          form.email
            .trim()
            .toLowerCase(),

        celular:
          form.celular.replace(
            /\D/g,
            ""
          ),

        cidade:
          normalizarTexto(
            form.cidade
          ),

        estado:
          form.estado
            .trim()
            .toUpperCase(),

        aceitaWhatsapp:
          form.aceitaWhatsapp,

        aceitaLgpd:
          form.aceitaLgpd,

        tipoVeiculo:
          form.tipoVeiculo,

        placaVeiculo:
          form.placaVeiculo
            .replace(
              /[^A-Z0-9]/gi,
              ""
            )
            .toUpperCase(),

        documentos: {
          cnh:
            cnhUrl,

          documentoVeiculo:
            documentoVeiculoUrl,

          comprovanteEndereco:
            comprovanteEnderecoUrl,
        },
      };

      const response =
        await fetch(
          `${API_BASE}/api/cadastro`,
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
              JSON.stringify(
                payload
              ),
          }
        );

      const raw =
        await response
          .text()
          .catch(
            () => ""
          );

      let body:
        | CadastroResponse
        | null =
        null;

      try {
        body =
          raw
            ? (JSON.parse(
                raw
              ) as CadastroResponse)
            : null;
      } catch {
        body =
          null;
      }

      if (
        !response.ok
      ) {
        throw new Error(
          body?.mensagem ||
            body?.message ||
            body?.error ||
            body?.erro ||
            `Não foi possível concluir o cadastro. HTTP ${response.status}.`
        );
      }

      setMensagem(
        ""
      );

      /* =================================================== */
      /* 3. SUCESSO */
      /* =================================================== */

      Alert.alert(
        "Cadastro enviado!",
        "Seu cadastro foi recebido com sucesso. Enviamos um e-mail para você definir sua senha de acesso.",
        [
          {
            text:
              "Entendi",

            onPress:
              () =>
                router.replace(
                  "/"
                ),
          },
        ]
      );
    } catch (
      error
    ) {
      console.error(
        "Erro no cadastro:",
        error
      );

      setMensagem(
        ""
      );

      Alert.alert(
        "Não foi possível concluir",
        error instanceof
          Error
          ? error.message
          : "Ocorreu um erro ao enviar seu cadastro."
      );
    } finally {
      setEnviando(
        false
      );
    }
  }

  /* ======================================================= */
  /* LABEL VEÍCULO */
  /* ======================================================= */

  const labelVeiculo =
    TIPOS_VEICULO.find(
      (
        item
      ) =>
        item.value ===
        form.tipoVeiculo
    )?.label ||
    "Selecione o tipo do veículo";

  /* ======================================================= */
  /* RENDER */
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
      <ScrollView
        style={
          styles.scroll
        }
        contentContainerStyle={
          styles.scrollContent
        }
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={
          false
        }
      >
        {/* ================================================= */}
        {/* HEADER */}
        {/* ================================================= */}

        <View
          style={[
            styles.header,
            {
              paddingTop:
                (insets.top ??
                  0) +
                4,
            },
          ]}
        >
          <TouchableOpacity
            onPress={
              () => {
                if (
                  etapa ===
                  1
                ) {
                  router.back();

                  return;
                }

                setMensagem(
                  ""
                );

                setEtapa(
                  (
                    etapa -
                    1
                  ) as Etapa
                );
              }
            }
            style={
              styles.headerButton
            }
            disabled={
              enviando
            }
            accessibilityRole="button"
            accessibilityLabel="Voltar"
          >
            <Text
              style={
                styles.headerButtonText
              }
            >
              ←
            </Text>
          </TouchableOpacity>

          <View
            style={
              styles.headerCenter
            }
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
                styles.headerSubtitle
              }
            >
              Criar conta
            </Text>
          </View>

          <View
            style={
              styles.headerButton
            }
          />
        </View>

        {/* ================================================= */}
        {/* PROGRESSO */}
        {/* ================================================= */}

        <View
          style={
            styles.steps
          }
        >
          {[
            "Dados",
            "Veículo",
            "Documentos",
            "Finalizar",
          ].map(
            (
              titulo,
              index
            ) => {
              const numero =
                (index +
                  1) as Etapa;

              const ativo =
                etapa ===
                numero;

              const concluido =
                etapa >
                numero;

              return (
                <View
                  key={
                    titulo
                  }
                  style={
                    styles.stepWrapper
                  }
                >
                  <View
                    style={[
                      styles.stepLine,

                      (
                        ativo ||
                        concluido
                      ) &&
                        styles.stepLineActive,
                    ]}
                  />

                  <Text
                    style={[
                      styles.stepText,

                      (
                        ativo ||
                        concluido
                      ) &&
                        styles.stepTextActive,
                    ]}
                    numberOfLines={
                      1
                    }
                  >
                    {titulo}
                  </Text>
                </View>
              );
            }
          )}
        </View>

        {/* ================================================= */}
        {/* ETAPA 1 */}
        {/* ================================================= */}

        {etapa ===
          1 && (
          <View
            style={
              styles.card
            }
          >
            <Text
              style={
                styles.title
              }
            >
              Seus dados
            </Text>

            <Text
              style={
                styles.description
              }
            >
              Informe seus dados para criar sua conta de freteiro.
            </Text>

            <Text
              style={
                styles.label
              }
            >
              Nome completo
            </Text>

            <TextInput
              placeholder="Seu nome completo"
              value={
                form.nome
              }
              onChangeText={
                (
                  valor
                ) =>
                  atualizar(
                    "nome",
                    valor
                  )
              }
              style={
                styles.input
              }
              placeholderTextColor="#9ca3af"
              editable={
                !enviando
              }
              autoCapitalize="words"
            />

            <Text
              style={
                styles.label
              }
            >
              CPF
            </Text>

            <TextInput
              placeholder="000.000.000-00"
              value={
                form.cpf
              }
              onChangeText={
                (
                  valor
                ) =>
                  atualizar(
                    "cpf",
                    formatarCpf(
                      valor
                    )
                  )
              }
              style={
                styles.input
              }
              placeholderTextColor="#9ca3af"
              keyboardType="number-pad"
              maxLength={
                14
              }
              editable={
                !enviando
              }
            />

            <Text
              style={
                styles.label
              }
            >
              E-mail
            </Text>

            <TextInput
              placeholder="seuemail@exemplo.com"
              value={
                form.email
              }
              onChangeText={
                (
                  valor
                ) =>
                  atualizar(
                    "email",
                    valor
                  )
              }
              style={
                styles.input
              }
              placeholderTextColor="#9ca3af"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={
                false
              }
              editable={
                !enviando
              }
            />

            <Text
              style={
                styles.label
              }
            >
              Celular
            </Text>

            <TextInput
              placeholder="(00) 00000-0000"
              value={
                form.celular
              }
              onChangeText={
                (
                  valor
                ) =>
                  atualizar(
                    "celular",
                    formatarCelular(
                      valor
                    )
                  )
              }
              style={
                styles.input
              }
              placeholderTextColor="#9ca3af"
              keyboardType="phone-pad"
              maxLength={
                15
              }
              editable={
                !enviando
              }
            />

            <View
              style={
                styles.cityRow
              }
            >
              <View
                style={
                  styles.cityColumn
                }
              >
                <Text
                  style={
                    styles.label
                  }
                >
                  Cidade
                </Text>

                <TextInput
                  placeholder="Sua cidade"
                  value={
                    form.cidade
                  }
                  onChangeText={
                    (
                      valor
                    ) =>
                      atualizar(
                        "cidade",
                        valor
                      )
                  }
                  style={
                    styles.input
                  }
                  placeholderTextColor="#9ca3af"
                  autoCapitalize="words"
                  editable={
                    !enviando
                  }
                />
              </View>

              <View
                style={
                  styles.stateColumn
                }
              >
                <Text
                  style={
                    styles.label
                  }
                >
                  UF
                </Text>

                <TextInput
                  placeholder="RS"
                  value={
                    form.estado
                  }
                  onChangeText={
                    (
                      valor
                    ) =>
                      atualizar(
                        "estado",
                        valor
                          .replace(
                            /[^a-zA-Z]/g,
                            ""
                          )
                          .toUpperCase()
                          .slice(
                            0,
                            2
                          )
                      )
                  }
                  style={[
                    styles.input,
                    styles.stateInput,
                  ]}
                  placeholderTextColor="#9ca3af"
                  autoCapitalize="characters"
                  maxLength={
                    2
                  }
                  editable={
                    !enviando
                  }
                />
              </View>
            </View>

            <TouchableOpacity
              style={
                styles.checkboxRow
              }
              onPress={
                () =>
                  atualizar(
                    "aceitaWhatsapp",
                    !form.aceitaWhatsapp
                  )
              }
              activeOpacity={
                0.7
              }
              disabled={
                enviando
              }
            >
              <View
                style={[
                  styles.checkbox,

                  form.aceitaWhatsapp &&
                    styles.checkboxChecked,
                ]}
              >
                {form.aceitaWhatsapp && (
                  <Text
                    style={
                      styles.checkmark
                    }
                  >
                    ✓
                  </Text>
                )}
              </View>

              <Text
                style={
                  styles.checkboxText
                }
              >
                Quero receber comunicações pelo WhatsApp.
              </Text>
            </TouchableOpacity>

            {!!mensagem && (
              <Text
                style={
                  styles.errorText
                }
              >
                {mensagem}
              </Text>
            )}

            <TouchableOpacity
              style={
                styles.primaryButton
              }
              onPress={
                avancarEtapa1
              }
              disabled={
                enviando
              }
            >
              <Text
                style={
                  styles.primaryButtonText
                }
              >
                Continuar
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ================================================= */}
        {/* ETAPA 2 */}
        {/* ================================================= */}

        {etapa ===
          2 && (
          <View
            style={
              styles.card
            }
          >
            <Text
              style={
                styles.title
              }
            >
              Seu veículo
            </Text>

            <Text
              style={
                styles.description
              }
            >
              Informe o veículo que você utiliza para realizar seus fretes.
            </Text>

            <Text
              style={
                styles.label
              }
            >
              Tipo de veículo
            </Text>

            <TouchableOpacity
              style={
                styles.select
              }
              onPress={
                () =>
                  setSeletorVeiculoAberto(
                    true
                  )
              }
              activeOpacity={
                0.8
              }
              disabled={
                enviando
              }
            >
              <Text
                style={[
                  styles.selectText,

                  !form.tipoVeiculo &&
                    styles.selectPlaceholder,
                ]}
              >
                {labelVeiculo}
              </Text>

              <Text
                style={
                  styles.selectArrow
                }
              >
                ▾
              </Text>
            </TouchableOpacity>

            <Text
              style={
                styles.label
              }
            >
              Placa do veículo
            </Text>

            <TextInput
              placeholder="ABC1D23"
              value={
                form.placaVeiculo
              }
              onChangeText={
                (
                  valor
                ) =>
                  atualizar(
                    "placaVeiculo",
                    formatarPlaca(
                      valor
                    )
                  )
              }
              style={
                styles.input
              }
              placeholderTextColor="#9ca3af"
              autoCapitalize="characters"
              autoCorrect={
                false
              }
              maxLength={
                7
              }
              editable={
                !enviando
              }
            />

            <Text
              style={
                styles.helperText
              }
            >
              Aceitamos placas no padrão antigo ou Mercosul.
            </Text>

            {!!mensagem && (
              <Text
                style={
                  styles.errorText
                }
              >
                {mensagem}
              </Text>
            )}

            <View
              style={
                styles.navigationRow
              }
            >
              <TouchableOpacity
                style={
                  styles.secondaryButton
                }
                onPress={
                  () => {
                    setMensagem(
                      ""
                    );

                    setEtapa(
                      1
                    );
                  }
                }
                disabled={
                  enviando
                }
              >
                <Text
                  style={
                    styles.secondaryButtonText
                  }
                >
                  Voltar
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.primaryButton,
                  styles.navigationPrimaryButton,
                ]}
                onPress={
                  avancarEtapa2
                }
                disabled={
                  enviando
                }
              >
                <Text
                  style={
                    styles.primaryButtonText
                  }
                >
                  Continuar
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ================================================= */}
        {/* ETAPA 3 */}
        {/* ================================================= */}

        {etapa ===
          3 && (
          <View
            style={
              styles.card
            }
          >
            <Text
              style={
                styles.title
              }
            >
              Seus documentos
            </Text>

            <Text
              style={
                styles.description
              }
            >
              Envie os documentos necessários para análise do seu cadastro.
            </Text>

            {/* CNH */}

            <Text
              style={
                styles.label
              }
            >
              CNH
            </Text>

            <TouchableOpacity
              style={[
                styles.uploadButton,

                cnh &&
                  styles.uploadButtonSelected,
              ]}
              onPress={
                () =>
                  selecionarDocumento(
                    "cnh"
                  )
              }
              disabled={
                enviando
              }
              activeOpacity={
                0.8
              }
            >
              <View
                style={
                  styles.uploadContent
                }
              >
                <Text
                  style={
                    styles.uploadTitle
                  }
                >
                  {cnh
                    ? "CNH selecionada"
                    : "Selecionar CNH"}
                </Text>

                <Text
                  style={
                    styles.uploadFileName
                  }
                  numberOfLines={
                    1
                  }
                >
                  {cnh
                    ? nomeArquivo(
                        cnh
                      )
                    : "PDF, JPG ou PNG"}
                </Text>
              </View>

              <Text
                style={
                  styles.uploadAction
                }
              >
                {cnh
                  ? "Alterar"
                  : "Selecionar"}
              </Text>
            </TouchableOpacity>

            {/* DOCUMENTO VEÍCULO */}

            <Text
              style={
                styles.label
              }
            >
              Documento do veículo
            </Text>

            <TouchableOpacity
              style={[
                styles.uploadButton,

                documentoVeiculo &&
                  styles.uploadButtonSelected,
              ]}
              onPress={
                () =>
                  selecionarDocumento(
                    "documentoVeiculo"
                  )
              }
              disabled={
                enviando
              }
              activeOpacity={
                0.8
              }
            >
              <View
                style={
                  styles.uploadContent
                }
              >
                <Text
                  style={
                    styles.uploadTitle
                  }
                >
                  {documentoVeiculo
                    ? "Documento selecionado"
                    : "Selecionar documento"}
                </Text>

                <Text
                  style={
                    styles.uploadFileName
                  }
                  numberOfLines={
                    1
                  }
                >
                  {documentoVeiculo
                    ? nomeArquivo(
                        documentoVeiculo
                      )
                    : "PDF, JPG ou PNG"}
                </Text>
              </View>

              <Text
                style={
                  styles.uploadAction
                }
              >
                {documentoVeiculo
                  ? "Alterar"
                  : "Selecionar"}
              </Text>
            </TouchableOpacity>

            {/* COMPROVANTE */}

            <Text
              style={
                styles.label
              }
            >
              Comprovante de endereço
            </Text>

            <TouchableOpacity
              style={[
                styles.uploadButton,

                comprovanteEndereco &&
                  styles.uploadButtonSelected,
              ]}
              onPress={
                () =>
                  selecionarDocumento(
                    "comprovanteEndereco"
                  )
              }
              disabled={
                enviando
              }
              activeOpacity={
                0.8
              }
            >
              <View
                style={
                  styles.uploadContent
                }
              >
                <Text
                  style={
                    styles.uploadTitle
                  }
                >
                  {comprovanteEndereco
                    ? "Comprovante selecionado"
                    : "Selecionar comprovante"}
                </Text>

                <Text
                  style={
                    styles.uploadFileName
                  }
                  numberOfLines={
                    1
                  }
                >
                  {comprovanteEndereco
                    ? nomeArquivo(
                        comprovanteEndereco
                      )
                    : "PDF, JPG ou PNG"}
                </Text>
              </View>

              <Text
                style={
                  styles.uploadAction
                }
              >
                {comprovanteEndereco
                  ? "Alterar"
                  : "Selecionar"}
              </Text>
            </TouchableOpacity>

            <View
              style={
                styles.infoBox
              }
            >
              <Text
                style={
                  styles.infoText
                }
              >
                Formatos aceitos: PDF, JPG e PNG. Cada arquivo pode ter até {LIMITE_ARQUIVO_MB} MB.
              </Text>
            </View>

            {!!mensagem && (
              <Text
                style={
                  styles.errorText
                }
              >
                {mensagem}
              </Text>
            )}

            <View
              style={
                styles.navigationRow
              }
            >
              <TouchableOpacity
                style={
                  styles.secondaryButton
                }
                onPress={
                  () => {
                    setMensagem(
                      ""
                    );

                    setEtapa(
                      2
                    );
                  }
                }
                disabled={
                  enviando
                }
              >
                <Text
                  style={
                    styles.secondaryButtonText
                  }
                >
                  Voltar
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.primaryButton,
                  styles.navigationPrimaryButton,
                ]}
                onPress={
                  avancarEtapa3
                }
                disabled={
                  enviando
                }
              >
                <Text
                  style={
                    styles.primaryButtonText
                  }
                >
                  Continuar
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ================================================= */}
        {/* ETAPA 4 */}
        {/* ================================================= */}

        {etapa ===
          4 && (
          <View
            style={
              styles.card
            }
          >
            <Text
              style={
                styles.title
              }
            >
              Finalizar cadastro
            </Text>

            <Text
              style={
                styles.description
              }
            >
              Confira as informações abaixo antes de enviar seu cadastro.
            </Text>

            {/* RESUMO */}

            <View
              style={
                styles.summaryBox
              }
            >
              <ResumoLinha
                titulo="Nome"
                valor={
                  normalizarTexto(
                    form.nome
                  )
                }
              />

              <ResumoLinha
                titulo="CPF"
                valor={
                  form.cpf
                }
              />

              <ResumoLinha
                titulo="E-mail"
                valor={
                  form.email
                }
              />

              <ResumoLinha
                titulo="Celular"
                valor={
                  form.celular
                }
              />

              <ResumoLinha
                titulo="Localização"
                valor={`${normalizarTexto(
                  form.cidade
                )} - ${form.estado.toUpperCase()}`}
              />

              <ResumoLinha
                titulo="Veículo"
                valor={
                  labelVeiculo
                }
              />

              <ResumoLinha
                titulo="Placa"
                valor={
                  form.placaVeiculo
                }
                ultima
              />
            </View>

            {/* EXPLICAÇÃO */}

            <View
              style={
                styles.noticeBox
              }
            >
              <Text
                style={
                  styles.noticeTitle
                }
              >
                Como funciona o acesso?
              </Text>

              <Text
                style={
                  styles.noticeText
                }
              >
                Depois de enviar o cadastro, você receberá um e-mail para definir sua senha de acesso ao Meu Freteiro.
              </Text>
            </View>

            {/* LGPD */}

            <TouchableOpacity
              style={
                styles.checkboxRow
              }
              onPress={
                () =>
                  atualizar(
                    "aceitaLgpd",
                    !form.aceitaLgpd
                  )
              }
              activeOpacity={
                0.7
              }
              disabled={
                enviando
              }
            >
              <View
                style={[
                  styles.checkbox,

                  form.aceitaLgpd &&
                    styles.checkboxChecked,
                ]}
              >
                {form.aceitaLgpd && (
                  <Text
                    style={
                      styles.checkmark
                    }
                  >
                    ✓
                  </Text>
                )}
              </View>

              <Text
                style={
                  styles.checkboxText
                }
              >
                Li e concordo com os Termos de Uso e com a Política de Privacidade.
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={
                styles.policyButton
              }
              onPress={
                () =>
                  router.push(
                    "/politica-privacidade"
                  )
              }
              disabled={
                enviando
              }
            >
              <Text
                style={
                  styles.policyButtonText
                }
              >
                Ler Política de Privacidade
              </Text>
            </TouchableOpacity>

            {!!mensagem && (
              <View
                style={
                  styles.statusBox
                }
              >
                {enviando && (
                  <ActivityIndicator
                    size="small"
                    color="#FACC15"
                  />
                )}

                <Text
                  style={
                    styles.statusText
                  }
                >
                  {mensagem}
                </Text>
              </View>
            )}

            <View
              style={
                styles.navigationRow
              }
            >
              <TouchableOpacity
                style={
                  styles.secondaryButton
                }
                onPress={
                  () => {
                    setMensagem(
                      ""
                    );

                    setEtapa(
                      3
                    );
                  }
                }
                disabled={
                  enviando
                }
              >
                <Text
                  style={
                    styles.secondaryButtonText
                  }
                >
                  Voltar
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.primaryButton,
                  styles.navigationPrimaryButton,

                  (
                    !form.aceitaLgpd ||
                    enviando
                  ) &&
                    styles.disabledButton,
                ]}
                onPress={
                  enviarCadastro
                }
                disabled={
                  !form.aceitaLgpd ||
                  enviando
                }
              >
                {enviando ? (
                  <ActivityIndicator
                    color="#111827"
                  />
                ) : (
                  <Text
                    style={
                      styles.primaryButtonText
                    }
                  >
                    Enviar cadastro
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>

      {/* =================================================== */}
      {/* MODAL TIPO VEÍCULO */}
      {/* =================================================== */}

      <Modal
        visible={
          seletorVeiculoAberto
        }
        transparent
        animationType="fade"
        onRequestClose={
          () =>
            setSeletorVeiculoAberto(
              false
            )
        }
      >
        <View
          style={
            styles.modalOverlay
          }
        >
          <View
            style={
              styles.modalCard
            }
          >
            <Text
              style={
                styles.modalTitle
              }
            >
              Tipo de veículo
            </Text>

            <Text
              style={
                styles.modalDescription
              }
            >
              Selecione o veículo utilizado nos seus fretes.
            </Text>

            {TIPOS_VEICULO.map(
              (
                item
              ) => {
                const selecionado =
                  form.tipoVeiculo ===
                  item.value;

                return (
                  <TouchableOpacity
                    key={
                      item.value
                    }
                    style={[
                      styles.vehicleOption,

                      selecionado &&
                        styles.vehicleOptionSelected,
                    ]}
                    onPress={
                      () => {
                        atualizar(
                          "tipoVeiculo",
                          item.value
                        );

                        setSeletorVeiculoAberto(
                          false
                        );

                        setMensagem(
                          ""
                        );
                      }
                    }
                  >
                    <Text
                      style={[
                        styles.vehicleOptionText,

                        selecionado &&
                          styles.vehicleOptionTextSelected,
                      ]}
                    >
                      {item.label}
                    </Text>

                    {selecionado && (
                      <Text
                        style={
                          styles.vehicleCheck
                        }
                      >
                        ✓
                      </Text>
                    )}
                  </TouchableOpacity>
                );
              }
            )}

            <TouchableOpacity
              style={
                styles.modalCancelButton
              }
              onPress={
                () =>
                  setSeletorVeiculoAberto(
                    false
                  )
              }
            >
              <Text
                style={
                  styles.modalCancelText
                }
              >
                Cancelar
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

/* ========================================================= */
/* RESUMO */
/* ========================================================= */

function ResumoLinha({
  titulo,
  valor,
  ultima = false,
}: {
  titulo: string;
  valor: string;
  ultima?: boolean;
}) {
  return (
    <View
      style={[
        styles.summaryRow,

        ultima &&
          styles.summaryRowLast,
      ]}
    >
      <Text
        style={
          styles.summaryLabel
        }
      >
        {titulo}
      </Text>

      <Text
        style={
          styles.summaryValue
        }
      >
        {valor}
      </Text>
    </View>
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

    scroll: {
      flex:
        1,

      backgroundColor:
        "#ffffff",
    },

    scrollContent: {
      paddingBottom:
        40,
    },

    /* HEADER */

    header: {
      width:
        "100%",

      minHeight:
        72,

      paddingHorizontal:
        16,

      paddingBottom:
        12,

      borderBottomWidth:
        1,

      borderBottomColor:
        "#f1f5f9",

      flexDirection:
        "row",

      alignItems:
        "center",

      justifyContent:
        "space-between",

      backgroundColor:
        "#ffffff",
    },

    headerButton: {
      width:
        44,

      height:
        44,

      alignItems:
        "center",

      justifyContent:
        "center",
    },

    headerButtonText: {
      fontSize:
        26,

      color:
        "#374151",
    },

    headerCenter: {
      alignItems:
        "center",

      justifyContent:
        "center",
    },

    brand: {
      fontSize:
        21,

      fontWeight:
        "900",

      color:
        "#111827",
    },

    headerSubtitle: {
      fontSize:
        11,

      color:
        "#6b7280",

      marginTop:
        1,
    },

    /* PASSOS */

    steps: {
      flexDirection:
        "row",

      paddingHorizontal:
        16,

      paddingTop:
        18,

      paddingBottom:
        10,

      gap:
        7,
    },

    stepWrapper: {
      flex:
        1,
    },

    stepLine: {
      width:
        "100%",

      height:
        4,

      borderRadius:
        999,

      backgroundColor:
        "#e5e7eb",

      marginBottom:
        6,
    },

    stepLineActive: {
      backgroundColor:
        "#FACC15",
    },

    stepText: {
      textAlign:
        "center",

      fontSize:
        10,

      fontWeight:
        "600",

      color:
        "#9ca3af",
    },

    stepTextActive: {
      color:
        "#FACC15",
    },

    /* CARD */

    card: {
      paddingHorizontal:
        20,

      paddingTop:
        18,
    },

    title: {
      fontSize:
        23,

      fontWeight:
        "900",

      color:
        "#111827",
    },

    description: {
      marginTop:
        6,

      marginBottom:
        18,

      color:
        "#6b7280",

      fontSize:
        14,

      lineHeight:
        20,
    },

    /* CAMPOS */

    label: {
      marginTop:
        13,

      marginBottom:
        6,

      color:
        "#374151",

      fontSize:
        13,

      fontWeight:
        "700",
    },

    input: {
      width:
        "100%",

      minHeight:
        50,

      borderWidth:
        1,

      borderColor:
        "#d1d5db",

      borderRadius:
        10,

      paddingHorizontal:
        14,

      paddingVertical:
        Platform.OS ===
        "ios"
          ? 13
          : 10,

      color:
        "#111827",

      backgroundColor:
        "#ffffff",

      fontSize:
        14,
    },

    cityRow: {
      flexDirection:
        "row",

      alignItems:
        "flex-end",

      gap:
        10,
    },

    cityColumn: {
      flex:
        1,
    },

    stateColumn: {
      width:
        76,
    },

    stateInput: {
      textAlign:
        "center",
    },

    helperText: {
      marginTop:
        7,

      color:
        "#6b7280",

      fontSize:
        12,
    },

    /* SELECT */

    select: {
      width:
        "100%",

      minHeight:
        50,

      borderWidth:
        1,

      borderColor:
        "#d1d5db",

      borderRadius:
        10,

      paddingHorizontal:
        14,

      flexDirection:
        "row",

      alignItems:
        "center",

      justifyContent:
        "space-between",

      backgroundColor:
        "#ffffff",
    },

    selectText: {
      flex:
        1,

      color:
        "#111827",

      fontSize:
        14,

      fontWeight:
        "500",
    },

    selectPlaceholder: {
      color:
        "#9ca3af",

      fontWeight:
        "400",
    },

    selectArrow: {
      color:
        "#6b7280",

      fontSize:
        18,

      marginLeft:
        8,
    },

    /* CHECKBOX */

    checkboxRow: {
      flexDirection:
        "row",

      alignItems:
        "flex-start",

      marginTop:
        20,

      gap:
        10,
    },

    checkbox: {
      width:
        21,

      height:
        21,

      borderWidth:
        1,

      borderColor:
        "#9ca3af",

      borderRadius:
        5,

      backgroundColor:
        "#ffffff",

      alignItems:
        "center",

      justifyContent:
        "center",

      marginTop:
        1,
    },

    checkboxChecked: {
      backgroundColor:
        "#FACC15",

      borderColor:
        "#FACC15",
    },

    checkmark: {
      color:
        "#111827",

      fontSize:
        14,

      fontWeight:
        "900",
    },

    checkboxText: {
      flex:
        1,

      color:
        "#374151",

      fontSize:
        13,

      lineHeight:
        19,
    },

    /* UPLOAD */

    uploadButton: {
      width:
        "100%",

      minHeight:
        68,

      paddingHorizontal:
        14,

      paddingVertical:
        12,

      borderWidth:
        1,

      borderColor:
        "#d1d5db",

      borderRadius:
        10,

      flexDirection:
        "row",

      alignItems:
        "center",

      justifyContent:
        "space-between",

      backgroundColor:
        "#ffffff",
    },

    uploadButtonSelected: {
      borderColor:
        "#FACC15",

      backgroundColor:
        "#FFFBEB",
    },

    uploadContent: {
      flex:
        1,

      paddingRight:
        12,
    },

    uploadTitle: {
      color:
        "#111827",

      fontSize:
        13,

      fontWeight:
        "700",
    },

    uploadFileName: {
      color:
        "#6b7280",

      fontSize:
        12,

      marginTop:
        4,
    },

    uploadAction: {
      color:
        "#FACC15",

      fontSize:
        12,

      fontWeight:
        "800",
    },

    infoBox: {
      marginTop:
        18,

      padding:
        13,

      borderRadius:
        10,

      backgroundColor:
        "#f8fafc",
    },

    infoText: {
      color:
        "#64748b",

      fontSize:
        12,

      lineHeight:
        18,
    },

    /* ERROS / STATUS */

    errorText: {
      marginTop:
        14,

      color:
        "#dc2626",

      fontSize:
        13,

      textAlign:
        "center",
    },

    statusBox: {
      marginTop:
        18,

      padding:
        13,

      borderRadius:
        10,

      backgroundColor:
        "#FFFBEB",

      flexDirection:
        "row",

      alignItems:
        "center",

      justifyContent:
        "center",

      gap:
        9,
    },

    statusText: {
      flexShrink:
        1,

      color:
        "#111827",

      fontSize:
        13,

      fontWeight:
        "600",

      textAlign:
        "center",
    },

    /* BOTÕES */

    primaryButton: {
      minHeight:
        50,

      paddingHorizontal:
        20,

      borderRadius:
        10,

      backgroundColor:
        "#FACC15",

      alignItems:
        "center",

      justifyContent:
        "center",

      marginTop:
        22,
    },

    primaryButtonText: {
      color:
        "#111827",

      fontSize:
        14,

      fontWeight:
        "800",
    },

    secondaryButton: {
      minHeight:
        50,

      paddingHorizontal:
        18,

      borderRadius:
        10,

      borderWidth:
        1,

      borderColor:
        "#d1d5db",

      alignItems:
        "center",

      justifyContent:
        "center",

      backgroundColor:
        "#ffffff",
    },

    secondaryButtonText: {
      color:
        "#374151",

      fontSize:
        14,

      fontWeight:
        "700",
    },

    navigationRow: {
      width:
        "100%",

      flexDirection:
        "row",

      alignItems:
        "center",

      gap:
        10,

      marginTop:
        8,
    },

    navigationPrimaryButton: {
      flex:
        1,

      marginTop:
        0,
    },

    disabledButton: {
      opacity:
        0.55,
    },

    /* RESUMO */

    summaryBox: {
      borderWidth:
        1,

      borderColor:
        "#e5e7eb",

      borderRadius:
        12,

      overflow:
        "hidden",

      backgroundColor:
        "#ffffff",
    },

    summaryRow: {
      paddingHorizontal:
        14,

      paddingVertical:
        12,

      borderBottomWidth:
        1,

      borderBottomColor:
        "#f1f5f9",
    },

    summaryRowLast: {
      borderBottomWidth:
        0,
    },

    summaryLabel: {
      color:
        "#6b7280",

      fontSize:
        11,

      fontWeight:
        "600",
    },

    summaryValue: {
      color:
        "#111827",

      fontSize:
        14,

      fontWeight:
        "700",

      marginTop:
        3,
    },

    /* AVISO */

    noticeBox: {
      marginTop:
        18,

      padding:
        15,

      borderRadius:
        12,

      backgroundColor:
        "#FFFBEB",

      borderWidth:
        1,

      borderColor:
        "#FDE68A",
    },

    noticeTitle: {
      color:
        "#111827",

      fontSize:
        14,

      fontWeight:
        "800",
    },

    noticeText: {
      color:
        "#374151",

      fontSize:
        13,

      lineHeight:
        19,

      marginTop:
        5,
    },

    policyButton: {
      alignSelf:
        "flex-start",

      marginTop:
        10,

      paddingVertical:
        5,
    },

    policyButtonText: {
      color:
        "#FACC15",

      fontSize:
        12,

      fontWeight:
        "700",

      textDecorationLine:
        "underline",
    },

    /* MODAL */

    modalOverlay: {
      flex:
        1,

      backgroundColor:
        "rgba(0,0,0,0.35)",

      justifyContent:
        "center",

      padding:
        22,
    },

    modalCard: {
      width:
        "100%",

      maxWidth:
        480,

      alignSelf:
        "center",

      backgroundColor:
        "#ffffff",

      borderRadius:
        16,

      padding:
        18,
    },

    modalTitle: {
      color:
        "#111827",

      fontSize:
        20,

      fontWeight:
        "900",
    },

    modalDescription: {
      color:
        "#6b7280",

      fontSize:
        13,

      marginTop:
        4,

      marginBottom:
        14,
    },

    vehicleOption: {
      minHeight:
        48,

      paddingHorizontal:
        12,

      borderBottomWidth:
        1,

      borderBottomColor:
        "#f1f5f9",

      flexDirection:
        "row",

      alignItems:
        "center",

      justifyContent:
        "space-between",
    },

    vehicleOptionSelected: {
      backgroundColor:
        "#FFFBEB",
    },

    vehicleOptionText: {
      color:
        "#374151",

      fontSize:
        14,

      fontWeight:
        "600",
    },

    vehicleOptionTextSelected: {
      color:
        "#FACC15",

      fontWeight:
        "800",
    },

    vehicleCheck: {
      color:
        "#FACC15",

      fontSize:
        16,

      fontWeight:
        "900",
    },

    modalCancelButton: {
      minHeight:
        46,

      marginTop:
        14,

      alignItems:
        "center",

      justifyContent:
        "center",
    },

    modalCancelText: {
      color:
        "#6b7280",

      fontSize:
        14,

      fontWeight:
        "700",
    },
  });