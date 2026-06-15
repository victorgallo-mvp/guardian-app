/**
 * Construtor de mensagens de notificação: transforma o resultado de uma
 * análise profunda em uma mensagem de WhatsApp pronta pra ser enviada ao
 * responsável.
 */
import { CATALOGO_GATILHOS } from "../gatilhos/catalogo.gatilhos.js";
import { formatarHora } from "../../shared/utils.js";

const EMOJI_SEVERIDADE = {
  info: "ℹ️",
  atencao: "⚠️",
  urgente: "🔶",
  critico: "🚨"
};

/**
 * Monta o texto da notificação de WhatsApp a partir de uma análise validada.
 *
 * @param {object} analise - documento Analise (com `detectado.*`, `contextoDoCliente`, `recomendacaoAcao`)
 * @param {object} grupo - documento Grupo
 * @param {object} mensagem - documento Mensagem que originou a análise
 * @returns {string}
 */
export function construirMensagemNotificacao({ analise, grupo, mensagem }) {
  const { detectado } = analise;
  const emoji = EMOJI_SEVERIDADE[detectado.severidade] ?? "ℹ️";
  const nomeGatilho = CATALOGO_GATILHOS[detectado.gatilho]?.nome ?? detectado.gatilho;

  const linhas = [
    `${emoji} *${nomeGatilho}*`,
    `Grupo: *${grupo.nomeGrupo}*`,
    `Horário: ${formatarHora(mensagem.recebidaEm)}`,
    "",
    detectado.explicacao
  ];

  if (detectado.citacoes?.length) {
    linhas.push("", "Trechos:");
    for (const citacao of detectado.citacoes) {
      linhas.push(`> ${citacao}`);
    }
  }

  if (analise.contextoDoCliente) {
    linhas.push("", `Contexto: ${analise.contextoDoCliente}`);
  }

  if (analise.recomendacaoAcao) {
    linhas.push("", `💡 ${analise.recomendacaoAcao}`);
  }

  linhas.push(
    "",
    '_Responda com 👍 (relevante), 👎 (falso alarme) ou "pausar" pra silenciar este grupo por um tempo._'
  );

  return linhas.join("\n");
}
