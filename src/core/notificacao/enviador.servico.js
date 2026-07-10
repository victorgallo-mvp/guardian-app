/**
 * Enviador de notificações: para cada responsável ativo do grupo, aplica
 * o throttling, monta a mensagem e envia via Evolution API, persistindo
 * o registro da notificação.
 */
import { clienteEvolutionPadrao } from "../../infra/evolution-client.js";
import { construirMensagemNotificacao } from "./construtor-mensagem.js";
import { podeEnviarNotificacao } from "./throttling.js";
import Notificacao from "../../dominio/notificacao.modelo.js";
import Responsavel from "../../dominio/responsavel.modelo.js";
import { registrarNotificacaoEnviada } from "../contexto/memoria-grupo.servico.js";
import config from "../../config/index.js";
import logger from "../../infra/logger.js";

/** Converte um número de WhatsApp (ex: "5511999999999") pro JID de contato individual. */
function paraJidContato(numero) {
  return `${numero.replace(/\D/g, "")}@s.whatsapp.net`;
}

/**
 * Envia notificações sobre uma análise pra todos os responsáveis ativos do
 * grupo, respeitando throttling (deduplicação, snooze, horários).
 *
 * Falha ao notificar um responsável não impede a notificação dos demais —
 * cada envio é tratado de forma independente.
 *
 * @param {object} analiseDoc - documento Analise (Mongoose) já salvo
 * @param {object} grupo - documento Grupo (com `responsaveis` como lista de ids)
 * @param {object} mensagem - documento Mensagem que originou a análise
 * @returns {Promise<object[]>} notificações criadas
 */
export async function enviarNotificacoes({ analiseDoc, grupo, mensagem }) {
  const responsaveis = await Responsavel.find({
    _id: { $in: grupo.responsaveis },
    ativo: true
  });

  const notificacoesCriadas = [];

  for (const responsavel of responsaveis) {
    const { podeEnviar, motivo } = await podeEnviarNotificacao({
      grupo,
      analise: analiseDoc.detectado,
      responsavel
    });

    if (!podeEnviar) {
      logger.info("Notificação não enviada (throttling)", {
        responsavelId: responsavel._id,
        grupoId: grupo._id,
        motivo
      });
      continue;
    }

    const texto = construirMensagemNotificacao({ analise: analiseDoc, grupo, mensagem });

    let idMensagemEnviada = null;
    try {
      const resposta = await clienteEvolutionPadrao.post(`/message/sendText/${config.evolution.instanceName}`, {
        number: paraJidContato(responsavel.whatsappNumero),
        text: texto
      });
      idMensagemEnviada = resposta?.key?.id ?? null;
    } catch (erro) {
      logger.error("Falha ao enviar notificação via Evolution API, pulando este responsável", {
        responsavelId: responsavel._id,
        grupoId: grupo._id,
        erro: erro.message
      });
      continue;
    }

    const notificacao = await Notificacao.create({
      clientId: grupo.clientId,
      grupoId: grupo._id,
      analiseId: analiseDoc._id,
      responsavelId: responsavel._id,
      gatilho: analiseDoc.detectado?.gatilho ?? null,
      conteudoMensagem: texto,
      idMensagemEnviada
    });

    await registrarNotificacaoEnviada(grupo._id);
    notificacoesCriadas.push(notificacao);
  }

  return notificacoesCriadas;
}
