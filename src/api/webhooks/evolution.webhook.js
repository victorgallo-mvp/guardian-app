/**
 * Controller do webhook da Evolution API.
 *
 * Ponto de entrada de todo o pipeline: recebe eventos `messages.upsert` e
 * decide entre dois fluxos:
 *
 * - Mensagem de grupo monitorado -> `core/pipeline-mensagem.servico.js`
 *   (filtros, persistência, triagem, análise profunda e notificação).
 * - DM de um responsável -> interpretação de feedback sobre uma
 *   notificação anterior -> loop de aprendizado.
 *
 * Responde 200 imediatamente (a Evolution API re-tenta em caso de timeout
 * ou erro) e processa o evento de forma assíncrona.
 */
import logger from "../../infra/logger.js";
import { ehGrupo } from "../../core/filtros/grupo-permitido.filtro.js";
import { processarMensagemDeGrupo } from "../../core/pipeline-mensagem.servico.js";
import {
  encontrarNotificacaoParaFeedback,
  classificarTipoFeedback
} from "../../core/feedback/interpretador.js";
import { processarFeedback } from "../../core/feedback/aprendizado.servico.js";

/**
 * Processa uma DM recebida de um responsável: tenta interpretá-la como
 * feedback sobre a notificação mais recente enviada a ele.
 */
async function processarMensagemDireta(mensagemPayload) {
  if (mensagemPayload.key.fromMe) return;

  const texto = (
    mensagemPayload.message?.conversation ??
    mensagemPayload.message?.extendedTextMessage?.text ??
    ""
  ).trim();

  if (!texto) return;

  const alvo = await encontrarNotificacaoParaFeedback(mensagemPayload.key.remoteJid);
  if (!alvo) {
    logger.debug("DM recebida sem notificação pendente associada, ignorando", {
      remetente: mensagemPayload.key.remoteJid
    });
    return;
  }

  const tipoFeedback = classificarTipoFeedback(texto);
  await processarFeedback({
    notificacao: alvo.notificacao,
    responsavel: alvo.responsavel,
    tipoFeedback,
    conteudoResposta: texto
  });
}

/**
 * Processa um evento recebido via webhook da Evolution API.
 *
 * @param {object} payload - corpo do webhook (`{ event, instance, data }`)
 */
export async function processarEventoWebhook(payload) {
  if (payload?.event !== "messages.upsert") return;

  const dados = payload.data;
  if (!dados?.key?.remoteJid) return;

  if (ehGrupo(dados.key.remoteJid)) {
    await processarMensagemDeGrupo(dados);
  } else {
    await processarMensagemDireta(dados);
  }
}

/**
 * Handler Express do webhook: responde 200 imediatamente (evita timeouts e
 * retries em cascata na Evolution API) e processa o evento em background.
 */
export function tratarWebhookEvolution(req, res) {
  res.status(200).json({ recebido: true });

  processarEventoWebhook(req.body).catch((erro) => {
    logger.error("Erro ao processar evento de webhook", {
      erro: erro.message,
      stack: erro.stack,
      event: req.body?.event
    });
  });
}
