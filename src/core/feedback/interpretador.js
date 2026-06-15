/**
 * Interpretador de feedback: identifica se uma DM recebida de um
 * responsável é uma resposta a uma notificação do Guardião WPP e, se for,
 * classifica o tipo de feedback.
 */
import Notificacao from "../../dominio/notificacao.modelo.js";
import Responsavel from "../../dominio/responsavel.modelo.js";

const PALAVRAS_SNOOZE = ["pausar", "pausa", "silenciar", "snooze"];
const PALAVRAS_FALSO_POSITIVO = ["👎", "falso", "irrelevante", "ignora", "não era nada", "nao era nada"];
const PALAVRAS_RELEVANTE = ["👍", "relevante", "certo", "valeu", "obrigado", "ok"];

const JANELA_RESPOSTA_HORAS = 24;

/** Extrai o número de telefone de um JID do WhatsApp (ex: "5511999999999@s.whatsapp.net" -> "5511999999999"). */
export function extrairNumeroDeJid(jid) {
  return jid?.split("@")[0] ?? "";
}

/**
 * Classifica o texto de uma resposta de um responsável.
 *
 * A ordem de checagem importa: "pausar" tem prioridade sobre as demais
 * (ex: "👍 mas pode pausar esse grupo" deve ser tratado como snooze).
 *
 * @param {string} texto
 * @returns {"relevante"|"falso_positivo"|"snooze"|"comentario_livre"}
 */
export function classificarTipoFeedback(texto) {
  const normalizado = texto.trim().toLowerCase();

  if (PALAVRAS_SNOOZE.some((p) => normalizado.includes(p))) return "snooze";
  if (PALAVRAS_FALSO_POSITIVO.some((p) => normalizado.includes(p))) return "falso_positivo";
  if (PALAVRAS_RELEVANTE.some((p) => normalizado.includes(p))) return "relevante";

  return "comentario_livre";
}

/**
 * Busca a notificação mais recente ainda sem resposta enviada a um
 * responsável (dentro da janela de resposta), considerada o "alvo" de um
 * feedback recebido em DM.
 *
 * @param {string} remetenteJid - JID de quem enviou a DM (ex: "5511999999999@s.whatsapp.net")
 * @returns {Promise<{notificacao: object, responsavel: object}|null>}
 */
export async function encontrarNotificacaoParaFeedback(remetenteJid) {
  const numero = extrairNumeroDeJid(remetenteJid);
  if (!numero) return null;

  const responsavel = await Responsavel.findOne({ whatsappNumero: numero, ativo: true });
  if (!responsavel) return null;

  const desde = new Date(Date.now() - JANELA_RESPOSTA_HORAS * 60 * 60 * 1000);

  const notificacao = await Notificacao.findOne({
    responsavelId: responsavel._id,
    status: "enviada",
    enviadaEm: { $gte: desde }
  }).sort({ enviadaEm: -1 });

  if (!notificacao) return null;

  return { notificacao, responsavel };
}
