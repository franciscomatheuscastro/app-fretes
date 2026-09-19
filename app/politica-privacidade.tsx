// app/politica-privacidade.tsx

import { Stack, useRouter } from "expo-router";
import {
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

const COLORS = {
  primary: "#FACC15",
  primarySoft: "#FEF9C3",
  primaryBorder: "#FDE047",

  black: "#111827",
  text: "#111827",
  secondaryText: "#6B7280",

  background: "#FFFFFF",
  surface: "#F9FAFB",
  border: "#E5E7EB",
};

// TODO:
// Trocar quando houver o e-mail oficial
// @meufreteiro.com.
const EMAIL =
  "contato@meufreteiro.com";

export default function PoliticaDePrivacidade() {
  const router = useRouter();

  const insets =
    useSafeAreaInsets();

  function abrirEmail() {
    Linking.openURL(
      `mailto:${EMAIL}`
    );
  }

  return (
    <SafeAreaView
      style={styles.safeArea}
      edges={[
        "top",
        "left",
        "right",
      ]}
    >
      <Stack.Screen
        options={{
          title:
            "Política de Privacidade",
        }}
      />

      <ScrollView
        showsVerticalScrollIndicator
        contentContainerStyle={[
          styles.content,
          {
            paddingTop:
              (insets.top || 0) +
              20,
          },
        ]}
      >
        {/* CABEÇALHO */}

        <View
          style={
            styles.brandBadge
          }
        >
          <Text
            style={
              styles.brandBadgeText
            }
          >
            Meu Freteiro
          </Text>
        </View>

        <Text style={styles.h1}>
          Política de Privacidade
        </Text>

        <Text style={styles.muted}>
          Última atualização:
          18/09/2026
        </Text>

        <Text style={styles.p}>
          Bem-vindo(a) ao Meu
          Freteiro. Esta Política de
          Privacidade descreve como
          coletamos, utilizamos,
          compartilhamos e protegemos
          seus dados ao utilizar nosso
          aplicativo, nosso site e as
          APIs relacionadas.
        </Text>

        <Text style={styles.p}>
          Em caso de dúvidas sobre
          privacidade ou tratamento de
          dados pessoais, entre em
          contato conosco pelo e-mail{" "}
          <Text
            style={styles.link}
            onPress={abrirEmail}
          >
            {EMAIL}
          </Text>
          .
        </Text>

        {/* 1 */}

        <Text style={styles.h2}>
          1. Quem somos
        </Text>

        <Text style={styles.p}>
          O Meu Freteiro é uma
          plataforma destinada a
          aproximar empresas ou
          anunciantes que possuem
          oportunidades de frete de
          freteiros e prestadores
          interessados em realizá-las.
        </Text>

        <Text style={styles.p}>
          Somos responsáveis pelo
          tratamento dos dados pessoais
          realizado por meio da
          plataforma, salvo quando
          indicado de forma diferente
          nesta Política.
        </Text>

        {/* 2 */}

        <Text style={styles.h2}>
          2. Abrangência
        </Text>

        <Text style={styles.p}>
          Esta Política aplica-se ao
          aplicativo Meu Freteiro para
          iOS e Android, ao site e aos
          serviços relacionados à
          plataforma.
        </Text>

        {/* 3 */}

        <Text style={styles.h2}>
          3. Quais dados coletamos
        </Text>

        <Text style={styles.h3}>
          3.1 Dados informados por você
        </Text>

        <Text style={styles.li}>
          • Dados cadastrais: nome,
          CPF, e-mail, telefone ou
          WhatsApp, cidade e estado.
        </Text>

        <Text style={styles.li}>
          • Dados do veículo: tipo de
          veículo e placa.
        </Text>

        <Text style={styles.li}>
          • Documentos necessários à
          análise do cadastro, como
          CNH, documento do veículo e
          comprovante de endereço.
        </Text>

        <Text style={styles.li}>
          • Informações relacionadas às
          propostas enviadas para
          oportunidades de frete,
          incluindo valor e mensagem
          informados pelo usuário.
        </Text>

        <Text style={styles.li}>
          • Comunicações e solicitações
          realizadas por meio dos
          canais de atendimento.
        </Text>

        <Text style={styles.h3}>
          3.2 Dados coletados
          automaticamente
        </Text>

        <Text style={styles.li}>
          • Dados técnicos necessários
          ao funcionamento e à
          segurança da plataforma,
          como informações do
          dispositivo, sistema
          operacional, endereço IP e
          registros técnicos.
        </Text>

        <Text style={styles.li}>
          • Informações de utilização
          do aplicativo, como telas
          acessadas, pesquisas e
          eventos técnicos.
        </Text>

        <Text style={styles.li}>
          • Token técnico utilizado
          para o envio de notificações
          push, quando autorizado pelo
          usuário.
        </Text>

        <View style={styles.note}>
          <Text
            style={styles.noteText}
          >
            <Text
              style={
                styles.noteStrong
              }
            >
              Localização:{" "}
            </Text>

            a versão atual do aplicativo
            não depende da localização
            precisa do dispositivo para
            pesquisar fretes. As cidades
            de origem e destino são
            informadas na própria
            pesquisa.
          </Text>
        </View>

        <Text style={styles.h3}>
          3.3 Cookies no site
        </Text>

        <Text style={styles.p}>
          O site pode utilizar cookies
          e tecnologias semelhantes
          necessários para sessões,
          preferências, segurança,
          funcionamento e análise de
          utilização.
        </Text>

        {/* 4 */}

        <Text style={styles.h2}>
          4. Permissões do dispositivo
        </Text>

        <Text style={styles.li}>
          • Notificações: utilizadas
          para o envio de avisos e
          informações relacionadas à
          plataforma, mediante
          autorização do usuário.
        </Text>

        <Text style={styles.li}>
          • Biometria ou Face ID:
          utilizada exclusivamente para
          auxiliar a autenticação local
          no dispositivo. O Meu
          Freteiro não recebe nem
          armazena os dados biométricos
          do usuário.
        </Text>

        <Text style={styles.li}>
          • Arquivos/documentos: durante
          o cadastro, o usuário pode
          selecionar documentos
          necessários à análise da
          conta.
        </Text>

        {/* 5 */}

        <Text style={styles.h2}>
          5. Bases legais
        </Text>

        <Text style={styles.p}>
          O tratamento de dados pessoais
          poderá ocorrer com fundamento
          nas bases legais previstas na
          Lei Geral de Proteção de Dados
          Pessoais (LGPD), conforme a
          finalidade e o contexto de
          cada tratamento.
        </Text>

        <Text style={styles.li}>
          • Execução de contrato ou de
          procedimentos relacionados ao
          serviço solicitado pelo
          usuário.
        </Text>

        <Text style={styles.li}>
          • Cumprimento de obrigação
          legal ou regulatória, quando
          aplicável.
        </Text>

        <Text style={styles.li}>
          • Legítimo interesse, quando
          aplicável e respeitados os
          direitos e liberdades
          fundamentais do titular.
        </Text>

        <Text style={styles.li}>
          • Consentimento, nas situações
          em que essa for a base legal
          adequada.
        </Text>

        {/* 6 */}

        <Text style={styles.h2}>
          6. Finalidades de uso
        </Text>

        <Text style={styles.li}>
          • Criar, analisar e gerenciar
          sua conta no Meu Freteiro.
        </Text>

        <Text style={styles.li}>
          • Permitir a busca e
          visualização de oportunidades
          de frete.
        </Text>

        <Text style={styles.li}>
          • Permitir o envio e
          gerenciamento de propostas.
        </Text>

        <Text style={styles.li}>
          • Viabilizar o contato entre
          as partes quando uma proposta
          for aceita.
        </Text>

        <Text style={styles.li}>
          • Enviar notificações e
          comunicações relacionadas à
          utilização do serviço.
        </Text>

        <Text style={styles.li}>
          • Prestar suporte aos
          usuários.
        </Text>

        <Text style={styles.li}>
          • Prevenir fraudes, abusos e
          acessos indevidos.
        </Text>

        <Text style={styles.li}>
          • Melhorar a segurança e o
          funcionamento da plataforma.
        </Text>

        <Text style={styles.li}>
          • Cumprir obrigações legais
          aplicáveis.
        </Text>

        {/* 7 */}

        <Text style={styles.h2}>
          7. Compartilhamento de dados
        </Text>

        <Text style={styles.p}>
          Os dados pessoais podem ser
          compartilhados quando isso for
          necessário para o
          funcionamento do Meu
          Freteiro.
        </Text>

        <Text style={styles.li}>
          • Empresas ou anunciantes:
          quando uma proposta do
          freteiro for aceita, os dados
          necessários poderão ser
          disponibilizados para
          viabilizar o contato e a
          continuidade da negociação
          entre as partes.
        </Text>

        <Text style={styles.li}>
          • Prestadores e fornecedores
          de tecnologia: serviços de
          infraestrutura, armazenamento,
          e-mail, notificações,
          segurança e outros necessários
          à operação da plataforma.
        </Text>

        <Text style={styles.li}>
          • Autoridades públicas:
          quando houver obrigação legal,
          regulatória ou determinação
          válida de autoridade
          competente.
        </Text>

        <Text style={styles.p}>
          O Meu Freteiro não vende dados
          pessoais.
        </Text>

        {/* 8 */}

        <Text style={styles.h2}>
          8. Documentos enviados
        </Text>

        <Text style={styles.p}>
          Os documentos enviados no
          processo de cadastro são
          utilizados para análise,
          validação e segurança da conta.
          O acesso a esses documentos
          deve ser restrito aos usuários
          e processos autorizados.
        </Text>

        {/* 9 */}

        <Text style={styles.h2}>
          9. Armazenamento e segurança
        </Text>

        <Text style={styles.p}>
          Adotamos medidas técnicas e
          administrativas destinadas a
          proteger os dados pessoais
          contra acessos não autorizados
          e situações acidentais ou
          ilícitas de destruição, perda,
          alteração, comunicação ou
          divulgação.
        </Text>

        <Text style={styles.p}>
          Apesar das medidas adotadas,
          nenhum sistema de informação
          pode oferecer garantia
          absoluta contra todos os
          riscos de segurança.
        </Text>

        {/* 10 */}

        <Text style={styles.h2}>
          10. Retenção
        </Text>

        <Text style={styles.p}>
          Os dados serão mantidos pelo
          período necessário para
          cumprir as finalidades
          descritas nesta Política,
          atender obrigações legais,
          exercer direitos e preservar a
          segurança da plataforma.
        </Text>

        {/* 11 */}

        <Text style={styles.h2}>
          11. Seus direitos
        </Text>

        <Text style={styles.p}>
          Nos termos da LGPD, o titular
          poderá solicitar, quando
          aplicável, confirmação da
          existência de tratamento,
          acesso, correção,
          anonimização, bloqueio,
          eliminação, portabilidade,
          informações sobre
          compartilhamento e revogação
          de consentimento.
        </Text>

        <Text style={styles.p}>
          Solicitações relacionadas a
          dados pessoais podem ser
          encaminhadas para{" "}
          <Text
            style={styles.link}
            onPress={abrirEmail}
          >
            {EMAIL}
          </Text>
          .
        </Text>

        {/* 12 */}

        <Text style={styles.h2}>
          12. Crianças e adolescentes
        </Text>

        <Text style={styles.p}>
          O Meu Freteiro não é destinado
          a menores de 18 anos.
        </Text>

        {/* 13 */}

        <Text style={styles.h2}>
          13. Transferências
          internacionais
        </Text>

        <Text style={styles.p}>
          Alguns fornecedores de
          tecnologia utilizados pela
          plataforma podem realizar
          armazenamento ou tratamento de
          dados fora do Brasil. Quando
          aplicável, serão observadas as
          exigências previstas na
          legislação brasileira.
        </Text>

        {/* 14 */}

        <Text style={styles.h2}>
          14. Links externos
        </Text>

        <Text style={styles.p}>
          A plataforma poderá apresentar
          links ou direcionamentos para
          serviços de terceiros. As
          práticas desses terceiros são
          regidas por seus próprios
          termos e políticas.
        </Text>

        {/* 15 */}

        <Text style={styles.h2}>
          15. Atualizações desta
          Política
        </Text>

        <Text style={styles.p}>
          Esta Política poderá ser
          atualizada para refletir
          alterações no serviço, na
          legislação ou nas práticas de
          tratamento de dados.
        </Text>

        <Text style={styles.p}>
          A versão vigente poderá ser
          disponibilizada por meio do
          aplicativo ou do site.
        </Text>

        {/* 16 */}

        <Text style={styles.h2}>
          16. Contato sobre privacidade
        </Text>

        <Text style={styles.p}>
          Para solicitações ou dúvidas
          relacionadas à privacidade e
          proteção de dados:
        </Text>

        <TouchableOpacity
          style={styles.emailCard}
          onPress={abrirEmail}
          activeOpacity={0.8}
        >
          <Text
            style={
              styles.emailCardLabel
            }
          >
            E-mail
          </Text>

          <Text
            style={
              styles.emailCardValue
            }
          >
            {EMAIL}
          </Text>
        </TouchableOpacity>

        {/* RESUMO */}

        <View style={styles.card}>
          <Text
            style={
              styles.cardTitle
            }
          >
            Resumo do aplicativo
          </Text>

          <Text style={styles.li}>
            • Notificações push:
            utilizadas mediante
            autorização.
          </Text>

          <Text style={styles.li}>
            • Biometria/Face ID:
            autenticação local no
            dispositivo.
          </Text>

          <Text style={styles.li}>
            • Documentos: selecionados
            pelo usuário durante o
            cadastro.
          </Text>

          <Text style={styles.li}>
            • Pesquisa de fretes:
            realizada pelas cidades
            informadas pelo usuário.
          </Text>
        </View>

        {/* VOLTAR */}

        <TouchableOpacity
          onPress={() =>
            router.back()
          }
          style={styles.backButton}
          activeOpacity={0.8}
        >
          <Text
            style={
              styles.backButtonText
            }
          >
            Voltar
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles =
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor:
        COLORS.background,
    },

    content: {
      paddingHorizontal: 24,
      paddingBottom: 40,
    },

    brandBadge: {
      alignSelf: "flex-start",

      backgroundColor:
        COLORS.primary,

      borderRadius: 8,

      paddingHorizontal: 10,
      paddingVertical: 5,

      marginBottom: 12,
    },

    brandBadgeText: {
      color: COLORS.black,
      fontSize: 12,
      fontWeight: "900",
    },

    h1: {
      fontSize: 22,
      fontWeight: "900",
      color: COLORS.text,
      marginBottom: 2,
    },

    muted: {
      fontSize: 12,
      color:
        COLORS.secondaryText,
      marginBottom: 10,
    },

    h2: {
      fontSize: 16,
      fontWeight: "900",
      color: COLORS.text,
      marginTop: 22,
    },

    h3: {
      fontSize: 14,
      fontWeight: "800",
      color: COLORS.text,
      marginTop: 14,
    },

    p: {
      fontSize: 14,
      color: "#374151",
      marginTop: 8,
      lineHeight: 21,
    },

    li: {
      fontSize: 14,
      color: "#374151",
      marginTop: 7,
      lineHeight: 21,
    },

    note: {
      backgroundColor:
        COLORS.primarySoft,

      borderWidth: 1,
      borderColor:
        COLORS.primaryBorder,

      padding: 12,
      borderRadius: 10,

      marginTop: 12,
    },

    noteText: {
      fontSize: 13,
      color: "#374151",
      lineHeight: 19,
    },

    noteStrong: {
      fontWeight: "800",
      color: COLORS.black,
    },

    link: {
      color: COLORS.black,
      fontWeight: "700",
      textDecorationLine:
        "underline",
    },

    card: {
      backgroundColor:
        COLORS.surface,

      borderWidth: 1,
      borderColor: COLORS.border,

      padding: 14,
      borderRadius: 12,

      marginTop: 22,
    },

    cardTitle: {
      fontSize: 14,
      fontWeight: "900",
      color: COLORS.text,
      marginBottom: 3,
    },

    emailCard: {
      marginTop: 10,

      backgroundColor:
        COLORS.primarySoft,

      borderWidth: 1,
      borderColor:
        COLORS.primaryBorder,

      borderRadius: 10,

      padding: 12,
    },

    emailCardLabel: {
      color:
        COLORS.secondaryText,

      fontSize: 11,
      fontWeight: "700",
    },

    emailCardValue: {
      color: COLORS.black,

      fontSize: 14,
      fontWeight: "800",

      marginTop: 3,
    },

    backButton: {
      alignSelf: "center",

      paddingVertical: 20,
      paddingHorizontal: 20,

      marginTop: 6,
    },

    backButtonText: {
      color: COLORS.black,
      fontSize: 14,
      fontWeight: "700",
    },
  });