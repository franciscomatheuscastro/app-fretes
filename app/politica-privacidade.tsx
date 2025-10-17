// app/politica-privacidade.tsx
import { Stack, useRouter } from "expo-router";
import { Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";

const EMAIL = "contato@voucarregar.com.br";

export default function PoliticaDePrivacidade() {
  const router = useRouter();

  return (
    <View style={{ flex: 1, backgroundColor: "#fff" }}>
      <Stack.Screen options={{ title: "Política de Privacidade" }} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator>
        <Text style={styles.h1}>Política de Privacidade – Vou Carregar</Text>
        <Text style={styles.muted}>Última atualização: 12/10/2025</Text>
        <Text style={styles.p}>
          Bem-vindo(a) ao Vou Carregar. Esta Política de Privacidade descreve como coletamos,
          utilizamos, compartilhamos e protegemos seus dados ao usar nosso aplicativo para
          motoristas (“App”), nosso site e APIs relacionados. Se tiver dúvidas, fale conosco
          em{" "}
          <Text style={styles.link} onPress={() => Linking.openURL(`mailto:${EMAIL}`)}>
            {EMAIL}
          </Text>
          .
        </Text>

        <Text style={styles.h2}>1. Quem somos</Text>
        <Text style={styles.p}>
          O Vou Carregar conecta motoristas e transportadoras para publicação e busca de fretes.
          Somos a controladora dos dados pessoais tratados por meio do App e do site, salvo quando
          indicado de forma diferente nesta política.
        </Text>

        <Text style={styles.h2}>2. Abrangência</Text>
        <Text style={styles.p}>
          Aplica-se ao App (iOS/Android) e ao site do Vou Carregar. Ao utilizar nossos serviços,
          você declara que leu e concorda com os termos abaixo.
        </Text>

        <Text style={styles.h2}>3. Quais dados coletamos</Text>
        <Text style={styles.h3}>3.1 Dados informados por você</Text>
        <Text style={styles.li}>
          • Conta e perfil: nome, e-mail, telefone/WhatsApp, CPF e, quando aplicável, dados de
          empresa.
        </Text>
        <Text style={styles.li}>
          • Documentos para habilitação de conta (quando exigidos): CNH, documento do veículo,
          comprovantes e fotos.
        </Text>
        <Text style={styles.li}>
          • Conteúdo e interações: mensagens, manifestações de interesse em fretes,
          avaliações/comentários (quando houver).
        </Text>

        <Text style={styles.h3}>3.2 Dados coletados automaticamente</Text>
        <Text style={styles.li}>
          • Dados técnicos do dispositivo: modelo, SO, idioma, fuso horário, IP e identificadores
          de dispositivo.
        </Text>
        <Text style={styles.li}>• Uso do App: telas acessadas, cliques, pesquisas e eventos técnicos.</Text>
        <Text style={styles.li}>• Notificações push: token técnico (Expo/FCM) para envio de notificações.</Text>
        <Text style={styles.note}>
          Importante: a versão atual do App <Text style={{ fontWeight: "700" }}>não solicita nem coleta sua localização</Text>. A
          busca por fretes é feita por cidades informadas manualmente. Caso, no futuro, a
          localização seja utilizada, pediremos permissão explícita e atualizaremos esta política.
        </Text>

        <Text style={styles.h3}>3.3 Cookies (site)</Text>
        <Text style={styles.p}>
          Utilizamos cookies essenciais e de medição no site para sessões, preferências e
          entendimento do uso.
        </Text>

        <Text style={styles.h2}>4. Permissões do dispositivo</Text>
        <Text style={styles.li}>• Notificações: para avisos sobre fretes e mensagens (opt-in do usuário).</Text>
        <Text style={styles.li}>
          • Biometria/Face ID: apenas para autenticação local. Não acessamos nem armazenamos sua
          biometria.
        </Text>
        <Text style={styles.p}>Não solicitamos acesso a contatos, câmera, microfone ou fotos na versão atual.</Text>

        <Text style={styles.h2}>5. Base legal (LGPD)</Text>
        <Text style={styles.li}>• Execução de contrato (fornecer o serviço do App).</Text>
        <Text style={styles.li}>• Legítimo interesse (segurança, prevenção a fraudes e melhoria contínua).</Text>
        <Text style={styles.li}>• Consentimento (notificações push, envio de documentos quando exigido).</Text>
        <Text style={styles.li}>• Obrigações legais/regulatórias (guarda de registros e ordens de autoridades).</Text>

        <Text style={styles.h2}>6. Finalidades de uso</Text>
        <Text style={styles.li}>• Criar e gerenciar sua conta.</Text>
        <Text style={styles.li}>• Permitir busca/visualização e interesse em fretes.</Text>
        <Text style={styles.li}>• Enviar notificações e comunicações sobre fretes e atualizações.</Text>
        <Text style={styles.li}>• Suporte, segurança, prevenção a fraudes e melhoria do serviço.</Text>
        <Text style={styles.li}>• Cumprir exigências legais aplicáveis.</Text>

        <Text style={styles.h2}>7. Compartilhamento</Text>
        <Text style={styles.li}>
          • Transportadoras/anunciantes: quando você interage com um frete, podemos compartilhar
          seus dados de contato do perfil para viabilizar o contato.
        </Text>
        <Text style={styles.li}>
          • Operadores/provedores: nuvem, notificações push, monitoramento/analytics e atendimento —
          sempre sob nossas instruções.
        </Text>
        <Text style={styles.li}>• Autoridades públicas: quando exigido por lei.</Text>
        <Text style={styles.p}>Não vendemos dados pessoais.</Text>

        <Text style={styles.h2}>8. Armazenamento e segurança</Text>
        <Text style={styles.p}>
          Adotamos medidas técnicas e organizacionais (TLS, controle de acesso, auditoria). Nenhum
          método é 100% infalível.
        </Text>

        <Text style={styles.h2}>9. Retenção</Text>
        <Text style={styles.li}>
          • Conta/Perfil: enquanto ativa e por prazo adicional para obrigações legais/defesa de
          direitos.
        </Text>
        <Text style={styles.li}>• Logs técnicos: por prazos compatíveis com segurança e auditoria.</Text>

        <Text style={styles.h2}>10. Seus direitos (LGPD)</Text>
        <Text style={styles.p}>
          Você pode solicitar acesso, correção, anonimização/bloqueio/eliminação, portabilidade
          (quando aplicável), informações sobre compartilhamentos e revogação de consentimento.
          Contato:
          <Text style={styles.link} onPress={() => Linking.openURL(`mailto:${EMAIL}`)}>
            {" "}
            {EMAIL}
          </Text>
          .
        </Text>

        <Text style={styles.h2}>11. Crianças e adolescentes</Text>
        <Text style={styles.p}>O App não é destinado a menores de 18 anos.</Text>

        <Text style={styles.h2}>12. Transferências internacionais</Text>
        <Text style={styles.p}>
          Podem ocorrer quando usamos provedores no exterior, com garantias compatíveis à LGPD.
        </Text>

        <Text style={styles.h2}>13. Links externos</Text>
        <Text style={styles.p}>Não somos responsáveis pelas práticas de privacidade de terceiros.</Text>

        <Text style={styles.h2}>14. Atualizações desta política</Text>
        <Text style={styles.p}>
          Podemos atualizar esta Política. A versão vigente estará no site e, quando relevante,
          avisaremos pelo App ou e-mail.
        </Text>

        <Text style={styles.h2}>15. Encarregado (DPO)</Text>
        <Text style={styles.p}>
          E-mail:{" "}
          <Text style={styles.link} onPress={() => Linking.openURL(`mailto:${EMAIL}`)}>
            {EMAIL}
          </Text>{" "}
          — Assunto “Privacidade – Vou Carregar”.
        </Text>

        <View style={styles.card}>
          <Text style={[styles.h3, { marginBottom: 6 }]}>Resumo das permissões do App</Text>
          <Text style={styles.li}>• POST_NOTIFICATIONS: envio de notificações (opt-in).</Text>
          <Text style={styles.li}>• Biometria/Face ID: autenticação local; sem coleta de biometria.</Text>
          <Text style={styles.li}>• Sem coleta de localização na versão atual.</Text>
        </View>

        <TouchableOpacity onPress={() => router.back()} style={{ alignSelf: "center", paddingVertical: 16 }}>
          <Text style={{ color: "#6b7280" }}>Voltar</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  // aumentei o espaçamento lateral (24) e mantive bom padding inferior
  content: { paddingHorizontal: 24, paddingTop: 20, paddingBottom: 40 },
  h1: { fontSize: 20, fontWeight: "800", color: "#111827" },
  h2: { fontSize: 16, fontWeight: "800", color: "#111827", marginTop: 18 },
  h3: { fontSize: 14, fontWeight: "800", color: "#111827", marginTop: 12 },
  p: { fontSize: 14, color: "#111827", marginTop: 8, lineHeight: 20 },
  li: { fontSize: 14, color: "#111827", marginTop: 6, lineHeight: 20 },
  note: {
    fontSize: 13,
    color: "#374151",
    backgroundColor: "#F3F4F6",
    padding: 10,
    borderRadius: 8,
    marginTop: 8,
  },
  muted: { fontSize: 12, color: "#6b7280", marginTop: 4 },
  link: { color: "#2563eb", textDecorationLine: "underline" },
  card: {
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 12,
    borderRadius: 10,
    marginTop: 14,
  },
});
