/**
 * Deduplicador de notificações.
 *
 * Evita que o mesmo tipo de gatilho gere notificações repetidas em um
 * intervalo curto de tempo no mesmo grupo (ex: cliente manda 3 mensagens
 * irritadas em sequência — só a primeira deve gerar DM).
 *
 * Usado por core/notificacao/throttling.js como uma das checagens
 * antes de enviar uma notificação.
 */
import Notificacao from "../../dominio/notificacao.modelo.js";
import Analise from "../../dominio/analise.modelo.js";

const JANELA_DEDUPLICACAO_MINUTOS_PADRAO = 30;

// Gatilhos tratados como equivalentes para dedup: se qualquer um do grupo disparou,
// os outros são suprimidos. Evita notificações duplas para a mesma situação.
const GRUPOS_EQUIVALENTES = [
  ["fora_do_escopo", "inatividade_preocupante"],
  ["urgencia_explicita", "pedido_humano"]
];

/**
 * Verifica se já existe uma notificação recente pro mesmo grupo + responsável + gatilho.
 *
 * @param {string} grupoId
 * @param {string} idGatilho
 * @param {string} responsavelId
 * @param {number} janelaMinutos - tamanho da janela de deduplicação
 * @returns {Promise<boolean>}
 */
export async function jaNotificadoRecentemente(grupoId, idGatilho, responsavelId, janelaMinutos = JANELA_DEDUPLICACAO_MINUTOS_PADRAO) {
  const desde = new Date(Date.now() - janelaMinutos * 60 * 1000);

  const notificacoesRecentes = await Notificacao.find({
    grupoId,
    responsavelId,
    enviadaEm: { $gte: desde }
  })
    .populate({ path: "analiseId", select: "detectado.gatilho", model: Analise })
    .lean();

  // Expande o gatilho para incluir equivalentes (ex: fora_do_escopo ↔ inatividade_preocupante)
  const equivalentes = GRUPOS_EQUIVALENTES.find((g) => g.includes(idGatilho)) ?? [idGatilho];

  return notificacoesRecentes.some((n) => equivalentes.includes(n.analiseId?.detectado?.gatilho));
}
