import { clienteEvolutionPadrao } from "../../infra/evolution-client.js";
import { construirMensagemNotificacao } from "./construtor-mensagem.js";
import Notificacao from "../../dominio/notificacao.modelo.js";
import { registrarNotificacaoEnviada } from "../contexto/memoria-grupo.servico.js";
import config from "../../config/index.js";
import logger from "../../infra/logger.js";

/**
 * Envia uma notificação sobre a análise para o grupo Guardian Zap e persiste
 * o registro. Uma única mensagem por análise, independente do número de responsáveis.
 */
export async function enviarNotificacoes({ analiseDoc, grupo, mensagem }) {
  const texto = construirMensagemNotificacao({ analise: analiseDoc, grupo, mensagem });
  const grupoJid = config.notificacao.grupoJid;

  let idMensagemEnviada = null;
  try {
    const resposta = await clienteEvolutionPadrao.post(
      `/message/sendText/${config.evolution.instanceName}`,
      { number: grupoJid, text: texto }
    );
    idMensagemEnviada = resposta?.key?.id ?? null;
  } catch (erro) {
    logger.error("Falha ao enviar notificação para o grupo Guardian Zap", {
      grupoId: grupo._id,
      grupoJid,
      erro: erro.message
    });
    return [];
  }

  const notificacao = await Notificacao.create({
    clientId: grupo.clientId,
    grupoId: grupo._id,
    analiseId: analiseDoc._id,
    responsavelId: null,
    gatilho: analiseDoc.detectado?.gatilho ?? null,
    conteudoMensagem: texto,
    idMensagemEnviada
  });

  await registrarNotificacaoEnviada(grupo._id);

  return [notificacao];
}
