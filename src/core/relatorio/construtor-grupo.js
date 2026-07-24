import clienteClaude from "../ia/cliente-claude.js";
import config from "../../config/index.js";

function formatarMensagens(mensagens) {
  return mensagens.map((m) => {
    const papel = m.isAgencia ? "Agência" : "Cliente";
    const prefixoAudio = m.tipoMensagem === "audio" && m.conteudo ? "[áudio] " : "";
    const texto = (m.conteudo ?? "(mídia sem texto)").slice(0, 200);
    const hora = new Date(m.recebidaEm).toLocaleString("pt-BR", {
      timeZone: "America/Sao_Paulo",
      weekday: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    });
    return `[${hora}] ${papel}: ${prefixoAudio}${texto}`;
  }).join("\n");
}

export async function gerarResumoGrupo(grupo, { mensagens, alertas, alertasAbertos }) {
  const mensagensCliente = mensagens.filter((m) => !m.isAgencia);

  if (!mensagensCliente.length) {
    return { resumo: "Sem atividade registrada nesta semana.", categoria: "sem_atividade" };
  }

  let categoria;
  if (alertasAbertos > 0) {
    categoria = "alerta_aberto";
  } else if (alertas.length > 0) {
    categoria = "com_pendencia";
  } else {
    categoria = "sem_pendencia";
  }

  const linhasMensagens = formatarMensagens(mensagens);
  const linhasAlertas = alertas.length
    ? alertas.map((a) => `- [${a.status}] ${a.gatilho ?? "inatividade"}`).join("\n")
    : "Nenhum alerta gerado.";

  const prompt = `Você analisa conversas de WhatsApp entre clientes e uma agência de marketing digital.

Grupo: ${grupo.nomeGrupo}
Tipo: ${grupo.tipo}

Mensagens da semana (ordem cronológica):
${linhasMensagens}

Alertas do sistema gerados nesta semana:
${linhasAlertas}
Alertas ainda em aberto (não reconhecidos): ${alertasAbertos}

Escreva 3 a 5 frases resumindo como foi a semana neste grupo. Inclua:
- O que aconteceu de relevante (campanhas, aprovações, solicitações, feedbacks do cliente)
- O que ficou pendente ou sem resposta da agência (se houver)
- Tom geral do cliente (satisfeito, ansioso, reclamando, silencioso)

Texto corrido, sem listas ou marcadores. Escreva como se estivesse informando o CEO da agência.`;

  const resposta = await clienteClaude.messages.create({
    model: config.anthropic.modeloTriagem,
    max_tokens: 300,
    messages: [{ role: "user", content: prompt }]
  });

  const resumo = resposta.content[0]?.text?.trim() ?? "Resumo indisponível.";
  return { resumo, categoria };
}
