/**
 * Loop de aprendizado: processa o feedback de um responsável sobre uma
 * notificação, atualizando o registro da notificação, as estatísticas do
 * grupo e (no caso de "pausar") o snooze do grupo.
 */
import Feedback from "../../dominio/feedback.modelo.js";
import Grupo from "../../dominio/grupo.modelo.js";
import { registrarFalsoPositivo, registrarRelevanteConfirmado } from "../contexto/memoria-grupo.servico.js";
import logger from "../../infra/logger.js";

const HORAS_SNOOZE_PADRAO = 4;

/** Pausa (snooze) o grupo por algumas horas, suprimindo novas notificações. */
async function pausarGrupo(grupoId, horas = HORAS_SNOOZE_PADRAO) {
  const pausadoAte = new Date(Date.now() + horas * 60 * 60 * 1000);
  await Grupo.updateOne({ _id: grupoId }, { $set: { pausadoAte } });
}

/**
 * Processa o feedback recebido sobre uma notificação: persiste o registro,
 * marca a notificação como respondida e aplica o efeito correspondente
 * (estatísticas do grupo ou snooze).
 *
 * @param {object} notificacao - documento Notificacao (Mongoose)
 * @param {object} responsavel - documento Responsavel
 * @param {string} tipoFeedback - "relevante" | "falso_positivo" | "snooze" | "comentario_livre"
 * @param {string} conteudoResposta - texto original da resposta
 * @returns {Promise<object>} documento Feedback criado
 */
export async function processarFeedback({ notificacao, responsavel, tipoFeedback, conteudoResposta }) {
  const feedback = await Feedback.create({
    clientId: notificacao.clientId,
    notificacaoId: notificacao._id,
    responsavelId: responsavel._id,
    tipoFeedback,
    conteudoResposta
  });

  const statusPorFeedback = {
    relevante: "ciente",
    falso_positivo: "ignorada",
    snooze: "ciente",
    comentario_livre: "ciente"
  };

  notificacao.feedbackId = feedback._id;
  notificacao.status = statusPorFeedback[tipoFeedback] ?? "ciente";
  await notificacao.save();

  switch (tipoFeedback) {
    case "falso_positivo":
      await registrarFalsoPositivo(notificacao.grupoId);
      break;
    case "relevante":
      await registrarRelevanteConfirmado(notificacao.grupoId);
      break;
    case "snooze":
      await pausarGrupo(notificacao.grupoId);
      break;
    default:
      break;
  }

  logger.info("Feedback processado", {
    notificacaoId: notificacao._id,
    tipoFeedback
  });

  return feedback;
}
